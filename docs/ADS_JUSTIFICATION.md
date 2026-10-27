# Advanced Data Structures Justification & Comparative Analysis
### Syllabus Alignment, Algorithmic Rationale, and Implementation Audit

> **Course Reference:** Advanced Data Structures (ADS) Laboratory & Theory  
> **System Reference:** CareTrack (The Hospital Patient & Appointment Tracker)  
> **Rule of Implementation:** Pure from-scratch data structures in pure Python without built-in shortcuts (no `dict` bucket storage, no external tree packages, no `in`/`re` pattern matching).

---

## 1. Executive Summary & Why Naive Approaches Fail

In traditional naive web implementations, developers rely heavily on relational database queries or high-level built-in collections. However, in high-throughput outpatient clinical management, naive choices break down:

1. **Linear Scans ($O(N)$):** Searching an in-memory list or unindexed array for a patient ID requires iterating through every element. When $N = 100{,}000$, average lookups require $50{,}000$ comparisons.
2. **SQL `LIKE '%query%'` for Autocomplete:** Wildcard prefix or infix queries force SQLite or PostgreSQL to execute costly table scans or index range walks. Under debounced live keystroke streaming, this floods the database connection pool.
3. **Unaugmented Binary Search Trees for Scheduling:** A standard BST sorted strictly by appointment start time $S_i$ cannot detect interval overlaps. For example, an appointment from `09:00` to `17:00` overlaps with an appointment from `11:00` to `11:30`, even though the latter starts much later. An unaugmented BST must scan $O(N)$ nodes to verify non-overlap.
4. **Naive String Search ($O(N \times M)$) with Backtracking:** Scanning medical records with repetitive phrasing (e.g. *"Penicillin allergy, Penicillin-tolerant, Penicillin-resistant"*) causes naive text pointers to backtrack repeatedly on every mismatch, degrading scan throughput.

To address these exact challenges, CareTrack maps four specific curriculum data structures to the clinical workflow.

---

## 2. Comprehensive Data Structure Comparison Matrix

| Clinical Feature | Selected ADS Structure / Algorithm | Syllabus Unit | Why It Fits the Problem | Key Operations Implemented | Time & Space Complexity | Exact File & Function in Codebase Proving Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient Record Retrieval** | **Custom Hash Table with Separate Chaining** | Unit 2: Hashing | Guarantees expected $O(1)$ lookup by `patient_id` regardless of directory size. Separate chaining cleanly handles collision resolution via linked nodes without primary clustering or deletion tombstones. | `insert()`, `get()`, `delete()`, `_rehash()`, `hash_key()` | **Time:** Average $O(1)$, Worst $O(N)$<br/>**Space:** $O(N)$ | [hash_table.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/hash_table.py)<br/>• `PatientHashTable.get()`<br/>• `PatientHashTable._hash()`<br/>• `PatientHashTable.delete()` |
| **Live Patient Name Search** | **Standard Character Prefix Trie** | Unit 5: Text Processing & Tries | Provides live character-by-character autocomplete in $O(L)$ time (where $L$ is query length, typically 2–5 chars), completely independent of total patients $N$. Terminal node `set[patient_id]` naturally resolves duplicate names. | `insert()`, `autocomplete()`, `delete()`, `_normalize()` | **Time:** $O(L + K)$ (lookup + $K$ matches)<br/>**Space:** $O(\Sigma \cdot \text{chars})$ | [trie.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/trie.py)<br/>• `PatientNameTrie.autocomplete()`<br/>• `PatientNameTrie.insert()`<br/>• `PatientNameTrie.delete()` |
| **Outpatient Appointment Scheduling** | **Self-Balancing Augmented AVL Interval Tree** | Unit 3: Trees (AVL Trees & Height Balance) | Maintains appointments in chronological sequence via in-order traversal while guaranteeing worst-case $O(\log N)$ tree height via 4-case rotations. Subtree `max_end_at` augmentation prunes interval overlap search in $O(\log N + K)$ time. | `insert()`, `delete()`, `find_conflicts()`, `in_order()`, rotations (`_rotate_left`, `_rotate_right`) | **Time:** Insert/Delete $O(\log N)$, Conflicts $O(\log N + K)$, Traversal $O(N)$<br/>**Space:** $O(N)$ | [avl_tree.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/avl_tree.py)<br/>• `AppointmentAVLTree.insert()`<br/>• `AppointmentAVLTree.find_conflicts()`<br/>• `AppointmentAVLTree._update_node()` |
| **Allergy & Clinical Text Surveillance** | **Knuth-Morris-Pratt (KMP) Pattern Matcher** | Unit 5: Text Processing & String Matching | Scans unstructured medical notes and allergy records in linear $O(N + M)$ time. Precomputed Longest Proper Prefix which is also a Suffix (LPS / $\pi$) table guarantees that the text pointer $i$ never backtracks. | `compute_lps_table()`, `kmp_search()`, `scan_clinical_text()` | **Time:** Table $O(M)$, Search $O(N + M)$<br/>**Space:** $O(M)$ failure table | [kmp.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/kmp.py)<br/>• `compute_lps_table()`<br/>• `kmp_search()`<br/>• `scan_clinical_text()` |

