# CARETRACK — FULL SYSTEM CONTEXT & ARCHITECTURE DIRECTORY
### Academic Capstone: "The Hospital Patient & Appointment Tracker"
> **Purpose of this Document:** Paste this complete file into any AI agent, evaluator, or developer tool to provide 100% complete, ground-truth context of the CareTrack codebase, folder structure, data structures, database schema, APIs, and frontend pages.

---

## 1. Project High-Level Overview

- **Academic Title:** The Hospital Patient & Appointment Tracker
- **Application Brand:** CareTrack
- **Curriculum Domain:** Advanced Data Structures & Algorithms (ADS) Laboratory & Theory
- **Core Engineering Constraint ("Zero-Shortcut Rule"):** All four core data structures are implemented **100% from first principles in pure Python** in `backend/app/data_structures/`:
  1. No built-in Python `dict` or `set` used to store bucket nodes in the Hash Table.
  2. No third-party tree libraries (no `sortedcontainers`, no `bintrees`) for the AVL Tree.
  3. No Python built-in `in`, `str.find()`, or `re` regular expressions for KMP string matching.
- **Architecture:** Write-Through Atomic Synchronization between an ACID SQLite database (`backend/data/caretrack.db`) and volatile In-Memory Advanced Data Structures, paired with a React 18 + TypeScript 5 single-page application communicating via REST APIs and Server-Sent Events (SSE).
- **Safety Notice:** Synthetic educational data only. Not certified for clinical diagnosis or prescription validation.

---

## 2. Complete Folder & File Directory Breakdown

Every file in the repository and its exact responsibility:

```
ads/
├── .gitignore                          # Ignores __pycache__, .venv, node_modules, dist, *.db, .pytest_cache
├── README.md                           # Master academic report (all 20 sections, diagrams, pseudocode, complexities)
├── PROJECT_CONTEXT.md                  # This file (complete context for any AI agent or evaluator)
├── RUN_INSTRUCTIONS.md                 # Clear, step-by-step local launch and testing guide
│
├── backend/                            # FASTAPI + PYTHON BACKEND
│   ├── pytest.ini                      # Pytest config: pythonpath = ., testpaths = tests
│   ├── requirements.txt                # Dependencies: fastapi, uvicorn[standard], pydantic, pytest, httpx
│   ├── verify_live_api.py              # Automated script launching live Uvicorn and verifying 5 live HTTP endpoints
│   │
│   ├── data/
│   │   └── caretrack.db                # SQLite database file (auto-created & seeded on first boot)
│   │
│   ├── app/
│   │   ├── __init__.py                 # Package marker
│   │   ├── main.py                     # FastAPI app instance, CORS middleware, lifespan startup/shutdown hooks
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py             # Package marker
│   │   │   └── routes.py               # REST route handlers + SSE /api/events StreamingResponse controller
│   │   │
│   │   ├── data_structures/            # PURE CUSTOM DATA STRUCTURES (THE 4 SYLLABUS ENGINES)
│   │   │   ├── __init__.py             # Package marker
│   │   │   ├── hash_table.py           # Custom Hash Table with Separate Chaining linked nodes (Unit 2 Hashing)
│   │   │   ├── trie.py                 # Standard Character Prefix Trie with multi-ID sets (Unit 5 Tries)
│   │   │   ├── avl_tree.py             # Augmented AVL Interval Tree with max_end_at & rotations (Unit 3 Trees)
│   │   │   └── kmp.py                  # Knuth-Morris-Pratt matcher with LPS failure table (Unit 5 String Matching)
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py             # Package marker
│   │   │   ├── database.py             # Parameterized SQLite repository, sequential ID generator, foreign keys
│   │   │   └── seed.py                 # Initial deterministic dataset (4 doctors, 9 patients, 7 appointments)
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py             # Package marker
│   │   │   └── schemas.py              # Pydantic v2 schemas, ISO datetime normalizers, interval calculators
│   │   │
│   │   └── services/
│   │       ├── __init__.py             # Package marker
│   │       ├── hospital_service.py     # Central Index Service orchestrating SQLite and in-memory structures
│   │       ├── event_broadcaster.py    # Asyncio queue event broadcaster pushing real-time SSE notifications
│   │       └── exceptions.py           # Domain exceptions (SchedulingConflict, ActiveAppointmentsExist, etc.)
│   │
│   └── tests/                          # AUTOMATED PYTEST SUITE (53 TESTS, 100% PASS RATE)
│       ├── __init__.py                 # Package marker
│       ├── test_smoke.py               # Framework sanity & basic health check tests
│       ├── test_database.py            # SQLite schema, CRUD, sequential ID generation, referential integrity
│       ├── test_hash_table.py          # Hash collisions, dynamic table doubling (alpha > 0.75), bucket unlinking
│       ├── test_trie.py                # Prefix autocomplete, duplicate names, token indexing, node pruning
│       ├── test_avl_tree.py            # 4-case rotations (LL, RR, LR, RL), interval overlap checks, max_end_at bounds
│       ├── test_kmp.py                 # LPS failure table verification, linear string search, safety notice
│       ├── test_service_sync.py        # Write-through synchronization, server crash restart simulation
│       ├── test_events.py              # SSE fanout, privacy compliance (zero PHI), full queue drop handling
│       └── test_api_integration.py     # Full REST API integration tests (HTTP 200, 201, 400, 404, 409, 422)
│
├── docs/                               # ACADEMIC DOCUMENTATION & VIVA PREPARATION
│   ├── README.md                       # Documentation directory index
│   ├── ADS_JUSTIFICATION.md            # Detailed syllabus alignment and comparative analysis vs. naive approaches
│   ├── ARCHITECTURE.md                 # In-memory synchronization, cold-boot re-hydration, SSE design
│   ├── TEST_PLAN.md                    # Quality assurance matrix and edge case catalogue
│   ├── VIVA_PREPARATION.md             # 16 master examiner questions and student-friendly model answers
│   └── DEMO_WALKTHROUGH.md             # Timed 5-to-7 minute live viva presentation script
│
└── frontend/                           # REACT 18 + TYPESCRIPT 5 + VITE FRONTEND
    ├── index.html                      # HTML entrypoint with metadata and title
    ├── package.json                    # Dependencies: react, react-dom, lucide-react, tailwindcss, vite
    ├── tsconfig.json                   # Strict TypeScript compiler options
    ├── vite.config.ts                  # Vite development server and build configuration
    │
    └── src/
        ├── App.tsx                     # Main application shell with tab state and modal triggers
        ├── index.css                   # Clinical dark theme styling, custom scrollbars, Tailwind utilities
        ├── main.tsx                    # React DOM root entrypoint
        ├── vite-env.d.ts               # Vite environment type declarations
        │
        ├── components/
        │   └── Layout.tsx              # Sidebar navigation, live connection badge, debounced Trie search bar
        │
        ├── hooks/
        │   └── useRealtimeSync.ts      # HTML5 EventSource SSE hook with automatic 3-second polling fallback
        │
        ├── pages/
        │   ├── DashboardPage.tsx       # Live executive dashboard, 6 metric cards, timeline, ADS telemetry card
        │   ├── PatientsPage.tsx        # Directory table, dual Trie vs Hash Table search, profile drawer, modals
        │   ├── AppointmentsPage.tsx    # Chronological timeline, AVL interval scheduler, 409 conflict alert box
        │   ├── NotesScannerPage.tsx    # KMP notes scanner, LPS table inspector, React mark highlighting, safety alert
        │   └── AboutSettingsPage.tsx   # ADS dials, syllabus complexity matrix, viva defense Q&A, demo data reset
        │
        ├── services/
        │   └── api.ts                  # Typed API client wrapping fetch with backend HTTP error detail parsing
        │
        └── types/
            └── index.ts                # Strict TypeScript interfaces matching backend Pydantic schemas
```

