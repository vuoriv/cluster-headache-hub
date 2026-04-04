#!/usr/bin/env python3
"""Transform LLM-extracted treatment data into the format expected by the frontend."""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "src", "data")
TREATMENTS_DIR = os.path.join(DATA_DIR, "treatments")

# Category mapping for treatments
CATEGORY_MAP = {
    "psilocybin-mushrooms": "psychedelic",
    "oxygen": "acute",
    "rc-seeds-lsa": "psychedelic",
    "vitamin-d3": "supportive",
    "lsd": "psychedelic",
    "triptans": "acute",
    "energy-drinks-caffeine": "acute",
    "prednisone-steroids": "conventional",
    "verapamil": "conventional",
    "bol-148": "psychedelic",
    "melatonin": "supportive",
    "lithium": "conventional",
    "ketamine": "psychedelic",
}


def transform_profile(raw: dict, rankings: list, outcomes: dict, timeline: dict) -> dict:
    """Transform LLM-extracted data into TreatmentProfile format."""
    slug = raw["slug"]
    name = raw.get("treatment", slug)
    category = CATEGORY_MAP.get(slug, "conventional")

    # Find ranking data
    rank = next((r for r in rankings if r["slug"] == slug), None)
    total_mentions = rank["total_mentions"] if rank else raw.get("total_mentions", 0)
    positive_rate = rank["positive_rate"] if rank else raw.get("positive_rate", 0)
    composite_score = rank["composite_score"] if rank else 0

    # Find peak year from timeline
    peak_year = 0
    peak_mentions = 0
    for year_str, treatments in timeline.get("per_year", {}).items():
        for t_name, mentions in treatments.items():
            if slug_matches(slug, t_name) and mentions > peak_mentions:
                peak_mentions = mentions
                peak_year = int(year_str)

    # Build timeline array
    timeline_arr = []
    for year_str, treatments in sorted(timeline.get("per_year", {}).items()):
        for t_name, mentions in treatments.items():
            if slug_matches(slug, t_name):
                timeline_arr.append({"year": int(year_str), "mentions": mentions})

    # Get outcome data
    outcome_key = find_outcome_key(slug, outcomes)
    outcome = outcomes.get(outcome_key, {})

    # Extract protocol info from LLM data
    dosing = [d["dosage"] for d in raw.get("common_dosages", [])[:6]]
    preparations = [p["method"] for p in raw.get("common_preparations", [])[:5]]
    schedule = [p["protocol"] for p in raw.get("common_protocols", [])[:5]]
    side_effects = [s["effect"] for s in raw.get("side_effects", [])[:10]]
    co_treatments = [c["treatment"] for c in raw.get("co_treatments", [])[:8]]

    sample_size = raw.get("sample_size", 0)
    if not sample_size:
        sample_size = total_mentions

    return {
        "slug": slug,
        "name": name,
        "category": category,
        "stats": {
            "mentions": total_mentions,
            "positiveRate": positive_rate,
            "peakYear": peak_year,
            "score": composite_score,
        },
        "protocol": {
            "dosing": dosing,
            "preparations": preparations,
            "schedule": schedule,
        },
        "outcomes": {
            "effective": outcome.get("positive", 0),
            "partial": outcome.get("partial", 0),
            "noEffect": outcome.get("negative", 0),
            "sampleSize": outcome.get("rated_posts", 0),
        },
        "timeline": timeline_arr,
        "sideEffects": side_effects,
        "contraindications": [],
        "coTreatments": co_treatments,
        "sampleSize": sample_size,
    }


def slug_matches(slug: str, treatment_name: str) -> bool:
    """Check if a treatment name matches a slug."""
    name_lower = treatment_name.lower()
    slug_words = slug.replace("-", " ").lower()
    mapping = {
        "psilocybin-mushrooms": ["psilocybin", "mushroom"],
        "oxygen": ["oxygen"],
        "rc-seeds-lsa": ["rc seed", "lsa", "rivea"],
        "vitamin-d3": ["vitamin d", "d3"],
        "lsd": ["lsd"],
        "triptans": ["triptan"],
        "energy-drinks-caffeine": ["energy drink", "caffeine"],
        "prednisone-steroids": ["prednisone", "steroid"],
        "verapamil": ["verapamil"],
        "bol-148": ["bol-148", "bol 148"],
        "melatonin": ["melatonin"],
        "lithium": ["lithium"],
        "ketamine": ["ketamine"],
    }
    for keyword in mapping.get(slug, [slug_words]):
        if keyword in name_lower:
            return True
    return False


def find_outcome_key(slug: str, outcomes: dict) -> str:
    """Find the matching key in outcomes dict for a slug."""
    for key in outcomes:
        if slug_matches(slug, key):
            return key
    return ""


def main():
    rankings = json.load(open(os.path.join(DATA_DIR, "treatment-rankings.json")))
    outcomes = json.load(open(os.path.join(DATA_DIR, "outcomes.json")))
    timeline = json.load(open(os.path.join(DATA_DIR, "timeline.json")))

    for filename in sorted(os.listdir(TREATMENTS_DIR)):
        if not filename.endswith(".json"):
            continue

        filepath = os.path.join(TREATMENTS_DIR, filename)
        with open(filepath) as f:
            raw = json.load(f)

        profile = transform_profile(raw, rankings, outcomes, timeline)

        # Write back
        with open(filepath, "w") as f:
            json.dump(profile, f, indent=2)

        dosing_count = len(profile["protocol"]["dosing"])
        side_fx_count = len(profile["sideEffects"])
        print(f"  {profile['slug']}: {dosing_count} dosages, {side_fx_count} side effects")


if __name__ == "__main__":
    print("Transforming treatment profiles...")
    main()
    print("Done.")
