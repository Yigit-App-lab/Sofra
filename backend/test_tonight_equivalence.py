"""Compare /recipes/tonight against an earlier revision of itself.

Builds a synthetic library with the same shape as the live one, imports the
current backend/recipe_api.py and the one from a chosen git revision as two
modules, and compares every ranking field of every returned row, in both the
inline and the precomputed code paths.

This exists because the endpoint was rewritten for speed, and "faster" is only
acceptable if the suggestions do not change. It caught one real bug during that
rewrite: an alias collision that broke the precomputed path only.

    python3 backend/test_tonight_equivalence.py --baseline-rev HEAD~1

Needs fastapi and pydantic, which live in the service virtualenv on the VPS:

    systemctl cat sofra-api.service | grep -i exec     # find the interpreter
    /path/to/venv/bin/python backend/test_tonight_equivalence.py --baseline-rev <rev>

Reads no live data and touches no live database; everything runs in a temp file.
"""
import os
import random
import sqlite3
import subprocess
import sys
import tempfile

import argparse

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(WORK, 'backend')

SCHEMA = """
CREATE TABLE recipes(
  id INTEGER PRIMARY KEY, title TEXT, category TEXT,
  prep_minutes INT, cook_minutes INT, total_minutes INT, servings INT,
  is_vegan INT DEFAULT 0, is_vegetarian INT DEFAULT 0, is_low_glycemic INT DEFAULT 0);
CREATE TABLE recipe_ingredients(
  recipe_id INT, ingredient_id INT, quantity REAL, unit TEXT, original_text TEXT);
CREATE TABLE ingredients(id INTEGER PRIMARY KEY, name TEXT, name_normalized TEXT);
CREATE TABLE ingredient_aliases(alias_normalized TEXT, canonical_id INT);
CREATE TABLE kiler_canonical_map(canonical_id INTEGER PRIMARY KEY, kiler_id INT);
CREATE TABLE kiler_ingredients(
  id INTEGER PRIMARY KEY, name TEXT, name_normalized TEXT, ingredient_class TEXT,
  recipe_count INT DEFAULT 0, contains_gluten INT DEFAULT 0, contains_lactose INT DEFAULT 0);
CREATE TABLE recipe_core_ingredients(recipe_id INT, kiler_id INT, score INT);
CREATE TABLE recipe_exclusions(recipe_id INT, active INT DEFAULT 1);
CREATE INDEX idx_ingredients_name ON ingredients(name_normalized);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_ingredient_alias_normalized ON ingredient_aliases(alias_normalized);
CREATE INDEX idx_ingredient_alias_canonical ON ingredient_aliases(canonical_id);
CREATE INDEX idx_kiler_map ON kiler_canonical_map(kiler_id);
"""

KILER = [
    (1, 'tuz', 'other'), (2, 'yumurta', 'protein'), (3, 'un', 'grain'),
    (4, 'sıvı yağ', 'other'), (5, 'süt', 'other'), (6, 'şeker', 'other'),
    (7, 'kıyma', 'protein'), (8, 'tavuk', 'protein'), (9, 'domates', 'vegetable'),
    (10, 'soğan', 'vegetable'), (11, 'patates', 'vegetable'), (12, 'limon', 'fruit'),
]
CATEGORIES = ['tavuk yemekleri', 'çorba', 'makarna', 'köfte', 'salata', None]


