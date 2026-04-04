#!/usr/bin/env python3
"""
ClusterBusters Insights Analytics Pipeline

Extracts 6 analytical datasets from the forum database:
1. Patient Journeys — returning users, cycle recurrence
2. Episodic vs Chronic — treatment differences by CH type
3. Treatment Paths — what patients try first → switch to
4. Community Demographics — activity, growth, veteran vs new
5. Cycle Patterns — seasonal, time-of-day, trends
6. Gender & Caregivers — sex distribution, caregiver analysis

Usage:
  python scripts/analyze-insights.py --db PATH [--output PATH]
"""

import argparse
import json
import os
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

# Treatment patterns (reused from analyze-forum.py)
TREATMENTS = {
    "Psilocybin / Mushrooms": r"psilocybin|mushroom|shroom|cubens|magic.mush|busting.*mush",
    "Oxygen": r"\boxygen\b|\bO2\b|high.flow|demand.valve|cluster.kit|15.?(?:lpm|l/min)|optimask",
    "RC Seeds / LSA": r"\bLSA\b|RC.seed|rivea|HBWR|baby.*woodrose|morning.glory",
    "Vitamin D3": r"vitamin.?d3?|cholecalciferol|d3.regimen|batch.protocol",
    "LSD": r"\bLSD\b|lyserg|acid.*trip|micro.?dos.*lsd",
    "Triptans": r"triptan|sumatriptan|imitrex|zolmitriptan|zomig|rizatriptan",
    "Energy Drinks": r"energy.drink|red.bull|monster|caffeine|coffee.*abort|5.?hour",
    "Prednisone": r"prednisone|prednisolone|steroid|cortisone|medrol|dexamethasone",
    "Verapamil": r"verapamil|calan|isoptin",
    "Melatonin": r"melatonin",
    "Lithium": r"\blithium\b",
    "Ketamine": r"\bketamine\b",
    "BOL-148": r"BOL.?148|2-bromo-LSD",
}

CH_TYPE_PATTERNS = {
    "episodic": re.compile(r"\bepisodic\b", re.IGNORECASE),
    "chronic": re.compile(r"\bchronic\b", re.IGNORECASE),
}

GENDER_PATTERNS = {
    "male_patient": [
        (r"\bmy husband\b", "caregiver_wife"),
        (r"\bmy boyfriend\b", "caregiver_girlfriend"),
        (r"\bmy son\b", "caregiver_parent"),
        (r"\bmy father\b", "caregiver_child"),
        (r"\bmy brother\b", "caregiver_sibling"),
        (r"\bhis cluster", "male_patient_ref"),
        (r"\bhe gets cluster", "male_patient_ref"),
        (r"\bhe suffers", "male_patient_ref"),
        (r"\bi am a male\b|\bi'm a male\b|\bmale,? age\b|\b\d+ ?m\b.*cluster", "male_self_id"),
    ],
    "female_patient": [
        (r"\bmy wife\b", "caregiver_husband"),
        (r"\bmy girlfriend\b", "caregiver_boyfriend"),
        (r"\bmy daughter\b", "caregiver_parent"),
        (r"\bmy mother\b", "caregiver_child"),
        (r"\bmy sister\b", "caregiver_sibling"),
        (r"\bher cluster", "female_patient_ref"),
        (r"\bshe gets cluster", "female_patient_ref"),
        (r"\bshe suffers", "female_patient_ref"),
        (r"\bi am a female\b|\bi'm a female\b|\bfemale,? age\b", "female_self_id"),
    ],
}


