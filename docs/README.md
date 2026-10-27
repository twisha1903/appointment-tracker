# CareTrack Academic Documentation & Viva Portal

Welcome to the comprehensive academic and architectural documentation suite for **CareTrack — The Hospital Patient & Appointment Tracker**.

---

### Documentation Suite Directory

1. **[ADS_JUSTIFICATION.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/docs/ADS_JUSTIFICATION.md):**
   - Syllabus alignment for all 4 custom data structures (Unit 2 Hashing, Unit 5 Tries, Unit 3 AVL Trees, Unit 5 Pattern Matching).
   - Comparative matrix contrasting each structure against naive approaches ($O(N)$ linear scans, SQL `LIKE '%...%'`, unaugmented BSTs, and naive string search).
   - Codebase location proofs.

2. **[ARCHITECTURE.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/docs/ARCHITECTURE.md):**
   - In-memory computational layer paired with transactional SQLite persistence.
   - Startup cold-boot re-hydration sequence and crash recovery protocol.
   - Write-through atomic synchronization order between SQLite and memory structures.
   - Server-Sent Events (SSE) privacy architecture with zero Personal Health Information (PHI) leakage.

3. **[TEST_PLAN.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/docs/TEST_PLAN.md):**
   - Full automated test suite documentation (53 tests across 9 suites).
   - Edge case catalogue (hash collisions, table doubling, duplicate names, 4-case rotations, interval overlaps, LPS table verification).
   - Execution guides for Windows PowerShell and Command Prompt.

4. **[VIVA_PREPARATION.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/docs/VIVA_PREPARATION.md):**
   - Detailed model answers for all 16 core viva defense questions.
   - Mathematical complexity proofs and rotation conditions.

5. **[DEMO_WALKTHROUGH.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/docs/DEMO_WALKTHROUGH.md):**
   - Timed 5-to-7 minute live viva demonstration script.
   - Step-by-step click guide, sample inputs, screen callouts, and VS Code code references.

---

*For the complete 20-section master project specification, refer to the root [README.md](file:///c:/Users/twipa/OneDrive/Desktop/ads/README.md).*
