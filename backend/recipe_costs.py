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
    aliases = {
        "toz seker": "seker",
        "sivi yag": "aycicek_yagi",
        "yesil biber": "biber_sivri",
        "salca": "salca_domates",
        "hakiki zeytinyagi": "zeytinyagi",
        "kucuk cay bardagi zeytinyagi": "zeytinyagi",
        "kusbasi": "kusbasi",
        "dana eti": "kusbasi",
        "dana kusbasi": "kusbasi",
        "tavuk": "tavuk_gogus",
        "tavuk eti": "tavuk_gogus",
        "balik": "balik",
        "balik fileto": "balik",
    }
    for alias, item_id in aliases.items():
        if item_id in by_id:
            by_name[alias] = by_id[item_id]
    if "kusbasi" in by_id:
        steak = dict(by_id["kusbasi"])
        # Imported steak recipes often say only "4 parça antrikot". A typical
        # raw serving piece is about 200 g; weight-based rows still use kg.
        steak["gramsPerUnit"] = 200
        for alias in ("antrikot", "dana antrikot", "füme antrikot"):
            by_name[normalize(alias)] = steak
    if "tavuk_but" in by_id:
        whole_chicken = dict(by_id["tavuk_but"])
        whole_chicken["gramsPerUnit"] = 1800
        by_name["butun tavuk"] = whole_chicken
    return by_id, by_name


def parse_quantity(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value) if value >= 0 else None
    text = normalize(value)
    word_quantities = {"yarim": 0.5, "ceyrek": 0.25, "bir": 1.0}
    if text in word_quantities:
        return word_quantities[text]
    text = text.replace(",", ".")
    mixed = re.match(r"^(\d+)\s+(\d+)\s*/\s*(\d+)$", text)
    if mixed and int(mixed.group(3)):
        return int(mixed.group(1)) + int(mixed.group(2)) / int(mixed.group(3))
    fraction = re.match(r"^(\d+)\s*/\s*(\d+)$", text)
    if fraction and int(fraction.group(2)):
        return int(fraction.group(1)) / int(fraction.group(2))
    match = re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def quantity_and_unit(quantity, recipe_unit, original_text) -> tuple[float | None, str]:
    """Recover quantity/unit when the source parser damaged `1. 5 kilo`."""
    text = normalize(original_text)
    broken_decimal = re.search(r"\b(\d+)[.,]\s+(\d+)\b", text)
    q = (float(f"{broken_decimal.group(1)}.{broken_decimal.group(2)}")
         if broken_decimal else parse_quantity(quantity))
    unit = normalize(recipe_unit)
    if not unit:
        unit_patterns = (
            (r"\b(kilo|kilogram|kg)\b", "kg"),
            (r"\b(g|gr|gram)\b", "gram"),
            (r"\b(adet|tane)\b", "adet"),
            (r"\bdis\b", "diş"),
            (r"\byemek kasigi\b", "yemek kaşığı"),
            (r"\btatli kasigi\b", "tatlı kaşığı"),
            (r"\bcay kasigi\b", "çay kaşığı"),
            (r"\bsu bardagi\b", "su bardağı"),
            (r"\bcay bardagi\b", "çay bardağı"),
            (r"\b(ml|mililitre)\b", "ml"),
            (r"\b(litre|liter|lt)\b", "litre"),
            (r"\bpaket\b", "paket"),
            (r"\bdilim\b", "dilim"),
            (r"\bbutun tavuk\b", "adet"),
        )
        for pattern, inferred in unit_patterns:
            if re.search(pattern, text):
                unit = inferred
                break
    return q, unit


def find_catalog_item(name, original_text, by_name):
    normalized_name = normalize(name)
    item = by_name.get(normalized_name)
    if item:
        return item
    haystack = normalize(original_text or name)
    for candidate in sorted(by_name, key=len, reverse=True):
        if len(candidate) >= 4 and re.search(rf"\b{re.escape(candidate)}\b", haystack):
            item = by_name[candidate]
            # "tavuk bulyon", "et suyu" and similar flavourings must not be
            # priced as hundreds of grams/pieces of the named meat.
            if item.get("kind") == "protein" and re.search(
                r"\b(bulyon|cesni|aroma|tablet|et suyu|tavuk suyu)\b", haystack
            ):
                continue
            return item
    return None


