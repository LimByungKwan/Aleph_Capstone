"""커플 타로 그래프 (app/tarot.py) — analyze_a/b 병렬 + compare"""

import pytest

from app.tarot import TarotInputError, build_graph, load_questions, read_tarot

N = len(load_questions())


def person(name, self_picks, guess_picks):
    return {"name": name, "self": list(self_picks), "guess": list(guess_picks)}


def test_graph_runs_analyze_in_parallel_then_compare():
    graph = build_graph().get_graph()
    edges = {(e.source, e.target) for e in graph.edges}
    assert ("__start__", "analyze_a") in edges
    assert ("__start__", "analyze_b") in edges
    assert ("analyze_a", "compare") in edges
    assert ("analyze_b", "compare") in edges
    assert ("analyze_a", "analyze_b") not in edges  # 서로 기다리지 않음


def test_both_guess_everything_right():
    a_self = [i % 4 for i in range(N)]
    b_self = [(i + 1) % 4 for i in range(N)]
    result = read_tarot(person("민지", a_self, b_self), person("준호", b_self, a_self))
    assert result["match"] == 100
    assert result["hits"] == {"a": N, "b": N, "total": N}
    assert result["mismatches"] == []
    assert result["focus"] == []
    assert result["sameTaste"] == []  # 고른 보기가 모두 다름
    assert result["names"] == {"a": "민지", "b": "준호"}
    assert result["source"] == "rules"


def test_nobody_guesses_right():
    zeros, ones = [0] * N, [1] * N
    result = read_tarot(person("A", zeros, zeros), person("B", zeros, ones))
    # A는 B가 0이라고 맞힘, B는 A를 1이라고 짐작 → 틀림
    assert result["hits"] == {"a": N, "b": 0, "total": N}
    assert result["match"] == 50
    assert len(result["mismatches"]) == N
    assert len(result["sameTaste"]) == N


def test_mismatch_explains_who_guessed_what():
    questions = load_questions()
    a_self = [0] * N
    b_self = [0] * N
    a_guess = [0] * N
    b_guess = [0] * N
    b_guess[0] = 2  # 준호가 첫 질문에서 민지 답을 2번으로 짐작 (실제는 0번)
    result = read_tarot(person("민지", a_self, a_guess), person("준호", b_self, b_guess))
    assert result["match"] == round(100 * (2 * N - 1) / (2 * N))
    [miss] = result["mismatches"]
    q = questions[0]
    assert miss == {
        "questionId": q["id"],
        "category": q["category"],
        "question": q["self"],
        "about": "민지",
        "guesser": "준호",
        "answer": q["options"][0],
        "guessed": q["options"][2],
    }
    assert result["focus"] == [q["category"]]


def test_focus_lists_most_missed_category_first():
    questions = load_questions()
    a_self = [0] * N
    b_self = [0] * N
    a_guess = [0] * N
    b_guess = [0] * N
    a_guess[1] = 1  # 질문 2: A만 틀림
    a_guess[3] = 1  # 질문 4: 둘 다 틀림
    b_guess[3] = 1
    result = read_tarot(person("A", a_self, a_guess), person("B", b_self, b_guess))
    assert result["focus"] == [questions[3]["category"], questions[1]["category"]]


def test_names_are_trimmed_and_unsafe_names_fall_back():
    picks = [0] * N
    result = read_tarot(person("  아주아주아주긴별명입니다  ", picks, picks), person("씨발", picks, picks))
    assert result["names"]["a"] == "아주아주아주긴별"  # 8글자까지
    assert result["names"]["b"] == "B"
    empty = read_tarot(person("", picks, picks), {"self": picks, "guess": picks})
    assert empty["names"] == {"a": "A", "b": "B"}


