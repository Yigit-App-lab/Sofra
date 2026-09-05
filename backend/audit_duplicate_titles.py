"""Recipes that share a title: which are import artifacts, which are variants.

Read-only. Writes nothing.

Reported from the Kiler list: four separate recipes all titled exactly "Taze
Fasulye", differing only in category and cooking time. The app now collapses
them at display time, but that is a patch over a data problem — and it collapses
genuine variants along with true duplicates.

This tells the two apart before anything is changed on the live database:

  ARTIFACT   near-identical ingredient lists: the same import arriving twice.
             Keep the copy with the fullest hazırlanış, quarantine the rest.
  AMBIGUOUS  one title covering several genuinely different dishes — zeytinyağlı
             and etli taze fasulye are two dinners. Quarantine would throw away a
             real option; the title should say which is which.

A single title can be both at once: three copies of the plain dish plus one real
variant. Members are therefore clustered by ingredient overlap before being
judged, so the duplicates inside a mixed group do not escape.

Choosing which copy to keep is a second, separate stage. Ingredients have
already decided that two rows are the same dish, so the write-up decides which
survives: the longer and more structured hazırlanış wins, and quantities and
metadata only break ties. A copy with two extra ingredient rows but a one-line
method loses to one with ten numbered steps.

Quarantine rather than delete: `recipe_exclusions` is the existing mechanism,
it is reversible with a flag, and a deleted row would strand any user who has
liked or cooked that recipe (their profile stores 'api:<id>').

    python3 backend/audit_duplicate_titles.py
    python3 backend/audit_duplicate_titles.py --samples 15 --similarity 0.8
"""
import argparse
import re
import sqlite3
import sys
import unicodedata

from _load_api import api

DB_PATH = "/root/recipes.db"
# Where the hazırlanış might live. The schema is discovered, not assumed:
# either a text column on `recipes`, or a separate per-step table.
BODY_COLUMNS = ("instructions", "directions", "steps", "description",
                "yapilisi", "tarif", "hazirlanis")
STEP_TABLES = ("recipe_steps", "recipe_instructions", "recipe_directions")


