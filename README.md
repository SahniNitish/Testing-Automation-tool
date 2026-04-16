# AI Test Lab

AI Test Lab is a web application that connects to GitHub, analyzes a repository with AI, explains the detected problems, suggests code fixes, generates custom regression tests, and prepares a draft pull request preview.

This project was built as a practical software engineering tool, but it can also be demonstrated as an academic project because it shows:

- full-stack web development
- GitHub API integration
- AI-assisted code analysis
- automated test generation
- pull request workflow support

## Project Goal

The goal of the project is to make code review easier and faster.

Instead of only showing static analysis results, the system tries to answer these questions:

- What is wrong in the code?
- Where is the problem located?
- How should it be fixed?
- What tests should be added?
- Can this be packaged into a draft pull request?

## Main Features

- GitHub login with OAuth
- Repository selection from the authenticated GitHub account
- AI-powered repository analysis
- Multi-angle checks for:
  - unit-test thinking
  - black-box behavior
  - edge cases
  - security review
  - white-box path analysis
  - performance review
- AI engineer summary in plain language
- Findings with severity, location, explanation, and recommendation
- Suggested fix packs with patch previews
- Custom regression test generation
- Draft pull request preview with title and body
- AI chat inside the report so the user can ask:
  - where the bug is
  - why the fix was suggested
  - how to modify the patch
  - how to improve the generated tests

## How The Workflow Works

1. The user signs in with GitHub.
2. The app loads the user repositories.
3. The user selects a repository and starts analysis.
4. The backend fetches source files from GitHub.
5. The AI analysis pipeline produces:
   - test-style review results
   - findings
   - suggested fixes
   - generated tests
   - a draft PR preview
6. The user can then open the report and chat with the AI to:
   - ask where the main problem is
   - request modifications to the proposed fix
   - request stronger custom tests
7. If a safe patch exists, the app can create a draft pull request.

## Tech Stack

### Frontend

- React
- CRACO
- Tailwind CSS
- Axios
- Radix UI components

### Backend

- FastAPI
- Python
- httpx
- Motor / MongoDB support with in-memory fallback
- GitHub REST API
- OpenAI-compatible client against the configured AI provider

## Project Structure

```text
Testing-Automation-tool/
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   └── server.py
├── frontend/
│   ├── package.json
│   └── src/
├── tests/
├── backend_test.py
└── README.md
```

## Important Screens In The App

- Login page
  - GitHub sign-in
  - high-level project positioning
- Dashboard
  - repository selector
  - live analysis runner
  - capability overview
  - run history
- Report modal
  - AI engineer summary
  - findings
  - fix packs
  - custom tests
  - draft PR preview
  - AI chat

## Local Setup

### 1. Backend Environment

Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

Fill in these values in `backend/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL=http://127.0.0.1:8000/api/auth/github/callback`
- `FRONTEND_URL=http://127.0.0.1:3000`
- `CORS_ORIGINS=http://127.0.0.1:3000`
- `ENABLE_MOCK_GITHUB_AUTH=false`

Optional values:

- `ZAI_API_KEY`
- `MONGO_URL`
- `DB_NAME`

### 2. GitHub OAuth App

Create a GitHub OAuth app with:

- Homepage URL: `http://127.0.0.1:3000`
- Authorization callback URL: `http://127.0.0.1:8000/api/auth/github/callback`

### 3. Run The Backend

From the project root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python backend/server.py
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 4. Run The Frontend

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://127.0.0.1:8000 yarn start
```

Frontend URL:

```text
http://127.0.0.1:3000
```

## Testing

### Backend tests

```bash
.venv/bin/pytest tests/test_backend_api.py
```

### Frontend production build

```bash
cd frontend
yarn build
```

## Core Backend API Routes

Authentication:

- `GET /api/auth/github`
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Repositories:

- `GET /api/repos`
- `POST /api/repos/{owner}/{repo}/webhook`

Analysis:

- `POST /api/analysis/run`
- `GET /api/reports`
- `GET /api/reports/{run_id}`
- `GET /api/stats`

AI engineer interaction:

- `POST /api/reports/{run_id}/chat`
- `POST /api/reports/{run_id}/pull-request`

## What Makes This Project Different

Many tools only report problems.

This project goes further by combining:

- analysis
- explanation
- fix generation
- custom test generation
- draft PR preparation
- interactive AI chat for follow-up questions

That makes it closer to an AI-assisted code review workflow than a simple test dashboard.

## Current Limitations

- GitHub sessions are stored in memory, so restarting the backend logs the user out.
- If GitHub OAuth is not configured, the app falls back to a mock login mode.
- If MongoDB is not configured, reports are stored in memory only.
- AI provider rate limits can cause the system to fall back to preview-only behavior.
- Older reports do not automatically update when the AI model becomes available later.
- Draft PR creation only works when the system has a concrete generated patch, not just a review preview.

## Recommended Demo Flow

If you are presenting this project to a professor or evaluator, a simple demo flow is:

1. Open the login page.
2. Sign in with GitHub.
3. Select a repository.
4. Run analysis.
5. Open the latest report.
6. Show:
   - findings
   - generated fix pack
   - generated tests
   - draft PR preview
   - AI chat
7. Ask the AI chat a question such as:
   - "Where is the main problem?"
   - "Why is this fix needed?"
   - "Modify the patch to be safer."

## Summary

AI Test Lab is a full-stack AI-assisted code review platform.

It demonstrates how modern developer tooling can combine GitHub integration, backend APIs, frontend dashboards, AI analysis, patch generation, testing support, and pull request workflows in one system.