@pytest.mark.parametrize(
    "bad",
    [
        {"self": [0] * (N - 1), "guess": [0] * N},  # 답 개수 부족
        {"self": [0] * N, "guess": [9] + [0] * (N - 1)},  # 없는 보기 번호
        {"self": [-1] + [0] * (N - 1), "guess": [0] * N},
        {"self": [True] + [0] * (N - 1), "guess": [0] * N},  # True는 숫자로 치지 않음
        {"self": ["0"] + [0] * (N - 1), "guess": [0] * N},
        {"self": None, "guess": [0] * N},
        "답",
    ],
)
def test_bad_answers_are_rejected(bad):
    ok = person("B", [0] * N, [0] * N)
    with pytest.raises(TarotInputError):
        read_tarot(bad, ok)


# ---- 11/27: draw → retrieve(RAG) → interpret ----

from app.tarot_rag import load_cards, retrieve, score_tip  # noqa: E402

BANNED = ["헤어", "이별", "절대", "끝날", "맞지 않는 사이", "불행"]


def mixed_pair():
    """연락·미래 질문에서 서로 틀리는 두 사람"""
    q = [x["category"] for x in load_questions()]
    a_self, b_self = [0] * N, [0] * N
    a_guess, b_guess = [0] * N, [0] * N
    a_guess[q.index("future")] = 1
    b_guess[q.index("future")] = 1
    a_guess[q.index("contact")] = 1
    return person("민지", a_self, a_guess), person("준호", b_self, b_guess)


def test_graph_order_after_compare():
    edges = {(e.source, e.target) for e in build_graph().get_graph().edges}
    assert {("compare", "draw"), ("draw", "retrieve"), ("retrieve", "interpret"), ("interpret", "guard")} <= edges


def test_draws_three_different_cards_in_positions():
    a, b = mixed_pair()
    result = read_tarot(a, b, seed="demo")
    cards = result["cards"]
    assert [c["position"] for c in cards] == ["past", "present", "next"]
    assert [c["positionName"] for c in cards] == ["지나온 우리", "지금의 우리", "우리의 다음 데이트"]
    assert len({c["id"] for c in cards}) == 3
    known = {c["id"]: c for c in load_cards()}
    for c in cards:
        src = known[c["id"]]
        assert c["meaning"] == (src["reversed"] if c["reversed"] else src["upright"])
        assert c["reading"].startswith(c["meaning"]) and c["advice"] in c["reading"]


def test_same_seed_same_result_and_seed_is_returned():
    a, b = mixed_pair()
    first = read_tarot(a, b, seed="again")
    second = read_tarot(a, b, seed="again")
    assert first["cards"] == second["cards"] and first["talk"] == second["talk"]
    assert first["seed"] == "again"
    auto = read_tarot(a, b)
    assert auto["seed"]  # seed를 안 보내면 서버가 만들어서 돌려줌
    seen = {tuple(c["id"] for c in read_tarot(a, b, seed=str(s))["cards"]) for s in range(8)}
    assert len(seen) > 1  # seed가 다르면 카드가 바뀜


def test_rag_prefers_categories_the_couple_missed():
    # focus 1등(future)의 '몰랐던 점' 조언이 같은 카드의 다른 조언보다 점수가 높음
    card = next(c for c in load_cards() if c["id"] == "fool")  # tags: date_style, travel
    from app.tarot_rag import load_tips

    tips = {t["id"]: t for t in load_tips()}
    focus = ["future"]
    assert score_tip(tips["future_1"], card, focus)[0] > score_tip(tips["future_2"], card, focus)[0]
    assert score_tip(tips["future_1"], card, focus)[0] > score_tip(tips["food_3"], card, focus)[0]
    # 첫 카드의 근거는 focus 1등 카테고리
    [first, *_] = retrieve([{"id": "fool", "position": "past", "reversed": False}], focus)
    assert first["tip"]["category"] == "future"
    assert any(w.startswith("focus:future") for w in first["why"])


def test_rag_uses_different_tips_for_each_card():
    drawn = [{"id": i, "position": p, "reversed": False} for i, p in zip(["fool", "lovers", "star"], ["past", "present", "next"])]
    ev = retrieve(drawn, ["contact"])
    assert len({e["tip"]["id"] for e in ev}) == 3
    assert len({e["tip"]["category"] for e in ev}) == 3


