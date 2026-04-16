from fastapi.testclient import TestClient

from backend.server import app, db, oauth_states, session_store


client = TestClient(app)


def setup_function():
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
    assert "AI Test Lab Report" in report["pr_comment"]
    assert any("Analysis complete" in entry for entry in report["log_messages"])

    response = client.get("/api/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_runs"] == 1
    assert stats["running"] == 0
