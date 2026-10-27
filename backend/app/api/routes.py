"""FastAPI REST Route Controllers for CareTrack Hospital Management System."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse

from app.models.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentStatusPatch,
    AppointmentUpdate,
    DoctorResponse,
    NotesSearchRequest,
    PatientCreate,
    PatientDetailResponse,
    PatientResponse,
    PatientUpdate,
)
from app.services.event_broadcaster import broadcaster
from app.services.exceptions import (
    ActiveAppointmentsExistException,
    EntityNotFoundException,
    InvalidOperationException,
    SchedulingConflictException,
)
from app.services.hospital_service import HospitalIndexService

router = APIRouter(prefix="/api", tags=["Hospital API"])

# Global singleton or dependency injector
_default_service: Optional[HospitalIndexService] = None


def get_service() -> HospitalIndexService:
    """Dependency provider for HospitalIndexService."""
    global _default_service
    if _default_service is None:
        _default_service = HospitalIndexService()
        _default_service.rebuild_indexes_from_db()
    return _default_service


def set_service_instance(service: Optional[HospitalIndexService]) -> None:
    """Explicitly assign service instance for tests and startup hooks."""
    global _default_service
    _default_service = service


# --- Real-Time Server-Sent Events (SSE) Endpoint ---

@router.get("/events")
async def stream_events():
    """Server-Sent Events endpoint pushing real-time change notifications to clients."""
    return StreamingResponse(
        broadcaster.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- General & System Endpoints ---

@router.get("/health")
def get_health(service: HospitalIndexService = Depends(get_service)) -> Dict[str, Any]:
    """Return health status, database connectivity, and ADS telemetry."""
    summary = service.get_dashboard_summary()
    return {
        "status": "ok",
        "database": "connected",
        "counts": summary["counts"],
        "ads_telemetry": summary["ads_telemetry"],
    }


@router.get("/dashboard/summary")
def get_dashboard_summary(
    date: Optional[str] = Query(None, description="Filter date in YYYY-MM-DD format"),
    service: HospitalIndexService = Depends(get_service),
) -> Dict[str, Any]:
    """Retrieve executive clinical summary, today's schedule, and ADS metrics."""
    return service.get_dashboard_summary(today_date=date)


@router.post("/system/reset-demo")
def reset_demo_data(service: HospitalIndexService = Depends(get_service)) -> Dict[str, Any]:
    """Reset SQLite to initial deterministic fictional seed data and re-index memory structures."""
    result = service.reset_demo_data()
    broadcaster.broadcast(event_type="system_reset", action="reset")
    return result


# --- Patient Endpoints ---

@router.get("/patients", response_model=List[PatientResponse])
def list_patients(service: HospitalIndexService = Depends(get_service)):
    """List all registered patients from the in-memory Hash Table."""
    return service.list_patients()


@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    service: HospitalIndexService = Depends(get_service),
):
    """Register a new patient; commits to SQLite and indexes into Hash Table and Trie."""
    try:
        created = service.create_patient(payload)
        broadcaster.broadcast(
            event_type="patient_changed",
            entity_id=created.patient_id,
            action="create",
        )
        return created
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/patients/autocomplete", response_model=List[PatientResponse])
def autocomplete_patients(
    prefix: str = Query(..., min_length=1, description="Name prefix to autocomplete"),
    limit: int = Query(10, ge=1, le=50, description="Maximum matches to return"),
    service: HospitalIndexService = Depends(get_service),
):
    """Perform live patient name autocomplete using character Trie prefix search.

    (CRITICAL: Defined BEFORE /patients/{patient_id} to avoid route masking).
    """
    return service.autocomplete_patients(prefix=prefix, limit=limit)


