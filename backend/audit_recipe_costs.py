"""Read-only audit for suspicious imported-recipe costs.

Designed for the VPS database. It never updates recipe data.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

try:
    from .recipe_costs import safely_attach_recipe_costs
except ImportError:
    from recipe_costs import safely_attach_recipe_costs


BROKEN_DECIMAL = re.compile(r"\b\d+[.,]\s+\d+\b")
IMPLAUSIBLE_KG = re.compile(r"\b(?:[2-9]\d|\d{3,})\s*(?:kg|kilo(?:gram)?)\b", re.IGNORECASE)
UNIT_IN_TEXT = re.compile(
    r"\b(kg|kilo|kilogram|gr|gram|adet|tane|litre|lt|ml|"
    r"yemek kaşığı|tatlı kaşığı|çay kaşığı|su bardağı|çay bardağı)\b",
    re.IGNORECASE,
)


def normalize(value) -> str:
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(
        char for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    )


def meal_role(recipe: dict) -> str:
    """Conservative audit-only main-course classification."""
    text = normalize(f"{recipe.get('category', '')} {recipe.get('title', '')}")
    light = (
        "atistirmalik", "aperatif", "kahvalti", "sandvic", "simit", "tost",
        "pizza", "borek", "pogaca", "corek", "milfoy", "ekmek", "pide",
        "corba", "salata", "meze", "sos", "tart", "kurabiye", "tatli",
        "lahmacun", "manti", "makarna", "pilav", "krep", "kis", "burger",
        "dondurucu", "buzluk", "tavuk suyu",
    )
    if any(token in text for token in light):
        return "light_or_snack"
    main = (
        "ana yemek", "aksam yemegi", "et yemegi", "etli yemek", "kavurma",
        "kofte", "kebap", "sote", "sis", "guvec", "tencere", "firinda",
        "tavuk", "kiyma", "kusbasi", "dana", "kuzu", "balik", "somon",
        "hamsi", "levrek", "cipura", "karides",
    )
    if any(token in text for token in main):
        return "main_course"
    return "mixed_or_unknown"


def cost_flags(recipe: dict) -> list[str]:
    flags = []
    cost = recipe.get("cost_per_portion")
    coverage = float(recipe.get("cost_coverage") or 0)
    role = meal_role(recipe)
    if cost is None:
        flags.append("cost_unavailable")
    elif cost <= 0:
        flags.append("zero_cost")
    elif cost < 30 and coverage >= 0.70 and role == "main_course":
        flags.append("main_course_protein_under_30_per_person")
    elif cost < 30 and coverage >= 0.70 and role == "light_or_snack":
        flags.append("light_or_snack_protein_under_30_per_person")
    elif cost < 30 and coverage >= 0.70:
        flags.append("mixed_protein_recipe_under_30_per_person")
    elif cost < 30:
        flags.append("low_confidence_meat_recipe_under_30_per_person")
    elif cost > 1000:
        flags.append("over_1000_per_person")
    if coverage < 0.70:
        flags.append("coverage_under_70_percent")
    return flags


def audit(db, city: str, recipe_limit: int) -> list[dict]:
    findings = []

    # Source parsing problems across the corpus.
    for row in db.execute("""
        SELECT r.id, r.title, ri.original_text, ri.quantity, ri.unit
        FROM recipe_ingredients ri
        JOIN recipes r ON r.id = ri.recipe_id
    """):
        text = str(row["original_text"] or "")
        flags = []
        if BROKEN_DECIMAL.search(text):
            flags.append("broken_decimal")
        if IMPLAUSIBLE_KG.search(text):
            flags.append("implausible_kilograms")
        if row["unit"] is None and row["quantity"] is not None and UNIT_IN_TEXT.search(text):
            flags.append("unit_missing_but_present_in_text")
        for flag in flags:
            findings.append({
                "recipe_id": row["id"], "title": row["title"],
                "cost_per_portion": "", "cost_total": "", "coverage": "",
                "meal_role": "", "issue": flag, "ingredient_text": text,
                "cost_unavailable_reason": "", "missing_ingredients": "",
            })

    # High-risk first trial: recipes mapped to protein ingredients.
    recipes = [dict(row) for row in db.execute("""
        SELECT DISTINCT r.id, r.title, r.category, r.servings
        FROM recipes r
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients i ON i.id = ri.ingredient_id
        LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
        LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
        LEFT JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
        WHERE ki.ingredient_class = 'protein'
          AND ki.name NOT IN ('yumurta', 'yumurta sarısı', 'yumurta beyazı')
        ORDER BY r.id
        LIMIT ?
    """, (recipe_limit,)).fetchall()]

    for start in range(0, len(recipes), 200):
        batch = recipes[start:start + 200]
        safely_attach_recipe_costs(db, batch, city)
        for recipe in batch:
            for flag in cost_flags(recipe):
                findings.append({
                    "recipe_id": recipe["id"], "title": recipe["title"],
                    "cost_per_portion": recipe.get("cost_per_portion"),
                    "cost_total": recipe.get("cost_total"),
                    "coverage": recipe.get("cost_coverage"),
                    "meal_role": meal_role(recipe),
                    "issue": flag, "ingredient_text": "",
                    "cost_unavailable_reason": recipe.get("cost_unavailable_reason") or "",
                    "missing_ingredients": " | ".join(
                        recipe.get("cost_missing_ingredients") or []
                    ),
                })
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="/root/recipes.db")
    parser.add_argument("--city", default="Istanbul")
    parser.add_argument("--recipe-limit", type=int, default=2000)
    parser.add_argument("--output", default="/tmp/sofra-recipe-cost-audit.csv")
    args = parser.parse_args()

    db = sqlite3.connect(args.db)
    db.row_factory = sqlite3.Row
    try:
        findings = audit(db, args.city, max(1, args.recipe_limit))
    finally:
        db.close()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ["recipe_id", "title", "cost_per_portion", "cost_total",
              "coverage", "meal_role", "issue", "ingredient_text",
              "cost_unavailable_reason", "missing_ingredients"]
    with output.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(findings)

    counts = {}
    for item in findings:
        counts[item["issue"]] = counts.get(item["issue"], 0) + 1
    unavailable = [item for item in findings if item["issue"] == "cost_unavailable"]
    unavailable_reasons = Counter(
        item["cost_unavailable_reason"] or "unknown" for item in unavailable
    )
    missing_ingredients = Counter()
    for item in unavailable:
        for name in filter(None, item["missing_ingredients"].split(" | ")):
            missing_ingredients[name] += 1
    print(json.dumps({
        "output": str(output), "finding_count": len(findings),
        "counts": counts,
        "unavailable_reasons": dict(unavailable_reasons.most_common()),
        "top_missing_ingredients": dict(missing_ingredients.most_common(25)),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
