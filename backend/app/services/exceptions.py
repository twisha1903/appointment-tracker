"""Domain exceptions for CareTrack hospital services."""

from typing import Any, List, Optional


class EntityNotFoundException(Exception):
    """Raised when a requested patient, doctor, or appointment does not exist."""

    def __init__(self, entity_type: str, entity_id: str):
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(f"{entity_type} with ID '{entity_id}' not found.")


class SchedulingConflictException(Exception):
    """Raised when an appointment overlaps with an existing booking for the same doctor or patient."""

    def __init__(self, conflicts: List[Any], message: Optional[str] = None):
        self.conflicts = conflicts
        if message:
            self.message = message
        else:
            conflict_details = []
            for c in conflicts:
                cid = c.get("conflicting_appointment_id", "Unknown")
                ctype = c.get("conflict_type", "schedule")
                s = c.get("start_at", "")
                e = c.get("end_at", "")
                conflict_details.append(f"Appointment {cid} ({s} to {e}, conflict on {ctype})")
            self.message = "Scheduling conflict detected: " + "; ".join(conflict_details)
        super().__init__(self.message)


class ActiveAppointmentsExistException(Exception):
    """Raised when attempting to delete a patient who still has active or scheduled appointments."""

    def __init__(self, patient_id: str, count: int = 1):
        self.patient_id = patient_id
        self.count = count
        super().__init__(
            f"Cannot delete patient '{patient_id}': Patient has {count} active/scheduled appointment(s). "
            "Please cancel appointments prior to deletion."
        )


class InvalidOperationException(Exception):
    """Raised when a domain validation or state transition fails."""

    def __init__(self, message: str):
        super().__init__(message)
