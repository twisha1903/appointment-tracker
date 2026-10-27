import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.db.database import (
    create_appointment,
    create_patient,
    delete_appointment,
    delete_patient,
    get_all_appointments,
    get_all_doctors,
    get_all_patients,
    get_appointment_by_id,
    get_connection,
    get_doctor_by_id,
    get_entity_counts,
    get_next_appointment_id,
    get_next_patient_id,
    get_patient_by_id,
    init_db,
    patch_appointment_status,
    update_appointment,
    update_patient,
)
from app.db.seed import reset_and_seed_database, seed_database, seed_database_if_empty
from app.main import app
from app.models.schemas import AppointmentCreate, PatientCreate, PatientUpdate, AppointmentUpdate


@pytest.fixture
def temp_db(tmp_path):
    """Fixture providing an isolated temporary SQLite database."""
    db_file = str(tmp_path / "test_caretrack.db")
    init_db(db_file)
    return db_file


def test_schema_and_seeding(temp_db):
    """Verify table creation, deterministic seeding, and duplicate-name handling."""
    # Seed empty database
    assert seed_database_if_empty(temp_db) is True
    # Second call should not re-seed
    assert seed_database_if_empty(temp_db) is False

    counts = get_entity_counts(temp_db)
    assert counts["doctors"] == 4
    assert counts["patients"] == 9
    assert counts["appointments"] == 7

    # Check duplicate name requirement for Trie viva demo
    patients = get_all_patients(temp_db)
    aarav_records = [p for p in patients if p.full_name == "Aarav Sharma"]
    assert len(aarav_records) >= 2
    assert aarav_records[0].patient_id != aarav_records[1].patient_id
    assert aarav_records[0].age != aarav_records[1].age

    # Verify reset_and_seed_database works idempotently
    reset_and_seed_database(temp_db)
    counts_after_reset = get_entity_counts(temp_db)
    assert counts_after_reset == counts


def test_next_id_generation(temp_db):
    """Verify sequential ID generation for patients and appointments."""
    seed_database(temp_db)
    next_pid = get_next_patient_id(temp_db)
    assert next_pid == "PT-1010"

    next_aid = get_next_appointment_id(temp_db)
    assert next_aid == "APT-2008"


def test_patient_crud_and_validation(temp_db):
    """Verify patient creation, retrieval, updates, and deletion."""
    seed_database(temp_db)

    # 1. Create Patient
    new_patient = PatientCreate(
        full_name="  Vikram  Aditya  ",  # Trimming test
        age=37,
        phone="+91 98760 12345",
        email="vikram.aditya@example.com",
        allergies="Penicillin",
        medical_notes="Evaluated for recurring migraine headaches.",
    )
    created = create_patient(new_patient, db_path=temp_db)
    assert created.patient_id == "PT-1010"
    assert created.full_name == "Vikram Aditya"  # Whitespace stripped
    assert created.age == 37

    # 2. Get by ID
    fetched = get_patient_by_id("PT-1010", temp_db)
    assert fetched is not None
    assert fetched.email == "vikram.aditya@example.com"

    # 3. Update Patient
    updated = update_patient(
        "PT-1010",
        PatientUpdate(age=38, email="vikram.new@example.com"),
        db_path=temp_db
    )
    assert updated is not None
    assert updated.age == 38
    assert updated.email == "vikram.new@example.com"
    assert updated.full_name == "Vikram Aditya"  # Preserved

    # 4. Delete patient without appointments
    deleted = delete_patient("PT-1010", temp_db)
    assert deleted is True
    assert get_patient_by_id("PT-1010", temp_db) is None


def test_patient_deletion_restriction_on_active_appointments(temp_db):
    """Verify deletion is blocked when patient has active/scheduled appointments."""
    seed_database(temp_db)
    # PT-1002 has a 'Checked In' appointment (APT-2002)
    with pytest.raises(ValueError, match="Cannot delete patient PT-1002"):
        delete_patient("PT-1002", temp_db)


def test_foreign_key_enforcement(temp_db):
    """Verify SQLite PRAGMA foreign_keys = ON prevents dangling references."""
    seed_database(temp_db)
    with get_connection(temp_db) as conn:
        cursor = conn.cursor()
        # Inserting appointment with non-existent patient should fail
        with pytest.raises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO appointments (
                    appointment_id, patient_id, doctor_id, start_at, end_at,
                    duration_minutes, reason, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                "APT-9999", "PT-9999", "DR-101", "2026-10-25T10:00:00",
                "2026-10-25T10:30:00", 30, "Invalid FK test", "Scheduled",
                "2026-10-25T00:00:00", "2026-10-25T00:00:00"
            ))

        # Inserting appointment with non-existent doctor should fail
        with pytest.raises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO appointments (
                    appointment_id, patient_id, doctor_id, start_at, end_at,
                    duration_minutes, reason, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                "APT-9998", "PT-1001", "DR-999", "2026-10-25T10:00:00",
                "2026-10-25T10:30:00", 30, "Invalid FK test", "Scheduled",
                "2026-10-25T00:00:00", "2026-10-25T00:00:00"
            ))


def test_appointment_crud_and_duration_derivation(temp_db):
    """Verify appointment creation, end_at calculation, patching, and deletion."""
    seed_database(temp_db)

    # 1. Create appointment and verify derived end_at
    apt_data = AppointmentCreate(
        patient_id="PT-1005",
        doctor_id="DR-102",
        start_at="2026-10-26T09:15:00",
        duration_minutes=45,
        reason="Follow-up on allergy testing",
        status="Scheduled",
    )
    created = create_appointment(apt_data, db_path=temp_db)
    assert created.appointment_id == "APT-2008"
    assert created.start_at == "2026-10-26T09:15:00"
    assert created.end_at == "2026-10-26T10:00:00"
    assert created.patient_name == "Sneha Kulkarni"
    assert created.doctor_name == "Dr. Rohan Mehta"
    assert created.doctor_specialty == "Pediatrics"

    # 2. Update appointment
    updated = update_appointment(
        "APT-2008",
        AppointmentUpdate(duration_minutes=60, reason="Extended allergy testing"),
        db_path=temp_db,
    )
    assert updated is not None
    assert updated.duration_minutes == 60
    assert updated.end_at == "2026-10-26T10:15:00"
    assert updated.reason == "Extended allergy testing"

    # 3. Patch status
    patched = patch_appointment_status("APT-2008", "Completed", db_path=temp_db)
    assert patched is not None
    assert patched.status == "Completed"

    # 4. Delete appointment
    assert delete_appointment("APT-2008", db_path=temp_db) is True
    assert get_appointment_by_id("APT-2008", db_path=temp_db) is None


def test_health_api_endpoint(monkeypatch, temp_db):
    """Verify GET /api/health returns database connectivity and accurate counts."""
    seed_database(temp_db)
    monkeypatch.setenv("CARETRACK_DB_PATH", temp_db)

    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert data["counts"]["doctors"] == 4
        assert data["counts"]["patients"] == 9
        assert data["counts"]["appointments"] == 7
