#!/usr/bin/env python3
"""Generate per-category research analysis data."""

import json
import os
import sqlite3
from collections import Counter, defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "public", "data.db")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "src", "data", "research-insights", "categories")

CATEGORY_NAMES = {
    "psychedelic": "Psychedelic Treatments",
    "cgrp": "CGRP Therapies",
    "oxygen": "Oxygen Therapy",
    "vitamin-d": "Vitamin D Research",
    "pharmacology": "Pharmacological Treatments",
    "nerve-block": "Nerve Blocks & Injections",
    "neuromodulation": "Neuromodulation & Stimulation",
    "non-pharma": "Non-Pharmacological Approaches",
    "observational": "Observational & Epidemiological Studies",
    "other": "Other Research",
}

CATEGORY_DESCRIPTIONS = {
    "psychedelic": "Psilocybin, LSD, BOL-148, and other psychedelic compounds for cluster headache. The community's most-discussed treatment category, now backed by Phase 2 clinical trials.",
    "cgrp": "Calcitonin gene-related peptide (CGRP) monoclonal antibodies and gepants. Galcanezumab is the only approved anti-CGRP for episodic CH.",
    "oxygen": "High-flow oxygen therapy — the community's #1 abortive. Evidence spans from early case reports to modern RCTs confirming 78% efficacy.",
    "vitamin-d": "Vitamin D3 regimen (Batch protocol). Emerging research area with strong community anecdotal support but limited clinical trial data so far.",
    "pharmacology": "Traditional pharmaceutical treatments: verapamil, lithium, prednisone, melatonin, triptans. The established medical toolkit.",
    "nerve-block": "Greater occipital nerve blocks, sphenopalatine ganglion blocks, botulinum toxin injections. Procedural interventions for refractory cases.",
    "neuromodulation": "Vagus nerve stimulation (gammaCore), occipital nerve stimulation, deep brain stimulation. Device-based therapies.",
    "non-pharma": "Light therapy, behavioral approaches, acupuncture, exercise, yoga. Alternative and complementary treatments.",
    "observational": "Epidemiological studies, patient registries, natural history studies, and surveys describing CH patterns in populations.",
    "other": "Cross-cutting research: genetics, neuroimaging, pathophysiology, diagnostic criteria, and general headache medicine.",
}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    for category in CATEGORY_NAMES:
        print(f"  {category}...")

        # Papers
        papers = conn.execute("""
            SELECT p.pmid, p.title, p.authors, p.pub_date, p.abstract, p.journal,
                   pa.study_type, pa.result, pa.sample_size, pa.evidence_tier
            FROM pa_papers p
            LEFT JOIN pa_analyses pa ON p.pmid = pa.pmid
            WHERE p.category = ?
            ORDER BY p.relevance_score DESC
        """, (category,)).fetchall()

        # Trials
        trials = conn.execute("""
            SELECT nct_id, title, status, phase, sponsor, enrollment, start_date, end_date
            FROM tr_trials WHERE category = ?
            ORDER BY relevance_score DESC
        """, (category,)).fetchall()

        # Study type distribution
        study_types = Counter()
        results = Counter()
        yearly = defaultdict(int)
        top_papers = []
        sample_sizes = []

        for p in papers:
            if p["study_type"]:
                study_types[p["study_type"]] += 1
            if p["result"]:
                results[p["result"]] += 1
            year = (p["pub_date"] or "")[:4]
            if year.isdigit():
                yearly[year] += 1
            if p["sample_size"]:
                sample_sizes.append(p["sample_size"])

        # Top 10 papers by evidence quality
        sorted_papers = sorted(papers, key=lambda p: (p["evidence_tier"] or 5, -(p["sample_size"] or 0)))
        for p in sorted_papers[:10]:
            top_papers.append({
                "pmid": p["pmid"],
                "title": p["title"],
                "authors": p["authors"],
                "year": (p["pub_date"] or "")[:4],
                "journal": p["journal"],
                "study_type": p["study_type"],
                "result": p["result"],
                "sample_size": p["sample_size"],
                "evidence_tier": p["evidence_tier"],
            })

        # All trials with analyses
        analyses_path = os.path.join(PROJECT_ROOT, "src", "data", "trials", "trial-analyses.json")
        analyses_map = {}
        if os.path.exists(analyses_path):
            analyses_list = json.load(open(analyses_path))
            analyses_map = {a["nct_id"]: a for a in analyses_list}

        all_trial_list = []
        for t in trials:
            trial_data = {
                "nct_id": t["nct_id"],
                "title": t["title"],
                "status": t["status"],
                "phase": json.loads(t["phase"]) if t["phase"] else [],
                "sponsor": t["sponsor"],
                "enrollment": t["enrollment"],
            }
            analysis = analyses_map.get(t["nct_id"])
            if analysis:
                trial_data["what_tested"] = analysis.get("what_tested", "")
                trial_data["key_result"] = analysis.get("key_result", "")
                trial_data["verdict"] = analysis.get("verdict", "unknown")
                trial_data["patient_relevance"] = analysis.get("patient_relevance", "")
                trial_data["dose_tested"] = analysis.get("dose_tested")
            all_trial_list.append(trial_data)

        active_trials = [t for t in all_trial_list if t["status"] in ("RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING")]

        data = {
            "category": category,
            "name": CATEGORY_NAMES[category],
            "description": CATEGORY_DESCRIPTIONS[category],
            "total_papers": len(papers),
            "total_trials": len(trials),
            "active_trials": len(active_trials),
            "with_abstracts": sum(1 for p in papers if p["abstract"]),
            "study_type_distribution": [{"type": t, "count": c} for t, c in study_types.most_common()],
            "result_distribution": [{"result": r, "count": c} for r, c in results.most_common()],
            "papers_per_year": dict(sorted(yearly.items())),
            "avg_sample_size": round(sum(sample_sizes) / len(sample_sizes)) if sample_sizes else None,
            "max_sample_size": max(sample_sizes) if sample_sizes else None,
            "top_papers": top_papers,
            "all_trials": all_trial_list,
            "active_trial_count": len(active_trials),
        }

        with open(os.path.join(OUTPUT_DIR, f"{category}.json"), "w") as f:
            json.dump(data, f, indent=2)

    conn.close()
    print(f"\n  Generated {len(CATEGORY_NAMES)} category files")


if __name__ == "__main__":
    print("=== Per-Category Research Analysis ===")
    main()
    print("=== Done ===")
