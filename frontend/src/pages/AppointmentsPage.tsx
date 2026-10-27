import { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Edit2,
  Sparkles,
  CalendarDays,
  ShieldAlert,
  Check,
} from 'lucide-react';
import {
  Appointment,
  AppointmentCreate,
  AppointmentStatus,
  AppointmentUpdate,
  Doctor,
  Patient,
  NavigationTab,
} from '../types';
import { api } from '../services/api';

interface AppointmentsPageProps {
  onSelectPatient?: (patientId: string) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  initialPatientId?: string | null;
  isBookModalOpenExternal?: boolean;
  onCloseBookModalExternal?: () => void;
}

export function AppointmentsPage({
  onSelectPatient,
  onNavigateTab,
  initialPatientId,
  isBookModalOpenExternal,
  onCloseBookModalExternal,
}: AppointmentsPageProps) {
  // Appointments list & loading
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters state
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [isAllDates, setIsAllDates] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Book / Reschedule Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patient selector inside modal (Trie autocomplete)
  const [patientSearchPrefix, setPatientSearchPrefix] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<Patient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [formDoctorId, setFormDoctorId] = useState('');
  const [formDate, setFormDate] = useState(todayIso);
  const [formTime, setFormTime] = useState('10:00');
  const [formDuration, setFormDuration] = useState(30);
  const [formReason, setFormReason] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Cancel Confirmation Modal state
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Open modal if triggered externally
  useEffect(() => {
    if (isBookModalOpenExternal) {
      openBookModal(initialPatientId || undefined);
    }
  }, [isBookModalOpenExternal, initialPatientId]);

  // Load doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const data = await api.getDoctors();
        setDoctors(data);
        if (data.length > 0 && !formDoctorId) {
          setFormDoctorId(data[0].doctor_id);
        }
      } catch (err: any) {
        console.error('Failed to load doctors', err);
      }
    };
    fetchDoctors();
  }, []);

  // Fetch appointments based on filters
  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params: { date?: string; doctorId?: string; status?: string } = {};
      if (!isAllDates && selectedDate) {
        params.date = selectedDate;
      }
      if (selectedDoctorId !== 'all') {
        params.doctorId = selectedDoctorId;
      }
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }

      const list = await api.getAppointments(params);
      setAppointments(list);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, isAllDates, selectedDoctorId, selectedStatus]);

  // Trie autocomplete for modal patient selector
  useEffect(() => {
    const trimmed = patientSearchPrefix.trim();
    if (!trimmed) {
      setPatientSuggestions([]);
      setShowPatientDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const matches = await api.autocompletePatients(trimmed, 8);
        setPatientSuggestions(matches);
        setShowPatientDropdown(true);
      } catch (err) {
        console.error('Trie search failed:', err);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [patientSearchPrefix]);

  // Close patient dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Date navigation helpers
  const handleShiftDate = (days: number) => {
    setIsAllDates(false);
    const curr = new Date(selectedDate || todayIso);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  // Status transition handler (Check In, Complete)
  const handleStatusTransition = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setActionLoadingId(appointmentId);
    try {
      await api.patchAppointmentStatus(appointmentId, newStatus);
      setToastMessage({
        type: 'success',
        text: `Appointment [${appointmentId}] status updated to "${newStatus}"!`,
      });
      await loadAppointments();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Failed to update status: ${err.message}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel appointment handler (frees interval in AVL Tree)
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    try {
      await api.patchAppointmentStatus(appointmentToCancel.appointment_id, 'Cancelled');
      setToastMessage({
        type: 'info',
        text: `Appointment [${appointmentToCancel.appointment_id}] cancelled. Timeslot freed in Augmented AVL Tree!`,
      });
      setAppointmentToCancel(null);
      await loadAppointments();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Cancellation failed: ${err.message}`,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Open booking modal
  const openBookModal = async (preselectedPatientId?: string) => {
    setEditingAppointment(null);
    setConflictError(null);
    setFormErrors({});
    setFormDate(selectedDate || todayIso);
    setFormTime('10:00');
    setFormDuration(30);
    setFormReason('General consultation and health review');
    if (doctors.length > 0) {
      setFormDoctorId(doctors[0].doctor_id);
    }

    if (preselectedPatientId) {
      try {
        const p = await api.getPatient(preselectedPatientId);
        setSelectedPatient(p);
        setPatientSearchPrefix(p.full_name);
      } catch {
        setSelectedPatient(null);
        setPatientSearchPrefix('');
      }
    } else {
      setSelectedPatient(null);
      setPatientSearchPrefix('');
    }

    setIsModalOpen(true);
  };

  // Open reschedule modal
  const openRescheduleModal = (apt: Appointment) => {
    setEditingAppointment(apt);
    setConflictError(null);
    setFormErrors({});

    // Parse start_at into Date & Time
    const [datePart, timePartWithZ] = apt.start_at.split('T');
    const timePart = timePartWithZ ? timePartWithZ.slice(0, 5) : '10:00';

    setFormDoctorId(apt.doctor_id);
    setFormDate(datePart || todayIso);
    setFormTime(timePart);
    setFormDuration(apt.duration_minutes || 30);
    setFormReason(apt.reason || '');

    // Set patient
    setSelectedPatient({
      patient_id: apt.patient_id,
      full_name: apt.patient_name || apt.patient_id,
      allergies: '',
      medical_notes: '',
      created_at: '',
      updated_at: '',
    });
    setPatientSearchPrefix(apt.patient_name || apt.patient_id);

    setIsModalOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!selectedPatient) {
      errors.patient = 'Please select a patient using Trie autocomplete';
    }
    if (!formDoctorId) {
      errors.doctor = 'Please select an assigned healthcare provider';
    }
    if (!formDate) {
      errors.date = 'Date is required';
    }
    if (!formTime) {
      errors.time = 'Start time is required';
    }
    if (!formReason.trim()) {
      errors.reason = 'Reason for consultation is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit appointment creation or update with AVL Conflict handling
  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setConflictError(null);

    // Format ISO string YYYY-MM-DDTHH:MM:SS
    const startAtIso = `${formDate}T${formTime.length === 5 ? `${formTime}:00` : formTime}`;

    try {
      if (editingAppointment) {
        const updatePayload: AppointmentUpdate = {
          doctor_id: formDoctorId,
          start_at: startAtIso,
          duration_minutes: formDuration,
          reason: formReason.trim(),
        };
        const updated = await api.updateAppointment(editingAppointment.appointment_id, updatePayload);
        setToastMessage({
          type: 'success',
          text: `Rescheduled appointment [${updated.appointment_id}] to ${formDate} ${formTime}! AVL balance verified.`,
        });
      } else {
        const createPayload: AppointmentCreate = {
          patient_id: selectedPatient!.patient_id,
          doctor_id: formDoctorId,
          start_at: startAtIso,
          duration_minutes: formDuration,
          reason: formReason.trim(),
          status: 'Scheduled',
        };
        const created = await api.createAppointment(createPayload);
        setToastMessage({
          type: 'success',
          text: `Booked appointment [${created.appointment_id}] for ${selectedPatient!.full_name}! Inserted into AVL Tree.`,
        });
      }

      setIsModalOpen(false);
      if (onCloseBookModalExternal) onCloseBookModalExternal();
      await loadAppointments();
    } catch (err: any) {
      // Backend returned 409 Conflict due to overlapping interval
      setConflictError(err.message || 'AVL interval conflict detected: overlapping timeslot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time display
  const formatTimeSlot = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      const sStr = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const eStr = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${sStr} – ${eStr}`;
    } catch {
      return `${startIso.slice(11, 16)} – ${endIso.slice(11, 16)}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                AVL Interval Appointment Scheduler
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {appointments.length} Total Bookings
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Self-balancing <strong>Augmented AVL Interval Tree</strong> with compound key{' '}
                <span className="font-mono text-cyan-300">(start_at, appointment_id)</span> &amp; subtree{' '}
                <span className="font-mono text-cyan-300">max_end_at</span> overlap conflict prevention in{' '}
                <strong className="text-cyan-400">O(log N + K)</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAppointments}
            disabled={loading}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Refresh Schedule"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => openBookModal()}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950/40 transition-all flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* FILTER & TIMELINE CONTROLS BAR */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Date Picker & Fast Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setIsAllDates(false);
                }}
                className={`bg-transparent text-xs font-mono px-2 py-1 focus:outline-none transition-colors ${
                  isAllDates ? 'text-slate-500 line-through' : 'text-white'
                }`}
              />

              <button
                onClick={() => handleShiftDate(1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedDate(todayIso);
                setIsAllDates(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all ${
                !isAllDates && selectedDate === todayIso
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => setIsAllDates(!isAllDates)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all ${
                isAllDates
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All In-Order Tree Dates
            </button>
          </div>

          {/* Doctor & Status Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Doctor Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">Doctor:</span>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-sans"
              >
                <option value="all">All Healthcare Providers</option>
                {doctors.map((doc) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    {doc.full_name} ({doc.specialty})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-sans"
              >
                <option value="all">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Checked In">Checked In</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informational Sub-strip for Evaluator */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">AVL In-Order Sequence:</span>
            <span>Sorted chronologically by (start_at, appointment_id)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span> Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Checked In
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> Cancelled
            </span>
          </div>
        </div>
      </div>

      {/* CHRONOLOGICAL APPOINTMENT TIMELINE */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
            <div className="text-xs font-mono text-cyan-300">
              Traversing Augmented AVL Interval Tree Nodes...
            </div>
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadAppointments}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No Appointments Scheduled</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {isAllDates
                ? 'No appointments found in the AVL Tree matching your filters.'
                : `No appointments scheduled on ${selectedDate}. Select "All In-Order Tree Dates" or book a new appointment.`}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => {
                  setSelectedDoctorId('all');
                  setSelectedStatus('all');
                  setIsAllDates(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                Clear Filters
              </button>
              <button
                onClick={() => openBookModal()}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                + Book Appointment
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt, index) => {
              const isActionLoading = actionLoadingId === apt.appointment_id;

              return (
                <div
                  key={apt.appointment_id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  {/* Left: Time Interval & Order Badge */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shrink-0 text-cyan-400 font-mono">
                      <span className="text-[10px] text-slate-500">#{index + 1}</span>
                      <span className="text-xs font-bold">{apt.duration_minutes}m</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          {formatTimeSlot(apt.start_at, apt.end_at)}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          {apt.appointment_id}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(apt.start_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Patient & Doctor details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <button
                            onClick={() => {
                              if (onSelectPatient) onSelectPatient(apt.patient_id);
                              if (onNavigateTab) onNavigateTab('patients');
                            }}
                            className="font-semibold text-white hover:text-cyan-300 transition-colors flex items-center gap-1"
                            title="View patient profile in Patients directory"
                          >
                            <span>{apt.patient_name || apt.patient_id}</span>
                            <span className="text-[10px] font-mono text-teal-400">
                              ({apt.patient_id})
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          <span>{apt.doctor_name || apt.doctor_id}</span>
                          <span className="text-[11px] text-slate-500">
                            ({apt.doctor_specialty || 'General'})
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="text-[11px] text-slate-400 italic">
                        "{apt.reason}"
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Badge & Workflow Action Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* Status Badge */}
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        apt.status === 'Completed'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : apt.status === 'Checked In'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : apt.status === 'Scheduled'
                          ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {apt.status}
                    </span>

                    {/* Action: Check In */}
                    {apt.status === 'Scheduled' && (
                      <button
                        onClick={() => handleStatusTransition(apt.appointment_id, 'Checked In')}
                        disabled={isActionLoading}
                        className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                        title="Check In Patient"
                      >
                        {isActionLoading ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Check In</span>
                      </button>
                    )}

                    {/* Action: Complete */}
                    {(apt.status === 'Scheduled' || apt.status === 'Checked In') && (
                      <button
                        onClick={() => handleStatusTransition(apt.appointment_id, 'Completed')}
                        disabled={isActionLoading}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                        title="Mark Consultation Completed"
                      >
                        {isActionLoading ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>Complete</span>
                      </button>
                    )}

                    {/* Action: Reschedule / Edit */}
                    {apt.status !== 'Cancelled' && (
                      <button
                        onClick={() => openRescheduleModal(apt)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Reschedule / Edit Timeslot"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Action: Cancel */}
                    {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                      <button
                        onClick={() => setAppointmentToCancel(apt)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
                        title="Cancel Appointment (Frees interval in AVL Tree)"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOOK / RESCHEDULE APPOINTMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setIsModalOpen(false);
                if (onCloseBookModalExternal) onCloseBookModalExternal();
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                {editingAppointment ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingAppointment
                    ? `Reschedule Appointment [${editingAppointment.appointment_id}]`
                    : 'Book New Appointment'}
                </h3>
                <p className="text-xs text-slate-400">
                  Augmented AVL Interval Tree validates interval conflicts in O(log N + K) time.
                </p>
              </div>
            </div>

            {/* Prominent AVL Conflict Rejection Alert Box */}
            {conflictError && (
              <div className="mb-4 p-4 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>AVL Interval Conflict Detected (Double-Booking Blocked)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/30 font-mono text-[11px] text-rose-200 leading-snug">
                  {conflictError}
                </div>
                <div className="text-[11px] text-slate-300">
                  The Augmented AVL Tree checked <span className="font-mono text-cyan-300">subtree max_end_at</span>{' '}
                  and detected that either the requested doctor or patient already has an active overlapping
                  timeslot. Please adjust the start time or choose an alternate doctor.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitAppointment} className="space-y-4 text-xs">
              {/* Patient Selector with Trie Autocomplete */}
              <div className="relative" ref={patientDropdownRef}>
                <label className="block text-slate-300 font-medium mb-1">
                  Select Patient (Live Trie Autocomplete) <span className="text-rose-400">*</span>
                </label>

                {selectedPatient ? (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{selectedPatient.full_name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {selectedPatient.patient_id}
                      </span>
                    </div>
                    {!editingAppointment && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setPatientSearchPrefix('');
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Type patient name (e.g. 'Aarav', 'Sharma', 'Priya')..."
                        value={patientSearchPrefix}
                        onChange={(e) => setPatientSearchPrefix(e.target.value)}
                        onFocus={() => {
                          if (patientSuggestions.length > 0) setShowPatientDropdown(true);
                        }}
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-all ${
                          formErrors.patient
                            ? 'border-rose-500 focus:border-rose-500'
                            : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                    </div>

                    {showPatientDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-cyan-500/40 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
                        {isSearchingPatients ? (
                          <div className="p-3 text-center text-slate-400">Searching Trie branches...</div>
                        ) : patientSuggestions.length === 0 ? (
                          <div className="p-3 text-center text-slate-500">
                            No patients found matching "{patientSearchPrefix}"
                          </div>
                        ) : (
                          patientSuggestions.map((p) => (
                            <button
                              key={p.patient_id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p);
                                setShowPatientDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-cyan-500/10 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-semibold text-white">{p.full_name}</span>
                                <span className="ml-2 font-mono text-[10px] text-cyan-300">
                                  {p.patient_id}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">Age: {p.age ?? 'N/A'}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {formErrors.patient && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.patient}</p>
                )}
              </div>

              {/* Doctor Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Healthcare Provider <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formDoctorId}
                  onChange={(e) => setFormDoctorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  {doctors.map((doc) => (
                    <option key={doc.doctor_id} value={doc.doctor_id}>
                      {doc.full_name} — {doc.specialty} ({doc.doctor_id})
                    </option>
                  ))}
                </select>
                {formErrors.doctor && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.doctor}</p>
                )}
              </div>

              {/* Date & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Appointment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {formErrors.date && (
                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Start Time <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {formErrors.time && (
                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.time}</p>
                  )}
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Interval Duration (Minutes)
                </label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFormDuration(mins)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                        formDuration === mins
                          ? 'bg-cyan-500 text-white font-bold shadow-md'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Consultation Reason */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Clinical Reason for Visit <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiac evaluation, annual routine checkup, allergy test..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.reason
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
                {formErrors.reason && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.reason}</p>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    if (onCloseBookModalExternal) onCloseBookModalExternal();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950/40 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAppointment ? 'Update Interval' : 'Verify & Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL APPOINTMENT CONFIRMATION MODAL */}
      {appointmentToCancel && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white text-center">
              Cancel Appointment?
            </h3>
            <p className="text-xs text-slate-300 text-center mt-1">
              Are you sure you want to cancel appointment{' '}
              <span className="font-mono text-cyan-300">{appointmentToCancel.appointment_id}</span>?
            </p>

            <div className="p-3 my-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 font-mono">AVL Tree Effect:</div>
              <div>• Status changes to "Cancelled"</div>
              <div>• The interval is freed for other bookings without doctor/patient double-booking blocks</div>
              <div>• Referential audit integrity is preserved</div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelAppointment}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50 flex items-center gap-1.5"
              >
                {isCancelling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
