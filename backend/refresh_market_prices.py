"""Warm Sofra's daily Market Fiyati cache from cron.

Example:
    15 6 * * * cd /root/Sofra && /usr/bin/python3 backend/refresh_market_prices.py --city Istanbul >> /var/log/sofra-market-refresh.log 2>&1
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

try:
    from .market_prices import get_market_prices
except ImportError:
    from market_prices import get_market_prices


ROOT = Path(__file__).resolve().parents[1]
INGREDIENTS_PATH = ROOT / "assets" / "data" / "ingredients.json"
TRACKED_KINDS = {"sebze", "meyve", "yesillik", "protein"}


def produce_items() -> list[dict]:
    data = json.loads(INGREDIENTS_PATH.read_text(encoding="utf-8"))
    return [
        {
            "id": item["id"],
            "name": item.get("marketQuery") or item["names"]["tr"],
            "unit": item.get("unit", "kg"),
            "kind": item.get("marketKind") or item.get("kind", "produce"),
            "excludeTitleWords": item.get("excludeTitleWords", []),
            "minUnitPrice": item.get("minUnitPrice", 0),
            "maxUnitPrice": item.get("maxUnitPrice", 10000),
        }
        for item in data.get("items", [])
        if item.get("kind") in TRACKED_KINDS or item.get("marketTracked")
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh Sofra market prices")
    parser.add_argument("--city", default="Istanbul")
    args = parser.parse_args()
    requested = produce_items()
    result = get_market_prices(requested, args.city)
    print(json.dumps({
        "city": result["city"],
        "updated_at": result["updated_at"],
        "upstream_ok": result["upstream_ok"],
        "requested": len(requested),
        "received": len(result["items"]),
    }, ensure_ascii=False))
    return 0 if result["items"] else 1


if __name__ == "__main__":
    sys.exit(main())
