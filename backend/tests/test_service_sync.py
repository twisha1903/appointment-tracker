import os
import pytest

from app.db.database import get_patient_by_id as get_patient_from_db, init_db
from app.db.seed import seed_database
from app.models.schemas import AppointmentCreate, PatientCreate, PatientUpdate
from app.services.exceptions import (
    ActiveAppointmentsExistException,
    EntityNotFoundException,
    SchedulingConflictException,
)
from app.services.hospital_service import HospitalIndexService


@pytest.fixture
def synced_service(tmp_path):
    """Fixture providing a fresh HospitalIndexService connected to a seeded temporary database."""
    db_file = str(tmp_path / "sync_caretrack.db")
    init_db(db_file)
    seed_database(db_file)
    service = HospitalIndexService(db_file)
    service.rebuild_indexes_from_db()
    return service, db_file


def test_startup_index_reconstruction(synced_service):
    """Verify that startup index rebuild hydrates Hash Table, Trie, and AVL Tree from SQLite."""
    service, _ = synced_service

    stats = service.rebuild_indexes_from_db()
    assert stats["indexed_patients"] == 9
    assert stats["indexed_appointments"] == 7
    assert stats["indexed_doctors"] == 4

    # Custom Hash Table O(1) patient lookup
    p1 = service.get_patient_by_id("PT-1001")
    assert p1.full_name == "Aarav Sharma"
    assert p1.age == 28

    # Trie duplicate-name resolution
    autocomplete_aarav = service.autocomplete_patients("aarav")
    assert len(autocomplete_aarav) == 2
    assert {p.patient_id for p in autocomplete_aarav} == {"PT-1001", "PT-1002"}

    # AVL Tree chronological timeline
    chronological_apts = service.list_appointments()
    assert len(chronological_apts) == 7
    for i in range(len(chronological_apts) - 1):
        assert chronological_apts[i].start_at <= chronological_apts[i + 1].start_at


def test_patient_mutation_synchronization(synced_service):
    """Verify create, rename, and delete synchronize SQLite, Hash Table, and Trie immediately."""
    service, db_path = synced_service

    # 1. Create Patient
    created = service.create_patient(
        PatientCreate(
            full_name="Siddharth Roy",
            age=40,
            phone="+91 98765 00000",
            email="siddharth.roy@example.com",
            allergies="None",
            medical_notes="Regular checkup.",
        )
    )
    pid = created.patient_id

    # Verify present in in-memory Hash Table, Trie, and SQLite
    assert service.get_patient_by_id(pid).full_name == "Siddharth Roy"
    assert any(p.patient_id == pid for p in service.autocomplete_patients("siddharth"))
    assert any(p.patient_id == pid for p in service.autocomplete_patients("roy"))
    db_record = get_patient_from_db(pid, db_path=db_path)
    assert db_record is not None

    # 2. Rename Patient (Update Trie paths)
    updated = service.update_patient(pid, PatientUpdate(full_name="Siddharth Sen"))
    assert updated.full_name == "Siddharth Sen"
    assert service.get_patient_by_id(pid).full_name == "Siddharth Sen"
    # Old surname should not match
    assert not any(p.patient_id == pid for p in service.autocomplete_patients("roy"))
    # New surname should match
    assert any(p.patient_id == pid for p in service.autocomplete_patients("sen"))

    # 3. Delete Patient
    deleted = service.delete_patient(pid)
    assert deleted is True
    with pytest.raises(EntityNotFoundException):
        service.get_patient_by_id(pid)
    assert not any(p.patient_id == pid for p in service.autocomplete_patients("siddharth"))
    assert get_patient_from_db(pid, db_path=db_path) is None


