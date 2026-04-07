#!/usr/bin/env python3
"""
Research Data Pipeline — fetch from PubMed + ClinicalTrials.gov, enrich, build DB.

Replaces the TypeScript pipeline (scripts/pipeline/*.ts) with a single Python script.

Usage:
  python scripts/fetch-research.py [--db PATH] [--skip-papers] [--skip-trials]
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import xml.etree.ElementTree as ET

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_DB = os.path.join(PROJECT_ROOT, "public", "data.db")

# ── PubMed ──

ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

# Expanded search: MeSH + Title/Abstract + TAC synonym
PUBMED_QUERY = (
    '"cluster headache"[MeSH Terms] '
    'OR "cluster headache"[Title/Abstract] '
    'OR "trigeminal autonomic cephalalgia"[Title/Abstract]'
)

BATCH_SIZE = 100
BATCH_DELAY = 0.4  # seconds between API calls


def fetch_papers():
    """Fetch all cluster headache papers from PubMed."""
    print("Fetching papers from PubMed...", flush=True)

    # Step 1: Search for PMIDs
    params = urlencode({
        "db": "pubmed",
        "term": PUBMED_QUERY,
        "retmax": "10000",
        "retmode": "json",
        "sort": "date",
    })
    data = requests.get(f"{ESEARCH}?{params}").json()
    pmids = data["esearchresult"].get("idlist", [])
    total = int(data["esearchresult"].get("count", 0))
    print(f"  Found {len(pmids)} PMIDs (total matches: {total})", flush=True)

    if not pmids:
        return []

    # Step 2: Fetch summaries in batches
    papers = []
    total_batches = (len(pmids) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(pmids), BATCH_SIZE):
        batch_num = i // BATCH_SIZE + 1
        batch = pmids[i:i + BATCH_SIZE]

        if batch_num % 5 == 1:
            print(f"  Summaries batch {batch_num}/{total_batches}...", flush=True)

        params = urlencode({"db": "pubmed", "id": ",".join(batch), "retmode": "json"})
        try:
            result = requests.get(f"{ESUMMARY}?{params}").json().get("result", {})
        except Exception:
            continue

        for pmid in result.get("uids", []):
            r = result.get(pmid)
            if not r:
                continue
            authors_list = r.get("authors", [])
            authors = ", ".join(a["name"] for a in authors_list[:3])
            if len(authors_list) > 3:
                authors += " et al."

            papers.append({
                "pmid": pmid,
                "title": r.get("title", ""),
                "authors": authors,
                "journal": r.get("fulljournalname") or r.get("source", ""),
                "pub_date": r.get("pubdate", ""),
                "abstract": "",
                "mesh_terms": [],
            })

        if i + BATCH_SIZE < len(pmids):
            time.sleep(BATCH_DELAY)

    # Step 3: Fetch abstracts + MeSH terms via efetch XML
    print("  Fetching abstracts...", flush=True)
    abstract_batch = 50
    total_abs_batches = (len(papers) + abstract_batch - 1) // abstract_batch

    for i in range(0, len(papers), abstract_batch):
        batch_num = i // abstract_batch + 1
        batch = papers[i:i + abstract_batch]
        ids = ",".join(p["pmid"] for p in batch)

        if batch_num % 20 == 1:
            print(f"  Abstracts batch {batch_num}/{total_abs_batches}...", flush=True)

        try:
            params = urlencode({
                "db": "pubmed", "id": ids, "rettype": "abstract", "retmode": "xml"
            })
            xml = requests.get(f"{EFETCH}?{params}").text
            abstracts = _parse_abstracts(xml)
            mesh = _parse_mesh(xml)

            for p in batch:
                if p["pmid"] in abstracts:
                    p["abstract"] = abstracts[p["pmid"]]
                if p["pmid"] in mesh:
                    p["mesh_terms"] = mesh[p["pmid"]]
        except Exception:
            pass

        if i + abstract_batch < len(papers):
            time.sleep(BATCH_DELAY)

    with_abs = sum(1 for p in papers if p["abstract"])
    print(f"  Fetched {len(papers)} papers ({with_abs} with abstracts)", flush=True)
    return papers


def _parse_abstracts(xml):
    result = {}
    for article in xml.split("<PubmedArticle>")[1:]:
        pmid_match = re.search(r"<PMID[^>]*>(\d+)</PMID>", article)
        if not pmid_match:
            continue
        abstract_match = re.search(r"<Abstract>([\s\S]*?)</Abstract>", article)
        if not abstract_match:
            continue
        parts = re.findall(r"<AbstractText[^>]*>([\s\S]*?)</AbstractText>", abstract_match.group(1))
        if parts:
            text = " ".join(re.sub(r"<[^>]+>", "", p).strip() for p in parts)
            result[pmid_match.group(1)] = text
    return result


def _parse_mesh(xml):
    result = {}
    for article in xml.split("<PubmedArticle>")[1:]:
        pmid_match = re.search(r"<PMID[^>]*>(\d+)</PMID>", article)
        if not pmid_match:
            continue
        mesh_section = re.search(r"<MeshHeadingList>([\s\S]*?)</MeshHeadingList>", article)
        if not mesh_section:
            continue
        descriptors = re.findall(r"<DescriptorName[^>]*>([\s\S]*?)</DescriptorName>", mesh_section.group(1))
        if descriptors:
            result[pmid_match.group(1)] = [re.sub(r"<[^>]+>", "", d).strip() for d in descriptors]
    return result


# ── ClinicalTrials.gov ──

CT_API = "https://clinicaltrials.gov/api/v2/studies"

CT_STATUSES = [
    "RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING",
    "COMPLETED", "TERMINATED", "WITHDRAWN", "SUSPENDED", "ENROLLING_BY_INVITATION",
]


def fetch_trials():
    """Fetch all cluster headache trials from ClinicalTrials.gov."""
    print("Fetching trials from ClinicalTrials.gov...", flush=True)
    all_trials = []
    next_token = None

    while True:
        params = {
            "query.cond": "cluster headache",
            "filter.overallStatus": ",".join(CT_STATUSES),
            "pageSize": "100",
            "format": "json",
        }
        if next_token:
            params["pageToken"] = next_token

        url = f"{CT_API}?{urlencode(params)}"
        data = requests.get(url).json()

        for s in data.get("studies", []):
            p = s.get("protocolSection", {})
            id_mod = p.get("identificationModule", {})
            stat_mod = p.get("statusModule", {})
            des_mod = p.get("designModule", {})
            sp = p.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {})
            arms = p.get("armsInterventionsModule", {})
            desc = p.get("descriptionModule", {})
            cond = p.get("conditionsModule", {})

            all_trials.append({
                "nct_id": id_mod.get("nctId", ""),
                "title": id_mod.get("briefTitle", ""),
                "status": stat_mod.get("overallStatus", ""),
                "phase": json.dumps(des_mod.get("phases", [])),
                "study_type": des_mod.get("studyType", ""),
                "sponsor": sp.get("name", ""),
                "enrollment": (des_mod.get("enrollmentInfo") or {}).get("count"),
                "start_date": (stat_mod.get("startDateStruct") or {}).get("date", ""),
                "end_date": (stat_mod.get("primaryCompletionDateStruct") or {}).get("date", ""),
                "interventions": json.dumps([i["name"] for i in arms.get("interventions", [])]),
                "summary": desc.get("briefSummary", ""),
                "conditions": ", ".join(cond.get("conditions", [])),
                "raw_json": json.dumps(s),
            })

        next_token = data.get("nextPageToken")
        if not next_token:
            break
        time.sleep(0.2)

    print(f"  Fetched {len(all_trials)} trials", flush=True)
    return all_trials


# ── EFETCH Enrichment ──


def parse_efetch_xml(xml_text):
    """Parse EFETCH XML response, return dict of pmid -> enrichment data."""
    results = {}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return results
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        if pmid_el is None or pmid_el.text is None:
            continue
        pmid = pmid_el.text
        data = {}

        # Structured abstract
        abstract_parts = {}
        for at in article.findall(".//AbstractText"):
            label = (at.get("Label") or "").lower()
            text = "".join(at.itertext()).strip()
            if label and text:
                abstract_parts[label] = text
        data["abstract_structured"] = json.dumps(abstract_parts) if abstract_parts else None

        # Author keywords
        keywords = [kw.text for kw in article.findall(".//Keyword") if kw.text]
        data["author_keywords"] = json.dumps(keywords) if keywords else None

        # Affiliations
        affiliations = list(set(
            aff.text for aff in article.findall(".//AffiliationInfo/Affiliation")
            if aff.text
        ))
        data["affiliations"] = json.dumps(affiliations) if affiliations else None

        # DOI
        doi = None
        for aid in article.findall(".//ArticleId"):
            if aid.get("IdType") == "doi" and aid.text:
                doi = aid.text
                break
        data["doi"] = doi

        # PMCID
        pmcid = None
        for aid in article.findall(".//ArticleId"):
            if aid.get("IdType") == "pmc" and aid.text:
                pmcid = aid.text
                break
        data["pmcid"] = pmcid

        # NCT IDs cited in abstract
        full_abstract = " ".join("".join(at.itertext()) for at in article.findall(".//AbstractText"))
        nct_ids = list(set(re.findall(r"NCT\d{8}", full_abstract)))
        data["nct_ids_cited"] = json.dumps(nct_ids) if nct_ids else None

        results[pmid] = data
    return results


def enrich_papers_efetch(conn, api_key=None):
    """Fetch structured metadata via EFETCH for papers not yet enriched."""
    cursor = conn.execute("SELECT pmid FROM pa_papers WHERE doi IS NULL")
    pmids = [row[0] for row in cursor.fetchall()]
    if not pmids:
        print("  All papers already enriched via EFETCH", flush=True)
        return

    print(f"  Enriching {len(pmids)} papers via EFETCH...", flush=True)
    delay = 0.1 if api_key else 0.35
    batch_size = 200

    for i in range(0, len(pmids), batch_size):
        batch = pmids[i:i + batch_size]
        params = {"db": "pubmed", "id": ",".join(batch), "retmode": "xml"}
        if api_key:
            params["api_key"] = api_key

        try:
            resp = requests.get(EFETCH, params=params, timeout=30)
            resp.raise_for_status()
            enrichments = parse_efetch_xml(resp.text)

            for pmid, data in enrichments.items():
                conn.execute("""
                    UPDATE pa_papers SET
                        abstract_structured = ?,
                        author_keywords = ?,
                        affiliations = ?,
                        doi = ?,
                        pmcid = ?,
                        nct_ids_cited = ?
                    WHERE pmid = ? AND doi IS NULL
                """, (
                    data["abstract_structured"], data["author_keywords"],
                    data["affiliations"], data["doi"], data["pmcid"],
                    data["nct_ids_cited"], pmid,
                ))
            conn.commit()
            print(f"    Enriched batch {i // batch_size + 1} ({len(enrichments)} papers)", flush=True)
        except Exception as e:
            print(f"    EFETCH batch error: {e}", flush=True)

        time.sleep(delay)


# ── Full Text & OA ──


def extract_fulltext_sections(xml_text):
    """Extract results, discussion, conclusion from PMC XML."""
    sections = {}
    try:
        root = ET.fromstring(xml_text)
        for sec in root.findall(".//sec"):
            sec_type = (sec.get("sec-type") or "").lower()
            title_el = sec.find("title")
            title = (title_el.text or "").lower() if title_el is not None else ""

            key = None
            if "result" in sec_type or "result" in title:
                key = "results"
            elif "discussion" in sec_type or "discussion" in title:
                key = "discussion"
            elif "conclusion" in sec_type or "conclusion" in title:
                key = "conclusion"

            if key and key not in sections:
                text = " ".join(sec.itertext()).strip()
                if len(text) > 50:
                    sections[key] = text[:10000]
    except Exception:
        pass
    return sections if sections else None


def fetch_pmc_fulltext(pmcid, api_key=None):
    """Fetch full text XML from PMC."""
    params = {"db": "pmc", "id": pmcid, "retmode": "xml"}
    if api_key:
        params["api_key"] = api_key
    try:
        resp = requests.get(EFETCH, params=params, timeout=30)
        resp.raise_for_status()
        return extract_fulltext_sections(resp.text)
    except Exception:
        return None


def fetch_europepmc_fulltext(pmcid):
    """Fetch full text XML from Europe PMC."""
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return extract_fulltext_sections(resp.text)
    except Exception:
        pass
    return None


def retrieve_full_texts(conn, api_key=None):
    """Waterfall: PMC -> Europe PMC -> Unpaywall HTML. Stop on first success."""
    cursor = conn.execute(
        "SELECT pmid, pmcid, oa_url FROM pa_papers WHERE full_text_sections IS NULL AND (pmcid IS NOT NULL OR oa_url IS NOT NULL)"
    )
    papers = cursor.fetchall()
    if not papers:
        print("  No papers need full text retrieval", flush=True)
        return

    print(f"  Attempting full text retrieval for {len(papers)} papers...", flush=True)
    delay = 0.1 if api_key else 0.35
    found = 0

    for pmid, pmcid, oa_url in papers:
        sections = None

        if pmcid and not sections:
            sections = fetch_pmc_fulltext(pmcid, api_key)
            time.sleep(delay)

        if pmcid and not sections:
            sections = fetch_europepmc_fulltext(pmcid)
            time.sleep(0.1)

        if not sections and oa_url and not oa_url.endswith(".pdf"):
            try:
                resp = requests.get(oa_url, timeout=15, headers={"User-Agent": "ClusterHeadacheHub/1.0"})
                if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
                    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", resp.text)
                    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                    if len(text) > 500:
                        sections = {"full_text": text[:20000]}
            except Exception:
                pass
            time.sleep(1)

        if sections:
            conn.execute(
                "UPDATE pa_papers SET full_text_sections = ? WHERE pmid = ?",
                (json.dumps(sections), pmid),
            )
            found += 1

    conn.commit()
    print(f"  Retrieved full text for {found}/{len(papers)} papers", flush=True)


def fetch_unpaywall_status(conn):
    """Fetch OA status from Unpaywall for papers with DOI."""
    cursor = conn.execute(
        "SELECT pmid, doi FROM pa_papers WHERE doi IS NOT NULL AND oa_status IS NULL"
    )
    papers = cursor.fetchall()
    if not papers:
        print("  All papers already have OA status", flush=True)
        return

    print(f"  Fetching Unpaywall OA status for {len(papers)} papers...", flush=True)
    found = 0
    for pmid, doi in papers:
        try:
            resp = requests.get(
                f"https://api.unpaywall.org/v2/{doi}",
                params={"email": "ville.vuori@willba.app"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                is_oa = 1 if data.get("is_oa") else 0
                oa_url = None
                best_loc = data.get("best_oa_location")
                if best_loc:
                    oa_url = best_loc.get("url_for_landing_page") or best_loc.get("url")
                oa_status = data.get("oa_status", "closed")
                conn.execute(
                    "UPDATE pa_papers SET is_oa = ?, oa_url = ?, oa_status = ? WHERE pmid = ?",
                    (is_oa, oa_url, oa_status, pmid),
                )
                found += 1
        except Exception as e:
            print(f"    Unpaywall error for {doi}: {e}", flush=True)
        time.sleep(1)

    conn.commit()
    print(f"  Got OA status for {found}/{len(papers)} papers", flush=True)


# ── Enrichment ──

CATEGORY_PATTERNS = [
    ("psychedelic", r"psilocybin|lsd|lysergic|psychedel|ketamine|busting|dmt|5-meo"),
    ("cgrp", r"cgrp|galcanezumab|erenumab|eptinezumab|fremanezumab|rimegepant|gepant|calcitonin.gene"),
    ("oxygen", r"\boxygen\b|high.flow.o2|\bo2\b"),
    ("vitamin-d", r"vitamin.d|cholecalciferol|d3.regimen"),
    ("pharmacology", r"verapamil|lithium|melatonin|oxybate|predniso|corticosteroid|topiramate|valproat"),
    ("nerve-block", r"botulinum|block|occipital|sphenopalatine|ganglion|nerve.block|spg|bupivacaine"),
    ("neuromodulation", r"stimul|neuromod|vagus|vns|primus|deep.brain|non.invasive"),
    ("non-pharma", r"light|yoga|mind|exercise|behavior|acupuncture|biofeedback"),
    ("observational", r"observ|registry|survey|epidemiol|natural.history|cohort"),
]

# Patient-community validated treatments get higher relevance
CATEGORY_RELEVANCE = {
    "psychedelic": 1.0, "oxygen": 0.95, "vitamin-d": 0.9, "cgrp": 0.7,
    "nerve-block": 0.6, "neuromodulation": 0.6, "pharmacology": 0.5,
    "non-pharma": 0.5, "observational": 0.4, "other": 0.3,
}


def categorize(text):
    t = text.lower()
    for cat, pattern in CATEGORY_PATTERNS:
        if re.search(pattern, t):
            return cat
    return "other"


def enrich_paper(p):
    text = f"{p['title']} {p['abstract']} {' '.join(p['mesh_terms'])}"
    cat = categorize(text)
    score = CATEGORY_RELEVANCE.get(cat, 0.3)
    if p["abstract"]:
        score += 0.05
    year = 0
    try:
        year = int(p["pub_date"][:4])
    except (ValueError, TypeError):
        pass
    if year >= 2023:
        score += 0.1
    elif year >= 2020:
        score += 0.05
    return cat, min(score, 1.0)


def enrich_trial(t):
    text = f"{t['title']} {t['summary']} {t['interventions']} {t['conditions']}"
    cat = categorize(text)
    score = CATEGORY_RELEVANCE.get(cat, 0.3)
    if t["status"] == "RECRUITING":
        score += 0.15
    elif t["status"] == "ACTIVE_NOT_RECRUITING":
        score += 0.1
    elif t["status"] == "NOT_YET_RECRUITING":
        score += 0.12
    elif t["status"] == "COMPLETED":
        score += 0.05
    phases = json.loads(t["phase"]) if t["phase"] else []
    if any("3" in p for p in phases):
        score += 0.1
    elif any("2" in p for p in phases):
        score += 0.05
    return cat, min(score, 1.0)


# ── Database ──

SCHEMA = """
CREATE TABLE IF NOT EXISTS pa_papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  abstract TEXT,
  abstract_structured TEXT,
  mesh_terms TEXT,
  author_keywords TEXT,
  affiliations TEXT,
  doi TEXT,
  pmcid TEXT,
  full_text_sections TEXT,
  nct_ids_cited TEXT,
  is_oa INTEGER,
  oa_url TEXT,
  oa_status TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_pa_papers_category ON pa_papers(category);
