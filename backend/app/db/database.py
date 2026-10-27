from datetime import datetime
import os
import re
import sqlite3
from typing import Dict, List, Optional

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

DEFAULT_DB_PATH = os.environ.get(
    "CARETRACK_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "caretrack.db")
)


def get_db_path(custom_path: Optional[str] = None) -> str:
    """Return configured database path and ensure directory exists."""
    path = custom_path or os.environ.get("CARETRACK_DB_PATH", DEFAULT_DB_PATH)
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    return path


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Open an SQLite connection with PRAGMA foreign_keys = ON and Row factory."""
    resolved_path = get_db_path(db_path)
    conn = sqlite3.connect(resolved_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize database tables with foreign keys and indexes."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Patients table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                patient_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                age INTEGER,
                phone TEXT,
                email TEXT,
                allergies TEXT NOT NULL DEFAULT '',
                medical_notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Doctors table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctors (
                doctor_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                specialty TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
        """)

        # Appointments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                appointment_id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                doctor_id TEXT NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
                FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE RESTRICT
            );
        """)

        # Supporting indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);")
        
        conn.commit()


# --- ID Generator Utilities ---

def get_next_patient_id(db_path: Optional[str] = None) -> str:
    """Generate next sequential patient ID (e.g., PT-1001, PT-1002)."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT patient_id FROM patients WHERE patient_id LIKE 'PT-%';")
        rows = cursor.fetchall()

    max_num = 1000
    for row in rows:
        match = re.search(r"PT-(\d+)", row["patient_id"])
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num

    return f"PT-{max_num + 1}"


def get_next_appointment_id(db_path: Optional[str] = None) -> str:
    """Generate next sequential appointment ID (e.g., APT-2001, APT-2002)."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT appointment_id FROM appointments WHERE appointment_id LIKE 'APT-%';")
        rows = cursor.fetchall()

    max_num = 2000
    for row in rows:
        match = re.search(r"APT-(\d+)", row["appointment_id"])
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num

    return f"APT-{max_num + 1}"


# --- Patients Repository ---

def get_all_patients(db_path: Optional[str] = None) -> List[PatientResponse]:
    """Retrieve all patients sorted alphabetically by name."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT patient_id, full_name, age, phone, email, allergies, medical_notes, created_at, updated_at
            FROM patients
            ORDER BY full_name ASC, patient_id ASC;
        """)
        rows = cursor.fetchall()
        return [PatientResponse(**dict(r)) for r in rows]


def get_patient_by_id(patient_id: str, db_path: Optional[str] = None) -> Optional[PatientResponse]:
    """Retrieve single patient by ID."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT patient_id, full_name, age, phone, email, allergies, medical_notes, created_at, updated_at
            FROM patients
            WHERE patient_id = ?;
        """, (patient_id,))
        row = cursor.fetchone()
        return PatientResponse(**dict(row)) if row else None


def create_patient(
    patient_data: PatientCreate,
    db_path: Optional[str] = None,
    patient_id: Optional[str] = None
) -> PatientResponse:
    """Insert a new patient with parameterized query inside transaction."""
    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    resolved_id = patient_id or get_next_patient_id(db_path)

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO patients (patient_id, full_name, age, phone, email, allergies, medical_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            resolved_id,
            patient_data.full_name,
            patient_data.age,
            patient_data.phone,
            patient_data.email,
            patient_data.allergies,
            patient_data.medical_notes,
            now_iso,
            now_iso,
        ))
        conn.commit()

    return PatientResponse(
        patient_id=resolved_id,
        full_name=patient_data.full_name,
        age=patient_data.age,
        phone=patient_data.phone,
        email=patient_data.email,
        allergies=patient_data.allergies,
        medical_notes=patient_data.medical_notes,
        created_at=now_iso,
        updated_at=now_iso,
    )


def update_patient(
    patient_id: str,
    update_data: PatientUpdate,
    db_path: Optional[str] = None
) -> Optional[PatientResponse]:
    """Update patient fields selectively."""
    current = get_patient_by_id(patient_id, db_path)
    if not current:
        return None

    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    full_name = update_data.full_name if update_data.full_name is not None else current.full_name
    age = update_data.age if update_data.age is not None else current.age
    phone = update_data.phone if update_data.phone is not None else current.phone
    email = update_data.email if update_data.email is not None else current.email
    allergies = update_data.allergies if update_data.allergies is not None else current.allergies
    medical_notes = update_data.medical_notes if update_data.medical_notes is not None else current.medical_notes

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE patients
            SET full_name = ?, age = ?, phone = ?, email = ?, allergies = ?, medical_notes = ?, updated_at = ?
            WHERE patient_id = ?;
        """, (
            full_name,
            age,
            phone,
            email,
            allergies,
            medical_notes,
            now_iso,
            patient_id,
        ))
        conn.commit()

    return get_patient_by_id(patient_id, db_path)


