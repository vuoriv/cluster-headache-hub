#!/usr/bin/env python3
"""
ClusterBusters Forum Scraper
==============================
Scrapes clusterbusters.org/forums/ into a local SQLite database + CSV exports.

Usage:
    python clusterbusters_scraper.py --username YOUR_USERNAME --password YOUR_PASSWORD

    # Or let it prompt securely:
    python clusterbusters_scraper.py

Options:
    --username      Forum username
    --password      Forum password (prompted securely if omitted)
    --db            SQLite database file (default: clusterbusters.db)
    --delay         Seconds between requests (default: 1.5)
    --min-replies   Min replies to fetch full thread (default: 10)
    --min-views     Min views to fetch full thread (default: 1000)
    --sections      Comma-separated section IDs to scrape (default: all)
    --resume        Resume interrupted scrape (default: true)
    --no-resume     Start fresh, ignore existing progress

Examples:
    python clusterbusters_scraper.py --username ville --delay 1.0
    python clusterbusters_scraper.py --sections 8,11,13  # Theory, Stories, Research only
"""

import argparse
import csv
import getpass
import json
import logging
import re
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4 lxml")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────────────────────────

BASE_URL = "https://clusterbusters.org/forums/"
LOGIN_URL = "https://clusterbusters.org/forums/login/"
FORUM_SECTIONS = {
    "4":  "General Board",
    "6":  "ClusterBuster Files",
    "8":  "Theory & Implementation",
    "10": "ClusterBuster Fund Raising",
    "11": "Share Your Busting Stories",
    "12": "Advocacy Events and Conferences",
    "13": "Research & Scientific News",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scraper.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ─── Database Setup ───────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS forums (
    forum_id    TEXT PRIMARY KEY,
    name        TEXT,
    description TEXT,
    url         TEXT,
    scraped_at  TEXT
);

CREATE TABLE IF NOT EXISTS topics (
    topic_id        TEXT PRIMARY KEY,
    forum_id        TEXT,
    title           TEXT,
    url             TEXT,
    author          TEXT,
    author_id       TEXT,
    created_date    TEXT,
    last_post_date  TEXT,
    last_post_author TEXT,
    reply_count     INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    tags            TEXT,
    is_pinned       INTEGER DEFAULT 0,
    is_locked       INTEGER DEFAULT 0,
    posts_scraped   INTEGER DEFAULT 0,
    scraped_at      TEXT,
    FOREIGN KEY (forum_id) REFERENCES forums(forum_id)
);

CREATE TABLE IF NOT EXISTS posts (
    post_id         TEXT PRIMARY KEY,
    topic_id        TEXT,
    forum_id        TEXT,
    author          TEXT,
    author_id       TEXT,
    author_rank     TEXT,
    author_posts    INTEGER,
    posted_date     TEXT,
    edited_date     TEXT,
    content_text    TEXT,
    content_html    TEXT,
    post_number     INTEGER,
    is_first_post   INTEGER DEFAULT 0,
    likes           INTEGER DEFAULT 0,
    scraped_at      TEXT,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id)
);

CREATE TABLE IF NOT EXISTS scrape_progress (
    key     TEXT PRIMARY KEY,
    value   TEXT
);

