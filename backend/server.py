from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---- Models ----

class UserProfile(BaseModel):
    login: str
    name: str
    avatar_url: str

class RepoInfo(BaseModel):
    id: int
    name: str
    full_name: str
    language: Optional[str] = None
    default_branch: str = "main"
    description: Optional[str] = None

class AnalysisRequest(BaseModel):
    repo_full_name: str
    repo_name: str
    branch: str = "main"
    commit_sha: Optional[str] = None
    code_snippet: Optional[str] = None

class TestResult(BaseModel):
    test_type: str
    status: str  # passed, warning, failed
    summary: str
    details: str

class AnalysisReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    repo_full_name: str
    repo_name: str
    branch: str
    commit_sha: str
    status: str  # running, passed, warnings, failed
    timestamp: str
    results: List[dict] = []
    pr_comment: str = ""
    log_messages: List[str] = []

# ---- Mock Data ----

MOCK_USER = {
    "login": "devuser",
    "name": "Alex Developer",
    "avatar_url": ""
}

MOCK_REPOS = [
    {"id": 1, "name": "payment-service", "full_name": "devuser/payment-service", "language": "Python", "default_branch": "main", "description": "Microservice for payment processing"},
    {"id": 2, "name": "auth-gateway", "full_name": "devuser/auth-gateway", "language": "TypeScript", "default_branch": "main", "description": "Authentication and authorization gateway"},
    {"id": 3, "name": "data-pipeline", "full_name": "devuser/data-pipeline", "language": "Go", "default_branch": "develop", "description": "ETL data processing pipeline"},
    {"id": 4, "name": "web-dashboard", "full_name": "devuser/web-dashboard", "language": "JavaScript", "default_branch": "main", "description": "Admin dashboard frontend"},
    {"id": 5, "name": "ml-inference", "full_name": "devuser/ml-inference", "language": "Python", "default_branch": "main", "description": "ML model inference API"},
    {"id": 6, "name": "config-server", "full_name": "devuser/config-server", "language": "Java", "default_branch": "master", "description": "Centralized config management"},
]

MOCK_CODE_SNIPPETS = {
    "payment-service": """
import stripe
from decimal import Decimal

class PaymentProcessor:
    def __init__(self, api_key):
        self.client = stripe.Stripe(api_key)
        self.retry_count = 3
    
    def process_payment(self, amount, currency, customer_id):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        charge = self.client.charges.create(
            amount=int(amount * 100),
            currency=currency,
            customer=customer_id
        )
        return {"status": charge.status, "id": charge.id}
    
    def refund(self, charge_id, amount=None):
        return self.client.refunds.create(charge=charge_id, amount=amount)
    
    def get_balance(self, customer_id):
        transactions = self.client.balance_transactions.list(limit=100)
        total = sum(t.amount for t in transactions.data)
        return Decimal(total) / 100
""",
    "auth-gateway": """
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}

export function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  };
}
""",
    "data-pipeline": """
package pipeline

import (
    "context"
    "sync"
    "time"
)

type Record struct {
    ID        string
    Data      map[string]interface{}
    Timestamp time.Time
}

type Pipeline struct {
    workers   int
    batchSize int
    buffer    []Record
    mu        sync.Mutex
}

func NewPipeline(workers, batchSize int) *Pipeline {
    return &Pipeline{workers: workers, batchSize: batchSize}
}

func (p *Pipeline) Process(ctx context.Context, records []Record) error {
    ch := make(chan Record, len(records))
    for _, r := range records {
        ch <- r
    }
    close(ch)
    
    var wg sync.WaitGroup
    for i := 0; i < p.workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for record := range ch {
                p.transform(record)
            }
        }()
    }
    wg.Wait()
    return nil
}

func (p *Pipeline) transform(r Record) Record {
    r.Data["processed"] = true
    r.Timestamp = time.Now()
    return r
}
""",
    "default": """
def calculate_metrics(data):
    if not data:
        return {"mean": 0, "median": 0, "std": 0}
    
    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = sorted_data[n // 2] if n % 2 else (sorted_data[n//2 - 1] + sorted_data[n//2]) / 2
    variance = sum((x - mean) ** 2 for x in data) / n
    std = variance ** 0.5
    
    return {"mean": mean, "median": median, "std": std, "count": n}

def filter_outliers(data, threshold=2):
    metrics = calculate_metrics(data)
    return [x for x in data if abs(x - metrics["mean"]) <= threshold * metrics["std"]]

class DataStore:
    def __init__(self):
        self.store = {}
    
    def put(self, key, value):
        self.store[key] = value
    
    def get(self, key):
        return self.store.get(key)
    
    def delete(self, key):
        if key in self.store:
            del self.store[key]
            return True
        return False
    
    def search(self, pattern):
        results = []
        for key in self.store:
            if pattern in key:
                results.append((key, self.store[key]))
        return results
"""
}

