"""Dinner suitability scoring.

`Kilerimden seç` once answered with "Ev yapımı mayonez", "Mayonez" and
"Sarımsaklı mayonez": a kiler holding egg, oil and lemon matches every
ingredient of a mayonnaise recipe, so it scored as a perfect pantry match. A
condiment is not an evening meal, and `matched_protein_count` — the first sort
key — even promoted it, because egg is classed as a protein.

These cases guard the head-noun rejection and, just as importantly, the dishes
it must not touch: substring matching cannot be used here, because "sos" is
inside "soslu makarna" and "hardal" is inside "hardallı tavuk".
"""
import pytest

recipe_api = pytest.importorskip(
    "recipe_api",
    reason="recipe_api needs fastapi/pydantic; run this where the API runs",
)

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
    assert recipe_api.title_head_word("Mayonezli Patates Salatası") == "salatası"
    assert recipe_api.title_head_word("") == ""
    assert recipe_api.title_head_word(None) == ""
