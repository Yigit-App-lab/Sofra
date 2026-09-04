"""Read-only diagnosis of the /recipes/tonight query. Writes nothing."""
import sqlite3, time

db = sqlite3.connect('file:/root/recipes.db?mode=ro', uri=True)
db.row_factory = sqlite3.Row

TABLES = ['recipes', 'recipe_ingredients', 'ingredients', 'ingredient_aliases',
          'kiler_canonical_map', 'kiler_ingredients', 'recipe_core_ingredients',
          'recipe_exclusions']

print("=== row counts ===")
for name in TABLES:
    try:
        n = db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        print(f"{name:26} {n:>9,}")
    except sqlite3.Error as e:
        print(f"{name:26} -- {e}")

print("\n=== indexes ===")
rows = db.execute("""
    SELECT tbl_name, name, sql FROM sqlite_master
    WHERE type='index' AND tbl_name IN (%s)
    ORDER BY tbl_name, name
""" % ",".join("?" * len(TABLES)), TABLES).fetchall()
for r in rows:
    print(f"{r['tbl_name']:26} {r['name']:38} {r['sql'] or '(implicit)'}")
if not rows:
    print("none at all")

def timed(label, sql, params=()):
    start = time.perf_counter()
    n = len(db.execute(sql, params).fetchall())
    print(f"{label:34} {time.perf_counter() - start:6.3f}s   {n:>7,} rows")

ids = [r[0] for r in db.execute(
    "SELECT id FROM kiler_ingredients ORDER BY recipe_count DESC LIMIT 6").fetchall()]
print(f"\n=== timings (kiler ids {ids}) ===")
place = ",".join("?" * len(ids))

timed("recipe_kiler (whole table)", """
    SELECT DISTINCT ri.recipe_id, kcm.kiler_id
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
""")

timed("recipe_completeness (whole table)", """
    SELECT ri.recipe_id, COUNT(DISTINCT ri.ingredient_id)
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
    GROUP BY ri.recipe_id
""")

timed("the same, filtered to your ids", f"""
    SELECT DISTINCT ri.recipe_id, kcm.kiler_id
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
    WHERE kcm.kiler_id IN ({place})
""", ids)

print("\n=== query plan for recipe_kiler ===")
for r in db.execute("""
    EXPLAIN QUERY PLAN
    SELECT DISTINCT ri.recipe_id, kcm.kiler_id
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
""").fetchall():
    print("  " + str(r['detail']))

db.close()