def test_conflict_rejection_and_slot_freeing_on_cancellation(synced_service):
    """Verify AVL conflict rejection for same doctor / patient, and slot freeing on cancellation."""
    service, _ = synced_service
    # Baseline: APT-2002 is today from 10:00 to 10:45 with DR-101 and PT-1002 (Status: Checked In)
    base_apt = service.get_appointment_by_id("APT-2002")
    start_time = base_apt.start_at
    date_part = start_time.split("T")[0]

    # Attempt 1: Overlapping booking for same doctor (DR-101) with different patient
    with pytest.raises(SchedulingConflictException) as exc_info:
        service.create_appointment(
            AppointmentCreate(
                patient_id="PT-1005",
                doctor_id="DR-101",
                start_at=f"{date_part}T10:15:00",
                duration_minutes=30,
                reason="Conflicting doctor consult",
            )
        )
    assert "APT-2002" in str(exc_info.value)

    # Attempt 2: Overlapping booking for same patient (PT-1002) with different doctor
    with pytest.raises(SchedulingConflictException) as exc_info2:
        service.create_appointment(
            AppointmentCreate(
                patient_id="PT-1002",
                doctor_id="DR-104",
                start_at=f"{date_part}T10:30:00",
                duration_minutes=30,
                reason="Conflicting patient consult",
            )
        )
    assert "APT-2002" in str(exc_info2.value)

    # Cancel APT-2002 to free the time slot
    service.update_appointment_status("APT-2002", "Cancelled")

    # Now booking the exact same slot for DR-101 must SUCCEED
    new_apt = service.create_appointment(
        AppointmentCreate(
            patient_id="PT-1005",
            doctor_id="DR-101",
            start_at=f"{date_part}T10:00:00",
            duration_minutes=30,
            reason="Slot re-opened consult",
        )
    )
    assert new_apt.appointment_id != "APT-2002"
    assert new_apt.doctor_id == "DR-101"

    # Attempting to restore APT-2002 back to 'Scheduled' must now be blocked
    with pytest.raises(SchedulingConflictException):
        service.update_appointment_status("APT-2002", "Scheduled")


def test_application_restart_simulation(synced_service):
    """Verify that simulating an application restart hydrates newly created entities accurately."""
    service_1, db_path = synced_service

    # Create patient and appointment on service_1
    p = service_1.create_patient(
        PatientCreate(
            full_name="Tara Bose",
            age=29,
            phone="+91 97777 88888",
            email="tara.bose@example.com",
            allergies="Latex",
            medical_notes="Pre-op clearance.",
        )
    )
    today = service_1.get_appointment_by_id("APT-2001").start_at.split("T")[0]
    apt = service_1.create_appointment(
        AppointmentCreate(
            patient_id=p.patient_id,
            doctor_id="DR-103",
            start_at=f"{today}T17:00:00",
            duration_minutes=30,
            reason="Pre-op clearance review",
        )
    )

    # Instantiate completely fresh service simulating restart
    service_2 = HospitalIndexService(db_path)
    counts = service_2.rebuild_indexes_from_db()

    assert counts["indexed_patients"] == 10
    assert counts["indexed_appointments"] == 8

    # Verify Hash Table O(1) lookup
    restored_p = service_2.get_patient_by_id(p.patient_id)
    assert restored_p.full_name == "Tara Bose"

    # Verify Trie autocomplete
    assert any(pt.patient_id == p.patient_id for pt in service_2.autocomplete_patients("tara"))

    # Verify AVL tree chronological search
    restored_apt = service_2.get_appointment_by_id(apt.appointment_id)
    assert restored_apt.appointment_id == apt.appointment_id
    assert restored_apt.doctor_id == "DR-103"


def test_kmp_clinical_scan_and_dashboard_telemetry(synced_service):
    """Verify clinical notes scanner and dashboard telemetry reporting."""
    service, _ = synced_service

    # Scan for Penicillin across all patients
    scan_report = service.scan_notes(query="Penicillin")
    assert scan_report["safety_notice"] == "Potential keyword match — clinician review required."
    assert scan_report["total_occurrences"] >= 2
    assert scan_report["total_patients_matched"] >= 2

    # Verify Dashboard Summary telemetry
    summary = service.get_dashboard_summary()
    assert "ads_telemetry" in summary
    ads = summary["ads_telemetry"]
    assert "hash_table" in ads
    assert "trie" in ads
    assert "avl_tree" in ads
    assert ads["hash_table"]["size"] == 9
    assert ads["avl_tree"]["size"] == 7
