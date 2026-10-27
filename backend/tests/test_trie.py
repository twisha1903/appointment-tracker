import pytest
from app.data_structures.trie import PatientNameTrie, TrieNode


def test_trie_prefix_matching_lengths():
    """Verify prefix queries for 1-char, 3-char, and exact full-name searches."""
    trie = PatientNameTrie()
    trie.insert("Aarav Sharma", "PT-1001")
    trie.insert("Ananya Iyer", "PT-1002")
    trie.insert("Arjun Nair", "PT-1003")

    # 1-character query: 'a' should match all three
    results_1char = trie.search_prefix("a")
    assert set(results_1char) == {"PT-1001", "PT-1002", "PT-1003"}

    # 3-character query: 'aar' should match only Aarav Sharma
    results_3char = trie.search_prefix("aar")
    assert results_3char == ["PT-1001"]

    # Exact full name query
    results_full = trie.search_prefix("aarav sharma")
    assert results_full == ["PT-1001"]


def test_case_and_whitespace_normalization():
    """Verify case-insensitivity, irregular whitespace collapse, and token matching."""
    trie = PatientNameTrie()
    trie.insert("   AARAV    sharma  ", "PT-1001")

    # Lowercase prefix
    assert trie.search_prefix("aarav") == ["PT-1001"]

    # Mixed-case prefix with surrounding spaces
    assert trie.search_prefix("  AaRaV   ") == ["PT-1001"]

    # Surname token query (case-insensitive)
    assert trie.search_prefix("SHARMA") == ["PT-1001"]
    assert trie.search_prefix("shar") == ["PT-1001"]


def test_duplicate_patient_names():
    """Verify multiple patients sharing identical names are both preserved without overwriting."""
    trie = PatientNameTrie()
    trie.insert("Aarav Sharma", "PT-1001")
    trie.insert("Aarav Sharma", "PT-1002")

    # Both patient IDs must be returned
    matches = trie.search_prefix("aarav")
    assert len(matches) == 2
    assert "PT-1001" in matches
    assert "PT-1002" in matches

    # Remove only the first patient
    assert trie.remove("Aarav Sharma", "PT-1001") is True

    # Second patient should still be indexed
    matches_after = trie.search_prefix("aarav")
    assert matches_after == ["PT-1002"]

    # Remove second patient
    assert trie.remove("Aarav Sharma", "PT-1002") is True
    assert trie.search_prefix("aarav") == []


def test_update_and_rename_patient():
    """Verify renaming unlinks old name paths and registers new name paths."""
    trie = PatientNameTrie()
    trie.insert("Rohan Sharma", "PT-1003")

    assert trie.search_prefix("rohan") == ["PT-1003"]
    assert trie.search_prefix("sharma") == ["PT-1003"]

    # Rename patient from Rohan Sharma to Rohan Verma
    trie.update("Rohan Sharma", "Rohan Verma", "PT-1003")

    # Old surname token should no longer match
    assert trie.search_prefix("sharma") == []

    # New surname token should match
    assert trie.search_prefix("verma") == ["PT-1003"]

    # First name should continue matching
    assert trie.search_prefix("rohan") == ["PT-1003"]


def test_prefix_sharing_and_clean_node_pruning():
    """Verify deleting a name prunes unshared nodes without corrupting shared prefix branches."""
    trie = PatientNameTrie()
    trie.insert("Rohan", "PT-1001")
    trie.insert("Rohit", "PT-1002")

    stats_before = trie.get_stats()
    # 'r' -> 'o' -> 'h' -> ('a'->'n' for Rohan) and ('i'->'t' for Rohit)
    assert trie.search_prefix("roh") == ["PT-1001", "PT-1002"]

    # Delete Rohan
    assert trie.remove("Rohan", "PT-1001") is True
    assert trie.search_prefix("rohan") == []

    # Rohit must remain completely intact
    assert trie.search_prefix("rohit") == ["PT-1002"]
    assert trie.search_prefix("roh") == ["PT-1002"]

    # Total nodes should have decreased due to pruning 'a' and 'n'
    stats_after = trie.get_stats()
    assert stats_after["total_nodes"] < stats_before["total_nodes"]


def test_edge_cases_and_result_limit():
    """Verify empty/whitespace strings, nonexistent prefixes, Unicode support, and limit enforcement."""
    trie = PatientNameTrie()

    # Empty and whitespace searches
    assert trie.search_prefix("") == []
    assert trie.search_prefix("   ") == []

    # Nonexistent prefix
    trie.insert("David Chen", "PT-1008")
    assert trie.search_prefix("xyz") == []

    # Unicode character handling
    trie.insert("Zoë Martin", "PT-1010")
    assert trie.search_prefix("zoë") == ["PT-1010"]
    assert trie.search_prefix("zo") == ["PT-1010"]

    # Result limit enforcement
    bulk_trie = PatientNameTrie()
    for i in range(1, 21):
        bulk_trie.insert(f"Patient {i:02d}", f"PT-20{i:02d}")

    # Search prefix 'patient' with limit 5
    limited_results = bulk_trie.search_prefix("patient", limit=5)
    assert len(limited_results) == 5

    # With default limit (10)
    default_results = bulk_trie.search_prefix("patient")
    assert len(default_results) == 10
