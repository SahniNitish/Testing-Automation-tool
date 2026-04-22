#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import backend.server as server


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the MOSAIC benchmark corpus and write immutable result artifacts.")
    parser.add_argument(
        "--case",
        help="Optional benchmark case id to run instead of the full corpus.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(server.BENCHMARK_RESULTS_DIR),
        help="Directory where benchmark result artifacts should be written.",
    )
    return parser.parse_args()


def determine_overall_status(results: List[Dict[str, Any]]) -> str:
    statuses = [item.get("status") for item in results]
    if "failed" in statuses:
        return "failed"
    if "warning" in statuses:
        return "warnings"
    return "passed"


def evaluate_case(case: Dict[str, Any], report: Dict[str, Any]) -> Dict[str, Any]:
    expected_labels = set(case.get("expected_bug_labels", []))
    consensus_findings = report.get("consensus_findings", [])
    confirmed_labels = {
        item["bug_type"]
        for item in consensus_findings
        if item.get("resolution") == "confirmed" and item.get("critic_verdict") != "rejected"
    }
    surfaced_labels = {item["bug_type"] for item in consensus_findings}
    fix_ready_labels = {item["bug_type"] for item in consensus_findings if item.get("eligible_for_fix")}
    false_positive_labels = surfaced_labels - expected_labels
    missed_labels = expected_labels - confirmed_labels

    return {
        "case_id": case["id"],
        "title": case.get("title"),
        "expected_bug_labels": sorted(expected_labels),
        "confirmed_bug_labels": sorted(confirmed_labels),
        "surfaced_bug_labels": sorted(surfaced_labels),
        "fix_ready_labels": sorted(fix_ready_labels),
        "false_positive_labels": sorted(false_positive_labels),
        "missed_labels": sorted(missed_labels),
        "overall_status": report["status"],
        "confirmed_count": len(confirmed_labels),
        "false_positive_count": len(false_positive_labels),
        "missed_count": len(missed_labels),
        "pr_ready": bool(report.get("pr_draft", {}).get("can_create")),
        "top_summary": report.get("engineer_summary", ""),
    }


def compute_agent_reliability(case_reports: List[Dict[str, Any]]) -> Dict[str, float]:
    per_agent_scores: Dict[str, List[float]] = defaultdict(list)
    tracked_agents = {spec["agent"] for spec in server.MOSAIC_ANALYSIS_AGENTS}

    for item in case_reports:
        expected = set(item["case"].get("expected_bug_labels", []))
        for run in item["report"].get("agent_runs", []):
            agent = run.get("agent")
            if agent not in tracked_agents:
                continue
            claimed = {claim.get("bug_type") for claim in run.get("claims", []) if claim.get("bug_type")}
            union = claimed | expected
            if not union:
                score = 1.0
            else:
                score = len(claimed & expected) / len(union)
            per_agent_scores[agent].append(score)

    snapshot = {}
    for spec in server.MOSAIC_ANALYSIS_AGENTS:
        values = per_agent_scores.get(spec["agent"])
        snapshot[spec["agent"]] = round(sum(values) / len(values), 3) if values else server.DEFAULT_AGENT_RELIABILITY
    return snapshot


def build_summary(case_reports: List[Dict[str, Any]], reliability_snapshot: Dict[str, float]) -> Dict[str, Any]:
    evaluations = [item["evaluation"] for item in case_reports]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases_run": len(case_reports),
        "confirmed_findings": sum(item["confirmed_count"] for item in evaluations),
        "missed_expected_labels": sum(item["missed_count"] for item in evaluations),
        "false_positive_labels": sum(item["false_positive_count"] for item in evaluations),
        "pr_ready_cases": sum(1 for item in evaluations if item["pr_ready"]),
        "agent_reliability_snapshot": reliability_snapshot,
    }


def build_markdown_summary(case_reports: List[Dict[str, Any]], summary: Dict[str, Any]) -> str:
    lines = [
        "# MOSAIC Benchmark Summary",
        "",
        f"Generated: {summary['generated_at']}",
        "",
        f"- Cases run: {summary['cases_run']}",
        f"- Confirmed findings: {summary['confirmed_findings']}",
        f"- Missed expected labels: {summary['missed_expected_labels']}",
        f"- False positive labels: {summary['false_positive_labels']}",
        f"- PR-ready cases: {summary['pr_ready_cases']}",
        "",
        "## Case Results",
        "",
        "| Case | Expected | Confirmed | Missed | PR Ready |",
        "|------|----------|-----------|--------|----------|",
    ]

    for item in case_reports:
        evaluation = item["evaluation"]
        lines.append(
            f"| {evaluation['case_id']} | "
            f"{', '.join(evaluation['expected_bug_labels']) or 'none'} | "
            f"{', '.join(evaluation['confirmed_bug_labels']) or 'none'} | "
            f"{', '.join(evaluation['missed_labels']) or 'none'} | "
            f"{'yes' if evaluation['pr_ready'] else 'no'} |"
        )

    lines.extend(["", "## Agent Reliability Snapshot", "", "| Agent | Score |", "|------|-------|"])
    for agent, score in sorted(summary["agent_reliability_snapshot"].items()):
        lines.append(f"| {agent} | {score:.3f} |")

    return "\n".join(lines)


async def run_case(case: Dict[str, Any]) -> Dict[str, Any]:
    benchmark_metadata = {
        "case_id": case["id"],
        "title": case.get("title"),
        "expected_bug_labels": case.get("expected_bug_labels", []),
        "expected_behavior": case.get("expected_behavior"),
        "executable_check": case.get("executable_check"),
    }
    report = await server.build_engineer_report(
        run_id=str(uuid.uuid4()),
        repo_full_name=case["repo_full_name"],
        repo_name=case["repo_name"],
        branch=case.get("branch", "main"),
        code=case["code_snippet"],
        analysis_mode=server.ANALYSIS_MODE_MOSAIC,
        benchmark_metadata=benchmark_metadata,
    )
    report["status"] = determine_overall_status(report.get("results", []))
    report["timestamp"] = datetime.now(timezone.utc).isoformat()
    return report


async def main() -> int:
    args = parse_args()
    corpus = server.load_benchmark_corpus()
    if args.case:
        corpus = [case for case in corpus if case["id"] == args.case]

    if not corpus:
        raise SystemExit("No benchmark cases found for the requested selection.")

    case_reports = []
    for case in corpus:
        report = await run_case(case)
        evaluation = evaluate_case(case, report)
        case_reports.append({"case": case, "report": report, "evaluation": evaluation})

    reliability_snapshot = compute_agent_reliability(case_reports)
    summary = build_summary(case_reports, reliability_snapshot)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = output_dir / run_stamp
    cases_dir = run_dir / "cases"
    cases_dir.mkdir(parents=True, exist_ok=True)

    for item in case_reports:
        case_id = item["case"]["id"]
        payload = {
            "case": item["case"],
            "evaluation": item["evaluation"],
            "report": item["report"],
        }
        (cases_dir / f"{case_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (run_dir / "summary.md").write_text(build_markdown_summary(case_reports, summary), encoding="utf-8")
    server.BENCHMARK_RELIABILITY_PATH.write_text(json.dumps(reliability_snapshot, indent=2), encoding="utf-8")

    print(json.dumps({"run_dir": str(run_dir), "cases": len(case_reports)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
