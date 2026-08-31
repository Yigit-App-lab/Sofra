from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import html
import re
import sqlite3
import unicodedata

try:
    from .market_prices import get_market_prices
    from .recipe_costs import safely_attach_recipe_costs
except ImportError:  # `uvicorn recipe_api:app` from the backend directory
    from market_prices import get_market_prices
    from recipe_costs import safely_attach_recipe_costs


# Peak-season windows for fresh Turkish produce. Region shifts mirror the
# mobile app's season model: Mediterranean/Aegean/Southeast arrive earlier,
# Eastern Anatolia later.
SEASONAL_PRODUCE = {
    "domates": (7, 10), "salatalik": (6, 9), "patlican": (6, 9),
    "dolmalik biber": (6, 10), "sivri biber": (6, 10),
    "aci biber": (6, 10), "kirmizi salcalik biber": (8, 9),
    "kabak": (6, 9), "taze fasulye": (6, 9), "bamya": (7, 9),
    "taze bakla": (4, 6), "enginar": (4, 6), "taze bezelye": (4, 6),
    "taze borulce": (8, 9), "taze barbunya": (8, 9), "misir": (8, 9),
    "pirasa": (11, 3), "kereviz": (11, 3), "beyaz lahana": (10, 3),
    "bruksel lahanasi": (11, 2), "karnabahar": (10, 3),
    "brokoli": (10, 3), "balkabagi": (10, 2), "pancar": (10, 3),
    "kirmizi turp": (10, 4), "mantar": (9, 11), "sogan": (8, 10),
    "patates": (9, 11), "havuc": (8, 11), "sarimsak": (7, 9),
    "karpuz": (6, 8), "kavun": (7, 9), "uzum": (8, 10),
    "incir": (8, 9), "seftali": (6, 8), "kayisi": (6, 7),
    "kiraz": (5, 6), "visne": (6, 7), "erik": (6, 8),
    "cilek": (4, 6), "elma": (9, 11), "armut": (8, 10),
    "ayva": (10, 12), "nar": (10, 12), "trabzon hurmasi": (10, 12),
    "portakal": (12, 3), "mandalina": (11, 2), "limon": (11, 3),
    "muz": (1, 12),
}

VEGETABLE_NAMES = set(SEASONAL_PRODUCE) | {
    "semizotu", "ispanak", "pazi", "karalahana", "marul", "kivircik",
    "taze sogan", "taze sarimsak", "maydanoz", "dereotu", "taze nane",
    "roka",
}

FRUIT_NAMES = {
    "karpuz", "kavun", "uzum", "incir", "seftali", "kayisi", "kiraz",
    "visne", "erik", "cilek", "elma", "armut", "ayva", "nar",
    "trabzon hurmasi", "portakal", "mandalina", "limon", "muz",
}

PROTEIN_NAMES = {
    "yumurta", "yumurta sarisi", "yumurta beyazi", "tavuk but",
    "tavuk gogsu", "tavuk eti", "butun tavuk", "kiyma", "dana kiyma",
    "kusbasi et", "dana eti", "kuzu eti", "hindi eti", "sucuk", "pastirma",
    "ton baligi", "ton baligi konserve", "somon", "levrek", "cupra",
    "hamsi", "alabalik", "karides", "kalamar",
}

GRAIN_NAMES = {
    "pirinc", "bulgur", "ince bulgur", "makarna", "sehriye", "eriste",
    "un", "irmik", "nisasta", "ekmek", "yufka", "tarhana", "misir unu",
    "kirmizi mercimek", "yesil mercimek", "nohut", "kuru fasulye",
    "kuru barbunya", "kuru borulce", "kuru bakla ic",
}

REGION_SEASON_SHIFT = {
    "marmara": 0, "ege": -1, "akdeniz": -1, "ic_anadolu": 0,
    "karadeniz": 0, "dogu_anadolu": 1, "guneydogu": -1,
}

PRICING_CITY = "İstanbul"


def normalize_ingredient_name(value):
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(
        char for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    ).strip()


def shifted_month(month, shift):
    return ((month - 1 + shift) % 12) + 1


def month_in_window(month, start, end):
    return start <= month <= end if start <= end else month >= start or month <= end


def ingredient_class(value):
    name = normalize_ingredient_name(value)
    if name in FRUIT_NAMES:
        return "fruit"
    if name in VEGETABLE_NAMES:
        return "vegetable"
    if name in PROTEIN_NAMES:
        return "protein"
    if name in GRAIN_NAMES:
        return "grain"
    return "other"



def clean_recipe_text(text):
    """Clean recipe prose for display only. Database remains untouched."""
    if not text:
        return text

    import re

    x = str(text).strip()

    # 1. 5 -> 1.5
    x = re.sub(r'\b(\d+)\. +(\d+)\b', r'\1.\2', x)

    # Broken leading fractions.
    x = re.sub(r'(?<!\d)/2\b', '1/2', x)
    x = re.sub(r'(?<!\d)/4\b', '1/4', x)
    x = re.sub(r'(?<!\d)/3\b', '1/3', x)

    # Remove spaces before punctuation.
    x = re.sub(r'\s+([,.!?;:])', r'\1', x)

    # Repeated horizontal spaces, but preserve newlines.
    x = re.sub(r'[ \t]+', ' ', x)

    return x.strip()


def clean_recipe_title(title):
    """Remove video claims because Sofra does not provide source videos."""
    if not title:
        return title
    value = re.sub(r"\s*[\(\[]?\s*videolu\s*[\)\]]?", " ", str(title), flags=re.I)
    value = re.sub(r"\s+", " ", value).strip(" -–|/")
    return value.strip()


def recipe_dict(row):
    item = dict(row)
    if "title" in item:
        item["title"] = clean_recipe_title(item["title"])
    return item


def clean_description(text, title=None):
    """Reject obviously broken/generated descriptions."""
    if not text:
        return None

    x = clean_recipe_text(text)

    low = x.casefold()

    # Common broken source-description endings.
    broken = (
        "tarifi'nin ve.",
        "tarifinin ve.",
        "bu tarifin ve.",
    )

    if any(low.endswith(v) for v in broken):
        return None

    # Very short descriptions are generally source noise.
    words = x.split()
    if len(words) < 5:
        return None

    return x


