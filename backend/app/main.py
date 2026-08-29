from __future__ import annotations

import ast
import io
import re
import sqlite3
from contextlib import redirect_stdout
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PyCoach API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], allow_methods=["*"], allow_headers=["*"])
DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "pycoach.db"

LEGACY_LESSONS = [
    {"id":"hello-print","order":1,"title":"화면에 글자 보여주기","concept":"`print()`는 컴퓨터에게 “이 내용을 화면에 보여줘”라고 말하는 명령입니다.","why":"코드를 실행한 결과를 확인할 때 가장 먼저 쓰는 도구예요.","example":'print("안녕하세요")',"exampleOutput":"안녕하세요","prompt":"화면에 “안녕하세요”를 출력해 보세요.","starterCode":"# 여기에 코드를 작성해 보세요\\n","expectedOutput":"안녕하세요","hints":["화면에 내용을 보여줄 때 쓰는 함수를 떠올려 보세요.","글자는 큰따옴표 또는 작은따옴표로 감쌉니다.",'print("안녕하세요")'],"summary":"print()는 값을 화면에 출력합니다.","estimatedMinutes":8},
    {"id":"my-name","order":2,"title":"내 이름 출력하기","concept":"문자열은 따옴표로 감싼 글자 데이터입니다.","why":"이름, 메시지처럼 컴퓨터가 계산하지 않을 글자를 구분하기 위해 필요해요.","example":'print("피터")',"exampleOutput":"피터","prompt":"본인의 이름을 화면에 출력해 보세요.","starterCode":"# 따옴표 안에 본인의 이름을 넣어 보세요\\n","expectedOutput":"","hints":["이름도 글자 데이터예요.","글자는 따옴표로 감싸야 합니다.",'print("피터")  # 피터 부분을 본인 이름으로 바꿔 보세요'],"summary":"글자를 출력할 때는 따옴표를 사용합니다.","estimatedMinutes":7},
    {"id":"two-lines","order":3,"title":"두 줄 출력하기","concept":"print()를 여러 번 쓰면 각 결과가 새 줄에 표시됩니다.","why":"프로그램의 정보를 읽기 쉬운 형태로 보여줄 수 있어요.","example":'print("파이썬")\\nprint("시작!")',"exampleOutput":"파이썬\\n시작!","prompt":"첫 줄에 “파이썬”, 둘째 줄에 “시작!”을 출력해 보세요.","starterCode":"# print()를 두 번 사용해 보세요\\n","expectedOutput":"파이썬\\n시작!","hints":["한 줄을 출력하는 print()를 두 번 써 보세요.","각 print()의 괄호 안에 한 문장씩 넣습니다.",'print("파이썬")\\nprint("시작!")'],"summary":"print() 하나가 한 줄의 결과를 만듭니다.","estimatedMinutes":8},
]

from .content import LESSONS

class CheckRequest(BaseModel):
    lessonId: str
    code: str
    hintLevel: int = 0


class RunRequest(BaseModel):
    lessonId: str
    code: str


def scaffold_hint(solution: str) -> str:
    """Turn a complete answer into a syntax-preserving, fill-in-the-blank hint."""
    strings = r'(?:[fFrRbBuU]{0,2})?(?:"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    scaffold = re.sub(strings, "________", solution)
    scaffold = re.sub(r"\b\d+(?:\.\d+)?\b", "____", scaffold)
    return "아래 코드 뼈대의 빈칸을 채워 보세요. 구조와 들여쓰기를 먼저 확인해요.\n\n" + scaffold


def lesson_for_client(lesson: dict) -> dict:
    """Keep full answers separate from the progressive hint ladder."""
    client_lesson = dict(lesson)
    hints = list(lesson.get("hints", []))
    if len(hints) >= 3:
        solution = hints[2]
        hints[2] = scaffold_hint(solution)
        client_lesson["solution"] = solution
        client_lesson["solutionExplanation"] = "풀이를 본 뒤에는 각 줄이 맡은 역할을 말로 설명해 보고, 코드를 지운 뒤 다시 직접 작성해 보세요."
    client_lesson["hints"] = hints
    return client_lesson