---

## 3. The Four Custom Data Structures Explained

### 1. Custom Patient Hash Table (`backend/app/data_structures/hash_table.py`)
- **Syllabus Topic:** Unit 2: Hashing (Hash Functions, Collision Resolution, Separate Chaining).
- **Core Nodes:** Custom `HashNode` class storing `key: str` (`patient_id`), `value: Any` (`PatientResponse`), and `next: Optional[HashNode]`.
- **Buckets:** Allocates fixed-size Python list: `self.buckets = [None] * capacity` (default capacity = 16). Zero Python `dict` shortcuts inside buckets.
- **Hash Function:** Base-31 polynomial rolling hash:
  $$h(s) = \left( \sum_{i=0}^{L-1} \text{ord}(s[i]) \times 31^{L-1-i} \right) \pmod{\text{capacity}}$$
- **Dynamic Resizing:** When load factor $\alpha = \frac{\text{size}}{\text{capacity}} > 0.75$, doubles capacity ($16 \to 32 \to 64$) and rehashes all nodes.
- **Time Complexity:** Average $O(1)$ lookup, insert, delete. Worst-case $O(N)$ if all keys collide.
- **Clinical Role:** Powers instantaneous $O(1)$ patient record retrieval by exact `patient_id` (e.g. `PT-1001`).

