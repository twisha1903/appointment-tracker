# Automated Test Plan & Quality Assurance Specification
### CareTrack — The Hospital Patient & Appointment Tracker

> **Test Suite Statistics:** 53 Automated Pytest Tests | 9 Specialized Test Suites | 100% Pass Rate across Windows & Python 3.12.

---

## 1. Test Strategy & Execution Environment

The automated test suite verifies all four custom data structures, SQLite persistence integrity, write-through synchronization, real-time Server-Sent Events, and REST route controllers.

### Execution Commands (Windows PowerShell)
```powershell
cd c:\Users\twipa\OneDrive\Desktop\ads\backend
..\.venv\Scripts\python.exe -m pytest -v
```

### Execution Commands (Windows CMD)
```cmd
cd c:\Users\twipa\OneDrive\Desktop\ads\backend
..\.venv\Scripts\python.exe -m pytest -v
```

---

## 2. Test Suite Catalogue & Edge Case Mapping

### 2.1 Smoke Tests (`tests/test_smoke.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_smoke` | Python 3.12 runtime and environment | Ensures virtualenv dependencies are importable. |
| `test_health_endpoints` | Basic health API connectivity | Verifies `GET /api/health` returns HTTP 200 and JSON payload. |

---

### 2.2 Database & Persistence Layer (`tests/test_database.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_schema_and_seeding` | Database schema initialization & seeding | Verifies table creation (`doctors`, `patients`, `appointments`) and initial deterministic row counts. |
| `test_next_id_generation` | Sequential ID generator | Verifies prefix padding and monotonic incrementation (`PT-1001` $\to$ `PT-1002`, `APT-2001` $\to$ `APT-2002`). |
| `test_patient_crud_and_validation` | Patient table CRUD operations | Validates trimmed strings, optional age ranges (0–130), and timestamp generation. |
| `test_patient_deletion_restriction_on_active_appointments` | Referential integrity preservation | Confirms that patients with active appointments cannot be deleted, raising `ActiveAppointmentsExistException`. |
| `test_foreign_key_enforcement` | SQLite foreign key enforcement | Ensures inserting appointments with nonexistent `patient_id` or `doctor_id` fails foreign key constraints. |
| `test_appointment_crud_and_duration_derivation` | Appointment CRUD & interval calculation | Validates automatic computation of `end_at = start_at + duration_minutes`. |
| `test_health_api_endpoint` | Health endpoint integration | Verifies database connectivity and telemetry reporting from SQLite. |

---

### 2.3 Custom Hash Table Unit Tests (`tests/test_hash_table.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_basic_insert_and_get` | Insertion and retrieval | Evaluates $O(1)$ expected lookup for sequential keys. |
| `test_in_place_update` | Updating existing keys | Verifies that inserting an existing `patient_id` overwrites value without incrementing table size. |
| `test_forced_hash_collisions` | Collision resolution in buckets | Forces multiple keys to hash to the exact same bucket modulo; verifies separate chaining linked list traversal. |
| `test_deletion_head_middle_tail` | Linked list node deletion | Verifies node deletion at the head of a bucket chain, middle of a chain, and tail of a chain without dangling pointers. |
| `test_non_existent_key_operations` | Missing key resilience | Confirms querying or deleting a missing key returns `None` cleanly without raising unexpected exceptions. |
| `test_dynamic_resizing_and_rehashing` | Table doubling at load factor $> 0.75$ | Inserts 20+ elements to force capacity growth ($16 \to 32 \to 64$), verifying all items rehash correctly and size remains exact. |
| `test_clear_and_stats` | Table purge and diagnostic metrics | Verifies that `clear()` resets capacity to 16, size to 0, and bucket arrays to `None`. |

---

### 2.4 Standard Prefix Trie Unit Tests (`tests/test_trie.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_trie_prefix_matching_lengths` | Multi-length prefix queries | Evaluates 1-character, 2-character, full-name, and exceeding prefixes. |
| `test_case_and_whitespace_normalization` | String normalization | Verifies that `"  aArAv   SHARma  "` resolves identically to `"aarav sharma"`. |
| `test_duplicate_patient_names` | Multi-patient terminal sets | Inserts two distinct patients named *"Aarav Sharma"* (`PT-1001` and `PT-1002`); verifies both IDs reside in the terminal set. |
| `test_update_and_rename_patient` | Patient renaming | Renames a patient from *"Rohan Verma"* to *"Rohan Kumar"*; verifies old token is pruned and new token indexed. |
| `test_prefix_sharing_and_clean_node_pruning` | Post-order node pruning | Deletes a name sharing a common prefix (e.g. *"Aarav"* and *"Aarav Sharma"*); verifies unneeded nodes are pruned without breaking the shorter word. |
| `test_edge_cases_and_result_limit` | Bounds and limits | Evaluates empty strings, whitespace-only queries, and `limit` parameter capping. |

---

### 2.5 Augmented AVL Interval Tree Unit Tests (`tests/test_avl_tree.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_rotations_ll_rr_lr_rl` | 4-Case AVL self-balancing rotations | Explicitly tests Left-Left, Right-Right, Left-Right, and Right-Left imbalances, verifying balance factor $\in \{-1, 0, 1\}$. |
| `test_bulk_insert_and_delete_stress` | High-volume stress testing | Inserts 50 appointments in reverse and random order; checks that tree height remains $\le 1.44 \log_2 N$ and `max_end_at` is exact at every node. |
| `test_in_order_chronological_traversal_and_simultaneous_starts` | In-order sequence & compound keys | Verifies simultaneous appointments starting at the exact same minute for different doctors sort deterministically by ID. |
| `test_doctor_conflict_detection_variations` | Doctor overlap detection | Tests full containment, partial left overlap, partial right overlap, and identical start/end intervals for the same doctor. |
| `test_patient_conflict_detection_across_doctors` | Patient overlap detection | Verifies that a patient cannot be double-booked with two different doctors at the same time. |
| `test_back_to_back_and_different_parties_allowed` | Valid schedule allowances | Verifies that back-to-back appointments (`10:00–10:30` and `10:30–11:00`) and simultaneous bookings for different doctors and patients are permitted. |
| `test_cancelled_status_and_reschedule_exclusion` | Cancellation & self-exclusion | Verifies that `Cancelled` appointments do not trigger conflicts, and rescheduling an appointment excludes its own original slot. |

