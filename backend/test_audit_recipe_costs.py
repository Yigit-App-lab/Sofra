import unittest

try:
    from .audit_recipe_costs import cost_flags
except ImportError:
    from audit_recipe_costs import cost_flags


class AuditTests(unittest.TestCase):
    def test_flags_implausibly_cheap_protein_recipe(self):
        flags = cost_flags({"cost_per_portion": 3.7, "cost_coverage": 0.8})
        self.assertIn("protein_recipe_under_30_per_person", flags)

    def test_flags_low_coverage(self):
        flags = cost_flags({"cost_per_portion": 100, "cost_coverage": 0.4})
        self.assertIn("coverage_under_70_percent", flags)

    def test_accepts_plausible_well_covered_cost(self):
        self.assertEqual(
            cost_flags({"cost_per_portion": 163.88, "cost_coverage": 0.8}),
            [],
        )


if __name__ == "__main__":
    unittest.main()
