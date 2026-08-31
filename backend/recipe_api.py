from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import html
import re
import sqlite3



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


# Curated culinary substitutions. These are suggestions, not allergy guarantees;
# ingredient labels still need to be checked by the user.
INGREDIENT_SUBSTITUTIONS = {
    "süt": [
        {"name": "Badem sütü", "ratio": "1:1", "note": "Tatlı ve soslarda"},
        {"name": "Yulaf sütü", "ratio": "1:1", "note": "Tatlı ve soslarda"},
        {"name": "Soya sütü", "ratio": "1:1", "note": "Pişirme ve hamur işlerinde"},
    ],
    "yoğurt": [
        {"name": "Bitkisel yoğurt", "ratio": "1:1", "note": "Soğuk tarif ve soslarda"},
        {"name": "Kefir", "ratio": "1:1", "note": "Daha akışkan sonuç verir"},
    ],
    "tereyağı": [
        {"name": "Zeytinyağı", "ratio": "3/4 ölçü", "note": "Tuzlu tariflerde"},
        {"name": "Margarin", "ratio": "1:1", "note": "Hamur işlerinde"},
    ],
    "krema": [
        {"name": "Yoğurt", "ratio": "1:1", "note": "Kaynatmadan, düşük ısıda ekle"},
        {"name": "Hindistan cevizi sütü", "ratio": "1:1", "note": "Aroma değiştirir"},
    ],
    "yumurta": [
        {"name": "Keten tohumu", "ratio": "1 yumurta = 1 yk + 3 yk su", "note": "Hamur işlerinde"},
        {"name": "Elma püresi", "ratio": "1 yumurta = 1/4 bardak", "note": "Tatlı hamur işlerinde"},
    ],
    "pirinç": [
        {"name": "Bulgur", "ratio": "1:1", "note": "Suyu tarife göre ayarla"},
        {"name": "Karabuğday", "ratio": "1:1", "note": "Doku ve pişme süresi değişir"},
    ],
    "un": [
        {"name": "Tam buğday unu", "ratio": "1:1", "note": "Biraz daha fazla sıvı gerekebilir"},
        {"name": "Yulaf unu", "ratio": "1:1", "note": "Doku daha yumuşak olabilir"},
    ],
    "şeker": [
        {"name": "Hurma püresi", "ratio": "3/4 ölçü", "note": "Sıvıyı biraz azalt"},
        {"name": "Elma püresi", "ratio": "1:1", "note": "Tatlı hamur işlerinde"},
    ],
    "limon suyu": [
        {"name": "Sirke", "ratio": "1/2 ölçü", "note": "Az ekleyip tadını kontrol et"},
    ],
    "galeta unu": [
        {"name": "Yulaf ezmesi", "ratio": "1:1", "note": "İnce çekerek kullan"},
        {"name": "Mısır unu", "ratio": "1:1", "note": "Kaplama tariflerinde"},
    ],
}


SUBSTITUTION_ALIASES = {
    "süt": {"süt", "inek sütü", "tam yağlı süt", "yarım yağlı süt", "yağsız süt"},
    "yoğurt": {"yoğurt", "tam yağlı yoğurt", "süzme yoğurt"},
    "tereyağı": {"tereyağı", "tuzlu tereyağı", "tuzsuz tereyağı"},
    "krema": {"krema", "sıvı krema", "yemeklik krema"},
    "yumurta": {"yumurta", "tavuk yumurtası"},
    "pirinç": {"pirinç", "baldo pirinç", "osmancık pirinç"},
    "un": {"un", "beyaz un", "buğday unu"},
    "şeker": {"şeker", "toz şeker", "beyaz şeker"},
    "limon suyu": {"limon suyu", "taze limon suyu"},
    "galeta unu": {"galeta unu"},
}


def substitutions_for(name):
    normalized = normalize_tr(name)
    for key, aliases in SUBSTITUTION_ALIASES.items():
        if normalized in aliases:
            return INGREDIENT_SUBSTITUTIONS[key]
    return []



def dinner_category_score(category):
    """Dinner suitability for recommendation only. Database is untouched."""
    if not category:
        return 0

    c = category.casefold()

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