def test_summary_and_talk_cards():
    a, b = mixed_pair()
    result = read_tarot(a, b, seed="talk")
    assert result["focus"][0] == "future"
    assert "민지님과 준호님" in result["summary"] and f"{result['match']}%" in result["summary"]
    assert "함께 하고 싶은 일" in result["summary"]  # focus 1등 카테고리 이름
    assert 1 <= len(result["summary"]) <= 1000  # saveTarotReading 규칙
    assert len(result["talk"]) == 3  # 카테고리 질문 2개 + 커플노트 보너스 1개
    assert result["talk"][2]["theme"] in {"첫 만남 · 추억", "버킷리스트", "밸런스 게임"}
    assert result["talk"][0]["category"] == "future"
    assert [e["tipId"] for e in result["evidence"]] == [c["evidence"] for c in result["cards"]]


def test_reading_text_has_no_banned_words():
    a, b = mixed_pair()
    for s in range(30):
        result = read_tarot(a, b, seed=f"guard{s}")
        texts = [result["summary"]] + [c["reading"] for c in result["cards"]] + [t["text"] for t in result["talk"]]
        for text in texts:
            assert not any(w in text for w in BANNED), text


# ---- POST /tarot (화면에서 부르는 API) ----

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

api = TestClient(app)


def test_tarot_api_returns_cards():
    a, b = mixed_pair()
    res = api.post("/tarot", json={"a": a, "b": b, "seed": "api"})
    assert res.status_code == 200
    body = res.json()
    assert body["seed"] == "api" and len(body["cards"]) == 3 and body["summary"]
    assert body == read_tarot(a, b, seed="api")


def test_tarot_api_rejects_bad_answers():
    ok = person("B", [0] * N, [0] * N)
    res = api.post("/tarot", json={"a": person("A", [0] * 3, [0] * 3), "b": ok})
    assert res.status_code == 422
    res = api.post("/tarot", json={"a": person("A", [7] * N, [0] * N), "b": ok})
    assert res.status_code == 422


# ---- 11/28: guard 재시도 루프 + fallback + mission ----

import app.tarot as tarot_mod  # noqa: E402
import app.tarot_rag as rag_mod  # noqa: E402
from app.places import place_by_id  # noqa: E402
from app.safety import check_reading  # noqa: E402


def test_check_reading_catches_deterministic_words():
    assert check_reading("두 사람은 곧 헤어 질 거예요")  # 띄어쓰기를 바꿔도
    assert check_reading("절대 바뀌지 않아요")
    assert check_reading("운명이 아니에요")
    assert check_reading("끝까지 함께 달려요") == []  # '끝까지'는 괜찮음
    assert check_reading("오늘은 천천히 걸어요") == []


def test_graph_has_guard_loop_and_branches():
    edges = {(e.source, e.target) for e in build_graph().get_graph().edges}
    assert {("guard", "interpret"), ("guard", "mission"), ("guard", "fallback"), ("fallback", "mission"), ("mission", "plan_course"), ("plan_course", "__end__")} <= edges


def test_clean_reading_passes_guard_first_time():
    a, b = mixed_pair()
    result = read_tarot(a, b, seed="clean")
    assert result["retries"] == 0
    assert result["guard"]["fallback"] is False
    assert result["guard"]["log"] == [{"try": 0, "problems": []}]


def poison_tips(monkeypatch, ids):
    """지정한 조언에 금지어를 넣은 데이터로 바꿈 (guard가 잡는지 보려고)"""
    original = rag_mod.load_tips()
    poisoned = [{**t, "text": t["text"] + " 결국 이별하게 돼요."} if t["id"] in ids else t for t in original]
    monkeypatch.setattr(rag_mod, "load_tips", lambda: poisoned)


