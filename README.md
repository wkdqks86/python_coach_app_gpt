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

## 모바일 배포 (Vercel + Render + Supabase)

학습 기록은 모바일과 PC에서 이어져야 하므로, 배포 환경에서는 SQLite 대신 PostgreSQL을 사용합니다. 로컬에서는 별도 설정 없이 기존 SQLite가 계속 동작합니다.

1. **Supabase**에서 프로젝트를 만든 뒤, `Connect` 화면의 **Session pooler** 연결 문자열을 복사합니다. 이 값은 비밀번호를 포함하므로 GitHub에 올리지 않습니다.
2. **Render**에서 `New → Web Service`를 선택해 이 저장소를 연결합니다. `Root Directory`는 `backend`, Build Command는 `pip install -r requirements.txt`, Start Command는 `uvicorn app.main:app --host 0.0.0.0 --port $PORT`입니다. `render.yaml`을 사용해 Blueprint로 만들어도 됩니다.
3. Render의 Environment Variables에 아래 값을 추가합니다.
   - `DATABASE_URL`: Supabase Session pooler 연결 문자열
   - `CORS_ORIGINS`: Vercel 배포 주소 (예: `https://your-project.vercel.app`)
4. Render의 `/api/health` 주소가 `{"status":"ok"}`를 반환하는지 확인합니다.
5. **Vercel** 프로젝트의 Root Directory를 `frontend`로 설정하고, Environment Variables에 `VITE_API_URL`을 Render 기본 주소로 추가합니다. 예: `https://your-pycoach-api.onrender.com` — 끝에 `/api`를 붙이지 않습니다.
6. Vercel을 재배포한 뒤 모바일에서 학습·실행·채점이 모두 동작하는지 확인합니다.

`frontend/.env.example`, `backend/.env.example`은 설정 이름 예시만 담고 있으며 실제 비밀번호는 넣지 않습니다.

## 현재 MVP

- 레벨 1 개념 카드 3개
- 코드 입력·제한 실행·자동 채점
- 단계형 힌트 및 브라우저 로컬 진도 저장
- FastAPI 기반 콘텐츠/채점 API
- SQLite 기반 간격 복습 큐: 틀림은 1일 뒤, 힌트 사용 정답은 3일 뒤, 자력 정답은 7일 뒤(두 번 연속이면 14일 뒤) 재출제
- 오늘의 학습 엔진: 복습 문제를 먼저 배치하고, 남은 시간에 다음 새 레슨 한 개를 제안하는 짧은 일일 세션
- 오답노트: 최근 오답 코드·실행 결과·기대 결과·힌트 단계·다음 복습일을 기록하고, 힌트 없이 두 번 다시 맞히면 졸업

> 보안: 코드 실행기는 `print()` 및 간단한 리터럴 연산만 허용하며 임의 코드는 실행하지 않습니다.
