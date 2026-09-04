"""Which catalogue additions would unlock the most recipe costs?

Read-only. Writes nothing.

`TODO.md` section 5 lists three groups of ingredients to add to the catalogue
(zerdeçal, cheddar, safran and so on). Those were chosen by hand. This script
ranks the candidates by what they would actually buy: how many recipes go from
"Fiyat hesaplanamadı" to a publishable cost per person.

It deliberately imports the real cost engine rather than reimplementing its
matching rules, so a candidate counted here is a candidate the live code would
also fail to match. `market_prices` is stubbed because prices are irrelevant to
coverage arithmetic — only whether an ingredient is in the catalogue at all.

    python3 backend/rank_catalog_gaps.py
    python3 backend/rank_catalog_gaps.py --top 60 --skeleton 15

The `--skeleton` output is a JSON fragment for assets/data/ingredients.json.
It carries no price: a price is a real-world fact and has to be looked up, not
guessed by this script. Note that ingredients.json is both the bundled app
catalogue and the cost engine's catalogue, so an entry added there improves the
API's coverage across the whole 175k-recipe library.
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import types

# The cost engine only needs get_cached_price from market_prices, and coverage
# arithmetic does not depend on any price. Stubbing it keeps this runnable with
# the system python, which has neither requests nor fastapi.
if "market_prices" not in sys.modules:
    _stub = types.ModuleType("market_prices")
    _stub.get_cached_price = lambda *args, **kwargs: None
    sys.modules["market_prices"] = _stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import recipe_costs as C  # noqa: E402  (after the stub, on purpose)

DB_PATH = "/root/recipes.db"
COVERAGE_MIN = 0.70

# Copied from attach_recipe_costs, which is the behaviour being measured.
WATER = ("su", "ilik su", "sicak su", "soguk su", "kaynar su")
SPICE_OR_VAGUE = re.compile(
    r"\b(tuz|karabiber|pul biber|kirmizi biber|baharat|"
    r"istege gore|arzuya gore|uzeri icin)\b")
PROTEIN_WORD = re.compile(
    r"\b(antrikot|bonfile|biftek|pirzola|kofte|kiyma|dana|kuzu|tavuk|hindi|"
    r"somon|levrek|cipura|hamsi|balik|karides|kalamar)\b")
STOCK_OR_FLAVOUR = re.compile(r"\b(suyu|bulyon|cesni|aroma|tablet)\b")

ROWS = """
    SELECT ri.recipe_id, ri.quantity, ri.unit, ri.original_text, i.name,
           ki.name AS kiler_name
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
    LEFT JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
    LEFT JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