### 2. Standard Prefix Trie (`backend/app/data_structures/trie.py`)
- **Syllabus Topic:** Unit 5: Text Processing & Tries (Standard Tries, Prefix Search).
- **Core Nodes:** Custom `TrieNode` class storing `children: dict[str, TrieNode]`, `is_end_of_word: bool`, and `patient_ids: set[str]`.
- **Duplicate Name Resolution:** Terminal nodes store a `set[patient_id]`. If two distinct patients share the name *"Aarav Sharma"* (`PT-1001` age 28, and `PT-1002` age 54), both IDs reside at the same terminal node, preventing overwrites.
- **Multi-Word Token Indexing:** Indexes both full normalized name (`"aarav sharma"`) and secondary surname tokens (`"sharma"`).
- **Node Pruning:** Post-order recursive cleanup removes unneeded characters upon patient deletion.
- **Time Complexity:** Autocomplete runs in $O(L + K)$ time, where $L$ is query length and $K$ is number of matches, completely decoupled from total registry size $N$.
- **Clinical Role:** Powers the live debounced autocomplete dropdown in the top navigation bar and appointment booking modal.

### 3. Augmented AVL Interval Tree (`backend/app/data_structures/avl_tree.py`)
- **Syllabus Topic:** Unit 3: Trees (AVL Trees, Height Balancing, Rotations) & Interval Augmentation.
- **Core Nodes:** Custom `AVLNode` class storing compound key `(start_at, appointment_id)`, interval times (`start_at`, `end_at`), appointment details (`doctor_id`, `patient_id`, `status`), structural pointers (`left`, `right`), `height: int`, and augmented value `max_end_at: str`.
- **Compound Key Total Ordering:** Keys sort chronologically by start timestamp first, and appointment ID second. This allows parallel appointments for different doctors starting at the exact same minute without overwriting.
- **Self-Balancing Rotations:** Enforces balance factor $BF = \text{height(left)} - \text{height(right)} \in \{-1, 0, 1\}$ using 4-case rotations (LL, RR, LR, RL). Tree height is bounded by $h < 1.44 \log_2(N + 2)$.
- **Subtree Augmentation:**
  $$\text{node.max\_end\_at} = \max(\text{node.end\_at}, \text{node.left.max\_end\_at}, \text{node.right.max\_end\_at})$$
- **Interval Overlap Conflict Query:** Detects overlaps where $S_{\text{existing}} < E_{\text{new}}$ and $E_{\text{existing}} > S_{\text{new}}$. If `left.max_end_at <= S_new`, prunes the entire left branch, discovering conflicts in $O(\log N + K)$ time.
- **Double-Booking Policy:** Blocks overlapping active bookings for the same doctor OR same patient (HTTP 409 Conflict); permits simultaneous appointments for different doctors and patients; ignores `Cancelled` appointments.
- **Clinical Role:** Powers the chronological outpatient timeline and real-time scheduling conflict rejection.

### 4. Knuth-Morris-Pratt Pattern Matcher (`backend/app/data_structures/kmp.py`)
- **Syllabus Topic:** Unit 5: Text Processing & String Matching (Knuth-Morris-Pratt Algorithm).
- **Failure Table ($\pi$ / LPS):** Computes array where $\pi[j]$ is the length of the longest proper prefix of `pattern[0..j]` that is also a suffix of `pattern[0..j]`. Precomputed in $O(M)$ time.
- **Zero Backtracking Search:** Text pointer $i$ strictly increments from $0$ to $N - 1$. On mismatch, pattern pointer $j$ resets to $\pi[j - 1]$ without ever decrementing $i$. Pure $O(N + M)$ linear time without Python `in`, `str.find`, or `re`.
- **Mandatory Safety Disclaimer:** Appends `"Potential keyword match — clinician review required."` to every match result.
- **Clinical Role:** Rapid surveillance of unstructured clinical notes and allergies for contraindication terms (e.g. *"Penicillin"*, *"Latex"*, *"Shortness of breath"*).

---

## 4. Database Schema & Persistence Strategy

The system uses standard library `sqlite3` without any ORM to maintain strict relational control:
- **`doctors` table:** `doctor_id` (PK, e.g. `DOC-101`), `full_name`, `specialty`, `is_active`.
- **`patients` table:** `patient_id` (PK, e.g. `PT-1001`), `full_name`, `age`, `phone`, `email`, `allergies`, `medical_notes`, timestamps.
- **`appointments` table:** `appointment_id` (PK, e.g. `APT-2001`), `patient_id` (FK), `doctor_id` (FK), `start_at`, `end_at`, `duration_minutes`, `reason`, `status` (`Scheduled`, `Checked In`, `Completed`, `Cancelled`), timestamps.

### Write-Through Synchronization Order:
1. Every write operation commits first to SQLite via parameterized SQL transactions.
2. If SQLite succeeds, `HospitalIndexService` updates the in-memory Hash Table, Trie, and AVL Tree.
3. If SQLite fails, memory remains unmodified.
4. On startup, `HospitalIndexService.rebuild_indexes_from_db()` reads SQLite tables and reconstructs all in-memory data structures from scratch within milliseconds.

