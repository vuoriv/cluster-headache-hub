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
            analysis_source TEXT DEFAULT 'ai',
            primary_interventions TEXT,
            comparator_interventions TEXT,
            topics TEXT
        )
    """)
    for col, coltype in [
        ("outcome", "TEXT"),
        ("plain_summary", "TEXT"),
        ("key_finding", "TEXT"),
        ("interventions_studied", "TEXT"),
        ("primary_interventions", "TEXT"),
        ("comparator_interventions", "TEXT"),
        ("topics", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE pa_analyses ADD COLUMN {col} {coltype}")
        except Exception:
            pass
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


def ensure_analysis_errors_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rs_analysis_errors (
            id TEXT PRIMARY KEY,
            error TEXT,
            timestamp TEXT,
            retry_count INTEGER DEFAULT 0
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
    print(f"  Seeded {len(analyses)} trial analyses from JSON", flush=True)


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
  "interventions_studied": ["treatment1"],
  "primary_interventions": ["Treatment Name"],
  "comparator_interventions": ["Placebo"],
  "topics": []
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
- basic_science = no treatment was tested (lab research, imaging, genetics)

For primary_interventions:
- Treatments/interventions THIS PAPER ACTUALLY STUDIES or evaluates
- Use canonical drug names (e.g., "Psilocybin" not "psilocybin mushroom", "LSD" not "lysergic acid diethylamide")
- Empty array if no specific treatment is studied (e.g., epidemiology paper)

For comparator_interventions:
- Treatments mentioned as controls, alternatives, or background context
- NOT the focus of the study — just referenced for comparison
- e.g., a psilocybin study that compares against verapamil: primary=["Psilocybin"], comparator=["Verapamil", "Placebo"]

For topics:
- Non-treatment research themes: epidemiology, quality of life, sleep, comorbidity, genetics, chronobiology, depression, anxiety, diagnosis, prevalence, gender differences, smoking, alcohol, suicide, disability, classification, exercise, photophobia
- Only include if the topic is a MAIN FOCUS of the paper, not just mentioned
- Empty array for treatment-focused papers"""


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
            "max_tokens": 4096,
            "temperature": 0.1,
        },
        timeout=30,
    )

    if response.status_code == 429:
        # Rate limited — wait and retry once
        time.sleep(10)
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
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


BATCH_CLASSIFY_PROMPT = """You are classifying research papers about cluster headache. For EACH paper below, identify the primary interventions studied, any comparator/control interventions, and research topics.

{papers_block}

Respond with ONLY a JSON array (no markdown, no explanation). One object per paper, in the same order:
[
  {{
    "pmid": "12345678",
    "primary_interventions": ["Treatment Name"],
    "comparator_interventions": ["Placebo"],
    "topics": [],
    "study_type": "rct|observational|case_report|review|meta_analysis|basic_science|other",
    "outcome": "showed_benefit|no_benefit|mixed|inconclusive|basic_science",
    "evidence_tier": 3
  }}
]

Rules:
- primary_interventions: treatments THIS PAPER ACTUALLY STUDIES. Use canonical names (e.g., "Psilocybin" not "psilocybin mushroom", "LSD" not "lysergic acid diethylamide"). Empty if no treatment studied.
- comparator_interventions: treatments mentioned as controls or context only. NOT the study focus.
- topics: non-treatment themes (epidemiology, quality of life, sleep, comorbidity, genetics, chronobiology, depression, anxiety, diagnosis, prevalence, gender differences, smoking, alcohol, suicide, disability, classification, exercise, photophobia). Only if a MAIN FOCUS. Empty for treatment papers.
- evidence_tier: 1=meta-analysis, 2=RCT, 3=observational, 4=case series, 5=case report/editorial/basic science
- outcome: showed_benefit|no_benefit|mixed|inconclusive|basic_science"""


BATCH_SIZE = 50


