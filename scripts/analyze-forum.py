#!/usr/bin/env python3
"""
ClusterBusters Forum Analysis Pipeline

4-stage analysis of ClusterBusters forum posts:
  Stage 1: Text preprocessing & forum stats
  Stage 2: Treatment extraction & co-occurrence
  Stage 3: Sentiment & outcome analysis
  Stage 4: LLM deep extraction (optional)

Usage:
  python scripts/analyze-forum.py --db PATH --output PATH [--skip-llm] [--llm-model MODEL] [--top-n N] [--sample-size N]
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Stage 1: Text Preprocessing
# ---------------------------------------------------------------------------

# Reaction button noise that appears at the end of every post
REACTION_PATTERN = re.compile(
    r'(?:\n|^)'                          # newline or start
    r'(?:[A-Za-z0-9_ ]+(?:\s*,\s*)?)*'  # comma-separated usernames
    r'(?:\s*and\s+\d+\s+others?)?'       # "and N others"
    r'\s*\n?'
    r'(?:\d+\s*\n?)*'                    # reaction counts
    r'\s*(?:Thanks|Haha|Confused|Sad|Like|\u00d7|Quote)'  # reaction labels
    r'(?:\s*(?:Thanks|Haha|Confused|Sad|Like|\u00d7|Quote))*'
    r'\s*$',                             # end of string
    re.MULTILINE
)

# Simpler fallback: strip trailing reaction block
REACTION_TAIL = re.compile(
    r'\n(?:Thanks|Haha|Confused|Sad|Like|\u00d7|Quote)[\s\S]*$'
)

# Matches the reaction label line and everything after
REACTION_LABELS = re.compile(
    r'\n\s*\d+\s*\n\s*(?:\d+\s*\n\s*)*'
    r'Thanks\s*\n\s*Haha\s*\n\s*Confused\s*\n\s*Sad\s*\n\s*Like\s*\n\s*'
    r'\u00d7\s*\n\s*Quote\s*$',
    re.MULTILINE
)

EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
URL_PATTERN = re.compile(r'https?://\S+')


def clean_text(text: str) -> str:
    """Clean a single post's text content."""
    if not text:
        return ""

    # Strip the reaction block at the end.
    # The pattern is: optional usernames, optional counts, then
    # Thanks\nHaha\nConfused\nSad\nLike\n×\nQuote at the very end.
    # We find the last occurrence of the reaction labels block.
    idx = text.rfind("\nThanks\n")
    if idx == -1:
        idx = text.rfind("\nThanks\r\n")
    if idx == -1:
        idx = text.rfind("Thanks\nHaha")
    if idx != -1:
        # Walk backward past counts and usernames
        candidate = text[:idx].rstrip()
        # Check if this looks like reaction noise (counts + usernames before)
        # Simple heuristic: take everything before the reaction labels
        text = candidate

    # Remove HTML tags
    text = HTML_TAG_PATTERN.sub(' ', text)

    # Remove emails
    text = EMAIL_PATTERN.sub('[email]', text)

    # Collapse whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)

    return text.strip()


