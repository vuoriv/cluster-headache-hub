#!/usr/bin/env python3
"""
Reddit r/ClusterHeadaches scraper
===================================
Scrapes posts and comments into a separate SQLite database.

Usage (no credentials — limited to ~1000 posts per sort):
    python reddit_scraper.py

Usage (with Reddit API credentials — gets everything):
    python reddit_scraper.py --client-id YOUR_ID --client-secret YOUR_SECRET

How to get Reddit API credentials (free, takes 2 min):
    1. Log into reddit.com
    2. Go to https://www.reddit.com/prefs/apps
    3. Click "create app" → choose "script"
    4. Name: anything, redirect: http://localhost:8080
    5. Copy the client_id (under the app name) and client_secret

Options:
    --client-id      Reddit API client ID
    --client-secret  Reddit API client secret
    --db             Output database (default: reddit_clusterheadaches.db)
    --subreddit      Subreddit to scrape (default: ClusterHeadaches)
    --delay          Seconds between requests (default: 1.0)
    --comments       Max comments to fetch per post (default: 500, 0=all)
    --min-score      Only fetch comments for posts with score >= this (default: 5)
"""

import argparse
import getpass
import json
import logging
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("Run: pip install requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("reddit_scraper.log"),
    ]
)
log = logging.getLogger(__name__)

SUBREDDIT   = "ClusterHeadaches"
BASE_URL    = "https://www.reddit.com"
OAUTH_URL   = "https://oauth.reddit.com"
TOKEN_URL   = "https://www.reddit.com/api/v1/access_token"
USER_AGENT  = "ClusterBusters-Research/1.0 (personal research scraper)"

SCHEMA = """
CREATE TABLE IF NOT EXISTS subreddits (
    name TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    subscribers INTEGER,
    scraped_at TEXT
);
CREATE TABLE IF NOT EXISTS posts (
    post_id     TEXT PRIMARY KEY,
    subreddit   TEXT,
    title       TEXT,
    author      TEXT,
    url         TEXT,
    permalink   TEXT,
    selftext    TEXT,
    score       INTEGER,
    upvote_ratio REAL,
    num_comments INTEGER,
    created_utc TEXT,
    flair       TEXT,
    is_self     INTEGER,
    awards      INTEGER,
    comments_scraped INTEGER DEFAULT 0,
    scraped_at  TEXT
);
CREATE TABLE IF NOT EXISTS comments (
    comment_id  TEXT PRIMARY KEY,
    post_id     TEXT,
    parent_id   TEXT,
    subreddit   TEXT,
    author      TEXT,
    body        TEXT,
    score       INTEGER,
    created_utc TEXT,
    depth       INTEGER,
    scraped_at  TEXT
);
CREATE TABLE IF NOT EXISTS scrape_progress (
    key   TEXT PRIMARY KEY,
    value TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_score     ON posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_date      ON posts(created_utc);
CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author);
"""


def ts_to_iso(utc_ts):
    return datetime.fromtimestamp(utc_ts, tz=timezone.utc).isoformat()


class RedditSession:
    def __init__(self, client_id=None, client_secret=None, delay=1.0):
        self.sess    = requests.Session()
        self.delay   = delay
        self._last   = 0.0
        self.authed  = False
        self.sess.headers.update({"User-Agent": USER_AGENT})

        if client_id and client_secret:
            self._oauth_login(client_id, client_secret)

    def _oauth_login(self, client_id, client_secret):
        log.info("Authenticating with Reddit API...")
        r = self.sess.post(
            TOKEN_URL,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": USER_AGENT},
        )
        r.raise_for_status()
        token = r.json().get("access_token")
        if not token:
            log.error(f"Auth failed: {r.text}")
            return
        self.sess.headers.update({"Authorization": f"bearer {token}"})
        self.base = OAUTH_URL
        self.authed = True
        log.info("Reddit OAuth authenticated — full API access enabled")

    def get(self, path, params=None, retries=5):
        base = OAUTH_URL if self.authed else BASE_URL
        url  = f"{base}{path}"
        for attempt in range(retries):
            gap = time.time() - self._last
            if gap < self.delay:
                time.sleep(self.delay - gap)
            try:
                r = self.sess.get(url, params=params, timeout=20)
                self._last = time.time()
                if r.status_code == 429:
                    wait = int(r.headers.get("Retry-After", 60))
                    log.warning(f"Rate limited — waiting {wait}s")
                    time.sleep(wait)
                    continue
                if r.status_code == 403:
                    log.error(f"403 Forbidden: {url} — possible auth issue")
                    return None
                r.raise_for_status()
                return r.json()
            except Exception as e:
                wait = min(60, 5 * (attempt + 1))
                log.warning(f"Request failed: {e} — retrying in {wait}s [{attempt+1}/{retries}]")
                time.sleep(wait)
        return None


