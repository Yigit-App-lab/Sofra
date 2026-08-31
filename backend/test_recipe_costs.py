import unittest

try:
    from .recipe_costs import consumed_units, parse_quantity, quantity_and_unit
except ImportError:
    from recipe_costs import consumed_units, parse_quantity, quantity_and_unit


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


if __name__ == "__main__":
    unittest.main()
