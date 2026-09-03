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

    def test_accepts_branded_exact_protein(self):
        response = {"content": [{
            "title": "Dana Kıyma 500 Gr",
            "brand": "Market Kasap",
            "productDepotInfoList": [
                {"marketAdi": "market", "unitPrice": "699,90 ₺/kg"},
            ],
        }]}
        result = aggregate_search_response(response, "kıyma", "kg", "protein")
        self.assertEqual(result["average"], 699.9)

    def test_accepts_branded_packaged_food(self):
        response = {"content": [{
            "title": "Migros Galeta Unu 250 Gr",
            "brand": "Migros",
            "productDepotInfoList": [
                {"marketAdi": "migros", "unitPrice": "119,60 ₺/kg"},
            ],
        }]}
        result = aggregate_search_response(
            response, "galeta unu", "kg", "packaged"
        )
        self.assertEqual(result["average"], 119.6)

    def test_packaged_food_excludes_similar_product(self):
        response = {"content": [
            {
                "title": "Noodlex Köri Çeşnili Noodle 70 Gr",
                "brand": "Noodlex",
                "productDepotInfoList": [
                    {"marketAdi": "market", "unitPrice": "400,00 ₺/kg"},
                ],
            },
            {
                "title": "Edalı Köri Baharat 100 Gr",
                "brand": "Edalı",
                "productDepotInfoList": [
                    {"marketAdi": "market", "unitPrice": "800,00 ₺/kg"},
                ],
            },
        ]}
        result = aggregate_search_response(
            response, "köri", "kg", "packaged", ["noodle", "çeşnili"]
        )
        self.assertEqual(result["average"], 800.0)

    def test_packaged_food_rejects_implausible_unit_price(self):
        response = {"content": [{
            "title": "Edalı Köri Baharat 100 Gr",
            "brand": "Edalı",
            "productDepotInfoList": [
                {"marketAdi": "bad", "unitPrice": "1,15 ₺/kg"},
                {"marketAdi": "good", "unitPrice": "640,00 ₺/kg"},
            ],
        }]}
        result = aggregate_search_response(
            response, "köri", "kg", "packaged", [], 100, 3000
        )
        self.assertEqual(result["average"], 640.0)


if __name__ == "__main__":
    unittest.main()