def build(path, seed=7):
    rng = random.Random(seed)
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    for kid, name, cls in KILER:
        db.execute("INSERT INTO kiler_ingredients(id,name,name_normalized,"
                   "ingredient_class,recipe_count) VALUES (?,?,?,?,?)",
                   (kid, name, name, cls, 100 - kid))
        # canonical id == kiler id keeps the mapping easy to reason about
        db.execute("INSERT INTO kiler_canonical_map(canonical_id,kiler_id) VALUES (?,?)",
                   (kid, kid))
        db.execute("INSERT INTO ingredient_aliases(alias_normalized,canonical_id) VALUES (?,?)",
                   (name, kid))
        db.execute("INSERT INTO ingredients(id,name,name_normalized) VALUES (?,?,?)",
                   (kid, name, name))
    # ingredients that map to nothing, so unmapped_ingredient_count is exercised
    for n in range(1, 9):
        iid = 100 + n
        db.execute("INSERT INTO ingredients(id,name,name_normalized) VALUES (?,?,?)",
                   (iid, f'bilinmeyen {n}', f'bilinmeyen {n}'))
    # a second alias pointing at the same canonical id: one kiler ingredient,
    # two ingredient rows. This is where a rewritten join can double-count.
    db.execute("INSERT INTO ingredients(id,name,name_normalized) VALUES (200,'domatesler','domatesler')")
    db.execute("INSERT INTO ingredient_aliases(alias_normalized,canonical_id) VALUES ('domatesler',9)")

    for rid in range(1, 61):
        minutes = rng.choice([None, 15, 30, 45, 60, 90])
        db.execute("INSERT INTO recipes(id,title,category,prep_minutes,cook_minutes,"
                   "total_minutes,servings,is_vegan,is_vegetarian,is_low_glycemic) "
                   "VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (rid, f'Yemek {rid}', rng.choice(CATEGORIES), 10, 20, minutes,
                    rng.choice([2, 4, 6]), rng.randint(0, 1), rng.randint(0, 1),
                    rng.randint(0, 1)))
        mapped = rng.sample([k[0] for k in KILER], rng.randint(1, 6))
        for iid in mapped:
            db.execute("INSERT INTO recipe_ingredients VALUES (?,?,?,?,?)",
                       (rid, iid, rng.choice([None, 100.0, 2.0]), 'g', 'metin'))
        if rid % 7 == 0:      # some recipes also list the second alias for domates
            db.execute("INSERT INTO recipe_ingredients VALUES (?,200,1.0,'adet','domatesler')", (rid,))
        for n in range(rng.randint(0, 3)):
            db.execute("INSERT INTO recipe_ingredients VALUES (?,?,1.0,'g','bilinmeyen')",
                       (rid, 101 + n))
        for kid in rng.sample(mapped, min(len(mapped), rng.randint(0, 2))):
            db.execute("INSERT INTO recipe_core_ingredients VALUES (?,?,?)",
                       (rid, kid, rng.choice([50, 100, 150])))
        if rid % 11 == 0:
            db.execute("INSERT INTO recipe_exclusions VALUES (?,1)", (rid,))
    # a recipe with no ingredient rows at all
    db.execute("INSERT INTO recipes(id,title,category,total_minutes,servings) "
               "VALUES (999,'Boş yemek','çorba',20,2)")
    db.commit()
    db.close()


def load_module(name, source_path, db_path):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, source_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    module.DB = db_path
    return module


def run(module, ids, **kwargs):
    payload = module.TonightRequest(kiler_ids=ids, limit=kwargs.pop('limit', 50), **kwargs)
    return module.recipes_tonight(payload)


def compare(label, old_rows, new_rows, fields):
    old_map = {r['id']: r for r in old_rows['recipes']}
    new_map = {r['id']: r for r in new_rows['recipes']}
    problems = []
    if set(old_map) != set(new_map):
        problems.append(f"different recipes: old-only {sorted(set(old_map)-set(new_map))[:6]}, "
                        f"new-only {sorted(set(new_map)-set(old_map))[:6]}")
    for rid in sorted(set(old_map) & set(new_map)):
        for f in fields:
            if old_map[rid].get(f) != new_map[rid].get(f):
                problems.append(f"recipe {rid}.{f}: old {old_map[rid].get(f)} "
                                f"vs new {new_map[rid].get(f)}")
    order_old = [r['id'] for r in old_rows['recipes']]
    order_new = [r['id'] for r in new_rows['recipes']]
    if order_old != order_new:
        problems.append(f"order differs\n    old {order_old[:10]}\n    new {order_new[:10]}")
    print(f"  {label:52} {'ok' if not problems else 'MISMATCH'}  "
          f"({len(old_map)} recipes)")
    for p in problems[:6]:
        print("      " + p)
    return not problems