def test_guard_retries_with_next_candidate(monkeypatch):
    a, b = mixed_pair()
    clean = read_tarot(a, b, seed="loop")
    bad_id = clean["cards"][0]["evidence"]
    poison_tips(monkeypatch, {bad_id})
    result = read_tarot(a, b, seed="loop")
    assert result["retries"] == 1
    assert result["guard"]["log"][0]["problems"][0]["part"] == f"advice:{bad_id}"
    assert result["guard"]["log"][-1]["problems"] == []
    assert result["cards"][0]["evidence"] != bad_id
    assert result["cards"][0]["id"] == clean["cards"][0]["id"]  # 카드는 그대로, 조언만 바뀜
    assert not any(check_reading(c["reading"]) for c in result["cards"])


def test_guard_falls_back_after_two_retries(monkeypatch):
    a, b = mixed_pair()
    poison_tips(monkeypatch, {t["id"] for t in rag_mod.load_tips()})  # 모든 조언이 걸림
    monkeypatch.setattr(tarot_mod, "SAFE_ADVICE", "결국 이별해요.")  # 기본 조언까지 걸리게
    result = read_tarot(a, b, seed="fallback")
    assert result["retries"] == 3  # 처음 + 다시 2번 → 3번째 걸림에서 멈춤
    assert len(result["guard"]["log"]) == 3
    assert result["guard"]["fallback"] is True
    assert result["mission"]["placeId"]  # fallback 뒤에도 미션까지 감


def test_mission_follows_next_date_card():
    a, b = mixed_pair()
    places = place_by_id()
    for s in range(10):
        result = read_tarot(a, b, seed=f"m{s}")
        m = result["mission"]
        card = next(c for c in load_cards() if c["id"] == result["cards"][-1]["id"])
        assert m["cardId"] == card["id"]
        assert m["placeId"] == card["mission"]["placeId"]
        assert m["text"] == card["mission"]["text"]
        assert places[m["placeId"]]["zone"] == "BK" and m["zone"] == "BK"
        assert m["name"] and m["zoneName"] and len(m["position"]) >= 2


# ---- 타로 → 오늘의 데이트 코스 (루미 코스 그래프 재사용) ----

from app import course as course_graph  # noqa: E402


def test_course_graph_can_be_limited_to_one_zone_with_a_must_place():
    result = course_graph._GRAPH.invoke({
        "message": "사진 벽화 카페", "count": 3, "rules_only": True,
        "zones": ["BK"], "must": [{"id": "spot_bk_claw", "reason": "꼭"}], "start_xz": (49.5, 9.0),
    })
    ids = [c["placeId"] for c in result["course"]]
    assert len(ids) == 3 and len(set(ids)) == 3
    assert "spot_bk_claw" in ids
    assert all(c["zone"] == "BK" for c in result["course"])
    assert result["course"][-1]["type"] == "cafe"  # 쿠폰 쓸 카페는 마지막 (원래 규칙 그대로)


def test_normal_lumi_course_is_unchanged_without_options():
    # zones·must를 안 주면 예전처럼 여러 구역에서 고름
    result = course_graph.recommend_course("애니 좋아하고 카페도 가고 싶어", rules_only=True)
    assert {c["zone"] for c in result["course"]} - {"BK"}


def test_tarot_plans_three_stop_date_course_with_mission():
    places = place_by_id()
    for s in range(15):
        a, b = mixed_pair()
        result = read_tarot(a, b, seed=f"c{s}")
        course = result["course"]
        ids = [c["placeId"] for c in course]
        assert len(ids) == 3 and len(set(ids)) == 3
        assert all(places[i]["zone"] == "BK" for i in ids)
        assert result["mission"]["placeId"] in ids
        assert [c["mission"] for c in course].count(True) == 1
        mission_stop = next(c for c in course if c["mission"])
        assert result["mission"]["text"] in mission_stop["reason"]
        for c in course:
            assert c["name"] and c["reason"] and len(c["position"]) == 3
            assert not check_reading(c["reason"]), c["reason"]


def test_course_reasons_come_from_tarot_result():
    a, b = mixed_pair()  # 미래·연락을 서로 몰랐던 두 사람
    result = read_tarot(a, b, seed="reason")
    others = [c["reason"] for c in result["course"] if not c["mission"]]
    assert any("서로 몰랐던" in r or "카드(" in r for r in others), others
