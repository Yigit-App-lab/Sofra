"""Export a review worksheet for missing imported-recipe quantities.

This tool is read-only. An expert fills the review columns; a separate,
validated import step can be added after the worksheet has been reviewed.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sqlite3

try:
    from .recipe_costs import find_catalog_item, load_catalog, normalize, quantity_and_unit
except ImportError:
    from recipe_costs import find_catalog_item, load_catalog, normalize, quantity_and_unit


MAJOR_KINDS = {"protein", "sut", "tahil", "sebze", "meyve", "bakliyat"}


def audit_recipe_ids(path: Path) -> list[int]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return sorted({
            int(row["recipe_id"])
            for row in csv.DictReader(handle)
            if row.get("issue") == "cost_unavailable" and row.get("recipe_id")
        })


def priority_for(recipe_title: str, item: dict) -> str:
    if item.get("kind") == "protein":
        return "1_required_protein"
    item_name = normalize(item.get("names", {}).get("tr") or item.get("id"))
    if item_name and item_name in normalize(recipe_title):
        return "2_title_ingredient"
    return "3_cost_coverage"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="/root/recipes.db")
    parser.add_argument("--audit", required=True)
    parser.add_argument("--output", default="/tmp/sofra-missing-quantities-review.csv")
    args = parser.parse_args()

    recipe_ids = audit_recipe_ids(Path(args.audit))
    _, by_name = load_catalog()
    db = sqlite3.connect(args.db)
    db.row_factory = sqlite3.Row
    rows = []
    for start in range(0, len(recipe_ids), 500):
        batch = recipe_ids[start:start + 500]
        placeholders = ",".join("?" for _ in batch)
        if not placeholders:
            continue
        source_rows = db.execute(f"""
            SELECT r.id AS recipe_id, r.title, r.servings, r.instructions,
                   ri.rowid AS ingredient_rowid, ri.quantity, ri.unit,
                   ri.original_text, i.name, ki.name AS kiler_name
            FROM recipes r
            JOIN recipe_ingredients ri ON ri.recipe_id = r.id
            JOIN ingredients i ON i.id = ri.ingredient_id
            LEFT JOIN ingredient_aliases ia
              ON ia.alias_normalized = i.name_normalized
            LEFT JOIN kiler_canonical_map kcm
              ON kcm.canonical_id = ia.canonical_id
            LEFT JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
            WHERE r.id IN ({placeholders})
            ORDER BY r.id, ri.rowid
        """, batch).fetchall()
        full_ingredients = {}
        for row in source_rows:
            text = str(row["original_text"] or row["name"] or "").strip()
            if text:
                recipe_ingredients = full_ingredients.setdefault(row["recipe_id"], [])
                if text not in recipe_ingredients:
                    recipe_ingredients.append(text)
        for row in source_rows:
            raw_name = normalize(row["kiler_name"] or row["name"])
            item = find_catalog_item(raw_name, row["original_text"], by_name)
            if not item or item.get("kind") not in MAJOR_KINDS:
                continue
            quantity, _ = quantity_and_unit(
                row["quantity"], row["unit"], row["original_text"]
            )
            if quantity is not None:
                continue
            rows.append({
                "priority": priority_for(row["title"], item),
                "recipe_id": row["recipe_id"],
                "recipe_title": row["title"],
                "recipe_servings": row["servings"],
                "ingredient_rowid": row["ingredient_rowid"],
                "ingredient_name": row["name"],
                "catalog_item": item.get("names", {}).get("tr") or item.get("id"),
                "original_text": row["original_text"],
                "full_ingredients": "\n".join(full_ingredients.get(row["recipe_id"], [])),
                "instructions": row["instructions"],
                "current_quantity": row["quantity"],
                "current_unit": row["unit"],
                "reviewed_quantity": "",
                "reviewed_unit": "",
                "expert_note": "",
                "review_status": "pending",
            })
    db.close()

    rows.sort(key=lambda row: (row["priority"], row["recipe_id"], row["ingredient_rowid"]))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0]) if rows else [
        "priority", "recipe_id", "recipe_title", "recipe_servings",
        "ingredient_rowid", "ingredient_name", "catalog_item", "original_text",
        "full_ingredients", "instructions",
        "current_quantity", "current_unit", "reviewed_quantity", "reviewed_unit",
        "expert_note", "review_status",
    ]
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    counts = {}
    for row in rows:
        counts[row["priority"]] = counts.get(row["priority"], 0) + 1
    print({"output": str(output), "row_count": len(rows), "priorities": counts})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
