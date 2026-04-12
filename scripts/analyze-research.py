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


# Normalization map: maps raw lowercase terms to display labels.
TERM_ALIASES = {
    "lithium carbonate": "Lithium",
    "lithium compounds": "Lithium",
    "lithium": "Lithium",
    "verapamil": "Verapamil",
    "verapamil hydrochloride": "Verapamil",
    "r-verapamil": "Verapamil",
    "sumatriptan": "Sumatriptan",
    "sumatriptan succinate": "Sumatriptan",
    "topiramate": "Topiramate",
    "melatonin": "Melatonin",
    "prednisone": "Prednisone",
    "prednisolone": "Prednisolone",
    "methylprednisolone": "Methylprednisolone",
    "indomethacin": "Indomethacin",
    "methysergide": "Methysergide",
    "ergotamine": "Ergotamine",
    "valproic acid": "Valproic Acid",
    "lamotrigine": "Lamotrigine",
    "gabapentin": "Gabapentin",
    "galcanezumab": "Galcanezumab",
    "erenumab": "Erenumab",
    "fremanezumab": "Fremanezumab",
    "psilocybin": "Psilocybin",
    "lysergic acid diethylamide": "LSD",
    "lsd": "LSD",
    "bol-148": "BOL-148",
    "oxygen": "Oxygen",
    "oxygen inhalation therapy": "Oxygen",
    "hyperbaric oxygenation": "Hyperbaric Oxygen",
    "botulinum toxins": "Botulinum Toxin",
    "botulinum toxins, type a": "Botulinum Toxin",
    "botulinum toxin": "Botulinum Toxin",
    "lidocaine": "Lidocaine",
    "bupivacaine": "Bupivacaine",
    "gammacore": "Vagus Nerve Stimulation",
    "vagus nerve stimulation": "Vagus Nerve Stimulation",
    "non-invasive vagus nerve stimulation": "Vagus Nerve Stimulation",
    "transcutaneous vagus nerve stimulation": "Vagus Nerve Stimulation",
    "deep brain stimulation": "Deep Brain Stimulation",
    "occipital nerve stimulation": "Occipital Nerve Stimulation",
    "sphenopalatine ganglion": "SPG Stimulation/Block",
    "sphenopalatine ganglion block": "SPG Stimulation/Block",
    "spg stimulation": "SPG Stimulation/Block",
    "greater occipital nerve": "Occipital Nerve Block",
    "greater occipital nerve block": "Occipital Nerve Block",
    "occipital nerve block": "Occipital Nerve Block",
    "nerve block": "Nerve Block",
    "vitamin d": "Vitamin D",
    "cholecalciferol": "Vitamin D",
    "vitamin d3": "Vitamin D",
    "calcium channel blockers": "Calcium Channel Blockers",
    "adrenal cortex hormones": "Corticosteroids",
    "corticosteroids": "Corticosteroids",
    "triptans": "Triptans",
    "serotonin receptor agonists": "Triptans",
    "anticonvulsants": "Anticonvulsants",
    "calcitonin gene-related peptide": "CGRP",
    "cgrp": "CGRP",
    "ketamine": "Ketamine",
    "ketamine hydrochloride": "Ketamine",
    "hallucinogens": "Hallucinogens",
    "dimethyltryptamine": "DMT",
    "dmt": "DMT",
    "mescaline": "Mescaline",
    "capsaicin": "Capsaicin",
    "warfarin": "Warfarin",
    "candesartan": "Candesartan",
    "frovatriptan": "Frovatriptan",
    "zolmitriptan": "Zolmitriptan",
    "naratriptan": "Naratriptan",
    "rizatriptan": "Rizatriptan",
    "eletriptan": "Eletriptan",
    "almotriptan": "Almotriptan",
    "dihydroergotamine": "Dihydroergotamine",
    "civamide": "Civamide",
    "kudzu": "Kudzu",
    "melatonin receptor agonists": "Melatonin",
    "sodium oxybate": "Sodium Oxybate",
    "low sodium oxybate": "Sodium Oxybate",
    # Observational / epidemiological topics
    "epidemiology": "Epidemiology",
    "comorbidity": "Comorbidity",
    "diagnosis": "Diagnosis",
    "misdiagnosis": "Misdiagnosis",
    "quality of life": "Quality of Life",
    "disability": "Disability",
    "chronobiology": "Chronobiology",
    "circadian rhythm": "Chronobiology",
    "circadian rhythms": "Chronobiology",
    "circannual": "Chronobiology",
    "sleep": "Sleep",
    "sleep disorders": "Sleep",
    "alcohol": "Alcohol",
    "smoking": "Smoking",
    "tobacco": "Smoking",
    "depression": "Depression",
    "depressive disorder": "Depression",
    "anxiety": "Anxiety",
    "suicide": "Suicide",
    "suicidal ideation": "Suicide",
    "prevalence": "Prevalence",
    "classification": "Classification",
    "genetics": "Genetics",
    "sex factors": "Gender Differences",
    # Non-pharma approaches
    "exercise": "Exercise",
    "physical activity": "Exercise",
    "acupuncture": "Acupuncture",
    "photophobia": "Photophobia",
    "yoga": "Yoga",
    "meditation": "Meditation",
    "mindfulness": "Mindfulness",
    "diet": "Diet",
    "biofeedback": "Biofeedback",
    "cognitive behavioral therapy": "Cognitive Behavioral Therapy",
    "psychotherapy": "Psychotherapy",
}

