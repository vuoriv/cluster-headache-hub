# ClusterBusters Forum Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Analyze 40K ClusterBusters forum posts and present interactive treatment insights as a new "ClusterBusters" tab in the Cluster Headache Research Hub.

**Architecture:** Python analysis pipeline (4 stages: clean → extract → sentiment → LLM) produces static JSON files in `src/data/`. React frontend consumes these as static imports. New "ClusterBusters" tab with nested hash routes for landing dashboard, treatment deep dives, comparison tool, and methodology page.

**Tech Stack:** Python 3 (sqlite3, re, json, anthropic), React 19, TypeScript, Tailwind v4, shadcn/ui (radix-nova), shadcn Chart (Recharts v3), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-04-clusterbusters-forum-analysis-design.md`

---

## Phase 1: Data Analysis Pipeline

### Task 1: Python Script — Stage 1 Text Preprocessing

**Files:**
- Create: `scripts/analyze-forum.py`

- [ ] **Step 1: Create script with argument parsing and Stage 1**

```python
#!/usr/bin/env python3
"""ClusterBusters forum analysis pipeline.

Reads clusterbusters.db and produces JSON files for the web dashboard.
Usage: python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/
"""

import argparse
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from statistics import mean, median

# --- Stage 1: Text Preprocessing ---

REACTION_PATTERN = re.compile(
    r'\s*\n?\s*(Thanks|Haha|Confused|Sad|Like|×|Quote)\s*', re.IGNORECASE
)
HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
MULTI_WHITESPACE = re.compile(r'\s{3,}')
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')


def clean_text(text: str) -> str:
    """Clean a single post's text content."""
    if not text:
        return ""
    # Remove reaction buttons (always at end of content_text)
    text = REACTION_PATTERN.sub('', text)
    # Remove HTML tags
    text = HTML_TAG_PATTERN.sub(' ', text)
    # Remove emails
    text = EMAIL_PATTERN.sub('[email]', text)
    # Normalize whitespace
    text = MULTI_WHITESPACE.sub('\n\n', text).strip()
    return text


def load_and_clean_posts(db_path: str) -> list[dict]:
    """Load all posts from DB, clean text, filter noise."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT p.post_id, p.topic_id, p.forum_id, p.posted_date,
               p.content_text, p.likes, p.is_first_post,
               t.title as topic_title, t.view_count, t.reply_count,
               f.name as forum_name
        FROM posts p
        JOIN topics t ON p.topic_id = t.topic_id
        JOIN forums f ON p.forum_id = f.forum_id
        WHERE p.content_text IS NOT NULL
    """)

    posts = []
    for row in cursor:
        cleaned = clean_text(row['content_text'])
        if len(cleaned) < 50:
            continue  # Skip noise (very short posts)
        posts.append({
            'post_id': row['post_id'],
            'topic_id': row['topic_id'],
            'forum_id': row['forum_id'],
            'forum_name': row['forum_name'],
            'posted_date': row['posted_date'],
            'likes': row['likes'] or 0,
            'is_first_post': row['is_first_post'],
            'topic_title': row['topic_title'],
            'view_count': row['view_count'] or 0,
            'reply_count': row['reply_count'] or 0,
            'text': cleaned,
        })

    conn.close()
    return posts