def clean_ingredient_text(text):
    """Clean recipe ingredient text for display only.
    The original database value is never modified.
    """
    if not text:
        return text

    import re

    x = str(text).strip()

    # Common damaged fractions from source parsing.
    x = re.sub(r'^/2\b', '1/2', x)
    x = re.sub(r'^/4\b', '1/4', x)
    x = re.sub(r'^/3\b', '1/3', x)

    # ". 5 su bardağı" / "1. 5 su bardağı" -> "1.5 su bardağı"
    x = re.sub(r'^\. *5\b', '0.5', x)
    x = re.sub(r'\b(\d+)\. +(\d+)\b', r'\1.\2', x)

    # Repeated whitespace.
    x = re.sub(r'\s+', ' ', x).strip()

    return x



def dinner_category_score(category, title=None):
    """Dinner suitability for recommendation only. Database is untouched."""
    if not category and not title:
        return 0

    c = f"{category or ''} {title or ''}".casefold()

    # Definitely not an evening meal recommendation.
    reject = (
        "tatlı", "kek", "kurabiye", "pasta",
        "dondurma", "lokum", "helva", "donut",
        "reçel", "pekmez", "şerbet",
        "içecek", "çay",
        "turşu", "salamura",
        "kış hazırl", "kışlık hazırl",
        "dondurucuda", "buzluk", "nasıl saklanır",
        "baharat yapımı",
        "bebek", "mama",
        "zayıflama kür", "bitkisel kür",
        "takviye edici",
        "tavuk suyu yap", "et suyu yap",
        "stok hazırl", "konserve hazırl",
    )

    if any(x in c for x in reject):
        return -100

    # Usually not the main evening dish.
    weak = (
        "kahvalt", "salata", "meze", "kanepe",
        "aperatif", "atıştırmalık",
        "poğaça", "börek", "çörek",
        "ekmek", "krep", "pankek",
        "simit", "tost",
        "sandviç", "pizza", "lahmacun",
        "milföy", "burger",
    )

    if any(x in c for x in weak):
        return -35

    # Strong dinner/main-course categories.
    strong = (
        "ana yemek", "akşam yemeği",
        "ev yemek", "sulu yemek",
        "et yemek", "etli yemek",
        "kırmızı et", "tavuk", "balık",
        "deniz ürün", "sakatat",
        "köfte", "kebap",
        "sebze yemek", "patates yemek",
        "patlıcan yemek", "mantar yemek",
        "kabak yemek", "pırasa yemek",
        "kereviz yemek", "bezelye yemek",
        "bamya yemek", "fasülye yemek",
        "fasulye yemek", "nohut yemek",
        "mercimek yemek", "bakla yemek",
        "ıspanak yemek", "brokoli yemek",
        "karnabahar yemek",
        "bakliyat yemek",
        "dolma", "sarma",
        "fırın yemek", "tava yemek",
        "kıymalı yemek",
        "hindi yemek",
    )

    if any(x in c for x in strong):
        return 30

    # Valid dinner choices, but normally below a main dish.
    medium = (
        "çorba", "makarna", "mantı",
        "pilav", "pizza", "pide",
        "dürüm", "hamburger",
        "yumurta yemek",
    )

    if any(x in c for x in medium):
        return 15

    return 0


DB = "/root/recipes.db"

