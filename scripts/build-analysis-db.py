#!/usr/bin/env python3
"""Convert JSON data files to a SQLite database for the forum analysis frontend."""

import json
import os
import sqlite3

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "src", "data")
OUTPUT_DB = os.path.join(PROJECT_ROOT, "data", "analysis.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS cb_forum_stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cb_treatment_rankings (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_mentions INTEGER NOT NULL,
  positive_rate REAL NOT NULL,
  normalized_mentions REAL NOT NULL,
  composite_score REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cb_outcomes (
  treatment_name TEXT PRIMARY KEY,
  total_mentions INTEGER,
  rated_posts INTEGER,
  positive INTEGER,
  negative INTEGER,
  partial INTEGER,
  neutral INTEGER,
  mixed INTEGER,
  positive_rate REAL,
  negative_rate REAL,
  partial_rate REAL
);

CREATE TABLE IF NOT EXISTS cb_timeline (
  year INTEGER NOT NULL,
  treatment_name TEXT NOT NULL,
  mentions INTEGER NOT NULL,
  PRIMARY KEY (year, treatment_name)
);

CREATE TABLE IF NOT EXISTS cb_co_occurrence (
  treatment1 TEXT NOT NULL,
  treatment2 TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (treatment1, treatment2)
);

CREATE TABLE IF NOT EXISTS cb_treatment_profiles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cb_recommendation_data (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cb_insights (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
"""


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


def build_db():
    if os.path.exists(OUTPUT_DB):
        os.remove(OUTPUT_DB)

    conn = sqlite3.connect(OUTPUT_DB)
    cursor = conn.cursor()
    cursor.executescript(SCHEMA)

    # cb_forum_stats: store each top-level key as a row
    stats = load_json("forum-stats.json")
    for key, value in stats.items():
        cursor.execute(
            "INSERT INTO cb_forum_stats (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    print(f"  cb_forum_stats: {len(stats)} rows")

    # cb_treatment_rankings
    rankings = load_json("treatment-rankings.json")
    # Build slug->category map from recommendation data for category info
    rec_data = load_json("recommendation-data.json")
    # Handle both old format (rankings) and new format (treatments)
    rec_list = rec_data.get("rankings", rec_data.get("treatments", []))
    category_map = {r["slug"]: r.get("category", "conventional") for r in rec_list}

    for r in rankings:
        category = category_map.get(r["slug"], "conventional")
        cursor.execute(
            "INSERT INTO cb_treatment_rankings (slug, name, category, total_mentions, positive_rate, normalized_mentions, composite_score) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                r["slug"],
                r["treatment"],
                category,
                r["total_mentions"],
                r["positive_rate"],
                r["normalized_mentions"],
                r["composite_score"],
            ),
        )
    print(f"  cb_treatment_rankings: {len(rankings)} rows")

    # cb_outcomes
    outcomes = load_json("outcomes.json")
    for treatment_name, o in outcomes.items():
        cursor.execute(
            "INSERT INTO cb_outcomes (treatment_name, total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                treatment_name,
                o["total_mentions"],
                o["rated_posts"],
                o["positive"],
                o["negative"],
                o["partial"],
                o["neutral"],
                o["mixed"],
                o["positive_rate"],
                o["negative_rate"],
                o["partial_rate"],
            ),
        )
    print(f"  cb_outcomes: {len(outcomes)} rows")

    # cb_timeline
    timeline = load_json("timeline.json")
    row_count = 0
    for year_str, treatments in timeline["per_year"].items():
        year = int(year_str)
        for treatment_name, mentions in treatments.items():
            cursor.execute(
                "INSERT INTO cb_timeline (year, treatment_name, mentions) VALUES (?, ?, ?)",
                (year, treatment_name, mentions),
            )
            row_count += 1
    print(f"  cb_timeline: {row_count} rows")

    # cb_co_occurrence
    co_occ = load_json("co-occurrence.json")
    row_count = 0
    for t1, pairs in co_occ.items():
        for t2, count in pairs.items():
            cursor.execute(
                "INSERT INTO cb_co_occurrence (treatment1, treatment2, count) VALUES (?, ?, ?)",
                (t1, t2, count),
            )
            row_count += 1
    print(f"  cb_co_occurrence: {row_count} rows")

    # cb_treatment_profiles
    treatments_dir = os.path.join(DATA_DIR, "treatments")
    profile_count = 0
    for filename in sorted(os.listdir(treatments_dir)):
        if not filename.endswith(".json"):
            continue
        slug = filename.replace(".json", "")
        filepath = os.path.join(treatments_dir, filename)
        with open(filepath, "r") as f:
            profile = json.load(f)
        cursor.execute(
            "INSERT INTO cb_treatment_profiles (slug, name, category, data) VALUES (?, ?, ?, ?)",
            (slug, profile["name"], profile["category"], json.dumps(profile)),
        )
        profile_count += 1
    print(f"  cb_treatment_profiles: {profile_count} rows")

    # cb_recommendation_data
    for key, value in rec_data.items():
        cursor.execute(
            "INSERT INTO cb_recommendation_data (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    print(f"  cb_recommendation_data: {len(rec_data)} rows")

    # cb_insights
    insights_dir = os.path.join(DATA_DIR, "insights")
    if os.path.isdir(insights_dir):
        insight_count = 0
        for filename in sorted(os.listdir(insights_dir)):
            if not filename.endswith(".json"):
                continue
            slug = filename.replace(".json", "")
            filepath = os.path.join(insights_dir, filename)
            with open(filepath, "r") as f:
                data = json.load(f)
            cursor.execute(
                "INSERT INTO cb_insights (slug, data) VALUES (?, ?)",
                (slug, json.dumps(data)),
            )
            insight_count += 1
        print(f"  cb_insights: {insight_count} rows")

    # co_groups
    groups_file = os.path.join(DATA_DIR, "community-groups.json")
    if os.path.exists(groups_file):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS co_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                country TEXT NOT NULL,
                region TEXT NOT NULL,
                platform TEXT NOT NULL,
                url TEXT NOT NULL,
                language TEXT NOT NULL,
                description TEXT,
                members TEXT,
                tags TEXT,
                contact_email TEXT
            )
        """)
        cursor.execute("DELETE FROM co_groups")
        groups = json.load(open(groups_file))
        for g in groups:
            cursor.execute(
                "INSERT INTO co_groups (name, country, region, platform, url, language, description, members, tags, contact_email) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (g["name"], g["country"], g["region"], g["platform"], g["url"],
                 g["language"], g["description"], g.get("members"), json.dumps(g.get("tags", [])), g.get("contact_email")),
            )
        print(f"  co_groups: {len(groups)} rows")

    conn.commit()
    conn.close()
    size_kb = os.path.getsize(OUTPUT_DB) / 1024
    print(f"\nCreated {OUTPUT_DB} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    print("Building analysis.db from JSON data files...")
    build_db()
