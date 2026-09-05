"""Does the `yemeği` suffix cost us main dishes? Read-only. Writes nothing.

`dinner_category_score` has some two dozen strong keywords of the form
"sebze yemek", "et yemek", "fırın yemek". Turkish softens the k before a
possessive suffix, so the singular is "sebze yemeği", and `fold_tr` turns that
into "sebze yemegi" — which does not contain "yemek". The plural "yemekleri"
matches, the singular never does.

`audit_dinner_classification.py` shows this only where the recipe scores 0
("Sizden Sebze Yemeği Tarifleri", 53 recipes). The more expensive case is
invisible there: a main dish whose category says "Sebze Yemeği" and whose title
says "çorba" matches nothing strong, falls through to the medium rule and
scores 15. It is not unranked, it is **mis-ranked**, and no bucket count will
ever show it.

So this measures the proposed fix instead of assuming it. The fix shortens
every "... yemek" keyword to "... yeme", which is a prefix of yemek, yemeği,
yemekleri and yemeğe alike.

Unlike the category table added on 2026-09-05, this is NOT purely additive, and
it is worth being exact about why. The rules run reject → weak → strong →
medium, so a new strong keyword can never touch a recipe that already scored
-100 or -35: those return before the strong test. The only reachable moves are
0 → 30 and 15 → 30. The second is a real reshuffle — a soup promoted to main
dish — so the count of it is the number this script exists to produce.

    python3 backend/measure_yemegi_gap.py
    python3 backend/measure_yemegi_gap.py --samples 8
"""
import argparse
import collections
import sqlite3
import sys

from _load_api import api

DB_PATH = "/root/recipes.db"


def proposed(words):
    """Every '... yemek' keyword shortened to its stem. The rest unchanged."""
    return tuple(w[:-1] if w.endswith("yemek") else w for w in words)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--samples", type=int, default=6,
                        help="example recipes per transition")
    args = parser.parse_args()

    live_strong, live_medium = api._STRONG, api._MEDIUM
    new_strong, new_medium = proposed(live_strong), proposed(live_medium)

    changed = [(a, b) for a, b in zip(live_strong + live_medium,
                                      new_strong + new_medium) if a != b]
    print(f"keywords shortened: {len(changed)}")
    for before, after in changed:
        print(f"    {before!r} -> {after!r}")

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

    # How many recipes are even in reach of this, however they score.
    holding_singular = 0
    transitions = collections.Counter()
    samples = collections.defaultdict(list)
    by_category = collections.defaultdict(collections.Counter)

    for row in rows:
        title = api.clean_recipe_title(row["title"])
        text = api.fold_tr(f"{row['category'] or ''} {title or ''}")
        if "yemegi" in text or "yemege" in text or "yemegin" in text:
            holding_singular += 1

        api._STRONG, api._MEDIUM = live_strong, live_medium
        before = api.dinner_category_score(row["category"], title)

        api._STRONG, api._MEDIUM = new_strong, new_medium
        after = api.dinner_category_score(row["category"], title)

        if before != after:
            transitions[(before, after)] += 1
            by_category[(before, after)][row["category"] or "(kategorisiz)"] += 1
            if len(samples[(before, after)]) < args.samples:
                samples[(before, after)].append(
                    (row["category"] or "(kategorisiz)", title))

    api._STRONG, api._MEDIUM = live_strong, live_medium  # leave it as we found it

    total = len(rows)
    moved = sum(transitions.values())
    print(f"\nrecipes considered:        {total:>8,}")
    print(f"holding a singular form:   {holding_singular:>8,}  "
          f"({100.0 * holding_singular / max(1, total):.1f}%)")
    print(f"scores that would change:  {moved:>8,}  "
          f"({100.0 * moved / max(1, total):.1f}%)")

    if not transitions:
        print("\nNothing moves. The suffix is not costing anything measurable.")
        db.close()
        return 0

    print(f"\n{'from':>6} {'to':>6} {'recipes':>10}  reading")
    print("-" * 78)
    for (before, after), n in sorted(transitions.items(), key=lambda kv: -kv[1]):
        if before == 0:
            reading = "gains an opinion — additive, no reshuffle"
        elif before == 15 and after == 30:
            reading = "PROMOTED over dishes it used to sit below"
        else:
            reading = "unexpected: the rule order should make this impossible"
        print(f"{before:>6} {after:>6} {n:>10,}  {reading}")

    for key in sorted(transitions, key=lambda k: -transitions[k]):
        before, after = key
        print(f"\n--- {before} -> {after} ({transitions[key]:,} recipes) ---")
        print("  top categories:")
        for category, n in by_category[key].most_common(6):
            print(f"    {n:>6,}  {category}")
        print("  examples:")
        for category, title in samples[key]:
            print(f"    {str(category)[:34]:34}  {title[:44]}")

    print("\nNothing was changed. This only reports what the change would do.")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
