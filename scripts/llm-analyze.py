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


def ensure_pa_analyses_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pa_analyses (
            pmid TEXT PRIMARY KEY,
            outcome TEXT,
            plain_summary TEXT,
            key_finding TEXT,
            sample_size INTEGER,
            study_type TEXT,
            evidence_tier INTEGER,
            interventions_studied TEXT,
            analysis_source TEXT DEFAULT 'ai'
        )
    """)
    conn.commit()


def ensure_tr_analyses_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tr_analyses (
            nct_id TEXT PRIMARY KEY,
            what_tested TEXT,
            key_result TEXT,
            verdict TEXT,
            patient_relevance TEXT,
            dose_tested TEXT,
            sample_size INTEGER
        )
    """)
    conn.commit()


def seed_from_json(conn):
    """One-time migration from JSON to DB."""
    if conn.execute("SELECT COUNT(*) FROM tr_analyses").fetchone()[0] > 0:
        return
    json_path = os.path.join(PROJECT_ROOT, "src", "data", "trials", "trial-analyses.json")
    if not os.path.exists(json_path):
        return
    with open(json_path) as f:
        analyses = json.load(f)
    for a in analyses:
        conn.execute(
            "INSERT OR REPLACE INTO tr_analyses VALUES (?,?,?,?,?,?,?)",
            (a["nct_id"], a.get("what_tested"), a.get("key_result"),
             a.get("verdict"), a.get("patient_relevance"),
             a.get("dose_tested"), a.get("sample_size")),
        )
    conn.commit()
    print(f"  Seeded {len(analyses)} trial analyses from JSON")


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


PAPER_PROMPT = """You are analyzing a research paper about cluster headache. Based on the content below, provide a structured analysis written for patients, not doctors.

Title: {title}
Authors: {authors}
Journal: {journal} ({year})
Category: {category}
MeSH Terms: {mesh_terms}

Content:
{content}

Respond with ONLY a JSON object (no markdown, no explanation):
{{
  "outcome": "showed_benefit|no_benefit|mixed|inconclusive|basic_science",
  "plain_summary": "2-3 sentence explanation of what was studied and found, written for a CH patient with no medical background",
  "key_finding": "single sentence - the most important result with numbers if available",
  "sample_size": null,
  "study_type": "rct|observational|case_report|review|meta_analysis|basic_science|other",
  "evidence_tier": 3,
  "interventions_studied": ["treatment1"]
}}

Evidence tier guide:
1 = meta-analysis or systematic review combining multiple studies
2 = randomized controlled trial (RCT)
3 = observational study or cohort
4 = case series (multiple patients, no control)
5 = case report, editorial, basic science, or lab research

For outcome:
- showed_benefit = the treatment clearly helped patients
- no_benefit = the treatment did not help
- mixed = some benefit but not convincing
- inconclusive = results unclear or too early
- basic_science = no treatment was tested (lab research, imaging, genetics)"""


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