---

## 5. REST API & Real-Time SSE Specification

All REST endpoints reside under the `/api` prefix:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check and live ADS telemetry metrics |
| `GET` | `/api/dashboard/summary` | Executive summary, today's schedule, and telemetry |
| `POST` | `/api/system/reset-demo` | Resets SQLite to seed data and rebuilds in-memory structures |
| `GET` | `/api/patients` | List all patients from Hash Table |
| `GET` | `/api/patients/autocomplete` | Live prefix autocomplete via Standard Trie (`?prefix=...`) |
| `GET` | `/api/patients/{patient_id}` | Direct $O(1)$ Hash Table patient record lookup |
| `POST` | `/api/patients` | Register new patient (indexes into Hash Table & Trie) |
| `PUT` | `/api/patients/{patient_id}` | Update patient details (synchronizes Hash Table & Trie) |
| `DELETE`| `/api/patients/{patient_id}` | Delete patient (blocks with HTTP 409 if active appointments exist) |
| `GET` | `/api/doctors` | List all available doctors and specialties |
| `GET` | `/api/appointments` | Chronological schedule from AVL in-order traversal |
| `GET` | `/api/appointments/{id}` | Retrieve single appointment by ID |
| `POST` | `/api/appointments` | Book appointment (blocks with HTTP 409 on interval overlap) |
| `PUT` | `/api/appointments/{id}` | Reschedule appointment (validates AVL overlap) |
| `PATCH`| `/api/appointments/{id}/status`| Update status (`Checked In`, `Completed`, `Cancelled`) |
| `POST` | `/api/notes/search` | Search clinical notes via Knuth-Morris-Pratt matcher |
| `GET` | `/api/events` | Server-Sent Events (SSE) privacy-compliant real-time stream |

### Real-Time Privacy Rule:
Broadcast payloads on `/api/events` contain strictly:
`{"type": "appointment_changed", "entity_id": "APT-2001", "action": "create", "timestamp": "..."}`
Zero personal health information (PHI), names, phone numbers, allergies, or notes are transmitted over SSE. The frontend uses the event purely as a signal to fetch fresh data for the active view.

---

## 6. Frontend Pages & Components

The frontend is a clinical dark-mode SaaS dashboard built with React 18, TypeScript 5, Vite, and Lucide React icons:
- **`Layout.tsx`:** Brand badge, formatted local date, debounced Trie quick-search input, live connection status badge (Live SSE / Polling / Offline), quick-action buttons (`+ Register Patient`, `+ Book Appointment`), and prototype disclaimer footer.
- **`DashboardPage.tsx`:** 6 live metric cards (Total Patients, Today's Appointments, Checked-In, Completed, Cancelled, Scheduled), chronological today timeline with one-click Check In / Complete actions, recent registrations, and live ADS telemetry card.
- **`PatientsPage.tsx`:** Dual search system (Live Trie autocomplete vs. direct Hash Table $O(1)$ ID lookup with test presets), paginated directory table, detailed patient profile drawer with appointment history, and validated registration/edit/delete modals with 409 referential integrity handling.
- **`AppointmentsPage.tsx`:** Date picker with fast shortcuts (*Today*, *Previous Day*, *Next Day*, *All In-Order Tree Dates*), doctor and status filters, chronological timeline with status transitions, and booking modal featuring live Trie patient selection and a structured **AVL Interval Conflict Detected** alert box on double-booking attempts.
- **`NotesScannerPage.tsx`:** Scope selector, keyword chips (`Penicillin`, `Latex`, `Peanut allergy`, `Fever`, `Shortness of breath`), batch KMP scanning, safe React `<mark>` text highlighting, mandatory clinical safety banner, and an interactive **LPS ($\pi$) Table Inspector** displaying failure table values.
- **`AboutSettingsPage.tsx`:** Live diagnostic telemetry dials for all 4 structures, curriculum complexity comparison matrix, 5 collapsible viva defense Q&A accordions, and a one-click "Reset Demo Database" action.

---

## 7. Automated Test Suite & Live Verification

- **Backend Pytest Suite:** 53 unit and integration tests across 9 test files in `backend/tests/`. All 53 tests pass with 100% success rate in ~18 seconds.
- **Live Server Verification Script:** `backend/verify_live_api.py` boots Uvicorn on port 8000, validates live JSON responses for `/api/health`, `/api/dashboard/summary`, `/api/patients/autocomplete?prefix=a`, `/api/appointments`, and `/api/notes/search`, and shuts down cleanly.
- **Frontend Production Build:** Compiles cleanly with 0 TypeScript or bundling errors via `npm run build` (`vite build`, 1478 modules transformed).