# ---- AI Test Prompts ----

TEST_PROMPTS = {
    "unit_tests": "You are a software test engineer. Analyze the provided code and generate unit test cases. For each test: write the test name, describe what it tests, state the expected outcome, and predict PASS or FAIL based on the code logic. End with: X tests | Y pass | Z fail.",
    "black_box": "You are a black-box testing specialist. Without examining internal logic, identify: valid input classes, invalid inputs, boundary values, and expected outputs. For each case: Input -> Expected Output -> PASS/FAIL/WARNING. End with overall assessment.",
    "edge_cases": "You are an adversarial tester. Find every edge case: null inputs, boundary values, integer overflow, empty collections, type mismatches, Unicode, concurrent access. For each: scenario, input, expected behavior, actual behavior (PASS/BUG/UNKNOWN), severity (Critical/High/Medium/Low).",
    "security": "You are a security engineer. Scan for OWASP Top 10 vulnerabilities: injection flaws, broken auth, sensitive data exposure, insecure dependencies, XSS, CSRF. For each finding: SEVERITY (Critical/High/Medium/Low), location, description, and fix. End with security score A-F.",
    "white_box": "You are a structural testing expert. Analyze all code paths, branches, and conditions. List every branch (true/false), flag unreachable code, estimate branch coverage %. End with: Coverage X% | Cyclomatic complexity per function.",
    "performance": "You are a performance engineer. For each function: state time complexity (Big O), space complexity, identify bottlenecks, suggest optimizations. Flag any N+1 queries, memory leaks, or O(n^2) patterns. End with overall performance rating: Excellent/Good/Needs Work/Critical."
}

TEST_TYPE_NAMES = {
    "unit_tests": "Unit Tests",
    "black_box": "Black-Box",
    "edge_cases": "Edge Cases",
    "security": "Security",
    "white_box": "White-Box",
    "performance": "Performance"
}

# ---- Helper Functions ----

async def run_single_test(test_type: str, system_prompt: str, code: str) -> dict:
    """Run a single AI test analysis."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"test-{test_type}-{uuid.uuid4()}",
            system_message=system_prompt
        )
        chat.with_model("anthropic", "claude-4-sonnet-20250514")

        user_msg = UserMessage(text=f"Analyze the following code:\n\n```\n{code}\n```")
        response = await chat.send_message(user_msg)

        # Determine status based on response content
        response_lower = response.lower()
        if any(word in response_lower for word in ["critical", "fail", "vulnerability", "high severity", "score: f", "score: d"]):
            status = "failed"
        elif any(word in response_lower for word in ["warning", "medium", "needs work", "bug", "unknown"]):
            status = "warning"
        else:
            status = "passed"

        # Extract a one-line summary
        lines = response.strip().split('\n')
        summary_line = lines[-1] if lines else "Analysis complete"
        if len(summary_line) > 100:
            summary_line = summary_line[:97] + "..."

        return {
            "test_type": test_type,
            "test_name": TEST_TYPE_NAMES.get(test_type, test_type),
            "status": status,
            "summary": summary_line,
            "details": response
        }
    except Exception as e:
        logger.error(f"AI test {test_type} failed: {e}")
        return {
            "test_type": test_type,
            "test_name": TEST_TYPE_NAMES.get(test_type, test_type),
            "status": "failed",
            "summary": f"Analysis error: {str(e)[:80]}",
            "details": f"Error running {test_type} analysis: {str(e)}"
        }


def generate_pr_comment(report: dict) -> str:
    """Generate a formatted PR comment from the report."""
    overall_status = report.get("status", "unknown")
    emoji_map = {"passed": "✅", "warnings": "⚠️", "failed": "❌"}
    overall_emoji = emoji_map.get(overall_status, "🔄")

    rows = []
    for r in report.get("results", []):
        s = r.get("status", "unknown")
        status_emoji = emoji_map.get(s, "🔄")
        rows.append(f"| {r.get('test_name', r.get('test_type', ''))} | {status_emoji} | {r.get('summary', '')} |")

    table_rows = "\n".join(rows)
    commit_short = report.get("commit_sha", "unknown")[:7]

    return f"""## AI Test Lab Report — {overall_emoji} {overall_status.upper()}
**Repo:** {report.get('repo_full_name', '')} | **Commit:** {commit_short} | **Branch:** {report.get('branch', 'main')}

| Test Type | Status | Summary |
|-----------|--------|---------|
{table_rows}

