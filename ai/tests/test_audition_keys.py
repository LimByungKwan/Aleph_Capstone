"""화면과 같은 판정 사례 및 서버 신뢰 경계."""

import json
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.audition as audition
import app.audition_judge as judge
from app.audition_keys import analyze, arrows_for, judge_hit, score_of
from app.audition_pitch import check_melody
from app.main import app

MELODY = json.loads((Path(__file__).parents[2] / "frontend/public/audition/sungray-01.json").read_text(encoding="utf-8"))["notes"]
END = MELODY[-1]["start"] + MELODY[-1]["duration"]
client = TestClient(app)


@pytest.fixture(autouse=True)
def local_melody(monkeypatch):
    monkeypatch.setattr(audition, "load_melody", lambda _: tuple(MELODY))


def presses(notes=MELODY, dt=0):
    return [{"key": key, "t": n["start"] + dt} for n, key in zip(notes, arrows_for(notes))]


def post(inputs=None, song_id="sungray-01"):
    return client.post("/audition/keyboard", json={"songId": song_id, "presses": presses() if inputs is None else inputs})


def test_practice_song_arrows_and_constraints():
    assert arrows_for(MELODY) == [
        "ArrowLeft", "ArrowUp", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowDown",
        "ArrowDown", "ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowDown",
        "ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight", "ArrowUp", "ArrowDown",
        "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowDown", "ArrowUp", "ArrowLeft",
    ]
    assert check_melody(MELODY) == MELODY
    assert 22 <= len(MELODY) <= 28 and 20 <= END <= 22
    assert all(60 <= n["midi"] <= 69 and n["duration"] >= 0.4 for n in MELODY)
    assert 2 <= sum(b["start"] > a["start"] + a["duration"] for a, b in zip(MELODY, MELODY[1:])) <= 3


def test_repeated_pitch_flip_survives_intervening_steps():
    assert arrows_for([{"midi": m} for m in [60, 60, 63, 60, 61, 60, 60, 60]]) == [
        "ArrowLeft", "ArrowRight", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    ]


@pytest.mark.parametrize("dt, expected", [(0, "perfect"), (0.08, "perfect"), (-0.08, "perfect"), (0.080001, "good"), (-0.080001, "good"), (0.18, "good"), (-0.18, "good"), (0.180001, None), (-0.180001, None)])
def test_judgement_boundaries_match_js(dt, expected):
    assert judge_hit(dt, True) == expected
    assert judge_hit(dt, False) == ("miss" if expected else None)
    result = analyze([{"key": "ArrowLeft", "t": dt}], [{"midi": 60, "start": 0, "duration": 1}])
    assert result["notes"][0]["result"] == (expected or "miss")


def test_js_round_half_up_and_empty_score():
    assert score_of(["perfect"] + ["miss"] * 7) == 13
    assert score_of([]) == 0
    assert analyze([], [])["score"] == 0


def test_first_unjudged_note_not_nearest_and_only_once():
    notes = [{"midi": 60, "start": 0, "duration": 0.1}, {"midi": 62, "start": 0.1, "duration": 0.1}]
    result = analyze([{"key": "ArrowUp", "t": 0.09}], notes)
    assert [r["result"] for r in result["notes"]] == ["miss", "miss"]
    assert result["notes"][0]["dt"] == 0.09 and result["notes"][1]["dt"] is None
    result = analyze([{"key": "ArrowLeft", "t": 0.1}, {"key": "ArrowLeft", "t": 0}], notes)
    assert [r["result"] for r in result["notes"]] == ["perfect", "miss"]


def test_correct_keyboard_returns_server_score_and_feedback():
    response = post()
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"songId", "mode", "score", "notes", "feedback", "source"}
    assert body["mode"] == "keyboard" and body["score"] == 100 and body["source"] == "rule"
    assert all(n["result"] == "perfect" and n["dt"] == 0 for n in body["notes"])
    assert not judge.find_problems(body["feedback"], body)


@pytest.mark.parametrize("dt", [-0.12, 0.12])
def test_early_late_and_direction_statistics(dt):
    inputs = presses(dt=dt)
    inputs[0]["key"] = "ArrowRight"
    result = analyze(inputs, MELODY)
    assert result["notes"][0]["result"] == "miss"
    assert result["stats"]["wrong_direction"] == 1
    assert result["stats"]["max_combo"] == len(MELODY) - 1
    assert result["stats"]["mean_error_ms"] == pytest.approx(dt * 1000)
    assert result["stats"]["after_rest_accuracy"] == 100
    left = result["stats"]["directions"]["ArrowLeft"]
    assert left["accuracy"] == 75 and left["mean_error_ms"] == pytest.approx(dt * 1000)
    assert post(inputs).json()["score"] == score_of(["miss"] + ["good"] * (len(MELODY) - 1))


def test_missed_rest_and_unmatched_presses_do_not_invent_timing():
    result = analyze([{"key": "ArrowLeft", "t": -2}], MELODY)
    assert result["score"] == 0 and result["stats"]["mean_error_ms"] is None
    assert result["stats"]["after_rest_accuracy"] == 0
    assert result["stats"]["wrong_direction"] == 0


def test_too_many_inputs_is_422():
    assert post([{"key": "ArrowLeft", "t": 0}] * (len(MELODY) * 4 + 1)).status_code == 422
    assert post([{"key": "ArrowLeft", "t": 0}] * (len(MELODY) * 4)).status_code == 200


