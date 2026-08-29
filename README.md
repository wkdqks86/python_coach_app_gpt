# PyCoach

AI의 도움을 받되 학습자가 스스로 코드를 쓸 수 있도록 설계한 파이썬 코칭 앱 MVP입니다.

## 실행

터미널 두 개에서 실행합니다.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

```powershell
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

## 현재 MVP

- 레벨 1 개념 카드 3개
- 코드 입력·제한 실행·자동 채점
- 단계형 힌트 및 브라우저 로컬 진도 저장
- FastAPI 기반 콘텐츠/채점 API
- SQLite 기반 간격 복습 큐: 틀림은 1일 뒤, 힌트 사용 정답은 3일 뒤, 자력 정답은 7일 뒤(두 번 연속이면 14일 뒤) 재출제
- 오늘의 학습 엔진: 복습 문제를 먼저 배치하고, 남은 시간에 다음 새 레슨 한 개를 제안하는 짧은 일일 세션
- 오답노트: 최근 오답 코드·실행 결과·기대 결과·힌트 단계·다음 복습일을 기록하고, 힌트 없이 두 번 다시 맞히면 졸업

> 보안: 코드 실행기는 `print()` 및 간단한 리터럴 연산만 허용하며 임의 코드는 실행하지 않습니다.
