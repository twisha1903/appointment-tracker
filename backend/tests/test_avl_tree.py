import pytest
from app.data_structures.avl_tree import AppointmentAVLTree
from app.models.schemas import AppointmentResponse


def make_apt(
    apt_id: str,
    start_at: str,
    end_at: str,
    doctor_id: str = "DR-101",
    patient_id: str = "PT-1001",
    status: str = "Scheduled",
) -> AppointmentResponse:
    """Helper to generate mock AppointmentResponse instances."""
    return AppointmentResponse(
        appointment_id=apt_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=30,
        reason="Consultation",
        status=status,
        created_at="2026-10-25T08:00:00",
        updated_at="2026-10-25T08:00:00",
    )


def test_rotations_ll_rr_lr_rl():
    """Verify explicit 4-case rebalancing rotations and invariant preservation."""
    # 1. LL Rotation Case (Insert in decreasing order: 12:00, 11:00, 10:00)
    tree_ll = AppointmentAVLTree()
    tree_ll.insert(make_apt("APT-1", "2026-10-25T12:00:00", "2026-10-25T12:30:00"))
    tree_ll.insert(make_apt("APT-2", "2026-10-25T11:00:00", "2026-10-25T11:30:00"))
    tree_ll.insert(make_apt("APT-3", "2026-10-25T10:00:00", "2026-10-25T10:30:00"))

    assert tree_ll.root.appointment_id == "APT-2"  # 11:00 becomes root
    assert tree_ll.root.left.appointment_id == "APT-3"
    assert tree_ll.root.right.appointment_id == "APT-1"
    assert tree_ll.verify_invariants() is True

    # 2. RR Rotation Case (Insert in increasing order: 10:00, 11:00, 12:00)
    tree_rr = AppointmentAVLTree()
    tree_rr.insert(make_apt("APT-1", "2026-10-25T10:00:00", "2026-10-25T10:30:00"))
    tree_rr.insert(make_apt("APT-2", "2026-10-25T11:00:00", "2026-10-25T11:30:00"))
    tree_rr.insert(make_apt("APT-3", "2026-10-25T12:00:00", "2026-10-25T12:30:00"))

    assert tree_rr.root.appointment_id == "APT-2"  # 11:00 becomes root
    assert tree_rr.root.left.appointment_id == "APT-1"
    assert tree_rr.root.right.appointment_id == "APT-3"
    assert tree_rr.verify_invariants() is True

    # 3. LR Rotation Case (Insert: 12:00, 10:00, 11:00)
    tree_lr = AppointmentAVLTree()
    tree_lr.insert(make_apt("APT-1", "2026-10-25T12:00:00", "2026-10-25T12:30:00"))
    tree_lr.insert(make_apt("APT-2", "2026-10-25T10:00:00", "2026-10-25T10:30:00"))
    tree_lr.insert(make_apt("APT-3", "2026-10-25T11:00:00", "2026-10-25T11:30:00"))

    assert tree_lr.root.appointment_id == "APT-3"  # 11:00 becomes root
    assert tree_lr.root.left.appointment_id == "APT-2"
    assert tree_lr.root.right.appointment_id == "APT-1"
    assert tree_lr.verify_invariants() is True

    # 4. RL Rotation Case (Insert: 10:00, 12:00, 11:00)
    tree_rl = AppointmentAVLTree()
    tree_rl.insert(make_apt("APT-1", "2026-10-25T10:00:00", "2026-10-25T10:30:00"))
    tree_rl.insert(make_apt("APT-2", "2026-10-25T12:00:00", "2026-10-25T12:30:00"))
    tree_rl.insert(make_apt("APT-3", "2026-10-25T11:00:00", "2026-10-25T11:30:00"))

    assert tree_rl.root.appointment_id == "APT-3"  # 11:00 becomes root
    assert tree_rl.root.left.appointment_id == "APT-1"
    assert tree_rl.root.right.appointment_id == "APT-2"
    assert tree_rl.verify_invariants() is True


