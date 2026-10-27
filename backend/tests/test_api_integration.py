from datetime import datetime
import pytest
from fastapi.testclient import TestClient

from app.api.routes import set_service_instance
from app.db.database import init_db
from app.db.seed import seed_database
from app.main import app
from app.services.hospital_service import HospitalIndexService


@pytest.fixture
def client_and_service(tmp_path, monkeypatch):
    """Fixture initializing an isolated database and wiring it into FastAPI app."""
    db_file = str(tmp_path / "api_test.db")
    monkeypatch.setenv("CARETRACK_DB_PATH", db_file)
    init_db(db_file)
    seed_database(db_file)
    service = HospitalIndexService(db_file)
    service.rebuild_indexes_from_db()
    set_service_instance(service)

    with TestClient(app) as client:
        yield client, service

    set_service_instance(None)


def test_health_and_dashboard_summary(client_and_service):
    """Verify GET /api/health and GET /api/dashboard/summary return correct structure and telemetry."""
    client, _ = client_and_service

    # Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    health_data = res_health.json()
    assert health_data["status"] == "ok"
    assert health_data["database"] == "connected"
    assert health_data["counts"]["total_patients"] == 9
    assert health_data["counts"]["total_appointments"] == 7
    assert "ads_telemetry" in health_data

    # Dashboard summary
    res_dash = client.get("/api/dashboard/summary")
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    assert "counts" in dash_data
    assert "ads_telemetry" in dash_data
    assert "hash_table" in dash_data["ads_telemetry"]
    assert "trie" in dash_data["ads_telemetry"]
    assert "avl_tree" in dash_data["ads_telemetry"]


def test_patient_crud_and_referential_deletion(client_and_service):
    """Verify patient registration (201), lookup, update, and referential deletion protection (409)."""
    client, _ = client_and_service

    # 1. Register new patient
    new_pt_payload = {
        "full_name": "Devika Sen",
        "age": 31,
        "phone": "+91 98888 11111",
        "email": "devika.sen@example.com",
        "allergies": "Sulfa",
        "medical_notes": "Allergic rhinitis.",
    }
    res_create = client.post("/api/patients", json=new_pt_payload)
    assert res_create.status_code == 201
    created = res_create.json()
    pid = created["patient_id"]
    assert pid == "PT-1010"
    assert created["full_name"] == "Devika Sen"

    # 2. Retrieve patient profile with appointments
    res_get = client.get(f"/api/patients/{pid}")
    assert res_get.status_code == 200
    detail = res_get.json()
    assert detail["patient_id"] == pid
    assert detail["appointments"] == []

    # 3. Update patient details
    res_put = client.put(f"/api/patients/{pid}", json={"age": 32, "allergies": "Sulfa, Aspirin"})
    assert res_put.status_code == 200
    updated = res_put.json()
    assert updated["age"] == 32
    assert updated["allergies"] == "Sulfa, Aspirin"

    # 4. Attempt to delete patient PT-1002 who has active appointments -> Expect HTTP 409 Conflict
    res_del_blocked = client.delete("/api/patients/PT-1002")
    assert res_del_blocked.status_code == 409
    assert res_del_blocked.json()["error"] == "ActiveAppointmentsExist"

    # 5. Delete newly created patient (no appointments) -> Expect HTTP 200
    res_del_ok = client.delete(f"/api/patients/{pid}")
    assert res_del_ok.status_code == 200
    assert res_del_ok.json()["status"] == "deleted"

    # 6. Verify 404 on deleted patient
    res_get_deleted = client.get(f"/api/patients/{pid}")
    assert res_get_deleted.status_code == 404


def test_trie_autocomplete_endpoint(client_and_service):
    """Verify Trie autocomplete routing, case insensitivity, and duplicate-name handling."""
    client, _ = client_and_service

    # Autocomplete 'aarav' should match BOTH Aarav Sharma records (PT-1001 and PT-1002)
    res_auto = client.get("/api/patients/autocomplete?prefix=aarav")
    assert res_auto.status_code == 200
    matches = res_auto.json()
    assert len(matches) == 2
    match_ids = {p["patient_id"] for p in matches}
    assert match_ids == {"PT-1001", "PT-1002"}

    # Case insensitivity test ('AARAV')
    res_upper = client.get("/api/patients/autocomplete?prefix=AARAV")
    assert res_upper.status_code == 200
    assert len(res_upper.json()) == 2

    # Nonexistent prefix
    res_none = client.get("/api/patients/autocomplete?prefix=zzzzzz")
    assert res_none.status_code == 200
    assert res_none.json() == []


