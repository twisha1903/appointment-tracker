# Master Viva Defense Preparation & Examiner Q&A Guide
### CareTrack — The Hospital Patient & Appointment Tracker

> **Evaluation Reference:** Advanced Data Structures (ADS) Laboratory & Theory Viva  
> **Student Preparation:** Read these 16 questions and model answers to defend the mathematical correctness, algorithmic time complexities, and architectural decisions of your project.

---

### Q1: Why did you use a Hash Table for patient lookup?
**Model Answer:**  
In a clinical hospital setting, retrieving a patient's electronic health record by their primary identifier (`patient_id`, e.g., `PT-1001`) is the most frequent operation. 
- A linear array scan takes $O(N)$ time, which scales poorly as the registry grows.
- A balanced binary search tree takes $O(\log N)$ time.
- A **Hash Table** maps the string key directly to an integer bucket index using a hash function, achieving expected **$O(1)$ constant time** for lookup, insertion, and deletion. This gives immediate record retrieval regardless of whether the hospital has 100 or 1,000,000 patients.

---

### Q2: How does your Hash Table resolve collisions using Separate Chaining?
**Model Answer:**  
Our implementation allocates a fixed-size Python list of bucket heads: `self.buckets = [None] * self.capacity`.
When two distinct patient IDs produce the exact same bucket index (a hash collision), they are stored in a singly-linked list of `HashNode` objects in that bucket.
- To insert, we traverse the bucket's linked list. If the key already exists, we update its value in-place; otherwise, we append or prepend the new `HashNode`.
- To delete, we unlink the target node by setting `prev.next = curr.next`, which takes $O(1)$ expected time and completely avoids the "tombstone" degradation common in open addressing.

---

### Q3: Why is Hash Table lookup expected $O(1)$ rather than guaranteed worst-case $O(1)$?
**Model Answer:**  
Hash Table performance is mathematically governed by the **Simple Uniform Hashing Assumption (SUHA)**. Under SUHA, any given key is equally likely to hash to any of the $M$ buckets, yielding an average chain length (load factor) of $\alpha = \frac{N}{M}$.
- If a hash function distributes keys uniformly and we dynamically resize the table whenever $\alpha > 0.75$, the average bucket length remains strictly bounded by $\le 0.75$, giving **$O(1)$ expected time**.
- However, in the theoretical **worst case**, an adversarial or pathological set of keys could all hash into the exact same bucket. In that scenario, all $N$ elements end up in a single linked list, causing lookup time to degenerate to $O(N)$.

---

### Q4: Why is a Standard Trie better suited to live prefix autocomplete than scanning every patient?
**Model Answer:**  
When a user types characters into an autocomplete search bar (e.g., `"Aa"`), searching an array or relational database requires examining all $N$ patient names or performing index scans.
- In a **Standard Prefix Trie**, each edge represents a single character. Searching for a prefix of length $L$ requires simply following $L$ character pointers from the root.
- For example, looking up `"Aarav"` takes exactly **5 character steps**, regardless of whether the database stores 10 patients or 10,000,000 patients.
- Once at the prefix node, a depth-first traversal collects all matching patient IDs in $O(K)$ time where $K$ is the number of matches. The search time is strictly **$O(L + K)$**, completely decoupled from the registry size $N$.

---

### Q5: How does your Trie handle two different patients who have the exact same full name?
**Model Answer:**  
In real-world healthcare, distinct patients often share identical names (for example, two patients named *"Aarav Sharma"*).
- If the Trie terminal node stored only a single `patient_id: str`, the second patient would overwrite the first patient's record.
- In our implementation, each `TrieNode` stores a **set of patient IDs**:
  ```python
  class TrieNode:
      def __init__(self):
          self.children = {}
          self.is_end_of_word = False
          self.patient_ids = set()  # Multi-patient terminal set
  ```
- Both `"PT-1001"` (age 28) and `"PT-1002"` (age 54) deposit their IDs into the terminal node. When the user types `"Aarav Sharma"`, the Trie returns both unique IDs, allowing the frontend to display both distinct patient profiles.

---

### Q6: How does an AVL Tree maintain its height balance?
**Model Answer:**  
An **AVL Tree** is a self-balancing Binary Search Tree where every node satisfies the **AVL balance property**:
$$\text{Balance Factor } (BF) = \text{height}(\text{left}) - \text{height}(\text{right}) \in \{-1, 0, 1\}$$
- Every time a node is inserted or deleted, we recompute the node's `height` from the heights of its children:
  $$\text{height} = 1 + \max(\text{height}(\text{left}), \text{height}(\text{right}))$$
