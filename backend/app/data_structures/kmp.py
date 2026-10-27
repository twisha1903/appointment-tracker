"""Knuth-Morris-Pratt (KMP) Pattern Matching Algorithm for Clinical Text & Allergy Screening.

ADS Syllabus Reference:
- Unit 5: Text Processing — Pattern Matching, Failure Function (LPS / π array),
  Linear-Time String Searching Without Backtracking.

Theoretical Complexity:
- Preprocessing (LPS Table Construction):
    O(M) time and O(M) space, where M is pattern length.
- Search Phase:
    O(N) time where N is text length. The text pointer 'i' monotonically advances
    from 0 to N-1 and is NEVER decremented (no backtracking).
- Total Single-Pattern Complexity:
    O(N + M) time and O(M) auxiliary space.
- Multi-Keyword Scanning:
    Scanning K clinical keywords across a document of length N takes:
    O(sum_{k=1}^K (N + M_k)) time.
"""

from typing import Any, Dict, List, Optional


def compute_lps_table(pattern: str) -> List[int]:
    """Compute Longest Proper Prefix which is also a Suffix (LPS / π) table.

    lps[i] stores the length of the longest proper prefix of pattern[0..i]
    that is also a suffix of pattern[0..i].

    Time Complexity:  O(M) where M is len(pattern)
    Space Complexity: O(M)
    """
    m = len(pattern)
    if m == 0:
        return []

    lps = [0] * m
    length = 0  # Length of the previous longest prefix suffix
    i = 1

    while i < m:
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        else:
            if length != 0:
                # Fall back to length of the previous matching prefix
                length = lps[length - 1]
            else:
                lps[i] = 0
                i += 1

    return lps


def kmp_search(text: str, pattern: str, case_sensitive: bool = False) -> List[int]:
    """Search for all occurrences of pattern in text using the KMP algorithm.

    Returns a list of 0-based starting character indices where pattern begins.
    Overlapping matches are captured cleanly via lps[j - 1] transitions.

    Pure algorithmic implementation:
    No Python 'in', 'str.find', 'str.index', or 're' is used.
    """
    if not pattern or not pattern.strip():
        return []
    if not text:
        return []

    norm_pattern = pattern if case_sensitive else pattern.lower()
    norm_text = text if case_sensitive else text.lower()

    n = len(norm_text)
    m = len(norm_pattern)

    if m > n:
        return []

    lps = compute_lps_table(norm_pattern)
    matches: List[int] = []

    i = 0  # Index for text (advances monotonically, never decrements)
    j = 0  # Index for pattern

    while i < n:
        if norm_text[i] == norm_pattern[j]:
            i += 1
            j += 1

            if j == m:
                # Full pattern match located at text index (i - j)
                matches.append(i - j)
                # Transition j to previous longest prefix-suffix to detect overlapping occurrences
                j = lps[j - 1]
        else:
            if j != 0:
                # Do not advance i; shift pattern alignment using LPS table
                j = lps[j - 1]
            else:
                # No prefix matched; advance text pointer
                i += 1

    return matches


def scan_clinical_text(
    text: str,
    keywords: List[str],
    context_window: int = 45,
    case_sensitive: bool = False,
) -> Dict[str, Any]:
    """Scan medical notes or allergy text for multiple clinical keywords using KMP.

    For each match, extracts:
    - 0-based start and end character positions
    - Exact matched substring
    - Surrounding clinical context snippet
    - Computed LPS table (for educational inspection & viva demonstration)
    - Mandatory clinical disclaimer banner
    """
    MANDATORY_SAFETY_NOTICE = "Potential keyword match — clinician review required."

    matches_by_keyword: Dict[str, List[Dict[str, Any]]] = {}
    all_matches: List[Dict[str, Any]] = []
    total_matches = 0

    if not text:
        return {
            "safety_notice": MANDATORY_SAFETY_NOTICE,
            "total_matches": 0,
            "matches_by_keyword": {},
            "all_matches": [],
        }

    for raw_keyword in keywords:
        clean_kw = raw_keyword.strip()
        if not clean_kw:
            continue

        lps = compute_lps_table(clean_kw if case_sensitive else clean_kw.lower())
        indices = kmp_search(text, clean_kw, case_sensitive=case_sensitive)

        kw_matches: List[Dict[str, Any]] = []
        kw_len = len(clean_kw)

        for start_idx in indices:
            end_idx = start_idx + kw_len
            matched_substr = text[start_idx:end_idx]

            # Generate contextual preview snippet around match
            snippet_start = max(0, start_idx - context_window)
            snippet_end = min(len(text), end_idx + context_window)
            prefix_ellipsis = "..." if snippet_start > 0 else ""
            suffix_ellipsis = "..." if snippet_end < len(text) else ""
            snippet = f"{prefix_ellipsis}{text[snippet_start:snippet_end]}{suffix_ellipsis}"

            match_info = {
                "keyword": clean_kw,
                "start_index": start_idx,
                "end_index": end_idx,
                "matched_text": matched_substr,
                "snippet": snippet,
                "lps_table": lps,
            }
            kw_matches.append(match_info)
            all_matches.append(match_info)
            total_matches += 1

        matches_by_keyword[clean_kw] = kw_matches

    # Sort all matches chronologically by their appearance in the text
    all_matches.sort(key=lambda m: m["start_index"])

    return {
        "safety_notice": MANDATORY_SAFETY_NOTICE,
        "total_matches": total_matches,
        "matches_by_keyword": matches_by_keyword,
        "all_matches": all_matches,
    }
