import unittest

try:
    from .market_prices import aggregate_search_response, normalized_unit_price
except ImportError:
    from market_prices import aggregate_search_response, normalized_unit_price


class MarketPriceTests(unittest.TestCase):
    def test_parses_turkish_decimal_unit_price(self):
        self.assertEqual(
            normalized_unit_price({"unitPrice": "19,90 ₺/kg"}, "kg"),
            19.9,
        )

    def test_rejects_incompatible_package_unit(self):
        self.assertIsNone(
            normalized_unit_price({"unitPrice": "12,00 ₺/adet"}, "kg")
        )

    def test_aggregates_one_median_per_market(self):
        response = {"content": [{
            "title": "Patates 1 kg",
            "brand": "Markasız",
            "productDepotInfoList": [
                {"marketAdi": "a101", "unitPrice": "20,00 ₺/kg"},
                {"marketAdi": "a101", "unitPrice": "22,00 ₺/kg"},
                {"marketAdi": "bim", "unitPrice": "25,00 ₺/kg"},
            ],
        }]}
        result = aggregate_search_response(response, "patates", "kg")
        self.assertEqual(result["market_count"], 2)
        self.assertEqual(result["average"], 23.0)
        self.assertEqual(result["lowest"], 21.0)
        self.assertEqual(result["highest"], 25.0)

    def test_rejects_branded_processed_food(self):
        response = {"content": [{
            "title": "Patates Cipsi 150 Gr",
            "brand": "Patito",
            "productDepotInfoList": [
                {"marketAdi": "a101", "unitPrice": "300,00 ₺/kg"},
            ],
        }]}
        self.assertIsNone(aggregate_search_response(response, "patates", "kg"))


if __name__ == "__main__":
    unittest.main()