- As the recursion unwinds back to the root, if any node has $|BF| > 1$, we immediately execute one of four tree rotations to restore balance in $O(1)$ time, guaranteeing overall tree height $h < 1.44 \log_2(N + 2)$.

---

### Q7: What are LL, RR, LR, and RL rotations, and when is each triggered?
**Model Answer:**  
Rotations are local pointer swaps that decrease tree height while preserving BST in-order sequencing:
1. **Left-Left (LL) Heavy ($BF > 1$ and key $<$ left.key):** A single **Right Rotation** around the node fixes the imbalance.
2. **Right-Right (RR) Heavy ($BF < -1$ and key $>$ right.key):** A single **Left Rotation** around the node fixes the imbalance.
3. **Left-Right (LR) Heavy ($BF > 1$ and key $>$ left.key):** First perform a **Left Rotation** on the left child, transforming it into an LL case, followed by a **Right Rotation** on the node.
4. **Right-Left (RL) Heavy ($BF < -1$ and key $<$ right.key):** First perform a **Right Rotation** on the right child, transforming it into an RR case, followed by a **Left Rotation** on the node.

---

### Q8: Why does a standard BST/AVL sorted only by start time not automatically solve every interval-overlap problem?
**Model Answer:**  
Two time intervals $[S_1, E_1)$ and $[S_2, E_2)$ overlap if and only if:
$$S_1 < E_2 \quad \text{and} \quad E_1 > S_2$$
A standard BST is ordered by a single scalar: `start_at`.
- Knowing that a candidate appointment starts at `11:00` tells us that all nodes in the left subtree start before `11:00`.
- However, a morning appointment starting at `08:00` could have a duration of 5 hours, ending at `13:00` (which would conflict with `11:00`).
- Without knowing the **end times** in the left subtree, a standard BST must traverse every node in the left subtree to check for conflicts, which degrades conflict detection to $O(N)$ worst-case time.

---

### Q9: How does augmenting each AVL node with `max_end_at` allow efficient interval conflict detection?
**Model Answer:**  
Each node in our AVL tree is augmented with an additional attribute:
$$\text{node.max\_end\_at} = \max(\text{node.end\_at}, \text{node.left.max\_end\_at}, \text{node.right.max\_end\_at})$$
This value represents the latest completion time of **any appointment in that node's entire subtree**.
When searching for conflicts against a new interval $[S_{\text{new}}, E_{\text{new}})$:
- We check `node.left`. If `node.left` is `None` or `node.left.max_end_at <= S_new`, it is mathematically impossible for any appointment in the left subtree to overlap with the candidate interval.
- We can **safely prune the entire left subtree** without visiting its nodes.
- This pruning bounds the search time to **$O(\log N + K)$**, where $K$ is the number of overlapping conflicts returned.

---

### Q10: What is the difference between a chronological sorted index and an augmented interval index?
**Model Answer:**  
- **Chronological Sorted Index:** Orders appointments strictly by their arrival or start timestamp. An in-order traversal of this index yields a timeline of the day's schedule in $O(N)$ time.
- **Augmented Interval Index:** Treats each appointment as a 1D geometric interval $[S_i, E_i)$ and maintains structural summaries (`max_end_at`) to answer 2-dimensional overlap queries ($S_A < E_B$ and $E_A > S_B$). In CareTrack, `AppointmentAVLTree` performs **both functions simultaneously**.

---

### Q11: What is the KMP LPS ($\pi$) prefix table and how is it computed?
**Model Answer:**  
The **Longest Proper Prefix which is also a Suffix (LPS)** array, denoted $\pi$, is precomputed for a pattern of length $M$ in $O(M)$ time:
- $\pi[j]$ stores the length of the longest proper prefix of `pattern[0..j]` that is also a suffix of `pattern[0..j]`.
- For example, for pattern `"AABAACAABAA"`, $\pi = [0, 1, 0, 1, 2, 0, 1, 2, 3, 4, 5]$.
- It is computed by maintaining a prefix length pointer `length = 0` and stepping index `i` from $1$ to $M - 1$. If `pattern[i] == pattern[length]`, increment `length` and store in $\pi[i]$; otherwise, fall back to `length = \pi[length - 1]`.

