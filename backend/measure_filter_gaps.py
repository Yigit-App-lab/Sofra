"""How often do the gluten-free and lactose-free filters let something through?

Read-only. Writes nothing.

The API excludes a recipe only when an ingredient maps to a kiler_ingredients
row whose contains_gluten / contains_lactose is 1. An ingredient the catalogue
does not recognise maps to nothing, so the flag is NULL, the NOT EXISTS passes,
and the recipe is served as gluten-free. This counts the recipes where that
happens and an unmapped ingredient looks like wheat or dairy by name.
"""
import re
import sqlite3

db = sqlite3.connect('file:/root/recipes.db?mode=ro', uri=True)
db.row_factory = sqlite3.Row

GLUTEN = r"(un|bugday|buğday|ekmek|makarna|irmik|galeta|yufka|milfoy|milföy|" \
         r"erişte|eriste|sehriye|şehriye|bulgur|arpa|çavdar|cavdar|kepek|" \
         r"hamur|bisküvi|biskuvi|kadayıf|kadayif|baklava)"
LACTOSE = r"(sut|süt|yogurt|yoğurt|peynir|kasar|kaşar|tereyag|tereyağ|krema|" \
          r"kaymak|ayran|lor|çökelek|cokelek|labne|mozzarella|parmesan)"

# Recipes that pass the gluten-free filter as the API writes it.
PASSES = """
    SELECT r.id, r.title
    FROM recipes r
    WHERE NOT EXISTS (
        SELECT 1 FROM recipe_ingredients rg
        JOIN ingredients ig ON ig.id = rg.ingredient_id
        LEFT JOIN ingredient_aliases iag ON iag.alias_normalized = ig.name_normalized
        LEFT JOIN kiler_canonical_map kcg ON kcg.canonical_id = iag.canonical_id
        LEFT JOIN kiler_ingredients kig ON kig.id = kcg.kiler_id
        WHERE rg.recipe_id = r.id AND kig.{flag} = 1
    )
    AND NOT EXISTS (
        SELECT 1 FROM recipe_exclusions rex
        WHERE rex.recipe_id = r.id AND rex.active = 1
    )
"""

# The unmapped ingredient names of those recipes.
UNMAPPED = """
    SELECT rg.recipe_id, ig.name
    FROM recipe_ingredients rg
    JOIN ingredients ig ON ig.id = rg.ingredient_id
    LEFT JOIN ingredient_aliases iag ON iag.alias_normalized = ig.name_normalized
    LEFT JOIN kiler_canonical_map kcg ON kcg.canonical_id = iag.canonical_id
    WHERE kcg.kiler_id IS NULL
"""

unmapped = {}
for row in db.execute(UNMAPPED):
    unmapped.setdefault(row["recipe_id"], []).append(row["name"] or "")

for label, flag, pattern in (("gluten-free", "contains_gluten", GLUTEN),
                             ("lactose-free", "contains_lactose", LACTOSE)):
    rx = re.compile(pattern, re.I)
    passing = db.execute(PASSES.format(flag=flag)).fetchall()
    suspect = []
    for row in passing:
        names = [n for n in unmapped.get(row["id"], []) if rx.search(n)]
        if names:
            suspect.append((row["title"], sorted(set(names))[:3]))
    share = 100.0 * len(suspect) / max(1, len(passing))
    print(f"\n=== {label} ===")
    print(f"  recipes passing the filter:        {len(passing):>8,}")
    print(f"  of those, with a suspect unmapped ingredient: "
          f"{len(suspect):>6,}  ({share:.1f}%)")
    for title, names in suspect[:10]:
        print(f"    {title[:44]:46} <- {', '.join(names)}")

db.close()