def test_appointment_chronological_ordering_and_get(client_and_service):
    """Verify GET /api/appointments returns records strictly sorted chronologically."""
    client, _ = client_and_service

    res = client.get("/api/appointments")
    assert res.status_code == 200
    apts = res.json()
    assert len(apts) == 7

    # Verify chronological sequence
    for i in range(len(apts) - 1):
        assert apts[i]["start_at"] <= apts[i + 1]["start_at"]

    # Retrieve single appointment
    res_single = client.get("/api/appointments/APT-2001")
    assert res_single.status_code == 200
    assert res_single.json()["appointment_id"] == "APT-2001"

    # Nonexistent appointment 404
    res_missing = client.get("/api/appointments/APT-9999")
    assert res_missing.status_code == 404


def test_conflict_rejection_and_different_parties_allowed(client_and_service):
    """Verify AVL conflict detection returns 409 for doctor/patient overlaps, and 201 when parties differ."""
    client, _ = client_and_service

    # APT-2002 is today from 10:00 to 10:45 with DR-101 and PT-1002
    res_apt2 = client.get("/api/appointments/APT-2002")
    start_time = res_apt2.json()["start_at"]
    date_part = start_time.split("T")[0]

    # 1. Overlapping booking for same doctor (DR-101) -> 409 Conflict
    conflict_dr_payload = {
        "patient_id": "PT-1005",
        "doctor_id": "DR-101",
        "start_at": f"{date_part}T10:15:00",
        "duration_minutes": 30,
        "reason": "Doctor conflict test",
    }
    res_conflict_dr = client.post("/api/appointments", json=conflict_dr_payload)
    assert res_conflict_dr.status_code == 409
    body_dr = res_conflict_dr.json()
    assert body_dr["error"] == "SchedulingConflict"
    assert len(body_dr["conflicts"]) >= 1

    # 2. Overlapping booking for same patient (PT-1002) with different doctor -> 409 Conflict
    conflict_pt_payload = {
        "patient_id": "PT-1002",
        "doctor_id": "DR-103",
        "start_at": f"{date_part}T10:20:00",
        "duration_minutes": 30,
        "reason": "Patient conflict test",
    }
    res_conflict_pt = client.post("/api/appointments", json=conflict_pt_payload)
    assert res_conflict_pt.status_code == 409
    body_pt = res_conflict_pt.json()
    assert body_pt["error"] == "SchedulingConflict"

    # 3. Simultaneous booking for DIFFERENT doctor AND DIFFERENT patient -> 201 Created
    diff_payload = {
        "patient_id": "PT-1005",
        "doctor_id": "DR-103",
        "start_at": f"{date_part}T10:15:00",
        "duration_minutes": 30,
        "reason": "Simultaneous different parties test",
    }
    res_diff = client.post("/api/appointments", json=diff_payload)
    assert res_diff.status_code == 201
    assert res_diff.json()["doctor_id"] == "DR-103"


def test_cancellation_frees_slot_for_new_booking(client_and_service):
    """Verify that patching status to Cancelled immediately frees that slot in the AVL tree."""
    client, _ = client_and_service

    # Retrieve APT-2002 info
    res_apt2 = client.get("/api/appointments/APT-2002")
    apt2 = res_apt2.json()
    date_part = apt2["start_at"].split("T")[0]

    # Patch APT-2002 to Cancelled
    res_patch = client.patch("/api/appointments/APT-2002/status", json={"status": "Cancelled"})
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "Cancelled"

    # Now booking the exact same time slot for DR-101 succeeds with 201 Created
    res_rebook = client.post("/api/appointments", json={
        "patient_id": "PT-1005",
        "doctor_id": "DR-101",
        "start_at": f"{date_part}T10:00:00",
        "duration_minutes": 30,
        "reason": "Re-booked after cancellation",
    })
    assert res_rebook.status_code == 201
    assert res_rebook.json()["status"] == "Scheduled"