---

## 3. Deep-Dive Structure Justifications

### 3.1 Custom Hash Table (Separate Chaining) vs. Open Addressing
- **Why Separate Chaining?**
  In clinical directories, patient records are frequently added and occasionally archived or deleted.
  - In **Open Addressing (Linear / Quadratic Probing)**, deleting an item requires placing a `"DELETED"` tombstone marker to avoid breaking probe chains. Over time, tombstones accumulate, artificially inflating probe lengths and degrading lookup times toward $O(N)$ until an expensive full table rebuild occurs.
  - In **Separate Chaining**, deletion is a clean, local pointer unlink operation in the bucket's singly-linked list:
    ```python
    # From backend/app/data_structures/hash_table.py
    prev.next = curr.next
    self.size -= 1
    ```
- **Polynomial Rolling Hash:**
  Using base 31 prevents common hospital ID prefix collisions (`PT-1001`, `PT-1002`, `PT-1003`). Because $31$ is an odd prime, character position weighting shifts successive numeric digits across diverse modulo congruence classes, distributing sequential keys evenly across buckets.
- **Dynamic Resizing Rule:**
  The table monitors its load factor $\alpha = \frac{\text{size}}{\text{capacity}}$. When $\alpha > 0.75$, capacity doubles ($16 \to 32 \to 64$), and all elements are re-hashed, keeping average chain length $< 1.0$ and ensuring $O(1)$ expected lookup.

---

### 3.2 Standard Prefix Trie vs. Inverted Index vs. SQL LIKE
- **Why Standard Prefix Trie?**
  Live search bars fire queries on every keystroke (e.g., `A` $\to$ `Aa` $\to$ `Aar` $\to$ `Aarav`).
  - An inverted index requires exact token matching and cannot naturally answer partial character prefix queries without wildcard expansions.
  - A database B-Tree index on `full_name` can execute `LIKE 'Aarav%'`, but incurs inter-process network overhead, connection pooling locks, and disk page cache eviction.
  - The in-memory **Prefix Trie** traverses directly to the prefix node in $L$ pointer dereferences, where $L$ is the length of the string typed by the user. If the user types `"Aarav"`, finding the prefix node takes exactly **5 character steps**, completely independent of whether the hospital has 10 patients or 1,000,000 patients.
- **Handling Duplicate Patient Names:**
  A critical real-world edge case in hospital systems is multiple individuals having the same name. In CareTrack:
  ```python
  # From backend/app/data_structures/trie.py
  class TrieNode:
      def __init__(self):
          self.children: dict[str, TrieNode] = {}
          self.is_end_of_word: bool = False
          self.patient_ids: set[str] = set()  # Terminal node set
  ```
  Both `"Aarav Sharma"` (`PT-1001`, age 28) and `"Aarav Sharma"` (`PT-1002`, age 54) deposit their IDs into the terminal node's set, enabling live autocomplete to present both profiles with distinct demographic details.

---