def test_bulk_insert_and_delete_stress():
    """Verify height balance, BST ordering, and max_end_at across 60 insertions and 30 deletions."""
    tree = AppointmentAVLTree()
    inserted_records = []

    # Insert 60 appointments across 5 different days
    for day in range(1, 6):
        for hour in range(8, 20):
            apt_id = f"APT-{day:02d}{hour:02d}"
            start_at = f"2026-10-{20 + day:02d}T{hour:02d}:00:00"
            end_at = f"2026-10-{20 + day:02d}T{hour:02d}:30:00"
            rec = make_apt(apt_id, start_at, end_at, doctor_id=f"DR-{101 + (hour % 4)}")
            tree.insert(rec)
            inserted_records.append(rec)
            assert tree.verify_invariants() is True

    assert len(tree) == 60

    # Delete 30 items (including leaves, single-child, and two-child nodes)
    for rec in inserted_records[:30]:
        deleted = tree.delete(rec.start_at, rec.appointment_id)
        assert deleted is True
        assert tree.verify_invariants() is True

    assert len(tree) == 30

    # Verify remaining 30 items are still found
    for rec in inserted_records[30:]:
        found = tree.search(rec.start_at, rec.appointment_id)
        assert found is not None
        assert found.appointment_id == rec.appointment_id


def test_in_order_chronological_traversal_and_simultaneous_starts():
    """Verify chronological ordering even when multiple appointments share the exact same start_at."""
    tree = AppointmentAVLTree()

    tree.insert(make_apt("APT-1", "2026-10-25T09:00:00", "2026-10-25T09:30:00", doctor_id="DR-101"))
    # Simultaneous appointment with different doctor:
    tree.insert(make_apt("APT-2", "2026-10-25T09:00:00", "2026-10-25T09:30:00", doctor_id="DR-102"))
    tree.insert(make_apt("APT-0", "2026-10-25T08:30:00", "2026-10-25T09:00:00", doctor_id="DR-103"))
    tree.insert(make_apt("APT-3", "2026-10-25T10:00:00", "2026-10-25T10:30:00", doctor_id="DR-104"))

    in_order = tree.in_order_traversal()
    ids_in_order = [apt.appointment_id for apt in in_order]
    assert ids_in_order == ["APT-0", "APT-1", "APT-2", "APT-3"]

    # Date prefix filtering
    tree.insert(make_apt("APT-TOMORROW", "2026-10-26T09:00:00", "2026-10-26T09:30:00"))
    oct25_only = tree.in_order_traversal(date_prefix="2026-10-25")
    assert len(oct25_only) == 4
    assert all(a.start_at.startswith("2026-10-25") for a in oct25_only)


def test_doctor_conflict_detection_variations():
    """Verify overlap conflict detection across exact, partial, and contained intervals for the same doctor."""
    tree = AppointmentAVLTree()
    # Baseline appointment: 10:00 to 11:00 for DR-101
    tree.insert(make_apt("APT-BASE", "2026-10-25T10:00:00", "2026-10-25T11:00:00", doctor_id="DR-101", patient_id="PT-1001"))

    # Case A: Exact overlap (10:00 to 11:00)
    conflicts_exact = tree.find_conflicts("2026-10-25T10:00:00", "2026-10-25T11:00:00", "DR-101", "PT-1002")
    assert len(conflicts_exact) == 1
    assert conflicts_exact[0]["conflicting_appointment_id"] == "APT-BASE"

    # Case B: Partial start overlap (09:45 to 10:15)
    conflicts_start = tree.find_conflicts("2026-10-25T09:45:00", "2026-10-25T10:15:00", "DR-101", "PT-1002")
    assert len(conflicts_start) == 1

    # Case C: Partial end overlap (10:45 to 11:30)
    conflicts_end = tree.find_conflicts("2026-10-25T10:45:00", "2026-10-25T11:30:00", "DR-101", "PT-1002")
    assert len(conflicts_end) == 1

    # Case D: Complete containment inside (10:15 to 10:45)
    conflicts_inside = tree.find_conflicts("2026-10-25T10:15:00", "2026-10-25T10:45:00", "DR-101", "PT-1002")
    assert len(conflicts_inside) == 1

    # Case E: Complete containment outside (09:30 to 11:30)
    conflicts_outside = tree.find_conflicts("2026-10-25T09:30:00", "2026-10-25T11:30:00", "DR-101", "PT-1002")
    assert len(conflicts_outside) == 1


