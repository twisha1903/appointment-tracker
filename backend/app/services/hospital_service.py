"""Hospital Index Service orchestrating in-memory ADS and SQLite persistence.

ADS Architecture:
- PatientHashTable: Authoritative in-memory patient registry for O(1) patient_id lookup.
- PatientNameTrie:   Prefix tree for character-by-character live autocomplete.
- AppointmentAVLTree: Augmented interval tree for chronological timeline & overlap conflict checks.
- KMP Pattern Matcher: Pure string scanning engine for allergies and clinical notes.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.data_structures.avl_tree import AppointmentAVLTree
from app.data_structures.hash_table import PatientHashTable
from app.data_structures.kmp import scan_clinical_text
from app.data_structures.trie import PatientNameTrie
from app.db.database import (
    create_appointment,
    create_patient,
    delete_patient,
    get_all_appointments,
    get_all_doctors,
    get_all_patients,
    init_db,
    patch_appointment_status,
    update_appointment,
    update_patient,
)
from app.db.seed import reset_and_seed_database
from app.models.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
    DoctorResponse,
    PatientCreate,
    PatientResponse,
    PatientUpdate,
    compute_end_at,
    normalize_iso_datetime,
)
from app.services.exceptions import (
    ActiveAppointmentsExistException,
    EntityNotFoundException,
    SchedulingConflictException,
)


class HospitalIndexService:
    """Service layer managing persistence and memory-synchronized Advanced Data Structures."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self.patient_hash_table = PatientHashTable(capacity=16)
        self.patient_trie = PatientNameTrie()
        self.appointment_avl = AppointmentAVLTree()
        self._doctor_cache: Dict[str, DoctorResponse] = {}

    def rebuild_indexes_from_db(self) -> Dict[str, int]:
        """Reconstruct in-memory ADS structures completely from persistent SQLite."""
        init_db(self.db_path)

        # 1. Clear in-memory structures
        self.patient_hash_table.clear()
        self.patient_trie.clear()
        self.appointment_avl.clear()
        self._doctor_cache.clear()

        # 2. Populate Doctors cache
        doctors = get_all_doctors(self.db_path)
        for doc in doctors:
            self._doctor_cache[doc.doctor_id] = doc

        # 3. Populate Patients into Custom Hash Table and Trie
        patients = get_all_patients(self.db_path)
        for p in patients:
            self.patient_hash_table.insert(p.patient_id, p)
            self.patient_trie.insert(p.full_name, p.patient_id)

        # 4. Populate Appointments into Augmented AVL Tree
        appointments = get_all_appointments(self.db_path)
        for apt in appointments:
            self.appointment_avl.insert(apt)

        return {
            "indexed_patients": len(self.patient_hash_table),
            "indexed_appointments": len(self.appointment_avl),
            "indexed_doctors": len(self._doctor_cache),
        }

    # --- Patient Operations ---

    def get_patient_by_id(self, patient_id: str) -> PatientResponse:
        """Retrieve patient directly from Custom Hash Table in O(1) expected time."""
        patient = self.patient_hash_table.get(patient_id)
        if not patient:
            raise EntityNotFoundException("Patient", patient_id)
        return patient

    def list_patients(self) -> List[PatientResponse]:
        """Return all patients from in-memory Hash Table, sorted by ID descending."""
        patients = self.patient_hash_table.values()
        # Sort by patient_id descending for clean, predictable presentation
        return sorted(patients, key=lambda p: p.patient_id, reverse=True)

    def autocomplete_patients(self, prefix: str, limit: int = 10) -> List[PatientResponse]:
        """Live autocomplete resolving matching Trie keys to full PatientResponse objects."""
        matching_ids = self.patient_trie.search_prefix(prefix, limit=limit)
        results: List[PatientResponse] = []
        for pid in matching_ids:
            p = self.patient_hash_table.get(pid)
            if p:
                results.append(p)
        return results

    def create_patient(self, payload: PatientCreate) -> PatientResponse:
        """Persist patient to SQLite and immediately index in Hash Table and Trie."""
        created = create_patient(payload, db_path=self.db_path)
        self.patient_hash_table.insert(created.patient_id, created)
        self.patient_trie.insert(created.full_name, created.patient_id)
        return created

    def update_patient(self, patient_id: str, payload: PatientUpdate) -> PatientResponse:
        """Update patient in SQLite, Hash Table, and Trie (refreshing appointment references)."""
        existing = self.get_patient_by_id(patient_id)

        updated = update_patient(patient_id, payload, db_path=self.db_path)
        if not updated:
            raise EntityNotFoundException("Patient", patient_id)

        # Update Hash Table
        self.patient_hash_table.insert(patient_id, updated)

        # Update Trie if full name was modified
        if payload.full_name and payload.full_name != existing.full_name:
            self.patient_trie.update(existing.full_name, updated.full_name, patient_id)

            # Refresh cached patient_name on appointments in AVL tree
            for apt in self.appointment_avl.in_order_traversal():
                if apt.patient_id == patient_id:
                    apt.patient_name = updated.full_name

        return updated

    def delete_patient(self, patient_id: str) -> bool:
        """Delete patient if no active appointments exist; updates SQLite, Hash Table, and Trie."""
        existing = self.get_patient_by_id(patient_id)

        # Check for active appointments in AVL tree
        all_apts = self.appointment_avl.in_order_traversal()
        active_apts = [
            a for a in all_apts
            if a.patient_id == patient_id and a.status in ("Scheduled", "Checked In")
        ]

        if active_apts:
            raise ActiveAppointmentsExistException(patient_id, len(active_apts))

        # Perform deletion in SQLite
        delete_patient(patient_id, db_path=self.db_path)

        # Synchronize in-memory structures
        self.patient_hash_table.delete(patient_id)
        self.patient_trie.remove(existing.full_name, patient_id)

        # Remove historical (cancelled/completed) appointments of this patient from AVL Tree
        for apt in all_apts:
            if apt.patient_id == patient_id:
                self.appointment_avl.delete(apt.start_at, apt.appointment_id)

        return True

    # --- Doctor Operations ---

    def get_all_doctors(self) -> List[DoctorResponse]:
        """Return cached list of doctors."""
        if not self._doctor_cache:
            doctors = get_all_doctors(self.db_path)
            for d in doctors:
                self._doctor_cache[d.doctor_id] = d
        return sorted(list(self._doctor_cache.values()), key=lambda d: d.full_name)

    def get_doctor_by_id(self, doctor_id: str) -> DoctorResponse:
        """Return doctor by ID or raise not found."""
        if doctor_id not in self._doctor_cache:
            doctors = get_all_doctors(self.db_path)
            for d in doctors:
                self._doctor_cache[d.doctor_id] = d

        doctor = self._doctor_cache.get(doctor_id)
        if not doctor:
            raise EntityNotFoundException("Doctor", doctor_id)
        return doctor

    # --- Appointment Operations ---

    def get_appointment_by_id(self, appointment_id: str) -> AppointmentResponse:
        """Find appointment across AVL tree records."""
        for apt in self.appointment_avl.in_order_traversal():
            if apt.appointment_id == appointment_id:
                return apt
        raise EntityNotFoundException("Appointment", appointment_id)

    def list_appointments(
        self,
        date_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        doctor_id: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> List[AppointmentResponse]:
        """List appointments in strict chronological order via AVL tree traversal."""
        apts = self.appointment_avl.in_order_traversal(date_prefix=date_filter)

        if status_filter:
            apts = [a for a in apts if a.status == status_filter]
        if doctor_id:
            apts = [a for a in apts if a.doctor_id == doctor_id]
        if patient_id:
            apts = [a for a in apts if a.patient_id == patient_id]

        return apts

    def create_appointment(self, payload: AppointmentCreate) -> AppointmentResponse:
        """Validate conflicts via AVL tree, commit to SQLite, and insert into AVL tree."""
        # 1. Verify patient exists in hash table
        self.get_patient_by_id(payload.patient_id)

        # 2. Verify doctor exists and is active
        doctor = self.get_doctor_by_id(payload.doctor_id)
        if not doctor.is_active:
            raise EntityNotFoundException("Doctor", f"{payload.doctor_id} (inactive)")

        # 3. Calculate interval
        start_at_norm = normalize_iso_datetime(payload.start_at)
        end_at_norm = compute_end_at(start_at_norm, payload.duration_minutes)

        # 4. Conflict detection via AVL Interval Tree
        if payload.status != "Cancelled":
            conflicts = self.appointment_avl.find_conflicts(
                start_at=start_at_norm,
                end_at=end_at_norm,
                doctor_id=payload.doctor_id,
                patient_id=payload.patient_id,
            )
            if conflicts:
                raise SchedulingConflictException(conflicts)

        # 5. Persist to SQLite
        created_apt = create_appointment(payload, db_path=self.db_path)

        # 6. Synchronize in-memory AVL tree
        self.appointment_avl.insert(created_apt)

        return created_apt

    def update_appointment(
        self, appointment_id: str, payload: AppointmentUpdate
    ) -> AppointmentResponse:
        """Reschedule/modify appointment with AVL interval conflict checking."""
        existing = self.get_appointment_by_id(appointment_id)

        new_doc_id = payload.doctor_id or existing.doctor_id
        new_start_at = (
            normalize_iso_datetime(payload.start_at) if payload.start_at else existing.start_at
        )
        new_duration = (
            payload.duration_minutes
            if payload.duration_minutes is not None
            else existing.duration_minutes
        )
        new_end_at = compute_end_at(new_start_at, new_duration)
        new_status = payload.status or existing.status

        # Verify conflict if appointment remains active
        if new_status != "Cancelled":
            conflicts = self.appointment_avl.find_conflicts(
                start_at=new_start_at,
                end_at=new_end_at,
                doctor_id=new_doc_id,
                patient_id=existing.patient_id,
                exclude_appointment_id=appointment_id,
            )
            if conflicts:
                raise SchedulingConflictException(conflicts)

        # Persist to SQLite
        updated_apt = update_appointment(appointment_id, payload, db_path=self.db_path)
        if not updated_apt:
            raise EntityNotFoundException("Appointment", appointment_id)

        # Rebalance in AVL tree (delete old key, insert new key)
        self.appointment_avl.delete(existing.start_at, appointment_id)
        self.appointment_avl.insert(updated_apt)

        return updated_apt

    def update_appointment_status(
        self, appointment_id: str, new_status: AppointmentStatus
    ) -> AppointmentResponse:
        """Change appointment status with collision check on restoration from Cancelled."""
        existing = self.get_appointment_by_id(appointment_id)

        # If un-cancelling, verify that the slot was not taken by another booking in the meantime
        if existing.status == "Cancelled" and new_status in ("Scheduled", "Checked In"):
            conflicts = self.appointment_avl.find_conflicts(
                start_at=existing.start_at,
                end_at=existing.end_at,
                doctor_id=existing.doctor_id,
                patient_id=existing.patient_id,
                exclude_appointment_id=appointment_id,
            )
            if conflicts:
                raise SchedulingConflictException(
                    conflicts,
                    message="Cannot restore cancelled appointment: the time slot is now occupied by another booking.",
                )

        patched_apt = patch_appointment_status(appointment_id, new_status, db_path=self.db_path)
        if not patched_apt:
            raise EntityNotFoundException("Appointment", appointment_id)

        # Synchronize AVL tree
        self.appointment_avl.delete(existing.start_at, appointment_id)
        self.appointment_avl.insert(patched_apt)

        return patched_apt

    # --- Clinical Notes KMP Scanner ---

    def scan_notes(
        self,
        query: Optional[str] = None,
        patient_id: Optional[str] = None,
        predefined_keywords: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Scan allergies and clinical notes across patients using the KMP matcher."""
        keywords: List[str] = []
        if query and query.strip():
            keywords.append(query.strip())
        if predefined_keywords:
            for kw in predefined_keywords:
                clean_kw = kw.strip()
                if clean_kw and clean_kw not in keywords:
                    keywords.append(clean_kw)

        if not keywords:
            keywords = ["Penicillin", "Latex", "Peanut", "Fever", "Shortness of breath"]

        # Scope patients
        if patient_id:
            target_patients = [self.get_patient_by_id(patient_id)]
        else:
            target_patients = self.patient_hash_table.values()

        patient_match_cards: List[Dict[str, Any]] = []
        total_occurrences = 0

        for p in target_patients:
            combined_text = f"Allergies: {p.allergies}\nClinical Notes: {p.medical_notes}"
            scan_result = scan_clinical_text(combined_text, keywords, context_window=45)

            if scan_result["total_matches"] > 0 or patient_id is not None:
                total_occurrences += scan_result["total_matches"]
                patient_match_cards.append({
                    "patient_id": p.patient_id,
                    "full_name": p.full_name,
                    "age": p.age,
                    "allergies": p.allergies,
                    "medical_notes": p.medical_notes,
                    "total_matches": scan_result["total_matches"],
                    "matches_by_keyword": scan_result["matches_by_keyword"],
                    "all_matches": scan_result["all_matches"],
                })

        return {
            "safety_notice": "Potential keyword match — clinician review required.",
            "scanned_keywords": keywords,
            "total_patients_matched": len([c for c in patient_match_cards if c["total_matches"] > 0]),
            "total_occurrences": total_occurrences,
            "results": patient_match_cards,
        }

    # --- Dashboard Summary & Diagnostics ---

    def get_dashboard_summary(self, today_date: Optional[str] = None) -> Dict[str, Any]:
        """Aggregate dashboard metrics and real-time ADS telemetry for viva inspection."""
        today = today_date or datetime.now().strftime("%Y-%m-%d")

        all_appointments = self.appointment_avl.in_order_traversal()
        todays_appointments = [a for a in all_appointments if a.start_at.startswith(today)]

        checked_in = sum(1 for a in todays_appointments if a.status == "Checked In")
        completed = sum(1 for a in todays_appointments if a.status == "Completed")
        cancelled = sum(1 for a in todays_appointments if a.status == "Cancelled")
        scheduled = sum(1 for a in todays_appointments if a.status == "Scheduled")

        all_patients = self.list_patients()

        # Telemetry from each custom ADS instance
        return {
            "today_date": today,
            "counts": {
                "patients": len(self.patient_hash_table),
                "doctors": len(self.get_all_doctors()),
                "appointments": len(self.appointment_avl),
                "total_patients": len(self.patient_hash_table),
                "total_appointments": len(self.appointment_avl),
                "todays_appointments": len(todays_appointments),
                "scheduled": scheduled,
                "checked_in": checked_in,
                "completed": completed,
                "cancelled": cancelled,
            },
            "recent_patients": all_patients[:5],
            "todays_schedule": todays_appointments,
            "ads_telemetry": {
                "hash_table": self.patient_hash_table.get_stats(),
                "trie": self.patient_trie.get_stats(),
                "avl_tree": self.appointment_avl.get_stats(),
            },
        }

    # --- Demo Reset ---

    def reset_demo_data(self) -> Dict[str, Any]:
        """Wipe database, reseed with deterministic viva records, and refresh memory indexes."""
        reset_and_seed_database(self.db_path)
        counts = self.rebuild_indexes_from_db()
        return {
            "status": "reset_successful",
            "indexed_entities": counts,
        }