def load_and_clean_posts(db_path: str) -> list[dict]:
    """Load all posts from SQLite, clean text, filter short posts."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cursor = conn.execute("""
        SELECT
            p.post_id,
            p.topic_id,
            p.forum_id,
            p.posted_date,
            p.content_text,
            p.likes,
            p.is_first_post,
            p.post_number,
            t.title as topic_title,
            f.name as forum_name
        FROM posts p
        LEFT JOIN topics t ON p.topic_id = t.topic_id
        LEFT JOIN forums f ON p.forum_id = f.forum_id
        ORDER BY p.posted_date
    """)

    posts = []
    skipped_short = 0
    total_raw = 0

    for row in cursor:
        total_raw += 1
        cleaned = clean_text(row['content_text'] or "")
        if len(cleaned) < 50:
            skipped_short += 1
            continue

        posts.append({
            'post_id': row['post_id'],
            'topic_id': row['topic_id'],
            'forum_id': row['forum_id'],
            'posted_date': row['posted_date'],
            'text': cleaned,
            'likes': row['likes'] or 0,
            'is_first_post': bool(row['is_first_post']),
            'post_number': row['post_number'],
            'topic_title': row['topic_title'],
            'forum_name': row['forum_name'],
        })

    conn.close()

    print(f"  Loaded {total_raw} raw posts")
    print(f"  Filtered {skipped_short} posts under 50 chars")
    print(f"  Retained {len(posts)} posts for analysis")

    return posts


def compute_forum_stats(posts: list[dict], db_path: str) -> dict:
    """Compute summary statistics about the forum."""
    conn = sqlite3.connect(db_path)

    total_posts = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    total_topics = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    date_range = conn.execute(
        "SELECT MIN(posted_date), MAX(posted_date) FROM posts"
    ).fetchone()

    forum_counts = {}
    for row in conn.execute("""
        SELECT f.name, COUNT(p.post_id) as cnt
        FROM posts p
        JOIN forums f ON p.forum_id = f.forum_id
        GROUP BY f.name
        ORDER BY cnt DESC
    """):
        forum_counts[row[0]] = row[1]

    conn.close()

    # Year distribution from cleaned posts
    year_counts = Counter()
    for p in posts:
        if p['posted_date']:
            try:
                year = p['posted_date'][:4]
                year_counts[year] += 1
            except Exception:
                pass

    return {
        'total_posts_raw': total_posts,
        'total_posts_cleaned': len(posts),
        'total_topics': total_topics,
        'date_range': {
            'earliest': date_range[0],
            'latest': date_range[1],
        },
        'forum_breakdown': forum_counts,
        'posts_per_year': dict(sorted(year_counts.items())),
    }


# ---------------------------------------------------------------------------
# Stage 2: Treatment Extraction
# ---------------------------------------------------------------------------

TREATMENTS = {
    'mushrooms': {
        'label': 'Psilocybin / Mushrooms',
        'slug': 'psilocybin-mushrooms',
        'patterns': [
            r'\bpsilocybin\b', r'\bshrooms?\b', r'\bmushrooms?\b',
            r'\bmagic\s+mushrooms?\b', r'\bcubes?\b', r'\bcubensis\b',
            r'\bpsilocybe\b', r'\bpsilo\b', r'\bbusting\b',
        ],
    },
    'rc_seeds': {
        'label': 'RC Seeds / LSA',
        'slug': 'rc-seeds-lsa',
        'patterns': [
            r'\brivea\s+corymbosa\b', r'\brc\s+seeds?\b', r'\blsa\b',
            r'\bhbwr\b', r'\bhawaiian\s+baby\s+woodrose\b',
            r'\bmorning\s+glory\b', r'\bipomoea\b',
        ],
    },
    'oxygen': {
        'label': 'Oxygen',
        'slug': 'oxygen',
        'patterns': [
            r'\boxygen\b', r'\bo2\b', r'\blpm\b', r'\bdemand\s+valve\b',
            r'\bcluster\s*o2\b', r'\bnon[- ]?rebreather\b', r'\boptimask\b',
        ],
    },
    'lsd': {
        'label': 'LSD',
        'slug': 'lsd',
        'patterns': [
            r'\blsd\b', r'\blysergic\b', r'\bacid\b(?!\s*(?:reflux|stomach))',
        ],
    },
    'vitamin_d': {
        'label': 'Vitamin D3 Regimen',
        'slug': 'vitamin-d3',
        'patterns': [
            r'\bvitamin\s*d3?\b', r'\bd3\s+regimen\b', r'\banti[- ]?inflammatory\s+regimen\b',
            r'\bbatch\s*(?:\'?s)?\s*(?:regimen|protocol)\b',
            r'\b25\(?oh\)?d\b', r'\bcalcidiol\b', r'\bcholecalciferol\b',
        ],
    },
    'verapamil': {
        'label': 'Verapamil',
        'slug': 'verapamil',
        'patterns': [
            r'\bverapamil\b', r'\bcalan\b', r'\bisoptin\b',
        ],
    },
    'triptans': {
        'label': 'Triptans',
        'slug': 'triptans',
        'patterns': [
            r'\btriptans?\b', r'\bsumatriptan\b', r'\bimitrex\b',
            r'\bzolmitriptan\b', r'\bzomig\b', r'\brizatriptan\b',
            r'\bmaxalt\b', r'\bnaratriptan\b',
        ],
    },
    'ketamine': {
        'label': 'Ketamine',
        'slug': 'ketamine',
        'patterns': [
            r'\bketamine\b', r'\bketalar\b', r'\bspravato\b',
            r'\besketamine\b',
        ],
    },
    'bol_148': {
        'label': 'BOL-148',
        'slug': 'bol-148',
        'patterns': [
            r'\bbol[- ]?148\b', r'\b2-bromo-lsd\b', r'\bbromolsd\b',
        ],
    },
    'melatonin': {
        'label': 'Melatonin',
        'slug': 'melatonin',
        'patterns': [
            r'\bmelatonin\b',
        ],
    },
    'prednisone': {
        'label': 'Prednisone / Steroids',
        'slug': 'prednisone-steroids',
        'patterns': [
            r'\bprednisone\b', r'\bprednisolone\b', r'\bsteroids?\b',
            r'\bcorticosteroids?\b', r'\bmedrol\b', r'\bdexamethasone\b',
            r'\bmethylprednisolone\b',
        ],
    },
    'lithium': {
        'label': 'Lithium',
        'slug': 'lithium',
        'patterns': [
            r'\blithium\b', r'\beskalith\b', r'\blithobid\b',
        ],
    },
    'energy_drinks': {
        'label': 'Energy Drinks / Caffeine',
        'slug': 'energy-drinks-caffeine',
        'patterns': [
            r'\benergy\s+drinks?\b', r'\bred\s*bull\b', r'\bcaffeine\b',
            r'\bmonster\s+energy\b',
        ],
    },
}

# Compile all patterns
for key, t in TREATMENTS.items():
    t['_compiled'] = [re.compile(p, re.IGNORECASE) for p in t['patterns']]


def extract_treatments(posts: list[dict]) -> list[dict]:
    """Tag each post with treatments mentioned. Returns posts with 'treatments' field."""
    treatment_counts = Counter()

    for post in posts:
        text = post['text']
        title = post.get('topic_title', '') or ''
        combined = f"{title}\n{text}"

        found = []
        for key, t in TREATMENTS.items():
            for pat in t['_compiled']:
                if pat.search(combined):
                    found.append(key)
                    break

        post['treatments'] = found
        for t in found:
            treatment_counts[t] += 1

    tagged = sum(1 for p in posts if p['treatments'])
    print(f"  Posts mentioning treatments: {tagged} ({tagged*100//len(posts)}%)")
    for t, count in treatment_counts.most_common():
        print(f"    {TREATMENTS[t]['label']}: {count}")

    return posts


def build_co_occurrence(posts: list[dict]) -> dict:
    """Build treatment co-occurrence matrix."""
    keys = sorted(TREATMENTS.keys())
    matrix = {k1: {k2: 0 for k2 in keys} for k1 in keys}

    for post in posts:
        ts = post.get('treatments', [])
        for i, t1 in enumerate(ts):
            for t2 in ts[i+1:]:
                matrix[t1][t2] += 1
                matrix[t2][t1] += 1

    # Convert to labeled format
    labeled = {}
    for k1 in keys:
        labeled[TREATMENTS[k1]['label']] = {}
        for k2 in keys:
            if k1 != k2 and matrix[k1][k2] > 0:
                labeled[TREATMENTS[k1]['label']][TREATMENTS[k2]['label']] = matrix[k1][k2]

    return labeled


def build_timeline(posts: list[dict]) -> dict:
    """Build per-year treatment mention counts."""
    timeline = defaultdict(lambda: Counter())

    for post in posts:
        if not post.get('posted_date') or not post.get('treatments'):
            continue
        year = post['posted_date'][:4]
        for t in post['treatments']:
            timeline[year][t] += 1

    result = {}
    for year in sorted(timeline.keys()):
        result[year] = {
            TREATMENTS[k]['label']: v
            for k, v in timeline[year].most_common()
        }

    return result


def build_forum_distribution(posts: list[dict]) -> dict:
    """Build per-forum treatment distribution."""
    dist = defaultdict(lambda: Counter())

    for post in posts:
        if not post.get('forum_name') or not post.get('treatments'):
            continue
        for t in post['treatments']:
            dist[post['forum_name']][t] += 1

    result = {}
    for forum in sorted(dist.keys()):
        result[forum] = {
            TREATMENTS[k]['label']: v
            for k, v in dist[forum].most_common()
        }

    return result


# ---------------------------------------------------------------------------
# Stage 3: Sentiment & Outcome Analysis
# ---------------------------------------------------------------------------

POSITIVE_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r'\bpain[- ]?free\b', r'\bbusted\b', r'\bshadow[- ]?free\b',
        r'\bremission\b', r'\bworked\b', r'\bamazing\b',
        r'\bgone\b', r'\brelief\b', r'\babort(?:ed|s)?\b',
        r'\bstopped\b', r'\bbroke\s+the\s+cycle\b',
        r'\b(?:pf|PF)\b', r'\bkip\s*0\b', r'\blife\s*saver\b',
        r'\bmiracle\b', r'\bcure[ds]?\b', r'\bfree\s+of\s+clusters?\b',
        r'\bno\s+more\s+(?:attacks?|headaches?|clusters?)\b',
        r'\bcluster[- ]?free\b', r'\battack[- ]?free\b',
    ]
]

NEGATIVE_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r'\bfailed\b', r'\brebound\b', r'\bno\s+effect\b',
        r'\bworse\b', r'\buseless\b', r"\bdidn'?t\s+work\b",
        r'\bno\s+relief\b', r'\bno\s+help\b', r'\bnot\s+work(?:ing|ed)?\b',
        r'\bno\s+change\b', r'\bno\s+improvement\b',
        r'\bwaste\s+of\b', r'\bnightmare\b',
    ]
]

PARTIAL_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r'\bsome\s+relief\b', r'\breduced\b', r'\bpartial\b',
        r'\bless\s+intense\b', r'\bhelped?\s+a\s+bit\b',
        r'\bsomewhat\b', r'\bslightly\b', r'\bminor\s+improvement\b',
        r'\bnot\s+(?:as|so)\s+(?:bad|severe|intense)\b',
    ]
]


def score_post_sentiment(text: str) -> dict:
    """Score a post's sentiment using domain-specific lexicon."""
    pos = sum(1 for p in POSITIVE_PATTERNS if p.search(text))
    neg = sum(1 for p in NEGATIVE_PATTERNS if p.search(text))
    par = sum(1 for p in PARTIAL_PATTERNS if p.search(text))

    total = pos + neg + par
    if total == 0:
        return {'sentiment': 'neutral', 'positive': 0, 'negative': 0, 'partial': 0}

    if pos > neg and pos >= par:
        sentiment = 'positive'
    elif neg > pos and neg >= par:
        sentiment = 'negative'
    elif par > 0 and par >= pos and par >= neg:
        sentiment = 'partial'
    else:
        sentiment = 'mixed'

    return {
        'sentiment': sentiment,
        'positive': pos,
        'negative': neg,
        'partial': par,
    }


