"""커플 타로 데이터 확인 (shared/bk_tarot/questions.json, tarot_cards.json)

카드·질문 파일을 고쳐도 모양이 깨지지 않았는지, 미션 장소가 맵에 있는지,
관계를 단정하는 말이 들어가지 않았는지 검사한다.
"""

import json
from pathlib import Path

from app.places import place_by_id

DATA = Path(__file__).resolve().parents[2] / "shared" / "bk_tarot"  # 화면(frontend)과 같이 쓰는 파일
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


def test_couple_tips_shape():
    categories = {q["category"] for q in load("questions.json")["questions"]}
    data = load("couple_tips.json")
    tips = data["tips"]
    assert len({t["id"] for t in tips}) == len(tips)
    assert set(data["categoryNames"]) == categories
    assert set(data["talkCards"]) == categories
    for cat in categories:
        assert {t["when"] for t in tips if t["category"] == cat} == {"mismatch", "match", "any"}, cat
    for t in tips:
        assert t["category"] in categories and t["text"]
        assert not any(w in t["text"] for w in BANNED), t["id"]
    for cat, questions in data["talkCards"].items():
        assert len(questions) >= 2
        for q in questions:
            assert q.endswith("?") and not any(w in q for w in BANNED), q


def test_tip_keywords_overlap_card_keywords():
    # RAG 키워드 점수가 실제로 쓰이도록, 조언 키워드 대부분이 카드 키워드에 있어야 함
    card_words = {k for c in load("tarot_cards.json")["cards"] for k in c["keywords"]}
    tip_words = {k for t in load("couple_tips.json")["tips"] for k in t["keywords"]}
    assert len(tip_words & card_words) / len(tip_words) >= 0.8, sorted(tip_words - card_words)


def test_couple_note_extras():
    extras = load("couple_tips.json")["talkExtras"]
    assert set(extras) == {"memory", "bucket", "balance"}
    seen = set()
    for key, theme in extras.items():
        assert theme["name"] and theme["emoji"]
        assert len(theme["questions"]) >= 6, key
        for q in theme["questions"]:
            assert q.endswith("?") and q not in seen and not any(w in q for w in BANNED), q
            seen.add(q)
    assert all(" vs " in q for q in extras["balance"]["questions"])  # 밸런스 게임은 A vs B 모양
