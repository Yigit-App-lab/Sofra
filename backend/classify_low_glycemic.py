import sqlite3

DB_PATH = "/root/recipes.db"

db = sqlite3.connect(DB_PATH)
cur = db.cursor()

cols = {row[1] for row in cur.execute("PRAGMA table_info(recipes)")}
if "is_low_glycemic" not in cols:
    cur.execute(
        "ALTER TABLE recipes ADD COLUMN is_low_glycemic INTEGER DEFAULT 0"
    )

cur.execute("UPDATE recipes SET is_low_glycemic = 0")

cur.execute("""
UPDATE recipes
SET is_low_glycemic = 1
WHERE NOT EXISTS (
    SELECT 1
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN ingredient_aliases ia
      ON ia.alias_normalized = i.name_normalized
    LEFT JOIN kiler_canonical_map kcm
      ON kcm.canonical_id = ia.canonical_id
    LEFT JOIN kiler_ingredients ki
      ON ki.id = kcm.kiler_id
    WHERE ri.recipe_id = recipes.id
      AND (
           ki.name_normalized LIKE '%şeker%'
        OR ki.name_normalized LIKE '%nisasta%'
        OR ki.name_normalized LIKE '%nişasta%'
        OR ki.name_normalized LIKE '%pirinc%'
        OR ki.name_normalized LIKE '%pirinç%'
        OR ki.name_normalized LIKE '%patates%'
        OR ki.name_normalized LIKE '%irmik%'
        OR ki.name_normalized LIKE '%galeta unu%'
        OR ki.name_normalized = 'bal'
        OR ki.name_normalized LIKE '%pekmez%'
        OR ki.name_normalized LIKE '%milföy%'
        OR ki.name_normalized LIKE '%lavaş%'
        OR ki.name_normalized LIKE '%yufka%'
        OR ki.name_normalized LIKE '%ekmek%'
        OR ki.name_normalized LIKE '%makarna%'
        OR (
             ki.name_normalized LIKE '%un%'
             AND ki.name_normalized NOT LIKE '%tam bugday%'
             AND ki.name_normalized NOT LIKE '%tam buğday%'
             AND ki.name_normalized NOT LIKE '%yulaf unu%'
             AND ki.name_normalized NOT LIKE '%badem unu%'
             AND ki.name_normalized NOT LIKE '%siyez unu%'
           )
      )
)
""")

db.commit()

count = cur.execute(
    "SELECT COUNT(*) FROM recipes WHERE is_low_glycemic = 1"
).fetchone()[0]

print("Low glycemic:", count)
db.close()
