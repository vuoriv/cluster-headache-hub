#!/usr/bin/env python3
"""
Deep Research Analysis Pipeline

Analyzes all papers and trials in data.db to extract:
- Study type (RCT, observational, review, meta-analysis, case report, etc.)
- Result (positive, negative, mixed, inconclusive, ongoing)
- Key finding summary
- Sample size
- Evidence quality tier

Usage:
  python scripts/analyze-research.py [--db PATH]
"""

import argparse
import json
import os
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_DB = os.path.join(PROJECT_ROOT, "public", "data.db")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "src", "data", "research-insights")

# ── Study Type Classification ──

STUDY_TYPE_PATTERNS = [
    ("meta-analysis", re.compile(r"meta.analysis|systematic.review.*meta|pooled.analysis", re.I)),
    ("systematic-review", re.compile(r"systematic.review|cochrane|prisma|systematic.literature", re.I)),
    ("rct", re.compile(r"random\w+.control|RCT|placebo.control|double.blind|single.blind|crossover.trial|phase.[234].*trial", re.I)),
    ("clinical-trial", re.compile(r"clinical.trial|open.label|pilot.study|feasibility.study|phase.[1234]", re.I)),
    ("observational", re.compile(r"observational|prospective.study|retrospective.study|cohort.study|cross.sectional|longitudinal", re.I)),
    ("case-series", re.compile(r"case.series|consecutive.patients|series.of.\d+", re.I)),
    ("case-report", re.compile(r"case.report|case.presentation|a.case.of|we.report.a.case|single.case", re.I)),
    ("review", re.compile(r"narrative.review|literature.review|review.of|comprehensive.review|overview|update.on", re.I)),
    ("guideline", re.compile(r"guideline|consensus|recommendation|expert.opinion|position.statement", re.I)),
    ("basic-science", re.compile(r"in.vitro|animal.model|rat|mouse|neuroimaging|fMRI|PET.scan|biomarker|genetic|GWAS|genome", re.I)),
    ("protocol", re.compile(r"study.protocol|trial.protocol|design.and.rationale|planned.study", re.I)),
    ("editorial", re.compile(r"editorial|commentary|letter.to|correspondence|reply.to|comment.on", re.I)),
]

# ── Result Classification ──

POSITIVE_PATTERNS = re.compile(
    r"effective|efficac|significant.reduction|significant.improvement|superior.to|pain.free|"
    r"reduced.frequency|reduced.severity|beneficial|safe.and.effective|well.tolerat|"
    r"primary.endpoint.met|statistically.significant|abort\w+.within|remission|"
    r"promising|favorable|successful", re.I
)

NEGATIVE_PATTERNS = re.compile(
    r"no.significant|not.significant|failed.to|did.not.meet|ineffective|no.difference|"
    r"no.benefit|no.improvement|negative.result|not.superior|no.effect|"
    r"discontinued|terminated|withdrawn|not.recommended", re.I
)

MIXED_PATTERNS = re.compile(
    r"mixed.result|some.improvement|partial|modest|marginal|inconsistent|"
    r"secondary.endpoint|subgroup.analysis|trend.toward", re.I
)

# ── Sample Size Extraction ──

SAMPLE_SIZE_PATTERNS = [
    re.compile(r"n\s*=\s*(\d+)", re.I),
    re.compile(r"(\d+)\s*patients", re.I),
    re.compile(r"(\d+)\s*participants", re.I),
    re.compile(r"(\d+)\s*subjects", re.I),
    re.compile(r"enrolled\s*(\d+)", re.I),
    re.compile(r"sample.*?(\d+)", re.I),
]


def classify_study_type(title, abstract):
    """Classify the study type from title and abstract text."""
    text = f"{title} {abstract}"
    for study_type, pattern in STUDY_TYPE_PATTERNS:
        if pattern.search(text):
            return study_type
    return "other"


