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

import time

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
    print("Analyzing papers...", flush=True)
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

    print(f"  Analyzed {total} papers ({with_abstract} with abstracts)", flush=True)
    print(f"  Study types: {dict(study_types.most_common(5))}", flush=True)
    print(f"  Results: {dict(result_counts.most_common())}", flush=True)

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
    print("Analyzing trials...", flush=True)
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

    print(f"  Analyzed {len(trials)} trials", flush=True)

    return {
        "total_trials": len(trials),
        "status_distribution": [{"status": s, "count": c} for s, c in status_counts.most_common()],
        "category_distribution": [{"category": c, "count": n} for c, n in category_counts.most_common()],
        "phase_distribution": [{"phase": p, "count": c} for p, c in phase_counts.most_common()],
        "top_sponsors": [{"sponsor": s, "count": c} for s, c in sponsor_counts.most_common(15)],
        "avg_enrollment_by_category": avg_enrollment,
    }


def build_paper_trial_links(conn):
    """Build cross-links between papers and trials."""
    conn.execute("DROP TABLE IF EXISTS rs_paper_trial_links")
    conn.execute("""
        CREATE TABLE rs_paper_trial_links (
            pmid TEXT NOT NULL,
            nct_id TEXT NOT NULL,
            link_type TEXT NOT NULL,
            PRIMARY KEY (pmid, nct_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rs_links_nct ON rs_paper_trial_links(nct_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rs_links_pmid ON rs_paper_trial_links(pmid)")

    # Confirmed links: papers citing NCT IDs
    cursor = conn.execute(
        "SELECT pmid, nct_ids_cited FROM pa_papers WHERE nct_ids_cited IS NOT NULL"
    )
    trial_ids = set(r[0] for r in conn.execute("SELECT nct_id FROM tr_trials").fetchall())

    confirmed = 0
    for pmid, nct_json in cursor.fetchall():
        try:
            nct_ids = json.loads(nct_json)
        except Exception:
            continue
        for nct_id in nct_ids:
            if nct_id in trial_ids:
                conn.execute(
                    "INSERT OR IGNORE INTO rs_paper_trial_links VALUES (?, ?, 'confirmed')",
                    (pmid, nct_id),
                )
                confirmed += 1

    # Related links: same category + overlapping interventions
    # interventions_studied column only exists after AI analysis — skip if not present
    has_interventions_col = False
    try:
        conn.execute("SELECT interventions_studied FROM pa_analyses LIMIT 1")
        has_interventions_col = True
    except Exception:
        pass

    if not has_interventions_col:
        conn.commit()
        print(f"  Built {confirmed} confirmed + 0 related paper-trial links (no AI analysis yet)", flush=True)
        return

    cursor = conn.execute("""
        SELECT p.pmid, p.category, a.interventions_studied, t.nct_id, t.interventions
        FROM pa_papers p
        JOIN pa_analyses a ON p.pmid = a.pmid
        JOIN tr_trials t ON p.category = t.category
        WHERE a.interventions_studied IS NOT NULL
          AND t.interventions IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM rs_paper_trial_links l
              WHERE l.pmid = p.pmid AND l.nct_id = t.nct_id
          )
    """)

    related = 0
    for row in cursor.fetchall():
        pmid, category, paper_ints_json, nct_id, trial_ints_json = row
        try:
            paper_ints = set(i.lower() for i in json.loads(paper_ints_json))
            trial_ints = set(i.lower() for i in json.loads(trial_ints_json))
        except Exception:
            continue
        if paper_ints & trial_ints:
            conn.execute(
                "INSERT OR IGNORE INTO rs_paper_trial_links VALUES (?, ?, 'related')",
                (pmid, nct_id),
            )
            related += 1

    conn.commit()
    print(f"  Built {confirmed} confirmed + {related} related paper-trial links", flush=True)


def _has_column(conn, table, column):
    """Check if a column exists in a table."""
    try:
        conn.execute(f"SELECT {column} FROM {table} LIMIT 1")
        return True
    except Exception:
        return False


def _result_expr(conn):
    """Return SQL expression for outcome/result depending on available columns."""
    if _has_column(conn, "pa_analyses", "outcome"):
        return "COALESCE(a.outcome, a.result)"
    return "a.result"


def build_category_stats(conn):
    """Build rs_category_stats table."""
    conn.execute("DROP TABLE IF EXISTS rs_category_stats")
    conn.execute("""
        CREATE TABLE rs_category_stats (
            category TEXT PRIMARY KEY,
            paper_count INTEGER,
            trial_count INTEGER,
            active_trial_count INTEGER,
            positive_outcome_count INTEGER,
            avg_evidence_tier REAL,
            oa_rate REAL,
            papers_linked_to_trials INTEGER,
            top_authors TEXT,
            top_institutions TEXT,
            papers_per_year TEXT,
            study_type_distribution TEXT,
            result_distribution TEXT
        )
    """)

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL UNION SELECT DISTINCT category FROM tr_trials WHERE category IS NOT NULL ORDER BY category"
    ).fetchall()]

    for cat in categories:
        paper_count = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE category = ?", (cat,)).fetchone()[0]
        trial_count = conn.execute("SELECT COUNT(*) FROM tr_trials WHERE category = ?", (cat,)).fetchone()[0]
        active_trial_count = conn.execute(
            "SELECT COUNT(*) FROM tr_trials WHERE category = ? AND status IN ('RECRUITING','NOT_YET_RECRUITING','ACTIVE_NOT_RECRUITING')",
            (cat,),
        ).fetchone()[0]

        # Use 'result' column (regex) or 'outcome' column (AI) depending on what exists
        positive_count = conn.execute(
            f"SELECT COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? AND ({_result_expr(conn)} IN ('positive', 'showed_benefit'))",
            (cat,),
        ).fetchone()[0]

        avg_tier = conn.execute(
            "SELECT AVG(a.evidence_tier) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? AND a.evidence_tier IS NOT NULL",
            (cat,),
        ).fetchone()[0] or 0

        oa_count = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE category = ? AND is_oa = 1", (cat,)).fetchone()[0]
        oa_rate = oa_count / paper_count if paper_count > 0 else 0

        linked = conn.execute(
            "SELECT COUNT(DISTINCT l.pmid) FROM rs_paper_trial_links l JOIN pa_papers p ON l.pmid = p.pmid WHERE p.category = ?",
            (cat,),
        ).fetchone()[0]

        # Top authors
        author_counts = Counter()
        for (authors_str,) in conn.execute("SELECT authors FROM pa_papers WHERE category = ? AND authors IS NOT NULL", (cat,)).fetchall():
            first = authors_str.split(",")[0].strip()
            if first and first != "et al.":
                author_counts[first] += 1
        top_authors = [{"name": n, "count": c} for n, c in author_counts.most_common(10)]

        # Top institutions
        inst_counts = Counter()
        for (affs_json,) in conn.execute("SELECT affiliations FROM pa_papers WHERE category = ? AND affiliations IS NOT NULL", (cat,)).fetchall():
            try:
                for aff in json.loads(affs_json):
                    parts = aff.split(",")
                    inst = parts[0].strip() if parts else aff
                    if len(inst) > 5:
                        inst_counts[inst] += 1
            except Exception:
                pass
        top_institutions = [{"name": n, "count": c} for n, c in inst_counts.most_common(10)]

        # Papers per year
        year_counts = {}
        for (pd,) in conn.execute("SELECT pub_date FROM pa_papers WHERE category = ? AND pub_date IS NOT NULL", (cat,)).fetchall():
            y = pd[:4]
            year_counts[y] = year_counts.get(y, 0) + 1

        # Study type distribution - handle both old (study_type) and new (study_type) columns
        study_types = conn.execute(
            "SELECT a.study_type, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? AND a.study_type IS NOT NULL GROUP BY a.study_type ORDER BY COUNT(*) DESC",
            (cat,),
        ).fetchall()
        study_type_dist = [{"type": t, "count": c} for t, c in study_types]

        # Result distribution - use outcome if available, fall back to result
        results = conn.execute(
            f"SELECT {_result_expr(conn)} as r, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? GROUP BY r ORDER BY COUNT(*) DESC",
            (cat,),
        ).fetchall()
        result_dist = [{"result": r, "count": c} for r, c in results]

        conn.execute(
            "INSERT INTO rs_category_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (cat, paper_count, trial_count, active_trial_count, positive_count,
             round(avg_tier, 2), round(oa_rate, 3), linked,
             json.dumps(top_authors), json.dumps(top_institutions),
             json.dumps(year_counts), json.dumps(study_type_dist), json.dumps(result_dist)),
        )

    conn.commit()
    print(f"  Built category stats for {len(categories)} categories", flush=True)


CATEGORY_RULES = {
    "psychedelic": {
        "desc": "Psychedelic and dissociative substances",
        "keep": "specific substance/compound names (Psilocybin, LSD, DMT, Ketamine, BOL-148, Mescaline, MDMA, etc.). ALSO keep ONE generic 'Psychedelics (general)' for terms about the class as a whole (Psychedelics, Hallucinogens, Classic psychedelics, etc.)",
        "remove": "non-substance terms like 'Self Medication', 'Alternative treatments', 'Harm reduction', methodology terms.",
        "merge": "'Lysergic acid diethylamide' → 'LSD'. '2-bromo-lysergic acid diethylamide' → 'BOL-148'. 'Ketamine infusion' → 'Ketamine'. Strip dosages: '0.143 mg/kg Psilocybin' → 'Psilocybin'. Merge all generic class terms: 'Psychedelics' / 'Hallucinogens' / 'Classic psychedelics' / 'Classical psychedelics' → 'Psychedelics (general)'.",
    },
    "cgrp": {
        "desc": "CGRP-targeting treatments",
        "keep": "specific drug names (Galcanezumab, Erenumab, Fremanezumab, Eptinezumab, Rimegepant, Atogepant). Keep ONE 'CGRP therapies (general)' for papers about the class as a whole.",
        "remove": "generic terms like 'monoclonal antibodies', 'preventive treatment', 'headache'. Remove non-drug terms.",
        "merge": "Brand names to generic: 'Emgality' → 'Galcanezumab', 'Aimovig' → 'Erenumab'. All class-level terms ('CGRP monoclonal antibodies', 'anti-CGRP', 'Calcitonin Gene-Related Peptide', 'CGRP inhibitors') → 'CGRP therapies (general)'. Merge receptor antagonist terms into 'Gepants'.",
    },
    "oxygen": {
        "desc": "Oxygen-based treatments",
        "keep": "oxygen delivery methods and related treatments (High-flow oxygen, Hyperbaric oxygen, Demand valve oxygen)",
        "remove": "terms that are not oxygen treatments. Keep ONLY oxygen-specific subcategories.",
        "merge": "'Oxygen Inhalation Therapy' → 'Oxygen therapy'. 'Hyperbaric oxygenation' → 'Hyperbaric oxygen therapy'.",
    },
    "pharmacology": {
        "desc": "Pharmaceutical drugs",
        "keep": "specific drug/compound names only (Verapamil, Lithium, Sumatriptan, Prednisone, Melatonin, Topiramate, etc.)",
        "remove": "generic drug classes when specific drugs exist ('Calcium Channel Blockers' if 'Verapamil' exists, 'Corticosteroids' if 'Prednisone' exists). Remove procedure terms ('Greater occipital nerve injection'). Remove non-drug terms.",
        "merge": "'Lithium Carbonate' / 'Lithium salts' → 'Lithium'. 'Prednisolone' → 'Prednisone' (same class). Strip dosages and routes.",
    },
    "nerve-block": {
        "desc": "Nerve blocks, injections, and procedural interventions",
        "keep": "specific procedures (Occipital nerve block, SPG block, Botulinum toxin, Steroid injection, Radiofrequency ablation, etc.). Keep ONE 'Nerve blocks (general)' for generic injection/procedure papers.",
        "remove": "drug-only terms that belong in pharmacology. Remove non-procedure terms.",
        "merge": "'Greater occipital nerve block' / 'GON block' / 'GON infiltration' → 'Occipital nerve block'. 'Sphenopalatine ganglion block' / 'SPG block' → 'SPG block'. 'Botulinum toxin' / 'Botulinum Toxin Type A' / 'OnabotulinumtoxinA' → 'Botulinum toxin'. Generic 'Nerve block' / 'injection' → 'Nerve blocks (general)'.",
    },
    "neuromodulation": {
        "desc": "Neuromodulation devices and stimulation techniques",
        "keep": "specific stimulation techniques (Deep brain stimulation, Vagus nerve stimulation, Occipital nerve stimulation, TMS, tDCS, gammaCore). Keep ONE 'Neuromodulation (general)' for papers about the field broadly.",
        "remove": "generic terms that don't name a technique ('Electric Stimulation', 'Neurostimulation'). Remove anatomical targets without technique ('Hypothalamus'). Remove non-neuromodulation terms.",
        "merge": "'Non-invasive vagus nerve stimulation' / 'gammaCore' / 'nVNS' → 'Non-invasive VNS'. 'Hypothalamic deep brain stimulation' / 'Hypothalamic stimulation' → 'Deep brain stimulation'. 'Transcutaneous electrical nerve stimulation' / 'TENS' → 'TENS'. 'Repetitive Transcranial Magnetic Stimulation' / 'TMS' → 'TMS'. Generic 'Neuromodulation' / 'Neurostimulation' → 'Neuromodulation (general)'.",
    },
    "non-pharma": {
        "desc": "Non-pharmacological approaches",
        "keep": "specific interventions (Acupuncture, Biofeedback, CBT, Exercise, Yoga, Meditation, Diet, etc.). Keep ONE 'Non-pharma (general)' for papers about alternative approaches broadly.",
        "remove": "vague terms ('Behavior', 'Psychology', 'Therapy', 'Lifestyle'). Remove terms that belong in other categories.",
        "merge": "'Cognitive behavioral therapy' / 'CBT' / 'Behavior Therapy' → 'CBT'. 'Physical exercise' / 'Aerobic exercise' → 'Exercise'. Generic approach terms → 'Non-pharma (general)'.",
    },
    "observational": {
        "desc": "Observational and epidemiological research topics",
        "keep": "specific research topics (Epidemiology, Genetics, Sleep, Circadian rhythm, Comorbidity, Quality of life, Gender differences, Pregnancy, etc.)",
        "remove": "generic methodology terms ('Cohort study', 'Retrospective', 'Survey'). Remove treatment names that belong in other categories.",
        "merge": "'Circadian rhythm' / 'Chronobiology' / 'Biological clocks' → 'Circadian rhythm'. 'Quality of Life' / 'Patient-reported outcomes' → 'Quality of life'.",
    },
    "vitamin-d": {
        "desc": "Vitamin D and related supplements",
        "keep": "specific supplements (Vitamin D3, Calcium, Magnesium, Omega-3)",
        "remove": "generic terms not related to supplementation.",
        "merge": "'Vitamin D' / 'Cholecalciferol' / 'Vitamin D3' → 'Vitamin D'.",
    },
    "other": {
        "desc": "General headache research, pathophysiology, neuroimaging, diagnosis",
        "keep": "specific research areas (Neuroimaging, Pathophysiology, Trigeminal system, Diagnostic criteria, Classification) or drug names not covered by other categories",
        "remove": "generic terms that could apply to any category ('Humans', 'Treatment', 'Disease').",
        "merge": "Merge imaging variants: 'fMRI' / 'Functional MRI' → 'fMRI'. Merge diagnostic terms.",
    },
}

CHUNK_SIZE = 100  # max terms per API call to avoid JSON truncation


def normalize_subcategory_terms(category, terms_with_counts, api_key, base_url, model):
    """Use AI to merge synonym terms and remove irrelevant ones for a category.

    Returns dict mapping original_term -> canonical_term (or None to remove).
    """
    import requests

    if not api_key or len(terms_with_counts) < 3:
        return {}

    rules = CATEGORY_RULES.get(category, {
        "desc": category,
        "keep": "terms specific to this category",
        "remove": "generic terms not specific to this category",
        "merge": "synonyms and variants of the same concept",
    })

    full_mapping = {}
    # Process in chunks to avoid JSON truncation on large categories
    for chunk_start in range(0, len(terms_with_counts), CHUNK_SIZE):
        chunk = terms_with_counts[chunk_start:chunk_start + CHUNK_SIZE]
        term_list = "\n".join(f"- {term} ({count})" for term, count in chunk)

        prompt = f"""Normalize these subcategory terms for the "{category}" research category.