def compute_forum_stats(db_path: str, posts: list[dict]) -> dict:
    """Compute overall forum statistics."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    total_topics = cursor.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    total_posts_raw = cursor.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    min_date = cursor.execute("SELECT MIN(posted_date) FROM posts").fetchone()[0]
    max_date = cursor.execute("SELECT MAX(posted_date) FROM posts").fetchone()[0]

    forum_breakdown = []
    for row in cursor.execute("""
        SELECT f.name, COUNT(DISTINCT t.topic_id) as topics, COUNT(p.post_id) as posts
        FROM forums f
        LEFT JOIN topics t ON f.forum_id = t.forum_id
        LEFT JOIN posts p ON f.forum_id = p.forum_id
        GROUP BY f.forum_id
        HAVING posts > 0
        ORDER BY posts DESC
    """):
        forum_breakdown.append({
            'name': row[0],
            'topics': row[1],
            'posts': row[2],
        })

    conn.close()

    # Compute year range
    years = set()
    for p in posts:
        if p['posted_date']:
            try:
                years.add(int(p['posted_date'][:4]))
            except (ValueError, TypeError):
                pass

    return {
        'totalPosts': total_posts_raw,
        'totalTopics': total_topics,
        'analyzedPosts': len(posts),
        'dateRange': {'start': min_date, 'end': max_date},
        'yearsOfData': max(years) - min(years) + 1 if years else 0,
        'forums': forum_breakdown,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ClusterBusters forum analysis pipeline')
    parser.add_argument('--db', required=True, help='Path to clusterbusters.db')
    parser.add_argument('--output', required=True, help='Output directory for JSON files')
    parser.add_argument('--skip-llm', action='store_true', help='Skip Stage 4 LLM extraction')
    parser.add_argument('--llm-model', default='claude-haiku-4-5-20251001', help='Claude model for LLM extraction')
    parser.add_argument('--top-n', type=int, default=10, help='Number of treatments for LLM deep dive')
    parser.add_argument('--sample-size', type=int, default=300, help='Posts per treatment for LLM')
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Error: Database not found: {args.db}")
        sys.exit(1)

    os.makedirs(args.output, exist_ok=True)
    os.makedirs(os.path.join(args.output, 'treatments'), exist_ok=True)

    print("=== Stage 1: Text Preprocessing ===")
    posts = load_and_clean_posts(args.db)
    print(f"  Loaded and cleaned {len(posts)} posts (filtered short/empty)")

    forum_stats = compute_forum_stats(args.db, posts)
    with open(os.path.join(args.output, 'forum-stats.json'), 'w') as f:
        json.dump(forum_stats, f, indent=2)
    print(f"  Wrote forum-stats.json")

    # Stages 2-4 follow in subsequent tasks
    print("\nDone (Stage 1 only).")
```

- [ ] **Step 2: Run Stage 1 to verify it works**

```bash
cd /Users/ville/projects/cluster-headache-hub
python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/ --skip-llm
```

Expected: Prints post count, writes `src/data/forum-stats.json`.

- [ ] **Step 3: Verify output**

Check `src/data/forum-stats.json` has correct structure with totalPosts ~40388, totalTopics ~7869, forum breakdown.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-forum.py src/data/forum-stats.json
git commit -m "feat: add forum analysis pipeline Stage 1 — text preprocessing"
```

---

### Task 2: Stage 2 — Treatment Extraction

**Files:**
- Modify: `scripts/analyze-forum.py`

- [ ] **Step 1: Add treatment extraction to the script**

Add after Stage 1 in the script:

```python
# --- Stage 2: Treatment Extraction ---

TREATMENT_PATTERNS = {
    'mushrooms': {
        'name': 'Psilocybin Mushrooms',
        'category': 'psychedelic',
        'pattern': re.compile(r'\b(mushroom|shroom|psilocybin|cubensis|magic mushroom)\b', re.I),
    },
    'rc-seeds': {
        'name': 'RC Seeds / LSA',
        'category': 'psychedelic',
        'pattern': re.compile(r'\b(rc seed|rivea|hbwr|hawaiian baby woodrose|\blsa\b|morning glory|corymbosa)\b', re.I),
    },
    'oxygen': {
        'name': 'Oxygen Therapy',
        'category': 'acute',
        'pattern': re.compile(r'\b(oxygen|o2|high.?flow|welding oxygen|demand valve)\b', re.I),
    },
    'lsd': {
        'name': 'LSD',
        'category': 'psychedelic',
        'pattern': re.compile(r'\blsd\b|lysergic|\bacid\b', re.I),
    },
    'vitamin-d3': {
        'name': 'Vitamin D3 Regimen',
        'category': 'supportive',
        'pattern': re.compile(r'\b(vitamin d|d3 regimen|anti.?inflammatory regimen|d3 protocol)\b', re.I),
    },
    'verapamil': {
        'name': 'Verapamil',
        'category': 'conventional',
        'pattern': re.compile(r'\b(verapamil|calan|isoptin)\b', re.I),
    },
    'triptans': {
        'name': 'Triptans / Sumatriptan',
        'category': 'acute',
        'pattern': re.compile(r'\b(sumatriptan|imitrex|zomig|triptan|rizatriptan|maxalt|naratriptan)\b', re.I),
    },
    'ketamine': {
        'name': 'Ketamine',
        'category': 'psychedelic',
        'pattern': re.compile(r'\b(ketamine|k.?therapy|k.?infusion)\b', re.I),
    },
    'bol-148': {
        'name': 'BOL-148',
        'category': 'psychedelic',
        'pattern': re.compile(r'\b(bol.?148|bromo.?lsd|2.?bromo)\b', re.I),
    },
    'melatonin': {
        'name': 'Melatonin',
        'category': 'supportive',
        'pattern': re.compile(r'\bmelatonin\b', re.I),
    },
    'prednisone': {
        'name': 'Prednisone / Steroids',
        'category': 'conventional',
        'pattern': re.compile(r'\b(prednisone|pred pack|steroid|methylprednisolone|dexamethasone|prednisolone)\b', re.I),
    },
    'lithium': {
        'name': 'Lithium',
        'category': 'conventional',
        'pattern': re.compile(r'\blithium\b', re.I),
    },
    'energy-drinks': {
        'name': 'Energy Drinks / Caffeine',
        'category': 'acute',
        'pattern': re.compile(r'\b(red bull|energy drink|caffeine|taurine|monster energy|coffee abort)\b', re.I),
    },
}


def extract_treatments(posts: list[dict]) -> dict:
    """Extract treatment mentions from all posts. Returns per-post treatment tags and aggregates."""
    # Tag each post with treatments mentioned
    for post in posts:
        text = post['text'].lower()
        post['treatments'] = [
            slug for slug, info in TREATMENT_PATTERNS.items()
            if info['pattern'].search(text)
        ]

    # Aggregate mention counts
    mention_counts = Counter()
    for post in posts:
        for t in post['treatments']:
            mention_counts[t] += 1

    # Per-year timeline
    timeline = defaultdict(lambda: defaultdict(int))
    for post in posts:
        if not post['posted_date']:
            continue
        try:
            year = int(post['posted_date'][:4])
        except (ValueError, TypeError):
            continue
        for t in post['treatments']:
            timeline[year][t] += 1

    # Sort timeline by year
    years = sorted(timeline.keys())
    timeline_data = []
    for year in years:
        entry = {'year': year}
        for slug in TREATMENT_PATTERNS:
            entry[slug] = timeline[year].get(slug, 0)
        timeline_data.append(entry)

    # Co-occurrence matrix
    co_occurrence = defaultdict(int)
    for post in posts:
        treatments = sorted(post['treatments'])
        for i, t1 in enumerate(treatments):
            for t2 in treatments[i+1:]:
                co_occurrence[f"{t1}|{t2}"] += 1

    co_occurrence_list = []
    for key, count in sorted(co_occurrence.items(), key=lambda x: -x[1])[:50]:
        t1, t2 = key.split('|')
        co_occurrence_list.append({'treatment1': t1, 'treatment2': t2, 'count': count})

    return {
        'mentionCounts': dict(mention_counts.most_common()),
        'timeline': timeline_data,
        'coOccurrence': co_occurrence_list,
    }
```

And in `__main__`, after Stage 1:

```python
    print("\n=== Stage 2: Treatment Extraction ===")
    treatment_data = extract_treatments(posts)
    print(f"  Found {len(treatment_data['mentionCounts'])} treatments")
    for slug, count in sorted(treatment_data['mentionCounts'].items(), key=lambda x: -x[1])[:10]:
        print(f"    {TREATMENT_PATTERNS[slug]['name']}: {count} mentions")

    with open(os.path.join(args.output, 'timeline.json'), 'w') as f:
        json.dump(treatment_data['timeline'], f, indent=2)

    with open(os.path.join(args.output, 'co-occurrence.json'), 'w') as f:
        json.dump(treatment_data['coOccurrence'], f, indent=2)

    print(f"  Wrote timeline.json, co-occurrence.json")
```

- [ ] **Step 2: Run and verify Stage 2**

```bash
python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/ --skip-llm
```

Expected: Prints treatment mention counts. Check `src/data/timeline.json` has year entries with per-treatment counts. Check `src/data/co-occurrence.json` has treatment pair counts.

- [ ] **Step 3: Commit**

```bash
git add scripts/analyze-forum.py src/data/timeline.json src/data/co-occurrence.json
git commit -m "feat: add Stage 2 — treatment extraction with timeline and co-occurrence"
```

---

### Task 3: Stage 3 — Sentiment & Outcome Analysis

**Files:**
- Modify: `scripts/analyze-forum.py`

- [ ] **Step 1: Add sentiment analysis**

Add after Stage 2 code:

```python
# --- Stage 3: Sentiment & Outcome Analysis ---

POSITIVE_TERMS = re.compile(
    r'\b(pain.?free|busted|shadow.?free|remission|worked|amazing|'
    r'gone|relief|abort|stopped|broke the cycle|pf\b|kip.?0|'
    r'no more attacks|cluster.?free|headache.?free|'
    r'life.?changing|miracle|success|effective|cured|'
    r'it worked|completely gone|finally free|no attacks)\b', re.I
)

NEGATIVE_TERMS = re.compile(
    r'\b(failed|rebound|no effect|worse|useless|didn.?t work|'
    r'no relief|nothing|waste|hopeless|ineffective|'
    r'not working|no change|no improvement|no help|'
    r'made it worse|increased|more frequent|didn.?t help)\b', re.I
)

PARTIAL_TERMS = re.compile(
    r'\b(some relief|reduced|partial|less intense|not sure|'
    r'helped a bit|kinda|somewhat|slight|mild improvement|'
    r'fewer attacks|shorter attacks|less severe)\b', re.I
)


def analyze_sentiment(posts: list[dict]) -> dict:
    """Analyze treatment outcome sentiment for each post and aggregate per treatment."""
    # Score each post
    for post in posts:
        if not post['treatments']:
            post['sentiment'] = 'neutral'
            continue
        text = post['text']
        pos = len(POSITIVE_TERMS.findall(text))
        neg = len(NEGATIVE_TERMS.findall(text))
        par = len(PARTIAL_TERMS.findall(text))

        if pos > neg and pos > par:
            post['sentiment'] = 'positive'
        elif neg > pos and neg > par:
            post['sentiment'] = 'negative'
        elif par > 0 and par >= pos and par >= neg:
            post['sentiment'] = 'partial'
        else:
            post['sentiment'] = 'neutral'

    # Aggregate per treatment
    treatment_outcomes = {}
    for slug in TREATMENT_PATTERNS:
        treatment_posts = [p for p in posts if slug in p.get('treatments', [])]
        if not treatment_posts:
            continue

        sentiments = Counter(p['sentiment'] for p in treatment_posts)
        total_with_opinion = sentiments['positive'] + sentiments['negative'] + sentiments['partial']
        positive_rate = sentiments['positive'] / total_with_opinion if total_with_opinion > 0 else 0

        treatment_outcomes[slug] = {
            'slug': slug,
            'name': TREATMENT_PATTERNS[slug]['name'],
            'category': TREATMENT_PATTERNS[slug]['category'],
            'mentions': len(treatment_posts),
            'positive': sentiments['positive'],
            'negative': sentiments['negative'],
            'partial': sentiments['partial'],
            'neutral': sentiments['neutral'],
            'positiveRate': round(positive_rate * 100, 1),
            'sampleSize': total_with_opinion,
        }

    # Sentiment by treatment over time
    sentiment_timeline = defaultdict(lambda: defaultdict(lambda: {'positive': 0, 'negative': 0, 'partial': 0, 'neutral': 0}))
    for post in posts:
        if not post['treatments'] or not post['posted_date']:
            continue
        try:
            year = int(post['posted_date'][:4])
        except (ValueError, TypeError):
            continue
        for slug in post['treatments']:
            sentiment_timeline[year][slug][post['sentiment']] += 1

    sentiment_timeline_data = []
    for year in sorted(sentiment_timeline.keys()):
        entry = {'year': year}
        for slug in TREATMENT_PATTERNS:
            data = sentiment_timeline[year].get(slug, {'positive': 0, 'negative': 0, 'partial': 0, 'neutral': 0})
            total = data['positive'] + data['negative'] + data['partial']
            entry[slug] = {
                'positiveRate': round(data['positive'] / total * 100, 1) if total > 0 else None,
                'mentions': sum(data.values()),
            }
        sentiment_timeline_data.append(entry)

    return {
        'outcomes': treatment_outcomes,
        'sentimentTimeline': sentiment_timeline_data,
    }
```

And in `__main__`, after Stage 2:

```python
    print("\n=== Stage 3: Sentiment & Outcome Analysis ===")
    sentiment_data = analyze_sentiment(posts)
    outcomes = sentiment_data['outcomes']

    # Build treatment rankings (normalized score)
    max_mentions = max(o['mentions'] for o in outcomes.values()) if outcomes else 1
    rankings = []
    for slug, o in outcomes.items():
        norm_mentions = o['mentions'] / max_mentions
        score = (norm_mentions * 0.4) + ((o['positiveRate'] / 100) * 0.6)
        rankings.append({**o, 'score': round(score, 3)})
    rankings.sort(key=lambda x: -x['score'])

    # Compute overall success ratio
    total_pos = sum(o['positive'] for o in outcomes.values())
    total_neg = sum(o['negative'] for o in outcomes.values())
    success_ratio = round(total_pos / total_neg, 1) if total_neg > 0 else 0

    # Update forum stats with success ratio
    forum_stats['successRatio'] = success_ratio
    with open(os.path.join(args.output, 'forum-stats.json'), 'w') as f:
        json.dump(forum_stats, f, indent=2)

    with open(os.path.join(args.output, 'treatment-rankings.json'), 'w') as f:
        json.dump(rankings, f, indent=2)

    with open(os.path.join(args.output, 'outcomes.json'), 'w') as f:
        json.dump(sentiment_data['outcomes'], f, indent=2)

    print(f"  Overall success ratio: {success_ratio}:1")
    print(f"  Top 5 treatments by score:")
    for r in rankings[:5]:
        print(f"    {r['name']}: {r['positiveRate']}% positive ({r['mentions']} mentions, score={r['score']})")
    print(f"  Wrote treatment-rankings.json, outcomes.json")
```

- [ ] **Step 2: Run and verify Stage 3**

```bash
python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/ --skip-llm
```

Expected: Prints treatment rankings with positive rates. Verify `treatment-rankings.json` has entries sorted by score with positiveRate values.

- [ ] **Step 3: Commit**

```bash
git add scripts/analyze-forum.py src/data/treatment-rankings.json src/data/outcomes.json src/data/forum-stats.json
git commit -m "feat: add Stage 3 — sentiment analysis and treatment rankings"
```

---

### Task 4: Stage 4 — LLM Deep Extraction

**Files:**
- Modify: `scripts/analyze-forum.py`

- [ ] **Step 1: Add LLM extraction for top treatments**

Add after Stage 3 code:

```python
# --- Stage 4: LLM Deep Extraction ---

LLM_EXTRACTION_PROMPT = """Analyze this cluster headache patient forum post about {treatment_name}. Extract structured information.