@pytest.mark.parametrize("t", [-3.001, END + 3.001, "0", True, None])
def test_invalid_time_is_422(t):
    assert post([{"key": "ArrowLeft", "t": t}]).status_code == 422


@pytest.mark.parametrize("t", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_time_is_422(t):
    # JSON 파서가 받아도 신뢰 경계에서 유한한 숫자만 허용한다.
    response = client.post("/audition/keyboard", content='{"songId":"sungray-01","presses":[{"key":"ArrowLeft","t":' + t + '}]}', headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_time_bounds_inclusive():
    assert post([{"key": "ArrowLeft", "t": -3}, {"key": "ArrowLeft", "t": END + 3}]).status_code == 200


@pytest.mark.parametrize("body", [{}, {"songId": "sungray-01"}, {"songId": 1, "presses": []}, {"songId": "sungray-01", "presses": [{"key": "Space", "t": 0}]}, {"songId": "sungray-01", "presses": [{"key": "ArrowLeft"}]}, {"songId": "sungray-01", "presses": [], "score": 100}])
def test_schema_boundary(body):
    assert client.post("/audition/keyboard", json=body).status_code == 422


def test_invalid_json_is_422():
    assert client.post("/audition/keyboard", content="{", headers={"Content-Type": "application/json"}).status_code == 422


def test_openapi_describes_keyboard_input_without_dangling_refs():
    schema = app.openapi()["paths"]["/audition/keyboard"]["post"]["requestBody"]["content"]["application/json"]["schema"]
    assert schema["required"] == ["songId", "presses"]
    item = schema["properties"]["presses"]["items"]
    assert "$ref" not in item and item["required"] == ["key", "t"]


def test_unknown_song_is_400_before_melody(monkeypatch):
    monkeypatch.setattr(audition, "load_melody", lambda _: pytest.fail("허용 목록 검사 전 호출"))
    assert post(song_id="../../admin").status_code == 400


def test_melody_unavailable_is_503(monkeypatch):
    def down(_):
        raise OSError("offline")
    monkeypatch.setattr(audition, "load_melody", down)
    assert post().status_code == 503


def test_rate_limit_is_429_before_song_lookup():
    assert [post([]).status_code for _ in range(5)] == [200] * 5
    assert post(song_id="missing").status_code == 429


@pytest.mark.parametrize("mode", ["sing", "keyboard"])
def test_graph_routes_to_correct_analysis(monkeypatch, mode):
    seen = []
    result = analyze(presses(), MELODY) if mode == "keyboard" else {"score": 100, "offset": 0, "notes": [{"index": 1, "status": "ok"}]}
    def selected(*_):
        seen.append(mode)
        return result
    def wrong(*_):
        pytest.fail("다른 모드의 분석 호출")
    monkeypatch.setattr(judge, "analyze_pitch", selected if mode == "sing" else wrong)
    monkeypatch.setattr(judge, "analyze_keyboard", selected if mode == "keyboard" else wrong)
    monkeypatch.setattr(judge, "ask_llm", lambda *_: None)
    answer = judge.judge_take(b"", MELODY) if mode == "sing" else judge.judge_keyboard(presses(), MELODY)
    assert seen == [mode] and answer["mode"] == mode


@pytest.mark.parametrize("mode", ["sing", "keyboard"])
def test_rule_personas_are_deterministic_and_differ_by_band(mode):
    lines = []
    for count in [24, 19, 14, 5]:
        result = analyze(presses()[:count], MELODY) if mode == "keyboard" else {
            "mode": "sing", "score": round(100 * count / 24), "offset": 0.4,
            "notes": [{"index": i + 1, "status": "ok" if i < count else "flat"} for i in range(24)],
        }
        feedback = judge.rule_feedback(result)
        assert feedback == judge.rule_feedback(result)
        assert [j["role"] for j in feedback["judges"]] == judge.ROLES
        assert not judge.find_problems(feedback, result)
        lines.append(feedback["judges"][0]["line"])
    assert len(set(lines)) == 4


def test_keyboard_retry_uses_problems_then_accepts(monkeypatch):
    calls = []
    good = judge.rule_feedback(analyze(presses(), MELODY))
    def fake(table, problems):
        calls.append((table, problems))
        return {"judges": [], "tips": []} if len(calls) == 1 else good
    monkeypatch.setattr(judge, "ask_llm", fake)
    result = judge.judge_keyboard(presses(), MELODY)
    assert result["source"] == "llm" and result["score"] == 100
    assert len(calls) == 2 and calls[1][1]
    assert "mean_error_ms" in calls[0][0] and "presses" not in calls[0][0]


@pytest.mark.parametrize("field,value", [("start", math.inf), ("duration", math.nan), ("midi", True)])
def test_nonfinite_or_boolean_melody_is_rejected(field, value):
    with pytest.raises(ValueError):
        check_melody([{**MELODY[0], field: value}])


def test_huge_body_is_413_before_parsing():
    # JSON을 읽기 전에 크기로 막음
    body = '{"songId": "sungray-01", "presses": [' + ",".join(['{"key": "ArrowUp", "t": 1.0}'] * 2000) + "]}"
    res = client.post("/audition/keyboard", content=body, headers={"Content-Type": "application/json"})
    assert res.status_code == 413