def analyze_outcomes(posts: list[dict]) -> tuple[dict, dict]:
    """Analyze outcomes per treatment. Returns (rankings, outcomes)."""
    treatment_sentiment = defaultdict(lambda: {
        'total': 0, 'positive': 0, 'negative': 0, 'partial': 0, 'neutral': 0, 'mixed': 0
    })

    for post in posts:
        if not post.get('treatments'):
            continue

        scores = score_post_sentiment(post['text'])
        post['sentiment'] = scores

        for t in post['treatments']:
            treatment_sentiment[t]['total'] += 1
            treatment_sentiment[t][scores['sentiment']] += 1

    # Build outcomes
    outcomes = {}
    for key, data in treatment_sentiment.items():
        total = data['total']
        rated = total - data['neutral']
        positive_rate = data['positive'] / rated if rated > 0 else 0
        negative_rate = data['negative'] / rated if rated > 0 else 0
        partial_rate = data['partial'] / rated if rated > 0 else 0

        outcomes[TREATMENTS[key]['label']] = {
            'total_mentions': total,
            'rated_posts': rated,
            'positive': data['positive'],
            'negative': data['negative'],
            'partial': data['partial'],
            'neutral': data['neutral'],
            'mixed': data['mixed'],
            'positive_rate': round(positive_rate, 3),
            'negative_rate': round(negative_rate, 3),
            'partial_rate': round(partial_rate, 3),
        }

    # Build rankings
    max_mentions = max(d['total'] for d in treatment_sentiment.values()) if treatment_sentiment else 1

    rankings = []
    for key, data in treatment_sentiment.items():
        total = data['total']
        rated = total - data['neutral']
        positive_rate = data['positive'] / rated if rated > 0 else 0
        normalized_mentions = total / max_mentions

        composite = (normalized_mentions * 0.4) + (positive_rate * 0.6)

        rankings.append({
            'treatment': TREATMENTS[key]['label'],
            'slug': TREATMENTS[key]['slug'],
            'total_mentions': total,
            'positive_rate': round(positive_rate, 3),
            'normalized_mentions': round(normalized_mentions, 3),
            'composite_score': round(composite, 3),
        })

    rankings.sort(key=lambda x: x['composite_score'], reverse=True)

    print(f"\n  Treatment Rankings (composite score):")
    for i, r in enumerate(rankings):
        print(f"    {i+1}. {r['treatment']}: {r['composite_score']:.3f} "
              f"(mentions={r['total_mentions']}, positive_rate={r['positive_rate']:.1%})")

    return rankings, outcomes


