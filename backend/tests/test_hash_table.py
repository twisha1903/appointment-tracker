import pytest
from app.data_structures.hash_table import HashNode, PatientHashTable
from app.models.schemas import PatientResponse


def create_sample_patient(patient_id: str, name: str, age: int = 30) -> PatientResponse:
    return PatientResponse(
        patient_id=patient_id,
        full_name=name,
        age=age,
        phone="+91 99999 00000",
        email=f"{patient_id.lower()}@example.com",
        allergies="None",
        medical_notes="Routine checkup.",
        created_at="2026-10-25T10:00:00",
        updated_at="2026-10-25T10:00:00",
    )


def test_basic_insert_and_get():
    """Verify insertion, retrieval, size tracking, and membership checks."""
    ht = PatientHashTable(capacity=8)
    assert len(ht) == 0
    assert ht.get("PT-1001") is None

    p1 = create_sample_patient("PT-1001", "Aarav Sharma")
    p2 = create_sample_patient("PT-1002", "Meera Patel")
    p3 = create_sample_patient("PT-1003", "Rajesh Verma")

    ht.insert("PT-1001", p1)
    ht.insert("PT-1002", p2)
    ht.insert("PT-1003", p3)

    assert len(ht) == 3
    assert ht.contains("PT-1001") is True
    assert "PT-1002" in ht
    assert ht.contains("PT-9999") is False

    assert ht.get("PT-1001").full_name == "Aarav Sharma"
    assert ht.get("PT-1002").full_name == "Meera Patel"
    assert ht.get("PT-1003").full_name == "Rajesh Verma"

    stored_keys = ht.keys()
    assert set(stored_keys) == {"PT-1001", "PT-1002", "PT-1003"}
    assert len(ht.values()) == 3


def test_in_place_update():
    """Verify updating an existing patient_id updates the node in-place without size inflation."""
    ht = PatientHashTable(capacity=8)
    p_orig = create_sample_patient("PT-1001", "Aarav Sharma", age=28)
    ht.insert("PT-1001", p_orig)
    assert len(ht) == 1
    assert ht.get("PT-1001").age == 28

    # Update with new patient data
    p_updated = create_sample_patient("PT-1001", "Aarav Sharma", age=29)
    ht.insert("PT-1001", p_updated)

    assert len(ht) == 1  # Size must NOT inflate
    assert ht.get("PT-1001").age == 29
    assert len(ht.values()) == 1


def test_forced_hash_collisions():
    """Test separate chaining preserves and correctly resolves colliding keys."""
    # Force heavy collisions by using capacity=2 and disabling premature rehash
    ht = PatientHashTable(capacity=2, max_load_factor=10.0)

    keys = [f"PT-{i}" for i in range(1001, 1009)]
    for k in keys:
        ht.insert(k, create_sample_patient(k, f"Patient {k}"))

    assert len(ht) == 8
    assert ht.collision_count > 0

    stats = ht.get_stats()
    assert stats["max_chain_length"] >= 2
    assert stats["non_empty_buckets"] <= 2

    # Verify every single colliding record is retrievable intact
    for k in keys:
        record = ht.get(k)
        assert record is not None
        assert record.patient_id == k
        assert record.full_name == f"Patient {k}"


def test_deletion_head_middle_tail():
    """Verify unlinking nodes from head, interior/middle, and tail of a collision chain."""
    ht = PatientHashTable(capacity=4, max_load_factor=10.0)

    # Find 3 keys that hash to the EXACT same bucket index
    colliding_keys = []
    candidate_id = 1
    target_bucket = None

    while len(colliding_keys) < 3:
        key = f"KEY-{candidate_id}"
        b = ht._hash(key)
        if target_bucket is None:
            target_bucket = b
            colliding_keys.append(key)
        elif b == target_bucket:
            colliding_keys.append(key)
        candidate_id += 1

    k1, k2, k3 = colliding_keys
    # Insertion prepends at head:
    # After inserting k1: [k1]
    # After inserting k2: [k2 -> k1]
    # After inserting k3: [k3 -> k2 -> k1]
    # Head = k3, Middle = k2, Tail = k1
    ht.insert(k1, f"Val-{k1}")
    ht.insert(k2, f"Val-{k2}")
    ht.insert(k3, f"Val-{k3}")
    assert len(ht) == 3

    # 1. Delete middle node (k2)
    assert ht.delete(k2) is True
    assert len(ht) == 2
    assert ht.get(k2) is None
    assert ht.get(k3) == f"Val-{k3}"
    assert ht.get(k1) == f"Val-{k1}"

    # Re-insert k2 to restore 3-node chain: [k2 -> k3 -> k1]
    ht.insert(k2, f"Val-{k2}")
    assert len(ht) == 3

    # 2. Delete head node (k2 is now head)
    assert ht.delete(k2) is True
    assert len(ht) == 2
    assert ht.get(k2) is None
    assert ht.get(k3) == f"Val-{k3}"
    assert ht.get(k1) == f"Val-{k1}"

    # 3. Delete tail node (k1 is tail)
    assert ht.delete(k1) is True
    assert len(ht) == 1
    assert ht.get(k1) is None
    assert ht.get(k3) == f"Val-{k3}"

    # 4. Delete the final remaining node (k3)
    assert ht.delete(k3) is True
    assert len(ht) == 0
    assert ht.get(k3) is None
    assert ht.buckets[target_bucket] is None


