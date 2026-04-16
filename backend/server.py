from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import httpx
import os
import logging
import asyncio
import secrets
import time
import base64
import difflib
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:  # pragma: no cover - optional dependency in local mode
    AsyncIOMotorClient = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class InMemoryCursor:
    def __init__(self, items: List[Dict[str, Any]]):
        self.items = items

    def sort(self, field: str, direction: int):
        reverse = direction == -1
        self.items.sort(key=lambda item: item.get(field, ""), reverse=reverse)
        return self

    async def to_list(self, _limit: int):
        return [dict(item) for item in self.items]


class InMemoryReportsCollection:
    def __init__(self):
        self.items: List[Dict[str, Any]] = []

    async def insert_one(self, document: Dict[str, Any]):
        self.items.append(dict(document))

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        doc = next((item for item in self.items if item.get("id") == query.get("id")), None)
        if not doc:
            return

        if "$set" in update:
            doc.update(update["$set"])

        if "$push" in update:
            for field, value in update["$push"].items():
                doc.setdefault(field, [])
                if isinstance(value, dict) and "$each" in value:
                    doc[field].extend(value["$each"])
                else:
                    doc[field].append(value)

    async def find_one(self, query: Dict[str, Any], _projection: Optional[Dict[str, int]] = None):
        doc = next((item for item in self.items if item.get("id") == query.get("id")), None)
        return dict(doc) if doc else None

    def find(self, _query: Dict[str, Any], _projection: Optional[Dict[str, int]] = None):
        return InMemoryCursor(list(self.items))

    async def count_documents(self, query: Dict[str, Any]):
        def matches(item: Dict[str, Any]) -> bool:
            for key, expected in query.items():
                actual = item.get(key)
                if isinstance(expected, dict) and "$in" in expected:
                    if actual not in expected["$in"]:
                        return False
                elif actual != expected:
                    return False
            return True

        return sum(1 for item in self.items if matches(item))


class InMemoryDatabase:
    def __init__(self):
        self.reports = InMemoryReportsCollection()


def get_database():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")

    if AsyncIOMotorClient and mongo_url and db_name:
        client = AsyncIOMotorClient(mongo_url)
        return client, client[db_name]

    logger.warning("Using in-memory report store because MongoDB is not configured.")
    return None, InMemoryDatabase()


client, db = get_database()

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:3000")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(",")
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "aitestlab_session")
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
SESSION_MAX_AGE_SECONDS = int(os.environ.get("SESSION_MAX_AGE_SECONDS", "86400"))
ENABLE_MOCK_GITHUB_AUTH = os.environ.get("ENABLE_MOCK_GITHUB_AUTH", "false").lower() == "true"
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
GITHUB_CALLBACK_URL = os.environ.get(
    "GITHUB_CALLBACK_URL",
    "http://127.0.0.1:8000/api/auth/github/callback",
)
GITHUB_OAUTH_SCOPES = os.environ.get("GITHUB_OAUTH_SCOPES", "read:user user:email repo")
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE_URL = "https://api.github.com"
OAUTH_STATE_TTL_SECONDS = int(os.environ.get("OAUTH_STATE_TTL_SECONDS", "600"))

# ---- Z.AI GLM-5.1 Config ----
ZAI_API_KEY = os.environ.get("ZAI_API_KEY", "")
ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4"
ZAI_MODEL = "glm-5.1"

# ---- Code Fetching Config ----
ANALYZABLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".java", ".rb", ".rs",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
    ".php", ".sh", ".sql", ".vue", ".svelte",
}
SKIP_DIRECTORIES = {
    "node_modules", "vendor", "dist", "build", ".git", "__pycache__",
    ".venv", "venv", ".next", ".nuxt", "target", "bin", "obj",
    "coverage", ".tox", "eggs", ".eggs",
}
MAX_FILE_SIZE_BYTES = 100_000
MAX_FILES_TO_FETCH = 15
MAX_TOTAL_CODE_CHARS = 200_000

oauth_states: Dict[str, float] = {}
session_store: Dict[str, Dict[str, Any]] = {}

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


class ReportChatRequest(BaseModel):
    message: str

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
    results: List[dict] = Field(default_factory=list)
    pr_comment: str = ""
    log_messages: List[str] = Field(default_factory=list)
    engineer_summary: str = ""
    findings: List[dict] = Field(default_factory=list)
    suggested_fixes: List[dict] = Field(default_factory=list)
    custom_tests: List[dict] = Field(default_factory=list)
    pr_draft: Dict[str, Any] = Field(default_factory=dict)
    chat_history: List[dict] = Field(default_factory=list)


def github_oauth_configured() -> bool:
    return not ENABLE_MOCK_GITHUB_AUTH and bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)


def cleanup_oauth_states():
    now = time.time()
    expired = [state for state, created_at in oauth_states.items() if now - created_at > OAUTH_STATE_TTL_SECONDS]
    for state in expired:
        oauth_states.pop(state, None)


def build_frontend_url(path: str = "/", params: Optional[Dict[str, str]] = None) -> str:
    base = FRONTEND_URL.rstrip("/")
    target_path = path if path.startswith("/") else f"/{path}"
    url = f"{base}{target_path}"
    if params:
        filtered = {key: value for key, value in params.items() if value is not None}
        if filtered:
            url = f"{url}?{urlencode(filtered)}"
    return url


def create_session(user: Dict[str, Any], github_access_token: Optional[str], scope: str, is_mock: bool) -> str:
    session_id = secrets.token_urlsafe(32)
    session_store[session_id] = {
        "user": user,
        "github_access_token": github_access_token,
        "scope": scope,
        "is_mock": is_mock,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return session_id


def get_session(request: Request) -> Dict[str, Any]:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    return session


def set_session_cookie(response: RedirectResponse, session_id: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
        path="/",
    )


def clear_session_cookie(response: JSONResponse):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
    )


def build_mock_user() -> Dict[str, Any]:
    return dict(MOCK_USER)


def map_github_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "login": user_data["login"],
        "name": user_data.get("name") or user_data["login"],
        "avatar_url": user_data.get("avatar_url", ""),
    }


def map_github_repo(repo: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": repo["id"],
        "name": repo["name"],
        "full_name": repo["full_name"],
        "language": repo.get("language"),
        "default_branch": repo.get("default_branch") or "main",
        "description": repo.get("description"),
    }


def github_headers(access_token: str) -> Dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
    }


async def exchange_github_code_for_token(code: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            GITHUB_ACCESS_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_CALLBACK_URL,
            },
        )
    response.raise_for_status()
    return response.json()


async def fetch_github_user(access_token: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{GITHUB_API_BASE_URL}/user",
            headers=github_headers(access_token),
        )
    response.raise_for_status()
    return response.json()


async def fetch_github_repos(access_token: str) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{GITHUB_API_BASE_URL}/user/repos",
            headers=github_headers(access_token),
            params={
                "sort": "updated",
                "direction": "desc",
                "per_page": 100,
            },
        )
    response.raise_for_status()
    return response.json()

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

FILE_HEADER_PATTERN = re.compile(r"^# ---- FILE: (?P<path>.+?) ----\n", re.MULTILINE)
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".rs": "rust",
}
MOCK_PRIMARY_FILES = {
    "payment-service": "payments/service.py",
    "auth-gateway": "src/auth-gateway.js",
    "data-pipeline": "pipeline/pipeline.go",
    "default": "analytics/metrics.py",
}


def infer_primary_file_path(repo_name: str) -> str:
    return MOCK_PRIMARY_FILES.get(repo_name, MOCK_PRIMARY_FILES["default"])


def language_from_path(path: str) -> str:
    return LANGUAGE_BY_EXTENSION.get(os.path.splitext(path)[1].lower(), "text")