# ---------------------------------------------------------------------------
# Stage 4: LLM Deep Extraction
# ---------------------------------------------------------------------------

LLM_EXTRACTION_PROMPT = """You are analyzing a ClusterBusters forum post about cluster headache treatments.
Extract structured information about the treatment "{treatment}" from this post.

Post:
---
{text}
---

Extract the following as JSON (use null for unknown/not mentioned):
{{
  "dosage": "string - specific dosage mentioned (e.g., '1.5g dried', '50mcg', '15 LPM')",
  "preparation": "string - how the treatment was prepared or administered",
  "protocol": "string - frequency, timing, schedule mentioned",
  "outcome": "integer 1-5 (1=no effect, 2=minor relief, 3=moderate relief, 4=significant relief, 5=complete remission/pain-free)",
  "side_effects": ["list of side effects mentioned"],
  "co_treatments": ["list of other treatments used alongside"],
  "time_to_effect": "string - how long until relief was noticed",
  "ch_type": "string - 'episodic', 'chronic', or null if not mentioned"
}}

Respond with ONLY the JSON object, no other text."""


def select_high_signal_posts(posts: list[dict], treatment_key: str, sample_size: int) -> list[dict]:
    """Select the highest-signal posts for a treatment."""
    relevant = [p for p in posts if treatment_key in p.get('treatments', [])]

    # Priority forums
    priority_forums = {'Share Your Busting Stories', 'Theory & Implementation'}

    # Score each post for signal quality
    def signal_score(post):
        score = 0
        score += min(len(post['text']), 3000) / 3000 * 40  # length (up to 40)
        score += min(post.get('likes', 0), 20) / 20 * 30  # likes (up to 30)
        if post.get('forum_name') in priority_forums:
            score += 20
        if post.get('is_first_post'):
            score += 10
        # Prefer posts with sentiment signals
        s = post.get('sentiment', {})
        if s.get('sentiment') in ('positive', 'negative', 'partial'):
            score += 10
        return score

    relevant.sort(key=signal_score, reverse=True)
    return relevant[:sample_size]


