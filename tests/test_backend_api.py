from fastapi.testclient import TestClient

import backend.server as server
from backend.server import app, db, oauth_states, session_store


client = TestClient(app)


def setup_function():
    server.ENABLE_MOCK_GITHUB_AUTH = True
    server.GITHUB_CLIENT_ID = ""
    server.GITHUB_CLIENT_SECRET = ""
    server.ZAI_API_KEY = ""
    client.cookies.clear()
    reports = getattr(db, "reports", None)
    if hasattr(reports, "items"):
        reports.items.clear()
    oauth_states.clear()
    session_store.clear()


def login_mock_user():
    response = client.get("/api/auth/github", follow_redirects=False)
    assert response.status_code == 307
    callback_url = response.headers["location"]

    response = client.get(callback_url, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://127.0.0.1:3000/"


def test_auth_endpoints():
    login_mock_user()

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["login"] == "devuser"

    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json()["success"] is True

    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_repo_and_webhook_endpoints():
    login_mock_user()

    response = client.get("/api/repos")
    assert response.status_code == 200
    repos = response.json()
    assert len(repos) >= 6
    assert repos[0]["full_name"] == "devuser/payment-service"

    response = client.post("/api/repos/devuser/payment-service/webhook")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["webhook_url"] == "/webhook/devuser/payment-service"


def test_analysis_report_and_stats_flow():
    login_mock_user()

    response = client.post(
        "/api/analysis/run",
        json={
            "repo_full_name": "devuser/payment-service",
            "repo_name": "payment-service",
            "branch": "main",
            "commit_sha": "abc1234",
        },
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    response = client.get("/api/reports")
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) == 1
    assert reports[0]["id"] == run_id

    response = client.get(f"/api/reports/{run_id}")
    assert response.status_code == 200
    report = response.json()
    assert report["status"] in {"passed", "warnings", "failed"}
    assert len(report["results"]) == 6
    assert report["engineer_summary"]
    assert len(report["findings"]) >= 1
    assert len(report["suggested_fixes"]) >= 1
    assert len(report["custom_tests"]) >= 1
    assert report["pr_draft"]["branch_name"].startswith("ai/")
    assert report["pr_draft"]["can_create"] is True
    assert "AI Test Lab Report" in report["pr_comment"]
    assert any("Analysis complete" in entry for entry in report["log_messages"])

    response = client.get("/api/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_runs"] == 1
    assert stats["running"] == 0


def test_mock_pull_request_creation_flow():
    login_mock_user()

    response = client.post(
        "/api/analysis/run",
        json={
            "repo_full_name": "devuser/payment-service",
            "repo_name": "payment-service",
            "branch": "main",
            "commit_sha": "abc1234",
        },
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    response = client.post(f"/api/reports/{run_id}/pull-request")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["status"] == "draft_opened"
    assert payload["url"].startswith("https://github.com/devuser/payment-service/pull/")

    response = client.get(f"/api/reports/{run_id}")
    assert response.status_code == 200
    report = response.json()
    assert report["pr_draft"]["created"] is True
    assert report["pr_draft"]["status"] == "draft_opened"
    assert report["pr_draft"]["url"] == payload["url"]


def test_arbitrary_repo_can_become_pr_ready_with_model_generated_fix(monkeypatch):
    login_mock_user()

    async def fake_model_pack(repo_full_name, repo_name, branch, files, findings):
        assert repo_full_name == "devuser/custom-api"
        assert repo_name == "custom-api"
        assert branch == "main"
        assert files[0]["path"] == "src/handler.py"
        return {
            "engineer_summary": "Model generated a concrete patch for the custom repository.",
            "suggested_fixes": [
                {
                    "file_path": "src/handler.py",
                    "title": "Replace unsafe eval with a constrained parser",
                    "summary": "Reject arbitrary execution and parse only numeric values.",
                    "explanation": "The model fix removes dynamic execution while keeping the handler interface intact.",
                    "language": "python",
                    "updated_code": (
                        "def parse_number(raw_value):\n"
                        "    return int(raw_value)\n\n"
                        "def handle(raw_value):\n"
                        "    return parse_number(raw_value)\n"
                    ),
                    "patch": "--- a/src/handler.py\n+++ b/src/handler.py",
                }
            ],
            "custom_tests": [
                {
                    "file_path": "tests/test_handler.py",
                    "title": "Regression coverage for handler parsing",
                    "framework": "pytest",
                    "purpose": "Ensures only numeric input is accepted.",
                    "command": "pytest tests/test_handler.py",
                    "code": (
                        "import pytest\n"
                        "from src.handler import handle\n\n"
                        "def test_handle_parses_integer_values():\n"
                        "    assert handle('7') == 7\n"
                    ),
                }
            ],
        }

    monkeypatch.setattr(server, "generate_model_backed_engineer_pack", fake_model_pack)

    response = client.post(
        "/api/analysis/run",
        json={
            "repo_full_name": "devuser/custom-api",
            "repo_name": "custom-api",
            "branch": "main",
            "commit_sha": "feed123",
            "code_snippet": (
                "# ---- FILE: src/handler.py ----\n"
                "def handle(raw_value):\n"
                "    return eval(raw_value)\n"
            ),
        },
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    response = client.get(f"/api/reports/{run_id}")
    assert response.status_code == 200
    report = response.json()
    assert report["engineer_summary"] == "Model generated a concrete patch for the custom repository."
    assert report["pr_draft"]["can_create"] is True
    assert report["pr_draft"]["status"] == "ready"
    assert report["suggested_fixes"][0]["file_path"] == "src/handler.py"
    assert report["custom_tests"][0]["file_path"] == "tests/test_handler.py"

    response = client.post(f"/api/reports/{run_id}/pull-request")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["status"] == "draft_opened"
    assert payload["url"].startswith("https://github.com/devuser/custom-api/pull/")


def test_report_chat_can_explain_and_update_fix_pack(monkeypatch):
    login_mock_user()

    response = client.post(
        "/api/analysis/run",
        json={
            "repo_full_name": "devuser/custom-api",
            "repo_name": "custom-api",
            "branch": "main",
            "commit_sha": "chat123",
            "code_snippet": (
                "# ---- FILE: src/handler.py ----\n"
                "def handle(raw_value):\n"
                "    return eval(raw_value)\n"
            ),
        },
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    async def fake_chat_response(report, files, message, chat_history):
        assert report["id"] == run_id
        assert message == "Modify the patch to remove eval and add tests."
        assert isinstance(files, list)
        assert chat_history == []
        return {
            "reply": "I replaced eval with integer parsing and expanded the regression tests.",
            "apply_changes": True,
            "engineer_summary": "AI chat converted the preview into a concrete safe patch.",
            "suggested_fixes": [
                {
                    "file_path": "src/handler.py",
                    "title": "Replace eval with explicit parsing",
                    "summary": "Parse integers directly instead of executing arbitrary strings.",
                    "explanation": "This removes remote code execution risk while preserving numeric behavior.",
                    "language": "python",
                    "updated_code": (
                        "def parse_number(raw_value):\n"
                        "    return int(raw_value)\n\n"
                        "def handle(raw_value):\n"
                        "    return parse_number(raw_value)\n"
                    ),
                    "patch": "--- a/src/handler.py\n+++ b/src/handler.py",
                }
            ],
            "custom_tests": [
                {
                    "file_path": "tests/test_handler.py",
                    "title": "Regression tests for parser-based handler",
                    "framework": "pytest",
                    "purpose": "Checks the handler parses safe numeric input.",
                    "command": "pytest tests/test_handler.py",
                    "code": (
                        "from src.handler import handle\n\n"
                        "def test_handle_parses_number_strings():\n"
                        "    assert handle('9') == 9\n"
                    ),
                }
            ],
            "pr_title": "fix: remove eval from handler",
            "pr_body": "Updated by AI chat.",
        }

    monkeypatch.setattr(server, "generate_report_chat_response", fake_chat_response)

    response = client.post(
        f"/api/reports/{run_id}/chat",
        json={"message": "Modify the patch to remove eval and add tests."},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["reply"] == "I replaced eval with integer parsing and expanded the regression tests."

    report = payload["report"]
    assert report["engineer_summary"] == "AI chat converted the preview into a concrete safe patch."
    assert report["pr_draft"]["can_create"] is True
    assert report["pr_draft"]["title"] == "fix: remove eval from handler"
    assert report["pr_draft"]["body"] == "Updated by AI chat."
    assert report["suggested_fixes"][0]["file_path"] == "src/handler.py"
    assert report["custom_tests"][0]["file_path"] == "tests/test_handler.py"
    assert report["chat_history"][0]["role"] == "user"
    assert report["chat_history"][1]["role"] == "assistant"