app = FastAPI(
    title="Sofra Recipe API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def ensure_ingredient_classes():
    """Create and refresh the conservative produce classification."""
    db = get_db()
    try:
        columns = {
            row[1] for row in db.execute("PRAGMA table_info(kiler_ingredients)")
        }
        if "ingredient_class" not in columns:
            db.execute(
                "ALTER TABLE kiler_ingredients "
                "ADD COLUMN ingredient_class TEXT NOT NULL DEFAULT 'other'"
            )

        rows = db.execute("SELECT id, name FROM kiler_ingredients").fetchall()
        db.executemany(
            "UPDATE kiler_ingredients SET ingredient_class = ? WHERE id = ?",
            [(ingredient_class(row["name"]), row["id"]) for row in rows],
        )
        db.commit()
    finally:
        db.close()


def ensure_recipe_exclusions():
    """Create the reversible quarantine registry; never delete recipe data."""
    db = get_db()
    try:
        db.execute("""
            CREATE TABLE IF NOT EXISTS recipe_exclusions (
                recipe_id INTEGER PRIMARY KEY,
                reason_code TEXT NOT NULL,
                reason_detail TEXT,
                detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id)
            )
        """)
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def initialize_ingredient_classes():
    ensure_ingredient_classes()
    ensure_recipe_exclusions()


@app.get("/")
def home():
    return {
        "name": "Sofra Recipe API",
        "status": "running"
    }


class MarketPriceItem(BaseModel):
    id: str
    name: str
    unit: str = "kg"
    kind: str = "produce"


class MarketPriceRequest(BaseModel):
    city: str = "İstanbul"
    items: list[MarketPriceItem]


@app.post("/market/prices")
def market_prices(payload: MarketPriceRequest):
    """Daily averages from Market Fiyati, with cached stale-data fallback."""
    return get_market_prices(
        [{"id": item.id, "name": item.name, "unit": item.unit, "kind": item.kind} for item in payload.items],
        PRICING_CITY,
    )


@app.get("/recipes/search")
def search_recipes(
    q: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    diet: str | None = None,
    gluten_free: bool = False,
    lactose_free: bool = False,
    low_glycemic: bool = False,
    max_minutes: int | None = Query(default=None, ge=1, le=1440)
):
    db = get_db()

    try:
        diet_sql = ""
        params = [q]

        if diet == "vegan":
            diet_sql = " AND r.is_vegan = 1"
        elif diet == "vegetarian":
            diet_sql = " AND r.is_vegetarian = 1"

        if low_glycemic:
            diet_sql += " AND r.is_low_glycemic = 1"

        if max_minutes is not None:
            diet_sql += " AND r.total_minutes IS NOT NULL AND r.total_minutes <= ?"
            params.append(max_minutes)

        if gluten_free:
            diet_sql += """
            AND NOT EXISTS (
                SELECT 1
                FROM recipe_ingredients ri2
                JOIN ingredients i2 ON i2.id = ri2.ingredient_id
                LEFT JOIN ingredient_aliases ia2
                  ON ia2.alias_normalized = i2.name_normalized
                LEFT JOIN kiler_canonical_map kcm2
                  ON kcm2.canonical_id = ia2.canonical_id
                LEFT JOIN kiler_ingredients ki2
                  ON ki2.id = kcm2.kiler_id
                WHERE ri2.recipe_id = r.id
                  AND ki2.contains_gluten = 1
            )
            """

        if lactose_free:
            diet_sql += """
            AND NOT EXISTS (
                SELECT 1
                FROM recipe_ingredients ri3
                JOIN ingredients i3 ON i3.id = ri3.ingredient_id
                LEFT JOIN ingredient_aliases ia3
                  ON ia3.alias_normalized = i3.name_normalized
                LEFT JOIN kiler_canonical_map kcm3
                  ON kcm3.canonical_id = ia3.canonical_id
                LEFT JOIN kiler_ingredients ki3
                  ON ki3.id = kcm3.kiler_id
                WHERE ri3.recipe_id = r.id
                  AND ki3.contains_lactose = 1
            )
            """

        rows = db.execute(f"""
            SELECT
                r.id,
                r.title,
                r.category,
                r.prep_minutes,
                r.cook_minutes,
                r.total_minutes,
                r.servings,
                r.is_vegan,
                r.is_vegetarian,
                r.is_low_glycemic
            FROM recipes_fts f
            JOIN recipes r ON r.id = f.rowid
            WHERE recipes_fts MATCH ?
            AND NOT EXISTS (
                SELECT 1 FROM recipe_exclusions rex
                WHERE rex.recipe_id = r.id AND rex.active = 1
            )
            {diet_sql}
            ORDER BY bm25(recipes_fts)
            LIMIT ?
        """, (*params, limit)).fetchall()

        return {
            "query": q,
            "count": len(rows),
            "recipes": [recipe_dict(row) for row in rows]
        }

    finally:
        db.close()


@app.get("/recipes/random")
def random_recipes(limit: int = Query(default=10, ge=1, le=50)):
    db = get_db()

    try:
        rows = db.execute("""
            SELECT
                id,
                title,
                category,
                prep_minutes,
                cook_minutes,
                total_minutes,
                servings
            FROM recipes
            WHERE NOT EXISTS (
                SELECT 1 FROM recipe_exclusions rex
                WHERE rex.recipe_id = recipes.id AND rex.active = 1
            )
            ORDER BY RANDOM()
            LIMIT ?
        """, (limit,)).fetchall()

        return {
            "recipes": [recipe_dict(row) for row in rows]
        }

    finally:
        db.close()


@app.get("/categories")
def categories():
    db = get_db()

    try:
        rows = db.execute("""
            SELECT
                category,
                COUNT(*) AS recipe_count
            FROM recipes
            WHERE category IS NOT NULL
              AND TRIM(category) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM recipe_exclusions rex
                  WHERE rex.recipe_id = recipes.id AND rex.active = 1
              )
            GROUP BY category
            ORDER BY recipe_count DESC
        """).fetchall()

        return {
            "categories": [dict(row) for row in rows]
        }

    finally:
        db.close()


@app.get("/recipes/{recipe_id}")
def recipe(recipe_id: int):
    db = get_db()

    try:
        row = db.execute("""
            SELECT *
            FROM recipes
            WHERE id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM recipe_exclusions rex
                  WHERE rex.recipe_id = recipes.id AND rex.active = 1
              )
        """, (recipe_id,)).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Recipe not found"
            )

        ingredients = db.execute("""
            SELECT
                i.name,
                ri.original_text,
                ri.quantity,
                ri.unit,
                kcm.kiler_id,
                ki.name AS kiler_name,
                ki.contains_gluten,
                ki.contains_lactose
            FROM recipe_ingredients ri
            JOIN ingredients i
                ON i.id = ri.ingredient_id
            LEFT JOIN ingredient_aliases ia
                ON ia.alias_normalized = i.name_normalized
            LEFT JOIN kiler_canonical_map kcm
                ON kcm.canonical_id = ia.canonical_id
            LEFT JOIN kiler_ingredients ki
                ON ki.id = kcm.kiler_id
            WHERE ri.recipe_id = ?
        """, (recipe_id,)).fetchall()

        result = dict(row)
        result["title"] = clean_recipe_title(result.get("title"))

        # Presentation-only cleanup. Raw database values remain unchanged.
        result["description"] = clean_description(
            result.get("description"),
            result.get("title")
        )
        result["instructions"] = clean_recipe_text(
            result.get("instructions")
        )

        result["ingredients"] = [
            {
                **dict(item),
                "display_text": clean_ingredient_text(
                    item["original_text"] or item["name"]
                )
            }
            for item in ingredients
        ]

        return result

    finally:
        db.close()