@router.get("/patients/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    patient_id: str,
    service: HospitalIndexService = Depends(get_service),
):
    """Retrieve patient record from Hash Table in O(1) expected time with appointments."""
    try:
        patient = service.get_patient_by_id(patient_id)
        appointments = service.list_appointments(patient_id=patient_id)
        return PatientDetailResponse(
            patient_id=patient.patient_id,
            full_name=patient.full_name,
            age=patient.age,
            phone=patient.phone,
            email=patient.email,
            allergies=patient.allergies,
            medical_notes=patient.medical_notes,
            created_at=patient.created_at,
            updated_at=patient.updated_at,
            appointments=appointments,
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/patients/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    service: HospitalIndexService = Depends(get_service),
):
    """Update patient information in SQLite, Hash Table, and Trie."""
    try:
        updated = service.update_patient(patient_id, payload)
        broadcaster.broadcast(
            event_type="patient_changed",
            entity_id=patient_id,
            action="update",
        )
        return updated
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/patients/{patient_id}")
def delete_patient(
    patient_id: str,
    service: HospitalIndexService = Depends(get_service),
):
    """Delete patient if referential safety conditions are met."""
    try:
        service.delete_patient(patient_id)
        broadcaster.broadcast(
            event_type="patient_changed",
            entity_id=patient_id,
            action="delete",
        )
        return {"status": "deleted", "patient_id": patient_id}
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ActiveAppointmentsExistException as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "ActiveAppointmentsExist",
                "detail": str(e),
                "patient_id": e.patient_id,
                "active_count": e.count,
            },
        )


# --- Doctor Endpoints ---

@router.get("/doctors", response_model=List[DoctorResponse])
def list_doctors(service: HospitalIndexService = Depends(get_service)):
    """List all available healthcare providers."""
    return service.get_all_doctors()


# --- Appointment Endpoints ---

@router.get("/appointments", response_model=List[AppointmentResponse])
def list_appointments(
    date: Optional[str] = Query(None, description="Filter date in YYYY-MM-DD format"),
    status: Optional[AppointmentStatus] = Query(None, description="Filter by status"),
    doctor_id: Optional[str] = Query(None, description="Filter by doctor ID"),
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    service: HospitalIndexService = Depends(get_service),
):
    """List appointments chronologically via Augmented AVL Tree in-order traversal."""
    return service.list_appointments(
        date_filter=date,
        status_filter=status,
        doctor_id=doctor_id,
        patient_id=patient_id,
    )


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: str,
    service: HospitalIndexService = Depends(get_service),
):
    """Retrieve appointment by ID."""
    try:
        return service.get_appointment_by_id(appointment_id)
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    service: HospitalIndexService = Depends(get_service),
):
    """Create appointment with Augmented AVL Tree overlap conflict detection."""
    try:
        created = service.create_appointment(payload)
        broadcaster.broadcast(
            event_type="appointment_changed",
            entity_id=created.appointment_id,
            action="create",
        )
        return created
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except SchedulingConflictException as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder({
                "error": "SchedulingConflict",
                "detail": e.message,
                "conflicts": e.conflicts,
            }),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    service: HospitalIndexService = Depends(get_service),
):
    """Reschedule or modify appointment with interval conflict validation."""
    try:
        updated = service.update_appointment(appointment_id, payload)
        broadcaster.broadcast(
            event_type="appointment_changed",
            entity_id=appointment_id,
            action="update",
        )
        return updated
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except SchedulingConflictException as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder({
                "error": "SchedulingConflict",
                "detail": e.message,
                "conflicts": e.conflicts,
            }),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentResponse)
def patch_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusPatch,
    service: HospitalIndexService = Depends(get_service),
):
    """Patch appointment status with collision prevention upon restoring cancelled slots."""
    try:
        patched = service.update_appointment_status(appointment_id, payload.status)
        broadcaster.broadcast(
            event_type="appointment_changed",
            entity_id=appointment_id,
            action="status_change",
        )
        return patched
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except SchedulingConflictException as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder({
                "error": "SchedulingConflict",
                "detail": e.message,
                "conflicts": e.conflicts,
            }),
        )


# --- Clinical Notes KMP Scanner Endpoint ---

@router.post("/notes/search")
def search_clinical_notes(
    payload: NotesSearchRequest,
    service: HospitalIndexService = Depends(get_service),
) -> Dict[str, Any]:
    """Scan clinical records using the custom Knuth-Morris-Pratt pattern matching algorithm."""
    try:
        return service.scan_notes(
            patient_id=payload.patient_id,
            predefined_keywords=payload.keywords,
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