"""


def slugify(name):
    text = C.normalize(name)
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "yeni_malzeme"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--top", type=int, default=40,
                        help="how many candidates to list")
    parser.add_argument("--skeleton", type=int, default=10,
                        help="how many to emit as a JSON fragment")
    parser.add_argument("--batch", type=int, default=12,
                        help="size of the greedy batch to recommend")
    args = parser.parse_args()

    _, by_name = C.load_catalog()
    print(f"catalogue entries: {len(set(id(v) for v in by_name.values())):,} "
          f"({len(by_name):,} names and aliases)")

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row

    titles = {r["id"]: C.normalize(r["title"])
              for r in db.execute("SELECT id, title FROM recipes")}
    excluded = {r[0] for r in db.execute(
        "SELECT recipe_id FROM recipe_exclusions WHERE active = 1")}

    grouped = {}
    for row in db.execute(ROWS):
        grouped.setdefault(row["recipe_id"], []).append(row)

    # per recipe: eligible, priced, the catalogue gaps blocking it
    gaps_by_recipe = {}
    stats = {"recipes": 0, "usable": 0, "blocked": 0}
    candidates = {}

    for recipe_id, rows in grouped.items():
        if recipe_id in excluded or recipe_id not in titles:
            continue
        stats["recipes"] += 1
        title = titles[recipe_id]
        eligible = priced = 0
        gaps = []                 # names that are absent from the catalogue
        # A hard stop from a missing quantity cannot be fixed by cataloguing
        # anything, so the two kinds are counted separately.
        stop_from_gap = False
        stop_from_quantity = False

        for row in rows:
            raw_name = C.normalize(row["kiler_name"] or row["name"])
            if raw_name in WATER:
                continue
            quantity, recipe_unit = C.quantity_and_unit(
                row["quantity"], row["unit"], row["original_text"])
            item = C.find_catalog_item(raw_name, row["original_text"], by_name)
            raw_text = C.normalize(row["original_text"] or row["name"])

            if not item:
                if STOCK_OR_FLAVOUR.search(raw_text):
                    continue          # treated as water by the cost engine
                is_protein = bool(PROTEIN_WORD.search(raw_text))
                if is_protein:
                    eligible += 1
                    stop_from_gap = True
                    gaps.append((raw_name or raw_text, True))
                elif quantity is not None and not SPICE_OR_VAGUE.search(raw_text):
                    eligible += 1
                    gaps.append((raw_name or raw_text, False))
                continue

            if quantity is None:
                # A known ingredient with no usable quantity: a quantity problem,
                # not a catalogue problem. Counted so coverage stays honest.
                if item.get("kind") in ("protein", "sut", "tahil", "sebze", "meyve"):
                    eligible += 1
                    item_title = C.normalize(
                        (item.get("names") or {}).get("tr") or item.get("id"))
                    if item_title and item_title in title:
                        stop_from_quantity = True
                if item.get("kind") == "protein":
                    stop_from_quantity = True
                continue

            eligible += 1
            if C.consumed_units(quantity, recipe_unit, item) is not None:
                priced += 1

        coverage = priced / eligible if eligible else 0
        usable = (priced > 0 and coverage >= COVERAGE_MIN
                  and not stop_from_gap and not stop_from_quantity)
        stats["usable" if usable else "blocked"] += 1
        if usable or not gaps:
            continue

        gaps_by_recipe[recipe_id] = {
            "gaps": gaps, "eligible": eligible, "priced": priced,
            "stop_from_quantity": stop_from_quantity,
        }
        # Would catalguing this one name alone make the recipe publishable?
        for name, is_protein in gaps:
            entry = candidates.setdefault(name, {
                "recipes": 0, "alone": 0, "protein": 0, "with_others": 0,
            })
            entry["recipes"] += 1
            if is_protein:
                entry["protein"] += 1
            others = [g for g in gaps if g[0] != name]
            if others:
                entry["with_others"] += 1
                continue
            # This is the only catalogue gap. Would adding it be enough?
            # A missing quantity elsewhere in the recipe cannot be fixed here.
            if stop_from_quantity:
                continue
            if ((priced + 1) / eligible) >= COVERAGE_MIN:
                entry["alone"] += 1

    print(f"recipes considered:        {stats['recipes']:>8,}")
    print(f"  publishable cost today:  {stats['usable']:>8,}")
    print(f"  blocked:                 {stats['blocked']:>8,}")
    print(f"  blocked by a catalogue gap: {len(gaps_by_recipe):>5,}")

    ranked = sorted(candidates.items(),
                    key=lambda kv: (-kv[1]["alone"], -kv[1]["recipes"], kv[0]))

    # Additions interact: two recipes above needed both zerdeçal and safran, and
    # neither alone lifted them over the threshold. Ranking one at a time cannot
    # see that, so the batch is chosen greedily — at each step, the name that
    # makes the most currently-blocked recipes publishable given what is already
    # chosen. This is the list worth working through in order.
    def publishable_with(record, chosen):
        if record["stop_from_quantity"]:
            return False
        names = {name for name, _ in record["gaps"]}
        if any(is_protein and name not in chosen
               for name, is_protein in record["gaps"]):
            return False
        gained = len(names & chosen)
        eligible = record["eligible"]
        if not eligible:
            return False
        return ((record["priced"] + gained) / eligible) >= COVERAGE_MIN

    # Bounded to the most common names, because the pair search below is
    # quadratic and the tail is all singletons.
    PAIR_POOL = 40
    common = [name for name, _ in sorted(
        candidates.items(), key=lambda kv: -kv[1]["recipes"])[:PAIR_POOL]]

    def gain_of(trial, remaining):
        return sum(1 for record in remaining.values()
                   if publishable_with(record, trial))

    chosen, batch_report = set(), []
    remaining = dict(gaps_by_recipe)
    while len(chosen) < max(0, args.batch):
        best, best_gain = None, 0
        for name in candidates:
            if name in chosen:
                continue
            gain = gain_of(chosen | {name}, remaining)
            if gain > best_gain:
                best, best_gain = (name,), gain

        # Some recipes need two additions before either pays off: a recipe with
        # one of three ingredients priced stays under 70% until both gaps are
        # closed. One-at-a-time greedy scores each as zero and never picks
        # either, which left the largest group unfixed in testing. When nothing
        # single helps, the best complementary pair is taken instead.
        if not best:
            for i, first in enumerate(common):
                if first in chosen:
                    continue
                for second in common[i + 1:]:
                    if second in chosen:
                        continue
                    gain = gain_of(chosen | {first, second}, remaining)
                    if gain > best_gain:
                        best, best_gain = (first, second), gain
        if not best:
            break

        for name in best:
            chosen.add(name)
        fixed = [rid for rid, record in remaining.items()
                 if publishable_with(record, chosen)]
        for rid in fixed:
            remaining.pop(rid)
        batch_report.append((" + ".join(best), len(fixed)))

    print(f"\n{'ingredient':32} {'fixes alone':>11} {'appears in':>10} "
          f"{'protein':>8}")
    print("-" * 66)
    for name, c in ranked[:args.top]:
        print(f"{name[:32]:32} {c['alone']:>11,} {c['recipes']:>10,} "
              f"{c['protein']:>8,}")

    if batch_report:
        print(f"\nthe batch worth doing, in this order "
              f"(greedy, because additions interact):")
        print(f"\n{'#':>3}  {'ingredient':32} {'unlocks':>8} {'running total':>14}")
        print("-" * 62)
        running = 0
        for i, (name, gained) in enumerate(batch_report, 1):
            running += gained
            print(f"{i:>3}  {name[:32]:32} {gained:>8,} {running:>14,}")
        print(f"\n{running:,} of the {len(gaps_by_recipe):,} recipes blocked by a "
              f"catalogue gap would publish a cost after these "
              f"{len(batch_report)} additions.")
        still = len(gaps_by_recipe) - running
        if still:
            print(f"{still:,} would still be blocked: recipes needing more than "
                  "two additions at once, or a missing quantity rather than a "
                  "catalogue entry. Raise --batch to keep going.")

    print("\n--- fragment for assets/data/ingredients.json "
          "(prices must be filled in by hand) ---")
    skeleton = []
    order = [name for name, _ in batch_report] or [name for name, _ in ranked]
    for name in order[:args.skeleton]:
        c = candidates[name]
        skeleton.append({
            "id": slugify(name),
            "names": {"tr": name.title(), "en": ""},
            "kind": "protein" if c["protein"] else "",
            "unit": "kg",
            "price": None,
            "priceMonth": 8,
            "source": "tahmin",
            "cls": "kiler",
            "_appears_in": c["recipes"],
            "_fixes_alone": c["alone"],
        })
    print(json.dumps(skeleton, ensure_ascii=False, indent=1))

    db.close()


if __name__ == "__main__":
    main()