def fold(value):
    text = str(value or "").casefold().replace("ı", "i")
    text = "".join(c for c in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


# Mirrors TITLE_NOISE in src/engine.js. The API's clean_recipe_title only
# removes "videolu", so "Taze Fasulye" and "Taze Fasulye Tarifi" are two titles
# to it and one dish to a reader — and one dish to the app, which groups with
# the JS list. Grouping here uses the reader's view. (Aligning
# clean_recipe_title with this list would also improve displayed titles; that is
# a separate, user-visible change.)
TITLE_NOISE = {
    "videolu", "videosu", "resimli", "tarif", "tarifi", "tarifleri",
    "nasil", "yapilir", "kolay", "pratik", "nefis", "enfes", "efsane",
    "ev", "evde", "usulu", "orjinal", "gercek", "en", "ve", "ile",
    "yemek", "yemegi", "yemekleri",
}


def title_key(title):
    """The title as a reader sees it, with source noise removed."""
    words = [w for w in fold(api.clean_recipe_title(title)).split()
             if w and w not in TITLE_NOISE]
    return " ".join(sorted(words))


def jaccard(a, b):
    if not a or not b:
        return 0.0
    shared = len(a & b)
    return shared / (len(a) + len(b) - shared)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--samples", type=int, default=10)
    parser.add_argument("--similarity", type=float, default=0.8,
                        help="ingredient overlap above which two recipes with "
                             "the same title and category are one import")
    args = parser.parse_args()

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row

    columns = {row["name"] for row in db.execute("PRAGMA table_info(recipes)")}
    tables = {row["name"] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    body = next((c for c in BODY_COLUMNS if c in columns), None)
    step_table = next((t for t in STEP_TABLES if t in tables), None)

    # Length and step count are computed in SQL. Pulling the prose for 175k
    # recipes into python would move a hundred megabytes to count newlines.
    if body:
        source = f"the recipes.{body} column"
        select_body = f"""
            , COALESCE(LENGTH(r.{body}), 0) AS body_chars
            , CASE WHEN r.{body} IS NULL THEN 0 ELSE
                LENGTH(r.{body}) - LENGTH(REPLACE(r.{body}, char(10), ''))
                + LENGTH(r.{body}) - LENGTH(REPLACE(r.{body}, '.', ''))
              END AS body_marks"""
    elif step_table:
        step_columns = {row["name"] for row in
                        db.execute(f"PRAGMA table_info({step_table})")}
        text_column = next((c for c in ("text", "step", "instruction", "body",
                                        "content", "description")
                            if c in step_columns), None)
        if not text_column:
            raise SystemExit(
                f"{step_table} has no recognisable text column "
                f"(found: {sorted(step_columns)})")
        source = f"the {step_table} table, column {text_column!r}"
        select_body = f"""
            , COALESCE((SELECT SUM(LENGTH(s.{text_column}))
                        FROM {step_table} s WHERE s.recipe_id = r.id), 0)
              AS body_chars
            , COALESCE((SELECT COUNT(*) FROM {step_table} s
                        WHERE s.recipe_id = r.id), 0) * 2 AS body_marks"""
    else:
        source = "nothing — no hazırlanış found, falling back to ingredients"
        select_body = ", 0 AS body_chars, 0 AS body_marks"

    print(f"hazırlanış read from: {source}")

    rows = db.execute(f"""
        SELECT r.id, r.title, r.category, r.total_minutes, r.servings{select_body}
        FROM recipes r
        WHERE NOT EXISTS (
            SELECT 1 FROM recipe_exclusions rex
            WHERE rex.recipe_id = r.id AND rex.active = 1
        )
    """).fetchall()

    ingredients = {}
    quantified = {}
    for row in db.execute("""
        SELECT recipe_id, ingredient_id, quantity FROM recipe_ingredients
    """):
        ingredients.setdefault(row["recipe_id"], set()).add(row["ingredient_id"])
        if row["quantity"] is not None:
            quantified[row["recipe_id"]] = quantified.get(row["recipe_id"], 0) + 1

    groups = {}
    for row in rows:
        key = title_key(row["title"])
        if key:
            groups.setdefault(key, []).append(row)
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    def detail(row):
        """How full the hazırlanış is: prose plus the structure in it.

        A step boundary is worth roughly forty characters of prose, because ten
        numbered steps are more use to a cook than one long paragraph of the
        same length.
        """
        return row["body_chars"] + row["body_marks"] * 40

    def keeper_rank(row):
        """Which copy of one dish to keep.

        Two stages, in this order. Ingredient overlap has already decided that
        these are the same dish, so the write-up decides which copy survives —
        the longer and more detailed hazırlanış wins. Everything after it only
        breaks ties: a recipe with no instructions at all is chosen on its
        quantities and metadata, and the lowest id keeps the result stable
        between runs.
        """
        rid = row["id"]
        return (
            detail(row),
            quantified.get(rid, 0),
            len(ingredients.get(rid, ())),
            (1 if row["total_minutes"] else 0) + (1 if row["servings"] else 0),
            -rid,
        )

    # A title group can hold both kinds at once: three imports of the plain dish
    # plus one genuine zeytinyağlı version. Classifying the group as a whole
    # would let the three duplicates escape, so members are clustered by
    # ingredient overlap first. Each cluster is one dish; several clusters under
    # one title means the title is ambiguous.
    def cluster(members):
        clusters = []
        for member in sorted(members, key=keeper_rank, reverse=True):
            mine = ingredients.get(member["id"], set())
            for group in clusters:
                lead = ingredients.get(group[0]["id"], set())
                if jaccard(mine, lead) >= args.similarity:
                    group.append(member)
                    break
            else:
                clusters.append([member])
        return clusters

    artifact_clusters, ambiguous_titles = [], []
    for key, members in duplicates.items():
        clusters = cluster(members)
        for group in clusters:
            if len(group) > 1:
                artifact_clusters.append({
                    "key": key, "keep": group[0], "rest": group[1:],
                    "overlap": min(
                        jaccard(ingredients.get(group[0]["id"], set()),
                                ingredients.get(m["id"], set())) for m in group[1:]),
                })
        if len(clusters) > 1:
            ambiguous_titles.append({
                "key": key,
                "clusters": clusters,
                "keep": clusters[0][0],
                "rest": [group[0] for group in clusters[1:]],
                "overlap": 0.0,
            })

    total_recipes = len(rows)
    dup_recipes = sum(len(v) for v in duplicates.values())
    would_quarantine = sum(len(g["rest"]) for g in artifact_clusters)
    variant_extra = sum(len(g["clusters"]) for g in ambiguous_titles)

    print(f"\nrecipes (not already quarantined): {total_recipes:>9,}")
    print(f"titles shared by more than one:    {len(duplicates):>9,}")
    print(f"recipes carrying a shared title:   {dup_recipes:>9,} "
          f"({100.0 * dup_recipes / max(1, total_recipes):.1f}%)")
    print(f"\n  ARTIFACT clusters (ingredients >= {args.similarity:.0%} alike): "
          f"{len(artifact_clusters):>6,}")
    print(f"    would quarantine:            {would_quarantine:>9,} recipes")
    print(f"  ambiguous titles (two or more real dishes share a name): "
          f"{len(ambiguous_titles):>6,}")
    print(f"    dishes hidden behind them:   {variant_extra:>9,}")

    def show(label, group_list):
        if not group_list:
            return
        print(f"\n--- {label} ---")
        for record in sorted(group_list,
                             key=lambda g: -len(g["rest"]))[:args.samples]:
            keep = record["keep"]
            print(f'\n  "{api.clean_recipe_title(keep["title"])}"  '
                  f'({len(record["rest"]) + 1} copies, '
                  f'min overlap {record["overlap"]:.0%})')
            for label, member in ([("keep", keep)]
                                  + [("drop", m) for m in record["rest"][:4]]):
                print(f'    {label}  #{member["id"]:<8} '
                      f'{str(member["category"])[:20]:22} '
                      f'{len(ingredients.get(member["id"], ())):>2} malzeme  '
                      f'hazırlanış {member["body_chars"]:>6,} karakter, '
                      f'{member["body_marks"]:>3} adım/cümle')

    show("ARTIFACT: safe to quarantine, keeping the most detailed copy",
         artifact_clusters)

    if ambiguous_titles:
        print("\n--- AMBIGUOUS: one name, several real dishes — do not quarantine ---")
        for record in sorted(ambiguous_titles,
                             key=lambda g: -len(g["clusters"]))[:args.samples]:
            lead = record["clusters"][0][0]
            print(f'\n  "{api.clean_recipe_title(lead["title"])}"  '
                  f'({len(record["clusters"])} distinct dishes)')
            for group in record["clusters"][:4]:
                member = group[0]
                copies = f' (+{len(group) - 1} copies)' if len(group) > 1 else ''
                print(f'    #{member["id"]:<8} {str(member["category"])[:22]:24} '
                      f'{member["total_minutes"] or "?"} dk  '
                      f'{len(ingredients.get(member["id"], ()))} malzeme{copies}')

    print("\nNothing was changed. Read the ARTIFACT samples before acting: the "
          "similarity threshold decides how much variation counts as one dish, "
          f"and {args.similarity:.0%} is a starting point, not a fact. Re-run "
          "with --similarity 0.7 to see how the split moves.")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