CREATE INDEX IF NOT EXISTS idx_pa_papers_pub_date ON pa_papers(pub_date);
CREATE INDEX IF NOT EXISTS idx_pa_papers_doi ON pa_papers(doi);

CREATE TABLE IF NOT EXISTS tr_trials (
  nct_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,
  study_type TEXT,
  sponsor TEXT,
  enrollment INTEGER,
  start_date TEXT,
  end_date TEXT,
  interventions TEXT,
  summary TEXT,
  conditions TEXT,
  category TEXT,
  relevance_score REAL,
  last_updated TEXT,
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_tr_trials_category ON tr_trials(category);
CREATE INDEX IF NOT EXISTS idx_tr_trials_status ON tr_trials(status);

CREATE TABLE IF NOT EXISTS rs_stats (
  key TEXT PRIMARY KEY,
  value TEXT
);
"""


def build_db(db_path, papers, trials):
    """Write enriched data to SQLite."""
    print(f"Building database at {db_path}...", flush=True)
    now = __import__("datetime").datetime.utcnow().isoformat()

    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)

    # Clear research tables only (preserve analysis tables)
    conn.execute("DELETE FROM pa_papers")
    conn.execute("DELETE FROM tr_trials")
    conn.execute("DELETE FROM rs_stats")

    # Insert papers
    for p in papers:
        cat, score = enrich_paper(p)
        conn.execute(
            """INSERT OR REPLACE INTO pa_papers
               (pmid, title, authors, journal, pub_date, abstract, mesh_terms, category, relevance_score, last_updated)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (p["pmid"], p["title"], p["authors"], p["journal"], p["pub_date"],
             p["abstract"], json.dumps(p["mesh_terms"]), cat, score, now),
        )
    print(f"  Inserted {len(papers)} papers", flush=True)

    # Insert trials
    for t in trials:
        cat, score = enrich_trial(t)
        conn.execute(
            "INSERT OR REPLACE INTO tr_trials VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (t["nct_id"], t["title"], t["status"], t["phase"], t["study_type"],
             t["sponsor"], t["enrollment"], t["start_date"], t["end_date"],
             t["interventions"], t["summary"], t["conditions"], cat, score, now,
             t["raw_json"]),
        )
    print(f"  Inserted {len(trials)} trials", flush=True)

    # Metadata
    conn.execute("INSERT INTO rs_stats VALUES (?, ?)", ("last_run", now))
    conn.execute("INSERT INTO rs_stats VALUES (?, ?)", ("paper_count", str(len(papers))))
    conn.execute("INSERT INTO rs_stats VALUES (?, ?)", ("trial_count", str(len(trials))))

    cat_counts = {}
    for p in papers:
        cat, _ = enrich_paper(p)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    conn.execute("INSERT INTO rs_stats VALUES (?, ?)", ("paper_categories", json.dumps(cat_counts)))

    conn.commit()

    # Phase B: EFETCH enrichment
    api_key = os.environ.get("NCBI_API_KEY")
    enrich_papers_efetch(conn, api_key)

    # Phase C: Full text retrieval
    retrieve_full_texts(conn, api_key)

    # Phase D: Unpaywall OA status
    fetch_unpaywall_status(conn)

    conn.close()
    print("  Done", flush=True)


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="Research Data Pipeline")
    parser.add_argument("--db", default=DEFAULT_DB, help="Output database path")
    parser.add_argument("--skip-papers", action="store_true")
    parser.add_argument("--skip-trials", action="store_true")
    args = parser.parse_args()

    print("=== Research Data Pipeline (Python) ===\n", flush=True)
    start = time.time()

    papers = [] if args.skip_papers else fetch_papers()
    trials = [] if args.skip_trials else fetch_trials()

    build_db(args.db, papers, trials)

    elapsed = time.time() - start
    active = [t for t in trials if t["status"] in ("RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING")]
    with_abs = sum(1 for p in papers if p["abstract"])

    print(f"\n=== Pipeline complete in {elapsed:.1f}s ===", flush=True)
    print(f"  Papers: {len(papers)} ({with_abs} with abstracts)", flush=True)
    print(f"  Trials: {len(trials)} ({len(active)} active)", flush=True)


if __name__ == "__main__":
    main()
