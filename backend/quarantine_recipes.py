"""Find and reversibly quarantine high-confidence non-recipe records.

Dry-run is the default. Use --apply only after reviewing the CSV report.
No recipe or ingredient row is ever deleted by this tool.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import re
import sqlite3
import unicodedata


def normalize(value) -> str:
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(
        char for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    ).strip()


def classify(row: sqlite3.Row) -> tuple[str, str] | None:
    title = normalize(row["title"])
    instructions = str(row["instructions"] or "").strip()
    ingredient_count = int(row["ingredient_count"] or 0)

    if not title:
        return "missing_title", "Tarif başlığı boş"
    if ingredient_count == 0:
        return "missing_ingredients", "Hiç malzeme kaydı yok"
    if len(instructions) < 30:
        return "missing_instructions", "Tarif anlatımı yok veya 30 karakterden kısa"

    preparation_patterns = (
        (r"\btavuk suyu (yap|hazirla)", "Tavuk suyu hazırlama kaydı"),
        (r"\bet suyu (yap|hazirla)", "Et suyu hazırlama kaydı"),
        (r"\bkemik suyu (yap|hazirla)", "Kemik suyu hazırlama kaydı"),
        (r"\bnasil (yapilir|hazirlanir|saklanir)\b", "Yemek yerine nasıl-yapılır kaydı"),
        (r"\b(kavanoz|konserve) nasil hazirlanir\b", "Konserve hazırlama kaydı"),
    )
    for pattern, detail in preparation_patterns:
        if re.search(pattern, title):
            return "non_recipe_preparation", detail
    return None


def ensure_table(db: sqlite3.Connection) -> None:
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="/root/recipes.db")
    parser.add_argument("--output", default="/tmp/sofra-recipe-quarantine.csv")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    db = sqlite3.connect(args.db)
    db.row_factory = sqlite3.Row
    ensure_table(db)
    rows = db.execute("""
        SELECT r.id, r.title, r.category, r.instructions,
               COUNT(ri.ingredient_id) AS ingredient_count
        FROM recipes r
        LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        GROUP BY r.id
        ORDER BY r.id
    """).fetchall()

    findings = []
    for row in rows:
        result = classify(row)
        if not result:
            continue
        reason_code, reason_detail = result
        findings.append({
            "recipe_id": row["id"], "title": row["title"],
            "category": row["category"], "ingredient_count": row["ingredient_count"],
            "reason_code": reason_code, "reason_detail": reason_detail,
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ["recipe_id", "title", "category", "ingredient_count",
              "reason_code", "reason_detail"]
    with output.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(findings)

    if args.apply:
        detected_at = datetime.now(timezone.utc).isoformat()
        db.executemany("""
            INSERT INTO recipe_exclusions
                (recipe_id, reason_code, reason_detail, detected_at, active)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(recipe_id) DO UPDATE SET
                reason_code = excluded.reason_code,
                reason_detail = excluded.reason_detail,
                detected_at = excluded.detected_at,
                active = 1
        """, [
            (item["recipe_id"], item["reason_code"], item["reason_detail"], detected_at)
            for item in findings
        ])
        db.commit()

    active_count = db.execute(
        "SELECT COUNT(*) FROM recipe_exclusions WHERE active = 1"
    ).fetchone()[0]
    db.close()
    print({
        "mode": "apply" if args.apply else "dry-run",
        "output": str(output),
        "candidate_count": len(findings),
        "active_quarantine_count": active_count,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