def delete_patient(patient_id: str, db_path: Optional[str] = None) -> bool:
    """Delete a patient if they have no active/scheduled appointments."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        # Check if patient exists
        cursor.execute("SELECT patient_id FROM patients WHERE patient_id = ?;", (patient_id,))
        if not cursor.fetchone():
            return False

        # Check for active appointments
        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM appointments
            WHERE patient_id = ? AND status IN ('Scheduled', 'Checked In');
        """, (patient_id,))
        active_count = cursor.fetchone()["cnt"]

        if active_count > 0:
            raise ValueError(
                f"Cannot delete patient {patient_id}: Patient has {active_count} active appointment(s). "
                "Please cancel or complete appointments first."
            )

        # Remove historical appointments (or restrict)
        cursor.execute("DELETE FROM appointments WHERE patient_id = ?;", (patient_id,))
        cursor.execute("DELETE FROM patients WHERE patient_id = ?;", (patient_id,))
        conn.commit()

    return True


# --- Doctors Repository ---

def get_all_doctors(db_path: Optional[str] = None) -> List[DoctorResponse]:
    """Retrieve all active doctors."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT doctor_id, full_name, specialty, is_active
            FROM doctors
            ORDER BY full_name ASC;
        """)
        rows = cursor.fetchall()
        return [DoctorResponse(
            doctor_id=r["doctor_id"],
            full_name=r["full_name"],
            specialty=r["specialty"],
            is_active=bool(r["is_active"])
        ) for r in rows]


def get_doctor_by_id(doctor_id: str, db_path: Optional[str] = None) -> Optional[DoctorResponse]:
    """Retrieve doctor by ID."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT doctor_id, full_name, specialty, is_active
            FROM doctors
            WHERE doctor_id = ?;
        """, (doctor_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return DoctorResponse(
            doctor_id=row["doctor_id"],
            full_name=row["full_name"],
            specialty=row["specialty"],
            is_active=bool(row["is_active"])
        )


def insert_doctor(
    doctor_id: str,
    full_name: str,
    specialty: str,
    is_active: bool = True,
    db_path: Optional[str] = None
) -> DoctorResponse:
    """Insert doctor record."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO doctors (doctor_id, full_name, specialty, is_active)
            VALUES (?, ?, ?, ?);
        """, (doctor_id, full_name, specialty, 1 if is_active else 0))
        conn.commit()

    return DoctorResponse(
        doctor_id=doctor_id,
        full_name=full_name,
        specialty=specialty,
        is_active=is_active
    )


# --- Appointments Repository ---

_APPOINTMENT_SELECT_SQL = """
    SELECT 
        a.appointment_id, a.patient_id, a.doctor_id, a.start_at, a.end_at,
        a.duration_minutes, a.reason, a.status, a.created_at, a.updated_at,
        p.full_name AS patient_name,
        d.full_name AS doctor_name,
        d.specialty AS doctor_specialty
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.patient_id
    LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
"""


def get_all_appointments(db_path: Optional[str] = None) -> List[AppointmentResponse]:
    """Retrieve all appointments ordered chronologically by start_at."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(f"{_APPOINTMENT_SELECT_SQL} ORDER BY a.start_at ASC, a.appointment_id ASC;")
        rows = cursor.fetchall()
        return [AppointmentResponse(**dict(r)) for r in rows]


def get_appointment_by_id(
    appointment_id: str,
    db_path: Optional[str] = None
) -> Optional[AppointmentResponse]:
    """Retrieve single appointment by ID."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(f"{_APPOINTMENT_SELECT_SQL} WHERE a.appointment_id = ?;", (appointment_id,))
        row = cursor.fetchone()
        return AppointmentResponse(**dict(row)) if row else None


