"""Standard Prefix Trie for Healthcare Patient Autocomplete.

ADS Syllabus Reference:
- Unit 5: Text Processing — Standard Tries, Character-by-Character Prefix Search.

Theoretical Complexity:
- Locating the Prefix Node:
    O(L) time, where L is the length of the query prefix.
- Subtree Collection:
    O(V + E) or O(K) where K is the number of nodes visited in the prefix subtree,
    plus O(M) to collect matching patient IDs up to the requested limit.
- Insertion:
    O(L) where L is the string length.
- Deletion / Pruning:
    O(L) where L is the string length.
- Space Complexity:
    O(Σ * N * L) worst-case (where Σ is the alphabet size and N is total keys),
    heavily amortized in practice through shared prefix compression.
"""

from typing import Dict, List, Optional, Set


class TrieNode:
    """Explicit node within the standard Prefix Trie."""

    def __init__(self):
        self.children: Dict[str, "TrieNode"] = {}
        self.is_end_of_word: bool = False
        self.patient_ids: Set[str] = set()

    def __repr__(self) -> str:
        return f"TrieNode(is_end={self.is_end_of_word}, ids={sorted(list(self.patient_ids))}, branches={len(self.children)})"


class PatientNameTrie:
    """Standard Character Trie for fast patient name prefix autocomplete.

    Features:
    - Case-insensitive, whitespace-normalized indexing.
    - Terminal nodes store sets of patient_ids to cleanly support duplicate names.
    - Indexes both full patient names (e.g., 'aarav sharma') and surname/word tokens (e.g., 'sharma')
      for clinical utility.
    - Recursive post-order pruning on removal to prevent dangling orphaned nodes.
    - Deterministic lexicographical prefix traversal.
    """

    def __init__(self):
        self.root: TrieNode = TrieNode()
        self._total_keys: int = 0

    def _normalize(self, text: str) -> str:
        """Strip whitespace, collapse internal spaces, and convert to lowercase."""
        if not text:
            return ""
        return " ".join(text.strip().split()).lower()

    def _get_index_keys(self, norm_name: str) -> List[str]:
        """Derive search keys from normalized name: full name plus secondary word tokens."""
        if not norm_name:
            return []
        keys = [norm_name]
        words = norm_name.split()
        if len(words) > 1:
            for w in words[1:]:
                if w and w not in keys:
                    keys.append(w)
        return keys

    def insert(self, full_name: str, patient_id: str) -> None:
        """Insert a patient name and associated patient_id into the Trie."""
        norm_name = self._normalize(full_name)
        if not norm_name or not patient_id:
            return

        index_keys = self._get_index_keys(norm_name)
        for key in index_keys:
            self._insert_path(key, patient_id)

        self._total_keys += 1

    def _insert_path(self, key: str, patient_id: str) -> None:
        """Traverse or construct nodes character by character for a specific key."""
        curr = self.root
        for char in key:
            if char not in curr.children:
                curr.children[char] = TrieNode()
            curr = curr.children[char]

        curr.is_end_of_word = True
        curr.patient_ids.add(patient_id)

    def remove(self, full_name: str, patient_id: str) -> bool:
        """Remove a patient_id from all indexed paths and prune dangling nodes."""
        norm_name = self._normalize(full_name)
        if not norm_name or not patient_id:
            return False

        index_keys = self._get_index_keys(norm_name)
        removed_any = False

        for key in index_keys:
            if self._remove_path(self.root, key, 0, patient_id):
                removed_any = True

        if removed_any and self._total_keys > 0:
            self._total_keys -= 1

        return removed_any

    def _remove_path(self, node: TrieNode, key: str, depth: int, patient_id: str) -> bool:
        """Recursively unlink patient_id and prune childless, non-terminal nodes."""
        if depth == len(key):
            if patient_id in node.patient_ids:
                node.patient_ids.discard(patient_id)
                if not node.patient_ids:
                    node.is_end_of_word = False
                return True
            return False

        char = key[depth]
        if char not in node.children:
            return False

        child = node.children[char]
        removed = self._remove_path(child, key, depth + 1, patient_id)

        # Prune child if it has no remaining children and is not an active terminal node
        if len(child.children) == 0 and not child.is_end_of_word:
            del node.children[char]

        return removed

    def update(self, old_name: str, new_name: str, patient_id: str) -> None:
        """Update a patient's indexed name by removing the old entry and inserting the new one."""
        self.remove(old_name, patient_id)
        self.insert(new_name, patient_id)

    def search_prefix(self, prefix: str, limit: int = 10) -> List[str]:
        """Search for patient IDs matching the given name prefix.

        Step 1: O(L) navigation to the prefix node (where L is prefix length).
        Step 2: Lexicographical DFS traversal across the subtree, collecting unique
                patient IDs in deterministic order until 'limit' is reached.
        """
        norm_prefix = self._normalize(prefix)
        if not norm_prefix or limit <= 0:
            return []

        # Step 1: Locate prefix node
        curr = self.root
        for char in norm_prefix:
            if char not in curr.children:
                return []
            curr = curr.children[char]

        # Step 2: Traverse subtree in sorted order for deterministic results
        results: List[str] = []
        seen_ids: Set[str] = set()

        def _dfs(node: TrieNode):
            if len(results) >= limit:
                return

            if node.is_end_of_word:
                for pid in sorted(node.patient_ids):
                    if pid not in seen_ids:
                        seen_ids.add(pid)
                        results.append(pid)
                        if len(results) >= limit:
                            return

            for ch in sorted(node.children.keys()):
                _dfs(node.children[ch])
                if len(results) >= limit:
                    return

        _dfs(curr)
        return results

    def clear(self) -> None:
        """Reset the Trie to an empty root state."""
        self.root = TrieNode()
        self._total_keys = 0

    def get_stats(self) -> dict:
        """Calculate Trie structural metrics for viva diagnostics."""
        node_count = 0
        terminal_nodes = 0
        total_stored_ids = 0

        def _count(node: TrieNode):
            nonlocal node_count, terminal_nodes, total_stored_ids
            node_count += 1
            if node.is_end_of_word:
                terminal_nodes += 1
                total_stored_ids += len(node.patient_ids)
            for child in node.children.values():
                _count(child)

        _count(self.root)

        return {
            "total_nodes": node_count,
            "terminal_nodes": terminal_nodes,
            "total_indexed_ids": total_stored_ids,
            "root_branches": len(self.root.children),
        }
