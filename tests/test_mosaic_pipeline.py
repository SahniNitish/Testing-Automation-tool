import asyncio

import backend.server as server


def test_cluster_mosaic_claims_merges_overlapping_agent_claims():
    files = server.parse_code_files(
        "# ---- FILE: src/handler.py ----\n"
        "def handle(raw_value):\n"
        "    return eval(raw_value)\n",
        "custom-api",
    )

    agent_runs = server.run_mosaic_analysis_agents(files)
    claim_groups = server.cluster_mosaic_claims(agent_runs)

    assert len(claim_groups) == 1
    assert claim_groups[0]["bug_type"] == "dynamic_execution"
    assert claim_groups[0]["supporting_agents"] == ["black_box_agent", "security_agent", "white_box_agent"]


def test_calculate_mosaic_confidence_caps_rejected_claims():
    confidence = server.calculate_mosaic_confidence(
        support_count=1,
        evidence_completeness=1.0,
        critic_verdict="rejected",
        supporting_agents=["security_agent"],
        reliability_snapshot={"security_agent": 0.9},
        resolution="confirmed",
    )

    assert confidence <= 25


def test_load_benchmark_case_reads_corpus_fixture():
    case = server.load_benchmark_case("python_zero_variance_metrics")

    assert case is not None
    assert case["repo_name"] == "python-zero-variance-metrics"
    assert "zero_variance_outlier" in case["expected_bug_labels"]


def test_mosaic_report_creates_pr_ready_fix_for_confirmed_zero_variance_case():
    report = asyncio.run(
        server.build_engineer_report(
            run_id="mosaic-zero-variance",
            repo_full_name="benchmark/python-zero-variance-metrics",
            repo_name="python-zero-variance-metrics",
            branch="main",
            code=server.load_benchmark_case("python_zero_variance_metrics")["code_snippet"],
            analysis_mode=server.ANALYSIS_MODE_MOSAIC,
            benchmark_metadata={
                "case_id": "python_zero_variance_metrics",
                "executable_check": server.load_benchmark_case("python_zero_variance_metrics")["executable_check"],
            },
        )
    )

    assert report["analysis_mode"] == "mosaic"
    assert len(report["agent_runs"]) == 8
    assert report["consensus_findings"][0]["bug_type"] == "zero_variance_outlier"
    assert report["consensus_findings"][0]["eligible_for_fix"] is True
    assert report["pr_draft"]["can_create"] is True
    assert report["suggested_fixes"][0]["updated_code"]


def test_mosaic_report_keeps_low_signal_repo_out_of_pr_generation():
    report = asyncio.run(
        server.build_engineer_report(
            run_id="mosaic-low-signal",
            repo_full_name="benchmark/python-low-signal-utils",
            repo_name="python-low-signal-utils",
            branch="main",
            code=server.load_benchmark_case("python_low_signal_utils")["code_snippet"],
            analysis_mode=server.ANALYSIS_MODE_MOSAIC,
            benchmark_metadata={"case_id": "python_low_signal_utils"},
        )
    )

    assert report["analysis_mode"] == "mosaic"
    assert report["pr_draft"]["can_create"] is False
    assert not report["suggested_fixes"]
    assert all(not finding["eligible_for_fix"] for finding in report["consensus_findings"])