POST:
{post_text}

Return a JSON object with ONLY the fields you can confidently extract from this post. Omit fields where the post doesn't contain relevant information.

{{
  "dosage": "amount and form if mentioned (e.g., '1.5g dried mushrooms', '25mcg LSD', '15 LPM O2')",
  "preparation": "how it was prepared/taken if mentioned (e.g., 'tea', 'capsules', 'non-rebreather mask')",
  "protocol": "timing/schedule if mentioned (e.g., 'every 5 days', '3 doses over 2 weeks')",
  "outcome": 1-5 where 1=no effect 2=slight relief 3=moderate relief 4=significant relief 5=complete remission/pain-free,
  "outcome_description": "brief description of what happened",
  "side_effects": ["list", "of", "side effects"],
  "co_treatments": ["other", "treatments", "used", "alongside"],
  "time_to_effect": "how quickly it worked if mentioned",
  "ch_type": "episodic or chronic if mentioned",
  "cycle_context": "in-cycle, preventive, or transitional if mentioned"
}}

Return ONLY valid JSON, no other text."""


def select_high_signal_posts(posts: list[dict], slug: str, sample_size: int) -> list[dict]:
    """Select the most informative posts for a treatment."""
    treatment_posts = [p for p in posts if slug in p.get('treatments', [])]

    # Score posts by signal quality
    for p in treatment_posts:
        signal = 0
        signal += min(len(p['text']) / 500, 3)  # Length (max 3 points)
        signal += min(p['likes'] / 5, 2)  # Likes (max 2 points)
        signal += 1 if p['sentiment'] in ('positive', 'negative') else 0  # Has opinion
        signal += 1 if p['forum_name'] in ('Share Your Busting Stories', 'Theory & Implementation') else 0
        signal += 0.5 if p['is_first_post'] else 0  # Topic starters often have more detail
        p['_signal'] = signal

    # Sort by signal, take top N
    treatment_posts.sort(key=lambda x: -x['_signal'])
    return treatment_posts[:sample_size]


def llm_extract_treatment(posts: list[dict], slug: str, treatment_name: str,
                          model: str, sample_size: int) -> dict:
    """Use Claude API to extract structured treatment data from high-signal posts."""
    try:
        import anthropic
    except ImportError:
        print("  WARNING: anthropic package not installed. Run: pip install anthropic")
        return None

    client = anthropic.Anthropic()
    selected = select_high_signal_posts(posts, slug, sample_size)
    print(f"  Processing {len(selected)} posts for {treatment_name}...")

    extractions = []
    for i, post in enumerate(selected):
        if i % 50 == 0 and i > 0:
            print(f"    ...{i}/{len(selected)} posts processed")
        try:
            response = client.messages.create(
                model=model,
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": LLM_EXTRACTION_PROMPT.format(
                        treatment_name=treatment_name,
                        post_text=post['text'][:2000]  # Truncate very long posts
                    )
                }]
            )
            text = response.content[0].text.strip()
            # Parse JSON from response
            if text.startswith('{'):
                data = json.loads(text)
                extractions.append(data)
        except (json.JSONDecodeError, Exception) as e:
            continue  # Skip posts that fail extraction

    if not extractions:
        return None

    # Aggregate extractions into treatment profile
    dosages = Counter()
    preparations = Counter()
    protocols = Counter()
    outcomes = []
    side_effects = Counter()
    co_treatments = Counter()
    time_to_effects = Counter()
    ch_types = Counter()

    for ext in extractions:
        if ext.get('dosage'):
            dosages[ext['dosage']] += 1
        if ext.get('preparation'):
            preparations[ext['preparation']] += 1
        if ext.get('protocol'):
            protocols[ext['protocol']] += 1
        if ext.get('outcome'):
            try:
                outcomes.append(int(ext['outcome']))
            except (ValueError, TypeError):
                pass
        for se in (ext.get('side_effects') or []):
            side_effects[se.lower().strip()] += 1
        for ct in (ext.get('co_treatments') or []):
            co_treatments[ct.lower().strip()] += 1
        if ext.get('time_to_effect'):
            time_to_effects[ext['time_to_effect']] += 1
        if ext.get('ch_type'):
            ch_types[ext['ch_type'].lower()] += 1

    # Build aggregated profile
    outcome_dist = Counter(outcomes)
    effective = sum(1 for o in outcomes if o >= 4)
    partial = sum(1 for o in outcomes if o == 3)
    no_effect = sum(1 for o in outcomes if o <= 2)
    total_rated = len(outcomes)

    return {
        'dosages': dosages.most_common(10),
        'preparations': preparations.most_common(5),
        'protocols': protocols.most_common(10),
        'outcomes': {
            'effective': round(effective / total_rated * 100, 1) if total_rated else 0,
            'partial': round(partial / total_rated * 100, 1) if total_rated else 0,
            'noEffect': round(no_effect / total_rated * 100, 1) if total_rated else 0,
            'sampleSize': total_rated,
            'avgScore': round(mean(outcomes), 2) if outcomes else 0,
        },
        'sideEffects': [{'name': se, 'count': c} for se, c in side_effects.most_common(15)],
        'coTreatments': [{'name': ct, 'count': c} for ct, c in co_treatments.most_common(10)],
        'timeToEffect': time_to_effects.most_common(5),
        'chTypes': dict(ch_types),
        'extractionCount': len(extractions),
    }


def build_treatment_profile(slug: str, rankings: list[dict], llm_data: dict | None,
                            posts: list[dict], timeline_data: list[dict]) -> dict:
    """Build complete treatment profile JSON for a single treatment."""
    info = TREATMENT_PATTERNS[slug]
    ranking = next((r for r in rankings if r['slug'] == slug), None)
    if not ranking:
        return None

    # Per-treatment timeline
    treatment_timeline = []
    for entry in timeline_data:
        year_mentions = entry.get(slug, 0)
        if year_mentions > 0 or entry['year'] >= 2009:
            treatment_timeline.append({
                'year': entry['year'],
                'mentions': year_mentions,
            })

    # Find peak year
    peak_year = max(treatment_timeline, key=lambda x: x['mentions'])['year'] if treatment_timeline else None

    profile = {
        'slug': slug,
        'name': info['name'],
        'category': info['category'],
        'stats': {
            'mentions': ranking['mentions'],
            'positiveRate': ranking['positiveRate'],
            'peakYear': peak_year,
            'score': ranking['score'],
        },
        'timeline': treatment_timeline,
        'sampleSize': ranking['sampleSize'],
    }

    # Add LLM data if available
    if llm_data:
        profile['protocol'] = {
            'dosing': [f"{d[0]} ({d[1]}x reported)" for d in llm_data['dosages'][:5]],
            'preparations': [f"{p[0]} ({p[1]}x)" for p in llm_data['preparations']],
            'schedule': [f"{p[0]} ({p[1]}x)" for p in llm_data['protocols'][:5]],
        }
        profile['outcomes'] = llm_data['outcomes']
        profile['sideEffects'] = [se['name'] for se in llm_data['sideEffects'][:10]]
        profile['coTreatments'] = llm_data['coTreatments']
        profile['timeToEffect'] = llm_data['timeToEffect']
        profile['contraindications'] = []  # Extracted separately below
    else:
        # Basic profile without LLM data
        profile['protocol'] = {'dosing': [], 'preparations': [], 'schedule': []}
        profile['outcomes'] = {
            'effective': ranking['positiveRate'],
            'partial': 0,
            'noEffect': round(100 - ranking['positiveRate'], 1),
            'sampleSize': ranking['sampleSize'],
        }
        profile['sideEffects'] = []
        profile['coTreatments'] = []

    return profile
```

And in `__main__`, after Stage 3:

```python
    print("\n=== Stage 4: LLM Deep Extraction ===")
    top_treatments = rankings[:args.top_n]

    if args.skip_llm:
        print(f"  Skipping LLM extraction (--skip-llm flag)")
        for r in top_treatments:
            profile = build_treatment_profile(
                r['slug'], rankings, None, posts, treatment_data['timeline']
            )
            if profile:
                path = os.path.join(args.output, 'treatments', f"{r['slug']}.json")
                with open(path, 'w') as f:
                    json.dump(profile, f, indent=2)
        print(f"  Wrote {len(top_treatments)} basic treatment profiles")
    else:
        for r in top_treatments:
            print(f"\n  --- {r['name']} ({r['mentions']} mentions) ---")
            llm_data = llm_extract_treatment(
                posts, r['slug'], r['name'], args.llm_model, args.sample_size
            )
            profile = build_treatment_profile(
                r['slug'], rankings, llm_data, posts, treatment_data['timeline']
            )
            if profile:
                path = os.path.join(args.output, 'treatments', f"{r['slug']}.json")
                with open(path, 'w') as f:
                    json.dump(profile, f, indent=2)
                print(f"  Wrote treatments/{r['slug']}.json")

    # Build recommendation data
    recommendation_data = {
        'filters': {
            'chTypes': ['episodic', 'chronic'],
            'cycleStatus': ['in-cycle', 'remission', 'new-patient'],
            'treatments': [{'slug': r['slug'], 'name': r['name']} for r in rankings],
        },
        'rankings': [{'slug': r['slug'], 'name': r['name'], 'category': r['category'],
                       'positiveRate': r['positiveRate'], 'score': r['score']}
                      for r in rankings],
    }
    with open(os.path.join(args.output, 'recommendation-data.json'), 'w') as f:
        json.dump(recommendation_data, f, indent=2)

    print(f"\n=== Pipeline Complete ===")
    print(f"Output files in {args.output}:")
    for f_name in sorted(os.listdir(args.output)):
        full = os.path.join(args.output, f_name)
        if os.path.isdir(full):
            for sub in sorted(os.listdir(full)):
                print(f"  {f_name}/{sub}")
        else:
            print(f"  {f_name}")
```

- [ ] **Step 2: Run without LLM first to verify profile structure**

```bash
python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/ --skip-llm
```

Expected: Creates `src/data/treatments/{slug}.json` for top treatments with basic profiles. Creates `src/data/recommendation-data.json`.

- [ ] **Step 3: Run with LLM extraction (requires ANTHROPIC_API_KEY)**

```bash
export ANTHROPIC_API_KEY=your-key-here
python scripts/analyze-forum.py --db ~/projects/clusterbusters/clusterbusters.db --output src/data/ --top-n 8 --sample-size 200
```

Expected: Takes 10-30 minutes. Creates enriched treatment profiles with dosing, protocols, outcomes, side effects.

- [ ] **Step 4: Verify output quality**

Inspect several `src/data/treatments/*.json` files. Check that:
- `outcomes.effective` + `outcomes.partial` + `outcomes.noEffect` ≈ 100%
- `sideEffects` contains realistic items
- `protocol.dosing` has actual dosage info
- `coTreatments` links make sense

- [ ] **Step 5: Commit all data**

```bash
git add scripts/analyze-forum.py src/data/
git commit -m "feat: add Stage 4 — LLM deep extraction and complete pipeline"
```

---

## Phase 2: Frontend — Foundation

### Task 5: Install shadcn Chart + Breadcrumb Components

**Files:**
- Modified by CLI: `src/components/ui/chart.tsx`, `src/components/ui/breadcrumb.tsx`

- [ ] **Step 1: Install chart and breadcrumb components**

```bash
cd /Users/ville/projects/cluster-headache-hub
npx shadcn@latest add chart breadcrumb
```

- [ ] **Step 2: Verify installations**

Check that `src/components/ui/chart.tsx` and `src/components/ui/breadcrumb.tsx` exist and have correct imports.

- [ ] **Step 3: Add chart CSS variables to index.css**

Add additional chart colors for the treatment categories after the existing `--chart-5` in both `:root` and `.dark`:

```css
/* In :root: */
--chart-6: oklch(0.55 0.18 300);
--chart-7: oklch(0.55 0.15 160);
--chart-8: oklch(0.60 0.15 135);
--chart-9: oklch(0.50 0.12 25);
--chart-10: oklch(0.60 0.10 260);

/* In .dark: */
--chart-6: oklch(0.65 0.15 300);
--chart-7: oklch(0.60 0.12 160);
--chart-8: oklch(0.65 0.12 135);
--chart-9: oklch(0.55 0.10 25);
--chart-10: oklch(0.65 0.08 260);
```

And in `@theme inline`:
```css
--color-chart-6: var(--chart-6);
--color-chart-7: var(--chart-7);
--color-chart-8: var(--chart-8);
--color-chart-9: var(--chart-9);
--color-chart-10: var(--chart-10);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/chart.tsx src/components/ui/breadcrumb.tsx src/index.css
git commit -m "feat: add shadcn chart and breadcrumb components with extra chart colors"
```

---

### Task 6: TypeScript Types for ClusterBusters Data

**Files:**
- Create: `src/lib/clusterbusters-types.ts`

- [ ] **Step 1: Create type definitions**

```typescript
export interface ForumStats {
  totalPosts: number
  totalTopics: number
  analyzedPosts: number
  dateRange: { start: string; end: string }
  yearsOfData: number
  successRatio: number
  forums: { name: string; topics: number; posts: number }[]
}

export interface TreatmentRanking {
  slug: string
  name: string
  category: "psychedelic" | "conventional" | "supportive" | "acute"
  mentions: number
  positive: number
  negative: number
  partial: number
  neutral: number
  positiveRate: number
  sampleSize: number
  score: number
}

export interface TimelineEntry {
  year: number
  [treatmentSlug: string]: number
}

export interface CoOccurrence {
  treatment1: string
  treatment2: string
  count: number
}

export interface TreatmentOutcomes {
  effective: number
  partial: number
  noEffect: number
  sampleSize: number
  avgScore?: number
}

export interface TreatmentProfile {
  slug: string
  name: string
  category: "psychedelic" | "conventional" | "supportive" | "acute"
  stats: {
    mentions: number
    positiveRate: number
    peakYear: number | null
    score: number
  }
  protocol: {
    dosing: string[]
    preparations: string[]
    schedule: string[]
  }
  outcomes: TreatmentOutcomes
  timeline: { year: number; mentions: number }[]
  sideEffects: string[]
  contraindications: string[]
  coTreatments: { name: string; count: number }[]
  timeToEffect?: [string, number][]
  sampleSize: number
}

export interface RecommendationData {
  filters: {
    chTypes: string[]
    cycleStatus: string[]
    treatments: { slug: string; name: string }[]
  }
  rankings: {
    slug: string
    name: string
    category: string
    positiveRate: number
    score: number
  }[]
}

// Category colors for charts
export const CATEGORY_COLORS: Record<string, string> = {
  psychedelic: "var(--chart-4)",   // purple
  conventional: "var(--chart-1)",  // blue
  supportive: "var(--chart-2)",    // teal
  acute: "var(--chart-3)",         // gold
}

// Treatment-specific chart colors (by slug, for timeline/comparison)
export const TREATMENT_COLORS: Record<string, string> = {
  mushrooms: "var(--chart-4)",
  "rc-seeds": "var(--chart-6)",
  oxygen: "var(--chart-3)",
  lsd: "var(--chart-10)",
  "vitamin-d3": "var(--chart-2)",
  verapamil: "var(--chart-1)",
  triptans: "var(--chart-5)",
  ketamine: "var(--chart-7)",
  "bol-148": "var(--chart-8)",
  melatonin: "var(--chart-9)",
  prednisone: "var(--chart-1)",
  lithium: "var(--chart-5)",
  "energy-drinks": "var(--chart-3)",
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/clusterbusters-types.ts
git commit -m "feat: add TypeScript types for ClusterBusters data"
```

---

### Task 7: Tab Router + App.tsx Integration

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/tabs/clusterbusters-tab.tsx`

- [ ] **Step 1: Create the ClusterBusters tab router component**

```typescript
import { useState, useEffect, useCallback } from "react"

// Lazy-load subpages to avoid loading all data on initial page load
import { CbLanding } from "@/components/tabs/clusterbusters/cb-landing"

type CbRoute =
  | { page: "landing" }
  | { page: "treatment"; slug: string }
  | { page: "compare" }
  | { page: "methodology" }

function parseCbRoute(hash: string): CbRoute {
  // hash comes in as "clusterbusters" or "clusterbusters/mushrooms" etc.
  const parts = hash.split("/")
  if (parts.length === 1) return { page: "landing" }
  const sub = parts[1]
  if (sub === "compare") return { page: "compare" }
  if (sub === "methodology") return { page: "methodology" }
  return { page: "treatment", slug: sub }
}

export function ClusterBustersTab() {
  const [route, setRoute] = useState<CbRoute>(() => {
    const hash = window.location.hash.slice(1)
    return parseCbRoute(hash)
  })

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash.startsWith("clusterbusters")) {
        setRoute(parseCbRoute(hash))
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const navigate = useCallback((path: string) => {
    window.history.replaceState(null, "", `#${path}`)
    setRoute(parseCbRoute(path))
  }, [])

  switch (route.page) {
    case "landing":
      return <CbLanding onNavigate={navigate} />
    case "treatment":
      // Dynamic import will be added in Task 11
      return <CbTreatmentDetailPlaceholder slug={route.slug} onNavigate={navigate} />
    case "compare":
      return <CbComparePlaceholder onNavigate={navigate} />
    case "methodology":
      return <CbMethodologyPlaceholder onNavigate={navigate} />
  }
}

// Temporary placeholders — replaced in later tasks
function CbTreatmentDetailPlaceholder({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  return <div className="py-8"><p>Treatment detail for: {slug}</p><button onClick={() => onNavigate("clusterbusters")}>← Back</button></div>
}
function CbComparePlaceholder({ onNavigate }: { onNavigate: (p: string) => void }) {
  return <div className="py-8"><p>Compare tool (coming soon)</p><button onClick={() => onNavigate("clusterbusters")}>← Back</button></div>
}
function CbMethodologyPlaceholder({ onNavigate }: { onNavigate: (p: string) => void }) {
  return <div className="py-8"><p>Methodology (coming soon)</p><button onClick={() => onNavigate("clusterbusters")}>← Back</button></div>
}
```

- [ ] **Step 2: Modify App.tsx to add the new tab**

In `src/App.tsx`, add the import and tab:

```typescript
// Add import
import { ClusterBustersTab } from "@/components/tabs/clusterbusters-tab"

// Update validTabs (line ~32)
const validTabs = ["overview", "trials", "research", "treatments", "community", "triggers", "clusterbusters"]

// Update getTabFromHash to handle nested hash
const getTabFromHash = useCallback(() => {
  const hash = window.location.hash.slice(1)
  const base = hash.split("/")[0]
  return validTabs.includes(base) ? base : "overview"
}, [])

// Add TabsTrigger after Triggers (line ~80)
<TabsTrigger value="clusterbusters">ClusterBusters</TabsTrigger>

// Add TabsContent after Triggers (line ~88)
<TabsContent value="clusterbusters"><ClusterBustersTab /></TabsContent>
```

- [ ] **Step 3: Verify the tab appears and routes work**

```bash
cd /Users/ville/projects/cluster-headache-hub && npm run dev
```

Open http://localhost:5173/#clusterbusters — should show landing placeholder. Navigate to `#clusterbusters/mushrooms` — should show treatment placeholder.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/tabs/clusterbusters-tab.tsx
git commit -m "feat: add ClusterBusters tab with hash-based sub-routing"
```

---

## Phase 3: Frontend — Landing Dashboard

### Task 8: Disclaimer Banner + Intro Description

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-disclaimer.tsx`

- [ ] **Step 1: Create the disclaimer and intro component**

```typescript
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export function CbDisclaimer({ onMethodologyClick }: { onMethodologyClick: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <a href="https://clusterbusters.org" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/80 hover:underline">ClusterBusters</a> is
          the largest online community for cluster headache patients, active since 2002. We analyzed 17 years of forum discussions
          to surface how patients actually treat their condition — what works, what fails, and how protocols have evolved over time.
        </p>
      </div>
      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription className="text-xs">
          Community-reported experiences from ClusterBusters.org forums (2009–2026). This is not medical advice.{" "}
          <button onClick={onMethodologyClick} className="font-medium underline underline-offset-2 hover:text-foreground">
            How we analyzed this data →
          </button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tabs/clusterbusters/cb-disclaimer.tsx
git commit -m "feat: add ClusterBusters disclaimer banner with intro description"
```

---

### Task 9: Stats Row + Treatment Rankings Chart

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-stats-row.tsx`
- Create: `src/components/tabs/clusterbusters/cb-treatment-rankings.tsx`

- [ ] **Step 1: Create stats row component**

```typescript
import { Card, CardContent } from "@/components/ui/card"

interface StatItemProps {
  value: string | number
  label: string
}

function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold tracking-tight tabular-nums font-heading">{value}</div>
      <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  )
}

interface CbStatsRowProps {
  totalPosts: number
  totalTopics: number
  yearsOfData: number
  successRatio: number
}

export function CbStatsRow({ totalPosts, totalTopics, yearsOfData, successRatio }: CbStatsRowProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
        <StatItem value={totalPosts.toLocaleString()} label="Forum Posts" />
        <StatItem value={totalTopics.toLocaleString()} label="Topics" />
        <StatItem value={yearsOfData} label="Years of Data" />
        <StatItem value={`${successRatio}:1`} label="Success Ratio" />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create treatment rankings bar chart**

```typescript
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentRanking } from "@/lib/clusterbusters-types"
import { CATEGORY_COLORS } from "@/lib/clusterbusters-types"
import { BarChart3 } from "lucide-react"

interface CbTreatmentRankingsProps {
  rankings: TreatmentRanking[]
  onTreatmentClick: (slug: string) => void
}

export function CbTreatmentRankings({ rankings, onTreatmentClick }: CbTreatmentRankingsProps) {
  // Take top 12 and format for chart
  const data = rankings.slice(0, 12).map((r) => ({
    name: r.name,
    slug: r.slug,
    positiveRate: r.positiveRate,
    mentions: r.mentions,
    category: r.category,
    fill: CATEGORY_COLORS[r.category] || "var(--chart-1)",
  }))

  const chartConfig = {
    positiveRate: { label: "Positive Rate" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" />
          Treatment Rankings
        </CardTitle>
        <CardDescription>
          By community-reported positive outcome rate. Click a bar to explore.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[350px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 120 }}
            onClick={(e) => { if (e?.activePayload?.[0]?.payload?.slug) onTreatmentClick(e.activePayload[0].payload.slug) }}>
            <CartesianGrid horizontal={false} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 12 }} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => [`${value}% positive (${props.payload.mentions} mentions)`, props.payload.name]} />} />
            <Bar dataKey="positiveRate" radius={[0, 4, 4, 0]} className="cursor-pointer" />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: CATEGORY_COLORS.psychedelic }} /> Psychedelic</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: CATEGORY_COLORS.acute }} /> Acute</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: CATEGORY_COLORS.supportive }} /> Supportive</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: CATEGORY_COLORS.conventional }} /> Conventional</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/clusterbusters/cb-stats-row.tsx src/components/tabs/clusterbusters/cb-treatment-rankings.tsx
git commit -m "feat: add stats row and treatment rankings bar chart components"
```

---

### Task 10: Timeline Chart + Treatment Cards + Landing Assembly

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-timeline-chart.tsx`
- Create: `src/components/tabs/clusterbusters/cb-treatment-card.tsx`
- Create: `src/components/tabs/clusterbusters/cb-recommendation.tsx`
- Create: `src/components/tabs/clusterbusters/cb-landing.tsx`

- [ ] **Step 1: Create timeline area chart**

```typescript
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import type { TimelineEntry, TreatmentRanking } from "@/lib/clusterbusters-types"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"
import { TrendingUp } from "lucide-react"

interface CbTimelineChartProps {
  timeline: TimelineEntry[]
  topTreatments: TreatmentRanking[]
}

export function CbTimelineChart({ timeline, topTreatments }: CbTimelineChartProps) {
  // Show top 6 treatments in the stacked chart
  const slugs = topTreatments.slice(0, 6).map((t) => t.slug)

  const chartConfig: ChartConfig = {}
  for (const t of topTreatments.slice(0, 6)) {
    chartConfig[t.slug] = { label: t.name, color: TREATMENT_COLORS[t.slug] || "var(--chart-1)" }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" />
          Treatment Discussion Over Time
        </CardTitle>
        <CardDescription>How the community's focus shifted across 17 years</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <AreaChart data={timeline}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {slugs.map((slug) => (
              <Area
                key={slug}
                dataKey={slug}
                type="monotone"
                fill={`var(--color-${slug})`}
                stroke={`var(--color-${slug})`}
                fillOpacity={0.3}
                stackId="treatments"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create treatment card component**

```typescript
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TreatmentRanking } from "@/lib/clusterbusters-types"

const CATEGORY_BADGE_VARIANT: Record<string, "purple" | "info" | "cyan" | "success"> = {
  psychedelic: "purple",
  conventional: "info",
  supportive: "cyan",
  acute: "success",
}

interface CbTreatmentCardProps {
  treatment: TreatmentRanking
  onClick: () => void
}

export function CbTreatmentCard({ treatment, onClick }: CbTreatmentCardProps) {
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{treatment.name}</span>
          <Badge variant={CATEGORY_BADGE_VARIANT[treatment.category] || "secondary"} className="text-[0.6rem]">
            {treatment.category}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{treatment.mentions.toLocaleString()} mentions</span>
          <span className="text-foreground font-medium">{treatment.positiveRate}% positive</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${treatment.positiveRate}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create recommendation tool**

```typescript
import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { TreatmentRanking } from "@/lib/clusterbusters-types"
import { Search } from "lucide-react"

interface CbRecommendationProps {
  rankings: TreatmentRanking[]
  onTreatmentClick: (slug: string) => void
  onCompareClick: () => void
}

export function CbRecommendation({ rankings, onTreatmentClick, onCompareClick }: CbRecommendationProps) {
  const [chType, setChType] = useState<string>("")
  const [cycleStatus, setCycleStatus] = useState<string>("")

  const suggestions = useMemo(() => {
    let filtered = [...rankings]

    // Filter by type: acute treatments for in-cycle, preventive for remission
    if (cycleStatus === "in-cycle") {
      // Prioritize acute + psychedelic (busting during cycle is common)
      filtered.sort((a, b) => {
        const aScore = (a.category === "acute" ? 2 : a.category === "psychedelic" ? 1 : 0)
        const bScore = (b.category === "acute" ? 2 : b.category === "psychedelic" ? 1 : 0)
        return bScore - aScore || b.score - a.score
      })
    } else if (cycleStatus === "remission") {
      // Prioritize preventive/supportive
      filtered.sort((a, b) => {
        const aScore = (a.category === "psychedelic" ? 2 : a.category === "supportive" ? 1 : 0)
        const bScore = (b.category === "psychedelic" ? 2 : b.category === "supportive" ? 1 : 0)
        return bScore - aScore || b.score - a.score
      })
    }

    return filtered.slice(0, 5)
  }, [rankings, chType, cycleStatus])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4 text-primary" />
          Find What Works
        </CardTitle>
        <CardDescription>Filter by your situation to see community-reported treatment patterns</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Select value={chType} onValueChange={setChType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="CH Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="episodic">Episodic</SelectItem>
              <SelectItem value="chronic">Chronic</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cycleStatus} onValueChange={setCycleStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cycle Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in-cycle">In Cycle</SelectItem>
              <SelectItem value="remission">Remission</SelectItem>
              <SelectItem value="new-patient">New Patient</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <div key={s.slug} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <button className="text-sm font-medium hover:underline" onClick={() => onTreatmentClick(s.slug)}>
                {s.name}
              </button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[0.6rem]">{s.positiveRate}% positive</Badge>
                <span className="text-xs text-muted-foreground">{s.mentions.toLocaleString()} mentions</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onCompareClick} className="text-xs text-muted-foreground hover:underline self-end">
          Compare treatments →
        </button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Assemble the landing page**

```typescript
import { Separator } from "@/components/ui/separator"
import { CbDisclaimer } from "@/components/tabs/clusterbusters/cb-disclaimer"
import { CbStatsRow } from "@/components/tabs/clusterbusters/cb-stats-row"
import { CbTreatmentRankings } from "@/components/tabs/clusterbusters/cb-treatment-rankings"
import { CbTimelineChart } from "@/components/tabs/clusterbusters/cb-timeline-chart"
import { CbTreatmentCard } from "@/components/tabs/clusterbusters/cb-treatment-card"
import { CbRecommendation } from "@/components/tabs/clusterbusters/cb-recommendation"
import type { ForumStats, TreatmentRanking, TimelineEntry } from "@/lib/clusterbusters-types"

// Static data imports
import forumStatsData from "@/data/forum-stats.json"
import treatmentRankingsData from "@/data/treatment-rankings.json"
import timelineData from "@/data/timeline.json"

const forumStats = forumStatsData as ForumStats
const rankings = treatmentRankingsData as TreatmentRanking[]
const timeline = timelineData as TimelineEntry[]

interface CbLandingProps {
  onNavigate: (path: string) => void
}

export function CbLanding({ onNavigate }: CbLandingProps) {
  const handleTreatmentClick = (slug: string) => onNavigate(`clusterbusters/${slug}`)
  const handleCompareClick = () => onNavigate("clusterbusters/compare")
  const handleMethodologyClick = () => onNavigate("clusterbusters/methodology")

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold">ClusterBusters Forum Analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          17 years of patient-reported treatment experiences, analyzed
        </p>
      </div>

      <CbDisclaimer onMethodologyClick={handleMethodologyClick} />

      <CbStatsRow
        totalPosts={forumStats.totalPosts}
        totalTopics={forumStats.totalTopics}
        yearsOfData={forumStats.yearsOfData}
        successRatio={forumStats.successRatio}
      />

      <CbTreatmentRankings rankings={rankings} onTreatmentClick={handleTreatmentClick} />

      <CbTimelineChart timeline={timeline} topTreatments={rankings} />

      <Separator />

      <div>
        <h3 className="mb-4 text-lg font-semibold">Explore Treatments</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rankings.map((t) => (
            <CbTreatmentCard
              key={t.slug}
              treatment={t}
              onClick={() => handleTreatmentClick(t.slug)}
            />
          ))}
        </div>
      </div>

      <Separator />

      <CbRecommendation
        rankings={rankings}
        onTreatmentClick={handleTreatmentClick}
        onCompareClick={handleCompareClick}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify landing page renders with real data**

```bash
npm run dev
```

Open http://localhost:5173/#clusterbusters — should show full landing dashboard with stats, charts, treatment cards, recommendation tool.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/clusterbusters/
git commit -m "feat: complete ClusterBusters landing dashboard with charts and recommendation tool"
```

---

## Phase 4: Frontend — Subpages

### Task 11: Treatment Deep Dive Page

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-treatment-detail.tsx`
- Create: `src/components/tabs/clusterbusters/cb-outcome-chart.tsx`
- Modify: `src/components/tabs/clusterbusters-tab.tsx` (replace placeholder)

- [ ] **Step 1: Create outcome donut chart**

```typescript
import { Pie, PieChart, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentOutcomes } from "@/lib/clusterbusters-types"

interface CbOutcomeChartProps {
  outcomes: TreatmentOutcomes
}

export function CbOutcomeChart({ outcomes }: CbOutcomeChartProps) {
  const data = [
    { name: "Effective", value: outcomes.effective, fill: "var(--chart-8)" },
    { name: "Partial", value: outcomes.partial, fill: "var(--chart-3)" },
    { name: "No Effect", value: outcomes.noEffect, fill: "var(--chart-5)" },
  ].filter((d) => d.value > 0)

  const chartConfig = {
    effective: { label: "Effective", color: "var(--chart-8)" },
    partial: { label: "Partial", color: "var(--chart-3)" },
    noEffect: { label: "No Effect", color: "var(--chart-5)" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Outcome Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <ChartContainer config={chartConfig} className="size-[120px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={35} outerRadius={55} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-col gap-1.5 text-xs">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ background: d.fill }} />
              <span>{d.name}: {d.value}%</span>
            </div>
          ))}
          <span className="text-[0.6rem] text-muted-foreground mt-1">n={outcomes.sampleSize}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create treatment detail page**

```typescript
import { useEffect, useState } from "react"
import { Area, AreaChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CbOutcomeChart } from "@/components/tabs/clusterbusters/cb-outcome-chart"
import { CbStatsRow } from "@/components/tabs/clusterbusters/cb-stats-row"
import type { TreatmentProfile } from "@/lib/clusterbusters-types"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"
import { AlertTriangle, Ban, Link2 } from "lucide-react"

interface CbTreatmentDetailProps {
  slug: string
  onNavigate: (path: string) => void
}

export function CbTreatmentDetail({ slug, onNavigate }: CbTreatmentDetailProps) {
  const [profile, setProfile] = useState<TreatmentProfile | null>(null)

  useEffect(() => {
    // Dynamic import of treatment JSON
    import(`@/data/treatments/${slug}.json`)
      .then((mod) => setProfile(mod.default as TreatmentProfile))
      .catch(() => setProfile(null))
  }, [slug])

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <button onClick={() => onNavigate("clusterbusters")} className="text-sm text-muted-foreground hover:underline self-start">
          ← Back to ClusterBusters
        </button>
        <p className="text-muted-foreground">Treatment data not available for "{slug}".</p>
      </div>
    )
  }

  const timelineConfig = {
    mentions: { label: "Mentions", color: TREATMENT_COLORS[slug] || "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("clusterbusters")}>ClusterBusters</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Title + Badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{profile.name}</h2>
        <Badge variant={profile.category === "psychedelic" ? "purple" : profile.category === "acute" ? "success" : "info"}>
          {profile.category}
        </Badge>
      </div>

      {/* Stats Row */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight tabular-nums font-heading">{profile.stats.mentions.toLocaleString()}</div>
            <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">Mentions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight tabular-nums font-heading text-green-600 dark:text-green-400">{profile.stats.positiveRate}%</div>
            <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">Positive Outcomes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight tabular-nums font-heading">{profile.stats.peakYear || "—"}</div>
            <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">Peak Year</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight tabular-nums font-heading">{profile.protocol.dosing[0]?.split("(")[0]?.trim() || "—"}</div>
            <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">Common Dose</div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Protocol + Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Protocol Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Community Protocol Guide</CardTitle>
            <CardDescription>Aggregated from {profile.sampleSize} analyzed posts</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {profile.protocol.dosing.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dosing</div>
                <ul className="flex flex-col gap-1 text-sm">
                  {profile.protocol.dosing.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
            )}
            {profile.protocol.preparations.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preparation</div>
                <ul className="flex flex-col gap-1 text-sm">
                  {profile.protocol.preparations.map((p) => <li key={p}>• {p}</li>)}
                </ul>
              </div>
            )}
            {profile.protocol.schedule.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Schedule</div>
                <ul className="flex flex-col gap-1 text-sm">
                  {profile.protocol.schedule.map((s) => <li key={s}>• {s}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="flex flex-col gap-6">
          <CbOutcomeChart outcomes={profile.outcomes} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mentions Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={timelineConfig} className="min-h-[150px] w-full">
                <AreaChart data={profile.timeline}>
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="mentions" type="monotone" fill={`var(--color-mentions)`} stroke={`var(--color-mentions)`} fillOpacity={0.3} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Bottom cards: Side effects, Contraindications, Co-treatments */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-3.5" /> Side Effects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.sideEffects.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {profile.sideEffects.map((se) => <li key={se}>• {se}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ban className="size-3.5" /> Contraindications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(profile.contraindications || []).length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {profile.contraindications.map((c) => <li key={c}>• {c}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">See protocol guide above</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="size-3.5" /> Often Combined With
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.coTreatments.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs">
                {profile.coTreatments.slice(0, 5).map((ct) => (
                  <li key={ct.name} className="text-muted-foreground">• {ct.name} ({ct.count}x)</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update clusterbusters-tab.tsx to use real components**

Replace the placeholder imports with:

```typescript
import { CbTreatmentDetail } from "@/components/tabs/clusterbusters/cb-treatment-detail"
```

And replace `CbTreatmentDetailPlaceholder` usage with:
```typescript
case "treatment":
  return <CbTreatmentDetail slug={route.slug} onNavigate={navigate} />
```

- [ ] **Step 4: Verify deep dive pages work**

```bash
npm run dev
```

Navigate to `#clusterbusters/mushrooms` — should show full treatment detail with charts, protocol, stats.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/clusterbusters/
git commit -m "feat: add treatment deep dive page with outcome chart and protocol guide"
```

---

### Task 12: Comparison Tool Page

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-compare.tsx`
- Create: `src/components/tabs/clusterbusters/cb-radar-chart.tsx`
- Modify: `src/components/tabs/clusterbusters-tab.tsx`

- [ ] **Step 1: Create radar chart component**

```typescript
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import type { TreatmentProfile } from "@/lib/clusterbusters-types"
import { TREATMENT_COLORS } from "@/lib/clusterbusters-types"

interface CbRadarChartProps {
  treatments: TreatmentProfile[]
}

export function CbRadarChart({ treatments }: CbRadarChartProps) {
  if (treatments.length === 0) return null

  // Normalize dimensions to 0-100 scale
  const maxMentions = Math.max(...treatments.map((t) => t.stats.mentions))

  const dimensions = ["Success Rate", "Mentions", "Sample Size", "Peak Activity"]
  const data = dimensions.map((dim) => {
    const entry: Record<string, string | number> = { dimension: dim }
    for (const t of treatments) {
      switch (dim) {
        case "Success Rate": entry[t.slug] = t.stats.positiveRate; break
        case "Mentions": entry[t.slug] = Math.round((t.stats.mentions / maxMentions) * 100); break
        case "Sample Size": entry[t.slug] = Math.min(t.sampleSize, 100); break
        case "Peak Activity": {
          const peak = t.timeline.reduce((max, y) => y.mentions > max ? y.mentions : max, 0)
          const total = t.timeline.reduce((s, y) => s + y.mentions, 0)
          entry[t.slug] = total > 0 ? Math.round((peak / total) * 100) : 0
          break
        }
      }
    }
    return entry
  })

  const chartConfig: ChartConfig = {}
  for (const t of treatments) {
    chartConfig[t.slug] = { label: t.name, color: TREATMENT_COLORS[t.slug] || "var(--chart-1)" }
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[350px]">
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {treatments.map((t) => (
          <Radar key={t.slug} dataKey={t.slug} fill={`var(--color-${t.slug})`} stroke={`var(--color-${t.slug})`} fillOpacity={0.2} />
        ))}
      </RadarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: Create comparison page**

```typescript
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { CbRadarChart } from "@/components/tabs/clusterbusters/cb-radar-chart"
import type { TreatmentProfile, TreatmentRanking } from "@/lib/clusterbusters-types"
import { X } from "lucide-react"
import treatmentRankingsData from "@/data/treatment-rankings.json"

const allRankings = treatmentRankingsData as TreatmentRanking[]

interface CbCompareProps {
  onNavigate: (path: string) => void
}

export function CbCompare({ onNavigate }: CbCompareProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [profiles, setProfiles] = useState<TreatmentProfile[]>([])

  // Load profiles for selected treatments
  useEffect(() => {
    Promise.all(
      selectedSlugs.map((slug) =>
        import(`@/data/treatments/${slug}.json`)
          .then((mod) => mod.default as TreatmentProfile)
          .catch(() => null)
      )
    ).then((results) => setProfiles(results.filter(Boolean) as TreatmentProfile[]))
  }, [selectedSlugs])

  const addTreatment = (slug: string) => {
    if (selectedSlugs.length < 3 && !selectedSlugs.includes(slug)) {
      setSelectedSlugs([...selectedSlugs, slug])
    }
  }

  const removeTreatment = (slug: string) => {
    setSelectedSlugs(selectedSlugs.filter((s) => s !== slug))
  }

  const availableForSelection = allRankings.filter((r) => !selectedSlugs.includes(r.slug))

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("clusterbusters")}>ClusterBusters</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Compare Treatments</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h2 className="text-2xl font-bold">Compare Treatments</h2>

      {/* Selection */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedSlugs.map((slug) => {
          const r = allRankings.find((r) => r.slug === slug)
          return (
            <Badge key={slug} variant="secondary" className="gap-1 pr-1 text-sm">
              {r?.name || slug}
              <button onClick={() => removeTreatment(slug)} className="ml-1 rounded-full p-0.5 hover:bg-muted">
                <X className="size-3" />
              </button>
            </Badge>
          )
        })}
        {selectedSlugs.length < 3 && (
          <Select onValueChange={addTreatment}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="+ Add treatment" /></SelectTrigger>
            <SelectContent>
              {availableForSelection.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {profiles.length >= 2 && (
        <>
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Multi-Dimension Comparison</CardTitle>
              <CardDescription>Normalized to 0–100 scale for comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <CbRadarChart treatments={profiles} />
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Side-by-Side</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Metric</TableHead>
                    {profiles.map((p) => <TableHead key={p.slug}>{p.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Category</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug}>{p.category}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Success Rate</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug}>{p.stats.positiveRate}%</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Mentions</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug}>{p.stats.mentions.toLocaleString()}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Peak Year</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug}>{p.stats.peakYear || "—"}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Side Effects</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug} className="text-xs">{p.sideEffects.slice(0, 3).join(", ") || "—"}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Common Dose</TableCell>
                    {profiles.map((p) => <TableCell key={p.slug} className="text-xs">{p.protocol.dosing[0]?.split("(")[0]?.trim() || "—"}</TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {profiles.length < 2 && selectedSlugs.length < 2 && (
        <p className="text-sm text-muted-foreground">Select at least 2 treatments to compare.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update clusterbusters-tab.tsx — replace compare placeholder**

```typescript
import { CbCompare } from "@/components/tabs/clusterbusters/cb-compare"

// In switch:
case "compare":
  return <CbCompare onNavigate={navigate} />
```

- [ ] **Step 4: Verify comparison tool**

Navigate to `#clusterbusters/compare`, add 2-3 treatments, verify radar chart and table render.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/clusterbusters/
git commit -m "feat: add treatment comparison tool with radar chart and table"
```

---

### Task 13: Methodology Page

**Files:**
- Create: `src/components/tabs/clusterbusters/cb-methodology.tsx`
- Modify: `src/components/tabs/clusterbusters-tab.tsx`

- [ ] **Step 1: Create methodology page**

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import type { ForumStats } from "@/lib/clusterbusters-types"
import forumStatsData from "@/data/forum-stats.json"
import { Database, Search, Brain, AlertTriangle, Code } from "lucide-react"

const forumStats = forumStatsData as ForumStats

interface CbMethodologyProps {
  onNavigate: (path: string) => void
}

export function CbMethodology({ onNavigate }: CbMethodologyProps) {
  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => onNavigate("clusterbusters")}>ClusterBusters</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Methodology</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h2 className="text-2xl font-bold">How We Analyzed This Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">Full transparency on our data source, methods, and limitations</p>
      </div>

      {/* Data Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4 text-primary" /> Data Source
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <a href="https://clusterbusters.org/forums" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">ClusterBusters.org</a> is
            the largest online community for cluster headache patients, founded in 2002. The forums host detailed discussions about treatment
            experiences, protocols, side effects, and outcomes.
          </p>
          <p>
            We analyzed <strong className="text-foreground">{forumStats.totalPosts.toLocaleString()}</strong> posts
            across <strong className="text-foreground">{forumStats.totalTopics.toLocaleString()}</strong> topics,
            spanning {forumStats.dateRange.start?.slice(0, 4)} to {forumStats.dateRange.end?.slice(0, 4)} ({forumStats.yearsOfData} years).
            After filtering short/empty posts, <strong className="text-foreground">{forumStats.analyzedPosts.toLocaleString()}</strong> posts
            were analyzed.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {forumStats.forums.map((f) => (
              <Badge key={f.name} variant="outline" className="text-[0.65rem]">{f.name} ({f.posts.toLocaleString()})</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-primary" /> Analysis Pipeline
          </CardTitle>
          <CardDescription>Four-stage process from raw forum posts to structured insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1, title: "Text Cleanup", desc: "Strip forum artifacts (reaction buttons, HTML tags), normalize whitespace, filter posts under 50 characters, remove email addresses." },
              { step: 2, title: "Treatment Extraction", desc: "Regex-based pattern matching for 13+ treatment families. Track which treatments are mentioned in each post, build co-occurrence matrix and timelines." },
              { step: 3, title: "Sentiment Analysis", desc: "Domain-specific lexicon (not generic NLP). Terms like 'pain-free', 'busted', 'shadow-free' → positive. 'Failed', 'rebound', 'no effect' → negative. Score each treatment-mentioning post." },
              { step: 4, title: "LLM Extraction", desc: "For top treatments only: sample 200-500 highest-signal posts, use Claude AI to extract structured data — dosages, protocols, outcomes (1-5 scale), side effects, co-treatments." },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border p-4">
                <div className="text-3xl font-bold text-muted-foreground/30 font-heading">{s.step}</div>
                <div className="mt-1 text-sm font-semibold">{s.title}</div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Treatment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4 text-primary" /> Treatment Selection & Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Treatments are ranked using a composite score: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">(normalized_mentions × 0.4) + (positive_rate × 0.6)</code>.
            Both values are normalized to a 0–1 range. This weights effectiveness over popularity — a rarely-mentioned treatment with high success rates ranks above a frequently-discussed one with mixed results.
          </p>
          <p>
            The top treatments by this composite score receive the full LLM deep-dive analysis. The number of deep dives is configurable (default: top 10).
          </p>
        </CardContent>
      </Card>

      {/* Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-500" /> Limitations & Biases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <div className="font-semibold text-foreground">Selection Bias</div>
              <p className="text-muted-foreground">Forum users who found relief are more likely to stay active and post. Unsuccessful treatments may be underreported. The 5.2:1 success ratio likely overstates true effectiveness.</p>
            </div>
            <Separator />
            <div>
              <div className="font-semibold text-foreground">Self-Report</div>
              <p className="text-muted-foreground">All data is patient-reported, not clinically verified. Dosages, outcomes, and side effects reflect individual experiences, not controlled trials.</p>
            </div>
            <Separator />
            <div>
              <div className="font-semibold text-foreground">Temporal Bias</div>
              <p className="text-muted-foreground">Forum activity peaked 2010–2012, with declining post volume since. Newer treatments (CGRP antibodies, newer neuromodulation) have less community data.</p>
            </div>
            <Separator />
            <div>
              <div className="font-semibold text-foreground">Variable Sample Sizes</div>
              <p className="text-muted-foreground">Oxygen has ~7,000 mentions while BOL-148 has ~174. Confidence in outcome percentages varies dramatically. Always check the sample size.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="size-4 text-primary" /> Open Source & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            The analysis pipeline is open source and available in our{" "}
            <a href="https://github.com/vuoriv/cluster-headache-hub" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">GitHub repository</a>.
          </p>
          <p>
            <strong className="text-foreground">All data is fully anonymized.</strong> No usernames, author IDs, or identifying information
            is included in the analysis output. All statistics are aggregated — no individual posts are quoted or attributable.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Update clusterbusters-tab.tsx — replace methodology placeholder**

```typescript
import { CbMethodology } from "@/components/tabs/clusterbusters/cb-methodology"

// In switch:
case "methodology":
  return <CbMethodology onNavigate={navigate} />
```

- [ ] **Step 3: Verify methodology page**

Navigate to `#clusterbusters/methodology` — check all sections render, links work, forum breakdown badges show.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/clusterbusters/
git commit -m "feat: add methodology page with pipeline details and limitations"
```

---

## Phase 5: Polish & Review

### Task 14: Type Check + Lint + Build Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/ville/projects/cluster-headache-hub
npm run check-types 2>&1 || npx tsc --noEmit
```

Fix any type errors found.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Verify build succeeds and output size is reasonable (JSON data files should not bloat the bundle excessively).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type and lint issues"
```

---

### Task 15: Visual Review in Browser

- [ ] **Step 1: Start dev server and test all pages**

```bash
npm run dev
```

Test these routes in browser:
1. `#clusterbusters` — Landing loads, stats correct, bar chart renders, area chart renders, treatment cards clickable, recommendation tool filters work
2. `#clusterbusters/mushrooms` (or top treatment slug) — Breadcrumb works, stats row populated, protocol guide has content, donut chart renders, timeline chart renders, bottom cards show data
3. `#clusterbusters/compare` — Can add 2-3 treatments, radar chart renders, comparison table populates
4. `#clusterbusters/methodology` — All sections render, forum breakdown badges show, links work
5. Test dark mode (press `d`) — all charts and cards render correctly in both themes
6. Test mobile viewport — responsive layout stacks properly

- [ ] **Step 2: Test navigation flows**

- Click treatment card on landing → deep dive → breadcrumb back to landing
- Click bar in rankings chart → navigates to treatment
- Click "Compare treatments →" in recommendation → compare page
- Click "How we analyzed this data →" in disclaimer → methodology page
- Use browser back/forward buttons — hash routing works

- [ ] **Step 3: Fix any visual issues found**

Address layout problems, chart sizing, color contrast, dark mode issues.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: visual polish and responsive layout adjustments"
```

---

### Task 16: Final Build + Summary Commit

- [ ] **Step 1: Final production build**

```bash
npm run build
```

Verify clean build with no warnings.

- [ ] **Step 2: Create summary commit if there are uncommitted changes**

```bash
git status
# If changes exist:
git add -A
git commit -m "feat: complete ClusterBusters forum analysis feature"
```