def load_posts(db_path):
    """Load all posts with metadata."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    posts = conn.execute("""
        SELECT p.post_id, p.content_text, p.author, p.posted_date,
               p.is_first_post, p.likes, p.post_number,
               t.title as topic_title, t.view_count, t.reply_count,
               f.name as forum_name
        FROM posts p
        JOIN topics t ON p.topic_id = t.topic_id
        JOIN forums f ON p.forum_id = f.forum_id
        WHERE p.content_text IS NOT NULL AND length(p.content_text) > 50
    """).fetchall()
    conn.close()
    return [dict(p) for p in posts]


def extract_treatments(text):
    """Find which treatments are mentioned in a post."""
    found = []
    for name, pattern in TREATMENTS.items():
        if re.search(pattern, text, re.IGNORECASE):
            found.append(name)
    return found


def extract_ch_type(text):
    """Determine CH type mentioned in post."""
    has_episodic = bool(CH_TYPE_PATTERNS["episodic"].search(text))
    has_chronic = bool(CH_TYPE_PATTERNS["chronic"].search(text))
    if has_episodic and not has_chronic:
        return "episodic"
    elif has_chronic and not has_episodic:
        return "chronic"
    elif has_episodic and has_chronic:
        return "both"
    return None


def extract_gender_signals(text):
    """Extract gender/caregiver signals from post text."""
    signals = {"male_patient": 0, "female_patient": 0, "is_caregiver": False, "caregiver_type": None}
    text_lower = text.lower()

    for gender, patterns in GENDER_PATTERNS.items():
        for pattern, signal_type in patterns:
            if re.search(pattern, text_lower):
                signals[gender] += 1
                if signal_type.startswith("caregiver"):
                    signals["is_caregiver"] = True
                    signals["caregiver_type"] = signal_type

    return signals


# ── Insight 1: Patient Journeys ──

def analyze_patient_journeys(posts):
    """Track users across years — cycle recurrence patterns."""
    print("\n  1. Patient Journeys...")

    author_posts = defaultdict(list)
    for p in posts:
        if p["author"]:
            author_posts[p["author"]].append(p)

    # Compute per-author stats
    journeys = []
    for author, user_posts in author_posts.items():
        if len(user_posts) < 2:
            continue

        dates = sorted([p["posted_date"][:10] for p in user_posts if p["posted_date"]])
        if len(dates) < 2:
            continue

        years = sorted(set(d[:4] for d in dates))
        first_year = int(years[0])
        last_year = int(years[-1])
        span = last_year - first_year

        # Detect gaps (potential remission periods)
        year_ints = [int(y) for y in years]
        gaps = []
        for i in range(1, len(year_ints)):
            gap = year_ints[i] - year_ints[i - 1]
            if gap >= 2:
                gaps.append({"from": year_ints[i - 1], "to": year_ints[i], "years": gap})

        # Treatment progression
        treatments_by_year = defaultdict(set)
        for p in user_posts:
            year = p["posted_date"][:4] if p["posted_date"] else None
            if year:
                for t in extract_treatments(p["content_text"]):
                    treatments_by_year[year].add(t)

        journeys.append({
            "post_count": len(user_posts),
            "year_span": span,
            "active_years": len(years),
            "first_year": first_year,
            "last_year": last_year,
            "gaps": gaps,
            "treatments_over_time": {y: list(ts) for y, ts in sorted(treatments_by_year.items())},
        })

    # Aggregate stats
    spans = [j["year_span"] for j in journeys]
    gap_count = sum(1 for j in journeys if j["gaps"])

    # Year span distribution
    span_dist = Counter()
    for s in spans:
        if s == 0:
            span_dist["<1 year"] += 1
        elif s <= 2:
            span_dist["1-2 years"] += 1
        elif s <= 5:
            span_dist["3-5 years"] += 1
        elif s <= 10:
            span_dist["6-10 years"] += 1
        else:
            span_dist["10+ years"] += 1

    # Returning after gap
    return_treatments = Counter()
    for j in journeys:
        if j["gaps"]:
            # What did they discuss after returning?
            for gap in j["gaps"]:
                return_year = str(gap["to"])
                for t in j["treatments_over_time"].get(return_year, []):
                    return_treatments[t] += 1

    result = {
        "total_returning_users": len(journeys),
        "users_with_gaps": gap_count,
        "avg_year_span": round(sum(spans) / len(spans), 1) if spans else 0,
        "max_year_span": max(spans) if spans else 0,
        "span_distribution": dict(span_dist),
        "users_by_active_years": dict(Counter(j["active_years"] for j in journeys).most_common(10)),
        "return_after_gap_treatments": [{"treatment": t, "count": c} for t, c in return_treatments.most_common(10)],
        "returning_per_year": dict(Counter(j["last_year"] for j in journeys if j["year_span"] >= 2).most_common(20)),
    }

    print(f"    {len(journeys)} returning users, {gap_count} with remission gaps")
    return result


# ── Insight 2: Episodic vs Chronic ──

def analyze_episodic_vs_chronic(posts):
    """Treatment patterns split by CH type."""
    print("\n  2. Episodic vs Chronic...")

    type_treatments = {"episodic": Counter(), "chronic": Counter(), "both": Counter()}
    type_posts = {"episodic": 0, "chronic": 0, "both": 0, "unspecified": 0}
    type_sentiments = {"episodic": {"positive": 0, "negative": 0, "total": 0},
                       "chronic": {"positive": 0, "negative": 0, "total": 0}}

    positive_words = re.compile(r"worked|pain.free|success|busted|attack.free|relief|helped|effective|abort", re.IGNORECASE)
    negative_words = re.compile(r"didn.t work|failed|no effect|still having|useless|ineffective|worse", re.IGNORECASE)

    conversion_mentions = 0

    for p in posts:
        text = p["content_text"]
        ch_type = extract_ch_type(text)

        if ch_type is None:
            type_posts["unspecified"] += 1
            continue

        type_posts[ch_type] += 1
        treatments = extract_treatments(text)

        for t in treatments:
            type_treatments[ch_type][t] += 1

        # Simple sentiment
        if ch_type in ("episodic", "chronic"):
            has_pos = bool(positive_words.search(text))
            has_neg = bool(negative_words.search(text))
            type_sentiments[ch_type]["total"] += 1
            if has_pos:
                type_sentiments[ch_type]["positive"] += 1
            if has_neg:
                type_sentiments[ch_type]["negative"] += 1

        # Conversion detection
        if re.search(r"episodic.*(?:turned|became|converted|went).*chronic|chronic.*(?:was|used to be).*episodic", text, re.IGNORECASE):
            conversion_mentions += 1

    # Top treatments by type
    result = {
        "post_counts": type_posts,
        "conversion_mentions": conversion_mentions,
        "episodic_treatments": [{"treatment": t, "count": c} for t, c in type_treatments["episodic"].most_common(13)],
        "chronic_treatments": [{"treatment": t, "count": c} for t, c in type_treatments["chronic"].most_common(13)],
        "episodic_positive_rate": round(type_sentiments["episodic"]["positive"] / max(type_sentiments["episodic"]["total"], 1) * 100, 1),
        "chronic_positive_rate": round(type_sentiments["chronic"]["positive"] / max(type_sentiments["chronic"]["total"], 1) * 100, 1),
        "episodic_negative_rate": round(type_sentiments["episodic"]["negative"] / max(type_sentiments["episodic"]["total"], 1) * 100, 1),
        "chronic_negative_rate": round(type_sentiments["chronic"]["negative"] / max(type_sentiments["chronic"]["total"], 1) * 100, 1),
    }

    print(f"    episodic: {type_posts['episodic']}, chronic: {type_posts['chronic']}, both: {type_posts['both']}")
    return result


# ── Insight 3: Treatment Paths ──

def analyze_treatment_paths(posts):
    """Track treatment sequences for repeat posters."""
    print("\n  3. Treatment Paths...")

    author_treatments = defaultdict(list)
    for p in posts:
        if not p["author"] or not p["posted_date"]:
            continue
        treatments = extract_treatments(p["content_text"])
        if treatments:
            author_treatments[p["author"]].append({
                "date": p["posted_date"][:7],  # YYYY-MM
                "treatments": treatments,
            })

    # Find treatment transitions
    transitions = Counter()
    first_treatments = Counter()
    final_treatments = Counter()

    for author, entries in author_treatments.items():
        if len(entries) < 2:
            continue

        entries.sort(key=lambda x: x["date"])

        # First mentioned treatments
        for t in entries[0]["treatments"]:
            first_treatments[t] += 1

        # Last mentioned treatments
        for t in entries[-1]["treatments"]:
            final_treatments[t] += 1

        # Track transitions between consecutive posts
        prev_set = set(entries[0]["treatments"])
        for entry in entries[1:]:
            curr_set = set(entry["treatments"])
            new_treatments = curr_set - prev_set
            for old in prev_set:
                for new in new_treatments:
                    if old != new:
                        transitions[(old, new)] += 1
            prev_set = curr_set

    # Top transitions
    top_transitions = []
    for (from_t, to_t), count in transitions.most_common(20):
        top_transitions.append({"from": from_t, "to": to_t, "count": count})

    result = {
        "users_with_progression": len([a for a in author_treatments if len(author_treatments[a]) >= 2]),
        "first_treatments": [{"treatment": t, "count": c} for t, c in first_treatments.most_common(13)],
        "final_treatments": [{"treatment": t, "count": c} for t, c in final_treatments.most_common(13)],
        "top_transitions": top_transitions,
    }

    print(f"    {result['users_with_progression']} users with treatment progression")
    return result


# ── Insight 4: Community Demographics ──

def analyze_demographics(posts):
    """Community activity patterns and growth."""
    print("\n  4. Community Demographics...")

    author_stats = defaultdict(lambda: {"posts": 0, "first": None, "last": None, "forums": set()})
    posts_per_year = Counter()
    new_authors_per_year = Counter()
    forum_activity = Counter()

    for p in posts:
        year = p["posted_date"][:4] if p["posted_date"] else None
        if year:
            posts_per_year[year] += 1

        forum_activity[p["forum_name"]] += 1

        if p["author"]:
            a = author_stats[p["author"]]
            a["posts"] += 1
            a["forums"].add(p["forum_name"])
            date = p["posted_date"][:10] if p["posted_date"] else None
            if date:
                if a["first"] is None or date < a["first"]:
                    a["first"] = date
                if a["last"] is None or date > a["last"]:
                    a["last"] = date

    # New authors per year
    for author, stats in author_stats.items():
        if stats["first"]:
            year = stats["first"][:4]
            new_authors_per_year[year] += 1

    # Activity distribution
    post_count_dist = Counter()
    for stats in author_stats.values():
        c = stats["posts"]
        if c == 1:
            post_count_dist["1 post"] += 1
        elif c <= 5:
            post_count_dist["2-5 posts"] += 1
        elif c <= 20:
            post_count_dist["6-20 posts"] += 1
        elif c <= 100:
            post_count_dist["21-100 posts"] += 1
        else:
            post_count_dist["100+ posts"] += 1

    # Power users
    power_users = sorted(author_stats.items(), key=lambda x: x[1]["posts"], reverse=True)[:10]

    result = {
        "total_authors": len(author_stats),
        "posts_per_year": dict(sorted(posts_per_year.items())),
        "new_authors_per_year": dict(sorted(new_authors_per_year.items())),
        "activity_distribution": dict(post_count_dist),
        "forum_activity": dict(forum_activity.most_common()),
        "power_users": [{"posts": s["posts"], "years_active": (int(s["last"][:4]) - int(s["first"][:4]) + 1) if s["first"] and s["last"] else 1, "forums": len(s["forums"])} for _, s in power_users],
    }

    print(f"    {len(author_stats)} unique authors")
    return result


# ── Insight 5: Cycle Patterns ──

def analyze_cycle_patterns(posts):
    """Seasonal and temporal posting patterns."""
    print("\n  5. Cycle Patterns...")

    monthly_posts = Counter()
    hourly_posts = Counter()
    treatment_by_year = defaultdict(Counter)
    day_of_week = Counter()

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    for p in posts:
        if not p["posted_date"]:
            continue

        try:
            dt = datetime.fromisoformat(p["posted_date"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        monthly_posts[dt.month] += 1
        hourly_posts[dt.hour] += 1
        day_of_week[dt.weekday()] += 1

        year = str(dt.year)
        for t in extract_treatments(p["content_text"]):
            treatment_by_year[year][t] += 1

    # Seasonal pattern (which months have most posts)
    seasonal = [{"month": month_names[m - 1], "posts": monthly_posts.get(m, 0)} for m in range(1, 13)]

    # Hourly pattern
    hourly = [{"hour": h, "posts": hourly_posts.get(h, 0)} for h in range(24)]

    # Day of week
    weekly = [{"day": day_names[d], "posts": day_of_week.get(d, 0)} for d in range(7)]

    # Treatment trends (when did busting take off?)
    busting_trend = []
    for year in sorted(treatment_by_year.keys()):
        busting = treatment_by_year[year].get("Psilocybin / Mushrooms", 0) + treatment_by_year[year].get("LSD", 0) + treatment_by_year[year].get("RC Seeds / LSA", 0)
        pharma = treatment_by_year[year].get("Verapamil", 0) + treatment_by_year[year].get("Triptans", 0) + treatment_by_year[year].get("Prednisone", 0) + treatment_by_year[year].get("Lithium", 0)
        busting_trend.append({"year": year, "psychedelic": busting, "pharmaceutical": pharma})

    result = {
        "seasonal": seasonal,
        "hourly": hourly,
        "weekly": weekly,
        "treatment_trends": busting_trend,
        "peak_month": month_names[max(monthly_posts, key=monthly_posts.get) - 1] if monthly_posts else None,
        "peak_hour": max(hourly_posts, key=hourly_posts.get) if hourly_posts else None,
    }

    print(f"    Peak month: {result['peak_month']}, Peak hour: {result['peak_hour']}:00")
    return result


# ── Insight 6: Gender & Caregivers ──

def analyze_gender_caregivers(posts):
    """Gender distribution and caregiver analysis."""
    print("\n  6. Gender & Caregivers...")

    caregiver_posts = []
    patient_gender = {"male": 0, "female": 0, "unknown": 0}
    caregiver_types = Counter()
    caregiver_treatments = Counter()
    patient_treatments = Counter()
    caregiver_concerns = Counter()

    concern_patterns = {
        "fear_for_life": re.compile(r"scared|terrified|afraid.*die|suicide|kill|can.t watch|helpless", re.IGNORECASE),
        "seeking_treatment": re.compile(r"what can|how do|any advice|please help|doctor.*won.t|looking for", re.IGNORECASE),
        "diagnosis_help": re.compile(r"diagnos|misdiagnos|could this be|is this cluster|what kind of headache", re.IGNORECASE),
        "support_seeking": re.compile(r"how do.*cope|support.*group|anyone else|not alone|understand", re.IGNORECASE),
        "oxygen_access": re.compile(r"oxygen|o2|how to get|prescription|insurance.*won", re.IGNORECASE),
    }

    for p in posts:
        text = p["content_text"]
        signals = extract_gender_signals(text)

        is_caregiver = signals["is_caregiver"]
        male_score = signals["male_patient"]
        female_score = signals["female_patient"]

        if male_score > female_score:
            patient_gender["male"] += 1
        elif female_score > male_score:
            patient_gender["female"] += 1

        if is_caregiver:
            caregiver_posts.append(p)
            if signals["caregiver_type"]:
                caregiver_types[signals["caregiver_type"]] += 1
            for t in extract_treatments(text):
                caregiver_treatments[t] += 1
            for concern, pattern in concern_patterns.items():
                if pattern.search(text):
                    caregiver_concerns[concern] += 1
        else:
            for t in extract_treatments(text):
                patient_treatments[t] += 1

    # Caregiver relationship labels
    relationship_labels = {
        "caregiver_wife": "Wife / Partner (male patient)",
        "caregiver_husband": "Husband / Partner (female patient)",
        "caregiver_girlfriend": "Girlfriend (male patient)",
        "caregiver_boyfriend": "Boyfriend (female patient)",
        "caregiver_parent": "Parent",
        "caregiver_child": "Son / Daughter",
        "caregiver_sibling": "Sibling",
    }

    concern_labels = {
        "fear_for_life": "Fear for patient's life / suicidal ideation",
        "seeking_treatment": "Seeking treatment options",
        "diagnosis_help": "Help with diagnosis",
        "support_seeking": "Emotional support / coping",
        "oxygen_access": "Oxygen access / insurance",
    }

    result = {
        "total_caregiver_posts": len(caregiver_posts),
        "patient_gender_estimate": patient_gender,
        "gender_ratio": round(patient_gender["male"] / max(patient_gender["female"], 1), 1),
        "caregiver_relationships": [{"type": relationship_labels.get(t, t), "count": c} for t, c in caregiver_types.most_common()],
        "caregiver_top_concerns": [{"concern": concern_labels.get(c, c), "count": n} for c, n in caregiver_concerns.most_common()],
        "caregiver_treatments_discussed": [{"treatment": t, "count": c} for t, c in caregiver_treatments.most_common(10)],
        "patient_treatments_discussed": [{"treatment": t, "count": c} for t, c in patient_treatments.most_common(10)],
    }

    print(f"    {len(caregiver_posts)} caregiver posts, gender ratio: {result['gender_ratio']}:1 M:F")
    return result


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="ClusterBusters Insights Analytics")
    parser.add_argument("--db", required=True, help="Path to clusterbusters.db")
    parser.add_argument("--output", default=None, help="Output directory")
    args = parser.parse_args()

    if not args.output:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        args.output = os.path.join(os.path.dirname(script_dir), "src", "data", "insights")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    db_path = os.path.expanduser(args.db)
    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        return

    print("=== ClusterBusters Insights Analytics ===")
    print(f"  DB: {db_path}")
    print(f"  Output: {output_dir}")

    posts = load_posts(db_path)
    print(f"\n  Loaded {len(posts)} posts")

    # Run all analyses
    results = {
        "patient-journeys": analyze_patient_journeys(posts),
        "episodic-vs-chronic": analyze_episodic_vs_chronic(posts),
        "treatment-paths": analyze_treatment_paths(posts),
        "demographics": analyze_demographics(posts),
        "cycle-patterns": analyze_cycle_patterns(posts),
        "gender-caregivers": analyze_gender_caregivers(posts),
    }

    # Write individual files
    for slug, data in results.items():
        filepath = output_dir / f"{slug}.json"
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"\n  Wrote {filepath}")

    print("\n=== Insights Analytics Complete ===")


if __name__ == "__main__":
    main()
