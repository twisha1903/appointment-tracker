export type AppointmentStatus = 'Scheduled' | 'Checked In' | 'Completed' | 'Cancelled';

export interface Patient {
  patient_id: string;
  full_name: string;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  allergies: string;
  medical_notes: string;
  created_at: string;
  updated_at: string;
}

export interface PatientDetail extends Patient {
  appointments: Appointment[];
}

export interface PatientCreate {
  full_name: string;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  allergies?: string;
  medical_notes?: string;
}

export interface PatientUpdate {
  full_name?: string;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  allergies?: string;
  medical_notes?: string;
}

export interface Doctor {
  doctor_id: string;
  full_name: string;
  specialty: string;
  is_active: boolean;
}

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  reason: string;
  status: AppointmentStatus;
  patient_name?: string | null;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  patient_id: string;
  doctor_id: string;
  start_at: string;
  duration_minutes: number;
  reason: string;
  status?: AppointmentStatus;
}

export interface AppointmentUpdate {
  doctor_id?: string;
  start_at?: string;
  duration_minutes?: number;
  reason?: string;
  status?: AppointmentStatus;
}

export interface AdsTelemetry {
  hash_table: {
    size: number;
    capacity: number;
    load_factor: number;
    non_empty_buckets: number;
    max_chain_length: number;
    average_chain_length?: number;
    collision_count?: number;
  };
  trie: {
    total_nodes: number;
    terminal_nodes: number;
    total_indexed_ids: number;
    root_branches: number;
  };
  avl_tree: {
    size: number;
    root_height: number;
    root_balance: number;
    max_end_at: string;
  };
}

export interface DashboardSummary {
  today_date: string;
  counts: {
    patients: number;
    doctors: number;
    appointments: number;
    total_patients: number;
    total_appointments: number;
    todays_appointments: number;
    scheduled: number;
    checked_in: number;
    completed: number;
    cancelled: number;
  };
  recent_patients: Patient[];
  todays_schedule: Appointment[];
  ads_telemetry: AdsTelemetry;
}

export interface KmpMatchItem {
  keyword: string;
  start_index: number;
  end_index: number;
  matched_text: string;
  snippet: string;
  lps_table: number[];
}

export interface KmpPatientResult {
  patient_id: string;
  full_name: string;
  age?: number | null;
  allergies: string;
  medical_notes: string;
  total_matches: number;
  matches_by_keyword: Record<string, KmpMatchItem[]>;
  all_matches: KmpMatchItem[];
}

export interface KmpScanResponse {
  safety_notice: string;
  scanned_keywords: string[];
  total_patients_matched: number;
  total_occurrences: number;
  results: KmpPatientResult[];
}

export type SyncStatus = 'connected' | 'fallback' | 'disconnected';
export type NavigationTab = 'dashboard' | 'patients' | 'appointments' | 'scanner' | 'about';
