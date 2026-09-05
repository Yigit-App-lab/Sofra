"""Where does dinner suitability scoring have nothing to say?

Read-only. Writes nothing.

`dinner_category_score` sorts a recipe into reject (-100), weak (-35), medium
(15), strong (30) or **0 — no opinion at all**. That last bucket is the problem:
a recipe scoring 0 competes with real dinners on ranking alone, so a category
the keyword lists never heard of behaves as though it were neutral.

This lists the categories by how many recipes they hold and what the scorer says
about them, so the next keywords added are the ones that move the most recipes
rather than the ones that came to mind.

It imports the live scorer through `_load_api`, so what it reports is what the
API does — not a copy that will drift.

    python3 backend/audit_dinner_classification.py
    python3 backend/audit_dinner_classification.py --top 40 --samples 4
"""
import argparse
import collections
import sqlite3
import sys

from _load_api import api

DB_PATH = "/root/recipes.db"

BUCKETS = [
    (-100, "reject   ", "never offered as dinner"),
    (-35, "weak     ", "searchable, does not lead the evening list"),
    (0, "no opinion", "competes on ranking alone — the gap"),
    (15, "medium   ", "a dinner, usually below a main dish"),
    (30, "strong   ", "a main evening dish"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--top", type=int, default=30,
                        help="how many unscored categories to list")
    parser.add_argument("--samples", type=int, default=3,
                        help="example titles per category")
    args = parser.parse_args()

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row

    rows = db.execute("""
        SELECT r.id, r.title, r.category
        FROM recipes r
        WHERE NOT EXISTS (
            SELECT 1 FROM recipe_exclusions rex
            WHERE rex.recipe_id = r.id AND rex.active = 1
        )
    """).fetchall()

    by_bucket = collections.Counter()
    by_category = collections.defaultdict(
        lambda: {"count": 0, "scores": collections.Counter(), "titles": []})
    # A recipe rejected only because of its title's head noun is a condiment the
    # category never flagged; counted separately to show what that rule caught.
    head_rejected = 0

    for row in rows:
        title = api.clean_recipe_title(row["title"])
        score = api.dinner_category_score(row["category"], title)
        by_bucket[score] += 1
        record = by_category[row["category"] or "(kategorisiz)"]
        record["count"] += 1
        record["scores"][score] += 1
        if len(record["titles"]) < args.samples:
            record["titles"].append(title)
        if score == -100 and api.title_head_word(title) in api.NOT_A_MEAL_HEADS:
            head_rejected += 1

    total = len(rows)
    print(f"recipes considered: {total:,}\n")
    print(f"{'bucket':12} {'score':>6} {'recipes':>10} {'share':>7}  meaning")
    print("-" * 78)
    for score, label, meaning in BUCKETS:
        n = by_bucket.get(score, 0)
        print(f"{label:12} {score:>6} {n:>10,} {100.0 * n / max(1, total):>6.1f}%  {meaning}")
    other = {s: n for s, n in by_bucket.items()
             if s not in {b[0] for b in BUCKETS}}
    for score, n in sorted(other.items()):
        print(f"{'other':12} {score:>6} {n:>10,} {100.0 * n / max(1, total):>6.1f}%")

    print(f"\nrejected by the condiment head-noun rule: {head_rejected:,}")

    # The categories where the scorer has no opinion, largest first. These are
    # the keyword additions worth making.
    unscored = []
    for category, record in by_category.items():
        zero = record["scores"].get(0, 0)
        if zero:
            unscored.append((zero, category, record))
    unscored.sort(key=lambda item: -item[0])

    print(f"\n--- categories scoring 0, largest first ---")
    print(f"{'recipes':>8}  {'category':34} examples")
    print("-" * 96)
    for zero, category, record in unscored[:args.top]:
        examples = "; ".join(t[:26] for t in record["titles"])
        print(f"{zero:>8,}  {str(category)[:34]:34} {examples[:52]}")

    covered = sum(z for z, _, _ in unscored[:args.top])
    print(f"\nclassifying the top {min(args.top, len(unscored))} of these would give "
          f"an opinion on {covered:,} recipes "
          f"({100.0 * covered / max(1, total):.1f}% of the library).")
    print(f"{len(unscored):,} categories score 0 in total.")

    print("\nNothing was changed. Add keywords to dinner_category_score in "
          "backend/recipe_api.py, then re-run this to see the buckets move.")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