> Posted by AI Test Lab — AI testing on every push
"""


async def run_analysis_task(run_id: str, repo_full_name: str, repo_name: str, branch: str, code: str):
    """Background task to run all 6 AI tests concurrently."""
    try:
        # Update status to running
        await db.reports.update_one(
            {"id": run_id},
            {"$set": {"status": "running"}, "$push": {"log_messages": "Starting AI analysis..."}}
        )

        # Run all 6 tests concurrently
        tasks = []
        for test_type, prompt in TEST_PROMPTS.items():
            tasks.append(run_single_test(test_type, prompt, code))
            await db.reports.update_one(
                {"id": run_id},
                {"$push": {"log_messages": f"Queuing {TEST_TYPE_NAMES[test_type]} analysis..."}}
            )

        results = await asyncio.gather(*tasks)

        # Determine overall status
        statuses = [r["status"] for r in results]
        if "failed" in statuses:
            overall = "failed"
        elif "warning" in statuses:
            overall = "warnings"
        else:
            overall = "passed"

        report_data = {
            "status": overall,
            "results": results,
        }
        report_data["pr_comment"] = generate_pr_comment({
            **report_data,
            "repo_full_name": repo_full_name,
            "commit_sha": await _get_commit(run_id),
            "branch": branch
        })

        log_msgs = [f"{TEST_TYPE_NAMES[r['test_type']]} — {r['status'].upper()}" for r in results]
        log_msgs.append(f"Analysis complete — Overall: {overall.upper()}")

        await db.reports.update_one(
            {"id": run_id},
            {"$set": report_data, "$push": {"log_messages": {"$each": log_msgs}}}
        )
        logger.info(f"Analysis {run_id} completed: {overall}")
    except Exception as e:
        logger.error(f"Analysis {run_id} error: {e}")
        await db.reports.update_one(
            {"id": run_id},
            {"$set": {"status": "failed"}, "$push": {"log_messages": f"Error: {str(e)}"}}
        )


async def _get_commit(run_id: str) -> str:
    doc = await db.reports.find_one({"id": run_id}, {"_id": 0, "commit_sha": 1})
    return doc.get("commit_sha", "unknown") if doc else "unknown"


# ---- Auth Routes (MOCKED) ----

@api_router.get("/auth/github")
async def github_auth():
    return {"redirect_url": "/api/auth/github/callback?code=mock_code"}

@api_router.get("/auth/github/callback")
async def github_callback(code: str = "mock_code"):
    return {"success": True, "user": MOCK_USER, "token": "mock_token_" + str(uuid.uuid4())[:8]}

@api_router.get("/auth/me")
async def get_me():
    return MOCK_USER

@api_router.post("/auth/logout")
async def logout():
    return {"success": True}

# ---- Repo Routes (MOCKED) ----

@api_router.get("/repos")
async def get_repos():
    return MOCK_REPOS

# ---- Webhook Routes (MOCKED) ----

@api_router.post("/repos/{owner}/{repo}/webhook")
async def setup_webhook(owner: str, repo: str):
    webhook_secret = str(uuid.uuid4())[:16]
    return {
        "success": True,
        "webhook_url": f"/webhook/{owner}/{repo}",
        "secret": webhook_secret,
        "message": f"Webhook configured for {owner}/{repo}"
    }

# ---- Analysis Routes ----

@api_router.post("/analysis/run")
async def run_analysis(req: AnalysisRequest, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())
    commit_sha = req.commit_sha or str(uuid.uuid4())[:7]

    code = req.code_snippet or MOCK_CODE_SNIPPETS.get(req.repo_name, MOCK_CODE_SNIPPETS["default"])

    report = {
        "id": run_id,
        "repo_full_name": req.repo_full_name,
        "repo_name": req.repo_name,
        "branch": req.branch,
        "commit_sha": commit_sha,
        "status": "queued",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": [],
        "pr_comment": "",
        "log_messages": ["Analysis queued..."]
    }
    await db.reports.insert_one({**report})

    background_tasks.add_task(
        run_analysis_task, run_id, req.repo_full_name, req.repo_name, req.branch, code
    )

    return {"run_id": run_id, "status": "queued"}

@api_router.get("/reports")
async def get_reports():
    reports = await db.reports.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return reports

@api_router.get("/reports/{run_id}")
async def get_report(run_id: str):
    report = await db.reports.find_one({"id": run_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@api_router.get("/stats")
async def get_stats():
    total = await db.reports.count_documents({})
    passed = await db.reports.count_documents({"status": "passed"})
    failed = await db.reports.count_documents({"status": "failed"})
    warnings = await db.reports.count_documents({"status": "warnings"})
    running = await db.reports.count_documents({"status": {"$in": ["running", "queued"]}})
    return {
        "total_runs": total,
        "passed": passed,
        "failed": failed,
        "warnings": warnings,
        "running": running
    }

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