def analyze_papers(conn, api_key, base_url, model):
    """AI analysis of papers with abstracts/full text."""
    ensure_pa_analyses_table(conn)

    existing = set(
        r[0] for r in conn.execute("SELECT pmid FROM pa_analyses WHERE analysis_source = 'ai'").fetchall()
    )

    cursor = conn.execute("""
        SELECT pmid, title, authors, journal, pub_date, abstract,
               abstract_structured, full_text_sections, category, mesh_terms
        FROM pa_papers
        WHERE abstract IS NOT NULL AND abstract != ''
    """)
    papers = cursor.fetchall()
    new_papers = [p for p in papers if p[0] not in existing]

    if not new_papers:
        print("  No new papers to analyze")
        return

    print(f"  Analyzing {len(new_papers)} papers with LLM...")

    for i, paper in enumerate(new_papers):
        pmid, title, authors, journal, pub_date, abstract, abstract_structured, full_text_sections, category, mesh_terms = paper
        year = (pub_date or "")[:4]

        # Pick richest content
        content = ""
        if full_text_sections:
            try:
                sections = json.loads(full_text_sections)
                content = "\n\n".join(f"[{k.upper()}]\n{v}" for k, v in sections.items())
            except Exception:
                content = abstract or ""
        elif abstract_structured:
            try:
                sections = json.loads(abstract_structured)
                content = "\n\n".join(f"[{k.upper()}]\n{v}" for k, v in sections.items())
            except Exception:
                content = abstract or ""
        else:
            content = abstract or ""

        if len(content.strip()) < 50:
            continue

        prompt = PAPER_PROMPT.format(
            title=title or "",
            authors=authors or "",
            journal=journal or "",
            year=year,
            category=category or "",
            mesh_terms=mesh_terms or "[]",
            content=content[:8000],
        )

        try:
            result = call_llm(prompt, api_key, base_url, model)
            conn.execute(
                "INSERT OR REPLACE INTO pa_analyses VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    pmid,
                    result.get("outcome", "inconclusive"),
                    result.get("plain_summary"),
                    result.get("key_finding"),
                    result.get("sample_size"),
                    result.get("study_type", "other"),
                    result.get("evidence_tier", 5),
                    json.dumps(result.get("interventions_studied", [])),
                    "ai",
                ),
            )
            conn.commit()
            if (i + 1) % 50 == 0:
                print(f"    Analyzed {i + 1}/{len(new_papers)} papers")
        except Exception as e:
            print(f"    Error analyzing PMID {pmid}: {e}")

        time.sleep(1)

    print(f"  Completed AI analysis of papers")


def analyze_new_trials(db_path, api_key, base_url, model):
    """Find trials without analyses and analyze them."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    ensure_tr_analyses_table(conn)
    seed_from_json(conn)

    # Load existing analyses from DB
    rows = conn.execute("SELECT nct_id, what_tested, key_result, verdict, patient_relevance, dose_tested, sample_size FROM tr_analyses").fetchall()
    existing = {r[0]: {
        "nct_id": r[0], "what_tested": r[1], "key_result": r[2],
        "verdict": r[3], "patient_relevance": r[4], "dose_tested": r[5],
        "sample_size": r[6],
    } for r in rows}

    # Get all trials from DB
    trials = conn.execute("""
        SELECT nct_id, title, status, phase, sponsor, enrollment,
               start_date, end_date, summary, category, raw_json
        FROM tr_trials
    """).fetchall()

    # Find new trials
    new_trials = [t for t in trials if t["nct_id"] not in existing]

    if not new_trials:
        conn.close()
        print("  No new trials to analyze")
        return 0

    print(f"  Found {len(new_trials)} new trials to analyze")

    analyzed = 0
    new_analyses = []
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
            new_analyses.append(result)
            analyzed += 1
            time.sleep(1)  # Rate limit courtesy
        except Exception as e:
            print(f"    ERROR: {e}")
            # Add placeholder
            new_analyses.append({
                "nct_id": t["nct_id"],
                "what_tested": t["summary"][:150] if t["summary"] else "Analysis pending",
                "key_result": "Automated analysis failed — manual review needed",
                "verdict": "unknown",
                "patient_relevance": "Check ClinicalTrials.gov for details",
                "dose_tested": None,
                "sample_size": t["enrollment"],
            })

    # Write new analyses to DB
    for a in new_analyses:
        conn.execute(
            "INSERT OR REPLACE INTO tr_analyses VALUES (?,?,?,?,?,?,?)",
            (a["nct_id"], a["what_tested"], a["key_result"], a["verdict"],
             a["patient_relevance"], a["dose_tested"], a.get("sample_size")),
        )
    conn.commit()
    conn.close()

    total = len(existing) + len(new_analyses)  # existing = pre-existing rows, new_analyses = just added
    print(f"  Analyzed {analyzed} new trials ({total} total)")
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

    # Paper AI analysis
    conn = sqlite3.connect(args.db)
    ensure_pa_analyses_table(conn)
    analyze_papers(conn, args.api_key, args.base_url, args.model)
    conn.close()

    print(f"\n=== LLM Analysis Complete ({new_count} new analyses) ===")


if __name__ == "__main__":
    main()
