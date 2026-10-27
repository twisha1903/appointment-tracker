import asyncio
import json
import pytest
from fastapi.testclient import TestClient

from app.api.routes import broadcaster, set_service_instance
from app.db.database import init_db
from app.db.seed import seed_database
from app.main import app
from app.services.event_broadcaster import EventBroadcaster
from app.services.hospital_service import HospitalIndexService


@pytest.mark.anyio
async def test_event_broadcaster_subscribe_and_privacy():
    """Verify subscription connection frame, event fan-out, and privacy guard."""
    test_broadcaster = EventBroadcaster(heartbeat_interval=1.0)
    assert test_broadcaster.subscriber_count == 0

    sub_gen = test_broadcaster.subscribe()
    # 1. First event must be connection confirmation
    connect_frame = await anext(sub_gen)
    assert connect_frame.startswith("data: ")
    connect_data = json.loads(connect_frame[6:].strip())
    assert connect_data["type"] == "connected"
    assert "timestamp" in connect_data
    assert test_broadcaster.subscriber_count == 1

    # 2. Broadcast change event
    test_broadcaster.broadcast(
        event_type="patient_changed",
        entity_id="PT-1001",
        action="update",
    )

    event_frame = await anext(sub_gen)
    assert event_frame.startswith("data: ")
    event_data = json.loads(event_frame[6:].strip())
    assert event_data["type"] == "patient_changed"
    assert event_data["entity_id"] == "PT-1001"
    assert event_data["action"] == "update"
    assert "timestamp" in event_data

    # PRIVACY VERIFICATION: Ensure no clinical or personal fields are exposed
    for forbidden in ["allergies", "medical_notes", "notes", "full_name", "phone", "email"]:
        assert forbidden not in event_data

    # 3. Clean disconnect on generator exit
    await sub_gen.aclose()
    assert test_broadcaster.subscriber_count == 0


@pytest.mark.anyio
async def test_multi_subscriber_fanout_and_full_queue_resilience():
    """Verify fan-out across multiple subscribers and non-blocking drop for overflowing queues."""
    test_broadcaster = EventBroadcaster()

    # Subscriber 1
    gen1 = test_broadcaster.subscribe()
    await anext(gen1)  # discard connect frame

    # Subscriber 2
    gen2 = test_broadcaster.subscribe()
    await anext(gen2)  # discard connect frame

    assert test_broadcaster.subscriber_count == 2

    # Broadcast to both
    test_broadcaster.broadcast("appointment_changed", entity_id="APT-2001", action="create")

    frame1 = await anext(gen1)
    frame2 = await anext(gen2)
    assert json.loads(frame1[6:])["entity_id"] == "APT-2001"
    assert json.loads(frame2[6:])["entity_id"] == "APT-2001"

    # Fill Subscriber 1's queue to the limit (100) to trigger overflow
    for q in list(test_broadcaster._subscribers):
        while not q.full():
            q.put_nowait({"type": "filler"})

    # Broadcasting to full queue must not crash or raise QueueFull
    payload = test_broadcaster.broadcast("system_reset", action="reset")
    assert payload["type"] == "system_reset"

    await gen1.aclose()
    await gen2.aclose()


def test_api_mutations_emit_broadcast_events(tmp_path, monkeypatch):
    """Verify patient and appointment API mutations publish broadcast notifications."""
    db_file = str(tmp_path / "events_test.db")
    monkeypatch.setenv("CARETRACK_DB_PATH", db_file)
    init_db(db_file)
    seed_database(db_file)
    service = HospitalIndexService(db_file)
    service.rebuild_indexes_from_db()
    set_service_instance(service)

    # Attach a test queue directly to the global broadcaster
    test_queue = asyncio.Queue()
    broadcaster._subscribers.add(test_queue)

    try:
        with TestClient(app) as client:
            # 1. Patient creation mutation
            res_pt = client.post("/api/patients", json={
                "full_name": "Rina Mukherjee",
                "age": 42,
                "allergies": "None",
                "medical_notes": "Healthy.",
            })
            assert res_pt.status_code == 201
            assert not test_queue.empty()
            pt_event = test_queue.get_nowait()
            assert pt_event["type"] == "patient_changed"
            assert pt_event["action"] == "create"
            assert pt_event["entity_id"] == res_pt.json()["patient_id"]

            # 2. Appointment status patch mutation
            res_apt = client.patch("/api/appointments/APT-2001/status", json={
                "status": "Checked In"
            })
            assert res_apt.status_code == 200
            assert not test_queue.empty()
            apt_event = test_queue.get_nowait()
            assert apt_event["type"] == "appointment_changed"
            assert apt_event["action"] == "status_change"
            assert apt_event["entity_id"] == "APT-2001"

            # 3. System reset mutation
            res_reset = client.post("/api/system/reset-demo")
            assert res_reset.status_code == 200
            assert not test_queue.empty()
            reset_event = test_queue.get_nowait()
            assert reset_event["type"] == "system_reset"
            assert reset_event["action"] == "reset"
    finally:
        broadcaster._subscribers.discard(test_queue)
        set_service_instance(None)