FIELDS = ['matched_count', 'matched_protein_count', 'total_kiler_ingredients',
          'raw_ingredient_count', 'unmapped_ingredient_count',
          'strict_total_ingredients', 'known_missing_count', 'missing_count',
          'is_ready', 'core_count', 'core_matched_count', 'core_missing_count',
          'match_percent', 'score', 'tonight_score']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-rev', default='HEAD',
                        help="git revision to compare against (default HEAD; "
                             "use HEAD~1 once the rewrite is committed)")
    args = parser.parse_args()
    tmp = tempfile.mkdtemp()
    db_path = os.path.join(tmp, 'recipes.db')
    build(db_path)

    baseline = os.path.join(tmp, 'recipe_api_old.py')
    with open(baseline, 'wb') as f:
        f.write(subprocess.run(
            ['git', 'show', f'{args.baseline_rev}:backend/recipe_api.py'],
            cwd=WORK, capture_output=True, check=True).stdout)
    print(f"baseline: {args.baseline_rev}")
    sys.path.insert(0, BACKEND)
    old = load_module('recipe_api_old', baseline, db_path)
    new = load_module('recipe_api_new', os.path.join(BACKEND, 'recipe_api.py'), db_path)

    cases = [
        ('one common ingredient', dict(ids=[1])),
        ('two ingredients', dict(ids=[2, 3])),
        ('six ingredients', dict(ids=[1, 2, 3, 4, 5, 6])),
        ('proteins only', dict(ids=[2, 7, 8])),
        ('with a time budget', dict(ids=[1, 2, 3], time_budget=45)),
        ('vegan filter', dict(ids=[1, 2, 3, 9], diet='vegan')),
        ('meatless filter', dict(ids=[1, 2, 3, 9], meatless=True)),
        ('low glycemic', dict(ids=[1, 2, 3, 9], low_glycemic=True)),
        ('an id nothing maps to', dict(ids=[9999])),
        ('the double-alias ingredient', dict(ids=[9])),
        ('every ingredient', dict(ids=[k[0] for k in KILER])),
    ]

    print("\n=== inline path (no recipe_kiler_stats table) ===")
    ok = True
    for label, case in cases:
        kwargs = dict(case)
        ids = kwargs.pop('ids')
        ok &= compare(label, run(old, ids, **kwargs), run(new, ids, **kwargs), FIELDS)

    print("\n=== precomputed path (table built) ===")
    subprocess.run([sys.executable, os.path.join(BACKEND, 'refresh_recipe_kiler_stats.py'),
                    '--db', db_path], check=True, capture_output=True)
    new._STATS_STATE['checked_at'] = 0.0
    for label, case in cases:
        kwargs = dict(case)
        ids = kwargs.pop('ids')
        ok &= compare(label, run(old, ids, **kwargs), run(new, ids, **kwargs), FIELDS)

    print("\n=== a stale table must not drop recipes ===")
    stale = sqlite3.connect(db_path)
    stale.execute("DELETE FROM recipe_kiler_stats WHERE recipe_id > 40")
    stale.commit(); stale.close()
    new._STATS_STATE['checked_at'] = 0.0
    ok &= compare('after deleting 20 rows from the table',
                  run(old, [1, 2, 3]), run(new, [1, 2, 3]), FIELDS)
    print(f"  stats considered ready: {new.recipe_kiler_stats_ready(sqlite3.connect(db_path))}"
          "  (False means it fell back, which is correct)")

    print("\n" + ("ALL EQUIVALENT" if ok else "DIFFERENCES FOUND"))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