def save_post(conn, post_data, subreddit):
    d = post_data
    conn.execute("""
        INSERT OR IGNORE INTO posts
        (post_id, subreddit, title, author, url, permalink, selftext,
         score, upvote_ratio, num_comments, created_utc, flair,
         is_self, awards, scraped_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        d.get("id"), subreddit,
        d.get("title",""),
        d.get("author","[deleted]"),
        d.get("url",""),
        d.get("permalink",""),
        d.get("selftext",""),
        d.get("score", 0),
        d.get("upvote_ratio", 0),
        d.get("num_comments", 0),
        ts_to_iso(d.get("created_utc", 0)),
        d.get("link_flair_text","") or "",
        1 if d.get("is_self") else 0,
        d.get("total_awards_received", 0),
        datetime.utcnow().isoformat(),
    ))


def flatten_comments(comment_list, post_id, subreddit, depth=0):
    """Recursively flatten Reddit comment tree."""
    result = []
    for item in comment_list:
        if not isinstance(item, dict):
            continue
        kind = item.get("kind")
        data = item.get("data", {})
        if kind == "t1":
            result.append({
                "comment_id": data.get("id",""),
                "post_id":    post_id,
                "parent_id":  data.get("parent_id",""),
                "subreddit":  subreddit,
                "author":     data.get("author","[deleted]"),
                "body":       data.get("body",""),
                "score":      data.get("score", 0),
                "created_utc": ts_to_iso(data.get("created_utc", 0)),
                "depth":      depth,
                "scraped_at": datetime.utcnow().isoformat(),
            })
            replies = data.get("replies")
            if isinstance(replies, dict):
                children = replies.get("data", {}).get("children", [])
                result.extend(flatten_comments(children, post_id, subreddit, depth+1))
        elif kind == "more":
            pass  # "load more" placeholders — skip for now
    return result


def scrape_listing(sess, conn, subreddit, sort, limit_posts=None):
    """Scrape all posts from a listing (hot/new/top/controversial)."""
    log.info(f"  Scraping r/{subreddit} [{sort}]...")
    path   = f"/r/{subreddit}/{sort}.json"
    params = {"limit": 100, "raw_json": 1}
    if sort == "top":
        params["t"] = "all"

    after      = None
    total      = 0
    page       = 0
    prog_key   = f"listing_done_{subreddit}_{sort}"
    if conn.execute("SELECT value FROM scrape_progress WHERE key=?", (prog_key,)).fetchone():
        log.info(f"  [SKIP] {sort} already scraped")
        return

    while True:
        page += 1
        if after:
            params["after"] = after
        data = sess.get(path, params=params)
        if not data:
            break
        children = data.get("data", {}).get("children", [])
        if not children:
            break
        for child in children:
            if child.get("kind") == "t3":
                save_post(conn, child["data"], subreddit)
                total += 1
        conn.commit()

        after = data.get("data", {}).get("after")
        log.info(f"    {sort} page {page}: {total} posts so far")
        if not after:
            break
        if limit_posts and total >= limit_posts:
            break

    conn.execute("INSERT OR REPLACE INTO scrape_progress VALUES (?,?)",
                 (prog_key, json.dumps(True)))
    conn.commit()
    log.info(f"  Done [{sort}]: {total} posts indexed")


def scrape_comments(sess, conn, subreddit, min_score=5, max_comments=500):
    """Fetch comments for posts that haven't been comment-scraped yet."""
    posts = conn.execute("""
        SELECT post_id, permalink, score, num_comments
        FROM posts WHERE comments_scraped=0 AND score >= ?
        ORDER BY score DESC
    """, (min_score,)).fetchall()

    log.info(f"\nFetching comments for {len(posts)} posts (score >= {min_score})...")
    for i, (pid, permalink, score, n_comments) in enumerate(posts, 1):
        if not permalink:
            continue
        path   = f"{permalink}.json"
        params = {"limit": max_comments, "depth": 10, "raw_json": 1}
        data   = sess.get(path, params=params)
        if not data or len(data) < 2:
            continue

        comment_listing = data[1].get("data", {}).get("children", [])
        comments = flatten_comments(comment_listing, pid, subreddit)
        for c in comments:
            conn.execute("""
                INSERT OR IGNORE INTO comments
                (comment_id, post_id, parent_id, subreddit, author, body,
                 score, created_utc, depth, scraped_at)
                VALUES (:comment_id, :post_id, :parent_id, :subreddit, :author, :body,
                        :score, :created_utc, :depth, :scraped_at)
            """, c)
        conn.execute("UPDATE posts SET comments_scraped=1 WHERE post_id=?", (pid,))
        conn.commit()

        if i % 50 == 0 or i == len(posts):
            log.info(f"  Comments: {i}/{len(posts)} posts done")

    log.info("Comment scraping complete.")


def print_stats(conn):
    posts    = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    comments = conn.execute("SELECT COUNT(*) FROM comments").fetchone()[0]
    authors  = conn.execute("SELECT COUNT(DISTINCT author) FROM posts").fetchone()[0]
    top5 = conn.execute("""
        SELECT title, score, num_comments FROM posts
        ORDER BY score DESC LIMIT 5
    """).fetchall()
    print(f"\n{'='*55}")
    print(f"  r/ClusterHeadaches — SUMMARY")
    print(f"{'='*55}")
    print(f"  Posts     : {posts:,}")
    print(f"  Comments  : {comments:,}")
    print(f"  Authors   : {authors:,}")
    print(f"\n  Top 5 posts by score:")
    for r in top5:
        print(f"    [{r[1]:>5}↑ {r[2]:>4}💬] {r[0][:55]}")
    print(f"{'='*55}\n")


def main():
    parser = argparse.ArgumentParser(description="Reddit r/ClusterHeadaches scraper")
    parser.add_argument("--client-id",     help="Reddit API client ID (optional)")
    parser.add_argument("--client-secret", help="Reddit API client secret (optional)")
    parser.add_argument("--db",            default="reddit_clusterheadaches.db")
    parser.add_argument("--subreddit",     default=SUBREDDIT)
    parser.add_argument("--delay",         type=float, default=1.0)
    parser.add_argument("--min-score",     type=int,   default=5)
    parser.add_argument("--comments",      type=int,   default=500)
    args = parser.parse_args()

    log.info(f"Reddit scraper starting — r/{args.subreddit}")
    log.info(f"Database: {args.db}")
    if not args.client_id:
        log.info("No API credentials — using public JSON API (capped at ~1000 posts/sort)")
        log.info("For full data: python reddit_scraper.py --client-id ID --client-secret SECRET")

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    conn.commit()

    client_secret = args.client_secret
    if args.client_id and not client_secret:
        client_secret = getpass.getpass("Reddit API client secret: ")

    sess = RedditSession(
        client_id=args.client_id,
        client_secret=client_secret,
        delay=args.delay,
    )

    sub = args.subreddit

    # Phase 1: Index posts via multiple sort methods to maximise coverage
    print(f"\n{'='*55}")
    print(f"  PHASE 1: Indexing posts")
    print(f"{'='*55}")
    for sort in ["top", "new", "hot", "controversial"]:
        scrape_listing(sess, conn, sub, sort)

    total_posts = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    log.info(f"\nPhase 1 complete: {total_posts:,} unique posts indexed")

    # Phase 2: Fetch comments for popular posts
    print(f"\n{'='*55}")
    print(f"  PHASE 2: Fetching comments (score >= {args.min_score})")
    print(f"{'='*55}")
    scrape_comments(sess, conn, sub, min_score=args.min_score, max_comments=args.comments)

    # Summary
    print_stats(conn)
    conn.close()
    log.info(f"Done. Database saved to: {args.db}")


if __name__ == "__main__":
    main()