@app.get("/")
def home():
    return {
        "name": "Sofra Recipe API",
        "status": "running"
    }


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
            {diet_sql}
            ORDER BY bm25(recipes_fts)
            LIMIT ?
        """, (*params, limit)).fetchall()

        return {
            "query": q,
            "count": len(rows),
            "recipes": [dict(row) for row in rows]
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
            ORDER BY RANDOM()
            LIMIT ?
        """, (limit,)).fetchall()

        return {
            "recipes": [dict(row) for row in rows]
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

        # Presentation-only cleanup. Raw database values remain unchanged.
        result["description"] = clean_description(
            result.get("description"),
            result.get("title")
        )
        result["instructions"] = clean_recipe_text(
            result.get("instructions")
        )

        alternative_names = {
            normalize_tr(alternative["name"])
            for item in ingredients
            for alternative in substitutions_for(
                item["kiler_name"] or item["name"]
            )
        }

        alternative_kiler = {}
        if alternative_names:
            placeholders = ",".join("?" for _ in alternative_names)
            rows = db.execute(
                f"""
                SELECT id, name, name_normalized
                FROM kiler_ingredients
                WHERE name_normalized IN ({placeholders})
                """,
                tuple(sorted(alternative_names))
            ).fetchall()
            alternative_kiler = {
                row["name_normalized"]: dict(row)
                for row in rows
            }

        result["ingredients"] = []
        for item in ingredients:
            ingredient = dict(item)
            alternatives = []

            for suggestion in substitutions_for(
                ingredient.get("kiler_name") or ingredient.get("name")
            ):
                match = alternative_kiler.get(normalize_tr(suggestion["name"]))
                alternatives.append({
                    **suggestion,
                    "kiler_id": match["id"] if match else None,
                    "name": match["name"] if match else suggestion["name"],
                })

            result["ingredients"].append({
                **ingredient,
                "display_text": clean_ingredient_text(
                    ingredient["original_text"] or ingredient["name"]
                ),
                "alternatives": alternatives,
            })

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
        where = []
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
            "recipes": [dict(row) for row in rows]
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
            "recipes": [dict(row) for row in rows]
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
                limit
            )).fetchall()

        else:
            rows = db.execute("""
                SELECT
                    id,
                    name,
                    recipe_count
                FROM kiler_ingredients
                ORDER BY recipe_count DESC
                LIMIT ?
            """, (limit,)).fetchall()

        return {
            "count": len(rows),
            "ingredients": [dict(row) for row in rows]
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
            "recipes": [dict(row) for row in rows]
        }

    finally:
        db.close()


class TonightRequest(BaseModel):
    kiler_ids: list[int]
    limit: int = 50
    time_budget: int | None = None


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

        if payload.time_budget is not None and payload.time_budget > 0:
            time_filter = """
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
                    COUNT(DISTINCT rk.kiler_id) AS matched_count
                FROM recipe_kiler rk
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

                m.matched_count,
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

            dinner_score = dinner_category_score(
                recipe.get("category")
            )

            missing = recipe.get("missing_count") or 0
            core_missing = recipe.get("core_missing_count") or 0

            if missing == 0:
                missing_penalty = 0
            elif missing == 1:
                missing_penalty = 5
            elif missing == 2:
                missing_penalty = 15
            elif missing == 3:
                missing_penalty = 30
            else:
                missing_penalty = 45

            recipe["dinner_score"] = dinner_score
            recipe["missing_penalty"] = missing_penalty

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
                - missing_penalty
                - substance_penalty,
                1
            )

            recipes.append(recipe)

        recipes.sort(
            key=lambda r: (
                -r["tonight_score"],
                r["core_missing_count"],
                -r["core_matched_count"],
                -r["match_percent"],
                r["missing_count"],
                r["total_minutes"]
                    if r["total_minutes"] is not None
                    else 9999,
            )
        )

        recipes = recipes[:limit]

        return {
            "kiler_count": len(ids),
            "time_budget": payload.time_budget,
            "count": len(recipes),
            "recipes": recipes
        }

    finally:
        db.close()