@app.get("/recipes")
def list_recipes(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: str | None = None,
    diet: str | None = None,
    gluten_free: bool = False,
    lactose_free: bool = False,
    low_glycemic: bool = False,
    max_minutes: int | None = Query(default=None, ge=1, le=1440)
):
    db = get_db()

    try:
        where = ["NOT EXISTS (SELECT 1 FROM recipe_exclusions rex "
                 "WHERE rex.recipe_id = recipes.id AND rex.active = 1)"]
        params = []

        if category:
            where.append("category = ?")
            params.append(category)

        if diet == "vegan":
            where.append("is_vegan = 1")
        elif diet == "vegetarian":
            where.append("is_vegetarian = 1")

        if low_glycemic:
            where.append("is_low_glycemic = 1")

        if max_minutes is not None:
            where.append("total_minutes IS NOT NULL AND total_minutes <= ?")
            params.append(max_minutes)

        if gluten_free:
            where.append("""
                NOT EXISTS (
                    SELECT 1
                    FROM recipe_ingredients ri2
                    JOIN ingredients i2 ON i2.id = ri2.ingredient_id
                    LEFT JOIN ingredient_aliases ia2
                      ON ia2.alias_normalized = i2.name_normalized
                    LEFT JOIN kiler_canonical_map kcm2
                      ON kcm2.canonical_id = ia2.canonical_id
                    LEFT JOIN kiler_ingredients ki2
                      ON ki2.id = kcm2.kiler_id
                    WHERE ri2.recipe_id = recipes.id
                      AND ki2.contains_gluten = 1
                )
            """)

        if lactose_free:
            where.append("""
                NOT EXISTS (
                    SELECT 1
                    FROM recipe_ingredients ri3
                    JOIN ingredients i3 ON i3.id = ri3.ingredient_id
                    LEFT JOIN ingredient_aliases ia3
                      ON ia3.alias_normalized = i3.name_normalized
                    LEFT JOIN kiler_canonical_map kcm3
                      ON kcm3.canonical_id = ia3.canonical_id
                    LEFT JOIN kiler_ingredients ki3
                      ON ki3.id = kcm3.kiler_id
                    WHERE ri3.recipe_id = recipes.id
                      AND ki3.contains_lactose = 1
                )
            """)

        where_sql = ""
        if where:
            where_sql = " WHERE " + " AND ".join(where)

        total = db.execute(
            f"SELECT COUNT(*) FROM recipes{where_sql}",
            params
        ).fetchone()[0]

        rows = db.execute(
            f"""
            SELECT
                id,
                title,
                category,
                prep_minutes,
                cook_minutes,
                total_minutes,
                servings,
                is_vegan,
                is_vegetarian,
                is_low_glycemic
            FROM recipes
            {where_sql}
            ORDER BY id
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset]
        ).fetchall()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(rows) < total,
            "recipes": [recipe_dict(row) for row in rows]
        }

    finally:
        db.close()


# ============================================================
# KILER / INGREDIENT API
# ============================================================

TURKISH_LOWER = str.maketrans({
    "İ": "i",
    "I": "ı",
    "Ş": "ş",
    "Ğ": "ğ",
    "Ü": "ü",
    "Ö": "ö",
    "Ç": "ç",
})


def normalize_tr(value: str) -> str:
    value = html.unescape(str(value or ""))
    value = value.replace("\xa0", " ")
    value = value.translate(TURKISH_LOWER).lower()
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def usable_ingredient_name(name: str) -> bool:
    """
    Filters obviously bad canonical records from the imported corpus.
    We keep this conservative for now; later we can improve the data itself.
    """
    if not name:
        return False

    name = html.unescape(name).strip()

    if len(name) < 2 or len(name) > 60:
        return False

    bad_fragments = [
        "&nbsp",
        "&ccedil",
        "&uuml",
        "&ouml",
        "&ndash",
        "&frac",
        "kullanabilirsiniz",
        "ekleyebilirsiniz",
        "yerine",
        "tarif",
    ]

    low = name.lower()

    if any(x in low for x in bad_fragments):
        return False

    # Ingredient names that look like full sentences are not useful in Kiler.
    if name.count(" ") > 7:
        return False

    if name.endswith("."):
        return False

    return True


def usable_kiler_name(name: str) -> bool:
    """Keep pantry choices as products, not recipe preparation/size variants."""
    if not usable_ingredient_name(name):
        return False

    value = normalize_ingredient_name(name)
    preparation_words = (
        "rendesi", "rendelenmis", "dogranmis", "haslanmis", "soyulmus",
        "dilimlenmis", "kavrulmus", "ezilmis", "ufalanmis",
    )
    if any(word in value.split() for word in preparation_words):
        return False

    # Imported recipe phrases such as "tane orta boy havuç" are not distinct
    # pantry products. Their unqualified base ingredient remains selectable.
    if re.match(
        r"^(?:bir|iki|uc|dort|bes|\d+)?\s*"
        r"(?:tane|adet|buyuk|kucuk|orta|orta boy|iri)\s+",
        value,
    ):
        return False

    return True


@app.get("/ingredients/search")
def search_ingredients(
    q: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=50)
):
    db = get_db()

    try:
        query = normalize_tr(q)

        # Fetch more candidates than needed because some will be filtered.
        rows = db.execute("""
            SELECT
                id,
                name,
                name_normalized
            FROM canonical_ingredients
            WHERE name_normalized LIKE ?
            ORDER BY
                CASE
                    WHEN name_normalized = ? THEN 0
                    WHEN name_normalized LIKE ? THEN 1
                    ELSE 2
                END,
                LENGTH(name_normalized),
                name_normalized
            LIMIT ?
        """, (
            "%" + query + "%",
            query,
            query + "%",
            limit * 8
        )).fetchall()

        results = []

        for row in rows:
            item = dict(row)

            if not usable_ingredient_name(item["name"]):
                continue

            results.append({
                "id": item["id"],
                "name": html.unescape(item["name"])
            })

            if len(results) >= limit:
                break

        return {
            "query": q,
            "count": len(results),
            "ingredients": results
        }

    finally:
        db.close()


class IngredientMatchRequest(BaseModel):
    ingredient_ids: list[int]
    limit: int = 30


@app.post("/recipes/by-ingredients")
def recipes_by_ingredients(payload: IngredientMatchRequest):
    ids = list(dict.fromkeys(payload.ingredient_ids))

    if not ids:
        return {
            "count": 0,
            "recipes": []
        }

    limit = max(1, min(payload.limit, 100))

    placeholders = ",".join("?" for _ in ids)

    db = get_db()

    try:
        # Map each recipe's original ingredient records onto our
        # canonical Kiler ingredient IDs.
        sql = f"""
            WITH recipe_matches AS (
                SELECT
                    ri.recipe_id,
                    COUNT(DISTINCT ia.canonical_id) AS matched_count
                FROM recipe_ingredients ri
                JOIN ingredients i
                    ON i.id = ri.ingredient_id
                JOIN ingredient_aliases ia
                    ON ia.alias_normalized = i.name_normalized
                WHERE ia.canonical_id IN ({placeholders})
                GROUP BY ri.recipe_id
            ),
            recipe_totals AS (
                SELECT
                    ri.recipe_id,
                    COUNT(DISTINCT ri.ingredient_id) AS total_ingredients
                FROM recipe_ingredients ri
                WHERE ri.recipe_id IN (
                    SELECT recipe_id
                    FROM recipe_matches
                )
                GROUP BY ri.recipe_id
            )
            SELECT
                r.id,
                r.title,
                r.category,
                r.prep_minutes,
                r.cook_minutes,
                r.total_minutes,
                r.servings,

                m.matched_count,
                t.total_ingredients,

                CASE
                    WHEN t.total_ingredients > 0
                    THEN ROUND(
                        100.0 * m.matched_count / t.total_ingredients,
                        1
                    )
                    ELSE 0
                END AS match_percent,

                t.total_ingredients - m.matched_count AS missing_count

            FROM recipe_matches m

            JOIN recipe_totals t
                ON t.recipe_id = m.recipe_id

            JOIN recipes r
                ON r.id = m.recipe_id

            ORDER BY
                match_percent DESC,
                missing_count ASC,
                m.matched_count DESC

            LIMIT ?
        """

        rows = db.execute(
            sql,
            (*ids, limit)
        ).fetchall()

        return {
            "kiler_ingredient_count": len(ids),
            "count": len(rows),
            "recipes": [recipe_dict(row) for row in rows]
        }

    finally:
        db.close()


@app.get("/kiler/ingredients")
def kiler_ingredients(
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200)
):
    db = get_db()

    try:
        if q:
            query = normalize_tr(q)

            rows = db.execute("""
                SELECT
                    id,
                    name,
                    ingredient_class,
                    recipe_count
                FROM kiler_ingredients
                WHERE name_normalized LIKE ?
                ORDER BY
                    CASE
                        WHEN name_normalized = ? THEN 0
                        WHEN name_normalized LIKE ? THEN 1
                        ELSE 2
                    END,
                    recipe_count DESC,
                    name_normalized
                LIMIT ?
            """, (
                "%" + query + "%",
                query,
                query + "%",
                limit * 8
            )).fetchall()

        else:
            rows = db.execute("""
                SELECT
                    id,
                    name,
                    ingredient_class,
                    recipe_count
                FROM kiler_ingredients
                ORDER BY
                    CASE ingredient_class
                        WHEN 'vegetable' THEN 0
                        WHEN 'protein' THEN 1
                        WHEN 'grain' THEN 2
                        WHEN 'fruit' THEN 3
                        ELSE 4
                    END,
                    recipe_count DESC,
                    name_normalized
                LIMIT ?
            """, (limit * 8,)).fetchall()

        ingredients = []
        for row in rows:
            item = dict(row)
            if not usable_kiler_name(item.get("name")):
                continue
            ingredients.append(item)
            if len(ingredients) >= limit:
                break

        return {
            "count": len(ingredients),
            "ingredients": ingredients
        }

    finally:
        db.close()


class KilerMatchRequest(BaseModel):
    kiler_ids: list[int]
    limit: int = 50


@app.post("/recipes/by-kiler")
def recipes_by_kiler(payload: KilerMatchRequest):
    ids = list(dict.fromkeys(payload.kiler_ids))

    if not ids:
        return {
            "kiler_count": 0,
            "count": 0,
            "recipes": []
        }

    limit = max(1, min(payload.limit, 100))
    placeholders = ",".join("?" for _ in ids)

    db = get_db()

    try:
        sql = f"""
            WITH recipe_kiler AS (
                SELECT DISTINCT
                    ri.recipe_id,
                    kcm.kiler_id
                FROM recipe_ingredients ri
                JOIN ingredients i
                    ON i.id = ri.ingredient_id
                JOIN ingredient_aliases ia
                    ON ia.alias_normalized = i.name_normalized
                JOIN kiler_canonical_map kcm
                    ON kcm.canonical_id = ia.canonical_id
            ),

            matched AS (
                SELECT
                    rk.recipe_id,
                    COUNT(DISTINCT rk.kiler_id) AS matched_count
                FROM recipe_kiler rk
                WHERE rk.kiler_id IN ({placeholders})
                GROUP BY rk.recipe_id
            ),

            totals AS (
                SELECT
                    rk.recipe_id,
                    COUNT(DISTINCT rk.kiler_id) AS total_kiler_ingredients
                FROM recipe_kiler rk
                WHERE rk.recipe_id IN (
                    SELECT recipe_id FROM matched
                )
                GROUP BY rk.recipe_id
            ),

            core_totals AS (
                SELECT
                    rc.recipe_id,
                    COUNT(DISTINCT rc.kiler_id) AS core_count
                FROM recipe_core_ingredients rc
                WHERE rc.score >= 100
                  AND rc.recipe_id IN (
                    SELECT recipe_id FROM matched
                )
                GROUP BY rc.recipe_id
            ),

            core_matched AS (
                SELECT
                    rc.recipe_id,
                    COUNT(DISTINCT rc.kiler_id) AS core_matched_count
                FROM recipe_core_ingredients rc
                WHERE rc.score >= 100
                  AND rc.kiler_id IN ({placeholders})
                  AND rc.recipe_id IN (
                      SELECT recipe_id FROM matched
                  )
                GROUP BY rc.recipe_id
            )

            SELECT
                r.id,
                r.title,
                r.category,
                r.prep_minutes,
                r.cook_minutes,
                r.total_minutes,
                r.servings,

                m.matched_count,
                t.total_kiler_ingredients,

                t.total_kiler_ingredients - m.matched_count
                    AS missing_count,

                COALESCE(ct.core_count, 0)
                    AS core_count,

                COALESCE(cm.core_matched_count, 0)
                    AS core_matched_count,

                COALESCE(ct.core_count, 0)
                  - COALESCE(cm.core_matched_count, 0)
                    AS core_missing_count,

                ROUND(
                    100.0 * m.matched_count /
                    NULLIF(t.total_kiler_ingredients, 0),
                    1
                ) AS match_percent,

                ROUND(
                    (
                        100.0 * m.matched_count /
                        NULLIF(t.total_kiler_ingredients, 0)
                    )

                    + (m.matched_count * 3.0)

                    + CASE
                        WHEN m.matched_count >= 3 THEN 25
                        WHEN m.matched_count = 2 THEN 12
                        ELSE 0
                      END

                    - CASE
                        WHEN t.total_kiler_ingredients = 1 THEN 20
                        WHEN t.total_kiler_ingredients = 2 THEN 5
                        ELSE 0
                      END

                    + (
                        COALESCE(cm.core_matched_count, 0)
                        * 30.0
                    )

                    - (
                        (
                            COALESCE(ct.core_count, 0)
                            - COALESCE(cm.core_matched_count, 0)
                        )
                        * 45.0
                    )

                    - CASE
                        WHEN t.total_kiler_ingredients <= 2 THEN 15
                        ELSE 0
                      END

                , 1) AS score

            FROM matched m

            JOIN totals t
                ON t.recipe_id = m.recipe_id

            JOIN recipes r
                ON r.id = m.recipe_id

            LEFT JOIN core_totals ct
                ON ct.recipe_id = m.recipe_id

            LEFT JOIN core_matched cm
                ON cm.recipe_id = m.recipe_id

            ORDER BY
                core_missing_count ASC,
                score DESC,
                core_matched_count DESC,
                match_percent DESC,
                missing_count ASC,
                r.total_minutes ASC

            LIMIT ?
        """

        params = (*ids, *ids, limit)

        rows = db.execute(
            sql,
            params
        ).fetchall()

        return {
            "kiler_count": len(ids),
            "count": len(rows),
            "recipes": [recipe_dict(row) for row in rows]
        }

    finally:
        db.close()


class SeasonalRequest(BaseModel):
    month: int
    region: str = "marmara"
    city: str = "İstanbul"
    limit: int = 3
    time_budget: int | None = None
    diet: str | None = None
    gluten_free: bool = False
    lactose_free: bool = False
    low_glycemic: bool = False


@app.post("/recipes/seasonal")
def seasonal_recipes(payload: SeasonalRequest):
    month = max(1, min(int(payload.month), 12))
    shift = REGION_SEASON_SHIFT.get(payload.region, 0)

    seasonal_names = {
        name for name, (start, end) in SEASONAL_PRODUCE.items()
        if month_in_window(
            month,
            shifted_month(start, shift),
            shifted_month(end, shift),
        )
    }

    db = get_db()

    try:
        kiler_rows = db.execute(
            "SELECT id, name FROM kiler_ingredients"
        ).fetchall()
        seasonal_kiler = {
            row["id"]: row["name"]
            for row in kiler_rows
            if normalize_ingredient_name(row["name"]) in seasonal_names
        }

        if not seasonal_kiler:
            return {
                "month": month,
                "region": payload.region,
                "seasonal_ingredients": [],
                "count": 0,
                "recipes": [],
            }

        ids = list(seasonal_kiler)
        placeholders = ",".join("?" for _ in ids)
        filters = ""
        filter_params = []

        if payload.diet == "vegan":
            filters += " AND r.is_vegan = 1"
        elif payload.diet == "vegetarian":
            filters += " AND r.is_vegetarian = 1"

        if payload.low_glycemic:
            filters += " AND r.is_low_glycemic = 1"

        if payload.time_budget is not None and payload.time_budget > 0:
            filters += " AND r.total_minutes IS NOT NULL AND r.total_minutes <= ?"
            filter_params.append(payload.time_budget)

        if payload.gluten_free:
            filters += """
            AND NOT EXISTS (
                SELECT 1 FROM recipe_ingredients rg
                JOIN ingredients ig ON ig.id = rg.ingredient_id
                LEFT JOIN ingredient_aliases iag ON iag.alias_normalized = ig.name_normalized
                LEFT JOIN kiler_canonical_map kcg ON kcg.canonical_id = iag.canonical_id
                LEFT JOIN kiler_ingredients kig ON kig.id = kcg.kiler_id
                WHERE rg.recipe_id = r.id AND kig.contains_gluten = 1
            )
            """

        if payload.lactose_free:
            filters += """
            AND NOT EXISTS (
                SELECT 1 FROM recipe_ingredients rl
                JOIN ingredients il ON il.id = rl.ingredient_id
                LEFT JOIN ingredient_aliases ial ON ial.alias_normalized = il.name_normalized
                LEFT JOIN kiler_canonical_map kcl ON kcl.canonical_id = ial.canonical_id
                LEFT JOIN kiler_ingredients kil ON kil.id = kcl.kiler_id
                WHERE rl.recipe_id = r.id AND kil.contains_lactose = 1
            )
            """

        rows = db.execute(f"""
            WITH recipe_seasonal AS (
                SELECT
                    ri.recipe_id,
                    COUNT(DISTINCT kcm.kiler_id) AS seasonal_count,
                    GROUP_CONCAT(DISTINCT ki.name) AS seasonal_ingredients
                FROM recipe_ingredients ri
                JOIN ingredients i ON i.id = ri.ingredient_id
                JOIN ingredient_aliases ia ON ia.alias_normalized = i.name_normalized
                JOIN kiler_canonical_map kcm ON kcm.canonical_id = ia.canonical_id
                JOIN kiler_ingredients ki ON ki.id = kcm.kiler_id
                WHERE kcm.kiler_id IN ({placeholders})
                GROUP BY ri.recipe_id
            )
            SELECT
                r.id, r.title, r.category, r.prep_minutes, r.cook_minutes,
                r.total_minutes, r.servings, r.is_vegan, r.is_vegetarian,
                r.is_low_glycemic, rs.seasonal_count, rs.seasonal_ingredients
            FROM recipe_seasonal rs
            JOIN recipes r ON r.id = rs.recipe_id
            WHERE 1 = 1
            AND NOT EXISTS (
                SELECT 1 FROM recipe_exclusions rex
                WHERE rex.recipe_id = r.id AND rex.active = 1
            )
            {filters}
            ORDER BY rs.seasonal_count DESC, RANDOM()
            LIMIT 600
        """, (*ids, *filter_params)).fetchall()

        recipes = []
        for row in rows:
            recipe = dict(row)
            recipe["title"] = clean_recipe_title(recipe.get("title"))
            dinner_score = dinner_category_score(
                recipe.get("category"), recipe.get("title")
            )
            if dinner_score <= -35:
                continue
            recipe["dinner_score"] = dinner_score
            recipe["seasonal_score"] = (
                recipe.get("seasonal_count", 0) * 40 + dinner_score
            )
            recipe["seasonal_ingredients"] = (
                recipe.get("seasonal_ingredients", "").split(",")
            )
            recipes.append(recipe)

        recipes.sort(
            key=lambda recipe: (
                -recipe["seasonal_score"],
                recipe["total_minutes"] if recipe["total_minutes"] is not None else 9999,
            )
        )
        recipes = recipes[:max(1, min(payload.limit, 20))]
        safely_attach_recipe_costs(db, recipes, PRICING_CITY)

        return {
            "month": month,
            "region": payload.region,
            "seasonal_ingredients": list(seasonal_kiler.values()),
            "count": len(recipes),
            "recipes": recipes,
        }
    finally:
        db.close()


@app.get("/kiler/ingredient-classes")
def kiler_ingredient_classes():
    db = get_db()
    try:
        rows = db.execute("""
            SELECT ingredient_class, COUNT(*) AS ingredient_count
            FROM kiler_ingredients
            GROUP BY ingredient_class
            ORDER BY ingredient_class
        """).fetchall()
        samples = db.execute("""
            SELECT id, name
            FROM kiler_ingredients
            WHERE ingredient_class = 'other'
            ORDER BY recipe_count DESC, name_normalized
            LIMIT 25
        """).fetchall()
        return {
            "classes": [dict(row) for row in rows],
            "other_samples": [dict(row) for row in samples],
        }
    finally:
        db.close()


class TonightRequest(BaseModel):
    kiler_ids: list[int]
    limit: int = 50
    time_budget: int | None = None
    city: str = "İstanbul"
    meatless: bool = False
    diet: str | None = None
    gluten_free: bool = False
    lactose_free: bool = False
    low_glycemic: bool = False


@app.post("/recipes/tonight")
def recipes_tonight(payload: TonightRequest):
    ids = list(dict.fromkeys(payload.kiler_ids))

    if not ids:
        return {
            "kiler_count": 0,
            "time_budget": payload.time_budget,
            "count": 0,
            "recipes": []
        }

    limit = max(1, min(payload.limit, 100))
    placeholders = ",".join("?" for _ in ids)

    db = get_db()

    try:
        time_filter = ""
        time_params = []

        if payload.diet == "vegan":
            time_filter += " AND r.is_vegan = 1"
        elif payload.diet == "vegetarian" or payload.meatless:
            time_filter += " AND r.is_vegetarian = 1"

        if payload.low_glycemic:
            time_filter += " AND r.is_low_glycemic = 1"

        if payload.gluten_free:
            time_filter += """
                AND NOT EXISTS (
                    SELECT 1 FROM recipe_ingredients rg
                    JOIN ingredients ig ON ig.id = rg.ingredient_id
                    LEFT JOIN ingredient_aliases iag ON iag.alias_normalized = ig.name_normalized
                    LEFT JOIN kiler_canonical_map kcg ON kcg.canonical_id = iag.canonical_id
                    LEFT JOIN kiler_ingredients kig ON kig.id = kcg.kiler_id
                    WHERE rg.recipe_id = r.id AND kig.contains_gluten = 1
                )
            """

        if payload.lactose_free:
            time_filter += """
                AND NOT EXISTS (
                    SELECT 1 FROM recipe_ingredients rl
                    JOIN ingredients il ON il.id = rl.ingredient_id
                    LEFT JOIN ingredient_aliases ial ON ial.alias_normalized = il.name_normalized
                    LEFT JOIN kiler_canonical_map kcl ON kcl.canonical_id = ial.canonical_id
                    LEFT JOIN kiler_ingredients kil ON kil.id = kcl.kiler_id
                    WHERE rl.recipe_id = r.id AND kil.contains_lactose = 1
                )
            """

        if payload.time_budget is not None and payload.time_budget > 0:
            time_filter += """
                AND r.total_minutes IS NOT NULL
                AND r.total_minutes <= ?
            """
            time_params.append(payload.time_budget)

        sql = f"""
            WITH recipe_kiler AS (
                SELECT DISTINCT
                    ri.recipe_id,
                    kcm.kiler_id
                FROM recipe_ingredients ri
                JOIN ingredients i
                    ON i.id = ri.ingredient_id
                JOIN ingredient_aliases ia
                    ON ia.alias_normalized = i.name_normalized
                JOIN kiler_canonical_map kcm
                    ON kcm.canonical_id = ia.canonical_id
            ),

            recipe_completeness AS (
                SELECT
                    ri.recipe_id,

                    COUNT(DISTINCT ri.ingredient_id)
                        AS raw_ingredient_count,

                    COUNT(DISTINCT CASE
                        WHEN kcm.kiler_id IS NULL
                        THEN ri.ingredient_id
                    END) AS unmapped_ingredient_count

                FROM recipe_ingredients ri

                JOIN ingredients i
                    ON i.id = ri.ingredient_id

                LEFT JOIN ingredient_aliases ia
                    ON ia.alias_normalized = i.name_normalized

                LEFT JOIN kiler_canonical_map kcm
                    ON kcm.canonical_id = ia.canonical_id

                GROUP BY ri.recipe_id
            ),

            matched AS (
                SELECT
                    rk.recipe_id,
                    COUNT(DISTINCT rk.kiler_id) AS matched_count,
                    COUNT(DISTINCT CASE
                        WHEN km.ingredient_class = 'protein'
                        THEN rk.kiler_id
                    END) AS matched_protein_count
                FROM recipe_kiler rk
                JOIN kiler_ingredients km
                    ON km.id = rk.kiler_id
                WHERE rk.kiler_id IN ({placeholders})
                GROUP BY rk.recipe_id
            ),

            totals AS (
                SELECT
                    rk.recipe_id,
                    COUNT(DISTINCT rk.kiler_id)
                        AS total_kiler_ingredients
                FROM recipe_kiler rk
                WHERE rk.recipe_id IN (
                    SELECT recipe_id FROM matched
                )
                GROUP BY rk.recipe_id
            ),

            core_totals AS (
                SELECT
                    rc.recipe_id,
                    COUNT(DISTINCT rc.kiler_id) AS core_count
                FROM recipe_core_ingredients rc
                WHERE rc.score >= 100
                  AND rc.recipe_id IN (
                    SELECT recipe_id FROM matched
                )
                GROUP BY rc.recipe_id
            ),

            core_matched AS (
                SELECT
                    rc.recipe_id,
                    COUNT(DISTINCT rc.kiler_id)
                        AS core_matched_count
                FROM recipe_core_ingredients rc
                WHERE rc.score >= 100
                  AND rc.kiler_id IN ({placeholders})
                  AND rc.recipe_id IN (
                      SELECT recipe_id FROM matched
                  )
                GROUP BY rc.recipe_id
            )

            SELECT
                r.id,
                r.title,
                r.category,
                r.prep_minutes,
                r.cook_minutes,
                r.total_minutes,
                r.servings,
                r.is_vegan,
                r.is_vegetarian,
                r.is_low_glycemic,

                m.matched_count,
                m.matched_protein_count,
                t.total_kiler_ingredients,

                rcx.raw_ingredient_count,
                rcx.unmapped_ingredient_count,

                (
                    t.total_kiler_ingredients
                    + rcx.unmapped_ingredient_count
                ) AS strict_total_ingredients,

                (
                    t.total_kiler_ingredients
                    - m.matched_count
                ) AS known_missing_count,

                (
                    t.total_kiler_ingredients
                    - m.matched_count
                    + rcx.unmapped_ingredient_count
                ) AS missing_count,

                CASE
                    WHEN (
                        t.total_kiler_ingredients
                        - m.matched_count
                        + rcx.unmapped_ingredient_count
                    ) = 0
                    THEN 1
                    ELSE 0
                END AS is_ready,

                COALESCE(ct.core_count, 0)
                    AS core_count,

                COALESCE(cm.core_matched_count, 0)
                    AS core_matched_count,

                COALESCE(ct.core_count, 0)
                  - COALESCE(cm.core_matched_count, 0)
                    AS core_missing_count,

                ROUND(
                    100.0 * m.matched_count /
                    NULLIF(
                        t.total_kiler_ingredients
                        + rcx.unmapped_ingredient_count,
                        0
                    ),
                    1
                ) AS match_percent,

                ROUND(
                    (
                        100.0 * m.matched_count /
                        NULLIF(t.total_kiler_ingredients, 0)
                    )

                    + (m.matched_count * 3.0)

                    + CASE
                        WHEN m.matched_count >= 3 THEN 25
                        WHEN m.matched_count = 2 THEN 12
                        ELSE 0
                      END

                    - CASE
                        WHEN t.total_kiler_ingredients = 1 THEN 20
                        WHEN t.total_kiler_ingredients = 2 THEN 5
                        ELSE 0
                      END

                    + (
                        COALESCE(cm.core_matched_count, 0)
                        * 30.0
                    )

                    - (
                        (
                            COALESCE(ct.core_count, 0)
                            - COALESCE(cm.core_matched_count, 0)
                        )
                        * 45.0
                    )

                    - CASE
                        WHEN t.total_kiler_ingredients <= 2 THEN 15
                        ELSE 0
                      END

                , 1) AS score

            FROM matched m

            JOIN totals t
                ON t.recipe_id = m.recipe_id

            JOIN recipe_completeness rcx
                ON rcx.recipe_id = m.recipe_id

            JOIN recipes r
                ON r.id = m.recipe_id

            LEFT JOIN core_totals ct
                ON ct.recipe_id = m.recipe_id

            LEFT JOIN core_matched cm
                ON cm.recipe_id = m.recipe_id

            WHERE 1 = 1
            AND NOT EXISTS (
                SELECT 1 FROM recipe_exclusions rex
                WHERE rex.recipe_id = r.id AND rex.active = 1
            )
            {time_filter}
        """

        params = (
            *ids,
            *ids,
            *time_params
        )

        rows = db.execute(sql, params).fetchall()

        recipes = []

        for row in rows:
            recipe = dict(row)
            recipe["title"] = clean_recipe_title(recipe.get("title"))

            dinner_score = dinner_category_score(
                recipe.get("category"), recipe.get("title")
            )

            # "Bu akşam ne pişirelim?" only returns dinner-suitable recipes.
            # Snacks and preparation/how-to records stay searchable elsewhere.
            if dinner_score <= -35:
                continue

            core_missing = recipe.get("core_missing_count") or 0

            recipe["dinner_score"] = dinner_score

            total_ingredients = recipe.get("total_kiler_ingredients") or 0

            if total_ingredients <= 1:
                substance_penalty = 30
            elif total_ingredients == 2:
                substance_penalty = 10
            else:
                substance_penalty = 0

            recipe["substance_penalty"] = substance_penalty

            recipe["tonight_score"] = round(
                float(recipe.get("score") or 0)
                + dinner_score
                - (core_missing * 50)
                - substance_penalty,
                1
            )

            recipes.append(recipe)

        recipes.sort(
            key=lambda r: (
                -r["matched_protein_count"],
                r["core_missing_count"],
                -r["matched_count"],
                -r["core_matched_count"],
                -r["tonight_score"],
                -r["match_percent"],
                -(r["total_minutes"]
                    if r["total_minutes"] is not None
                    else 0),
            )
        )

        total_count = len(recipes)
        recipes = recipes[:limit]
        safely_attach_recipe_costs(db, recipes, PRICING_CITY)

        return {
            "kiler_count": len(ids),
            "time_budget": payload.time_budget,
            "count": len(recipes),
            "total_count": total_count,
            "has_more": total_count > len(recipes),
            "recipes": recipes
        }

    finally:
        db.close()