SKIP_TERMS = {
    "humans", "male", "female", "adult", "middle aged", "young adult", "aged",
    "adolescent", "child", "infant", "cluster headache", "cluster headaches",
    "headache", "headaches", "treatment outcome", "prospective studies",
    "retrospective studies", "migraine", "migraine disorders", "chronic disease",
    "diagnosis, differential", "time factors", "double-blind method",
    "cross-over studies", "pain", "brain", "magnetic resonance imaging",
    "electroencephalography", "follow-up studies", "comorbidity",
    "surveys and questionnaires",
    "risk factors", "severity of illness index",
    "trigeminal autonomic cephalalgia", "trigeminal autonomic cephalalgias",
    "vascular headaches", "tension-type headache",
    "hemicrania continua", "paroxysmal hemicrania",
    "sunct", "suna", "epidemiology", "pathophysiology",
    "case reports", "review", "meta-analysis",
    "clinical trial", "randomized controlled trial",
    "treatment", "drug therapy", "drug therapy, combination",
    "neuromodulation", "neurostimulation",
}


def build_subcategories(conn):
    """Build rs_subcategories table with treatment-specific terms per category.

    Only includes curated terms (from TERM_ALIASES) and only assigns each term
    to the category where it appears most — prevents cross-contamination
    (e.g., Verapamil won't appear under Psychedelic just because a few
    psychedelic papers mention it as a comparator).
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

    categories = [r[0] for r in conn.execute(
        "SELECT DISTINCT category FROM pa_papers WHERE category IS NOT NULL "
        "UNION SELECT DISTINCT category FROM tr_trials WHERE category IS NOT NULL "
        "ORDER BY category"
    ).fetchall()]

    # Build reverse map: normalized label → set of raw terms that map to it
    reverse_aliases = defaultdict(set)
    for raw, normalized in TERM_ALIASES.items():
        reverse_aliases[normalized].add(raw)

    # First pass: collect all term counts per category
    all_data = {}
    for cat in categories:
        term_paper_counts = Counter()
        term_trial_counts = Counter()

        # Papers: MeSH terms + author keywords, curated only
        for (mesh_json, kw_json) in conn.execute(
            "SELECT mesh_terms, author_keywords FROM pa_papers WHERE category = ?", (cat,)
        ).fetchall():
            terms = set()
            for raw_json in (mesh_json, kw_json):
                if not raw_json:
                    continue
                try:
                    for t in json.loads(raw_json):
                        low = t.lower().strip()
                        if low in TERM_ALIASES:
                            terms.add(TERM_ALIASES[low])
                except Exception:
                    pass
            for term in terms:
                term_paper_counts[term] += 1

        # Trials: interventions, curated only
        for (interv_json,) in conn.execute(
            "SELECT interventions FROM tr_trials WHERE category = ?", (cat,)
        ).fetchall():
            if not interv_json:
                continue
            try:
                terms = set()
                for t in json.loads(interv_json):
                    low = t.lower().strip()
                    if low in TERM_ALIASES:
                        terms.add(TERM_ALIASES[low])
                for term in terms:
                    term_trial_counts[term] += 1
            except Exception:
                pass

        all_data[cat] = (term_paper_counts, term_trial_counts)

    # Second pass: find primary category for each term (highest total count).
    # "other" is a catch-all — deprioritize it so treatments land in their
    # proper category (e.g., Sumatriptan → pharmacology, not other).
    # Topic terms (epidemiology, sleep, etc.) prefer observational/non-pharma.
    DEPRIORITIZED_CATS = {"other"}
    TOPIC_TERMS = {
        "Epidemiology", "Comorbidity", "Diagnosis", "Misdiagnosis",
        "Quality of Life", "Disability", "Chronobiology", "Sleep",
        "Alcohol", "Smoking", "Depression", "Anxiety", "Suicide",
        "Prevalence", "Classification", "Genetics", "Gender Differences",
        "Exercise", "Acupuncture", "Photophobia", "Yoga", "Meditation",
        "Mindfulness", "Diet", "Biofeedback", "Cognitive Behavioral Therapy",
        "Psychotherapy",
    }
    TOPIC_CATS = {"observational", "non-pharma"}

    term_totals = defaultdict(lambda: defaultdict(int))
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            term_totals[term][cat] = tpc.get(term, 0) + ttc.get(term, 0)

    term_primary = {}
    for term, cat_counts in term_totals.items():
        if term in TOPIC_TERMS:
            # Topic terms prefer observational/non-pharma categories
            topic_cats = {c: n for c, n in cat_counts.items() if c in TOPIC_CATS}
            if topic_cats:
                term_primary[term] = max(topic_cats, key=topic_cats.get)
                continue
        # Treatment terms: prefer non-catch-all categories
        preferred = {c: n for c, n in cat_counts.items() if c not in DEPRIORITIZED_CATS}
        if preferred:
            term_primary[term] = max(preferred, key=preferred.get)
        else:
            term_primary[term] = max(cat_counts, key=cat_counts.get)

    # Third pass: only insert terms where this category is their primary
    total_rows = 0
    for cat, (tpc, ttc) in all_data.items():
        for term in set(tpc) | set(ttc):
            if term_primary[term] != cat:
                continue
            # Include all raw alias keys + the normalized label itself for frontend matching
            search = sorted(reverse_aliases.get(term, set()) | {term.lower()})
            conn.execute(
                "INSERT INTO rs_subcategories (category, term, paper_count, trial_count, search_terms) VALUES (?, ?, ?, ?, ?)",
                (cat, term, tpc.get(term, 0), ttc.get(term, 0), json.dumps(search)),
            )
            total_rows += 1

    conn.commit()
    print(f"  Built subcategories: {total_rows} terms across {len(categories)} categories", flush=True)


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
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=== Deep Research Analysis ===\n", flush=True)

    # Analyze papers
    paper_data = analyze_papers(args.db)
    store_analyses(args.db, paper_data["papers"])

    # Cross-linking and stats aggregation
    conn = sqlite3.connect(args.db)
    build_paper_trial_links(conn)
    build_category_stats(conn)
    build_subcategories(conn)
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
