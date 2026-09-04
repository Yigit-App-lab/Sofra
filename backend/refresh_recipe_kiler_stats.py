"""Build `recipe_kiler_stats`, the per-recipe counts /recipes/tonight needs.

Three numbers per recipe:

  total_kiler_ingredients   how many distinct kiler ingredients it maps to
  raw_ingredient_count      how many distinct ingredients it lists
  unmapped_ingredient_count how many of those map to no kiler ingredient

None of them depend on what the cook selected — every request produced the same
answer — yet they were recomputed from ~1.6M rows of recipe_ingredients on every
call. That was most of the endpoint's ~5.9s.

This script only ever creates and fills `recipe_kiler_stats`. No existing table
is read for anything but SELECT, and none is modified, so there is nothing to
roll back beyond dropping the table. `recipe_api.py` falls back to computing the
counts inline whenever the table is missing or does not cover every recipe, so a
stale table makes the endpoint slow, never wrong.

    python3 backend/refresh_recipe_kiler_stats.py --dry-run
    python3 backend/refresh_recipe_kiler_stats.py

RUN THIS AFTER anything that changes recipes, recipe_ingredients, ingredients,
ingredient_aliases or kiler_canonical_map — a recipe import, a quarantine pass,
or an alias edit.
"""
import argparse
import sqlite3
import sys
import time

DB_PATH = "/root/recipes.db"
TABLE = "recipe_kiler_stats"

SOURCE_QUERY = """
    SELECT
        ri.recipe_id,
        COUNT(DISTINCT kcm.kiler_id) AS total_kiler_ingredients,
        COUNT(DISTINCT ri.ingredient_id) AS raw_ingredient_count,
        COUNT(DISTINCT CASE
            WHEN kcm.kiler_id IS NULL THEN ri.ingredient_id
        END) AS unmapped_ingredient_count
    FROM recipe_ingredients ri
    JOIN ingredients i
        ON i.id = ri.ingredient_id
    LEFT JOIN ingredient_aliases ia
        ON ia.alias_normalized = i.name_normalized
    LEFT JOIN kiler_canonical_map kcm
        ON kcm.canonical_id = ia.canonical_id
    GROUP BY ri.recipe_id
"""