def classify_result(abstract):
    """Classify study result as positive, negative, mixed, or inconclusive."""
    if not abstract:
        return "unknown"

    # Look at conclusion section if structured
    conclusion = abstract
    conclusion_match = re.search(r"(?:CONCLUSION|RESULTS|FINDINGS)[S:]?\s*(.*)", abstract, re.I)
    if conclusion_match:
        conclusion = conclusion_match.group(1)

    pos = len(POSITIVE_PATTERNS.findall(conclusion))
    neg = len(NEGATIVE_PATTERNS.findall(conclusion))
    mix = len(MIXED_PATTERNS.findall(conclusion))

    if pos > 0 and neg == 0:
        return "positive"
    elif neg > 0 and pos == 0:
        return "negative"
    elif pos > 0 and neg > 0:
        return "mixed"
    elif mix > 0:
        return "mixed"
    elif pos > 0:
        return "positive"
    return "inconclusive"


def extract_sample_size(text):
    """Extract sample size from abstract."""
    for pattern in SAMPLE_SIZE_PATTERNS:
        match = pattern.search(text)
        if match:
            n = int(match.group(1))
            if 2 <= n <= 100000:  # reasonable range
                return n
    return None


def compute_evidence_tier(study_type, sample_size, year):
    """Compute evidence quality tier (1=highest, 5=lowest)."""
    type_tier = {
        "meta-analysis": 1, "systematic-review": 1,
        "rct": 2, "clinical-trial": 2,
        "observational": 3, "case-series": 3,
        "case-report": 4, "review": 3, "guideline": 2,
        "basic-science": 4, "protocol": 5, "editorial": 5, "other": 5,
    }
    tier = type_tier.get(study_type, 5)

    # Boost for large sample sizes
    if sample_size and sample_size >= 100:
        tier = max(1, tier - 1)

    # Penalize very old studies slightly
    try:
        if year and int(year) < 2010:
            tier = min(5, tier + 1)
    except (ValueError, TypeError):
        pass

    return tier


def analyze_papers(db_path):
    """Analyze all papers and return structured results."""
    print("Analyzing papers...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    papers = conn.execute(
        "SELECT pmid, title, abstract, category, pub_date, relevance_score FROM pa_papers"
    ).fetchall()

    results = []
    study_types = Counter()
    result_counts = Counter()
    category_results = defaultdict(Counter)
    category_types = defaultdict(Counter)
    year_counts = Counter()
    evidence_tiers = Counter()
    category_evidence = defaultdict(list)
    papers_per_year_by_cat = defaultdict(lambda: defaultdict(int))

    for p in papers:
        title = p["title"] or ""
        abstract = p["abstract"] or ""
        text = f"{title} {abstract}"
        year = p["pub_date"][:4] if p["pub_date"] else None

        study_type = classify_study_type(title, abstract)
        result = classify_result(abstract) if abstract else "unknown"
        sample_size = extract_sample_size(text)
        tier = compute_evidence_tier(study_type, sample_size, year)

        study_types[study_type] += 1
        result_counts[result] += 1
        category_results[p["category"]][result] += 1
        category_types[p["category"]][study_type] += 1
        evidence_tiers[tier] += 1
        category_evidence[p["category"]].append(tier)

        if year:
            year_counts[year] += 1
            papers_per_year_by_cat[p["category"]][year] += 1

        results.append({
            "pmid": p["pmid"],
            "study_type": study_type,
            "result": result,
            "sample_size": sample_size,
            "evidence_tier": tier,
        })

    conn.close()

    # Aggregate stats
    total = len(papers)
    with_abstract = sum(1 for p in papers if p["abstract"])

    # Category evidence quality (avg tier)
    cat_avg_evidence = {}
    for cat, tiers in category_evidence.items():
        cat_avg_evidence[cat] = round(sum(tiers) / len(tiers), 2) if tiers else 5

    print(f"  Analyzed {total} papers ({with_abstract} with abstracts)")
    print(f"  Study types: {dict(study_types.most_common(5))}")
    print(f"  Results: {dict(result_counts.most_common())}")

    return {
        "papers": results,
        "stats": {
            "total_papers": total,
            "with_abstracts": with_abstract,
            "study_type_distribution": [
                {"type": t, "count": c} for t, c in study_types.most_common()
            ],
            "result_distribution": [
                {"result": r, "count": c} for r, c in result_counts.most_common()
            ],
            "evidence_tier_distribution": [
                {"tier": t, "count": c} for t, c in sorted(evidence_tiers.items())
            ],
            "papers_per_year": dict(sorted(year_counts.items())),
            "category_results": {
                cat: [{"result": r, "count": c} for r, c in counts.most_common()]
                for cat, counts in category_results.items()
            },
            "category_study_types": {
                cat: [{"type": t, "count": c} for t, c in counts.most_common()]
                for cat, counts in category_types.items()
            },
            "category_avg_evidence": cat_avg_evidence,
            "research_volume_by_category": {
                cat: dict(sorted(years.items()))
                for cat, years in papers_per_year_by_cat.items()
            },
        },
    }


