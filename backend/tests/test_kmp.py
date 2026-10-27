import pytest
from app.data_structures.kmp import compute_lps_table, kmp_search, scan_clinical_text


def test_compute_lps_table_classic_patterns():
    """Verify LPS table construction across textbook and benchmark strings."""
    # Classic KMP benchmark: "ABABCABAB"
    assert compute_lps_table("ABABCABAB") == [0, 0, 1, 2, 0, 1, 2, 3, 4]

    # Monotonically repeating characters: "AAAA"
    assert compute_lps_table("AAAA") == [0, 1, 2, 3]

    # Knuth, Morris, Pratt original paper example: "ABCDABD"
    assert compute_lps_table("ABCDABD") == [0, 0, 0, 0, 1, 2, 0]

    # Single character and empty strings
    assert compute_lps_table("A") == [0]
    assert compute_lps_table("") == []


def test_kmp_search_exact_clinical_sentences():
    """Verify finding single and multiple occurrences in clinical sentences."""
    clinical_note = (
        "Patient has severe Penicillin allergy. Previous reaction to Penicillin was acute facial edema."
    )
    matches = kmp_search(clinical_note, "Penicillin", case_sensitive=True)
    assert len(matches) == 2
    assert matches[0] == 19
    assert matches[1] == 60
    assert clinical_note[matches[0] : matches[0] + len("Penicillin")] == "Penicillin"
    assert clinical_note[matches[1] : matches[1] + len("Penicillin")] == "Penicillin"

    # Multi-word phrase search
    symptom_note = "Evaluated for chronic shortness of breath and nocturnal cough."
    phrase_matches = kmp_search(symptom_note, "shortness of breath", case_sensitive=True)
    assert phrase_matches == [22]
    assert symptom_note[22 : 22 + len("shortness of breath")] == "shortness of breath"


def test_kmp_case_insensitivity():
    """Verify case-insensitive search normalization."""
    text = "Latex gloves caused severe rash; latex-free surgical equipment strictly required."

    # Case-insensitive matches both 'Latex' and 'latex'
    matches_ci = kmp_search(text, "LATEX", case_sensitive=False)
    assert len(matches_ci) == 2
    assert matches_ci[0] == 0
    assert matches_ci[1] == 33

    # Case-sensitive matches neither
    matches_cs = kmp_search(text, "LATEX", case_sensitive=True)
    assert matches_cs == []


def test_kmp_overlapping_patterns():
    """Verify overlapping pattern detection via lps[j - 1] transitions."""
    # 'aba' in 'ababa' (overlaps at indices 0 and 2)
    assert kmp_search("ababa", "aba") == [0, 2]

    # 'ana' in 'banana' (overlaps at indices 1 and 3)
    assert kmp_search("banana", "ana") == [1, 3]

    # 'aa' in 'aaaa' (matches at indices 0, 1, 2)
    assert kmp_search("aaaa", "aa") == [0, 1, 2]


def test_kmp_edge_cases():
    """Verify absent patterns, empty strings, and length-boundary conditions."""
    text = "Patient denies history of fever, chills, or headache."

    # Pattern not present
    assert kmp_search(text, "aspirin") == []

    # Empty pattern or whitespace-only
    assert kmp_search(text, "") == []
    assert kmp_search(text, "   ") == []

    # Empty text
    assert kmp_search("", "penicillin") == []

    # Pattern longer than text
    assert kmp_search("short", "much longer pattern than text") == []


def test_scan_clinical_text_snippets_and_safety_notice():
    """Verify snippet generation, multi-keyword aggregation, and clinical safety notice."""
    report = (
        "Patient diagnosed with acute bacterial bronchitis. Known history of Penicillin allergy. "
        "Complains of high fever and persistent chest tightness."
    )
    keywords = ["Penicillin", "fever", "Latex"]

    result = scan_clinical_text(report, keywords, context_window=30)

    # 1. Mandatory safety disclaimer verification
    assert "safety_notice" in result
    assert result["safety_notice"] == "Potential keyword match — clinician review required."

    # 2. Overall counts
    assert result["total_matches"] == 2
    assert len(result["all_matches"]) == 2

    # 3. Keyword breakdown
    by_kw = result["matches_by_keyword"]
    assert "Penicillin" in by_kw
    assert len(by_kw["Penicillin"]) == 1
    assert by_kw["Penicillin"][0]["matched_text"] == "Penicillin"
    assert "Penicillin" in by_kw["Penicillin"][0]["snippet"]
    assert len(by_kw["Penicillin"][0]["lps_table"]) == len("Penicillin")

    assert "fever" in by_kw
    assert len(by_kw["fever"]) == 1

    assert "Latex" in by_kw
    assert len(by_kw["Latex"]) == 0

    # 4. Chronological order of matches
    assert result["all_matches"][0]["keyword"] == "Penicillin"
    assert result["all_matches"][1]["keyword"] == "fever"
    assert result["all_matches"][0]["start_index"] < result["all_matches"][1]["start_index"]