def database() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute("""CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        code TEXT NOT NULL,
        output TEXT NOT NULL,
        correct INTEGER NOT NULL,
        hint_level INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    attempt_columns = {row[1] for row in connection.execute("PRAGMA table_info(attempts)").fetchall()}
    if "hint_level" not in attempt_columns:
        connection.execute("ALTER TABLE attempts ADD COLUMN hint_level INTEGER NOT NULL DEFAULT 0")
    connection.execute("""CREATE TABLE IF NOT EXISTS lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        next_review_at TEXT NOT NULL,
        review_stage INTEGER NOT NULL DEFAULT 0,
        consecutive_without_hint INTEGER NOT NULL DEFAULT 0,
        last_result TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    connection.execute("""CREATE TABLE IF NOT EXISTS daily_plan_items (
        plan_date TEXT NOT NULL,
        position INTEGER NOT NULL,
        lesson_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        completed_at TEXT,
        PRIMARY KEY (plan_date, position)
    )""")
    return connection
def completed_ids() -> list[str]:
    with database() as connection:
        rows = connection.execute("SELECT DISTINCT lesson_id FROM attempts WHERE correct = 1").fetchall()
    return [row[0] for row in rows]
def due_lessons() -> list[dict]:
    with database() as connection:
        rows = connection.execute(
            "SELECT lesson_id FROM lesson_progress WHERE next_review_at <= ? ORDER BY next_review_at, lesson_id",
            (date.today().isoformat(),),
        ).fetchall()
    due_ids = {row[0] for row in rows}
    return [lesson for lesson in LESSONS if lesson["id"] in due_ids]
def record_attempt(lesson_id: str, code: str, output: str, correct: bool, hint_level: int) -> str:
    with database() as connection:
        previous = connection.execute(
            "SELECT review_stage, consecutive_without_hint FROM lesson_progress WHERE lesson_id = ?",
            (lesson_id,),
        ).fetchone()
        previous_stage, previous_streak = previous if previous else (0, 0)
        if not correct:
            days_until_review, next_stage, streak = 1, 0, 0
        elif hint_level > 0:
            days_until_review, next_stage, streak = 3, max(previous_stage, 1), 0
        else:
            streak = previous_streak + 1
            days_until_review = 14 if streak >= 2 else 7
            next_stage = min(previous_stage + 1, 3)
        next_review_at = (date.today() + timedelta(days=days_until_review)).isoformat()
        connection.execute(
            "INSERT INTO attempts (lesson_id, code, output, correct, hint_level) VALUES (?, ?, ?, ?, ?)",
            (lesson_id, code, output, correct, hint_level),
        )
        connection.execute(
            """INSERT INTO lesson_progress
            (lesson_id, next_review_at, review_stage, consecutive_without_hint, last_result)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(lesson_id) DO UPDATE SET
                next_review_at = excluded.next_review_at,
                review_stage = excluded.review_stage,
                consecutive_without_hint = excluded.consecutive_without_hint,
                last_result = excluded.last_result,
                updated_at = CURRENT_TIMESTAMP""",
            (lesson_id, next_review_at, next_stage, streak, "correct" if correct else "incorrect"),
        )
    return next_review_at
def create_today_plan() -> None:
    today = date.today().isoformat()
    with database() as connection:
        existing = connection.execute(
            "SELECT 1 FROM daily_plan_items WHERE plan_date = ? LIMIT 1", (today,)
        ).fetchone()
    if existing:
        return

    completed = set(completed_ids())
    review_candidates = due_lessons()
    next_new = next((lesson for lesson in LESSONS if lesson["id"] not in completed and lesson not in review_candidates), None)
    selected: list[tuple[dict, str]] = []
    minutes = 0
    for lesson in review_candidates:
        if len(selected) >= 2 or minutes + lesson["estimatedMinutes"] > 18:
            break
        selected.append((lesson, "review"))
        minutes += lesson["estimatedMinutes"]
    if next_new and (not selected or minutes + next_new["estimatedMinutes"] <= 30):
        selected.append((next_new, "new"))

    with database() as connection:
        connection.executemany(
            "INSERT INTO daily_plan_items (plan_date, position, lesson_id, item_type) VALUES (?, ?, ?, ?)",
            [(today, position, lesson["id"], item_type) for position, (lesson, item_type) in enumerate(selected, start=1)],
        )
def today_session() -> dict[str, object]:
    create_today_plan()
    today = date.today().isoformat()
    lesson_by_id = {lesson["id"]: lesson for lesson in LESSONS}
    with database() as connection:
        rows = connection.execute(
            "SELECT lesson_id, item_type, completed_at FROM daily_plan_items WHERE plan_date = ? ORDER BY position",
            (today,),
        ).fetchall()
    items = [
        {**lesson_by_id[lesson_id], "itemType": item_type, "completedToday": completed_at is not None}
        for lesson_id, item_type, completed_at in rows
        if lesson_id in lesson_by_id
    ]
    return {
        "date": today,
        "items": items,
        "estimatedMinutes": sum(item["estimatedMinutes"] for item in items if not item["completedToday"]),
        "reviewCount": sum(item["itemType"] == "review" and not item["completedToday"] for item in items),
        "newCount": sum(item["itemType"] == "new" and not item["completedToday"] for item in items),
    }
def mark_today_item_completed(lesson_id: str) -> None:
    with database() as connection:
        connection.execute(
            "UPDATE daily_plan_items SET completed_at = CURRENT_TIMESTAMP WHERE plan_date = ? AND lesson_id = ?",
            (date.today().isoformat(), lesson_id),
        )
def mistake_lessons() -> list[dict]:
    with database() as connection:
        attempts = connection.execute(
            """SELECT lesson_id, code, output, hint_level, created_at
            FROM attempts WHERE correct = 0 ORDER BY created_at DESC, id DESC"""
        ).fetchall()
        progress_rows = connection.execute(
            "SELECT lesson_id, next_review_at, consecutive_without_hint FROM lesson_progress"
        ).fetchall()
    progress_by_lesson = {
        lesson_id: {"nextReview": next_review_at, "streak": streak}
        for lesson_id, next_review_at, streak in progress_rows
    }
    lesson_by_id = {lesson["id"]: lesson for lesson in LESSONS}
    latest_attempts: dict[str, tuple] = {}
    for attempt in attempts:
        latest_attempts.setdefault(attempt[0], attempt)
    mistakes = []
    for lesson_id, (_, code, output, hint_level, created_at) in latest_attempts.items():
        lesson = lesson_by_id.get(lesson_id)
        state = progress_by_lesson.get(lesson_id)
        if not lesson or not state or state["streak"] >= 2:
            continue
        mistakes.append({
            "lessonId": lesson_id,
            "title": lesson["title"],
            "unit": lesson.get("unit", "복습"),
            "prompt": lesson["prompt"],
            "concept": lesson["concept"],
            "code": code,
            "output": output,
            "expectedOutput": lesson["expectedOutput"],
            "hintLevel": hint_level,
            "nextReview": state["nextReview"],
            "lastAttemptAt": created_at,
        })
    return mistakes
def run_safe_code(code: str, inputs: list[str]) -> str:
    tree = ast.parse(code, mode="exec")
    allowed = (
        ast.Module, ast.Expr, ast.Call, ast.Name, ast.Load, ast.Store, ast.Constant,
        ast.Assign, ast.If, ast.For, ast.FunctionDef, ast.Return, ast.arguments, ast.arg, ast.List, ast.Tuple, ast.Dict, ast.Subscript, ast.BinOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod,
        ast.UnaryOp, ast.UAdd, ast.USub, ast.JoinedStr, ast.FormattedValue,
        ast.Compare, ast.GtE, ast.Gt, ast.LtE, ast.Lt, ast.Eq, ast.NotEq,
    )
    function_names = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    allowed_calls = {"print", "input", "int", "float", "str", "range", "len"} | function_names
    for node in ast.walk(tree):
        if not isinstance(node, allowed):
            raise ValueError("이 레슨에서는 변수, 함수, 리스트·딕셔너리, 반복문, print(), input(), 간단한 계산을 사용해 볼까요?")
        if isinstance(node, ast.Call) and (not isinstance(node.func, ast.Name) or node.func.id not in allowed_calls):
            raise ValueError("이 레슨에서는 배운 내장 함수와 직접 정의한 함수만 호출할 수 있어요.")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise ValueError("특수 기능 대신 배운 문법으로 한 줄씩 작성해 보세요.")

    input_values = iter(inputs)
    def learner_input(_prompt: str = "") -> str:
        try:
            return next(input_values)
        except StopIteration as error:
            raise ValueError("이 문제에 준비된 입력값을 모두 사용했어요.") from error

    output = io.StringIO()
    safe_builtins = {"print": print, "input": learner_input, "int": int, "float": float, "str": str, "range": range, "len": len}
    with redirect_stdout(output):
        exec(compile(tree, "<learner-code>", "exec"), {"__builtins__": safe_builtins})
    return output.getvalue().rstrip("\n")


def execution_error_message(error: Exception) -> str:
    """Return a short, readable error that still resembles Python's feedback."""
    if isinstance(error, SyntaxError):
        line = f"{error.lineno}번째 줄" if error.lineno else "코드"
        detail = error.msg or "invalid syntax"
        return f"SyntaxError: {detail} ({line})"
    if isinstance(error, ValueError):
        return f"실행 제한: {error}"
    return f"{type(error).__name__}: {error or '코드를 실행할 수 없어요.'}"
@app.get("/api/health")
def health() -> dict[str,str]: return {"status":"ok"}
@app.get("/api/lessons")
def list_lessons() -> list[dict]: return [lesson_for_client(lesson) for lesson in LESSONS]
@app.get("/api/progress")
def progress() -> dict[str, object]:
    return {"completedIds": completed_ids(), "dueReviewCount": len(due_lessons()), "mistakeCount": len(mistake_lessons())}
@app.get("/api/reviews/due")
def due_reviews() -> dict[str, list[dict]]:
    return {"lessons": due_lessons()}
@app.get("/api/mistakes")
def mistakes() -> dict[str, list[dict]]:
    return {"mistakes": mistake_lessons()}
@app.get("/api/today")
def today() -> dict[str, object]:
    return today_session()


@app.post("/api/run")
def run_code(request: RunRequest) -> dict[str, object]:
    """Execute code without grading it or changing review/progress data."""
    lesson = next((item for item in LESSONS if item["id"] == request.lessonId), None)
    if not lesson:
        return {"success": False, "output": "", "error": "레슨 정보를 찾지 못했어요."}
    try:
        output = run_safe_code(request.code, lesson.get("inputs", []))
    except Exception as error:
        return {"success": False, "output": "", "error": execution_error_message(error)}
    return {"success": True, "output": output, "error": ""}


@app.post("/api/check")
def check_code(request: CheckRequest) -> dict[str, object]:
    lesson=next((x for x in LESSONS if x["id"]==request.lessonId),None)
    if not lesson:return {"correct":False,"output":"","feedback":"레슨 정보를 찾지 못했어요."}
    try: output=run_safe_code(request.code, lesson.get("inputs", []))
    except Exception as error:
        # Syntax/runtime errors are part of experimenting, not an incorrect answer.
        return {"correct":False,"executionError":True,"output":"","feedback":execution_error_message(error)}
    correct = bool(output.strip()) if lesson.get("checkType") == "non_empty_output" else output == lesson["expectedOutput"]
    feedback = (
        "이름을 잘 출력했어요! 글자는 따옴표로 감싸는 것을 기억해 주세요."
        if correct and lesson.get("checkType") == "non_empty_output"
        else "이름이 출력되지 않았어요. print() 안에 따옴표로 감싼 이름을 넣어 보세요."
        if lesson.get("checkType") == "non_empty_output"
        else "기대한 결과가 정확히 나왔어요. 다음 레슨도 도전해 볼까요?"
        if correct
        else "실행 결과를 문제에서 요구한 문장과 비교해 보세요. 힌트를 한 단계 확인해도 좋아요."
    )
    next_review = record_attempt(lesson["id"], request.code, output, correct, request.hintLevel)
    if correct:
        mark_today_item_completed(lesson["id"])
    return {"correct":correct,"output":output,"feedback":feedback,"nextReview":next_review,"completedIds":completed_ids(),"dueLessons":due_lessons(),"mistakes":mistake_lessons(),"todaySession":today_session()}