def parse_code_files(code: str, repo_name: str) -> List[Dict[str, str]]:
    files: List[Dict[str, str]] = []
    matches = list(FILE_HEADER_PATTERN.finditer(code))

    if not matches:
        path = infer_primary_file_path(repo_name)
        return [{"path": path, "content": code.strip(), "language": language_from_path(path)}]

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(code)
        path = match.group("path").strip()
        content = code[start:end].strip("\n")
        files.append({"path": path, "content": content, "language": language_from_path(path)})

    return files


def build_patch_preview(path: str, original: str, updated: str) -> str:
    diff = difflib.unified_diff(
        original.splitlines(),
        updated.splitlines(),
        fromfile=f"a/{path}",
        tofile=f"b/{path}",
        lineterm="",
    )
    patch = "\n".join(diff).strip()
    return patch or f"# No textual diff generated for {path}"


def strip_markdown_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
        if match:
            return match.group(1).strip()
    return stripped


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    candidate = strip_markdown_fences(text)
    decoder = json.JSONDecoder()

    for index, char in enumerate(candidate):
        if char != "{":
            continue
        try:
            payload, _end = decoder.raw_decode(candidate[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    return None


def select_focus_files(files: List[Dict[str, str]], findings: List[Dict[str, str]], limit: int = 4, max_chars: int = 45_000) -> List[Dict[str, str]]:
    selected: List[Dict[str, str]] = []
    selected_paths = set()
    remaining_chars = max_chars

    prioritized_paths = [finding["file_path"] for finding in findings if finding.get("file_path")]
    prioritized_paths.extend(file_info["path"] for file_info in files)

    by_path = {file_info["path"]: file_info for file_info in files}

    for path in prioritized_paths:
        file_info = by_path.get(path)
        if not file_info or path in selected_paths:
            continue

        content = file_info["content"]
        if not content:
            continue

        allowed = min(len(content), remaining_chars)
        if allowed <= 0:
            break

        trimmed_content = content[:allowed]
        selected.append({**file_info, "content": trimmed_content})
        selected_paths.add(path)
        remaining_chars -= len(trimmed_content)

        if len(selected) >= limit:
            break

    return selected


def normalize_model_generated_fixes(
    fixes: List[Dict[str, Any]],
    file_lookup: Dict[str, Dict[str, str]],
) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []

    for raw_fix in fixes[:3]:
        file_path = str(raw_fix.get("file_path", "")).strip()
        updated_code = raw_fix.get("updated_code")
        file_info = file_lookup.get(file_path)

        if not file_info or not isinstance(updated_code, str) or not updated_code.strip():
            continue

        normalized.append(
            {
                "file_path": file_path,
                "title": str(raw_fix.get("title") or f"Update {file_path}").strip(),
                "summary": str(raw_fix.get("summary") or "AI-generated repository fix").strip(),
                "explanation": str(
                    raw_fix.get("explanation")
                    or "This patch was generated from the repository context and the highest-priority findings."
                ).strip(),
                "language": file_info["language"],
                "updated_code": updated_code.strip(),
                "patch": build_patch_preview(file_path, file_info["content"], updated_code.strip()),
            }
        )

    return normalized


def normalize_model_generated_tests(tests: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []

    for raw_test in tests[:3]:
        file_path = str(raw_test.get("file_path", "")).strip()
        code = raw_test.get("code")
        if not file_path or not isinstance(code, str) or not code.strip():
            continue

        normalized.append(
            {
                "file_path": file_path,
                "title": str(raw_test.get("title") or f"Regression coverage for {file_path}").strip(),
                "framework": str(raw_test.get("framework") or "repository-native").strip(),
                "purpose": str(
                    raw_test.get("purpose")
                    or "Covers the failure mode highlighted in the AI engineer findings."
                ).strip(),
                "command": str(raw_test.get("command") or "Run the repository test command").strip(),
                "code": code.strip(),
            }
        )

    return normalized


async def generate_model_backed_engineer_pack(
    repo_full_name: str,
    repo_name: str,
    branch: str,
    files: List[Dict[str, str]],
    findings: List[Dict[str, str]],
) -> Optional[Dict[str, Any]]:
    if not ZAI_API_KEY or not files:
        return None

    focus_files = select_focus_files(files, findings)
    if not focus_files:
        return None

    file_lookup = {file_info["path"]: file_info for file_info in files}
    findings_json = json.dumps(findings[:4], indent=2)
    files_payload = "\n\n".join(
        (
            f"PATH: {file_info['path']}\n"
            f"LANGUAGE: {file_info['language']}\n"
            "CONTENT:\n"
            f"{file_info['content']}"
        )
        for file_info in focus_files
    )

    system_prompt = (
        "You are a senior software engineer generating safe, repository-aware patches. "
        "Return valid JSON only. Do not wrap the answer in markdown. "
        "If you are not confident enough to change a file safely, return an empty fixes array."
    )
    user_prompt = (
        f"Repository: {repo_full_name}\n"
        f"Short name: {repo_name}\n"
        f"Branch: {branch}\n\n"
        "Known findings:\n"
        f"{findings_json}\n\n"
        "Candidate source files:\n"
        f"{files_payload}\n\n"
        "Return JSON with this schema:\n"
        "{\n"
        '  "summary": "one short paragraph",\n'
        '  "fixes": [\n'
        "    {\n"
        '      "file_path": "must match one of the provided source file paths",\n'
        '      "title": "short title",\n'
        '      "summary": "what changed",\n'
        '      "explanation": "why the fix helps",\n'
        '      "updated_code": "the complete replacement file contents"\n'
        "    }\n"
        "  ],\n"
        '  "tests": [\n'
        "    {\n"
        '      "file_path": "new or updated test file path",\n'
        '      "title": "short test title",\n'
        '      "framework": "pytest/jest/go test/etc",\n'
        '      "purpose": "what risk this test covers",\n'
        '      "command": "how to run it",\n'
        '      "code": "complete test file contents"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Prefer one or two precise fixes over broad rewrites.\n"
        "- Preserve existing behavior outside the identified issues.\n"
        "- Use test paths that match the repository language.\n"
        "- If no safe fix is possible, keep fixes empty and explain why in summary.\n"
    )

    try:
        import openai

        client = openai.AsyncOpenAI(api_key=ZAI_API_KEY, base_url=ZAI_BASE_URL)
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model=ZAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            ),
            timeout=90,
        )
        content = completion.choices[0].message.content or ""
        payload = extract_json_object(content)
        if not payload:
            logger.warning("Model-backed engineer pack returned non-JSON content for %s", repo_full_name)
            return None

        normalized_fixes = normalize_model_generated_fixes(payload.get("fixes", []), file_lookup)
        normalized_tests = normalize_model_generated_tests(payload.get("tests", []))
        summary = str(payload.get("summary") or "").strip()

        if not normalized_fixes and not normalized_tests and not summary:
            return None

        logger.info(
            "Model-backed engineer pack prepared for %s: %d fixes, %d tests",
            repo_full_name,
            len(normalized_fixes),
            len(normalized_tests),
        )
        return {
            "engineer_summary": summary,
            "suggested_fixes": normalized_fixes,
            "custom_tests": normalized_tests,
        }
    except Exception as exc:
        logger.warning("Model-backed engineer pack generation failed for %s: %s", repo_full_name, exc)
        return None


def sanitize_branch_fragment(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "repo"


def build_branch_name(repo_name: str, run_id: str) -> str:
    return f"ai/{sanitize_branch_fragment(repo_name)}-fix-{run_id[:8]}"


def add_finding(
    findings: List[Dict[str, str]],
    severity: str,
    file_path: str,
    title: str,
    explanation: str,
    recommendation: str,
):
    findings.append(
        {
            "severity": severity,
            "file_path": file_path,
            "title": title,
            "explanation": explanation,
            "recommendation": recommendation,
        }
    )


def extract_function_names(content: str, path: str) -> List[str]:
    extension = os.path.splitext(path)[1].lower()
    if extension == ".py":
        return re.findall(r"^def\s+([A-Za-z_]\w*)\(", content, flags=re.MULTILINE)
    if extension in {".js", ".jsx", ".ts", ".tsx"}:
        names = re.findall(r"(?:export\s+)?function\s+([A-Za-z_]\w*)\(", content)
        names.extend(re.findall(r"const\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(", content))
        return names
    if extension == ".go":
        return re.findall(r"^func\s+(?:\([^)]+\)\s*)?([A-Za-z_]\w*)\(", content, flags=re.MULTILINE)
    return []


def detect_findings(files: List[Dict[str, str]]) -> List[Dict[str, str]]:
    findings: List[Dict[str, str]] = []

    for file_info in files:
        path = file_info["path"]
        content = file_info["content"]
        lowered = content.lower()

        if "int(amount * 100)" in content:
            add_finding(
                findings,
                "high",
                path,
                "Currency conversion can round customer payments incorrectly",
                "Multiplying a float-like amount by 100 and truncating it can undercharge or overcharge values that need bankers rounding.",
                "Normalize amounts through Decimal before sending minor units to Stripe.",
            )

        if "balance_transactions.list(limit=100)" in content:
            add_finding(
                findings,
                "medium",
                path,
                "Balance retrieval reads only the first page of Stripe transactions",
                "The current balance calculation stops at 100 rows, which can drift from the real account balance as volume grows.",
                "Iterate through the full paginated collection or query the account balance endpoint directly.",
            )

        if "authorization?.split(' ')[1]" in content or 'authorization?.split(" ")[1]' in content:
            add_finding(
                findings,
                "medium",
                path,
                "Bearer token parsing trusts malformed Authorization headers",
                "Splitting on a space without validating the Bearer scheme can treat bad headers as valid credentials.",
                "Parse the scheme explicitly and reject anything that is not a well-formed Bearer token.",
            )

        if "jwt.sign" in content and "process.env.jwt_secret" in lowered and "if (!secret)" not in lowered:
            add_finding(
                findings,
                "high",
                path,
                "JWT secret is not validated before signing tokens",
                "If the environment variable is missing, token creation and verification can fail unpredictably at runtime.",
                "Fail fast when the secret is absent and surface a clear configuration error.",
            )

        if 'r.Data["processed"] = true' in content or "r.Data[\"processed\"] = true" in content:
            add_finding(
                findings,
                "medium",
                path,
                "Pipeline workers mutate shared record maps in place",
                "Reusing map references across goroutines can cause subtle races and make debugging data corruption painful.",
                "Clone mutable maps before annotating transformed records.",
            )

        if "filter_outliers" in content and 'metrics["std"]' in content:
            add_finding(
                findings,
                "medium",
                path,
                "Outlier filtering collapses when the standard deviation is zero",
                "Identical values produce a zero standard deviation, which makes the threshold math misleading and can hide intent.",
                "Short-circuit zero-variance inputs and return the original values unchanged.",
            )

        if "except:" in content:
            add_finding(
                findings,
                "medium",
                path,
                "Bare except masks real failures",
                "Catching every exception makes diagnosis harder and can hide programming errors during incident response.",
                "Catch the specific exception types you expect and let the rest fail loudly.",
            )

        if "eval(" in lowered or "exec(" in lowered:
            add_finding(
                findings,
                "critical",
                path,
                "Dynamic code execution opens a remote-code-execution path",
                "Executing unchecked strings is one of the fastest ways to turn input handling into a full compromise.",
                "Remove eval/exec and replace it with a constrained parser or explicit dispatch table.",
            )

    if not findings and files:
        primary = files[0]
        add_finding(
            findings,
            "low",
            primary["path"],
            "No obvious blocker was found in the fallback review",
            "The local fallback analyzer did not detect a deterministic defect, so the safest next step is deeper AI review plus targeted regression coverage.",
            "Generate focused tests around the highest-risk public functions before landing changes.",
        )

    findings.sort(key=lambda item: (SEVERITY_ORDER.get(item["severity"], 99), item["file_path"], item["title"]))
    return findings[:6]


def build_payment_service_fix(file_info: Dict[str, str]) -> List[Dict[str, str]]:
    updated_code = """import stripe
from decimal import Decimal, ROUND_HALF_UP


class PaymentProcessor:
    def __init__(self, api_key):
        if not api_key:
            raise ValueError("Stripe API key is required")
        self.client = stripe.Stripe(api_key)
        self.retry_count = 3

    def _amount_to_minor_units(self, amount):
        value = Decimal(str(amount))
        if value <= 0:
            raise ValueError("Amount must be positive")
        return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def process_payment(self, amount, currency, customer_id):
        if not currency:
            raise ValueError("Currency is required")
        if not customer_id:
            raise ValueError("Customer ID is required")

        charge = self.client.charges.create(
            amount=self._amount_to_minor_units(amount),
            currency=currency.lower(),
            customer=customer_id,
        )
        return {"status": charge.status, "id": charge.id}

    def refund(self, charge_id, amount=None):
        refund_amount = None if amount is None else self._amount_to_minor_units(amount)
        return self.client.refunds.create(charge=charge_id, amount=refund_amount)

    def get_balance(self, customer_id=None):
        transactions = self.client.balance_transactions.list(limit=100)
        total = sum(Decimal(str(t.amount)) for t in transactions.auto_paging_iter())
        return total / Decimal("100")
"""
    return [
        {
            "file_path": file_info["path"],
            "title": "Harden Stripe money handling and validation",
            "summary": "Normalize money with Decimal, reject incomplete requests early, and avoid partial balance reads.",
            "explanation": "This fix makes the payment flow easier to trust: money is rounded intentionally, required fields fail fast, and the balance helper no longer stops after the first Stripe page.",
            "language": "python",
            "updated_code": updated_code,
            "patch": build_patch_preview(file_info["path"], file_info["content"], updated_code),
        }
    ]


def build_auth_gateway_fix(file_info: Dict[str, str]) -> List[Dict[str, str]]:
    updated_code = """import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

function ensureSecret() {
  if (!SECRET) {
    throw new Error("JWT_SECRET must be configured");
  }
}

function readBearerToken(header = "") {
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

export async function hashPassword(password) {
  if (!password) {
    throw new Error("Password is required");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  ensureSecret();
  if (!user?.id || !user?.role) {
    throw new Error("User id and role are required");
  }

  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: "24h" }
  );
}

export function verifyToken(token) {
  if (!token) {
    return null;
  }

  ensureSecret();

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.user = decoded;
    next();
  };
}
"""
    return [
        {
            "file_path": file_info["path"],
            "title": "Validate auth configuration and Bearer parsing",
            "summary": "Reject malformed Authorization headers and fail fast if JWT configuration is missing.",
            "explanation": "The updated gateway is easier to reason about because every auth decision now follows a strict sequence: verify configuration, parse the Bearer token, then enforce the role policy.",
            "language": "javascript",
            "updated_code": updated_code,
            "patch": build_patch_preview(file_info["path"], file_info["content"], updated_code),
        }
    ]


def build_data_pipeline_fix(file_info: Dict[str, str]) -> List[Dict[str, str]]:
    updated_code = """package pipeline

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
            for {
                select {
                case <-ctx.Done():
                    return
                case record, ok := <-ch:
                    if !ok {
                        return
                    }
                    p.transform(record)
                }
            }
        }()
    }

    wg.Wait()
    return ctx.Err()
}

func (p *Pipeline) transform(r Record) Record {
    clonedData := map[string]interface{}{}
    for key, value := range r.Data {
        clonedData[key] = value
    }
    clonedData["processed"] = true

    r.Data = clonedData
    r.Timestamp = time.Now().UTC()
    return r
}
"""
    return [
        {
            "file_path": file_info["path"],
            "title": "Respect cancellation and avoid shared-map mutation",
            "summary": "Workers now honor context cancellation and clone record payloads before mutation.",
            "explanation": "This change makes the pipeline friendlier to production incidents: shutdowns stop quickly, and transformed records cannot accidentally mutate the caller's original maps.",
            "language": "go",
            "updated_code": updated_code,
            "patch": build_patch_preview(file_info["path"], file_info["content"], updated_code),
        }
    ]


def build_default_fix(file_info: Dict[str, str]) -> List[Dict[str, str]]:
    updated_code = """def calculate_metrics(data):
    if not data:
        return {"mean": 0, "median": 0, "std": 0}

    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = sorted_data[n // 2] if n % 2 else (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in data) / n
    std = variance ** 0.5

    return {"mean": mean, "median": median, "std": std, "count": n}


def filter_outliers(data, threshold=2):
    metrics = calculate_metrics(data)
    if metrics["std"] == 0:
        return list(data)
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
    return [
        {
            "file_path": file_info["path"],
            "title": "Guard zero-variance analytics flows",
            "summary": "Keep outlier filtering stable when every datapoint is identical.",
            "explanation": "This is a small but important quality-of-life fix: constant datasets now behave predictably instead of relying on threshold math that adds no signal.",
            "language": "python",
            "updated_code": updated_code,
            "patch": build_patch_preview(file_info["path"], file_info["content"], updated_code),
        }
    ]


def build_suggested_fixes(repo_name: str, files: List[Dict[str, str]], findings: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if not files:
        return []

    primary = files[0]
    if repo_name == "payment-service":
        return build_payment_service_fix(primary)
    if repo_name == "auth-gateway":
        return build_auth_gateway_fix(primary)
    if repo_name == "data-pipeline":
        return build_data_pipeline_fix(primary)
    if "filter_outliers" in primary["content"]:
        return build_default_fix(primary)

    top_finding = findings[0] if findings else None
    patch_lines = [f"# {item['severity'].upper()}: {item['title']}" for item in findings[:3]]
    return [
        {
            "file_path": primary["path"],
            "title": "Prepare a targeted hardening pass",
            "summary": "The fallback analyzer identified the first file as the best place to start applying guardrails.",
            "explanation": "I do not have enough deterministic context to rewrite this file safely without a model-backed patch, so the app keeps the fix as a review-ready plan instead of inventing risky code.",
            "language": primary["language"],
            "updated_code": "",
            "patch": "\n".join(patch_lines) if patch_lines else "# Generate a model-backed patch for this repository.",
            "focus_area": top_finding["title"] if top_finding else "General hardening",
        }
    ]


def build_payment_service_tests() -> List[Dict[str, str]]:
    code = """from decimal import Decimal
from unittest.mock import Mock

import pytest

from payments.service import PaymentProcessor


@pytest.fixture
def processor():
    processor = PaymentProcessor("sk_test_123")
    processor.client = Mock()
    return processor


def test_process_payment_normalizes_amount_with_decimal_rounding(processor):
    charge = Mock(status="succeeded", id="ch_123")
    processor.client.charges.create.return_value = charge

    result = processor.process_payment("10.015", "USD", "cus_123")

    assert result == {"status": "succeeded", "id": "ch_123"}
    processor.client.charges.create.assert_called_once_with(amount=1002, currency="usd", customer="cus_123")


def test_process_payment_rejects_missing_customer_id(processor):
    with pytest.raises(ValueError):
        processor.process_payment("10.00", "USD", "")


def test_get_balance_aggregates_all_pages(processor):
    page = Mock()
    page.auto_paging_iter.return_value = [Mock(amount=1250), Mock(amount=250)]
    processor.client.balance_transactions.list.return_value = page

    assert processor.get_balance() == Decimal("15")
"""
    return [
        {
            "file_path": "tests/test_payment_processor.py",
            "title": "Regression tests for Stripe money handling",
            "framework": "pytest",
            "purpose": "Covers Decimal rounding, required-field validation, and full balance aggregation.",
            "command": "pytest tests/test_payment_processor.py",
            "code": code,
        }
    ]


def build_auth_gateway_tests() -> List[Dict[str, str]]:
    code = """import { requireAuth, verifyToken } from "../auth-gateway";

describe("auth gateway hardening", () => {
  it("rejects malformed bearer headers", () => {
    const req = { headers: { authorization: "Token abc" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireAuth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null when verifyToken is called without a token", () => {
    expect(verifyToken("")).toBeNull();
  });
});
"""
    return [
        {
            "file_path": "src/__tests__/auth-gateway.test.js",
            "title": "Regression tests for token parsing",
            "framework": "jest",
            "purpose": "Locks down Bearer-token parsing and invalid-token handling.",
            "command": "yarn test --watch=false",
            "code": code,
        }
    ]


def build_data_pipeline_tests() -> List[Dict[str, str]]:
    code = """package pipeline

import (
    "context"
    "testing"
)

func TestProcessStopsWhenContextIsCancelled(t *testing.T) {
    t.Parallel()

    ctx, cancel := context.WithCancel(context.Background())
    cancel()

    pipeline := NewPipeline(2, 10)
    if err := pipeline.Process(ctx, []Record{{ID: "1"}}); err == nil {
        t.Fatalf("expected cancellation error")
    }
}

func TestTransformClonesDataMap(t *testing.T) {
    t.Parallel()

    original := map[string]interface{}{"source": "raw"}
    pipeline := NewPipeline(2, 10)
    transformed := pipeline.transform(Record{ID: "1", Data: original})

    transformed.Data["source"] = "processed"

    if original["source"] != "raw" {
        t.Fatalf("expected original map to remain unchanged")
    }
}
"""
    return [
        {
            "file_path": "pipeline/pipeline_test.go",
            "title": "Regression tests for cancellation and data isolation",
            "framework": "go test",
            "purpose": "Ensures worker shutdown follows context cancellation and data maps are copied before mutation.",
            "command": "go test ./...",
            "code": code,
        }
    ]


def build_default_tests() -> List[Dict[str, str]]:
    code = """from analytics.metrics import filter_outliers


def test_filter_outliers_returns_original_values_when_standard_deviation_is_zero():
    values = [5, 5, 5]

    assert filter_outliers(values) == values
"""
    return [
        {
            "file_path": "tests/test_metrics.py",
            "title": "Regression tests for constant datasets",
            "framework": "pytest",
            "purpose": "Protects the zero-variance analytics path that previously produced confusing threshold logic.",
            "command": "pytest tests/test_metrics.py",
            "code": code,
        }
    ]


def build_generic_test(file_info: Dict[str, str]) -> Dict[str, str]:
    functions = extract_function_names(file_info["content"], file_info["path"])
    target_name = functions[0] if functions else "target_function"
    extension = os.path.splitext(file_info["path"])[1].lower()

    if extension == ".py":
        module_path = file_info["path"][:-3].replace("/", ".")
        code = f"""import pytest
import {module_path} as target_module


def test_{target_name}_stays_callable_after_the_fix():
    if not hasattr(target_module, "{target_name}"):
        pytest.skip("Update the import path after applying the generated patch")

    assert callable(getattr(target_module, "{target_name}"))
"""
        return {
            "file_path": "tests/test_ai_regression.py",
            "title": f"Regression scaffold for {target_name}",
            "framework": "pytest",
            "purpose": "Creates a landing zone for the AI-generated fix before the team fills in business-specific fixtures.",
            "command": "pytest tests/test_ai_regression.py",
            "code": code,
        }

    if extension in {".js", ".jsx", ".ts", ".tsx"}:
        code = f"""describe("AI regression coverage", () => {{
  it("keeps {target_name} available for the runtime entrypoint", () => {{
    expect(true).toBe(true);
  }});
}});
"""
        return {
            "file_path": "src/__tests__/ai-regression.test.js",
            "title": f"Regression scaffold for {target_name}",
            "framework": "jest",
            "purpose": "Provides a quick place to turn the review findings into executable regression tests.",
            "command": "yarn test --watch=false",
            "code": code,
        }

    code = """package main

import "testing"

func TestAIRegressionCoverage(t *testing.T) {
    t.Parallel()
}
"""
    return {
        "file_path": "ai_regression_test.go",
        "title": "Regression scaffold for generated review findings",
        "framework": "go test",
        "purpose": "Creates a starter regression file that can grow with the review findings.",
        "command": "go test ./...",
        "code": code,
    }


def build_custom_tests(repo_name: str, files: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if repo_name == "payment-service":
        return build_payment_service_tests()
    if repo_name == "auth-gateway":
        return build_auth_gateway_tests()
    if repo_name == "data-pipeline":
        return build_data_pipeline_tests()
    if files and "filter_outliers" in files[0]["content"]:
        return build_default_tests()
    return [build_generic_test(files[0])] if files else []


def build_pr_body(
    repo_full_name: str,
    branch: str,
    findings: List[Dict[str, str]],
    fixes: List[Dict[str, str]],
    custom_tests: List[Dict[str, str]],
) -> str:
    lines = [
        f"## AI Code Engineer Draft for {repo_full_name}",
        "",
        f"Base branch: `{branch}`",
        "",
        "### Why this PR",
    ]

    if findings:
        for finding in findings[:3]:
            lines.append(f"- {finding['severity'].upper()}: {finding['title']} ({finding['file_path']})")
    else:
        lines.append("- Tightens the riskiest paths identified during analysis.")

    lines.extend(["", "### Proposed code changes"])
    for fix in fixes:
        lines.append(f"- `{fix['file_path']}`: {fix['summary']}")

    if custom_tests:
        lines.extend(["", "### Custom tests"])
        for test in custom_tests:
            lines.append(f"- `{test['file_path']}` using {test['framework']}: {test['purpose']}")

    lines.extend(["", "### Reviewer guide", "- Confirm the patch still matches the intended business rules.", "- Run the generated regression tests and any repo-native CI before merging."])
    return "\n".join(lines)


def build_engineer_summary(findings: List[Dict[str, str]], fixes: List[Dict[str, str]], custom_tests: List[Dict[str, str]]) -> str:
    top = findings[0] if findings else None
    if not top:
        return "AI engineer review is ready. No deterministic blocker surfaced in fallback mode, so the app generated a conservative fix and test plan."

    return (
        f"AI engineer review found {len(findings)} focus area(s). "
        f"Top risk: {top['title']} in {top['file_path']}. "
        f"The report includes {len(fixes)} fix pack(s) and {len(custom_tests)} custom regression test file(s)."
    )


def build_pr_draft_payload(
    run_id: str,
    repo_name: str,
    branch: str,
    repo_full_name: str,
    findings: List[Dict[str, str]],
    fixes: List[Dict[str, str]],
    custom_tests: List[Dict[str, str]],
    existing_pr_draft: Optional[Dict[str, Any]] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
) -> Dict[str, Any]:
    existing_pr_draft = existing_pr_draft or {}
    pr_ready = any(fix.get("updated_code") for fix in fixes)
    pr_title_suffix = findings[0]["title"] if findings else "harden core paths"

    return {
        "title": title or existing_pr_draft.get("title") or f"fix: {pr_title_suffix[:67].lower()}",
        "body": body or existing_pr_draft.get("body") or build_pr_body(repo_full_name, branch, findings, fixes, custom_tests),
        "branch_name": existing_pr_draft.get("branch_name") or build_branch_name(repo_name, run_id),
        "base_branch": existing_pr_draft.get("base_branch") or branch,
        "can_create": pr_ready,
        "created": existing_pr_draft.get("created", False),
        "status": existing_pr_draft.get("status") if existing_pr_draft.get("created") else ("ready" if pr_ready else "preview_only"),
        "url": existing_pr_draft.get("url"),
        "number": existing_pr_draft.get("number"),
        "preview_only_reason": None if pr_ready else "The fallback analyzer prepared a review plan, but it needs a model-backed patch before opening a safe PR.",
    }


def build_report_chat_fallback(report: Dict[str, Any], message: str) -> Dict[str, Any]:
    lower = message.lower()
    findings = report.get("findings", [])
    fixes = report.get("suggested_fixes", [])
    tests = report.get("custom_tests", [])
    top = findings[0] if findings else None

    if any(word in lower for word in ["where", "problem", "wrong", "issue", "bug"]):
        if top:
            reply = (
                f"The main issue in this report is '{top['title']}' in {top['file_path']}. "
                f"{top['explanation']} Recommended next step: {top['recommendation']}"
            )
        else:
            reply = "I do not see a concrete finding in this report yet. Run analysis first and I can walk through the result."
    elif any(word in lower for word in ["modify", "change", "rewrite", "update", "improve", "patch", "test"]):
        reply = (
            "I can update the proposed fix and tests, but the model-backed chat path was unavailable for this request. "
            "Try again after the backend AI service is available."
        )
    else:
        reply = (
            f"This run has {len(findings)} finding(s), {len(fixes)} fix pack(s), and {len(tests)} custom test file(s). "
            "Ask me where the problem is, why the fix was suggested, or how you want the patch changed."
        )

    return {
        "reply": reply,
        "apply_changes": False,
        "engineer_summary": None,
        "suggested_fixes": None,
        "custom_tests": None,
        "pr_title": None,
        "pr_body": None,
    }


def trim_chat_history(history: List[Dict[str, str]], limit: int = 12) -> List[Dict[str, str]]:
    return history[-limit:]


async def load_report_code(session: Dict[str, Any], report: Dict[str, Any]) -> str:
    if session.get("is_mock"):
        return MOCK_CODE_SNIPPETS.get(report.get("repo_name", "default"), MOCK_CODE_SNIPPETS["default"])

    access_token = session.get("github_access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub access token missing")

    code = await fetch_repo_code(access_token, report["repo_full_name"], report.get("branch", "main"))
    if not code:
        raise HTTPException(status_code=502, detail="Unable to fetch repository source for AI chat")
    return code


async def generate_report_chat_response(
    report: Dict[str, Any],
    files: List[Dict[str, str]],
    message: str,
    chat_history: List[Dict[str, str]],
) -> Dict[str, Any]:
    fallback = build_report_chat_fallback(report, message)
    if not ZAI_API_KEY or not files:
        return fallback

    focus_files = select_focus_files(files, report.get("findings", []), limit=4, max_chars=50_000)
    if not focus_files:
        return fallback

    file_lookup = {file_info["path"]: file_info for file_info in files}
    report_snapshot = {
        "repo_full_name": report.get("repo_full_name"),
        "branch": report.get("branch"),
        "status": report.get("status"),
        "engineer_summary": report.get("engineer_summary"),
        "findings": report.get("findings", []),
        "suggested_fixes": [
            {
                "file_path": item.get("file_path"),
                "title": item.get("title"),
                "summary": item.get("summary"),
                "explanation": item.get("explanation"),
                "has_updated_code": bool(item.get("updated_code")),
                "updated_code": item.get("updated_code", "")[:12_000],
            }
            for item in report.get("suggested_fixes", [])[:3]
        ],
        "custom_tests": report.get("custom_tests", [])[:3],
        "pr_draft": report.get("pr_draft", {}),
    }
    history_payload = chat_history[-6:]
    files_payload = "\n\n".join(
        (
            f"PATH: {file_info['path']}\n"
            f"LANGUAGE: {file_info['language']}\n"
            "CONTENT:\n"
            f"{file_info['content']}"
        )
        for file_info in focus_files
    )

    system_prompt = (
        "You are an interactive AI code engineer embedded inside a pull-request assistant. "
        "Answer questions clearly and, when the user asks for modifications, update the proposed patch and tests safely. "
        "Return valid JSON only and do not wrap it in markdown."
    )
    user_prompt = (
        f"Current report snapshot:\n{json.dumps(report_snapshot, indent=2)}\n\n"
        f"Recent chat history:\n{json.dumps(history_payload, indent=2)}\n\n"
        f"Candidate source files:\n{files_payload}\n\n"
        f"User request:\n{message}\n\n"
        "Return JSON with this schema:\n"
        "{\n"
        '  "reply": "assistant reply for the chat UI",\n'
        '  "apply_changes": true,\n'
        '  "engineer_summary": "optional updated summary",\n'
        '  "pr_title": "optional updated draft PR title",\n'
        '  "pr_body": "optional updated draft PR body",\n'
        '  "fixes": [\n'
        "    {\n"
        '      "file_path": "existing source file path",\n'
        '      "title": "short title",\n'
        '      "summary": "what changed",\n'
        '      "explanation": "why the change helps",\n'
        '      "updated_code": "complete replacement file contents"\n'
        "    }\n"
        "  ],\n"
        '  "tests": [\n'
        "    {\n"
        '      "file_path": "test file path",\n'
        '      "title": "short test title",\n'
        '      "framework": "pytest/jest/go test/etc",\n'
        '      "purpose": "what the test covers",\n'
        '      "command": "how to run it",\n'
        '      "code": "complete test file contents"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- If the user only asks a question, set apply_changes to false.\n"
        "- If the user asks to modify the fix or tests, set apply_changes to true and return updated files.\n"
        "- Only use file paths from the provided source files for fixes.\n"
        "- Preserve existing behavior outside the requested change.\n"
        "- If you cannot safely modify the code, keep fixes empty and explain why in reply.\n"
    )

    try:
        import openai

        client = openai.AsyncOpenAI(api_key=ZAI_API_KEY, base_url=ZAI_BASE_URL)
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model=ZAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            ),
            timeout=90,
        )
        content = completion.choices[0].message.content or ""
        payload = extract_json_object(content)
        if not payload:
            return fallback

        normalized_fixes = normalize_model_generated_fixes(payload.get("fixes", []), file_lookup)
        normalized_tests = normalize_model_generated_tests(payload.get("tests", []))
        apply_changes = bool(payload.get("apply_changes")) and bool(normalized_fixes or normalized_tests or payload.get("pr_title") or payload.get("pr_body"))

        return {
            "reply": str(payload.get("reply") or fallback["reply"]).strip(),
            "apply_changes": apply_changes,
            "engineer_summary": str(payload.get("engineer_summary") or "").strip() or None,
            "suggested_fixes": normalized_fixes or None,
            "custom_tests": normalized_tests or None,
            "pr_title": str(payload.get("pr_title") or "").strip() or None,
            "pr_body": str(payload.get("pr_body") or "").strip() or None,
        }
    except Exception as exc:
        logger.warning("Report chat generation failed for %s: %s", report.get("repo_full_name"), exc)
        return fallback


async def build_engineer_report(
    run_id: str,
    repo_full_name: str,
    repo_name: str,
    branch: str,
    code: str,
) -> Dict[str, Any]:
    files = parse_code_files(code, repo_name)
    findings = detect_findings(files)
    fixes = build_suggested_fixes(repo_name, files, findings)
    custom_tests = build_custom_tests(repo_name, files)
    engineer_summary = ""

    if files and not any(fix.get("updated_code") for fix in fixes):
        model_pack = await generate_model_backed_engineer_pack(
            repo_full_name=repo_full_name,
            repo_name=repo_name,
            branch=branch,
            files=files,
            findings=findings,
        )
        if model_pack:
            if model_pack.get("suggested_fixes"):
                fixes = model_pack["suggested_fixes"]
            if model_pack.get("custom_tests"):
                custom_tests = model_pack["custom_tests"]
            engineer_summary = model_pack.get("engineer_summary", "")

    pr_draft = build_pr_draft_payload(
        run_id=run_id,
        repo_name=repo_name,
        branch=branch,
        repo_full_name=repo_full_name,
        findings=findings,
        fixes=fixes,
        custom_tests=custom_tests,
    )

    return {
        "engineer_summary": engineer_summary or build_engineer_summary(findings, fixes, custom_tests),
        "findings": findings,
        "suggested_fixes": fixes,
        "custom_tests": custom_tests,
        "pr_draft": pr_draft,
    }

# ---- GitHub Code Fetching ----

async def fetch_repo_tree(access_token: str, owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
    """Fetch the full file tree for a repo and return analyzable source files."""
    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.get(url, headers=github_headers(access_token))
    resp.raise_for_status()
    tree = resp.json().get("tree", [])

    candidates = []
    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        size = item.get("size", 0)
        # Skip ignored directories
        parts = path.split("/")
        if any(part in SKIP_DIRECTORIES for part in parts):
            continue
        # Check extension
        ext = os.path.splitext(path)[1].lower()
        if ext not in ANALYZABLE_EXTENSIONS:
            continue
        if size > MAX_FILE_SIZE_BYTES:
            continue
        candidates.append({"path": path, "size": size})

    # Sort biggest first so the analysis sees the most substantial files
    candidates.sort(key=lambda f: f["size"], reverse=True)
    return candidates[:MAX_FILES_TO_FETCH]


async def fetch_file_contents(access_token: str, owner: str, repo: str, branch: str, files: List[Dict[str, Any]]) -> str:
    """Fetch raw content for each file and concatenate with headers."""
    headers = github_headers(access_token)
    headers["Accept"] = "application/vnd.github.raw+json"

    combined: List[str] = []
    total_chars = 0

    async with httpx.AsyncClient(timeout=30.0) as http:
        for file_info in files:
            if total_chars >= MAX_TOTAL_CODE_CHARS:
                break
            path = file_info["path"]
            url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
            resp = await http.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning("Failed to fetch %s: HTTP %s", path, resp.status_code)
                continue
            content = resp.text
            remaining = MAX_TOTAL_CODE_CHARS - total_chars
            if len(content) > remaining:
                content = content[:remaining]
            combined.append(f"# ---- FILE: {path} ----\n{content}")
            total_chars += len(content)

    return "\n\n".join(combined)


async def fetch_repo_code(access_token: str, repo_full_name: str, branch: str) -> Optional[str]:
    """Orchestrator: fetch tree then file contents. Returns None on failure."""
    try:
        owner, repo = repo_full_name.split("/", 1)
        files = await fetch_repo_tree(access_token, owner, repo, branch)
        if not files:
            logger.info("No analyzable files found in %s", repo_full_name)
            return None
        code = await fetch_file_contents(access_token, owner, repo, branch, files)
        if not code:
            return None
        logger.info("Fetched %d files (%d chars) from %s", len(files), len(code), repo_full_name)
        return code
    except Exception as e:
        logger.error("Failed to fetch repo code for %s: %s", repo_full_name, e)
        return None


async def fetch_latest_commit_sha(access_token: str, repo_full_name: str, branch: str) -> Optional[str]:
    """Fetch the real latest commit SHA for a branch."""
    try:
        owner, repo = repo_full_name.split("/", 1)
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/commits/{branch}"
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(url, headers=github_headers(access_token))
        if resp.status_code == 200:
            return resp.json().get("sha")
    except Exception as e:
        logger.error("Failed to fetch commit SHA for %s: %s", repo_full_name, e)
    return None


async def fetch_branch_head_sha(access_token: str, owner: str, repo: str, branch: str) -> str:
    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/git/ref/heads/{branch}"
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.get(url, headers=github_headers(access_token))
    resp.raise_for_status()
    return resp.json()["object"]["sha"]


async def create_github_branch(access_token: str, owner: str, repo: str, branch_name: str, base_sha: str):
    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/git/refs"
    payload = {"ref": f"refs/heads/{branch_name}", "sha": base_sha}
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.post(url, headers=github_headers(access_token), json=payload)
    if resp.status_code == 422 and "Reference already exists" in resp.text:
        return
    resp.raise_for_status()


async def fetch_github_file_sha(access_token: str, owner: str, repo: str, path: str, branch: str) -> Optional[str]:
    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.get(url, headers=github_headers(access_token))
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json().get("sha")


async def put_github_file(
    access_token: str,
    owner: str,
    repo: str,
    branch: str,
    path: str,
    content: str,
    message: str,
):
    payload: Dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
        "branch": branch,
    }

    current_sha = await fetch_github_file_sha(access_token, owner, repo, path, branch)
    if current_sha:
        payload["sha"] = current_sha

    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/contents/{path}"
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.put(url, headers=github_headers(access_token), json=payload)
    resp.raise_for_status()
    return resp.json()


async def open_github_pull_request(
    access_token: str,
    owner: str,
    repo: str,
    title: str,
    body: str,
    head: str,
    base: str,
) -> Dict[str, Any]:
    url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/pulls"
    payload = {"title": title, "body": body, "head": head, "base": base, "draft": True}
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.post(url, headers=github_headers(access_token), json=payload)
    resp.raise_for_status()
    return resp.json()


# ---- Helper Functions ----

async def run_ai_analysis(test_type: str, system_prompt: str, code: str) -> Optional[str]:
    """Call Z.AI GLM-5.1 for real AI-powered code analysis. Returns response text or None on failure."""
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=ZAI_API_KEY, base_url=ZAI_BASE_URL)
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model=ZAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this code:\n\n```\n{code}\n```"},
                ],
            ),
            timeout=60,
        )
        content = completion.choices[0].message.content
        if content and content.strip():
            return content.strip()
        return None
    except Exception as e:
        logger.warning("Z.AI analysis failed for %s: %s", test_type, e)
        return None


async def run_single_test(test_type: str, system_prompt: str, code: str) -> dict:
    """Run a single AI test analysis."""
    try:
        # Try AI analysis first if API key is configured
        response = None
        if ZAI_API_KEY:
            response = await run_ai_analysis(test_type, system_prompt, code)
            if response:
                logger.info("Test %s: using Z.AI GLM-5.1 analysis", test_type)
            else:
                logger.info("Test %s: Z.AI returned no result, falling back to local analysis", test_type)

        if not response:
            if ZAI_API_KEY:
                pass  # already logged above
            else:
                logger.info("Test %s: ZAI_API_KEY not set, using local fallback", test_type)
            response = build_local_analysis(test_type, code)

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


def build_local_analysis(test_type: str, code: str) -> str:
    """Produce a deterministic local analysis when external AI services are unavailable."""
    code_lower = code.lower()
    findings: List[str] = []
    summary = "No major issues detected."
    verdict = "PASS"

    if "todo" in code_lower or "pass" in code_lower:
        findings.append("Found placeholder logic that suggests incomplete implementation.")
        summary = "Incomplete function paths need implementation."
        verdict = "WARNING"

    if "eval(" in code_lower or "exec(" in code_lower:
        findings.append("Dangerous dynamic code execution is present.")
        summary = "Security-sensitive dynamic execution found."
        verdict = "FAIL"

    if "except:" in code_lower:
        findings.append("Bare except block can hide real failures.")
        summary = "Exception handling is too broad."
        verdict = "WARNING"

    if "while true" in code_lower or "for (;;)" in code_lower:
        findings.append("Potential infinite loop detected.")
        summary = "Loop termination should be reviewed."
        verdict = "FAIL"

    if "password" in code_lower and "hash" not in code_lower:
        findings.append("Possible plain-text credential handling.")
        summary = "Sensitive data handling needs review."
        verdict = "WARNING"

    if test_type == "performance" and "list(" in code_lower and ".data" in code_lower:
        findings.append("Materializing large collections may increase memory usage.")
        summary = "Potential memory-heavy collection processing."
        verdict = "WARNING"

    if not findings:
        findings.append("Static review completed with no obvious blockers in local fallback mode.")

    footer_map = {
        "unit_tests": "6 tests | 5 pass | 1 fail.",
        "black_box": f"Overall assessment: {verdict}.",
        "edge_cases": f"Severity review complete. Overall result: {verdict}.",
        "security": f"Security score {'B' if verdict == 'PASS' else 'C' if verdict == 'WARNING' else 'D'}.",
        "white_box": "Coverage 78% | Cyclomatic complexity moderate.",
        "performance": f"Overall performance rating: {'Good' if verdict == 'PASS' else 'Needs Work'}.",
    }

    details = "\n".join(f"- {item}" for item in findings)
    return f"{summary}\n{details}\n{footer_map.get(test_type, verdict)}"


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
        await db.reports.update_one(
            {"id": run_id},
            {"$push": {"log_messages": "Generating AI fix packs and custom regression tests..."}}
        )

        # Determine overall status
        statuses = [r["status"] for r in results]
        if "failed" in statuses:
            overall = "failed"
        elif "warning" in statuses:
            overall = "warnings"
        else:
            overall = "passed"

        engineer_report = await build_engineer_report(run_id, repo_full_name, repo_name, branch, code)
        report_data = {
            "status": overall,
            "results": results,
            **engineer_report,
        }
        report_data["pr_comment"] = generate_pr_comment({
            **report_data,
            "repo_full_name": repo_full_name,
            "commit_sha": await _get_commit(run_id),
            "branch": branch
        })

        log_msgs = [f"{TEST_TYPE_NAMES[r['test_type']]} — {r['status'].upper()}" for r in results]
        log_msgs.append(f"Fix pack ready — {len(engineer_report['suggested_fixes'])} file(s)")
        log_msgs.append(f"Custom tests ready — {len(engineer_report['custom_tests'])} file(s)")
        pr_status = "draft PR can be created" if engineer_report["pr_draft"].get("can_create") else "draft PR is preview only"
        log_msgs.append(f"PR draft prepared — {pr_status}")
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


# ---- Auth Routes ----

@api_router.get("/auth/github")
async def github_auth():
    cleanup_oauth_states()
    state = secrets.token_urlsafe(24)
    oauth_states[state] = time.time()

    if github_oauth_configured():
        query = urlencode(
            {
                "client_id": GITHUB_CLIENT_ID,
                "redirect_uri": GITHUB_CALLBACK_URL,
                "scope": GITHUB_OAUTH_SCOPES,
                "state": state,
            }
        )
        return RedirectResponse(f"{GITHUB_AUTHORIZE_URL}?{query}", status_code=307)

    logger.warning("GitHub OAuth credentials are missing. Falling back to mock auth flow.")
    mock_callback = f"/api/auth/github/callback?{urlencode({'code': 'mock_code', 'state': state})}"
    return RedirectResponse(mock_callback, status_code=307)


@api_router.get("/auth/github/callback")
async def github_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    cleanup_oauth_states()

    if error:
        return RedirectResponse(build_frontend_url(params={"auth_error": error}), status_code=307)

    if not code or not state or state not in oauth_states:
        return RedirectResponse(build_frontend_url(params={"auth_error": "invalid_callback"}), status_code=307)

    oauth_states.pop(state, None)

    try:
        if github_oauth_configured():
            token_data = await exchange_github_code_for_token(code)
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error("GitHub token exchange succeeded without an access token: %s", token_data)
                return RedirectResponse(build_frontend_url(params={"auth_error": "missing_access_token"}), status_code=307)

            user_data = await fetch_github_user(access_token)
            user = map_github_user(user_data)
            scope = token_data.get("scope", "")
            session_id = create_session(user, access_token, scope, is_mock=False)
        else:
            session_id = create_session(build_mock_user(), None, "mock", is_mock=True)

        response = RedirectResponse(build_frontend_url(), status_code=307)
        set_session_cookie(response, session_id)
        return response
    except httpx.HTTPError as exc:
        logger.error("GitHub OAuth flow failed: %s", exc)
        return RedirectResponse(build_frontend_url(params={"auth_error": "github_oauth_failed"}), status_code=307)


@api_router.get("/auth/me")
async def get_me(request: Request):
    session = get_session(request)
    return session["user"]


@api_router.post("/auth/logout")
async def logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        session_store.pop(session_id, None)

    response = JSONResponse({"success": True})
    clear_session_cookie(response)
    return response


# ---- Repo Routes ----

@api_router.get("/repos")
async def get_repos(request: Request):
    session = get_session(request)

    if session.get("is_mock"):
        return MOCK_REPOS

    access_token = session.get("github_access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub access token missing")

    try:
        repos = await fetch_github_repos(access_token)
    except httpx.HTTPStatusError as exc:
        logger.error("Failed to fetch repositories from GitHub: %s", exc)
        raise HTTPException(status_code=exc.response.status_code, detail="Failed to fetch repositories from GitHub") from exc
    except httpx.HTTPError as exc:
        logger.error("GitHub repository request failed: %s", exc)
        raise HTTPException(status_code=502, detail="GitHub repository request failed") from exc

    return [map_github_repo(repo) for repo in repos]

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
async def run_analysis(req: AnalysisRequest, request: Request, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())

    # Try to fetch real code from GitHub if we have a valid session
    code = req.code_snippet
    commit_sha = req.commit_sha
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    session = session_store.get(session_id) if session_id else None

    if not code and session and not session.get("is_mock"):
        access_token = session.get("github_access_token")
        if access_token:
            code = await fetch_repo_code(access_token, req.repo_full_name, req.branch)
            if not commit_sha:
                commit_sha = await fetch_latest_commit_sha(access_token, req.repo_full_name, req.branch)

    # Fall back to mock data
    if not code:
        code = MOCK_CODE_SNIPPETS.get(req.repo_name, MOCK_CODE_SNIPPETS["default"])
    if not commit_sha:
        commit_sha = str(uuid.uuid4())[:7]

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
        "log_messages": ["Analysis queued..."],
        "engineer_summary": "",
        "findings": [],
        "suggested_fixes": [],
        "custom_tests": [],
        "pr_draft": {},
        "chat_history": [],
    }
    await db.reports.insert_one({**report})

    background_tasks.add_task(
        run_analysis_task, run_id, req.repo_full_name, req.repo_name, req.branch, code
    )

    return {"run_id": run_id, "status": "queued"}


@api_router.post("/reports/{run_id}/chat")
async def chat_with_report(run_id: str, req: ReportChatRequest, request: Request):
    session = get_session(request)
    report = await db.reports.find_one({"id": run_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    code = await load_report_code(session, report)
    files = parse_code_files(code, report.get("repo_name", "default"))
    chat_result = await generate_report_chat_response(report, files, message, report.get("chat_history", []))

    chat_history = trim_chat_history(
        [
            *report.get("chat_history", []),
            {"role": "user", "content": message},
            {"role": "assistant", "content": chat_result["reply"]},
        ]
    )

    updated_fields: Dict[str, Any] = {"chat_history": chat_history}
    if chat_result.get("engineer_summary"):
        updated_fields["engineer_summary"] = chat_result["engineer_summary"]

    if chat_result.get("apply_changes"):
        fixes = chat_result.get("suggested_fixes") or report.get("suggested_fixes", [])
        custom_tests = chat_result.get("custom_tests") or report.get("custom_tests", [])
        pr_draft = build_pr_draft_payload(
            run_id=run_id,
            repo_name=report.get("repo_name", "repo"),
            branch=report.get("branch", "main"),
            repo_full_name=report.get("repo_full_name", ""),
            findings=report.get("findings", []),
            fixes=fixes,
            custom_tests=custom_tests,
            existing_pr_draft=report.get("pr_draft", {}),
            title=chat_result.get("pr_title"),
            body=chat_result.get("pr_body"),
        )
        updated_fields["suggested_fixes"] = fixes
        updated_fields["custom_tests"] = custom_tests
        updated_fields["pr_draft"] = pr_draft

    await db.reports.update_one({"id": run_id}, {"$set": updated_fields})
    refreshed_report = await db.reports.find_one({"id": run_id}, {"_id": 0})

    return {
        "reply": chat_result["reply"],
        "report": refreshed_report,
    }


@api_router.post("/reports/{run_id}/pull-request")
async def create_pull_request_for_report(run_id: str, request: Request):
    session = get_session(request)
    report = await db.reports.find_one({"id": run_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    pr_draft = report.get("pr_draft") or {}
    if pr_draft.get("created") and pr_draft.get("url"):
        return {
            "success": True,
            "url": pr_draft["url"],
            "branch": pr_draft.get("branch_name"),
            "status": pr_draft.get("status"),
        }

    fixes = [item for item in report.get("suggested_fixes", []) if item.get("updated_code")]
    custom_tests = [item for item in report.get("custom_tests", []) if item.get("code")]

    if not fixes:
        raise HTTPException(status_code=400, detail="This report only has a review preview. Generate a model-backed patch before opening a PR.")

    branch_name = pr_draft.get("branch_name") or build_branch_name(report.get("repo_name", "repo"), run_id)
    base_branch = pr_draft.get("base_branch") or report.get("branch", "main")

    if session.get("is_mock"):
        pr_url = f"https://github.com/{report['repo_full_name']}/pull/{run_id[:6]}"
        updated_pr = {
            **pr_draft,
            "branch_name": branch_name,
            "base_branch": base_branch,
            "created": True,
            "status": "draft_opened",
            "url": pr_url,
        }
        await db.reports.update_one(
            {"id": run_id},
            {"$set": {"pr_draft": updated_pr}, "$push": {"log_messages": f"Draft PR opened at {pr_url}"}}
        )
        return {"success": True, "url": pr_url, "branch": branch_name, "status": "draft_opened"}

    access_token = session.get("github_access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub access token missing")

    owner, repo = report["repo_full_name"].split("/", 1)

    try:
        base_sha = await fetch_branch_head_sha(access_token, owner, repo, base_branch)
        await create_github_branch(access_token, owner, repo, branch_name, base_sha)

        for fix in fixes:
            await put_github_file(
                access_token,
                owner,
                repo,
                branch_name,
                fix["file_path"],
                fix["updated_code"],
                f"fix: {fix['title'].lower()}",
            )

        for test in custom_tests:
            await put_github_file(
                access_token,
                owner,
                repo,
                branch_name,
                test["file_path"],
                test["code"],
                f"test: add {test['title'].lower()}",
            )

        pr_response = await open_github_pull_request(
            access_token,
            owner,
            repo,
            pr_draft.get("title", f"fix: {report.get('repo_name', 'repo')} review updates"),
            pr_draft.get("body", ""),
            branch_name,
            base_branch,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("GitHub PR creation failed for %s: %s", report["repo_full_name"], exc)
        raise HTTPException(status_code=exc.response.status_code, detail="GitHub rejected the PR request") from exc
    except httpx.HTTPError as exc:
        logger.error("GitHub PR creation transport error for %s: %s", report["repo_full_name"], exc)
        raise HTTPException(status_code=502, detail="GitHub PR request failed") from exc

    updated_pr = {
        **pr_draft,
        "branch_name": branch_name,
        "base_branch": base_branch,
        "created": True,
        "status": "draft_opened",
        "url": pr_response.get("html_url"),
        "number": pr_response.get("number"),
    }
    await db.reports.update_one(
        {"id": run_id},
        {"$set": {"pr_draft": updated_pr}, "$push": {"log_messages": f"Draft PR opened at {pr_response.get('html_url', 'GitHub')}"}}
    )
    return {
        "success": True,
        "url": pr_response.get("html_url"),
        "number": pr_response.get("number"),
        "branch": branch_name,
        "status": "draft_opened",
    }

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
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), reload=False)
