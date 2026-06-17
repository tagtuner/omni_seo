import sys
import os
import json

# Ensure backend directory is in path
sys.path.append(os.path.dirname(__file__))

from beyond_seo_engine import run_campaign_pipeline

def test_pipeline():
    print("Starting pipeline validation test...")
    
    # Mock config with no apify_token to test fallback logic
    config = {
        "domain": "https://testdomain.com",
        "keyword": "best freelance tax tool",
        "duration": 2,
        "prompt": "Style it with glassmorphism Slate theme.",
        "audit_only": 0,
        "sftp": {},
        "api": {
            "llm_provider": "gemini",
            "llm_api_key": ""  # empty key will trigger fallbacks
        }
    }
    
    captured_leads = None
    captured_competitors = {}
    
    def mock_log_callback(progress, task, message, class_name="terminal-info-msg", taskStatus=None, artifact=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None, scraped_leads=None):
        nonlocal captured_leads, captured_competitors
        print(f"[{progress}%] Task: {task} | Status: {taskStatus} | Msg: {message[:60]}...")
        if comp1_name:
            captured_competitors["comp1_name"] = comp1_name
            captured_competitors["comp1_url"] = comp1_url
        if comp2_name:
            captured_competitors["comp2_name"] = comp2_name
            captured_competitors["comp2_url"] = comp2_url
        if scraped_leads:
            print(f"--> Captured Leads: {scraped_leads}")
            captured_leads = scraped_leads

    # Execute
    success, message = run_campaign_pipeline(config, mock_log_callback)
    
    print("\n--- TEST RESULTS ---")
    print(f"Pipeline Execution Status: {'SUCCESS' if success else 'FAILED'}")
    print(f"Pipeline Result Message: {message}")
    print(f"Captured Competitors: {captured_competitors}")
    
    if captured_leads:
        try:
            leads = json.loads(captured_leads)
            print(f"Parsed Leads Successfully! Count: {len(leads)}")
            assert len(leads) == 2
            assert leads[0]["domain"] == captured_competitors["comp1_url"]
            print("Validation PASS: Leads count and structure match competitors!")
        except Exception as e:
            print(f"Validation FAIL: {e}")
    else:
        print("Validation FAIL: No leads were captured.")

if __name__ == "__main__":
    test_pipeline()