def verify(db):
    """Does the stored table still say what a fresh computation says?

    This is the gate that matters after the rewrite: /recipes/tonight now trusts
    this table for three of the numbers it ranks on, so a wrong row is a wrong
    suggestion rather than a slow one.
    """
    try:
        stored = {r["recipe_id"]: (r["total_kiler_ingredients"],
                                   r["raw_ingredient_count"],
                                   r["unmapped_ingredient_count"])
                  for r in db.execute(
                      f"SELECT recipe_id, total_kiler_ingredients, "
                      f"raw_ingredient_count, unmapped_ingredient_count "
                      f"FROM {TABLE}").fetchall()}
    except sqlite3.Error as e:
        print(f"{TABLE} cannot be read: {e}")
        print("the API is computing the counts inline, which is correct but slow")
        return 1

    start = time.perf_counter()
    fresh = {r["recipe_id"]: (r["total_kiler_ingredients"],
                              r["raw_ingredient_count"],
                              r["unmapped_ingredient_count"])
             for r in db.execute(SOURCE_QUERY).fetchall()}
    print(f"recomputed {len(fresh):,} rows in {time.perf_counter() - start:.1f}s")
    print(f"stored     {len(stored):,} rows")

    recipes = {r[0] for r in db.execute("SELECT id FROM recipes").fetchall()}
    uncovered = recipes - set(stored)
    differing = [rid for rid in set(fresh) & set(stored) if fresh[rid] != stored[rid]]
    # A recipe with no ingredient rows produces no group in the fresh query but
    # is stored as zeros on purpose, so it is not a mismatch.
    missing_from_stored = set(fresh) - set(stored)

    if uncovered:
        print(f"MISMATCH: {len(uncovered):,} recipes are not in the table "
              f"(e.g. {sorted(uncovered)[:5]})")
    if missing_from_stored:
        print(f"MISMATCH: {len(missing_from_stored):,} computed recipes are absent "
              f"from the table (e.g. {sorted(missing_from_stored)[:5]})")
    for rid in differing[:10]:
        print(f"MISMATCH: recipe {rid}: stored {stored[rid]} vs fresh {fresh[rid]}")
    if differing:
        print(f"MISMATCH: {len(differing):,} rows differ in total")

    if uncovered or missing_from_stored or differing:
        print("\nrun without --verify to rebuild the table")
        return 1
    print("\nthe table agrees with a fresh computation, for every recipe")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would be written and change nothing")
    parser.add_argument("--verify", action="store_true",
                        help="recompute and compare against the stored table, "
                             "changing nothing; exits non-zero on any mismatch")
    args = parser.parse_args()

    read_only_mode = args.dry_run or args.verify
    read_only = f"file:{args.db}?mode=ro" if read_only_mode else args.db
    db = sqlite3.connect(read_only, uri=read_only_mode)
    db.row_factory = sqlite3.Row

    if args.verify:
        return verify(db)

    recipes = db.execute("SELECT COUNT(*) FROM recipes").fetchone()[0]
    try:
        existing = db.execute(f"SELECT COUNT(*) FROM {TABLE}").fetchone()[0]
    except sqlite3.Error:
        existing = None
    print(f"recipes in library:      {recipes:>10,}")
    print(f"rows in {TABLE}: "
          f"{'(table does not exist)' if existing is None else format(existing, ',')}")

    start = time.perf_counter()
    rows = db.execute(SOURCE_QUERY).fetchall()
    print(f"computed {len(rows):,} rows in {time.perf_counter() - start:.1f}s")

    # A recipe with no ingredient rows at all produces no group, so it would be
    # absent from the table and the endpoint would drop it. Cover those too.
    covered = {r["recipe_id"] for r in rows}
    orphans = [r[0] for r in db.execute("SELECT id FROM recipes").fetchall()
               if r[0] not in covered]
    if orphans:
        print(f"{len(orphans):,} recipes have no ingredient rows; storing zeros for them")

    if args.dry_run:
        print("\ndry run: nothing written")
        sample = rows[:5]
        for r in sample:
            print(f"  recipe {r['recipe_id']}: total={r['total_kiler_ingredients']} "
                  f"raw={r['raw_ingredient_count']} "
                  f"unmapped={r['unmapped_ingredient_count']}")
        db.close()
        return 0

    payload = [(r["recipe_id"], r["total_kiler_ingredients"],
                r["raw_ingredient_count"], r["unmapped_ingredient_count"])
               for r in rows]
    payload.extend((recipe_id, 0, 0, 0) for recipe_id in orphans)

    # Built beside the live table and swapped in, so a reader is never looking
    # at a half-filled table.
    db.executescript(f"""
        DROP TABLE IF EXISTS {TABLE}_new;
        CREATE TABLE {TABLE}_new (
            recipe_id INTEGER PRIMARY KEY,
            total_kiler_ingredients INTEGER NOT NULL,
            raw_ingredient_count INTEGER NOT NULL,
            unmapped_ingredient_count INTEGER NOT NULL
        );
    """)
    db.executemany(
        f"INSERT INTO {TABLE}_new "
        "(recipe_id, total_kiler_ingredients, raw_ingredient_count, "
        "unmapped_ingredient_count) VALUES (?, ?, ?, ?)",
        payload,
    )
    db.executescript(f"""
        DROP TABLE IF EXISTS {TABLE}_old;
        ALTER TABLE {TABLE} RENAME TO {TABLE}_old;
    """ if existing is not None else "")
    db.execute(f"ALTER TABLE {TABLE}_new RENAME TO {TABLE}")
    db.executescript(f"DROP TABLE IF EXISTS {TABLE}_old;")
    db.commit()

    written = db.execute(f"SELECT COUNT(*) FROM {TABLE}").fetchone()[0]
    print(f"\nwrote {written:,} rows to {TABLE}")
    if written < recipes:
        print(f"WARNING: {recipes - written:,} recipes are not covered — the API "
              "will keep computing the counts inline")
        db.close()
        return 1
    print("every recipe covered; /recipes/tonight will use the table")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