---

### Q12: Why does KMP never backtrack the text pointer `i` during pattern matching?
**Model Answer:**  
In naive string matching, when a mismatch occurs at $pattern[j] \neq text[i]$ after several matching characters, the algorithm discards all knowledge and resets the text pointer back to $i - j + 1$.
- In KMP, the precomputed $\pi$ table informs us exactly how many characters in the pattern are already aligned with the text immediately preceding index $i$.
- Instead of rewinding $i$, KMP simply resets $j = \pi[j - 1]$ and compares $pattern[j]$ with $text[i]$.
- Because the text pointer $i$ monotonically increases from $0$ to $N - 1$, the search takes strictly **$O(N)$ comparisons**, and overall time is bounded by **$O(N + M)$**.

---

### Q13: What are the exact time and space complexities of every operation in this project?
**Model Answer:**  
1. **Patient Retrieval (`PatientHashTable.get`):** Expected $O(1)$ time, $O(1)$ auxiliary space. Worst-case $O(N)$ time if all keys collide.
2. **Patient Registration (`PatientHashTable.insert`):** Amortized $O(1)$ time (including table doubling when $\alpha > 0.75$), $O(1)$ space.
3. **Prefix Autocomplete (`PatientNameTrie.autocomplete`):** $O(L + K)$ time, where $L$ is query length and $K$ is number of matching IDs. Independent of total registry size $N$. Space is $O(\Sigma \cdot \text{chars})$.
4. **Appointment Overlap Search (`AppointmentAVLTree.find_conflicts`):** $O(\log N + K)$ time where $K$ is conflict count. Recursion stack space is $O(\log N)$.
5. **Appointment Insertion (`AppointmentAVLTree.insert`):** $O(\log N)$ time, including AVL height updates and 4-case rotations.
6. **Chronological Day Schedule (`AppointmentAVLTree.in_order`):** $O(N)$ time, $O(N)$ space.
7. **Clinical Notes Scan (`kmp_search`):** $O(M)$ table precomputation + $O(N)$ text scanning = $O(N + M)$ total time. Space is $O(M)$ for the $\pi$ array.

---

### Q14: Why is SQLite still necessary when the application already has fast in-memory data structures?
**Model Answer:**  
In-memory data structures reside strictly in volatile RAM.
- If the server experiences a power failure, OS reboot, or process crash, all RAM pointers are lost instantly.
- **SQLite** provides ACID transaction guarantees (Atomicity, Consistency, Isolation, Durability) with write-ahead logging (WAL) and foreign key constraints on disk.
- CareTrack uses a **write-through architecture**: mutations commit to SQLite first for durability, and are immediately reflected in our custom in-memory structures for sub-millisecond querying.

---

### Q15: How are the in-memory Hash Table, Trie, and AVL Tree reconstructed after a server restart?
**Model Answer:**  
During the FastAPI startup lifecycle (`lifespan` in `app/main.py`), `HospitalIndexService.rebuild_indexes_from_db()` executes:
1. Clears existing in-memory roots and bucket arrays.
2. Queries SQLite: `SELECT * FROM patients` and inserts each patient into `PatientHashTable` in $O(1)$ and `PatientNameTrie` in $O(L)$.
3. Queries SQLite: `SELECT * FROM appointments ORDER BY start_at ASC` and inserts each appointment into `AppointmentAVLTree` in $O(\log N)$, recomputing `max_end_at` subtree bounds and performing any necessary AVL rotations.
Within milliseconds, all three in-memory structures are fully hydrated and ready to serve requests.

---

### Q16: How does the application deliver real-time updates across tabs without exposing private clinical notes in event payloads?
**Model Answer:**  
The server exposes a Server-Sent Events (SSE) endpoint at `GET /api/events`.
- To comply with healthcare privacy principles (such as HIPAA), broadcast payloads are stripped of all personal health information (PHI):
  ```json
  {"type": "appointment_changed", "entity_id": "APT-2001", "action": "create", "timestamp": "..."}
  ```
- No patient names, phone numbers, allergies, or clinical notes are ever transmitted over the broadcast stream.
- When connected browser tabs receive this event via the `useRealtimeSync` hook, they use the event purely as a signal to fetch fresh, authenticated data for the active view.