def extract_with_llm(posts: list[dict], rankings: list[dict],
                     top_n: int, sample_size: int, model: str,
                     output_dir: Path) -> dict:
    """Use Claude API to extract detailed treatment information."""
    try:
        import anthropic
    except ImportError:
        print("  ERROR: anthropic package not installed. Run: pip install anthropic")
        return {}

    client = anthropic.Anthropic()
    treatments_dir = output_dir / "treatments"
    treatments_dir.mkdir(exist_ok=True)

    top_treatments = rankings[:top_n]
    recommendation_data = []

    for rank_info in top_treatments:
        slug = rank_info['slug']
        label = rank_info['treatment']

        # Find treatment key
        treatment_key = None
        for k, v in TREATMENTS.items():
            if v['slug'] == slug:
                treatment_key = k
                break

        if not treatment_key:
            continue

        print(f"\n  Processing {label}...")
        selected = select_high_signal_posts(posts, treatment_key, sample_size)
        print(f"    Selected {len(selected)} high-signal posts")

        extractions = []
        errors = 0

        for i, post in enumerate(selected):
            if (i + 1) % 50 == 0:
                print(f"    Processed {i+1}/{len(selected)}")

            prompt = LLM_EXTRACTION_PROMPT.format(
                treatment=label,
                text=post['text'][:4000]  # Limit text length
            )

            try:
                response = client.messages.create(
                    model=model,
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = response.content[0].text.strip()

                # Parse JSON from response
                if text.startswith("```"):
                    text = re.sub(r'^```(?:json)?\s*', '', text)
                    text = re.sub(r'\s*```$', '', text)

                data = json.loads(text)
                extractions.append(data)

            except json.JSONDecodeError:
                errors += 1
            except Exception as e:
                errors += 1
                if "rate_limit" in str(e).lower():
                    time.sleep(5)

        print(f"    Extracted {len(extractions)} profiles ({errors} errors)")

        # Aggregate
        profile = aggregate_treatment_profile(label, slug, extractions, rank_info)

        # Write per-treatment file
        treatment_file = treatments_dir / f"{slug}.json"
        with open(treatment_file, 'w') as f:
            json.dump(profile, f, indent=2)
        print(f"    Wrote {treatment_file}")

        recommendation_data.append(profile)

    return {'treatments': recommendation_data, 'generated_at': datetime.utcnow().isoformat()}


def aggregate_treatment_profile(label: str, slug: str,
                                extractions: list[dict],
                                rank_info: dict) -> dict:
    """Aggregate individual LLM extractions into a treatment profile."""
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
        if ext.get('outcome') and isinstance(ext['outcome'], (int, float)):
            outcomes.append(int(ext['outcome']))
        for se in (ext.get('side_effects') or []):
            if se:
                side_effects[se] += 1
        for ct in (ext.get('co_treatments') or []):
            if ct:
                co_treatments[ct] += 1
        if ext.get('time_to_effect'):
            time_to_effects[ext['time_to_effect']] += 1
        if ext.get('ch_type'):
            ch_types[ext['ch_type']] += 1

    avg_outcome = sum(outcomes) / len(outcomes) if outcomes else None
    outcome_dist = Counter(outcomes)

    return {
        'treatment': label,
        'slug': slug,
        'composite_score': rank_info['composite_score'],
        'total_mentions': rank_info['total_mentions'],
        'positive_rate': rank_info['positive_rate'],
        'sample_size': len(extractions),
        'avg_outcome': round(avg_outcome, 2) if avg_outcome else None,
        'outcome_distribution': {str(k): v for k, v in sorted(outcome_dist.items())},
        'common_dosages': [{'dosage': k, 'count': v} for k, v in dosages.most_common(10)],
        'common_preparations': [{'method': k, 'count': v} for k, v in preparations.most_common(5)],
        'common_protocols': [{'protocol': k, 'count': v} for k, v in protocols.most_common(5)],
        'side_effects': [{'effect': k, 'count': v} for k, v in side_effects.most_common(15)],
        'co_treatments': [{'treatment': k, 'count': v} for k, v in co_treatments.most_common(10)],
        'time_to_effect': [{'time': k, 'count': v} for k, v in time_to_effects.most_common(5)],
        'ch_type_distribution': dict(ch_types),
    }


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="ClusterBusters Forum Analysis Pipeline")
    parser.add_argument('--db', required=True, help='Path to SQLite database')
    parser.add_argument('--output', required=True, help='Output directory for JSON files')
    parser.add_argument('--skip-llm', action='store_true', help='Skip Stage 4 (LLM extraction)')
    parser.add_argument('--llm-model', default='claude-haiku-4-5-20251001', help='Claude model for LLM extraction')
    parser.add_argument('--top-n', type=int, default=5, help='Number of top treatments for LLM extraction')
    parser.add_argument('--sample-size', type=int, default=300, help='Posts to sample per treatment for LLM')
    args = parser.parse_args()

    db_path = os.path.expanduser(args.db)
    output_dir = Path(os.path.expanduser(args.output))
    output_dir.mkdir(parents=True, exist_ok=True)

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        sys.exit(1)

    # === Stage 1: Text Preprocessing ===
    print("\n=== Stage 1: Text Preprocessing ===")
    posts = load_and_clean_posts(db_path)
    stats = compute_forum_stats(posts, db_path)

    stats_file = output_dir / "forum-stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"  Wrote {stats_file}")

    # === Stage 2: Treatment Extraction ===
    print("\n=== Stage 2: Treatment Extraction ===")
    posts = extract_treatments(posts)

    co_occurrence = build_co_occurrence(posts)
    timeline = build_timeline(posts)
    forum_dist = build_forum_distribution(posts)

    timeline_file = output_dir / "timeline.json"
    with open(timeline_file, 'w') as f:
        json.dump({'per_year': timeline, 'per_forum': forum_dist}, f, indent=2)
    print(f"  Wrote {timeline_file}")

    cooc_file = output_dir / "co-occurrence.json"
    with open(cooc_file, 'w') as f:
        json.dump(co_occurrence, f, indent=2)
    print(f"  Wrote {cooc_file}")

    # === Stage 3: Sentiment & Outcome Analysis ===
    print("\n=== Stage 3: Sentiment & Outcome Analysis ===")
    rankings, outcomes = analyze_outcomes(posts)

    rankings_file = output_dir / "treatment-rankings.json"
    with open(rankings_file, 'w') as f:
        json.dump(rankings, f, indent=2)
    print(f"  Wrote {rankings_file}")

    outcomes_file = output_dir / "outcomes.json"
    with open(outcomes_file, 'w') as f:
        json.dump(outcomes, f, indent=2)
    print(f"  Wrote {outcomes_file}")

    # === Stage 4: LLM Deep Extraction ===
    if args.skip_llm:
        print("\n=== Stage 4: Skipped (--skip-llm) ===")
    else:
        print("\n=== Stage 4: LLM Deep Extraction ===")
        rec_data = extract_with_llm(
            posts, rankings,
            top_n=args.top_n,
            sample_size=args.sample_size,
            model=args.llm_model,
            output_dir=output_dir,
        )
        if rec_data:
            rec_file = output_dir / "recommendation-data.json"
            with open(rec_file, 'w') as f:
                json.dump(rec_data, f, indent=2)
            print(f"  Wrote {rec_file}")

    print("\n=== Pipeline Complete ===")


if __name__ == '__main__':
    main()