def test_non_existent_key_operations():
    """Verify operations on non-existent keys fail gracefully."""
    ht = PatientHashTable(capacity=8)
    ht.insert("PT-1001", create_sample_patient("PT-1001", "Aarav"))

    assert ht.get("NON_EXISTENT") is None
    assert ht.contains("NON_EXISTENT") is False
    assert "NON_EXISTENT" not in ht
    assert ht.delete("NON_EXISTENT") is False
    assert len(ht) == 1


def test_dynamic_resizing_and_rehashing():
    """Verify table doubles capacity and re-indexes all entries when load_factor exceeds threshold."""
    # capacity = 4, max_load_factor = 0.75 -> threshold is 4 * 0.75 = 3 items
    ht = PatientHashTable(capacity=4, max_load_factor=0.75)
    assert ht.capacity == 4

    p1 = create_sample_patient("PT-1001", "Patient 1")
    p2 = create_sample_patient("PT-1002", "Patient 2")
    p3 = create_sample_patient("PT-1003", "Patient 3")

    ht.insert("PT-1001", p1)
    ht.insert("PT-1002", p2)
    ht.insert("PT-1003", p3)

    assert len(ht) == 3
    assert ht.capacity == 4  # 3/4 = 0.75, not yet > 0.75

    # Insert 4th item -> load factor 4/4 = 1.0 > 0.75 -> rehash triggers
    p4 = create_sample_patient("PT-1004", "Patient 4")
    ht.insert("PT-1004", p4)

    assert ht.capacity == 8  # Capacity doubled
    assert len(ht) == 4
    assert ht.load_factor() == 4 / 8  # 0.5

    # Verify all previously inserted items are still accessible
    for pid in ["PT-1001", "PT-1002", "PT-1003", "PT-1004"]:
        rec = ht.get(pid)
        assert rec is not None
        assert rec.patient_id == pid

    # Trigger second rehash: threshold for capacity 8 is 8 * 0.75 = 6 items
    p5 = create_sample_patient("PT-1005", "Patient 5")
    p6 = create_sample_patient("PT-1006", "Patient 6")
    p7 = create_sample_patient("PT-1007", "Patient 7")
    ht.insert("PT-1005", p5)
    ht.insert("PT-1006", p6)
    ht.insert("PT-1007", p7)

    assert ht.capacity == 16  # Doubled again to 16
    assert len(ht) == 7

    stats = ht.get_stats()
    assert stats["capacity"] == 16
    assert stats["size"] == 7
    assert stats["load_factor"] == round(7 / 16, 4)


def test_clear_and_stats():
    """Verify clear resets the table and stats reflect internal structure."""
    ht = PatientHashTable(capacity=8)
    ht.insert("PT-1001", create_sample_patient("PT-1001", "Aarav"))
    ht.insert("PT-1002", create_sample_patient("PT-1002", "Meera"))

    stats_before = ht.get_stats()
    assert stats_before["size"] == 2
    assert stats_before["non_empty_buckets"] >= 1

    ht.clear()
    assert len(ht) == 0
    assert ht.values() == []
    assert ht.keys() == []

    stats_after = ht.get_stats()
    assert stats_after["size"] == 0
    assert stats_after["non_empty_buckets"] == 0
    assert stats_after["max_chain_length"] == 0
