"""커플 타로 데이터 확인 (ai/data/questions.json, tarot_cards.json)

카드·질문 파일을 고쳐도 모양이 깨지지 않았는지, 미션 장소가 맵에 있는지,
관계를 단정하는 말이 들어가지 않았는지 검사한다.
"""

import json
from pathlib import Path

from app.places import place_by_id

DATA = Path(__file__).resolve().parents[1] / "data"
# 카드 문장에 들어가면 안 되는 말 (나중에 safety.py의 해석 검사 규칙으로 옮김)
BANNED = ["헤어", "이별", "절대", "끝날", "맞지 않는 사이", "불행"]


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def test_questions_shape():
    questions = load("questions.json")["questions"]
    assert len(questions) == 10
    assert len({q["id"] for q in questions}) == 10
    for q in questions:
        assert q["self"] and "{partner}" in q["guess"]
        assert 2 <= len(q["options"]) <= 4
        assert len(set(q["options"])) == len(q["options"])


def test_cards_are_22_major_arcana():
    cards = load("tarot_cards.json")["cards"]
    assert len(cards) == 22
    assert [c["no"] for c in cards] == list(range(22))
    assert len({c["id"] for c in cards}) == 22


def test_card_tags_match_question_categories():
    categories = {q["category"] for q in load("questions.json")["questions"]}
    for card in load("tarot_cards.json")["cards"]:
        assert card["tags"], card["id"]
        assert set(card["tags"]) <= categories, card["id"]


def test_missions_point_to_bk_places():
    places = place_by_id()
    for card in load("tarot_cards.json")["cards"]:
        place = places.get(card["mission"]["placeId"])
        assert place is not None, card["id"]
        assert place["zone"] == "BK", card["id"]
        assert card["mission"]["text"]


def test_card_text_has_no_banned_words():
    for card in load("tarot_cards.json")["cards"]:
        for text in (card["upright"], card["reversed"], card["mission"]["text"]):
            assert not any(w in text for w in BANNED), (card["id"], text)
