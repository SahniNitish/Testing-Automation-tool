# AI Testing Tool

## Local app

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8000`

## Backend setup

```bash
cd backend
cp .env.example .env
```

Fill in these GitHub OAuth values in `backend/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL=http://127.0.0.1:8000/api/auth/github/callback`
- `FRONTEND_URL=http://127.0.0.1:3000`
- `CORS_ORIGINS=http://127.0.0.1:3000`
- `ENABLE_MOCK_GITHUB_AUTH=false`

## GitHub OAuth app

Create a GitHub OAuth app with:

- Homepage URL: `http://127.0.0.1:3000`
- Authorization callback URL: `http://127.0.0.1:8000/api/auth/github/callback`

## Run locally

Backend:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python backend/server.py
```

Frontend:

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://127.0.0.1:8000 yarn start
```

## Notes

- If GitHub OAuth credentials are missing, the backend falls back to a mock login flow for local testing.
- You can force the mock flow even with credentials present by setting `ENABLE_MOCK_GITHUB_AUTH=true`.
- Repository loading uses the authenticated GitHub user when OAuth is configured.