def analyze_trials(db_path):
    """Analyze trial data for additional insights."""
    print("Analyzing trials...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    trials = conn.execute(
        "SELECT nct_id, title, status, phase, study_type, sponsor, "
        "enrollment, start_date, end_date, category, summary FROM tr_trials"
    ).fetchall()
    conn.close()

    status_counts = Counter()
    category_counts = Counter()
    phase_counts = Counter()
    sponsor_counts = Counter()
    enrollment_by_cat = defaultdict(list)

    for t in trials:
        status_counts[t["status"]] += 1
        category_counts[t["category"]] += 1

        phases = json.loads(t["phase"]) if t["phase"] else []
        for ph in phases:
            phase_counts[ph] += 1

        if t["sponsor"]:
            sponsor_counts[t["sponsor"]] += 1

        if t["enrollment"] and t["category"]:
            enrollment_by_cat[t["category"]].append(t["enrollment"])

    avg_enrollment = {}
    for cat, enrollments in enrollment_by_cat.items():
        avg_enrollment[cat] = round(sum(enrollments) / len(enrollments))

    print(f"  Analyzed {len(trials)} trials")

    return {
        "total_trials": len(trials),
        "status_distribution": [{"status": s, "count": c} for s, c in status_counts.most_common()],
        "category_distribution": [{"category": c, "count": n} for c, n in category_counts.most_common()],
        "phase_distribution": [{"phase": p, "count": c} for p, c in phase_counts.most_common()],
        "top_sponsors": [{"sponsor": s, "count": c} for s, c in sponsor_counts.most_common(15)],
        "avg_enrollment_by_category": avg_enrollment,
    }


def store_analyses(db_path, paper_analyses):
    """Store per-paper analysis results in the database."""
    print("Storing paper analyses...")
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pa_analyses (
            pmid TEXT PRIMARY KEY,
            study_type TEXT,
            result TEXT,
            sample_size INTEGER,
            evidence_tier INTEGER,
            analysis_source TEXT DEFAULT 'regex'
        )
    """)
    conn.execute("DELETE FROM pa_analyses")

    for p in paper_analyses:
        conn.execute(
            "INSERT INTO pa_analyses VALUES (?, ?, ?, ?, ?, ?)",
            (p["pmid"], p["study_type"], p["result"], p["sample_size"], p["evidence_tier"], 'regex'),
        )

    conn.commit()
    conn.close()
    print(f"  Stored {len(paper_analyses)} analyses")


def main():
    parser = argparse.ArgumentParser(description="Deep Research Analysis")
    parser.add_argument("--db", default=DEFAULT_DB)
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=== Deep Research Analysis ===\n")

    # Analyze papers
    paper_data = analyze_papers(args.db)
    store_analyses(args.db, paper_data["papers"])

    # Analyze trials
    trial_data = analyze_trials(args.db)

    # Write insight files
    with open(os.path.join(OUTPUT_DIR, "paper-stats.json"), "w") as f:
        json.dump(paper_data["stats"], f, indent=2)
    print(f"\n  Wrote paper-stats.json")

    with open(os.path.join(OUTPUT_DIR, "trial-stats.json"), "w") as f:
        json.dump(trial_data, f, indent=2)
    print(f"  Wrote trial-stats.json")

    print("\n=== Analysis Complete ===")


if __name__ == "__main__":
    main()
