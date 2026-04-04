#!/usr/bin/env python3
"""Convert JSON data files to a SQLite database for the forum analysis frontend."""

import json
import os
import sqlite3

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "src", "data")
OUTPUT_DB = os.path.join(PROJECT_ROOT, "public", "analysis.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS forum_stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS treatment_rankings (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_mentions INTEGER NOT NULL,
  positive_rate REAL NOT NULL,
  normalized_mentions REAL NOT NULL,
  composite_score REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS outcomes (
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

CREATE TABLE IF NOT EXISTS timeline (
  year INTEGER NOT NULL,
  treatment_name TEXT NOT NULL,
  mentions INTEGER NOT NULL,
  PRIMARY KEY (year, treatment_name)
);

CREATE TABLE IF NOT EXISTS co_occurrence (
  treatment1 TEXT NOT NULL,
  treatment2 TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (treatment1, treatment2)
);

CREATE TABLE IF NOT EXISTS treatment_profiles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendation_data (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
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

    # forum_stats: store each top-level key as a row
    stats = load_json("forum-stats.json")
    for key, value in stats.items():
        cursor.execute(
            "INSERT INTO forum_stats (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    print(f"  forum_stats: {len(stats)} rows")

    # treatment_rankings
    rankings = load_json("treatment-rankings.json")
    # Build slug->category map from recommendation data for category info
    rec_data = load_json("recommendation-data.json")
    category_map = {r["slug"]: r["category"] for r in rec_data["rankings"]}

    for r in rankings:
        category = category_map.get(r["slug"], "conventional")
        cursor.execute(
            "INSERT INTO treatment_rankings (slug, name, category, total_mentions, positive_rate, normalized_mentions, composite_score) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    print(f"  treatment_rankings: {len(rankings)} rows")

    # outcomes
    outcomes = load_json("outcomes.json")
    for treatment_name, o in outcomes.items():
        cursor.execute(
            "INSERT INTO outcomes (treatment_name, total_mentions, rated_posts, positive, negative, partial, neutral, mixed, positive_rate, negative_rate, partial_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    print(f"  outcomes: {len(outcomes)} rows")

    # timeline
    timeline = load_json("timeline.json")
    row_count = 0
    for year_str, treatments in timeline["per_year"].items():
        year = int(year_str)
        for treatment_name, mentions in treatments.items():
            cursor.execute(
                "INSERT INTO timeline (year, treatment_name, mentions) VALUES (?, ?, ?)",
                (year, treatment_name, mentions),
            )
            row_count += 1
    print(f"  timeline: {row_count} rows")

    # co_occurrence
    co_occ = load_json("co-occurrence.json")
    row_count = 0
    for t1, pairs in co_occ.items():
        for t2, count in pairs.items():
            cursor.execute(
                "INSERT INTO co_occurrence (treatment1, treatment2, count) VALUES (?, ?, ?)",
                (t1, t2, count),
            )
            row_count += 1
    print(f"  co_occurrence: {row_count} rows")

    # treatment_profiles
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
            "INSERT INTO treatment_profiles (slug, name, category, data) VALUES (?, ?, ?, ?)",
            (slug, profile["name"], profile["category"], json.dumps(profile)),
        )
        profile_count += 1
    print(f"  treatment_profiles: {profile_count} rows")

    # recommendation_data
    for key, value in rec_data.items():
        cursor.execute(
            "INSERT INTO recommendation_data (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    print(f"  recommendation_data: {len(rec_data)} rows")

    conn.commit()
    conn.close()
    size_kb = os.path.getsize(OUTPUT_DB) / 1024
    print(f"\nCreated {OUTPUT_DB} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    print("Building analysis.db from JSON data files...")
    build_db()