def consumed_units(quantity, recipe_unit, item) -> float | None:
    q = parse_quantity(quantity)
    if q is None:
        return None
    unit = normalize(recipe_unit)
    priced_unit = item.get("unit")
    if priced_unit in ("adet", "demet"):
        accepted = ("adet", "tane") if priced_unit == "adet" else ("demet",)
        if unit in accepted or not unit:
            return q
        default_grams = {
            "brokoli": 500, "domates": 180, "patlican": 250,
            "kabak": 250, "havuc": 100, "patates": 180,
            "sogan": 120, "limon": 120,
        }.get(item.get("id"))
        if default_grams and unit in ("g", "gr", "gram"):
            return q / default_grams
        if default_grams and unit in ("kg", "kilogram"):
            return q * 1000 / default_grams
        return None
    # Imported household recipes occasionally label gram amounts as kilograms
    # (for example, "300 kg kıyma"). No normal recipe needs 20+ kg of one item.
    if unit in ("kg", "kilogram"): return q / 1000 if q >= 20 else q
    if unit in ("g", "gr", "gram"): return q / 1000
    if unit in ("l", "lt", "litre", "liter"): return q
    if unit in ("ml", "mililitre"): return q / 1000
    if unit in ("yemek kasigi", "yk"): return q * 0.015
    if unit in ("tatli kasigi", "tk"): return q * 0.007
    if unit in ("cay kasigi", "ck"): return q * 0.005
    if unit in ("su bardagi", "bardak", "sb"): return q * 0.2
    if unit in ("cay bardagi", "cb"): return q * 0.1
    if unit in ("adet", "tane"):
        default_grams = {
            "domates": 180, "patlican": 250, "kabak": 250,
            "havuc": 100, "patates": 180, "sogan": 120,
            "taze_fasulye": 12, "biber_sivri": 40,
            "biber_dolmalik": 120, "limon": 120,
            "tavuk_gogus": 250, "tavuk_but": 250,
            "somon": 200, "levrek": 300, "cipura": 300,
            "hamsi": 25, "karides": 15, "balik": 250,
        }.get(item.get("id"))
        grams = item.get("gramsPerUnit") or default_grams
        return q * float(grams) / 1000 if grams else None
    if unit in ("paket", "paketi"):
        package_grams = {
            "tavuk_gogus": 500, "tavuk_but": 500, "sucuk": 200,
            "ton_baligi": 160,
        }.get(item.get("id"))
        return q * package_grams / 1000 if package_grams else None
    if unit == "dilim":
        slice_grams = {
            "sucuk": 10, "pastirma": 15, "somon": 200, "levrek": 200,
            "cipura": 200, "balik": 200,
        }.get(item.get("id"))
        return q * slice_grams / 1000 if slice_grams else None
    if not unit:
        piece_grams = item.get("gramsPerUnit") or {
            "tavuk_gogus": 250, "tavuk_but": 250
        }.get(item.get("id"))
        return q * piece_grams / 1000 if piece_grams and q <= 20 else None
    if unit in ("dis", "dis sarimsak") and item.get("id") == "sarimsak":
        return q * 0.004
    return None


def attach_recipe_costs(db, recipes: list[dict], city: str) -> None:
    if not recipes:
        return
    _, by_name = load_catalog()
    ids = [recipe["id"] for recipe in recipes]
    placeholders = ",".join("?" for _ in ids)
    rows = db.execute(f"""
        SELECT ri.recipe_id, ri.quantity, ri.unit, ri.original_text, i.name,
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
        eligible = 0
        observed_dates = []
        missing_required_protein = False
        ingredients = grouped.get(recipe["id"], [])
        for row in ingredients:
            raw_name = normalize(row["kiler_name"] or row["name"])
            if raw_name in ("su", "ilik su", "sicak su", "soguk su", "kaynar su"):
                continue
            quantity, recipe_unit = quantity_and_unit(
                row["quantity"], row["unit"], row["original_text"]
            )
            item = find_catalog_item(raw_name, row["original_text"], by_name)
            if not item:
                raw_text = normalize(row["original_text"] or row["name"])
                is_unmapped_protein = re.search(
                    r"\b(antrikot|bonfile|biftek|pirzola|kofte|kiyma|"
                    r"dana|kuzu|tavuk|hindi|somon|levrek|cipura|hamsi|"
                    r"balik|karides|kalamar)\b",
                    raw_text,
                )
                is_stock_or_flavouring = re.search(
                    r"\b(suyu|bulyon|cesni|aroma|tablet)\b", raw_text
                )
                if is_unmapped_protein and not is_stock_or_flavouring:
                    eligible += 1
                    missing_required_protein = True
                continue
            # Missing main ingredients reduce confidence. Missing protein is a
            # hard stop: publishing the sauce cost as a chicken/beef meal cost
            # is materially misleading.
            if quantity is None:
                if item.get("kind") in ("protein", "sut", "tahil", "sebze", "meyve"):
                    eligible += 1
                if item.get("kind") == "protein":
                    missing_required_protein = True
                continue
            eligible += 1
            units = consumed_units(quantity, recipe_unit, item)
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
        servings = parse_quantity(recipe.get("servings")) or 2
        servings = max(1, servings)
        # A few imported rows contain zero or placeholder quantities. Publishing
        # 0.0 TL is worse than admitting that the price could not be calculated.
        usable_cost = priced > 0 and total >= 0.05 and not missing_required_protein
        recipe["cost_total"] = round(total, 2) if usable_cost else None
        recipe["cost_per_portion"] = round(total / servings, 2) if usable_cost else None
        recipe["cost_coverage"] = round(priced / eligible, 2) if eligible else 0
        recipe["cost_live_count"] = live_count
        recipe["cost_observed_at"] = max(observed_dates) if observed_dates else None


def safely_attach_recipe_costs(db, recipes: list[dict], city: str) -> None:
    """Cost enrichment is optional and may never take recommendations down."""
    try:
        attach_recipe_costs(db, recipes, city)
    except Exception as exc:
        print(f"Recipe cost enrichment failed: {exc}")
        for recipe in recipes:
            recipe.update({
                "cost_total": None,
                "cost_per_portion": None,
                "cost_coverage": 0,
                "cost_live_count": 0,
                "cost_observed_at": None,
            })