def test_patient_conflict_detection_across_doctors():
    """Verify overlapping appointments for the same patient with two different doctors are blocked."""
    tree = AppointmentAVLTree()
    tree.insert(make_apt("APT-CARDIO", "2026-10-25T14:00:00", "2026-10-25T15:00:00", doctor_id="DR-101", patient_id="PT-1001"))

    # Patient PT-1001 attempts booking with Dr. Mehta (DR-102) from 14:30 to 15:30
    conflicts = tree.find_conflicts("2026-10-25T14:30:00", "2026-10-25T15:30:00", doctor_id="DR-102", patient_id="PT-1001")
    assert len(conflicts) == 1
    assert conflicts[0]["conflicting_appointment_id"] == "APT-CARDIO"
    assert conflicts[0]["conflict_type"] == "patient"


def test_back_to_back_and_different_parties_allowed():
    """Verify non-overlapping contiguous appointments and simultaneous bookings for different parties are allowed."""
    tree = AppointmentAVLTree()
    tree.insert(make_apt("APT-MAIN", "2026-10-25T10:00:00", "2026-10-25T10:30:00", doctor_id="DR-101", patient_id="PT-1001"))

    # Adjacent prior: 09:30 to 10:00 (end_at == existing.start_at)
    conflicts_prior = tree.find_conflicts("2026-10-25T09:30:00", "2026-10-25T10:00:00", "DR-101", "PT-1001")
    assert len(conflicts_prior) == 0

    # Adjacent next: 10:30 to 11:00 (start_at == existing.end_at)
    conflicts_next = tree.find_conflicts("2026-10-25T10:30:00", "2026-10-25T11:00:00", "DR-101", "PT-1001")
    assert len(conflicts_next) == 0

    # Simultaneous appointment with different doctor AND different patient
    conflicts_diff = tree.find_conflicts("2026-10-25T10:00:00", "2026-10-25T10:30:00", "DR-102", "PT-1002")
    assert len(conflicts_diff) == 0


def test_cancelled_status_and_reschedule_exclusion():
    """Verify cancelled appointments are ignored and exclude_appointment_id ignores self."""
    tree = AppointmentAVLTree()
    # Cancelled appointment with DR-101
    tree.insert(make_apt("APT-CANCELLED", "2026-10-25T10:00:00", "2026-10-25T11:00:00", doctor_id="DR-101", patient_id="PT-1001", status="Cancelled"))

    # New appointment at same time should have NO conflict with cancelled slot
    conflicts_cancelled = tree.find_conflicts("2026-10-25T10:15:00", "2026-10-25T10:45:00", "DR-101", "PT-1002")
    assert len(conflicts_cancelled) == 0

    # Active appointment
    tree.insert(make_apt("APT-ACTIVE", "2026-10-25T11:00:00", "2026-10-25T12:00:00", doctor_id="DR-101", patient_id="PT-1001", status="Scheduled"))

    # Rescheduling APT-ACTIVE to 11:15–12:15 excluding itself
    conflicts_reschedule = tree.find_conflicts(
        "2026-10-25T11:15:00",
        "2026-10-25T12:15:00",
        "DR-101",
        "PT-1001",
        exclude_appointment_id="APT-ACTIVE",
    )
    assert len(conflicts_reschedule) == 0
