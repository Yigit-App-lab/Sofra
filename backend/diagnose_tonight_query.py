"""Read-only measurement of the /recipes/tonight cost, and a prototype fix.

Writes nothing. Opens /root/recipes.db with mode=ro.

Background: the live query builds two CTEs across the whole library before any
filtering. `recipe_kiler` materialises ~1.33M rows through a temp B-tree, and
`recipe_completeness` groups over all ~1.63M rows of recipe_ingredients. Both
cost the same whether the cook ticked three ingredients or thirty, which is why
the endpoint measures a flat ~5.9s at limit 1, 5 and 20.

The prototype below drives from kiler_canonical_map (8,198 rows) filtered to the
requested ids, then restricts the rest to the recipes that survive. This script
answers whether that actually wins, and whether it returns the same rows.
"""
import sqlite3
import time

DB = 'file:/root/recipes.db?mode=ro'

db = sqlite3.connect(DB, uri=True)
db.row_factory = sqlite3.Row


def timed(label, sql, params=()):
    start = time.perf_counter()
    rows = db.execute(sql, params).fetchall()
    print(f"  {label:44} {time.perf_counter() - start:6.3f}s   {len(rows):>9,} rows")
    return rows


def kiler_ids(offset, count=6):
    return [r[0] for r in db.execute("""
        SELECT id FROM kiler_ingredients
        ORDER BY recipe_count DESC LIMIT ? OFFSET ?
    """, (count, offset)).fetchall()]


# --- the two CTEs as the live query builds them -----------------------------

LIVE_RECIPE_KILER = """
    SELECT DISTINCT ri.recipe_id, kcm.kiler_id
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
"""

LIVE_COMPLETENESS = """
    SELECT ri.recipe_id,
           COUNT(DISTINCT ri.ingredient_id) AS raw_ingredient_count,
           COUNT(DISTINCT CASE WHEN kcm.kiler_id IS NULL THEN ri.ingredient_id END)
               AS unmapped_ingredient_count
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
    GROUP BY ri.recipe_id
"""

# --- the prototype: start from the requested ids ----------------------------

def proto_matched(ids):
    place = ",".join("?" * len(ids))
    return f"""
        SELECT ri.recipe_id,
               COUNT(DISTINCT kcm.kiler_id) AS matched_count,
               COUNT(DISTINCT CASE WHEN ki.ingredient_class = 'protein'
                                   THEN kcm.kiler_id END) AS matched_protein_count
        FROM kiler_canonical_map kcm
        JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
        JOIN ingredient_aliases ia ON ia.canonical_id = kcm.canonical_id
        JOIN ingredients i ON i.name_normalized = ia.alias_normalized
        JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
        WHERE kcm.kiler_id IN ({place})
        GROUP BY ri.recipe_id
    """


def proto_completeness(ids):
    return f"""
        WITH matched AS ({proto_matched(ids)})
        SELECT ri.recipe_id,
               COUNT(DISTINCT ri.ingredient_id) AS raw_ingredient_count,
               COUNT(DISTINCT CASE WHEN kcm.kiler_id IS NULL THEN ri.ingredient_id END)
                   AS unmapped_ingredient_count
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
        LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
        WHERE ri.recipe_id IN (SELECT recipe_id FROM matched)
        GROUP BY ri.recipe_id
    """


print("=== scale ===")
for table in ('recipes', 'recipe_ingredients', 'ingredients',
              'ingredient_aliases', 'kiler_canonical_map', 'kiler_ingredients'):
    n = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table:24} {n:>12,}")

print("\n=== the live CTEs, which ignore what the cook selected ===")
timed("recipe_kiler (whole library)", LIVE_RECIPE_KILER)
timed("recipe_completeness (whole library)", LIVE_COMPLETENESS)

SCENARIOS = [
    ("the six most common ingredients (worst case)", kiler_ids(0)),
    ("six ordinary ingredients", kiler_ids(60)),
    ("six rarer ingredients", kiler_ids(400)),
]

for label, ids in SCENARIOS:
    if len(ids) < 6:
        print(f"\n=== {label}: not enough ingredients in the table, skipped ===")
        continue
    names = [r[0] for r in db.execute(
        "SELECT name FROM kiler_ingredients WHERE id IN (%s)"
        % ",".join("?" * len(ids)), ids).fetchall()]
    print(f"\n=== {label} ===")
    print(f"  {', '.join(names)}")
    matched = timed("prototype matched (drives from the ids)", proto_matched(ids), ids)
    share = 100.0 * len(matched) / max(1, db.execute("SELECT COUNT(*) FROM recipes").fetchone()[0])
    print(f"  {'candidate recipes':44} {share:6.1f}% of the library")
    timed("prototype completeness (restricted)", proto_completeness(ids), ids)

print("\n=== does the prototype agree with the live shape? ===")
ids = kiler_ids(60)
place = ",".join("?" * len(ids))
live = db.execute(f"""
    WITH recipe_kiler AS ({LIVE_RECIPE_KILER})
    SELECT rk.recipe_id, COUNT(DISTINCT rk.kiler_id) AS matched_count
    FROM recipe_kiler rk
    JOIN kiler_ingredients km ON km.id = rk.kiler_id
    WHERE rk.kiler_id IN ({place})
    GROUP BY rk.recipe_id
""", ids).fetchall()
proto = db.execute(proto_matched(ids), ids).fetchall()
live_map = {r['recipe_id']: r['matched_count'] for r in live}
proto_map = {r['recipe_id']: r['matched_count'] for r in proto}
print(f"  live rows {len(live_map):,}   prototype rows {len(proto_map):,}")
if live_map == proto_map:
    print("  identical")
else:
    only_live = set(live_map) - set(proto_map)
    only_proto = set(proto_map) - set(live_map)
    differing = [k for k in set(live_map) & set(proto_map) if live_map[k] != proto_map[k]]
    print(f"  DIFFERS — live only {len(only_live)}, prototype only {len(only_proto)}, "
          f"different counts {len(differing)}")
    for k in list(only_live)[:5]:
        print(f"    live only: recipe {k} = {live_map[k]}")
    for k in differing[:5]:
        print(f"    recipe {k}: live {live_map[k]} vs prototype {proto_map[k]}")

db.close()
