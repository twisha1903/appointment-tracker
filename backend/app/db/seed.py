from datetime import datetime
from typing import Optional

from app.db.database import (
    create_appointment,
    create_patient,
    get_connection,
    get_entity_counts,
    init_db,
    insert_doctor,
)
from app.models.schemas import AppointmentCreate, PatientCreate


def seed_database(db_path: Optional[str] = None) -> None:
    """Populate initial doctors, patients (with duplicate names), and appointments."""
    init_db(db_path)

    # 1. Doctors
    doctors_data = [
        ("DR-101", "Dr. Priya Sundaram", "Cardiology"),
        ("DR-102", "Dr. Rohan Mehta", "Pediatrics"),
        ("DR-103", "Dr. Ananya Iyer", "General Medicine"),
        ("DR-104", "Dr. Vikram Malhotra", "Orthopedics"),
    ]
    for doc_id, name, spec in doctors_data:
        insert_doctor(doc_id, name, spec, is_active=True, db_path=db_path)

    # 2. Patients (including duplicate name Aarav Sharma for Trie demo)
    patients_data = [
        (
            "PT-1001",
            "Aarav Sharma",
            28,
            "+91 98765 43210",
            "aarav.sharma28@example.com",
            "Penicillin (rash and facial swelling)",
            "Patient reported acute high grade fever and productive cough for 3 days. Prescribed paracetamol.",
        ),
        (
            "PT-1002",
            "Aarav Sharma",
            54,
            "+91 91234 56789",
            "aarav.sharma54@example.com",
            "Sulfa drugs, Latex",
            "Evaluated for recurrent shortness of breath and mild hypertension. No history of penicillin reaction.",
        ),
        (
            "PT-1003",
            "Meera Patel",
            34,
            "+91 98220 11223",
            "meera.patel@example.com",
            "Peanut allergy (severe anaphylaxis - carries EpiPen)",
            "Follow-up consultation for seasonal asthma. Patient denied fever or acute respiratory distress.",
        ),
        (
            "PT-1004",
            "Rajesh Verma",
            62,
            "+91 94450 33445",
            "rajesh.verma@example.com",
            "Aspirin, Ibuprofen (NSAIDs)",
            "Chronic osteoarthritis in right knee. Complained of morning joint stiffness, no acute fever noted.",
        ),
        (
            "PT-1005",
            "Sneha Kulkarni",
            19,
            "+91 97660 55667",
            "sneha.k@example.com",
            "Latex, Nickel",
            "Routine college pre-sports physical examination. Complained of mild fatigue after exertion.",
        ),
        (
            "PT-1006",
            "Arjun Nair",
            45,
            "+91 99880 77889",
            "arjun.nair@example.com",
            "None known",
            "Cardiac rehabilitation review. Occasional shortness of breath during intense aerobic training.",
        ),
        (
            "PT-1007",
            "Fatima Al-Mansoor",
            31,
            "+91 91122 33445",
            "fatima.m@example.com",
            "Penicillin, Amoxicillin",
            "Post-operative dressing change. Mild intermittent low-grade fever treated with oral analgesics.",
        ),
        (
            "PT-1008",
            "David Chen",
            50,
            "+91 95566 77889",
            "david.chen@example.com",
            "Peanut allergy, Shellfish",
            "Annual diabetic health checkup and lipid panel review. Blood glucose parameters stable.",
        ),
        (
            "PT-1009",
            "Kavita Deshmukh",
            41,
            "+91 93344 55667",
            "kavita.d@example.com",
            "Penicillin",
            "Bronchitis convalescence. Patient reports resolving shortness of breath and clear vesicular lung sounds.",
        ),
    ]

    for pt_id, name, age, phone, email, allergies, notes in patients_data:
        p_obj = PatientCreate(
            full_name=name,
            age=age,
            phone=phone,
            email=email,
            allergies=allergies,
            medical_notes=notes,
        )
        create_patient(p_obj, db_path=db_path, patient_id=pt_id)

    # 3. Appointments anchored relative to today's local date
    today_str = datetime.now().strftime("%Y-%m-%d")

    appointments_data = [
        (
            "APT-2001",
            "PT-1001",
            "DR-103",
            f"{today_str}T09:00:00",
            30,
            "Acute high fever and persistent sore throat",
            "Completed",
        ),
        (
            "APT-2002",
            "PT-1002",
            "DR-101",
            f"{today_str}T10:00:00",
            45,
            "Cardiology consult for exertion-related shortness of breath",
            "Checked In",
        ),
        (
            "APT-2003",
            "PT-1003",
            "DR-102",
            f"{today_str}T11:00:00",
            30,
            "Peanut allergy management and emergency protocol review",
            "Scheduled",
        ),
        (
            "APT-2004",
            "PT-1004",
            "DR-104",
            f"{today_str}T11:30:00",
            45,
            "Right knee arthroscopy follow-up and physical therapy review",
            "Scheduled",
        ),
        (
            "APT-2005",
            "PT-1005",
            "DR-103",
            f"{today_str}T14:00:00",
            30,
            "Allergy panel review and routine health clearance",
            "Scheduled",
        ),
        (
            "APT-2006",
            "PT-1006",
            "DR-101",
            f"{today_str}T15:00:00",
            30,
            "Electrocardiogram review and stress test follow-up",
            "Scheduled",
        ),
        (
            "APT-2007",
            "PT-1007",
            "DR-104",
            f"{today_str}T16:00:00",
            30,
            "Sprain evaluation (cancelled by patient due to schedule conflict)",
            "Cancelled",
        ),
    ]

    for apt_id, pt_id, dr_id, start_at, duration, reason, status in appointments_data:
        apt_obj = AppointmentCreate(
            patient_id=pt_id,
            doctor_id=dr_id,
            start_at=start_at,
            duration_minutes=duration,
            reason=reason,
            status=status,
        )
        create_appointment(apt_obj, db_path=db_path, appointment_id=apt_id)


def seed_database_if_empty(db_path: Optional[str] = None) -> bool:
    """Initialize schema and seed only if no patients exist."""
    init_db(db_path)
    counts = get_entity_counts(db_path)
    if counts["patients"] == 0:
        seed_database(db_path)
        return True
    return False


def reset_and_seed_database(db_path: Optional[str] = None) -> None:
    """Clear all tables and re-run deterministic seeding."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM appointments;")
        cursor.execute("DELETE FROM patients;")
        cursor.execute("DELETE FROM doctors;")
        conn.commit()
    seed_database(db_path)