Category: {rules['desc']}

Terms to normalize:
{term_list}

RULES — follow these exactly:

KEEP: {rules['keep']}
REMOVE (null): {rules['remove']}
MERGE examples: {rules['merge']}

General:
- Strip dosages, routes, formulations from drug names ("0.143 mg/kg Psilocybin" → "Psilocybin")
- Use the shortest well-known name as canonical ("Lysergic acid diethylamide" → "LSD")
- When merging, use the term with the highest count as canonical name
- Map EVERY input term to either a canonical name or null

Respond with ONLY a JSON object, no markdown:
{{"term1": "canonical", "term2": "canonical", "term3": null, ...}}"""

        try:
            body = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
                "temperature": 0.1,
            }
            resp = requests.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=body,
                timeout=90,
            )
            if resp.status_code != 200:
                print(f"    Normalization API error for {category} chunk {chunk_start}: {resp.status_code}", flush=True)
                continue

            text = resp.json()["choices"][0]["message"]["content"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            mapping = json.loads(text)
            if isinstance(mapping, dict):
                full_mapping.update(mapping)
        except Exception as e:
            print(f"    Normalization failed for {category} chunk {chunk_start}: {e}", flush=True)

    return full_mapping


def build_subcategories(conn, api_key=None, base_url=None, model=None):
    """Build rs_subcategories table from AI-classified paper interventions/topics.

    Reads primary_interventions and topics from pa_analyses (populated by
    llm-analyze.py). Each term is assigned to the category where it appears
    as a primary intervention/topic most often.
    """
    conn.execute("DROP TABLE IF EXISTS rs_subcategories")
    conn.execute("""
        CREATE TABLE rs_subcategories (
            category TEXT NOT NULL,
            term TEXT NOT NULL,
            paper_count INTEGER NOT NULL DEFAULT 0,
            trial_count INTEGER NOT NULL DEFAULT 0,
            search_terms TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (category, term)
        )
    """)

    # Check if AI analyses exist
    has_ai = False
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM pa_analyses WHERE primary_interventions IS NOT NULL"
        ).fetchone()[0]
        has_ai = count > 0
    except Exception:
        pass

    if not has_ai:
        print("  Skipping subcategories: no AI analyses with primary_interventions found", flush=True)
        print("  Run llm-analyze.py first to populate AI analyses", flush=True)
        return

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL "
        "UNION SELECT DISTINCT category FROM tr_trials WHERE category IS NOT NULL "
        "ORDER BY category"
    ).fetchall()]

    # First pass: collect term counts per category from AI analyses
    all_data = {}
    for cat in categories:
        term_paper_counts = Counter()

        for (pmid, pi_json, topics_json, mesh_json, kw_json) in conn.execute(
            """SELECT a.pmid, a.primary_interventions, a.topics, p.mesh_terms, p.author_keywords
               FROM pa_analyses a
               JOIN pa_papers p ON a.pmid = p.pmid
               WHERE p.category = ? AND a.primary_interventions IS NOT NULL""",
            (cat,),
        ).fetchall():
            canonical_terms = set()

            # Primary interventions
            try:
                for term in json.loads(pi_json or "[]"):
                    t = term.strip()
                    if t:
                        canonical_terms.add(t)
            except Exception:
                pass

            # Topics (for observational/non-pharma categories)
            try:
                for term in json.loads(topics_json or "[]"):
                    t = term.strip()
                    if t:
                        canonical_terms.add(t)
            except Exception:
                pass

            for canonical in canonical_terms:
                term_paper_counts[canonical] += 1

        # Trial interventions: normalize against known canonical names
        # Count each trial at most once per canonical term
        term_trial_counts = Counter()
        known_canonical = {t.lower(): t for t in term_paper_counts.keys()}

        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            if not interv_json:
                continue
            try:
                matched_in_trial = set()
                for intervention in json.loads(interv_json):
                    low = intervention.lower().strip()
                    if low in known_canonical:
                        matched_in_trial.add(known_canonical[low])
                    else:
                        for canon_low, canon in known_canonical.items():
                            if canon_low in low or low in canon_low:
                                matched_in_trial.add(canon)
                                break
                for canon in matched_in_trial:
                    term_trial_counts[canon] += 1
            except Exception:
                pass

        all_data[cat] = (term_paper_counts, term_trial_counts)

    # Normalize: merge case-insensitive duplicates across all categories
    # Pick the casing variant with the highest total count as the canonical display name
    global_variant_counts = Counter()  # exact_term -> total count across all cats
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            global_variant_counts[term] += tpc.get(term, 0) + ttc.get(term, 0)

    # Map lowercased -> best display name (highest count variant)
    low_to_canonical = {}
    for term, count in global_variant_counts.items():
        low = term.lower()
        if low not in low_to_canonical or count > global_variant_counts[low_to_canonical[low]]:
            low_to_canonical[low] = term

    # Re-aggregate using canonical names
    normalized_data = {}
    for cat, (tpc, ttc) in all_data.items():
        new_tpc = Counter()
        new_ttc = Counter()
        for term, count in tpc.items():
            canonical = low_to_canonical[term.lower()]
            new_tpc[canonical] += count
        for term, count in ttc.items():
            canonical = low_to_canonical[term.lower()]
            new_ttc[canonical] += count
        normalized_data[cat] = (new_tpc, new_ttc)
    all_data = normalized_data

    # Second pass: assign each term to its primary category (highest count)
    term_totals = defaultdict(lambda: defaultdict(int))
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            term_totals[term][cat] = tpc.get(term, 0) + ttc.get(term, 0)

    term_primary = {}
    for term, cat_counts in term_totals.items():
        term_primary[term] = max(cat_counts, key=cat_counts.get)

    # Build per-category assigned terms (only terms whose primary category is this one)
    assigned = defaultdict(lambda: (Counter(), Counter()))
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            if term_primary[term] != cat:
                continue
            assigned[cat][0][term] = tpc.get(term, 0)
            assigned[cat][1][term] = ttc.get(term, 0)

    # AI normalization: merge synonyms and remove irrelevant terms AFTER category assignment
    canonical_variants = defaultdict(set)  # canonical_lower -> {variant1_lower, ...}

    if api_key:
        print("  Normalizing subcategory terms with AI...", flush=True)
        for cat in sorted(assigned.keys()):
            tpc, ttc = assigned[cat]
            all_terms = set(tpc) | set(ttc)
            if len(all_terms) < 3:
                continue
            terms_with_counts = sorted(
                [(t, tpc.get(t, 0) + ttc.get(t, 0)) for t in all_terms],
                key=lambda x: -x[1],
            )
            mapping = normalize_subcategory_terms(cat, terms_with_counts, api_key, base_url, model)
            if not mapping:
                continue

            new_tpc = Counter()
            new_ttc = Counter()
            for term, count in tpc.items():
                canonical = mapping.get(term, term)
                if canonical is None:
                    continue
                new_tpc[canonical] += count
                canonical_variants[canonical.lower()].add(term.lower())
            for term, count in ttc.items():
                canonical = mapping.get(term, term)
                if canonical is None:
                    continue
                new_ttc[canonical] += count
                canonical_variants[canonical.lower()].add(term.lower())
            assigned[cat] = (new_tpc, new_ttc)
            before = len(all_terms)
            after = len(set(new_tpc) | set(new_ttc))
            if before != after:
                print(f"    {cat}: {before} → {after} terms", flush=True)
            time.sleep(1)

    # Re-merge case-insensitive duplicates introduced by AI normalization
    for cat in list(assigned.keys()):
        tpc, ttc = assigned[cat]
        # Find case variants and pick highest-count as display name
        low_to_best = {}
        for term in set(tpc) | set(ttc):
            low = term.lower()
            total = tpc.get(term, 0) + ttc.get(term, 0)
            if low not in low_to_best or total > (tpc.get(low_to_best[low], 0) + ttc.get(low_to_best[low], 0)):
                low_to_best[low] = term
        new_tpc = Counter()
        new_ttc = Counter()
        for term, count in tpc.items():
            best = low_to_best[term.lower()]
            new_tpc[best] += count
            canonical_variants[best.lower()].add(term.lower())
        for term, count in ttc.items():
            best = low_to_best[term.lower()]
            new_ttc[best] += count
            canonical_variants[best.lower()].add(term.lower())
        assigned[cat] = (new_tpc, new_ttc)

    # Pre-load paper analyses and trial interventions for accurate counting
    cat_paper_terms = defaultdict(list)  # cat -> [(set_of_lowered_terms), ...]
    for cat in set(c for c in assigned):
        for (pi_json, topics_json) in conn.execute(
            """SELECT a.primary_interventions, a.topics FROM pa_analyses a
               JOIN pa_papers p ON a.pmid = p.pmid
               WHERE p.category = ? AND a.primary_interventions IS NOT NULL""",
            (cat,),
        ).fetchall():
            terms = set()
            for raw in (pi_json, topics_json):
                try:
                    for t in json.loads(raw or "[]"):
                        terms.add(t.lower().strip())
                except Exception:
                    pass
            cat_paper_terms[cat].append(terms)

    cat_trial_interventions = defaultdict(list)  # cat -> [list_of_lowered_interventions, ...]
    for cat in set(c for c in assigned):
        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            try:
                interventions = [t.lower().strip() for t in json.loads(interv_json or "[]")]
                cat_trial_interventions[cat].append(interventions)
            except Exception:
                pass

    # Third pass: insert with accurate counts from source data
    total_rows = 0
    for cat, (tpc, ttc) in assigned.items():
        for term in set(tpc) | set(ttc):
            variants = canonical_variants.get(term.lower(), set())
            search = sorted(variants | {term.lower()})

            # Count papers matching search_terms via AI classifications
            paper_count = sum(
                1 for paper_terms in cat_paper_terms[cat]
                if any(s in paper_terms for s in search)
            )
            # Count trials matching search_terms via substring match
            trial_count = 0
            for trial_interventions in cat_trial_interventions[cat]:
                for interv in trial_interventions:
                    if any(s in interv or interv in s for s in search):
                        trial_count += 1
                        break

            if paper_count == 0 and trial_count == 0:
                continue

            conn.execute(
                "INSERT INTO rs_subcategories (category, term, paper_count, trial_count, search_terms) VALUES (?, ?, ?, ?, ?)",
                (cat, term, paper_count, trial_count, json.dumps(search)),
            )
            total_rows += 1

    conn.commit()
    print(f"  Built subcategories: {total_rows} terms across {len(categories)} categories (AI-driven)", flush=True)

    # Validate: recount from source data and flag mismatches
    mismatches = 0
    for (cat, term, db_papers, db_trials, search_json) in conn.execute(
        "SELECT category, term, paper_count, trial_count, search_terms FROM rs_subcategories ORDER BY category, paper_count DESC"
    ).fetchall():
        search = json.loads(search_json)
        # Count papers via AI primary_interventions + topics
        actual_papers = 0
        for (pi_json, topics_json) in conn.execute(
            """SELECT a.primary_interventions, a.topics FROM pa_analyses a
               JOIN pa_papers p ON a.pmid = p.pmid
               WHERE p.category = ? AND a.primary_interventions IS NOT NULL""",
            (cat,),
        ).fetchall():
            terms_in_paper = set()
            for raw in (pi_json, topics_json):
                try:
                    for t in json.loads(raw or "[]"):
                        terms_in_paper.add(t.lower().strip())
                except Exception:
                    pass
            if any(s in terms_in_paper for s in search):
                actual_papers += 1

        # Count trials via substring match (same as frontend)
        actual_trials = 0
        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            try:
                for intervention in json.loads(interv_json or "[]"):
                    low = intervention.lower().strip()
                    if any(s in low or low in s for s in search):
                        actual_trials += 1
                        break
            except Exception:
                pass

        if actual_papers != db_papers or actual_trials != db_trials:
            print(f"    MISMATCH {cat}/{term}: DB={db_papers}p+{db_trials}t, actual={actual_papers}p+{actual_trials}t", flush=True)
            mismatches += 1

    if mismatches:
        print(f"  Warning: {mismatches} subcategory count mismatches found", flush=True)
    else:
        print(f"  Validation passed: all subcategory counts match source data", flush=True)


def build_global_stats(conn):
    """Build rs_stats table with global research statistics."""
    conn.execute("DROP TABLE IF EXISTS rs_stats")
    conn.execute("CREATE TABLE rs_stats (key TEXT PRIMARY KEY, value TEXT)")

    def put(key, value):
        conn.execute("INSERT INTO rs_stats VALUES (?, ?)", (key, json.dumps(value)))

    put("last_run", datetime.now().isoformat())
    put("paper_count", conn.execute("SELECT COUNT(*) FROM pa_papers").fetchone()[0])
    put("trial_count", conn.execute("SELECT COUNT(*) FROM tr_trials").fetchone()[0])
    put("papers_with_abstracts", conn.execute("SELECT COUNT(*) FROM pa_papers WHERE abstract IS NOT NULL AND abstract != ''").fetchone()[0])
    put("papers_with_full_text", conn.execute("SELECT COUNT(*) FROM pa_papers WHERE full_text_sections IS NOT NULL").fetchone()[0])

    total_with_doi = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE doi IS NOT NULL").fetchone()[0]
    oa = conn.execute("SELECT COUNT(*) FROM pa_papers WHERE is_oa = 1").fetchone()[0]
    put("oa_rate", round(oa / total_with_doi, 3) if total_with_doi > 0 else 0)

    # Study type distribution
    rows = conn.execute("SELECT study_type, COUNT(*) FROM pa_analyses WHERE study_type IS NOT NULL GROUP BY study_type ORDER BY COUNT(*) DESC").fetchall()
    put("study_type_distribution", [{"type": t, "count": c} for t, c in rows])

    # Result/outcome distribution - use COALESCE for compatibility
    result_col = "COALESCE(outcome, result)" if _has_column(conn, "pa_analyses", "outcome") else "result"
    rows = conn.execute(f"SELECT {result_col} as r, COUNT(*) FROM pa_analyses GROUP BY r ORDER BY COUNT(*) DESC").fetchall()
    put("result_distribution", [{"result": r, "count": c} for r, c in rows])

    # Evidence tier
    rows = conn.execute("SELECT evidence_tier, COUNT(*) FROM pa_analyses WHERE evidence_tier IS NOT NULL GROUP BY evidence_tier ORDER BY evidence_tier").fetchall()
    put("evidence_tier_distribution", [{"tier": t, "count": c} for t, c in rows])

    # Papers per year
    rows = conn.execute("SELECT SUBSTR(pub_date, 1, 4) as year, COUNT(*) FROM pa_papers WHERE pub_date IS NOT NULL GROUP BY year ORDER BY year").fetchall()
    put("papers_per_year", {y: c for y, c in rows})

    # Category results
    cat_results = {}
    for (cat,) in conn.execute("SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL").fetchall():
        rows = conn.execute(
            f"SELECT {_result_expr(conn)} as r, COUNT(*) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE p.category = ? GROUP BY r",
            (cat,),
        ).fetchall()
        cat_results[cat] = [{"result": r, "count": c} for r, c in rows]
    put("category_results", cat_results)

    # Category avg evidence
    rows = conn.execute(
        "SELECT p.category, AVG(a.evidence_tier) FROM pa_analyses a JOIN pa_papers p ON a.pmid = p.pmid WHERE a.evidence_tier IS NOT NULL GROUP BY p.category"
    ).fetchall()
    put("category_avg_evidence", {cat: round(avg, 2) for cat, avg in rows})

    # Trial stats
    rows = conn.execute("SELECT status, COUNT(*) FROM tr_trials GROUP BY status ORDER BY COUNT(*) DESC").fetchall()
    put("trial_status_distribution", [{"status": s, "count": c} for s, c in rows])

    rows = conn.execute("SELECT phase, COUNT(*) FROM tr_trials GROUP BY phase ORDER BY COUNT(*) DESC").fetchall()
    put("trial_phase_distribution", [{"phase": p, "count": c} for p, c in rows])

    rows = conn.execute("SELECT sponsor, COUNT(*) FROM tr_trials GROUP BY sponsor ORDER BY COUNT(*) DESC LIMIT 15").fetchall()
    put("trial_top_sponsors", [{"sponsor": s, "count": c} for s, c in rows])

    rows = conn.execute("SELECT category, AVG(enrollment) FROM tr_trials WHERE enrollment IS NOT NULL GROUP BY category").fetchall()
    put("trial_avg_enrollment_by_category", {cat: round(avg) for cat, avg in rows})

    # Research volume by category
    volume = {}
    for (cat,) in conn.execute("SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL").fetchall():
        rows = conn.execute(
            "SELECT SUBSTR(pub_date, 1, 4), COUNT(*) FROM pa_papers WHERE category = ? AND pub_date IS NOT NULL GROUP BY SUBSTR(pub_date, 1, 4)",
            (cat,),
        ).fetchall()
        volume[cat] = {y: c for y, c in rows}
    put("research_volume_by_category", volume)

    # Top authors
    author_counts = Counter()
    for (authors_str,) in conn.execute("SELECT authors FROM pa_papers WHERE authors IS NOT NULL").fetchall():
        first = authors_str.split(",")[0].strip()
        if first and first != "et al.":
            author_counts[first] += 1
    put("top_authors", [{"name": n, "count": c} for n, c in author_counts.most_common(20)])

    # Top institutions
    inst_counts = Counter()
    for (affs_json,) in conn.execute("SELECT affiliations FROM pa_papers WHERE affiliations IS NOT NULL").fetchall():
        try:
            for aff in json.loads(affs_json):
                parts = aff.split(",")
                inst = parts[0].strip() if parts else aff
                if len(inst) > 5:
                    inst_counts[inst] += 1
        except Exception:
            pass
    put("top_institutions", [{"name": n, "count": c} for n, c in inst_counts.most_common(20)])

    conn.commit()
    print("  Built global research stats", flush=True)


def store_analyses(db_path, paper_analyses):
    """Store per-paper analysis results in the database."""
    print("Storing paper analyses...", flush=True)
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
    print(f"  Stored {len(paper_analyses)} analyses", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Deep Research Analysis")
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--skip-subcategories", action="store_true",
                        help="Skip building subcategories (done separately after LLM analysis)")
    parser.add_argument("--only-subcategories", action="store_true",
                        help="Only build subcategories (run after LLM analysis)")
    parser.add_argument("--api-key", default=None,
                        help="API key for AI term normalization (auto-detects from env)")
    parser.add_argument("--base-url",
                        default="https://generativelanguage.googleapis.com/v1beta/openai",
                        help="API base URL")
    parser.add_argument("--model", default="gemini-2.5-flash-lite",
                        help="Model for term normalization")
    args = parser.parse_args()

    # Auto-detect API key from environment
    api_key = args.api_key or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GROQ_API_KEY") or os.environ.get("CEREBRAS_API_KEY")
    base_url = args.base_url
    model = args.model

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if args.only_subcategories:
        conn = sqlite3.connect(args.db)
        build_subcategories(conn, api_key=api_key, base_url=base_url, model=model)
        conn.close()
        return

    print("=== Deep Research Analysis ===\n", flush=True)

    # Analyze papers
    paper_data = analyze_papers(args.db)
    store_analyses(args.db, paper_data["papers"])

    # Cross-linking and stats aggregation
    conn = sqlite3.connect(args.db)
    build_paper_trial_links(conn)
    build_category_stats(conn)
    if not args.skip_subcategories:
        build_subcategories(conn, api_key=api_key, base_url=base_url, model=model)
    build_global_stats(conn)
    conn.close()

    # Analyze trials
    trial_data = analyze_trials(args.db)

    # Write insight files
    with open(os.path.join(OUTPUT_DIR, "paper-stats.json"), "w") as f:
        json.dump(paper_data["stats"], f, indent=2)
    print(f"\n  Wrote paper-stats.json", flush=True)

    with open(os.path.join(OUTPUT_DIR, "trial-stats.json"), "w") as f:
        json.dump(trial_data, f, indent=2)
    print(f"  Wrote trial-stats.json", flush=True)

    print("\n=== Analysis Complete ===", flush=True)


if __name__ == "__main__":
    main()
