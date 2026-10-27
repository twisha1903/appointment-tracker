from datetime import datetime, timedelta
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

AppointmentStatus = Literal["Scheduled", "Checked In", "Completed", "Cancelled"]


def compute_end_at(start_at_str: str, duration_minutes: int) -> str:
    """Derive end_at strictly from start_at + duration_minutes in ISO-8601 format."""
    dt = datetime.fromisoformat(start_at_str)
    end_dt = dt + timedelta(minutes=duration_minutes)
    return end_dt.strftime("%Y-%m-%dT%H:%M:%S")


def normalize_iso_datetime(dt_str: str) -> str:
    """Normalize datetime strings to standard YYYY-MM-DDTHH:MM:SS."""
    dt = datetime.fromisoformat(dt_str)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


# --- Patient Models ---

class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=130)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=100)
    allergies: str = Field(default="", max_length=2000)
    medical_notes: str = Field(default="", max_length=5000)

    @field_validator("full_name")
    @classmethod
    def strip_and_validate_name(cls, v: str) -> str:
        clean = " ".join(v.split())
        if len(clean) < 2:
            raise ValueError("Patient full name must be at least 2 characters after trimming.")
        return clean


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=130)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=100)
    allergies: Optional[str] = Field(None, max_length=2000)
    medical_notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = " ".join(v.split())
        if len(clean) < 2:
            raise ValueError("Patient full name must be at least 2 characters after trimming.")
        return clean


class PatientResponse(PatientBase):
    patient_id: str
    created_at: str
    updated_at: str


class PatientDetailResponse(PatientResponse):
    appointments: list["AppointmentResponse"] = []


class NotesSearchRequest(BaseModel):
    keywords: Optional[list[str]] = None
    keyword: Optional[str] = None
    patient_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_keywords_present(self):
        kws = list(self.keywords or [])
        if self.keyword and self.keyword.strip():
            kws.append(self.keyword.strip())

        clean_kws = [k.strip() for k in kws if k and k.strip()]
        if not clean_kws:
            raise ValueError("At least one non-empty keyword must be provided for clinical search.")
        self.keywords = clean_kws
        return self


# --- Doctor Models ---

class DoctorResponse(BaseModel):
    doctor_id: str
    full_name: str
    specialty: str
    is_active: bool = True


# --- Appointment Models ---

class AppointmentCreate(BaseModel):
    patient_id: str
    doctor_id: str
    start_at: str
    duration_minutes: int = Field(default=30, ge=10, le=240)
    reason: str = Field(..., min_length=2, max_length=300)
    status: AppointmentStatus = "Scheduled"

    @field_validator("start_at")
    @classmethod
    def validate_start_at(cls, v: str) -> str:
        try:
            return normalize_iso_datetime(v)
        except Exception:
            raise ValueError("start_at must be a valid ISO datetime format (e.g., YYYY-MM-DDTHH:MM:SS)")


class AppointmentUpdate(BaseModel):
    doctor_id: Optional[str] = None
    start_at: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=10, le=240)
    reason: Optional[str] = Field(None, min_length=2, max_length=300)
    status: Optional[AppointmentStatus] = None

    @field_validator("start_at")
    @classmethod
    def validate_start_at(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        try:
            return normalize_iso_datetime(v)
        except Exception:
            raise ValueError("start_at must be a valid ISO datetime format (e.g., YYYY-MM-DDTHH:MM:SS)")


class AppointmentStatusPatch(BaseModel):
    status: AppointmentStatus


class AppointmentResponse(BaseModel):
    appointment_id: str
    patient_id: str
    doctor_id: str
    start_at: str
    end_at: str
    duration_minutes: int
    reason: str
    status: AppointmentStatus
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    created_at: str
    updated_at: str
