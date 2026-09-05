"""Dinner suitability scoring.

`Kilerimden seç` once answered with "Ev yapımı mayonez", "Mayonez" and
"Sarımsaklı mayonez": a kiler holding egg, oil and lemon matches every
ingredient of a mayonnaise recipe, so it scored as a perfect pantry match. A
condiment is not an evening meal, and `matched_protein_count` — the first sort
key — even promoted it, because egg is classed as a protein.

These cases guard the head-noun rejection and, just as importantly, the dishes
it must not touch: substring matching cannot be used here, because "sos" is
inside "soslu makarna" and "hardal" is inside "hardallı tavuk".

They also guard the two later fixes: Turkish folding, without which the scorer
never matched its own keywords through an İ, and the category fallback, which
is allowed to speak only where every keyword rule stayed silent.

Run it anywhere — `_load_api` stubs the web framework, so no virtualenv is
needed:

    python3 -m pytest backend/test_dinner_suitability.py -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _load_api import api as recipe_api  # noqa: E402  (after the path insert)

score = recipe_api.dinner_category_score


@pytest.mark.parametrize("title", [
    "Mayonez",
    "Ev Yapımı Mayonez",
    "Sarımsaklı Mayonez",
    "Barbekü Sos",
    "Domates Salçası",
    "Erişte Hamuru",
    "Ev Yapımı Ketçap",
    "Kayısı Reçeli",
])
def test_condiments_and_bases_are_never_dinner(title):
    assert score(None, title) == -100


@pytest.mark.parametrize("category,title,expected", [
    ("makarna", "Soslu Makarna", 15),
    ("tavuk yemekleri", "Hardallı Tavuk", 30),
    ("tavuk yemekleri", "Fırında Tavuk", 30),
    ("köfte", "İzmir Köfte", 30),
    ("bakliyat yemekleri", "Kuru Fasulye", 30),
    ("çorba", "Mercimek Çorbası", 15),
])
def test_real_dinners_survive_a_condiment_word_in_the_title(category, title, expected):
    assert score(category, title) == expected


def test_a_salad_using_mayonnaise_is_weak_not_rejected():
    # The head noun is the salad, so the existing weak penalty applies and the
    # dish stays searchable rather than disappearing.
    assert score("salata", "Mayonezli Patates Salatası") == -35


def test_head_word_reads_the_last_word_only():
    assert recipe_api.title_head_word("Ev Yapımı Mayonez") == "mayonez"
    assert recipe_api.title_head_word("Mayonezli Patates Salatası") == "salatasi"
    assert recipe_api.title_head_word("") == ""
    assert recipe_api.title_head_word(None) == ""


# --------------------------------------------------------------------------
# Turkish folding.
#
# str.casefold() turns İ into "i" plus a combining dot (U+0307), so "içecek"
# was never inside casefold("İçecekler") and 2,260 drink recipes scored 0 —
# competing with real dinners on ranking alone. Both the text and the keyword
# tables now go through fold_tr, so they meet in the same alphabet.

def test_fold_tr_flattens_both_turkish_i_forms():
    assert recipe_api.fold_tr("İÇECEK") == "icecek"
    assert recipe_api.fold_tr("Işkembe") == "iskembe"
    assert recipe_api.fold_tr("ıspanak") == "ispanak"
    assert recipe_api.fold_tr(None) == ""


def test_fold_tr_leaves_no_combining_marks():
    import unicodedata
    for word in ("İçecek", "Şeftali", "Ğ", "Öğün", "Üzüm", "Çilek"):
        folded = recipe_api.fold_tr(word)
        assert not any(unicodedata.combining(ch) for ch in folded), word


@pytest.mark.parametrize("category,title", [
    ("Soğuk İçecekler", "Limonata"),
    ("Sıcak İçecekler", "Salep"),
    ("İçecek Tarifleri", "Ayran"),
    ("İçecekler", "Şalgam suyu"),
    # The same word written without its diacritics, as source data often does.
    ("icecek", "Limonata"),
])
def test_drinks_are_rejected_through_a_capital_i(category, title):
    assert score(category, title) == -100


def test_a_capital_i_keyword_beats_a_dinner_word_in_the_title():
    # "Tavuk" is a strong dinner keyword. It must not rescue a drink.
    assert score("Sıcak İçecekler", "Tavuk suyu") == -100


@pytest.mark.parametrize("category,title,expected", [
    ("Sebze Yemekleri", "Ispanak Yemeği", 30),
    ("Sebze Yemekleri", "ıspanak yemeği", 30),
    ("Çorba Tarifleri", "Işkembe Çorbası", 15),
])
def test_dotless_i_dishes_still_score(category, title, expected):
    assert score(category, title) == expected


# --------------------------------------------------------------------------
# The category fallback.
#
# 16,918 recipes (9.7% of the library) matched no keyword at all and scored 0.
# The exact category names below come from audit_dinner_classification.py run
# against the live library. The fallback is consulted only after every keyword
# rule has returned 0, which is what keeps the change additive.

@pytest.mark.parametrize("category,expected", [
    ("Tart Tarifleri", -100),
    ("Cheesecake Tarifleri", -100),
    ("Süt Ürünleri", -100),
    ("Hamur İşi", -35),
    ("Kızartma Tarifleri", -35),
    ("Çocuklar İçin", -35),
    ("Zeytinyağlı", 30),
    ("Zeytinyağlı Yemek Tarifleri", 30),
    ("Sebze", 30),
    ("Et", 30),
    ("Bakliyat", 30),
    ("Hızlı Yemekler", 15),
])
def test_category_names_speak_when_no_keyword_does(category, expected):
    assert score(category, "Adı bilinmeyen bir tarif") == expected


@pytest.mark.parametrize("category", [
    "(kategorisiz)",
    "Diğer Tarifler",
    "Dünya Mutfaklarından Tarifler",
    "Pratik Yemek Tarifleri",
])
def test_mixed_categories_keep_no_opinion(category):
    # These hold dinners and desserts alike. A guess here would be worse than
    # silence, so they stay out of the table on purpose.
    assert score(category, "Adı bilinmeyen bir tarif") == 0


@pytest.mark.parametrize("category,title,expected", [
    # A keyword in the title always wins over the category name.
    ("Zeytinyağlı", "Çikolatalı Kek", -100),
    ("Sebze", "Ev Yapımı Mayonez", -100),
    ("Et", "Kahvaltılık Poğaça", -35),
    ("Tart Tarifleri", "Fırında Tavuk", 30),
    ("Süt Ürünleri", "Tavuk Sote", 30),
])
def test_the_fallback_never_overturns_a_keyword(category, title, expected):
    assert score(category, title) == expected


def test_fallback_matching_ignores_case_and_diacritics():
    assert score("ZEYTİNYAĞLI", "Adı bilinmeyen bir tarif") == 30
    assert score("zeytinyagli", "Adı bilinmeyen bir tarif") == 30


def test_nothing_at_all_scores_zero():
    assert score(None, None) == 0
    assert score("", "") == 0


# --------------------------------------------------------------------------
# The possessive suffix.
#
# Turkish softens the k before a possessive, so "sebze yemek" becomes "sebze
# yemeği" — folded, "sebze yemegi", which does not contain "sebze yemek". The
# plural "yemekleri" matched all along; the singular never did, leaving 53
# recipes in "Sizden Sebze Yemeği Tarifleri" with no score at all.

@pytest.mark.parametrize("category,title,expected", [
    ("Sizden Sebze Yemeği Tarifleri", "Beyaz Lahana Mücveri", 30),
    ("Sebze Yemeği Tarifleri", "Yoğurtlu Köz Biber", 30),
    ("Et Yemeği Tarifleri", "Fırında Kuzu", 30),
    ("Bakliyat Tarifleri", "Etli Nohut Yemeği", 30),
    ("Kızartma Tarifleri", "Domates Soslu Patlıcan Yemeği", 30),
    ("Çocuklar İçin", "Pırasa Yemeği", 30),
    # The plural, which worked before and must keep working.
    ("Sebze Yemekleri", "Karnıyarık", 30),
])
def test_the_possessive_form_scores_like_the_plural(category, title, expected):
    assert score(category, title) == expected


@pytest.mark.parametrize("title", [
    "Bu Tarif İle Kabak Yemeyen Kimse Kalmayacak",
    # No other keyword in these titles, so 30 could only come from the suffix.
    "Et Yemeyen Çocuklarınız İçin Sağlıklı Domates Tarifi",
    "Ispanaklı Sufle (Ispanak Yemeyen Çocuk Kalmayacak)",
    "Teremyağlı Civciv Omlet (Yumurta Yemeyen Çocuklara)",
    "Sebze Yemeyen Çocuklar İçin Kolay Tarif",
])
def test_a_title_about_not_eating_is_not_a_main_dish(title):
    """The reason the keyword is "yemegi" and not the stem "yeme".

    Shortening "sebze yemek" to "sebze yeme" would cover every suffix in one
    entry — and would also match "sebze yemeyen", "who does not eat vegetables".
    Four titles in the live library invert that way, so the stem was measured
    and rejected. These cases keep it rejected.
    """
    assert score("Çocuklar İçin", title) != 30


def test_no_keyword_can_hide_inside_a_negative():
    """The property, rather than five examples of it.

    Every keyword ending in the possessive must be absent from the negative
    forms built on the same stem. This is what the stem form failed.
    """
    for word in recipe_api._STRONG + recipe_api._MEDIUM:
        if not word.endswith("yemegi"):
            continue
        stem = word[:-len("yemegi")] + "yeme"
        for ending in ("yen", "yenler", "yene", "yecek", "z", "miyor"):
            assert word not in stem + ending, f"{word!r} hides in {stem + ending!r}"


def test_with_possessive_adds_and_never_removes():
    words = ("sebze yemek", "tavuk", "aksam yemegi")
    out = recipe_api.with_possessive(words)
    assert set(words) <= set(out)
    assert "sebze yemegi" in out
    # A keyword that is not of the "... yemek" shape gains nothing.
    assert sum(1 for w in out if w.startswith("tavuk")) == 1
    assert len(out) == len(set(out))
