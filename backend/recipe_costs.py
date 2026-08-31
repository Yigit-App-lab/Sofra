"""Approximate imported-recipe costs using Sofra catalogue and live cache."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import unicodedata

try:
    from .market_prices import get_cached_price
except ImportError:
    from market_prices import get_cached_price


def normalize(value) -> str:
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(c for c in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(c)).strip()


def _catalog_path() -> Path:
    configured = os.getenv("SOFRA_INGREDIENTS_JSON")
    candidates = [
        Path(configured) if configured else None,
        Path(__file__).resolve().parents[1] / "assets/data/ingredients.json",
        Path("/root/sofra-tr/tr/app/sofra-app/assets/data/ingredients.json"),
    ]
    for path in candidates:
        if path and path.exists():
            return path
    raise FileNotFoundError("Sofra ingredients catalogue not found")


def load_catalog() -> tuple[dict, dict]:
    items = json.loads(_catalog_path().read_text(encoding="utf-8"))["items"]
    by_id = {item["id"]: item for item in items}
    by_name = {}
    for item in items:
        by_name[normalize(item["names"]["tr"])] = item
        by_name[normalize(item["id"].replace("_", " "))] = item
    return by_id, by_name


def parse_quantity(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value) if value >= 0 else None
    text = str(value or "").strip().replace(",", ".")
    mixed = re.match(r"^(\d+)\s+(\d+)\s*/\s*(\d+)$", text)
    if mixed and int(mixed.group(3)):
        return int(mixed.group(1)) + int(mixed.group(2)) / int(mixed.group(3))
    fraction = re.match(r"^(\d+)\s*/\s*(\d+)$", text)
    if fraction and int(fraction.group(2)):
        return int(fraction.group(1)) / int(fraction.group(2))
    match = re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def consumed_units(quantity, recipe_unit, item) -> float | None:
    q = parse_quantity(quantity)
    if q is None:
        return None
    unit = normalize(recipe_unit)
    priced_unit = item.get("unit")
    if priced_unit in ("adet", "demet"):
        accepted = ("adet", "tane") if priced_unit == "adet" else ("demet",)
        return q if unit in accepted or not unit else None
    if unit in ("kg", "kilogram"): return q
    if unit in ("g", "gr", "gram"): return q / 1000
    if unit in ("l", "lt", "litre", "liter"): return q
    if unit in ("ml", "mililitre"): return q / 1000
    if unit in ("yemek kasigi", "yk"): return q * 0.015
    if unit in ("tatli kasigi", "tk"): return q * 0.007
    if unit in ("cay kasigi", "ck"): return q * 0.005
    if unit in ("su bardagi", "bardak", "sb"): return q * 0.2
    if unit in ("cay bardagi", "cb"): return q * 0.1
    if unit in ("adet", "tane") and item.get("gramsPerUnit"):
        return q * float(item["gramsPerUnit"]) / 1000
    return None


def attach_recipe_costs(db, recipes: list[dict], city: str) -> None:
    if not recipes:
        return
    _, by_name = load_catalog()
    ids = [recipe["id"] for recipe in recipes]
    placeholders = ",".join("?" for _ in ids)
    rows = db.execute(f"""
        SELECT ri.recipe_id, ri.quantity, ri.unit, i.name,
               ki.name AS kiler_name
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
        LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
        LEFT JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
        WHERE ri.recipe_id IN ({placeholders})
    """, ids).fetchall()
    grouped = {recipe_id: [] for recipe_id in ids}
    for row in rows:
        grouped[row["recipe_id"]].append(row)

    for recipe in recipes:
        total = 0.0
        priced = 0
        live_count = 0
        observed_dates = []
        ingredients = grouped.get(recipe["id"], [])
        for row in ingredients:
            item = by_name.get(normalize(row["kiler_name"] or row["name"]))
            if not item:
                continue
            units = consumed_units(row["quantity"], row["unit"], item)
            if units is None:
                continue
            observation = get_cached_price(item["id"], item["unit"], city)
            unit_price = observation["average"] if observation else item["price"]
            total += units * float(unit_price)
            priced += 1
            if observation:
                live_count += 1
                if observation.get("observed_at"):
                    observed_dates.append(observation["observed_at"])
        servings = max(1, int(recipe.get("servings") or 4))
        recipe["cost_total"] = round(total, 2) if priced else None
        recipe["cost_per_portion"] = round(total / servings, 2) if priced else None
        recipe["cost_coverage"] = round(priced / len(ingredients), 2) if ingredients else 0
        recipe["cost_live_count"] = live_count
        recipe["cost_observed_at"] = max(observed_dates) if observed_dates else None
