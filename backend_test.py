#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class AITestLabAPITester:
    def __init__(self, base_url="https://code-audit-ai-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints (mocked)"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION ENDPOINTS")
        print("="*50)
        
        # Test GitHub auth redirect
        self.run_test(
            "GitHub Auth Redirect",
            "GET",
            "auth/github",
            200
        )
        
        # Test GitHub callback
        success, response = self.run_test(
            "GitHub Auth Callback",
            "GET",
            "auth/github/callback?code=mock_code",
            200
        )
        
        # Test get current user
        self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        # Test logout
        self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )

    def test_repo_endpoints(self):
        """Test repository endpoints"""
        print("\n" + "="*50)
        print("TESTING REPOSITORY ENDPOINTS")
        print("="*50)
        
        # Test get repositories
        success, repos = self.run_test(
            "Get Repositories",
            "GET",
            "repos",
            200
        )
        
        if success and isinstance(repos, list):
            print(f"   Found {len(repos)} repositories")
            if len(repos) >= 6:
                print("✅ Expected 6 mock repositories found")
            else:
                print(f"⚠️  Expected 6 repositories, found {len(repos)}")
        
        return repos if success else []

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        print("\n" + "="*50)
        print("TESTING STATS ENDPOINT")
        print("="*50)
        
        success, stats = self.run_test(
            "Get Stats",
            "GET",
            "stats",
            200
        )
        
        if success and isinstance(stats, dict):
            expected_keys = ['total_runs', 'passed', 'failed', 'warnings', 'running']
            for key in expected_keys:
                if key in stats:
                    print(f"✅ Stats key '{key}': {stats[key]}")
                else:
                    print(f"❌ Missing stats key: {key}")
        
        return stats if success else {}

    def test_analysis_endpoints(self):
        """Test analysis endpoints"""
        print("\n" + "="*50)
        print("TESTING ANALYSIS ENDPOINTS")
        print("="*50)
        
        # Test run analysis
        analysis_data = {
            "repo_full_name": "devuser/payment-service",
            "repo_name": "payment-service",
            "branch": "main",
            "commit_sha": "abc1234"
        }
        
        success, run_response = self.run_test(
            "Run Analysis",
            "POST",
            "analysis/run",
            200,
            data=analysis_data
        )
        
        run_id = None
        if success and isinstance(run_response, dict) and 'run_id' in run_response:
            run_id = run_response['run_id']
            print(f"✅ Analysis started with run_id: {run_id}")
        
        # Test get reports
        success, reports = self.run_test(
            "Get Reports",
            "GET",
            "reports",
            200
        )
        
        if success and isinstance(reports, list):
            print(f"✅ Found {len(reports)} reports")
        
        # Test get specific report (if we have a run_id)
        if run_id:
            print(f"\n⏳ Waiting 3 seconds for analysis to start...")
            import time
            time.sleep(3)
            
            success, report = self.run_test(
                f"Get Specific Report ({run_id})",
                "GET",
                f"reports/{run_id}",
                200
            )
            
            if success and isinstance(report, dict):
                print(f"✅ Report status: {report.get('status', 'unknown')}")
                print(f"✅ Report results count: {len(report.get('results', []))}")
        
        return run_id

    def test_webhook_endpoint(self):
        """Test webhook setup endpoint"""
        print("\n" + "="*50)
        print("TESTING WEBHOOK ENDPOINT")
        print("="*50)
        
        self.run_test(
            "Setup Webhook",
            "POST",
            "repos/devuser/payment-service/webhook",
            200
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting AI Test Lab API Testing")
        print(f"📍 Base URL: {self.base_url}")
        print(f"📍 API URL: {self.api_url}")
        
        # Test all endpoints
        self.test_auth_endpoints()
        repos = self.test_repo_endpoints()
        stats = self.test_stats_endpoint()
        run_id = self.test_analysis_endpoints()
        self.test_webhook_endpoint()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for failure in self.failed_tests:
                print(f"   - {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("✅ Backend API testing: PASSED")
            return 0
        else:
            print("❌ Backend API testing: FAILED")
            return 1

def main():
    tester = AITestLabAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())