### 3.3 Augmented AVL Interval Tree vs. Unaugmented BST vs. Array Scans
- **Why Self-Balancing AVL?**
  Appointments arrive in temporal clusters (e.g., morning booking rush). Inserting sorted sequential timeslots into an unaugmented Binary Search Tree degenerates it into a linked list with $O(N)$ search and insertion height. The AVL tree strictly enforces that for every node:
  $$|\text{height}(\text{left}) - \text{height}(\text{right})| \le 1$$
  Using 4-case rotations (Left-Left, Right-Right, Left-Right, Right-Left), the tree height is bounded strictly by:
  $$h < 1.44 \log_2(N + 2)$$
- **Why Augment with `max_end_at`?**
  Two appointments $[S_1, E_1)$ and $[S_2, E_2)$ overlap if and only if:
  $$S_1 < E_2 \quad \text{and} \quad E_1 > S_2$$
  In an unaugmented tree, an appointment starting early in the morning could span the entire day. Searching for overlaps would require visiting almost every node in the tree.
  By augmenting every node with `max_end_at = max(node.end_at, left.max_end_at, right.max_end_at)`, the search algorithm can inspect `node.left.max_end_at`. If `node.left.max_end_at <= new_start`, the algorithm **prunes the entire left subtree**, guaranteeing that all overlapping intervals are discovered in $O(\log N + K)$ time.
- **Compound Key Invariant:**
  To support hospitals with multiple specialty doctors operating in parallel, CareTrack defines node keys as a tuple:
  $$\text{key} = (\text{start\_at\_iso}, \text{appointment\_id})$$
  This total ordering ensures that simultaneous appointments (e.g. Dr. Khan and Dr. Vance both starting consults at `10:00:00`) never overwrite each other in the BST, while remaining strictly sorted.

---

### 3.4 Knuth-Morris-Pratt (KMP) vs. Naive Search vs. Boyer-Moore
- **Why KMP for Medical Notes?**
  Clinical notes often contain repetitive scientific nomenclature and medical prefixes (e.g., *"hyper-tension"*, *"hyper-glycemia"*, *"penicillin-resistant"*).
  - The **Naive string search algorithm** checks characters one by one. When a mismatch occurs after partial matching, it resets the text index back to $i - j + 1$, resulting in worst-case $O(N \times M)$ comparisons.
  - **Boyer-Moore** relies on bad-character shifts from right to left; on short clinical keywords (4–10 characters) and complex UTF-8 text, Boyer-Moore has higher constant-factor table overhead and edge-case complexity.
  - **Knuth-Morris-Pratt (KMP)** constructs the Longest Proper Prefix which is also a Suffix (LPS / $\pi$) table in a single $O(M)$ preprocessing pass. During the search phase, whenever a mismatch occurs at $pattern[j]$, the text pointer $i$ continues forward without decrementing, while $j$ falls back to $\pi[j - 1]$. This guarantees strict $O(N + M)$ performance on every scan.

---

## 4. Code Architecture Proof & Compliance Checklist

To verify that these justifications are grounded in the physical codebase, the following files prove strict adherence to curriculum standards:

1. **Custom Hash Table:** [backend/app/data_structures/hash_table.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/hash_table.py)
   - Contains explicit `HashNode` class.
   - Fixed-size bucket array allocation `[None] * capacity`.
   - Verified load factor doubling at $\alpha > 0.75$.
2. **Standard Prefix Trie:** [backend/app/data_structures/trie.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/trie.py)
   - Contains recursive post-order deletion pruning `_prune()`.
   - Multi-patient terminal sets `self.patient_ids.add(patient_id)`.
3. **Augmented AVL Tree:** [backend/app/data_structures/avl_tree.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/avl_tree.py)
   - Explicit rotation methods: `_rotate_left` and `_rotate_right`.
   - Height and subtree `max_end_at` calculation in `_update_node()`.
   - Overlap search pruning logic in `find_conflicts()`.
4. **Knuth-Morris-Pratt Matcher:** [backend/app/data_structures/kmp.py](file:///c:/Users/twipa/OneDrive/Desktop/ads/backend/app/data_structures/kmp.py)
   - Explicit LPS failure table calculation `compute_lps_table()`.
   - Linear loop maintaining `i < N` with zero decrement `i -= 1`.
