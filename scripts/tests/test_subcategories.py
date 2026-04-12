"""Tests for build_subcategories in analyze-research.py."""

import json
import sqlite3
import sys
import os

import importlib.util

import pytest

# Import build_subcategories from analyze-research.py (hyphenated filename)
_spec = importlib.util.spec_from_file_location(
    "analyze_research",
    os.path.join(os.path.dirname(__file__), "..", "analyze-research.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
build_subcategories = _mod.build_subcategories


def create_test_db():
    """Create an in-memory SQLite DB with minimal schema for testing."""
    conn = sqlite3.connect(":memory:")

    conn.execute("""
        CREATE TABLE pa_papers (
            pmid TEXT PRIMARY KEY,
            title TEXT,
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
        )
    """)

    conn.execute("""
        CREATE TABLE pa_analyses (
            pmid TEXT PRIMARY KEY,
            outcome TEXT,
            plain_summary TEXT,
            key_finding TEXT,
            sample_size INTEGER,
            study_type TEXT,
            evidence_tier INTEGER,
            interventions_studied TEXT,
            analysis_source TEXT DEFAULT 'ai',
            primary_interventions TEXT,
            comparator_interventions TEXT,
            topics TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE tr_trials (
            nct_id TEXT PRIMARY KEY,
            title TEXT,
            status TEXT,
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
            relevance_score REAL
        )
    """)

    return conn


def insert_paper(conn, pmid, category, mesh_terms=None, keywords=None):
    """Helper to insert a paper with minimal required fields."""
    conn.execute(
        "INSERT INTO pa_papers (pmid, category, mesh_terms, author_keywords) VALUES (?, ?, ?, ?)",
        (pmid, category, json.dumps(mesh_terms or []), json.dumps(keywords or [])),
    )


def insert_analysis(conn, pmid, primary=None, comparator=None, topics=None):
    """Helper to insert an AI analysis for a paper."""
    conn.execute(
        "INSERT INTO pa_analyses (pmid, analysis_source, primary_interventions, comparator_interventions, topics) VALUES (?, 'ai', ?, ?, ?)",
        (pmid, json.dumps(primary or []), json.dumps(comparator or []), json.dumps(topics or [])),
    )


def insert_trial(conn, nct_id, category, interventions=None):
    """Helper to insert a trial."""
    conn.execute(
        "INSERT INTO tr_trials (nct_id, category, interventions) VALUES (?, ?, ?)",
        (nct_id, category, json.dumps(interventions or [])),
    )


def get_subcategories(conn, category=None):
    """Read rs_subcategories results as dicts."""
    if category:
        rows = conn.execute(
            "SELECT term, paper_count, trial_count, search_terms FROM rs_subcategories WHERE category = ? ORDER BY paper_count + trial_count DESC",
            (category,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT category, term, paper_count, trial_count, search_terms FROM rs_subcategories ORDER BY category, paper_count + trial_count DESC"
        ).fetchall()

    if category:
        return [{"term": r[0], "papers": r[1], "trials": r[2], "search": json.loads(r[3])} for r in rows]
    return [{"cat": r[0], "term": r[1], "papers": r[2], "trials": r[3], "search": json.loads(r[4])} for r in rows]


class TestPrimaryCategoryAssignment:
    """Terms should be assigned to the category where they appear most."""

    def test_term_goes_to_highest_count_category(self):
        conn = create_test_db()

        # Psilocybin: 5 papers in psychedelic, 1 in pharmacology
        for i in range(5):
            insert_paper(conn, f"psy-{i}", "psychedelic", keywords=["psilocybin"])
            insert_analysis(conn, f"psy-{i}", primary=["Psilocybin"])

        insert_paper(conn, "pharm-1", "pharmacology", keywords=["psilocybin"])
        insert_analysis(conn, "pharm-1", primary=["Psilocybin"])

        conn.commit()
        build_subcategories(conn)

        psychedelic = get_subcategories(conn, "psychedelic")
        pharmacology = get_subcategories(conn, "pharmacology")

        assert any(s["term"] == "Psilocybin" for s in psychedelic), "Psilocybin should be in psychedelic"
        assert not any(s["term"] == "Psilocybin" for s in pharmacology), "Psilocybin should NOT be in pharmacology"

    def test_different_terms_different_categories(self):
        conn = create_test_db()

        # Verapamil: 3 in pharmacology
        for i in range(3):
            insert_paper(conn, f"v-{i}", "pharmacology", keywords=["verapamil"])
            insert_analysis(conn, f"v-{i}", primary=["Verapamil"])

        # LSD: 3 in psychedelic
        for i in range(3):
            insert_paper(conn, f"l-{i}", "psychedelic", keywords=["lsd"])
            insert_analysis(conn, f"l-{i}", primary=["LSD"])

        conn.commit()
        build_subcategories(conn)

        pharm = get_subcategories(conn, "pharmacology")
        psych = get_subcategories(conn, "psychedelic")

        pharm_terms = [s["term"] for s in pharm]
        psych_terms = [s["term"] for s in psych]

        assert "Verapamil" in pharm_terms
        assert "LSD" in psych_terms
        assert "Verapamil" not in psych_terms
        assert "LSD" not in pharm_terms


class TestCrossCategoryPrevention:
    """Comparator/context terms should not leak into other categories."""

    def test_comparator_not_counted_as_primary(self):
        conn = create_test_db()

        # Paper studies Psilocybin, mentions Verapamil as comparator
        insert_paper(conn, "p1", "psychedelic", keywords=["psilocybin", "verapamil"])
        insert_analysis(conn, "p1", primary=["Psilocybin"], comparator=["Verapamil"])

        # Verapamil has its own papers in pharmacology
        insert_paper(conn, "p2", "pharmacology", keywords=["verapamil"])
        insert_analysis(conn, "p2", primary=["Verapamil"])

        conn.commit()
        build_subcategories(conn)

        psych = get_subcategories(conn, "psychedelic")
        psych_terms = [s["term"] for s in psych]

        # Verapamil should NOT appear in psychedelic — it was only a comparator there
        assert "Verapamil" not in psych_terms
        assert "Psilocybin" in psych_terms

    def test_topic_terms_from_observational(self):
        conn = create_test_db()

        # Observational paper about sleep
        insert_paper(conn, "obs1", "observational", keywords=["sleep"])
        insert_analysis(conn, "obs1", primary=[], topics=["Sleep"])

        # Pharmacology paper that also mentions sleep
        insert_paper(conn, "pharm1", "pharmacology", keywords=["sleep", "melatonin"])
        insert_analysis(conn, "pharm1", primary=["Melatonin"], topics=["Sleep"])

        conn.commit()
        build_subcategories(conn)

        obs = get_subcategories(conn, "observational")
        obs_terms = [s["term"] for s in obs]

        # Sleep count: 1 in observational, 1 in pharmacology — tie goes to first alphabetically
        # But Melatonin should be in pharmacology
        pharm = get_subcategories(conn, "pharmacology")
        pharm_terms = [s["term"] for s in pharm]
        assert "Melatonin" in pharm_terms


class TestSearchTerms:
    """search_terms should map raw MeSH/keywords to canonical names."""

    def test_raw_mesh_terms_included(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "psychedelic",
                     mesh_terms=["Lysergic Acid Diethylamide", "Cluster Headache"],
                     keywords=["lsd"])
        insert_analysis(conn, "p1", primary=["LSD"])

        conn.commit()
        build_subcategories(conn)

        psych = get_subcategories(conn, "psychedelic")
        lsd = next(s for s in psych if s["term"] == "LSD")

        # search_terms should include both the raw MeSH term and the keyword
        assert "lysergic acid diethylamide" in lsd["search"]
        assert "lsd" in lsd["search"]

    def test_canonical_name_always_in_search_terms(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "pharmacology", mesh_terms=["Verapamil"])
        insert_analysis(conn, "p1", primary=["Verapamil"])

        conn.commit()
        build_subcategories(conn)

        pharm = get_subcategories(conn, "pharmacology")
        verap = next(s for s in pharm if s["term"] == "Verapamil")

        assert "verapamil" in verap["search"]


class TestTrialNormalization:
    """Trial interventions should match against known canonical names from papers."""

    def test_exact_match(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "psychedelic", keywords=["psilocybin"])
        insert_analysis(conn, "p1", primary=["Psilocybin"])
        insert_trial(conn, "NCT001", "psychedelic", interventions=["Psilocybin", "Placebo"])

        conn.commit()
        build_subcategories(conn)

        psych = get_subcategories(conn, "psychedelic")
        psilo = next(s for s in psych if s["term"] == "Psilocybin")

        assert psilo["papers"] == 1
        assert psilo["trials"] == 1

    def test_substring_match(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "psychedelic", keywords=["lsd"])
        insert_analysis(conn, "p1", primary=["LSD"])
        insert_trial(conn, "NCT002", "psychedelic", interventions=["LSD tartrate"])

        conn.commit()
        build_subcategories(conn)

        psych = get_subcategories(conn, "psychedelic")
        lsd = next(s for s in psych if s["term"] == "LSD")

        assert lsd["papers"] == 1
        assert lsd["trials"] == 1, "LSD tartrate should match canonical name LSD via substring"

    def test_unmatched_trial_intervention_not_counted(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "psychedelic", keywords=["psilocybin"])
        insert_analysis(conn, "p1", primary=["Psilocybin"])
        # Trial with intervention that doesn't match any known canonical name
        insert_trial(conn, "NCT003", "psychedelic", interventions=["Novel Compound XYZ"])

        conn.commit()
        build_subcategories(conn)

        all_subs = get_subcategories(conn)
        terms = [s["term"] for s in all_subs]
        assert "Novel Compound XYZ" not in terms
        assert "Novel Compound Xyz" not in terms


class TestEdgeCases:
    """Edge cases and error handling."""

    def test_no_ai_analyses_skips_gracefully(self):
        conn = create_test_db()
        insert_paper(conn, "p1", "pharmacology")
        conn.commit()

        build_subcategories(conn)

        # Table exists but is empty
        count = conn.execute("SELECT COUNT(*) FROM rs_subcategories").fetchone()[0]
        assert count == 0

    def test_empty_primary_interventions(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "observational", keywords=["epidemiology"])
        insert_analysis(conn, "p1", primary=[], topics=["Epidemiology"])

        conn.commit()
        build_subcategories(conn)

        obs = get_subcategories(conn, "observational")
        assert any(s["term"] == "Epidemiology" for s in obs)

    def test_malformed_json_handled(self):
        conn = create_test_db()

        insert_paper(conn, "p1", "pharmacology", mesh_terms=["Verapamil"])
        # Insert analysis with malformed JSON
        conn.execute(
            "INSERT INTO pa_analyses (pmid, analysis_source, primary_interventions) VALUES (?, 'ai', ?)",
            ("p1", "not valid json"),
        )
        conn.commit()

        # Should not raise
        build_subcategories(conn)

    def test_paper_counts_match(self):
        conn = create_test_db()

        # 3 papers with Verapamil as primary
        for i in range(3):
            insert_paper(conn, f"v-{i}", "pharmacology",
                         mesh_terms=["Verapamil", "Calcium Channel Blockers"])
            insert_analysis(conn, f"v-{i}", primary=["Verapamil"])

        conn.commit()
        build_subcategories(conn)

        pharm = get_subcategories(conn, "pharmacology")
        verap = next(s for s in pharm if s["term"] == "Verapamil")

        assert verap["papers"] == 3, "Paper count should match number of papers with Verapamil as primary"