CREATE INDEX IF NOT EXISTS idx_topics_forum    ON topics(forum_id);
CREATE INDEX IF NOT EXISTS idx_topics_views    ON topics(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_topics_replies  ON topics(reply_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_topic     ON posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_posts_date      ON posts(posted_date);
CREATE INDEX IF NOT EXISTS idx_posts_author    ON posts(author);
"""


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(SCHEMA)
    conn.commit()
    log.info(f"Database initialised: {db_path}")
    return conn


def get_progress(conn, key: str, default=None):
    row = conn.execute("SELECT value FROM scrape_progress WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def set_progress(conn, key: str, value):
    conn.execute(
        "INSERT OR REPLACE INTO scrape_progress (key, value) VALUES (?, ?)",
        (key, json.dumps(value))
    )
    conn.commit()


# ─── HTTP Session ─────────────────────────────────────────────────────────────

class ForumSession:
    # Shared across all cloned sessions so threads respect one global rate limit
    _global_lock = threading.Lock()
    _global_last = 0.0

    def __init__(self, delay: float = 1.5):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.delay = delay

    def clone(self) -> "ForumSession":
        """Return a new session sharing the same cookies — safe for a worker thread."""
        child = ForumSession(delay=self.delay)
        child.session.cookies.update(self.session.cookies)
        return child

    def get(self, url: str, timeout: int = 20, max_retries: int = 8, **kwargs) -> requests.Response:
        for attempt in range(max_retries):
            # Global rate-limit: one slot shared across all threads
            with ForumSession._global_lock:
                elapsed = time.time() - ForumSession._global_last
                if elapsed < self.delay:
                    time.sleep(self.delay - elapsed)
                ForumSession._global_last = time.time()
            try:
                resp = self.session.get(url, timeout=timeout, **kwargs)
                if resp.status_code == 429:
                    wait = 60 * (attempt + 1)
                    log.warning(f"Rate limited — waiting {wait}s")
                    time.sleep(wait)
                    continue
                if 400 <= resp.status_code < 500:
                    resp.raise_for_status()  # don't retry on 4xx client errors
                resp.raise_for_status()
                return resp
            except (requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout) as e:
                is_dns = "NameResolutionError" in str(e) or "nodename nor servname" in str(e)
                if is_dns:
                    wait = min(120, 15 * (attempt + 1))
                    log.warning(f"No internet (DNS failure) — waiting {wait}s then retrying [{attempt+1}/{max_retries}]")
                else:
                    wait = min(30, 3 * (attempt + 1))
                    log.warning(f"Request failed ({url}): {e} — retrying in {wait}s [{attempt+1}/{max_retries}]")
                time.sleep(wait)
            except requests.RequestException as e:
                log.warning(f"Request failed ({url}): {e} — retrying in 3s [{attempt+1}/{max_retries}]")
                time.sleep(3)
        raise requests.RequestException(f"Max retries ({max_retries}) exceeded for {url}")

    def login(self, username: str, password: str) -> bool:
        log.info(f"Logging in as {username}...")
        resp = self.get(LOGIN_URL)
        soup = BeautifulSoup(resp.text, "lxml")

        # Extract CSRF key
        csrf_input = soup.find("input", {"name": "csrfKey"})
        if not csrf_input:
            # Try meta tag
            meta = soup.find("meta", {"name": "csrfKey"})
            csrf_key = meta["content"] if meta else ""
        else:
            csrf_key = csrf_input.get("value", "")

        # Find login form action
        form = soup.find("form", {"id": "elSignInForm"}) or soup.find("form", {"action": re.compile("login")})
        action = form["action"] if form else LOGIN_URL

        payload = {
            "csrfKey":  csrf_key,
            "_processLogin": "usernamepassword",
            "auth":     username,
            "password": password,
            "remember_me": "1",
            "anonymous": "0",
        }

        resp = self.session.post(action, data=payload, timeout=30)
        self._last_request = time.time()

        # Check login success by looking for user-specific elements
        soup2 = BeautifulSoup(resp.text, "lxml")
        sign_out = soup2.find("a", href=re.compile("signout|logout", re.I))
        user_menu = soup2.find(attrs={"data-ipsMenu": True, "id": re.compile("elUserLink")})

        if sign_out or user_menu or username.lower() in resp.text.lower():
            log.info("Login successful!")
            return True
        else:
            log.error("Login failed — check credentials")
            return False


# ─── Parsers ──────────────────────────────────────────────────────────────────

def parse_number(text: str) -> int:
    """Parse '1.4k', '25,300', '42' into integer."""
    if not text:
        return 0
    text = text.strip().replace(",", "").replace("\xa0", "")
    if text.endswith("k"):
        return int(float(text[:-1]) * 1000)
    try:
        return int(float(text))
    except ValueError:
        return 0


def parse_topic_listing(soup: BeautifulSoup, forum_id: str, forum_url: str) -> list[dict]:
    topics = []
    for row in soup.select("li[data-rowid], div.ipsDataItem"):
        title_el = row.select_one("span[data-ipstruncate], h4 a, .ipsDataItem_title a")
        if not title_el:
            continue

        link_el = title_el if title_el.name == "a" else title_el.find_parent("a") or row.select_one("a[href*='/topic/']")
        if not link_el:
            continue

        url = link_el.get("href", "")
        if "/topic/" not in url:
            continue
        url = urljoin(BASE_URL, url).split("?")[0].split("#")[0]

        # Extract topic_id from URL
        m = re.search(r"/topic/(\d+)-", url)
        if not m:
            continue
        topic_id = m.group(1)

        title = title_el.get_text(strip=True)

        # Author
        author_el = row.select_one("a[href*='/profile/']")
        author = author_el.get_text(strip=True) if author_el else ""
        author_href = author_el.get("href", "") if author_el else ""
        author_id_m = re.search(r"/profile/(\d+)-", author_href)
        author_id = author_id_m.group(1) if author_id_m else ""

        # Stats — IPS uses data-stattype attributes on the <li> elements
        replies_el = row.select_one("[data-stattype='forums_comments'] .ipsDataItem_stats_number")
        views_el   = row.select_one("[data-stattype='num_views'] .ipsDataItem_stats_number")
        # Fallback: just take first two .ipsDataItem_stats_number elements in order
        if not replies_el or not views_el:
            stat_nums = row.select(".ipsDataItem_stats_number")
            if len(stat_nums) >= 2:
                replies_el = stat_nums[0]
                views_el   = stat_nums[1]
            elif len(stat_nums) == 1:
                replies_el = stat_nums[0]
        replies_text = replies_el.get_text(strip=True) if replies_el else "0"
        views_text   = views_el.get_text(strip=True)   if views_el   else "0"

        # Date
        date_el = row.select_one("time")
        date_str = date_el.get("datetime", "") if date_el else ""

        # Last post
        last_author_el = row.select_one(".ipsDataItem_lastPoster a, [data-desc='Last reply'] a")
        last_author = last_author_el.get_text(strip=True) if last_author_el else ""
        last_date_el = row.select_one(".ipsDataItem_lastPoster time")
        last_date = last_date_el.get("datetime", "") if last_date_el else ""

        # Tags
        tags = [t.get_text(strip=True) for t in row.select("a.ipsBadge, a[href*='tags']")]

        # Pinned
        is_pinned = 1 if row.select_one(".ipsDataItem_icon, [data-ipsPinned]") or "pinned" in row.get("class", []) else 0

        topics.append({
            "topic_id":       topic_id,
            "forum_id":       forum_id,
            "title":          title,
            "url":            url,
            "author":         author,
            "author_id":      author_id,
            "created_date":   date_str,
            "last_post_date": last_date,
            "last_post_author": last_author,
            "reply_count":    parse_number(replies_text),
            "view_count":     parse_number(views_text),
            "tags":           ",".join(tags),
            "is_pinned":      is_pinned,
            "is_locked":      0,
        })
    return topics


def parse_posts(soup: BeautifulSoup, topic_id: str, forum_id: str) -> list[dict]:
    posts = []
    post_els = soup.select("article[id^='elComment_'], div[id^='elComment_'], article.ipsComment")
    if not post_els:
        post_els = soup.select("[data-commentid], [data-comment-id]")

    for idx, el in enumerate(post_els):
        # Post ID
        post_id = el.get("id", "").replace("elComment_", "").replace("comment_", "")
        if not post_id:
            data_id = el.get("data-commentid") or el.get("data-comment-id") or ""
            post_id = str(data_id)
        if not post_id:
            continue

        # Author
        author_el = el.select_one("a[href*='/profile/'], strong.ipsType_break, .cAuthorPane_author a")
        author = author_el.get_text(strip=True) if author_el else ""
        author_href = author_el.get("href", "") if author_el else ""
        author_id_m = re.search(r"/profile/(\d+)-", author_href)
        author_id = author_id_m.group(1) if author_id_m else ""

        # Author rank/type
        rank_el = el.select_one(".ipsType_light, .cAuthorPane_info li:first-child, [data-membertype]")
        author_rank = rank_el.get_text(strip=True) if rank_el else ""

        # Author post count
        post_count_el = el.select_one("li:-soup-contains('posts'), .cAuthorPane_info li")
        author_posts_text = ""
        if post_count_el:
            m = re.search(r"([\d,]+)\s*posts?", post_count_el.get_text(), re.I)
            if m:
                author_posts_text = m.group(1).replace(",", "")

        # Date
        date_el = el.select_one("time")
        posted_date = date_el.get("datetime", "") if date_el else ""

        # Edited date
        edited_el = el.select_one(".ipsType_reset time, span:-soup-contains('Edited')")
        edited_date = ""
        if edited_el and edited_el.name == "time":
            edited_date = edited_el.get("datetime", "")

        # Content
        content_el = el.select_one(".ipsType_richText, .cPost_contentWrap, [data-role='commentContent']")
        if not content_el:
            content_el = el.select_one("article, .ipsComment_content")
        content_html = str(content_el) if content_el else ""
        content_text = content_el.get_text(separator="\n", strip=True) if content_el else ""

        # Likes/reactions
        likes_el = el.select_one(".ipsReact_reactCount, [data-reactioncount]")
        likes = parse_number(likes_el.get_text(strip=True)) if likes_el else 0

        posts.append({
            "post_id":      post_id,
            "topic_id":     topic_id,
            "forum_id":     forum_id,
            "author":       author,
            "author_id":    author_id,
            "author_rank":  author_rank,
            "author_posts": int(author_posts_text) if author_posts_text else None,
            "posted_date":  posted_date,
            "edited_date":  edited_date,
            "content_text": content_text,
            "content_html": content_html,
            "post_number":  idx + 1,
            "is_first_post": 1 if idx == 0 else 0,
            "likes":        likes,
            "scraped_at":   datetime.utcnow().isoformat(),
        })
    return posts


def get_next_page_url(soup: BeautifulSoup, current_url: str) -> str | None:
    # IPS marks the last-page next-button with ipsPagination_next--disabled on the <li>
    next_li = soup.select_one("li.ipsPagination_next")
    if next_li:
        classes = next_li.get("class", [])
        if "ipsPagination_next--disabled" in classes:
            return None  # last page
        a = next_li.select_one("a")
        if a and a.get("href"):
            next_url = urljoin(current_url, a["href"])
            if next_url != current_url:  # guard against self-loops
                return next_url
    # Fallback: <a rel="next">
    rel_next = soup.select_one("a[rel='next']")
    if rel_next and rel_next.get("href"):
        next_url = urljoin(current_url, rel_next["href"])
        if next_url != current_url:
            return next_url
    return None


# ─── Scraping Logic ───────────────────────────────────────────────────────────

def scrape_forum_listing(session: ForumSession, conn: sqlite3.Connection,
                          forum_id: str, forum_name: str, resume: bool):
    """Crawl all topic listing pages for a forum section."""
    forum_url = f"{BASE_URL}forum/{forum_id}-placeholder/"
    progress_key = f"listing_done_{forum_id}"

    if resume and get_progress(conn, progress_key):
        log.info(f"  [SKIP] {forum_name} listing already scraped (resume mode)")
        return

    log.info(f"  Crawling topic listings: {forum_name} (ID {forum_id})...")
    url = f"{BASE_URL}forum/{forum_id}-x/"
    page_num = 0
    total_topics = 0
    completed_without_error = True

    # Insert forum record
    conn.execute(
        "INSERT OR IGNORE INTO forums (forum_id, name, url, scraped_at) VALUES (?,?,?,?)",
        (forum_id, forum_name, url, datetime.utcnow().isoformat())
    )
    conn.commit()

    while url:
        page_num += 1
        log.info(f"    Page {page_num}: {url}")
        try:
            resp = session.get(url)
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            log.error(f"    Failed to load page {page_num}: {e}")
            completed_without_error = False
            break

        topics = parse_topic_listing(soup, forum_id, url)
        if not topics and page_num == 1:
            log.warning(f"    No topics found on page 1 — check forum ID {forum_id}")
            completed_without_error = False
            break

        # Save to DB (INSERT OR IGNORE to not overwrite existing data)
        for t in topics:
            conn.execute("""
                INSERT OR IGNORE INTO topics
                (topic_id, forum_id, title, url, author, author_id,
                 created_date, last_post_date, last_post_author,
                 reply_count, view_count, tags, is_pinned, is_locked)
                VALUES (:topic_id, :forum_id, :title, :url, :author, :author_id,
                        :created_date, :last_post_date, :last_post_author,
                        :reply_count, :view_count, :tags, :is_pinned, :is_locked)
            """, t)
        conn.commit()
        total_topics += len(topics)

        url = get_next_page_url(soup, url)

    log.info(f"    Done: {total_topics} topics catalogued for {forum_name}")
    # Only mark as done if we finished without a connection error
    if completed_without_error:
        set_progress(conn, progress_key, True)
    else:
        log.warning(f"    Section {forum_name} NOT marked complete — will retry on next run")


def scrape_topic_posts(session: ForumSession, conn: sqlite3.Connection,
                        topic: sqlite3.Row, force: bool = False):
    """Download all posts for a single topic."""
    topic_id = topic["topic_id"]
    topic_url = topic["url"]
    title = topic["title"]

    if not force and topic["posts_scraped"]:
        return 0  # Already done

    url = topic_url
    page_num = 0
    total_posts = 0
    forum_id = topic["forum_id"]

    while url:
        page_num += 1
        try:
            resp = session.get(url)
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            log.warning(f"      Failed page {page_num} of topic {topic_id}: {e}")
            break

        posts = parse_posts(soup, topic_id, forum_id)
        if not posts and page_num == 1:
            log.warning(f"      No posts parsed for topic {topic_id}: {title[:50]}")
            break

        for p in posts:
            conn.execute("""
                INSERT OR IGNORE INTO posts
                (post_id, topic_id, forum_id, author, author_id, author_rank,
                 author_posts, posted_date, edited_date, content_text, content_html,
                 post_number, is_first_post, likes, scraped_at)
                VALUES (:post_id, :topic_id, :forum_id, :author, :author_id, :author_rank,
                        :author_posts, :posted_date, :edited_date, :content_text, :content_html,
                        :post_number, :is_first_post, :likes, :scraped_at)
            """, p)
        conn.commit()
        total_posts += len(posts)

        url = get_next_page_url(soup, url)

    # Mark as scraped
    conn.execute(
        "UPDATE topics SET posts_scraped=1, scraped_at=? WHERE topic_id=?",
        (datetime.utcnow().isoformat(), topic_id)
    )
    conn.commit()
    return total_posts


# ─── CSV Export ───────────────────────────────────────────────────────────────

def export_csvs(conn: sqlite3.Connection, output_dir: Path):
    output_dir.mkdir(exist_ok=True)
    tables = ["forums", "topics", "posts"]
    for table in tables:
        path = output_dir / f"{table}.csv"
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            continue
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(rows[0].keys())
            writer.writerows(rows)
        log.info(f"  Exported {len(rows):,} rows → {path}")


# ─── Author Fix ───────────────────────────────────────────────────────────────

def extract_author_from_el(el) -> str:
    """Try multiple selectors to find the post author, most specific first."""
    # IPS forum author panel selectors in priority order
    selectors = [
        "aside .cAuthorPane_author a",
        ".cAuthorPane_author a",
        "h3.cAuthorPane_author a",
        "aside a[href*='/profile/']",
        ".ipsComment_header a[href*='/profile/']",
        "[data-role='author'] a",
    ]
    for sel in selectors:
        try:
            found = el.select_one(sel)
            if found:
                text = found.get_text(strip=True)
                if text:
                    return text
        except Exception:
            pass
    return ""


def fix_authors(session: ForumSession, conn: sqlite3.Connection, workers: int):
    """Re-fetch topic pages for posts missing author data and update the DB."""
    # Find all topics that have at least one authorless reply post
    topics_needed = conn.execute("""
        SELECT DISTINCT t.topic_id, t.url, t.forum_id, t.title,
               COUNT(p.post_id) as missing_count
        FROM posts p
        JOIN topics t ON t.topic_id = p.topic_id
        WHERE p.author = '' AND p.is_first_post = 0
        GROUP BY t.topic_id
        ORDER BY missing_count DESC
    """).fetchall()

    total_missing = conn.execute(
        "SELECT COUNT(*) FROM posts WHERE author='' AND is_first_post=0"
    ).fetchone()[0]

    log.info(f"Fix-authors mode: {total_missing:,} reply posts missing authors "
             f"across {len(topics_needed):,} topics")

    if not topics_needed:
        log.info("Nothing to fix — all reply posts already have authors.")
        return

    db_path = conn.execute("PRAGMA database_list").fetchone()[2]
    fixed_total = [0]
    counter_lock = threading.Lock()

    def fix_topic(row):
        tid, url, fid, title, _ = row
        worker_sess = session.clone()
        wconn = sqlite3.connect(db_path, check_same_thread=False)
        wconn.row_factory = sqlite3.Row
        wconn.execute("PRAGMA journal_mode=WAL")

        fixed = 0
        page_url = url
        # Map post_id -> author for all authorless posts in this topic
        missing = {r["post_id"]: r["post_number"]
                   for r in wconn.execute(
                       "SELECT post_id, post_number FROM posts WHERE topic_id=? AND author=''",
                       (tid,))}
        if not missing:
            wconn.close()
            return 0

        while page_url and missing:
            try:
                # Short timeout + 2 retries max — skip slow pages rather than waiting
                soup = BeautifulSoup(
                    worker_sess.get(page_url, timeout=12, max_retries=2).text, "lxml"
                )
            except Exception as e:
                log.debug(f"  Skipping {page_url}: {e}")
                break

            post_els = soup.select(
                "article[id^='elComment_'], div[id^='elComment_'], article.ipsComment"
            )
            for el in post_els:
                raw_id = el.get("id", "").replace("elComment_", "").replace("comment_", "")
                pid = re.sub(r"\D", "", raw_id)
                if pid in missing:
                    author = extract_author_from_el(el)
                    if author:
                        wconn.execute(
                            "UPDATE posts SET author=? WHERE post_id=?", (author, pid)
                        )
                        del missing[pid]
                        fixed += 1

            wconn.commit()
            nxt = soup.select_one("li.ipsPagination_next")
            if nxt and "ipsPagination_next--disabled" not in nxt.get("class", []):
                a = nxt.select_one("a")
                next_url = (a["href"] if a and a.get("href") else None)
                page_url = urljoin(page_url, next_url) if next_url and next_url != page_url else None
            else:
                page_url = None

        wconn.close()
        return fixed

    start = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fix_topic, row): row for row in topics_needed}
        for i, future in enumerate(as_completed(futures), 1):
            n = future.result()
            with counter_lock:
                fixed_total[0] += n
                if i % 100 == 0 or i == len(topics_needed):
                    elapsed = time.time() - start
                    rate = i / elapsed
                    remaining = (len(topics_needed) - i) / rate / 60
                    log.info(f"  [{i}/{len(topics_needed)}] "
                             f"{fixed_total[0]:,} authors fixed so far  "
                             f"~{remaining:.0f}min left")

    final_missing = conn.execute(
        "SELECT COUNT(*) FROM posts WHERE author='' AND is_first_post=0"
    ).fetchone()[0]
    log.info(f"Done. Fixed {fixed_total[0]:,} authors. "
             f"Still missing: {final_missing:,}")

    # Show top authors now
    print("\nTop 20 authors (reply posts):")
    for r in conn.execute("""
        SELECT author, COUNT(*) as n FROM posts
        WHERE author != '' AND is_first_post=0
        GROUP BY author ORDER BY n DESC LIMIT 20
    """):
        print(f"  {r[0]:<30} {r[1]:>5}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def print_stats(conn: sqlite3.Connection):
    forums  = conn.execute("SELECT COUNT(*) FROM forums").fetchone()[0]
    topics  = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    scraped = conn.execute("SELECT COUNT(*) FROM topics WHERE posts_scraped=1").fetchone()[0]
    posts   = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    authors = conn.execute("SELECT COUNT(DISTINCT author) FROM posts").fetchone()[0]

    print("\n" + "="*55)
    print("  DATABASE SUMMARY")
    print("="*55)
    print(f"  Forum sections : {forums}")
    print(f"  Topics indexed : {topics:,}")
    print(f"  Topics scraped : {scraped:,} (posts downloaded)")
    print(f"  Posts stored   : {posts:,}")
    print(f"  Unique authors : {authors:,}")
    print("="*55 + "\n")

    # Top forums by posts
    rows = conn.execute("""
        SELECT f.name, COUNT(p.post_id) as post_count
        FROM posts p JOIN topics t ON p.topic_id=t.topic_id
        JOIN forums f ON t.forum_id=f.forum_id
        GROUP BY f.forum_id ORDER BY post_count DESC
    """).fetchall()
    if rows:
        print("  Posts by section:")
        for r in rows:
            print(f"    {r['name']:<40} {r['post_count']:>6,}")
        print()


def main():
    parser = argparse.ArgumentParser(description="ClusterBusters Forum Scraper")
    parser.add_argument("--username", help="Forum username")
    parser.add_argument("--password", help="Forum password")
    parser.add_argument("--db",       default="clusterbusters.db", help="SQLite DB file")
    parser.add_argument("--delay",    type=float, default=1.5, help="Seconds between requests")
    parser.add_argument("--min-replies", type=int, default=10,   help="Min replies to fetch full thread")
    parser.add_argument("--min-views",   type=int, default=1000, help="Min views to fetch full thread")
    parser.add_argument("--sections",  help="Comma-separated forum IDs (default: all)")
    parser.add_argument("--resume",    action="store_true",  default=True, help="Resume from previous run")
    parser.add_argument("--no-resume", action="store_true",  default=False)
    parser.add_argument("--workers",    type=int, default=4, help="Parallel topic workers (default: 4)")
    parser.add_argument("--export-csv", default="csv_exports", help="CSV export directory")
    parser.add_argument("--fix-authors", action="store_true", default=False,
                        help="Re-fetch post pages to fill missing author fields, then exit")
    args = parser.parse_args()

    if args.no_resume:
        args.resume = False

    # Credentials
    username = args.username or input("Forum username: ").strip()
    password = args.password or getpass.getpass("Forum password: ")

    # Sections to scrape
    if args.sections:
        sections = {k: v for k, v in FORUM_SECTIONS.items() if k in args.sections.split(",")}
    else:
        sections = FORUM_SECTIONS

    # Init
    conn = init_db(args.db)
    session = ForumSession(delay=args.delay)

    # Login
    if not session.login(username, password):
        print("Login failed. Check your credentials.")
        sys.exit(1)

    # ── FIX-AUTHORS mode ──────────────────────────────────────────────────────
    if args.fix_authors:
        fix_authors(session, conn, workers=args.workers)
        print_stats(conn)
        conn.close()
        sys.exit(0)

    # ── PHASE 1: Crawl all topic listings ─────────────────────────────────────
    print("\n" + "="*55)
    print("  PHASE 1: Indexing all topic listings")
    print("="*55)
    for forum_id, forum_name in sections.items():
        scrape_forum_listing(session, conn, forum_id, forum_name, resume=args.resume)

    total_topics = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    log.info(f"\nPhase 1 complete: {total_topics:,} topics indexed across {len(sections)} sections\n")

    # ── PHASE 2: Download post content ────────────────────────────────────────
    print("="*55)
    print(f"  PHASE 2: Downloading posts")
    print(f"  Smart filter: ALL first posts + full threads with")
    print(f"  {args.min_replies}+ replies OR {args.min_views:,}+ views")
    print("="*55)

    # All topics needing scraping
    topics_to_scrape = conn.execute("""
        SELECT * FROM topics WHERE posts_scraped = 0
        ORDER BY view_count DESC, reply_count DESC
    """).fetchall()

    total = len(topics_to_scrape)
    log.info(f"{total:,} topics to process with {args.workers} parallel workers...")

    # Shared counters (protected by a lock)
    counter_lock  = threading.Lock()
    scraped_count = [0]
    post_count    = [0]
    start_time    = time.time()

    db_path = args.db  # each worker opens its own connection

    def process_topic(topic_row):
        """Worker: scrape one topic. Gets its own DB connection and HTTP session."""
        topic_id = topic_row["topic_id"]
        title    = topic_row["title"]
        replies  = topic_row["reply_count"]
        views    = topic_row["view_count"]
        forum_id = topic_row["forum_id"]
        fetch_all = (replies >= args.min_replies) or (views >= args.min_views)

        worker_sess = session.clone()
        wconn = sqlite3.connect(db_path, check_same_thread=False)
        wconn.row_factory = sqlite3.Row
        wconn.execute("PRAGMA journal_mode=WAL")

        try:
            if fetch_all:
                n = scrape_topic_posts(worker_sess, wconn, topic_row)
            else:
                resp = worker_sess.get(topic_row["url"])
                soup = BeautifulSoup(resp.text, "lxml")
                posts = parse_posts(soup, topic_id, forum_id)
                n = 0
                if posts:
                    p = posts[0]
                    wconn.execute("""
                        INSERT OR IGNORE INTO posts
                        (post_id, topic_id, forum_id, author, author_id, author_rank,
                         author_posts, posted_date, edited_date, content_text, content_html,
                         post_number, is_first_post, likes, scraped_at)
                        VALUES (:post_id, :topic_id, :forum_id, :author, :author_id, :author_rank,
                                :author_posts, :posted_date, :edited_date, :content_text, :content_html,
                                :post_number, :is_first_post, :likes, :scraped_at)
                    """, p)
                    wconn.execute(
                        "UPDATE topics SET posts_scraped=1, scraped_at=? WHERE topic_id=?",
                        (datetime.utcnow().isoformat(), topic_id)
                    )
                    wconn.commit()
                    n = 1
            return (topic_id, title, n, fetch_all)
        except Exception as e:
            log.warning(f"  Error scraping topic {topic_id} ({title[:40]}): {e}")
            return (topic_id, title, 0, fetch_all)
        finally:
            wconn.close()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_topic, t): t for t in topics_to_scrape}
        for future in as_completed(futures):
            topic_id, title, n, fetch_all = future.result()
            with counter_lock:
                scraped_count[0] += 1
                post_count[0]    += n
                i = scraped_count[0]
                elapsed  = time.time() - start_time
                rate     = i / elapsed if elapsed > 0 else 1
                remaining = (total - i) / rate / 60
                log.info(
                    f"  [{i}/{total}] {title[:50]:<50} "
                    f"{'[FULL]' if fetch_all else '[1st]'} +{n}posts "
                    f"~{remaining:.0f}min left"
                )
                if i % 100 == 0:
                    print_stats(conn)

    # ── PHASE 3: Export CSVs ─────────────────────────────────────────────────
    print("\n" + "="*55)
    print("  PHASE 3: Exporting CSVs")
    print("="*55)
    export_csvs(conn, Path(args.export_csv))

    # Final summary
    print_stats(conn)
    elapsed_total = (time.time() - start_time) / 60
    print(f"  Total time : {elapsed_total:.1f} minutes")
    print(f"  Database   : {args.db}")
    print(f"  CSV folder : {args.export_csv}/")
    print()
    print("  Load in pandas:")
    print("    import sqlite3, pandas as pd")
    print(f'    conn = sqlite3.connect("{args.db}")')
    print('    topics = pd.read_sql("SELECT * FROM topics", conn)')
    print('    posts  = pd.read_sql("SELECT * FROM posts",  conn)')
    print()


if __name__ == "__main__":
    main()
