import unittest

try:
    from .recipe_costs import consumed_units, parse_quantity
except ImportError:
    from recipe_costs import consumed_units, parse_quantity


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


if __name__ == "__main__":
    unittest.main()