def classify_papers_batch(conn, api_key, base_url, model):
    """Fast batch classification of papers — primary interventions, topics, study type.

    Sends batches of 20 papers (title + MeSH only) per API call.
    Much faster than per-paper analysis: ~170 calls vs ~3400.
    """
    ensure_pa_analyses_table(conn)
    ensure_analysis_errors_table(conn)

    # Find papers that need classification (no primary_interventions yet)
    existing = set()
    try:
        existing = set(
            r[0] for r in conn.execute(
                "SELECT pmid FROM pa_analyses WHERE primary_interventions IS NOT NULL AND primary_interventions != '[]'"
            ).fetchall()
        )
    except Exception:
        pass

    cursor = conn.execute("""
        SELECT pmid, title, category, mesh_terms, author_keywords
        FROM pa_papers
        WHERE title IS NOT NULL AND title != ''
    """)
    all_papers = cursor.fetchall()
    papers_to_classify = [p for p in all_papers if p[0] not in existing]

    if not papers_to_classify:
        print("  No papers need batch classification", flush=True)
        return

    print(f"  Batch classifying {len(papers_to_classify)} papers ({BATCH_SIZE} per call)...", flush=True)

    classified = 0
    for batch_start in range(0, len(papers_to_classify), BATCH_SIZE):
        batch = papers_to_classify[batch_start:batch_start + BATCH_SIZE]

        # Build compact paper descriptions
        paper_lines = []
        for pmid, title, category, mesh_json, kw_json in batch:
            mesh = ""
            try:
                terms = json.loads(mesh_json or "[]")
                if terms:
                    mesh = f" | MeSH: {', '.join(terms[:10])}"
            except Exception:
                pass
            kw = ""
            try:
                terms = json.loads(kw_json or "[]")
                if terms:
                    kw = f" | Keywords: {', '.join(terms[:5])}"
            except Exception:
                pass
            paper_lines.append(f"- PMID {pmid} [{category}]: {title}{mesh}{kw}")

        papers_block = "\n".join(paper_lines)
        prompt = BATCH_CLASSIFY_PROMPT.format(papers_block=papers_block)

        try:
            results = call_llm(prompt, api_key, base_url, model)
        except Exception as e:
            try:
                time.sleep(5)
                results = call_llm(prompt, api_key, base_url, model)
            except Exception as e2:
                print(f"    Batch error at {batch_start}: {e2}", flush=True)
                for p in batch:
                    conn.execute(
                        "INSERT OR REPLACE INTO rs_analysis_errors (id, error, timestamp, retry_count) VALUES (?, ?, datetime('now'), COALESCE((SELECT retry_count FROM rs_analysis_errors WHERE id = ?), 0) + 1)",
                        (p[0], f"Batch classify failed: {e2}", p[0]),
                    )
                conn.commit()
                time.sleep(2)
                continue

        if not isinstance(results, list):
            print(f"    Warning: batch at {batch_start} returned non-list, skipping", flush=True)
            continue

        # Match results to papers by pmid
        result_map = {}
        for r in results:
            if isinstance(r, dict) and "pmid" in r:
                result_map[str(r["pmid"])] = r

        for pmid, title, category, mesh_json, kw_json in batch:
            r = result_map.get(pmid)
            if not r:
                continue

            # Check if paper already has a full analysis (from previous detailed run)
            existing_row = conn.execute(
                "SELECT analysis_source, plain_summary FROM pa_analyses WHERE pmid = ?", (pmid,)
            ).fetchone()

            if existing_row and existing_row[1]:
                # Has detailed analysis — only update classification fields
                conn.execute(
                    "UPDATE pa_analyses SET primary_interventions = ?, comparator_interventions = ?, topics = ? WHERE pmid = ?",
                    (
                        json.dumps(r.get("primary_interventions", [])),
                        json.dumps(r.get("comparator_interventions", [])),
                        json.dumps(r.get("topics", [])),
                        pmid,
                    ),
                )
            else:
                # No detailed analysis — insert batch classification
                conn.execute(
                    "INSERT OR REPLACE INTO pa_analyses (pmid, outcome, study_type, evidence_tier, analysis_source, primary_interventions, comparator_interventions, topics) VALUES (?,?,?,?,?,?,?,?)",
                    (
                        pmid,
                        r.get("outcome", "inconclusive"),
                        r.get("study_type", "other"),
                        r.get("evidence_tier", 5),
                        "ai-batch",
                        json.dumps(r.get("primary_interventions", [])),
                        json.dumps(r.get("comparator_interventions", [])),
                        json.dumps(r.get("topics", [])),
                    ),
                )

            conn.execute("DELETE FROM rs_analysis_errors WHERE id = ?", (pmid,))
            classified += 1

        conn.commit()

        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(papers_to_classify) + BATCH_SIZE - 1) // BATCH_SIZE
        if batch_num % 10 == 0 or batch_num == total_batches:
            print(f"    Batch {batch_num}/{total_batches} ({classified} classified)", flush=True)

        time.sleep(2)

    error_count = conn.execute("SELECT COUNT(*) FROM rs_analysis_errors").fetchone()[0]
    if error_count:
        print(f"  Warning: {error_count} papers have errors (see rs_analysis_errors)", flush=True)

    print(f"  Batch classification complete: {classified} papers classified", flush=True)


