"""Daily Market Fiyati adapter.

The upstream endpoint is used by marketfiyati.org.tr but is not a documented
public API.  Keep every assumption about it in this module so a site change
cannot break recipe endpoints or the mobile app.  Successful observations are
cached for a day; stale observations remain usable during upstream outages.
"""

from __future__ import annotations

from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import os
from pathlib import Path
import re
import statistics
import tempfile
import threading
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = os.getenv(
    "MARKET_FIYATI_SEARCH_URL",
    "https://api.marketfiyati.org.tr/api/v2/search",
)
CACHE_PATH = Path(os.getenv(
    "SOFRA_MARKET_CACHE",
    str(Path(tempfile.gettempdir()) / "sofra-market-prices-v2.json"),
))
CACHE_TTL_SECONDS = int(os.getenv("SOFRA_MARKET_CACHE_TTL", "86400"))
TIMEOUT_SECONDS = float(os.getenv("MARKET_FIYATI_TIMEOUT", "8"))

# City-centre coordinates only. Sofra never sends a user's precise location.
CITY_CENTRES = {
    "istanbul": (41.0082, 28.9784),
    "ankara": (39.9334, 32.8597),
    "izmir": (38.4237, 27.1428),
    "bursa": (40.1950, 29.0600),
    "antalya": (36.8969, 30.7133),
    "adana": (37.0000, 35.3213),
    "gaziantep": (37.0662, 37.3833),
    "samsun": (41.2867, 36.3300),
    "trabzon": (41.0027, 39.7168),
    "erzurum": (39.9043, 41.2679),
    "diyarbakir": (37.9144, 40.2306),
}

_lock = threading.Lock()


def normalize(value: str) -> str:
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(
        char for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    ).strip()


def _number(value) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    if not isinstance(value, str):
        return None
    match = re.search(r"\d+(?:[.,]\d+)?", value.replace(" ", ""))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def normalized_unit_price(depot: dict, target_unit: str) -> float | None:
    """Read the API's already-normalized unitPrice, rejecting unit mismatches."""
    text = normalize(depot.get("unitPrice", "")).replace("₺", "")
    aliases = {
        "kg": ("/kg", "kg"),
        "L": ("/l", "litre", "liter"),
        "adet": ("/adet", "adet"),
        "demet": ("/demet", "demet"),
    }.get(target_unit, ())
    if text and aliases and any(alias in text for alias in aliases):
        value = _number(text)
        return value if value and 0 < value < 10000 else None

    # For pieces, an unqualified depot price is normally one item's price.
    if target_unit == "adet" and not text:
        value = _number(depot.get("price"))
        return value if value and 0 < value < 10000 else None
    return None


def _matching_product(title: str, query: str) -> bool:
    title_words = set(normalize(title).split())
    query_words = [word for word in normalize(query).split() if len(word) > 1]
    return bool(query_words) and all(word in title_words for word in query_words)


def aggregate_search_response(
    data: dict,
    query: str,
    unit: str,
    kind: str = "produce",
    exclude_title_words: list[str] | None = None,
    min_unit_price: float = 0,
    max_unit_price: float = 10000,
) -> dict | None:
    """Aggregate one comparable observation per market, with outlier trimming."""
    by_market: dict[str, list[float]] = {}
    for product in data.get("content") or []:
        title = product.get("title", "")
        if not _matching_product(title, query):
            continue
        normalized_title = normalize(title)
        if any(normalize(word) in normalized_title for word in (exclude_title_words or [])):
            continue
        # Produce on Market Fiyati is catalogued as unbranded. Requiring that
        # marker excludes chips, sauces, juices and preserves without a brittle
        # list of every processed-food word.
        if kind not in ("protein", "packaged") and normalize(product.get("brand")) != "markasiz":
            continue
        for depot in product.get("productDepotInfoList") or []:
            value = normalized_unit_price(depot, unit)
            if value is None or not min_unit_price <= value <= max_unit_price:
                continue
            market = normalize(depot.get("marketAdi") or depot.get("marketName") or "unknown")
            by_market.setdefault(market, []).append(value)

    # Depot duplication should not give a chain more weight than another chain.
    values = [statistics.median(items) for items in by_market.values() if items]
    if not values:
        return None
    values.sort()
    if len(values) >= 4:
        q1, _, q3 = statistics.quantiles(values, n=4, method="inclusive")
        spread = q3 - q1
        kept = [v for v in values if q1 - 1.5 * spread <= v <= q3 + 1.5 * spread]
        if kept:
            values = kept
    return {
        "average": round(sum(values) / len(values), 2),
        "lowest": round(min(values), 2),
        "highest": round(max(values), 2),
        "market_count": len(values),
    }


