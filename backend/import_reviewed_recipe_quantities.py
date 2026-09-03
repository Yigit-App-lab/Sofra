"""Safely apply expert-reviewed recipe quantities and serving counts from CSV."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
import shutil
import sqlite3
from datetime import datetime, timezone


def value_present(value: str | None) -> bool:
    return bool(str(value or "").strip())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="/root/recipes.db")
    parser.add_argument(
        "--input",
        default=str(Path(__file__).with_name("data") / "accepted-recipe-updates-20260903.csv"),
    )
    parser.add_argument("--apply", action="store_true", help="Commit changes; default is dry-run")
    args = parser.parse_args()

    db_path = Path(args.db).resolve()
    input_path = Path(args.input).resolve()
    if not db_path.is_file():
        raise SystemExit(f"Database not found: {db_path}")
    if not input_path.is_file():
        raise SystemExit(f"Input not found: {input_path}")

    with input_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    ingredient_updates: dict[int, tuple[int, str, str]] = {}
    servings_by_recipe: dict[int, set[float]] = {}
    for row in rows:
        ingredient_rowid = int(row["ingredient_rowid"])
        recipe_id = int(row["recipe_id"])
        quantity = str(row.get("reviewed_quantity") or "").strip()
        unit = str(row.get("reviewed_unit") or "").strip()
        if value_present(quantity) and value_present(unit):
            current = ingredient_updates.get(ingredient_rowid)
            proposed = (recipe_id, quantity, unit)
            if current and current != proposed:
                raise SystemExit(f"Conflicting ingredient update for rowid {ingredient_rowid}")
            ingredient_updates[ingredient_rowid] = proposed
        servings = str(row.get("reviewed_servings") or "").strip()
        if servings:
            servings_by_recipe.setdefault(recipe_id, set()).add(float(servings))

    conflicts = {rid: values for rid, values in servings_by_recipe.items() if len(values) > 1}
    if conflicts:
        raise SystemExit(f"Conflicting serving updates: {conflicts}")

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    try:
        db.execute("BEGIN IMMEDIATE")
        changed_ingredients = 0
        for rowid, (recipe_id, quantity, unit) in ingredient_updates.items():
            existing = db.execute(
                "SELECT recipe_id FROM recipe_ingredients WHERE rowid = ?", (rowid,)
            ).fetchone()
            if not existing or int(existing["recipe_id"]) != recipe_id:
                raise SystemExit(f"Ingredient row mismatch: rowid={rowid}, recipe_id={recipe_id}")
            changed_ingredients += db.execute(
                "UPDATE recipe_ingredients SET quantity = ?, unit = ? WHERE rowid = ?",
                (quantity, unit, rowid),
            ).rowcount

        changed_recipes = 0
        for recipe_id, values in servings_by_recipe.items():
            servings = next(iter(values))
            existing = db.execute("SELECT 1 FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
            if not existing:
                raise SystemExit(f"Recipe not found: {recipe_id}")
            changed_recipes += db.execute(
                "UPDATE recipes SET servings = ? WHERE id = ?", (servings, recipe_id)
            ).rowcount

        if args.apply:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup = db_path.with_name(f"{db_path.name}.before-reviewed-import-{stamp}.bak")
            db.rollback()
            shutil.copy2(db_path, backup)
            db.execute("BEGIN IMMEDIATE")
            for rowid, (_, quantity, unit) in ingredient_updates.items():
                db.execute(
                    "UPDATE recipe_ingredients SET quantity = ?, unit = ? WHERE rowid = ?",
                    (quantity, unit, rowid),
                )
            for recipe_id, values in servings_by_recipe.items():
                db.execute(
                    "UPDATE recipes SET servings = ? WHERE id = ?",
                    (next(iter(values)), recipe_id),
                )
            db.commit()
            print({"applied": True, "backup": str(backup), "ingredients": changed_ingredients,
                   "recipes": changed_recipes})
        else:
            db.rollback()
            print({"applied": False, "dry_run": True, "ingredients": changed_ingredients,
                   "recipes": changed_recipes})
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
