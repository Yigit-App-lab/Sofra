"""Does the `yemeği` suffix cost us main dishes, and which fix is safe?

Read-only. Writes nothing, to the database or to any source file.

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

Two fixes are possible, and they are not equally safe:

  stem    "sebze yemek" -> "sebze yeme", one keyword covering every suffix.
          But "yeme" is also a prefix of **yemeyen** — "who does not eat" — so
          "Et Yemeyen Çocuklar İçin" is read as a meat main dish. The stem
          inverts the meaning of the title it matches.

  yemegi  keep "sebze yemek" and add "sebze yemegi" beside it. Longer table,
          same coverage of the possessive, and "yemegi" is not a prefix of
          "yemeyen".

Both are measured here against the live library so the choice rests on counts
rather than on which one sounds tidier.

One thing to know when reading the transitions: `CATEGORY_SCORES` is consulted
**after** every keyword rule, so a recipe scoring -35 from the category table
can be moved by a new strong keyword. Only a -35 from the weak *keyword* tier
is out of reach, because that tier returns before the strong test.

    python3 backend/measure_yemegi_gap.py
    python3 backend/measure_yemegi_gap.py --samples 8
"""
import argparse
import collections
import sqlite3
import sys

from _load_api import api

DB_PATH = "/root/recipes.db"

# Titles that say someone will not eat the thing. A rule that promotes these to
# a main dish of that very ingredient has read the title backwards.
NEGATIVES = ("yemeyen", "yemeyene", "yemez", "yemiyor", "sevmeyen")


def by_stem(words):
    """'sebze yemek' -> 'sebze yeme'. Covers every suffix, and yemeyen too."""
    return tuple(w[:-1] if w.endswith("yemek") else w for w in words)


def by_possessive(words):
    """'sebze yemek' -> 'sebze yemek', 'sebze yemegi'. Nothing is replaced."""
    out = []
    for w in words:
        out.append(w)
        if w.endswith("yemek"):
            # "yemekleri" needs no entry: it already contains "yemek".
            out.append(w[:-1] + "gi")
    return tuple(dict.fromkeys(out))


STRATEGIES = (
    ("stem", by_stem, "one keyword per dish, shortened"),
    ("yemegi", by_possessive, "keep the keyword, add the possessive beside it"),
)


def score_all(rows, strong, medium):
    """Score every recipe with the given tables, then restore nothing here."""
    api._STRONG, api._MEDIUM = strong, medium
    return [api.dinner_category_score(category, title)
            for _, title, category in rows]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--samples", type=int, default=6,
                        help="example recipes per transition")
    args = parser.parse_args()

    live_strong, live_medium = api._STRONG, api._MEDIUM

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    raw = db.execute("""
        SELECT r.id, r.title, r.category
        FROM recipes r
        WHERE NOT EXISTS (
            SELECT 1 FROM recipe_exclusions rex
            WHERE rex.recipe_id = r.id AND rex.active = 1
        )
    """).fetchall()
    db.close()

    rows = [(row["id"], api.clean_recipe_title(row["title"]), row["category"])
            for row in raw]
    folded = [api.fold_tr(f"{category or ''} {title or ''}")
              for _, title, category in rows]

    total = len(rows)
    holding = sum(1 for text in folded if "yemegi" in text or "yemege" in text)
    negatives = sum(1 for text in folded if any(n in text for n in NEGATIVES))
    print(f"recipes considered:            {total:>8,}")
    print(f"holding a possessive form:     {holding:>8,}  "
          f"({100.0 * holding / max(1, total):.1f}%)")
    print(f"saying someone will not eat:   {negatives:>8,}")

    try:
        base = score_all(rows, live_strong, live_medium)

        for name, build, blurb in STRATEGIES:
            strong, medium = build(live_strong), build(live_medium)
            after = score_all(rows, strong, medium)

            transitions = collections.Counter()
            samples = collections.defaultdict(list)
            by_category = collections.defaultdict(collections.Counter)
            inverted = []

            for (recipe_id, title, category), b, a in zip(rows, base, after):
                if b == a:
                    continue
                transitions[(b, a)] += 1
                by_category[(b, a)][category or "(kategorisiz)"] += 1
                if len(samples[(b, a)]) < args.samples:
                    samples[(b, a)].append((category or "(kategorisiz)", title))
                text = api.fold_tr(f"{category or ''} {title or ''}")
                if any(n in text for n in NEGATIVES):
                    inverted.append((category or "(kategorisiz)", title))

            moved = sum(transitions.values())
            print(f"\n{'=' * 78}\n{name}  —  {blurb}")
            print(f"keyword table: {len(live_strong)} -> {len(strong)} strong, "
                  f"{len(live_medium)} -> {len(medium)} medium")
            print(f"scores that would change: {moved:,} "
                  f"({100.0 * moved / max(1, total):.2f}%)")
            print(f"of those, titles saying someone will NOT eat it: "
                  f"{len(inverted):,}")

            print(f"\n{'from':>6} {'to':>6} {'recipes':>10}  reading")
            print("-" * 78)
            for (b, a), n in sorted(transitions.items(), key=lambda kv: -kv[1]):
                if b == 0:
                    reading = "gains an opinion — nothing is reshuffled"
                elif b in (-35, -100):
                    reading = "was scored by the category table, now by a keyword"
                else:
                    reading = "PROMOTED over dishes it used to sit below"
                print(f"{b:>6} {a:>6} {n:>10,}  {reading}")

            if inverted:
                print(f"\n  !! titles the change reads backwards:")
                for category, title in inverted[:args.samples * 2]:
                    print(f"    {str(category)[:30]:30}  {title[:44]}")

            for key in sorted(transitions, key=lambda k: -transitions[k]):
                b, a = key
                print(f"\n  --- {b} -> {a} ({transitions[key]:,}) ---")
                for category, n in by_category[key].most_common(5):
                    print(f"    {n:>6,}  {category}")
                for category, title in samples[key][:args.samples]:
                    print(f"      · {str(category)[:30]:30}  {title[:42]}")
    finally:
        # Whatever happened above, the process must not carry a patched table.
        api._STRONG, api._MEDIUM = live_strong, live_medium

    print("\nNothing was changed. This only reports what each change would do.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