def analyze_papers(conn, api_key, base_url, model):
    """Detailed AI analysis of papers — plain_summary, key_finding, sample_size.

    Only processes papers that don't have a detailed analysis yet.
    Papers with batch classification (ai-batch) are skipped — they already
    have primary_interventions/topics which is what subcategories need.
    """
    ensure_pa_analyses_table(conn)

    existing = set(
        r[0] for r in conn.execute("SELECT pmid FROM pa_analyses WHERE analysis_source IN ('ai', 'ai-batch')").fetchall()
    )

    # Re-queue previously failed papers for retry
    ensure_analysis_errors_table(conn)
    failed_pmids = set(
        r[0] for r in conn.execute("SELECT id FROM rs_analysis_errors WHERE retry_count < 3").fetchall()
    )
    if failed_pmids:
        print(f"  Retrying {len(failed_pmids)} previously failed papers", flush=True)
        existing -= failed_pmids

    cursor = conn.execute("""
        SELECT pmid, title, authors, journal, pub_date, abstract,
               abstract_structured, full_text_sections, category, mesh_terms
        FROM pa_papers
        WHERE abstract IS NOT NULL AND abstract != ''
    """)
    papers = cursor.fetchall()
    new_papers = [p for p in papers if p[0] not in existing]

    if not new_papers:
        print("  No new papers to analyze", flush=True)
        return

    print(f"  Analyzing {len(new_papers)} papers with LLM...", flush=True)

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
        except Exception as e:
            # Retry once after 2s
            try:
                time.sleep(2)
                result = call_llm(prompt, api_key, base_url, model)
            except Exception as e2:
                ensure_analysis_errors_table(conn)
                conn.execute(
                    "INSERT OR REPLACE INTO rs_analysis_errors (id, error, timestamp, retry_count) VALUES (?, ?, datetime('now'), COALESCE((SELECT retry_count FROM rs_analysis_errors WHERE id = ?), 0) + 1)",
                    (pmid, str(e2), pmid),
                )
                conn.commit()
                print(f"    Error analyzing PMID {pmid} (retry failed): {e2}", flush=True)
                time.sleep(2)
                continue

        if not isinstance(result, dict):
            print(f"    Warning: PMID {pmid} returned non-dict, skipping", flush=True)
            continue

        conn.execute(
            "INSERT OR REPLACE INTO pa_analyses (pmid, outcome, plain_summary, key_finding, sample_size, study_type, evidence_tier, interventions_studied, analysis_source, primary_interventions, comparator_interventions, topics) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
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
                json.dumps(result.get("primary_interventions", [])),
                json.dumps(result.get("comparator_interventions", [])),
                json.dumps(result.get("topics", [])),
            ),
        )
        conn.commit()
        conn.execute("DELETE FROM rs_analysis_errors WHERE id = ?", (pmid,))

        if (i + 1) % 50 == 0:
            print(f"    Analyzed {i + 1}/{len(new_papers)} papers", flush=True)

        time.sleep(2)

    error_count = conn.execute("SELECT COUNT(*) FROM rs_analysis_errors").fetchone()[0]
    if error_count:
        print(f"  Warning: {error_count} papers have analysis errors (see rs_analysis_errors table)", flush=True)

    print(f"  Completed AI analysis of papers", flush=True)


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
        print("  No new trials to analyze", flush=True)
        return 0

    print(f"  Found {len(new_trials)} new trials to analyze", flush=True)

    analyzed = 0
    new_analyses = []
    for t in new_trials:
        print(f"  Analyzing {t['nct_id']}: {t['title'][:60]}...", flush=True)

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
            time.sleep(2)  # Rate limit courtesy
        except Exception as e:
            print(f"    ERROR: {e}", flush=True)
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
    print(f"  Analyzed {analyzed} new trials ({total} total)", flush=True)
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
        print("ERROR: No API key. Set CEREBRAS_API_KEY or use --api-key", flush=True)
        sys.exit(1)

    print("=== LLM Analysis (Cerebras/Qwen3) ===\n", flush=True)

    # Test API connection
    print("  Testing API connection...", flush=True)
    try:
        test = call_llm("Respond with only: {\"status\": \"ok\"}", args.api_key, args.base_url, args.model)
        print(f"  API OK: {test}\n", flush=True)
    except Exception as e:
        print(f"  API test failed: {e}", flush=True)
        sys.exit(1)

    # Analyze new trials
    new_count = analyze_new_trials(args.db, args.api_key, args.base_url, args.model)

    # Fast batch classification (primary_interventions, topics, study_type)
    conn = sqlite3.connect(args.db)
    ensure_pa_analyses_table(conn)
    classify_papers_batch(conn, args.api_key, args.base_url, args.model)
    conn.close()

    # Detailed per-paper analysis (plain_summary, key_finding) — runs incrementally
    conn = sqlite3.connect(args.db)
    ensure_pa_analyses_table(conn)
    analyze_papers(conn, args.api_key, args.base_url, args.model)
    conn.close()

    print(f"\n=== LLM Analysis Complete ({new_count} new analyses) ===", flush=True)


if __name__ == "__main__":
    main()