def get_appointments_by_patient_id(
    patient_id: str,
    db_path: Optional[str] = None
) -> List[AppointmentResponse]:
    """Retrieve appointments for a given patient."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(f"{_APPOINTMENT_SELECT_SQL} WHERE a.patient_id = ? ORDER BY a.start_at ASC;", (patient_id,))
        rows = cursor.fetchall()
        return [AppointmentResponse(**dict(r)) for r in rows]


def get_appointments_by_doctor_id(
    doctor_id: str,
    db_path: Optional[str] = None
) -> List[AppointmentResponse]:
    """Retrieve appointments for a given doctor."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(f"{_APPOINTMENT_SELECT_SQL} WHERE a.doctor_id = ? ORDER BY a.start_at ASC;", (doctor_id,))
        rows = cursor.fetchall()
        return [AppointmentResponse(**dict(r)) for r in rows]


def create_appointment(
    data: AppointmentCreate,
    db_path: Optional[str] = None,
    appointment_id: Optional[str] = None
) -> AppointmentResponse:
    """Insert a new appointment into SQLite."""
    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    resolved_id = appointment_id or get_next_appointment_id(db_path)
    start_at_norm = normalize_iso_datetime(data.start_at)
    end_at_norm = compute_end_at(start_at_norm, data.duration_minutes)

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO appointments (
                appointment_id, patient_id, doctor_id, start_at, end_at,
                duration_minutes, reason, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            resolved_id,
            data.patient_id,
            data.doctor_id,
            start_at_norm,
            end_at_norm,
            data.duration_minutes,
            data.reason,
            data.status,
            now_iso,
            now_iso,
        ))
        conn.commit()

    apt = get_appointment_by_id(resolved_id, db_path)
    if not apt:
        raise RuntimeError(f"Failed to retrieve created appointment {resolved_id}")
    return apt


def update_appointment(
    appointment_id: str,
    update_data: AppointmentUpdate,
    db_path: Optional[str] = None
) -> Optional[AppointmentResponse]:
    """Update appointment fields and recompute end_at if start_at or duration changed."""
    current = get_appointment_by_id(appointment_id, db_path)
    if not current:
        return None

    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    doctor_id = update_data.doctor_id if update_data.doctor_id is not None else current.doctor_id
    start_at = update_data.start_at if update_data.start_at is not None else current.start_at
    duration_minutes = (
        update_data.duration_minutes if update_data.duration_minutes is not None else current.duration_minutes
    )
    reason = update_data.reason if update_data.reason is not None else current.reason
    status = update_data.status if update_data.status is not None else current.status

    start_at_norm = normalize_iso_datetime(start_at)
    end_at_norm = compute_end_at(start_at_norm, duration_minutes)

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE appointments
            SET doctor_id = ?, start_at = ?, end_at = ?, duration_minutes = ?, reason = ?, status = ?, updated_at = ?
            WHERE appointment_id = ?;
        """, (
            doctor_id,
            start_at_norm,
            end_at_norm,
            duration_minutes,
            reason,
            status,
            now_iso,
            appointment_id,
        ))
        conn.commit()

    return get_appointment_by_id(appointment_id, db_path)


def patch_appointment_status(
    appointment_id: str,
    new_status: AppointmentStatus,
    db_path: Optional[str] = None
) -> Optional[AppointmentResponse]:
    """Patch the status of an appointment."""
    current = get_appointment_by_id(appointment_id, db_path)
    if not current:
        return None

    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE appointments
            SET status = ?, updated_at = ?
            WHERE appointment_id = ?;
        """, (new_status, now_iso, appointment_id))
        conn.commit()

    return get_appointment_by_id(appointment_id, db_path)


def delete_appointment(appointment_id: str, db_path: Optional[str] = None) -> bool:
    """Delete an appointment."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM appointments WHERE appointment_id = ?;", (appointment_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
    return deleted


def get_entity_counts(db_path: Optional[str] = None) -> Dict[str, int]:
    """Return counts of patients, doctors, and appointments."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS c FROM patients;")
        p_count = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) AS c FROM doctors;")
        d_count = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) AS c FROM appointments;")
        a_count = cursor.fetchone()["c"]
        return {
            "patients": p_count,
            "doctors": d_count,
            "appointments": a_count,
        }
