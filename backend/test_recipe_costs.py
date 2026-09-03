import unittest

try:
    from .recipe_costs import (
        attach_recipe_costs, consumed_units, effective_servings, find_catalog_item, load_catalog, parse_quantity,
        quantity_and_unit,
    )
except ImportError:
    from recipe_costs import (
        attach_recipe_costs, consumed_units, effective_servings, find_catalog_item, load_catalog, parse_quantity,
        quantity_and_unit,
    )


class RecipeCostTests(unittest.TestCase):
    def test_parses_fraction_and_mixed_quantity(self):
        self.assertEqual(parse_quantity("1/2"), 0.5)
        self.assertEqual(parse_quantity("1 1/2"), 1.5)

    def test_converts_grams_to_catalogue_kilos(self):
        self.assertEqual(
            consumed_units("250", "gram", {"unit": "kg"}),
            0.25,
        )

    def test_converts_household_measure(self):
        self.assertEqual(
            consumed_units(2, "yemek kaşığı", {"unit": "L"}),
            0.03,
        )

    def test_rejects_unknown_unit_instead_of_inventing_cost(self):
        self.assertIsNone(
            consumed_units(2, "paket", {"unit": "kg"})
        )

    def test_converts_known_packaged_food_to_catalogue_units(self):
        self.assertEqual(
            consumed_units(2, "paket", {"id": "milfoy", "unit": "kg"}),
            1.0,
        )
        self.assertEqual(
            consumed_units(1, "paket", {"id": "soya_sosu", "unit": "L"}),
            0.25,
        )

    def test_parses_serving_range_without_crashing(self):
        self.assertEqual(parse_quantity("4-6 kişilik"), 4)

    def test_converts_common_produce_piece_to_kilos(self):
        self.assertEqual(
            consumed_units(2, "adet", {"id": "domates", "unit": "kg"}),
            0.36,
        )

    def test_converts_garlic_cloves(self):
        self.assertEqual(
            consumed_units(5, "diş", {"id": "sarimsak", "unit": "kg"}),
            0.02,
        )

    def test_recovers_broken_decimal_kilo_from_original_text(self):
        quantity, unit = quantity_and_unit("1", None, "1. 5 kilo kuşbaşı")
        self.assertEqual(quantity, 1.5)
        self.assertEqual(unit, "kg")

    def test_original_fraction_overrides_broken_imported_quantity(self):
        self.assertEqual(quantity_and_unit("1", None, "1/3 demet maydanoz")[0], 1 / 3)

    def test_large_piece_yields_become_people_served(self):
        self.assertEqual(effective_servings(30, "İçli Köfte"), 8)
        self.assertEqual(effective_servings(25, "Ödemiş Köftesi"), 7)
        self.assertEqual(effective_servings(13, "Tavuklu Topalak Köfte"), 4)
        self.assertEqual(effective_servings(30, "Kurabiye"), 30)
        self.assertEqual(effective_servings(6, "Köfte"), 6)

    def test_tiny_protein_yield_is_not_treated_as_many_people(self):
        self.assertEqual(effective_servings(5, "Tavuk Çöp Şiş", 0.125), 2)
        self.assertEqual(effective_servings(7, "Tavuk Yemeği", 0.5), 7)

    def test_recovers_whole_chicken_as_a_piece(self):
        quantity, unit = quantity_and_unit("1", None, "1 bütün tavuk")
        self.assertEqual(quantity, 1)
        self.assertEqual(unit, "adet")
        self.assertEqual(
            consumed_units(quantity, unit, {
                "id": "tavuk_but", "unit": "kg", "gramsPerUnit": 1800,
            }),
            1.8,
        )

    def test_recovers_quantity_from_intact_original_text(self):
        self.assertEqual(
            quantity_and_unit(None, None, "2 adet kapya biber"),
            (2, "adet"),
        )
        self.assertEqual(
            quantity_and_unit(None, None, "yarım paket sucuk"),
            (0.5, "paket"),
        )
        quantity, unit = quantity_and_unit(None, None, "yarım kangal sucuk")
        self.assertEqual((quantity, unit), (0.5, "kangal"))
        self.assertEqual(
            consumed_units(quantity, unit, {"id": "sucuk", "unit": "kg"}),
            0.2,
        )

    def test_prices_antrikot_by_weight_or_piece(self):
        _, by_name = load_catalog()
        steak = find_catalog_item("antrikot", "4 parça antrikot", by_name)
        self.assertEqual(steak["id"], "kusbasi")
        self.assertEqual(consumed_units(400, "gr", steak), 0.4)
        self.assertEqual(consumed_units(4, "", steak), 0.8)

    def test_maps_common_imported_aliases(self):
        _, by_name = load_catalog()
        self.assertEqual(find_catalog_item("kapya biber", "", by_name)["id"], "biber_kirmizi")
        self.assertEqual(find_catalog_item("yumurta sarısı", "", by_name)["id"], "yumurta")
        self.assertEqual(find_catalog_item("lavaş", "", by_name)["id"], "yufka")
        self.assertEqual(find_catalog_item("lahana", "", by_name)["id"], "lahana_beyaz")
        self.assertEqual(find_catalog_item("sıvı yağı", "", by_name)["id"], "aycicek_yagi")
        self.assertEqual(find_catalog_item("kaşık un", "", by_name)["id"], "un")

    def test_unknown_measured_ingredients_reduce_cost_confidence(self):
        import sqlite3
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.executescript("""
            CREATE TABLE ingredients (id INTEGER PRIMARY KEY, name TEXT, name_normalized TEXT);
            CREATE TABLE recipe_ingredients (
                recipe_id INTEGER, ingredient_id INTEGER, quantity TEXT,
                unit TEXT, original_text TEXT
            );
            CREATE TABLE ingredient_aliases (alias_normalized TEXT, canonical_id INTEGER);
            CREATE TABLE kiler_canonical_map (canonical_id INTEGER, kiler_id INTEGER);
            CREATE TABLE kiler_ingredients (id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO ingredients VALUES (1, 'patates', 'patates');
            INSERT INTO ingredients VALUES (2, 'bilinmeyen sos', 'bilinmeyen sos');
            INSERT INTO recipe_ingredients VALUES (7, 1, '1', 'kg', '1 kg patates');
            INSERT INTO recipe_ingredients VALUES (7, 2, '500', 'gram', '500 gram bilinmeyen sos');
        """)
        recipe = {"id": 7, "servings": 2}
        attach_recipe_costs(db, [recipe], "Istanbul")
        self.assertEqual(recipe["cost_coverage"], 0.5)
        self.assertIsNone(recipe["cost_per_portion"])
        self.assertEqual(recipe["cost_unavailable_reason"], "coverage_under_70_percent")
        self.assertEqual(recipe["cost_missing_ingredients"], ["bilinmeyen sos"])
        self.assertEqual(recipe["cost_unmapped_ingredients"], ["bilinmeyen sos"])
        self.assertEqual(recipe["cost_missing_quantities"], [])


if __name__ == "__main__":
    unittest.main()