---

### 2.6 Knuth-Morris-Pratt (KMP) Unit Tests (`tests/test_kmp.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_compute_lps_table_classic_patterns` | LPS failure function table | Tests classic computer science patterns: `"AABAACAABAA"`, `"AAAA"`, `"ABCD"`, and clinical term `"Penicillin"`. |
| `test_kmp_search_exact_clinical_sentences` | Single and multiple match offsets | Verifies exact zero-based character index offsets in realistic clinical prose. |
| `test_kmp_case_insensitivity` | Case-insensitive matching | Matches `"penicillin"`, `"PENICILLIN"`, and `"Penicillin"` identically. |
| `test_kmp_overlapping_patterns` | Overlapping pattern occurrences | Evaluates patterns that overlap within themselves (e.g. pattern `"ANA"` in text `"BANANA"`). |
| `test_kmp_edge_cases` | Edge case inputs | Verifies behavior when `pattern` is empty, text is empty, or `len(pattern) > len(text)`. |
| `test_scan_clinical_text_snippets_and_safety_notice` | Clinical scanner formatting | Checks that contextual text snippets are generated with surrounding padding and the mandatory safety notice is attached. |

---

### 2.7 Service Synchronization & Recovery Tests (`tests/test_service_sync.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_startup_index_reconstruction` | Cold-boot re-hydration | Reconstructs all 3 in-memory structures from SQLite rows and confirms element counts match. |
| `test_patient_mutation_synchronization` | Synchronous patient write-through | Verifies creating, updating, and deleting patients updates SQLite and memory simultaneously. |
| `test_conflict_rejection_and_slot_freeing_on_cancellation` | Scheduling synchronization | Verifies that canceling an appointment updates both the SQLite status and the in-memory AVL node status. |
| `test_application_restart_simulation` | Disaster recovery simulation | Creates new records, drops the `HospitalIndexService` instance, creates a fresh service instance, and confirms all records re-index identically. |
| `test_kmp_clinical_scan_and_dashboard_telemetry` | Integrated scanner & telemetry | Verifies that telemetry reflects actual Hash Table capacity, load factor, and Trie node counts. |

---

### 2.8 Server-Sent Events (SSE) Tests (`tests/test_events.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_event_broadcaster_subscribe_and_privacy` | Event formatting & PHI privacy | Ensures event payloads contain strictly `{"type", "entity_id", "action", "timestamp"}` with zero personal health data. |
| `test_multi_subscriber_fanout_and_full_queue_resilience` | Fanout & slow-subscriber drops | Simulates multiple subscribers; fills a subscriber's bounded queue to capacity and confirms server drops events without crashing. |
| `test_api_mutations_emit_broadcast_events` | API integration with broadcaster | Verifies that calling service create/update/delete methods emits the appropriate event type to active subscribers. |

---

### 2.9 REST API Integration Tests (`tests/test_api_integration.py`)
| Test Function | Verification Target | Edge Cases Handled |
| :--- | :--- | :--- |
| `test_health_and_dashboard_summary` | System health & summary | Verifies HTTP 200 responses, telemetry structures, and today's schedule. |
| `test_patient_crud_and_referential_deletion` | Full patient API lifecycle | Tests creation (201), retrieval (200), update (200), referential deletion blocking (409), deletion (200), and missing lookup (404). |
| `test_trie_autocomplete_endpoint` | Trie REST routing | Evaluates prefix queries, casing, and duplicate-name set return. |
| `test_appointment_chronological_ordering_and_get` | AVL chronological timeline | Confirms in-order schedule output across multiple appointments. |
| `test_conflict_rejection_and_different_parties_allowed` | AVL overlap rejection via HTTP 409 | Rejects overlapping doctor/patient appointments with HTTP 409 and permits simultaneous bookings for different doctors. |
| `test_cancellation_frees_slot_for_new_booking` | Cancellation frees slot | Cancels an appointment and books the exact same timeslot, proving the AVL tree unblocks the interval. |
| `test_kmp_notes_search_endpoint` | Notes search REST API | Evaluates search, LPS failure table return, and empty keyword 422 validation. |
| `test_reset_demo_endpoint` | Demo reset endpoint | Verifies `POST /api/system/reset-demo` restores database and memory indexes. |
| `test_appointment_reschedule_conflict_and_status_transitions` | Reschedule conflict rejection | Verifies `PUT /api/appointments/{id}` with an overlapping slot returns HTTP 409. |
| `test_appointment_filtering_by_doctor_and_status` | Appointment query filters | Validates filtering by `doctor_id`, `status`, and `patient_id`. |

---

## 3. Automated Live Server Verification (`verify_live_api.py`)
To test the real FastAPI server over real HTTP sockets on Windows:
```powershell
cd c:\Users\twipa\OneDrive\Desktop\ads\backend
..\.venv\Scripts\python.exe verify_live_api.py
```
This utility launches Uvicorn on `http://127.0.0.1:8000`, verifies live JSON payloads for all 5 primary endpoints, and terminates cleanly with exit code 0.
