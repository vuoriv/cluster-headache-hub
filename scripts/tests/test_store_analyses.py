"""Tests for store_analyses in analyze-research.py."""

import os
import sqlite3

import importlib.util

# Import store_analyses from analyze-research.py (hyphenated filename)
_spec = importlib.util.spec_from_file_location(
    "analyze_research",
    os.path.join(os.path.dirname(__file__), "..", "analyze-research.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
store_analyses = _mod.store_analyses


def create_full_schema_db(path):
    """Create a DB with the 13-column pa_analyses schema as shipped in
    public/data.db (base columns + the ones llm-analyze.py adds)."""
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE pa_analyses (
            pmid TEXT PRIMARY KEY,
            study_type TEXT,
            result TEXT,
            sample_size INTEGER,
            evidence_tier INTEGER,
            analysis_source TEXT DEFAULT 'regex',
            outcome TEXT,
            plain_summary TEXT,
            key_finding TEXT,
            interventions_studied TEXT,
            primary_interventions TEXT,
            comparator_interventions TEXT,
            topics TEXT
        )
    """)
    conn.commit()
    conn.close()


def paper(pmid, study_type="rct", result="positive", sample_size=10, tier=1):
    return {
        "pmid": pmid,
        "study_type": study_type,
        "result": result,
        "sample_size": sample_size,
        "evidence_tier": tier,
    }


def test_insert_into_13_column_schema(tmp_path):
    """Regression: weekly pipeline crashed with 'table pa_analyses has 13
    columns but 6 values were supplied' against the shipped data.db."""
    db = str(tmp_path / "full.db")
    create_full_schema_db(db)

    store_analyses(db, [paper("100"), paper("200")])

    conn = sqlite3.connect(db)
    rows = conn.execute(
        "SELECT pmid, analysis_source FROM pa_analyses ORDER BY pmid"
    ).fetchall()
    conn.close()
    assert rows == [("100", "regex"), ("200", "regex")]


def test_preserves_ai_analyses(tmp_path):
    """AI-analyzed rows must survive the weekly regex refresh — llm-analyze.py
    skips already-analyzed papers, so deleting them would lose the analyses."""
    db = str(tmp_path / "ai.db")
    create_full_schema_db(db)
    conn = sqlite3.connect(db)
    conn.execute(
        "INSERT INTO pa_analyses (pmid, study_type, evidence_tier, analysis_source, outcome, plain_summary, topics) "
        "VALUES ('100', 'rct', 1, 'ai-batch', 'positive', 'A helpful summary', '[\"oxygen\"]')"
    )
    conn.commit()
    conn.close()

    store_analyses(db, [paper("100", study_type="other", result="unknown"), paper("200")])

    conn = sqlite3.connect(db)
    ai_row = conn.execute(
        "SELECT analysis_source, study_type, outcome, plain_summary, topics "
        "FROM pa_analyses WHERE pmid = '100'"
    ).fetchone()
    new_row = conn.execute(
        "SELECT analysis_source FROM pa_analyses WHERE pmid = '200'"
    ).fetchone()
    conn.close()

    assert ai_row == ("ai-batch", "rct", "positive", "A helpful summary", '["oxygen"]')
    assert new_row == ("regex",)


def test_refreshes_stale_regex_analyses(tmp_path):
    """Regex rows are re-derived each run: stale ones replaced, absent ones removed."""
    db = str(tmp_path / "stale.db")
    create_full_schema_db(db)
    conn = sqlite3.connect(db)
    conn.execute(
        "INSERT INTO pa_analyses (pmid, study_type, result, analysis_source) "
        "VALUES ('100', 'case-report', 'negative', 'regex'), "
        "('999', 'other', 'unknown', 'regex')"
    )
    conn.commit()
    conn.close()

    store_analyses(db, [paper("100", study_type="rct", result="positive")])

    conn = sqlite3.connect(db)
    rows = conn.execute(
        "SELECT pmid, study_type, result FROM pa_analyses ORDER BY pmid"
    ).fetchall()
    conn.close()
    assert rows == [("100", "rct", "positive")]


def test_fresh_db_gets_base_schema(tmp_path):
    """On a brand-new DB the function creates the table itself and inserts."""
    db = str(tmp_path / "fresh.db")

    store_analyses(db, [paper("100")])

    conn = sqlite3.connect(db)
    rows = conn.execute("SELECT pmid, analysis_source FROM pa_analyses").fetchall()
    conn.close()
    assert rows == [("100", "regex")]
