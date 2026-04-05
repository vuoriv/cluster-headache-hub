#!/usr/bin/env python3
"""
LLM-powered analysis for trials and papers using Cerebras/Qwen3.

Analyzes:
1. New trials without existing analyses → what was tested, verdict, patient relevance
2. Top papers needing better classification → key finding summary

Uses OpenAI-compatible API (works with Cerebras, Groq, OpenRouter, etc.)

Usage:
  python scripts/llm-analyze.py --api-key KEY [--base-url URL] [--model MODEL] [--db PATH]

Environment:
  CEREBRAS_API_KEY — API key (alternative to --api-key)
"""

import argparse
import json
import os
import sqlite3
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DB = os.path.join(PROJECT_ROOT, "public", "data.db")
TRIAL_ANALYSES_PATH = os.path.join(PROJECT_ROOT, "src", "data", "trials", "trial-analyses.json")

DEFAULT_BASE_URL = "https://api.cerebras.ai/v1"
DEFAULT_MODEL = "qwen-3-235b-a22b-instruct-2507"

TRIAL_PROMPT = """You are analyzing a clinical trial for cluster headache. Based on the information below, provide a structured analysis.

Trial: {title}
NCT ID: {nct_id}
Status: {status}
Phase: {phase}
Sponsor: {sponsor}
Enrollment: {enrollment}
Start: {start_date}
End: {end_date}
Category: {category}

Summary:
{summary}

{results_section}

Respond with ONLY a JSON object (no markdown, no explanation):
{{
  "what_tested": "1-2 sentence plain English description of what was being tested and why",
  "key_result": "1-2 sentence summary of the main finding. Include actual numbers if available. For recruiting trials, state what's expected.",
  "verdict": "success|failure|mixed|ongoing|terminated|unknown",
  "patient_relevance": "1 sentence explaining what this means for a CH patient today",
  "dose_tested": "specific dose/intervention if mentioned, or null"
}}"""


def call_llm(prompt, api_key, base_url, model):
    """Call OpenAI-compatible API."""
    import requests

    response = requests.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.1,
        },
        timeout=30,
    )

    if response.status_code != 200:
        raise Exception(f"API error {response.status_code}: {response.text[:200]}")

    text = response.json()["choices"][0]["message"]["content"].strip()

    # Clean markdown wrapping if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return json.loads(text)


def analyze_new_trials(db_path, api_key, base_url, model):
    """Find trials without analyses and analyze them."""
    # Load existing analyses
    existing = {}
    if os.path.exists(TRIAL_ANALYSES_PATH):
        with open(TRIAL_ANALYSES_PATH) as f:
            for a in json.load(f):
                existing[a["nct_id"]] = a

    # Get all trials from DB
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    trials = conn.execute("""
        SELECT nct_id, title, status, phase, sponsor, enrollment,
               start_date, end_date, summary, category, raw_json
        FROM trials
    """).fetchall()
    conn.close()

    # Find new trials
    new_trials = [t for t in trials if t["nct_id"] not in existing]

    if not new_trials:
        print("  No new trials to analyze")
        return 0

    print(f"  Found {len(new_trials)} new trials to analyze")

    analyzed = 0
    for t in new_trials:
        print(f"  Analyzing {t['nct_id']}: {t['title'][:60]}...")

        # Check for results data
        results_section = ""
        if t["raw_json"]:
            raw = json.loads(t["raw_json"])
            if raw.get("hasResults"):
                results = raw.get("resultsSection", {})
                outcomes = results.get("outcomeMeasuresModule", {}).get("outcomeMeasures", [])
                for om in outcomes[:2]:
                    if om.get("type") == "PRIMARY":
                        results_section += f"\nPrimary outcome: {om.get('title', '')}\n"
                        results_section += f"Description: {om.get('description', '')[:200]}\n"
                        for cls in om.get("classes", [])[:1]:
                            for cat in cls.get("categories", [])[:1]:
                                for m in cat.get("measurements", []):
                                    results_section += f"  {m.get('groupId', '')}: {m.get('value', '')} ({m.get('spread', '')})\n"

        prompt = TRIAL_PROMPT.format(
            title=t["title"],
            nct_id=t["nct_id"],
            status=t["status"],
            phase=t["phase"] or "N/A",
            sponsor=t["sponsor"] or "N/A",
            enrollment=t["enrollment"] or "N/A",
            start_date=t["start_date"] or "N/A",
            end_date=t["end_date"] or "N/A",
            category=t["category"] or "N/A",
            summary=t["summary"][:1500] if t["summary"] else "No summary available",
            results_section=results_section or "No results posted.",
        )

        try:
            result = call_llm(prompt, api_key, base_url, model)
            result["nct_id"] = t["nct_id"]
            result["sample_size"] = t["enrollment"]
            existing[t["nct_id"]] = result
            analyzed += 1
            time.sleep(1)  # Rate limit courtesy
        except Exception as e:
            print(f"    ERROR: {e}")
            # Add placeholder
            existing[t["nct_id"]] = {
                "nct_id": t["nct_id"],
                "what_tested": t["summary"][:150] if t["summary"] else "Analysis pending",
                "key_result": "Automated analysis failed — manual review needed",
                "verdict": "unknown",
                "patient_relevance": "Check ClinicalTrials.gov for details",
                "dose_tested": None,
                "sample_size": t["enrollment"],
            }

    # Write updated analyses
    all_analyses = list(existing.values())
    os.makedirs(os.path.dirname(TRIAL_ANALYSES_PATH), exist_ok=True)
    with open(TRIAL_ANALYSES_PATH, "w") as f:
        json.dump(all_analyses, f, indent=2)

    print(f"  Analyzed {analyzed} new trials ({len(all_analyses)} total)")
    return analyzed


def main():
    parser = argparse.ArgumentParser(description="LLM-powered analysis")
    parser.add_argument("--api-key", default=os.environ.get("CEREBRAS_API_KEY"),
                        help="API key (or set CEREBRAS_API_KEY env var)")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"API base URL (default: {DEFAULT_BASE_URL})")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"Model name (default: {DEFAULT_MODEL})")
    parser.add_argument("--db", default=DATA_DB, help="Database path")
    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: No API key. Set CEREBRAS_API_KEY or use --api-key")
        sys.exit(1)

    print("=== LLM Analysis (Cerebras/Qwen3) ===\n")

    # Test API connection
    print("  Testing API connection...")
    try:
        test = call_llm("Respond with only: {\"status\": \"ok\"}", args.api_key, args.base_url, args.model)
        print(f"  API OK: {test}\n")
    except Exception as e:
        print(f"  API test failed: {e}")
        sys.exit(1)

    # Analyze new trials
    new_count = analyze_new_trials(args.db, args.api_key, args.base_url, args.model)

    print(f"\n=== LLM Analysis Complete ({new_count} new analyses) ===")


if __name__ == "__main__":
    main()