def test_kmp_notes_search_endpoint(client_and_service):
    """Verify POST /api/notes/search runs KMP matcher, returning matches, LPS table, and safety notice."""
    client, _ = client_and_service

    # Valid clinical scan
    res_scan = client.post("/api/notes/search", json={
        "keywords": ["Penicillin", "Latex"],
    })
    assert res_scan.status_code == 200
    scan_data = res_scan.json()

    assert scan_data["safety_notice"] == "Potential keyword match — clinician review required."
    assert scan_data["total_occurrences"] >= 2
    assert "results" in scan_data

    # Check match structure on one of the matched patients
    matched_patient = next(p for p in scan_data["results"] if p["total_matches"] > 0)
    assert "matches_by_keyword" in matched_patient
    assert "all_matches" in matched_patient
    first_match = matched_patient["all_matches"][0]
    assert "snippet" in first_match
    assert "lps_table" in first_match

    # Empty keyword validation error -> 422
    res_empty = client.post("/api/notes/search", json={"keywords": []})
    assert res_empty.status_code == 422


def test_reset_demo_endpoint(client_and_service):
    """Verify POST /api/system/reset-demo resets database and re-indexes all ADS structures."""
    client, _ = client_and_service

    res_reset = client.post("/api/system/reset-demo")
    assert res_reset.status_code == 200
    data = res_reset.json()
    assert data["status"] == "reset_successful"
    assert data["indexed_entities"]["indexed_patients"] == 9
    assert data["indexed_entities"]["indexed_appointments"] == 7
    assert data["indexed_entities"]["indexed_doctors"] == 4


def test_appointment_reschedule_conflict_and_status_transitions(client_and_service):
    """Verify rescheduling an appointment into an existing slot triggers 409 conflict, and valid status transitions work."""
    client, _ = client_and_service

    # Retrieve APT-2001 (09:00 - 09:30) and APT-2002 (10:00 - 10:45)
    apt1 = client.get("/api/appointments/APT-2001").json()
    apt2 = client.get("/api/appointments/APT-2002").json()
    date_part = apt1["start_at"].split("T")[0]

    # 1. Transition APT-2001 to Checked In
    res_checkin = client.patch("/api/appointments/APT-2001/status", json={"status": "Checked In"})
    assert res_checkin.status_code == 200
    assert res_checkin.json()["status"] == "Checked In"

    # 2. Transition APT-2001 to Completed
    res_comp = client.patch("/api/appointments/APT-2001/status", json={"status": "Completed"})
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "Completed"

    # 3. Attempt to reschedule APT-2003 into APT-2002's slot (both DR-101) -> 409 Conflict
    res_reschedule_conflict = client.put("/api/appointments/APT-2003", json={
        "doctor_id": apt2["doctor_id"],
        "start_at": apt2["start_at"],
        "duration_minutes": 30,
        "reason": "Conflicting reschedule",
    })
    assert res_reschedule_conflict.status_code == 409
    assert res_reschedule_conflict.json()["error"] == "SchedulingConflict"


def test_appointment_filtering_by_doctor_and_status(client_and_service):
    """Verify GET /api/appointments supports filtering by doctor_id, status, and patient_id."""
    client, _ = client_and_service

    # Filter by doctor DR-101
    res_doc = client.get("/api/appointments?doctor_id=DR-101")
    assert res_doc.status_code == 200
    doc_apts = res_doc.json()
    assert len(doc_apts) >= 1
    assert all(a["doctor_id"] == "DR-101" for a in doc_apts)

    # Filter by status Scheduled
    res_status = client.get("/api/appointments?status=Scheduled")
    assert res_status.status_code == 200
    sched_apts = res_status.json()
    assert all(a["status"] == "Scheduled" for a in sched_apts)

    # Filter by patient PT-1001
    res_pt = client.get("/api/appointments?patient_id=PT-1001")
    assert res_pt.status_code == 200
    pt_apts = res_pt.json()
    assert all(a["patient_id"] == "PT-1001" for a in pt_apts)

