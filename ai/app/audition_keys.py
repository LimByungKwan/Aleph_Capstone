"""키보드 원본 입력 재채점. 화면의 KeyboardRhythm 판정과 같은 규칙."""

from __future__ import annotations

import math

KEYS = ("ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight")
WINDOW = {"perfect": 0.08, "good": 0.18}
POINTS = {"perfect": 100, "good": 60, "miss": 0}


def arrows_for(notes: list[dict]) -> list[str]:
    keys, flip = [], False
    for i, note in enumerate(notes):
        step = note["midi"] - notes[i - 1]["midi"] if i else 0
        if i == 0:
            key = "ArrowLeft"
        elif step >= 3:
            key = "ArrowRight"
        elif step <= -3:
            key = "ArrowLeft"
        elif step > 0:
            key = "ArrowUp"
        elif step < 0:
            key = "ArrowDown"
        else:
            flip = not flip
            key = "ArrowRight" if flip else "ArrowLeft"
        keys.append(key)
    return keys


def judge_hit(dt: float, right_key: bool) -> str | None:
    if abs(dt) > WINDOW["good"]:
        return None
    if not right_key:
        return "miss"
    return "perfect" if abs(dt) <= WINDOW["perfect"] else "good"


def score_of(results: list[str]) -> int:
    # Python의 짝수 반올림 대신 화면의 Math.round와 맞춘다.
    return math.floor(sum(POINTS[r] for r in results) / len(results) + 0.5) if results else 0


def analyze(presses: list[dict], notes: list[dict]) -> dict:
    rows = [
        {"index": i + 1, "target": n["midi"], "key": key, "result": "miss", "dt": None}
        for i, (n, key) in enumerate(zip(notes, arrows_for(notes)))
    ]
    wrong = 0
    for press in sorted(presses, key=lambda p: p["t"]):
        for note, row in zip(notes, rows):
            dt = press["t"] - note["start"]
            if row["dt"] is not None or abs(dt) > WINDOW["good"]:
                continue
            right = press["key"] == row["key"]
            row.update(result=judge_hit(dt, right), dt=dt)
            wrong += not right
            break

    def accuracy(selected):
        return round(100 * sum(r["result"] != "miss" for r in selected) / len(selected), 2) if selected else None

    def mean_ms(values):
        return round(1000 * sum(values) / len(values), 2) if values else None

    errors = [r["dt"] for r in rows if r["dt"] is not None]
    rests = [rows[i] for i in range(1, len(notes)) if notes[i]["start"] > notes[i - 1]["start"] + notes[i - 1]["duration"]]
    combo = maximum = 0
    for row in rows:
        combo = 0 if row["result"] == "miss" else combo + 1
        maximum = max(maximum, combo)
    stats = {
        "directions": {
            key: {
                "count": sum(r["key"] == key for r in rows),
                "accuracy": accuracy([r for r in rows if r["key"] == key]),
                "mean_error_ms": mean_ms([r["dt"] for r in rows if r["key"] == key and r["dt"] is not None]),
            } for key in KEYS
        },
        "mean_error_ms": mean_ms(errors),
        "early_mean_ms": mean_ms([dt for dt in errors if dt < 0]),
        "late_mean_ms": mean_ms([dt for dt in errors if dt > 0]),
        "after_rest_count": len(rests),
        "after_rest_accuracy": accuracy(rests),
        "wrong_direction": wrong,
        "max_combo": maximum,
    }
    return {"mode": "keyboard", "score": score_of([r["result"] for r in rows]), "notes": rows, "stats": stats}
