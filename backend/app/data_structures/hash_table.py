"""Custom Hash Table with Separate Chaining for Patient Registry Indexing.

ADS Syllabus Reference:
- Unit 2: Hashing, Collision Resolution via Separate Chaining, Dynamic Rehashing.

Theoretical Complexity:
- Average / Expected Time:
    - Search (get):  O(1)
    - Insert (put):  O(1) amortized
    - Delete:        O(1)
- Worst-Case Time (Degenerate Collision Chain):
    - Search:        O(n)
    - Insert:        O(n)
    - Delete:        O(n)
- Space Complexity:
    - O(n + capacity) where n is total patient records and capacity is bucket count.
"""

from typing import Any, List, Optional, Tuple


class HashNode:
    """Singly-linked bucket node for separate chaining collision resolution."""

    def __init__(self, key: str, value: Any, next_node: Optional["HashNode"] = None):
        self.key: str = key
        self.value: Any = value
        self.next: Optional[HashNode] = next_node

    def __repr__(self) -> str:
        return f"HashNode(key={self.key!r}, next={'...' if self.next else 'None'})"


class PatientHashTable:
    """Custom Separate Chaining Hash Table designed for O(1) patient lookups by patient_id.

    Features:
    - Deterministic polynomial rolling hash over ASCII/Unicode ordinals.
    - Explicit singly linked list collision chains (HashNode).
    - In-place key update without inflating size or duplicating nodes.
    - Dynamic doubling and rehashing when load factor exceeds max_load_factor (default 0.75).
    - Diagnostic instrumentation for viva demonstrations (load factor, chain length, collision count).
    """

    def __init__(self, capacity: int = 16, max_load_factor: float = 0.75):
        if capacity <= 0:
            raise ValueError("Capacity must be a positive integer.")
        if max_load_factor <= 0:
            raise ValueError("Max load factor must be greater than 0.")

        self.capacity: int = capacity
        self.max_load_factor: float = max_load_factor
        self.buckets: List[Optional[HashNode]] = [None] * self.capacity
        self.size: int = 0
        self.collision_count: int = 0

    def _hash(self, key: str) -> int:
        """Deterministic polynomial rolling hash function:

            H(s) = sum(ord(s[i]) * base^(len - 1 - i)) mod capacity

        Rationale:
        A prime base (31) delivers strong avalanche characteristics across sequential strings.
        For healthcare patient IDs formatted sequentially like 'PT-1001', 'PT-1002', 'PT-1003',
        the common prefix 'PT-100' would otherwise cluster heavily. The polynomial base shifts
        each character's contribution into different powers of 31, spreading sequential keys
        uniformly across the bucket array.
        """
        hash_val = 0
        base = 31
        for char in key:
            hash_val = (hash_val * base + ord(char))
        return hash_val % self.capacity

    def load_factor(self) -> float:
        """Calculate current ratio of stored entries to allocated buckets."""
        if self.capacity == 0:
            return 0.0
        return self.size / self.capacity

    def insert(self, key: str, value: Any) -> None:
        """Insert or update a key-value record in O(1) expected time.

        If key already exists in the bucket chain, updates value in-place without
        incrementing size. Otherwise, prepends a new HashNode to the bucket chain
        and triggers rehashing if load_factor exceeds max_load_factor.
        """
        idx = self._hash(key)
        curr = self.buckets[idx]

        # 1. Search for existing key in bucket chain (Update in place)
        while curr is not None:
            if curr.key == key:
                curr.value = value
                return
            curr = curr.next

        # 2. Key does not exist: record collision if bucket already occupied
        if self.buckets[idx] is not None:
            self.collision_count += 1

        # 3. Prepend new node at head of bucket chain
        new_node = HashNode(key=key, value=value, next_node=self.buckets[idx])
        self.buckets[idx] = new_node
        self.size += 1

        # 4. Check dynamic resize condition
        if self.load_factor() > self.max_load_factor:
            self._rehash()

    def get(self, key: str) -> Optional[Any]:
        """Retrieve stored value for key in O(1) expected time, or None if not found."""
        idx = self._hash(key)
        curr = self.buckets[idx]
        while curr is not None:
            if curr.key == key:
                return curr.value
            curr = curr.next
        return None

    def contains(self, key: str) -> bool:
        """Check if key exists in hash table."""
        return self.get(key) is not None

    def delete(self, key: str) -> bool:
        """Unlink and remove key from bucket chain in O(1) expected time.

        Handles head node removal and interior/tail unlinking cleanly.
        Returns True if deleted, False if key was not present.
        """
        idx = self._hash(key)
        curr = self.buckets[idx]
        prev: Optional[HashNode] = None

        while curr is not None:
            if curr.key == key:
                if prev is None:
                    # Target is the head of the chain
                    self.buckets[idx] = curr.next
                else:
                    # Target is interior or tail
                    prev.next = curr.next
                self.size -= 1
                return True
            prev = curr
            curr = curr.next

        return False

    def values(self) -> List[Any]:
        """Return all values stored across all buckets."""
        results: List[Any] = []
        for head in self.buckets:
            curr = head
            while curr is not None:
                results.append(curr.value)
                curr = curr.next
        return results

    def keys(self) -> List[str]:
        """Return all keys stored across all buckets."""
        results: List[str] = []
        for head in self.buckets:
            curr = head
            while curr is not None:
                results.append(curr.key)
                curr = curr.next
        return results

    def items(self) -> List[Tuple[str, Any]]:
        """Return all (key, value) pairs stored across all buckets."""
        results: List[Tuple[str, Any]] = []
        for head in self.buckets:
            curr = head
            while curr is not None:
                results.append((curr.key, curr.value))
                curr = curr.next
        return results

    def clear(self) -> None:
        """Reset hash table to empty state with current capacity."""
        self.buckets = [None] * self.capacity
        self.size = 0
        self.collision_count = 0

    def _rehash(self) -> None:
        """Double capacity and re-distribute existing nodes into new bucket array."""
        old_buckets = self.buckets
        self.capacity *= 2
        self.buckets = [None] * self.capacity
        self.size = 0
        self.collision_count = 0

        # Re-insert every node into the resized bucket array
        for head in old_buckets:
            curr = head
            while curr is not None:
                self.insert(curr.key, curr.value)
                curr = curr.next

    def get_stats(self) -> dict:
        """Inspect internal table metrics for viva demonstration and telemetry."""
        non_empty = 0
        max_chain = 0
        total_chain_lengths = 0

        for head in self.buckets:
            if head is not None:
                non_empty += 1
                chain_len = 0
                curr = head
                while curr is not None:
                    chain_len += 1
                    curr = curr.next
                total_chain_lengths += chain_len
                if chain_len > max_chain:
                    max_chain = chain_len

        avg_chain = round(total_chain_lengths / non_empty, 2) if non_empty > 0 else 0.0

        return {
            "size": self.size,
            "capacity": self.capacity,
            "load_factor": round(self.load_factor(), 4),
            "non_empty_buckets": non_empty,
            "max_chain_length": max_chain,
            "average_chain_length": avg_chain,
            "collision_count": self.collision_count,
        }

    def __len__(self) -> int:
        return self.size

    def __contains__(self, key: str) -> bool:
        return self.contains(key)