def _read_cache() -> dict:
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {"items": {}}


def _write_cache(cache: dict) -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = CACHE_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        temporary.replace(CACHE_PATH)
    except OSError:
        pass  # Memory response is still useful; cache failure must not break Pazar.


def get_cached_price(item_id: str, unit: str, city: str) -> dict | None:
    """Return the last observation without triggering an upstream request."""
    key = f"{normalize(city)}:{item_id}:{unit}"
    with _lock:
        item = (_read_cache().get("items") or {}).get(key)
    return dict(item) if item else None


def _search(query: str, city: str) -> dict:
    latitude, longitude = CITY_CENTRES.get(normalize(city), CITY_CENTRES["istanbul"])
    body = json.dumps({
        "keywords": query,
        "latitude": latitude,
        "longitude": longitude,
        "distance": 25,
        "size": 48,
    }).encode("utf-8")
    request = Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Sofra/0.1"},
        method="POST",
    )
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def get_market_prices(items: list[dict], city: str) -> dict:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    results = []
    upstream_ok = True

    with _lock:
        cache = _read_cache()
        cached_items = cache.setdefault("items", {})

    pending = []
    for item in items[:120]:
        item_id = str(item.get("id") or "")
        query = str(item.get("name") or "").strip()
        unit = str(item.get("unit") or "kg")
        kind = str(item.get("kind") or "produce")
        exclude_title_words = list(item.get("excludeTitleWords") or [])
        min_unit_price = float(item.get("minUnitPrice") or 0)
        max_unit_price = float(item.get("maxUnitPrice") or 10000)
        if not item_id or not query:
            continue
        key = f"{normalize(city)}:{item_id}:{unit}"
        cached = cached_items.get(key)
        age = None
        if cached:
            try:
                age = (now - datetime.fromisoformat(cached["observed_at"])).total_seconds()
            except (KeyError, TypeError, ValueError):
                age = None
        if cached and age is not None and age < CACHE_TTL_SECONDS:
            results.append({**cached, "id": item_id, "fresh": True})
            continue
        pending.append((
            item_id, query, unit, kind, exclude_title_words,
            min_unit_price, max_unit_price, key, cached,
        ))

    def fetch_one(entry):
        (item_id, query, unit, kind, exclude_title_words,
         min_unit_price, max_unit_price, key, cached) = entry
        aggregate = aggregate_search_response(
            _search(query, city), query, unit, kind, exclude_title_words,
            min_unit_price, max_unit_price,
        )
        return item_id, unit, key, cached, aggregate

    # Bounded concurrency keeps the first daily refresh practical without
    # hammering an undocumented upstream service.
    with ThreadPoolExecutor(max_workers=min(6, max(1, len(pending)))) as pool:
        futures = {pool.submit(fetch_one, entry): entry for entry in pending}
        for future in as_completed(futures):
            item_id, _, _, _, _, _, _, _, cached = futures[future]
            try:
                item_id, unit, key, cached, aggregate = future.result()
                if aggregate:
                    observation = {
                        **aggregate, "unit": unit, "observed_at": now_iso,
                        "source": "marketfiyati.org.tr",
                    }
                    cached_items[key] = observation
                    results.append({**observation, "id": item_id, "fresh": True})
                elif cached:
                    results.append({**cached, "id": item_id, "fresh": False})
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
                upstream_ok = False
                if cached:
                    results.append({**cached, "id": item_id, "fresh": False})

    with _lock:
        cache["updated_at"] = now_iso
        _write_cache(cache)
    return {
        "city": city,
        "updated_at": now_iso,
        "source": "marketfiyati.org.tr",
        "upstream_ok": upstream_ok,
        "items": sorted(results, key=lambda item: item["id"]),
    }
