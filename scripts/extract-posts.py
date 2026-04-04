#!/usr/bin/env python3
"""Extract top high-signal posts per treatment for LLM analysis."""

import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/projects/clusterbusters/clusterbusters.db")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "posts")

TREATMENTS = {
    "psilocybin-mushrooms": r"psilocybin|mushroom|shroom|cubens|magic.mush|busting.*mush",
    "oxygen": r"\boxygen\b|\bO2\b|high.flow|demand.valve|cluster.kit|15.?(?:lpm|l/min)|optimask",
    "rc-seeds-lsa": r"\bLSA\b|RC.seed|rivea|HBWR|baby.*woodrose|morning.glory|ipomoea",
    "vitamin-d3": r"vitamin.?d3?|cholecalciferol|anti.?inflam.*regimen|d3.regimen|batch.protocol|co.?factor",
    "lsd": r"\bLSD\b|lyserg|acid.*trip|micro.?dos.*lsd|blotter",
    "triptans": r"triptan|sumatriptan|imitrex|zolmitriptan|zomig|rizatriptan|naratriptan|injection.*suma",
    "energy-drinks-caffeine": r"energy.drink|red.bull|monster|caffeine|coffee.*abort|slam.*caffeine|5.?hour",
    "prednisone-steroids": r"prednisone|prednisolone|steroid|cortisone|medrol|dexamethasone|taper",
    "verapamil": r"verapamil|calan|isoptin|channel.blocker.*cluster",
    "bol-148": r"BOL.?148|2-bromo-LSD|bromo.?lyserg",
    "melatonin": r"melatonin|circadian|pineal",
    "lithium": r"\blithium\b|lithobid|eskalith",
    "ketamine": r"\bketamine\b|ketalar|intranasal.*ket|IV.*ket",
}

POSTS_PER_TREATMENT = 50

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Load all posts with enough content
    posts = conn.execute("""
        SELECT p.post_id, p.content_text, p.likes, p.is_first_post, p.posted_date,
               t.title as topic_title, f.name as forum_name
        FROM posts p
        JOIN topics t ON p.topic_id = t.topic_id
        JOIN forums f ON p.forum_id = f.forum_id
        WHERE length(p.content_text) > 150
        ORDER BY p.likes DESC, length(p.content_text) DESC
    """).fetchall()

    print(f"Loaded {len(posts)} substantial posts")

    priority_forums = {"Share Your Busting Stories", "Theory & Implementation"}

    for slug, pattern in TREATMENTS.items():
        regex = re.compile(pattern, re.IGNORECASE)
        matches = []

        for p in posts:
            text = p["content_text"]
            if not regex.search(text):
                continue

            # Score for signal quality
            score = 0
            score += min(len(text), 3000) / 3000 * 40
            score += min(p["likes"] or 0, 20) / 20 * 30
            if p["forum_name"] in priority_forums:
                score += 20
            if p["is_first_post"]:
                score += 10

            matches.append({
                "post_id": p["post_id"],
                "text": text[:3000],
                "topic": p["topic_title"],
                "forum": p["forum_name"],
                "score": round(score, 1),
            })

        # Sort by signal score, take top N
        matches.sort(key=lambda x: x["score"], reverse=True)
        selected = matches[:POSTS_PER_TREATMENT]

        outfile = os.path.join(OUTPUT_DIR, f"{slug}.json")
        with open(outfile, "w") as f:
            json.dump(selected, f, indent=2)

        print(f"  {slug}: {len(matches)} matches → {len(selected)} selected")

    conn.close()

if __name__ == "__main__":
    main()
