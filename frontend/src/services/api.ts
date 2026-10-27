import {
  Appointment,
  AppointmentCreate,
  AppointmentStatus,
  AppointmentUpdate,
  DashboardSummary,
  Doctor,
  KmpScanResponse,
  Patient,
  PatientCreate,
  PatientDetail,
  PatientUpdate,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (Array.isArray(errorJson.detail)) {
          errorMessage = errorJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
      } else if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // Fallback to response.statusText
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // System & Dashboard
  getHealth: () => request<any>('/health'),
  getDashboardSummary: (date?: string) =>
    request<DashboardSummary>(`/dashboard/summary${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  resetDemoData: () => request<{ status: string; indexed_entities: any }>('/system/reset-demo', { method: 'POST' }),

  // Patients (Hash Table & Trie)
  getPatients: () => request<Patient[]>('/patients'),
  getPatient: (patientId: string) => request<PatientDetail>(`/patients/${encodeURIComponent(patientId)}`),
  autocompletePatients: (prefix: string, limit = 10) =>
    request<Patient[]>(`/patients/autocomplete?prefix=${encodeURIComponent(prefix)}&limit=${limit}`),
  createPatient: (data: PatientCreate) =>
    request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePatient: (patientId: string, data: PatientUpdate) =>
    request<Patient>(`/patients/${encodeURIComponent(patientId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePatient: (patientId: string) =>
    request<{ status: string; patient_id: string }>(`/patients/${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
    }),

  // Doctors
  getDoctors: () => request<Doctor[]>('/doctors'),

  // Appointments (Augmented AVL Interval Tree)
  getAppointments: (params?: { date?: string; status?: string; doctorId?: string; patientId?: string }) => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.status) query.set('status', params.status);
    if (params?.doctorId) query.set('doctor_id', params.doctorId);
    if (params?.patientId) query.set('patient_id', params.patientId);
    const qs = query.toString();
    return request<Appointment[]>(`/appointments${qs ? `?${qs}` : ''}`);
  },
  getAppointment: (appointmentId: string) =>
    request<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}`),
  createAppointment: (data: AppointmentCreate) =>
    request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAppointment: (appointmentId: string, data: AppointmentUpdate) =>
    request<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  patchAppointmentStatus: (appointmentId: string, status: AppointmentStatus) =>
    request<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Clinical Notes Scanner (KMP Algorithm)
  searchNotes: (payload: { keywords?: string[]; keyword?: string; patient_id?: string }) =>
    request<KmpScanResponse>('/notes/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
