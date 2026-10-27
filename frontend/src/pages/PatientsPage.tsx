import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Search,
  Hash,
  Binary,
  Plus,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Filter,
  Eye,
} from 'lucide-react';
import {
  Patient,
  PatientDetail,
  PatientCreate,
  PatientUpdate,
  NavigationTab,
} from '../types';
import { api } from '../services/api';

interface PatientsPageProps {
  selectedPatientId?: string | null;
  onSelectPatient?: (patientId: string | null) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenBookModal?: (patientId?: string) => void;
  isRegisterModalOpenExternal?: boolean;
  onCloseRegisterModalExternal?: () => void;
}

export function PatientsPage({
  selectedPatientId,
  onSelectPatient,
  onNavigateTab,
  onOpenBookModal,
  isRegisterModalOpenExternal,
  onCloseRegisterModalExternal,
}: PatientsPageProps) {
  // Directory state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filter & Search in Table
  const [tableFilter, setTableFilter] = useState('');

  // 1. Live Trie Autocomplete state
  const [triePrefix, setTriePrefix] = useState('');
  const [trieSuggestions, setTrieSuggestions] = useState<Patient[]>([]);
  const [isTrieSearching, setIsTrieSearching] = useState(false);
  const [showTrieDropdown, setShowTrieDropdown] = useState(false);
  const trieRef = useRef<HTMLDivElement>(null);

  // 2. Direct Hash Table O(1) Lookup state
  const [hashInputId, setHashInputId] = useState('');
  const [isHashLookingUp, setIsHashLookingUp] = useState(false);
  const [hashLookupError, setHashLookupError] = useState<string | null>(null);
  const [hashLookupSuccess, setHashLookupSuccess] = useState<string | null>(null);

  // 3. Patient Detail Drawer state
  const [activePatientDetail, setActivePatientDetail] = useState<PatientDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 4. Register / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientCreate>({
    full_name: '',
    age: null,
    phone: '',
    email: '',
    allergies: '',
    medical_notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 5. Delete Confirmation Modal state
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConflictError, setDeleteConflictError] = useState<string | null>(null);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle external modal trigger from App shell
  useEffect(() => {
    if (isRegisterModalOpenExternal) {
      openRegisterModal();
    }
  }, [isRegisterModalOpenExternal]);

  // Fetch initial patient list
  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getPatients();
      setPatients(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // When selectedPatientId changes externally (e.g. from header search or dashboard), load detail
  useEffect(() => {
    if (selectedPatientId) {
      handleLoadPatientDetail(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Trie autocomplete debounced search
  useEffect(() => {
    const trimmed = triePrefix.trim();
    if (!trimmed) {
      setTrieSuggestions([]);
      setShowTrieDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTrieSearching(true);
      try {
        const matches = await api.autocompletePatients(trimmed, 10);
        setTrieSuggestions(matches);
        setShowTrieDropdown(true);
      } catch (err) {
        console.error('Trie search error:', err);
      } finally {
        setIsTrieSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [triePrefix]);

  // Close Trie dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (trieRef.current && !trieRef.current.contains(event.target as Node)) {
        setShowTrieDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Patient Detail via O(1) Hash Table
  const handleLoadPatientDetail = async (patientId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await api.getPatient(patientId);
      setActivePatientDetail(detail);
      if (onSelectPatient) {
        onSelectPatient(patientId);
      }
    } catch (err: any) {
      setDetailError(err.message || `Failed to fetch patient ${patientId}`);
      setActivePatientDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Direct Hash Table ID Lookup handler
  const handleDirectHashLookup = async (e?: React.FormEvent, customId?: string) => {
    if (e) e.preventDefault();
    const idToLookup = (customId || hashInputId).trim().toUpperCase();
    if (!idToLookup) return;

    setIsHashLookingUp(true);
    setHashLookupError(null);
    setHashLookupSuccess(null);

    try {
      const patient = await api.getPatient(idToLookup);
      setActivePatientDetail(patient);
      setHashLookupSuccess(`Hash Table Match: Bucket O(1) found "${patient.full_name}" [${patient.patient_id}]`);
      if (onSelectPatient) {
        onSelectPatient(patient.patient_id);
      }
      setHashInputId(idToLookup);
    } catch (err: any) {
      setHashLookupError(
        `Key "${idToLookup}" not found in PatientHashTable (O(1) expected bucket check returned NULL).`
      );
    } finally {
      setIsHashLookingUp(false);
    }
  };

  // Filtered patients for table
  const filteredPatients = useMemo(() => {
    if (!tableFilter.trim()) return patients;
    const q = tableFilter.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_id.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.allergies && p.allergies.toLowerCase().includes(q))
    );
  }, [patients, tableFilter]);

  // Paginated patients
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Identify duplicate patient names for academic viva demonstration
  const nameCounts = useMemo(() => {
    const map = new Map<string, number>();
    patients.forEach((p) => {
      const norm = p.full_name.trim().toLowerCase();
      map.set(norm, (map.get(norm) || 0) + 1);
    });
    return map;
  }, [patients]);

  // Open modal for registration
  const openRegisterModal = () => {
    setEditingPatient(null);
    setFormData({
      full_name: '',
      age: null,
      phone: '',
      email: '',
      allergies: '',
      medical_notes: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      full_name: patient.full_name,
      age: patient.age,
      phone: patient.phone || '',
      email: patient.email || '',
      allergies: patient.allergies || '',
      medical_notes: patient.medical_notes || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Validate patient form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      errors.full_name = 'Full name is required (minimum 2 characters)';
    }
    if (formData.age !== null && formData.age !== undefined && (formData.age < 0 || formData.age > 130)) {
      errors.age = 'Age must be between 0 and 130';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save patient (create or update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingPatient) {
        const updatePayload: PatientUpdate = {
          full_name: formData.full_name.trim(),
          age: formData.age,
          phone: formData.phone?.trim() || null,
          email: formData.email?.trim() || null,
          allergies: formData.allergies?.trim() || '',
          medical_notes: formData.medical_notes?.trim() || '',
        };
        const updated = await api.updatePatient(editingPatient.patient_id, updatePayload);
        setToastMessage({
          type: 'success',
          text: `Updated patient ${updated.full_name} (${updated.patient_id}) in SQLite, Hash Table, & Trie!`,
        });
        // If active drawer is viewing this patient, refresh detail
        if (activePatientDetail?.patient_id === updated.patient_id) {
          handleLoadPatientDetail(updated.patient_id);
        }
      } else {
        const createPayload: PatientCreate = {
          full_name: formData.full_name.trim(),
          age: formData.age,
          phone: formData.phone?.trim() || null,
          email: formData.email?.trim() || null,
          allergies: formData.allergies?.trim() || '',
          medical_notes: formData.medical_notes?.trim() || '',
        };
        const created = await api.createPatient(createPayload);
        setToastMessage({
          type: 'success',
          text: `Registered new patient ${created.full_name} (${created.patient_id}). Indexed into Hash Table & Trie!`,
        });
        // Auto-select newly created patient
        handleLoadPatientDetail(created.patient_id);
      }

      await loadPatients();
      setIsModalOpen(false);
      if (onCloseRegisterModalExternal) {
        onCloseRegisterModalExternal();
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Operation failed: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute patient deletion with 409 conflict handling
  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);
    setDeleteConflictError(null);

    try {
      await api.deletePatient(patientToDelete.patient_id);
      setToastMessage({
        type: 'success',
        text: `Patient ${patientToDelete.full_name} (${patientToDelete.patient_id}) deleted and pruned from Trie & Hash Table.`,
      });

      // Clear detail drawer if it was showing the deleted patient
      if (activePatientDetail?.patient_id === patientToDelete.patient_id) {
        setActivePatientDetail(null);
        if (onSelectPatient) onSelectPatient(null);
      }

      setPatientToDelete(null);
      await loadPatients();
    } catch (err: any) {
      // Backend returned 409 Conflict due to active or historical appointments
      setDeleteConflictError(err.message || 'Cannot delete patient with active appointments.');
    } finally {
      setIsDeleting(false);
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
              : 'bg-slate-900/90 text-slate-200 border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
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
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Patient Registry &amp; Directory
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  {patients.length} Total Patients
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Live demonstration of <strong>Standard Prefix Trie</strong> (O(L) live autocomplete) &amp;{' '}
                <strong>Separate Chaining Hash Table</strong> (O(1) expected record retrieval)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadPatients}
            disabled={loading}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openRegisterModal}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-950/40 transition-all flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* DUAL SEARCH SYSTEM: Trie Autocomplete vs. Hash Table Direct Lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DATA STRUCTURE 2: Standard Prefix Trie Autocomplete */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between relative" ref={trieRef}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                  <Binary className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Structure 2: Standard Prefix Trie
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O(L) character prefix matching with multi-patient terminal node sets
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                O(L) Name Query
              </span>
            </div>

            <div className="relative mt-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type name prefix (e.g. 'Aa', 'Aarav', 'Sharma', 'Priya')..."
                value={triePrefix}
                onChange={(e) => setTriePrefix(e.target.value)}
                onFocus={() => {
                  if (trieSuggestions.length > 0) setShowTrieDropdown(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
              />
              {triePrefix && (
                <button
                  onClick={() => {
                    setTriePrefix('');
                    setTrieSuggestions([]);
                    setShowTrieDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Demo Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
              <span className="text-slate-500">Prefix presets:</span>
              {['Aarav', 'Sharma', 'Priya', 'Kavita', 'Rohan'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTriePrefix(preset)}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
                >
                  "{preset}"
                </button>
              ))}
            </div>
          </div>

          {/* Autocomplete Dropdown List */}
          {showTrieDropdown && (
            <div className="absolute left-4 right-4 top-[102px] bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/80">
              <div className="px-3 py-1.5 bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  Trie Traversal Matches ({trieSuggestions.length})
                </span>
                <span className="text-cyan-400 font-semibold">TrieNode Terminal ID Sets</span>
              </div>

              {isTrieSearching ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  Traversing Trie character branches...
                </div>
              ) : trieSuggestions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No patients found with prefix "{triePrefix}" in Trie.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {trieSuggestions.map((patient) => {
                    const isDuplicateName = (nameCounts.get(patient.full_name.trim().toLowerCase()) || 0) > 1;
                    return (
                      <button
                        key={patient.patient_id}
                        onClick={() => {
                          handleLoadPatientDetail(patient.patient_id);
                          setShowTrieDropdown(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-cyan-500/10 flex items-center justify-between transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-300 flex items-center gap-2">
                            <span>{patient.full_name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              {patient.patient_id}
                            </span>
                            {isDuplicateName && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Duplicate Name (Multi-ID Set)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                            <span>Age: {patient.age ?? 'N/A'}</span>
                            <span>•</span>
                            <span>Phone: {patient.phone || 'None'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {patient.allergies && patient.allergies !== 'None' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              Allergy
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DATA STRUCTURE 1: Custom Hash Table Direct O(1) Lookup */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/20">
                  <Hash className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Structure 1: Custom Hash Table
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O(1) expected retrieval via polynomial rolling hash (base 31) &amp; separate chaining
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/60">
                O(1) Direct Lookup
              </span>
            </div>

            <form onSubmit={handleDirectHashLookup} className="flex gap-2 mt-2">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter exact patient_id (e.g. PT-1001, PT-1002)..."
                  value={hashInputId}
                  onChange={(e) => setHashInputId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 uppercase transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isHashLookingUp || !hashInputId.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
              >
                {isHashLookingUp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Lookup</span>
              </button>
            </form>

            {/* Quick Presets for Evaluator */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
              <span className="text-slate-500">Evaluate IDs:</span>
              {['PT-1001', 'PT-1002', 'PT-1005', 'PT-9999'].map((demoId) => (
                <button
                  key={demoId}
                  type="button"
                  onClick={() => {
                    setHashInputId(demoId);
                    handleDirectHashLookup(undefined, demoId);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors ${
                    demoId === 'PT-9999'
                      ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-teal-300'
                  }`}
                >
                  {demoId === 'PT-9999' ? `${demoId} (Missing Test)` : demoId}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Badges */}
          <div className="mt-3">
            {hashLookupSuccess && (
              <div className="px-3 py-2 rounded-xl bg-teal-950/60 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-mono text-[11px]">{hashLookupSuccess}</span>
              </div>
            )}
            {hashLookupError && (
              <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono text-[11px]">{hashLookupError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: Directory Table + Patient Profile Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* PATIENT DIRECTORY TABLE (Takes 2 cols on wide screens or full if drawer closed) */}
        <div className={`space-y-4 ${activePatientDetail || isLoadingDetail || detailError ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={loadPatients}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            {/* Table Search & Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter directory table..."
                  value={tableFilter}
                  onChange={(e) => {
                    setTableFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all font-sans"
                />
                {tableFilter && (
                  <button
                    onClick={() => setTableFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 font-mono flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span>
                  Showing{' '}
                  <strong className="text-white">
                    {filteredPatients.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                    {Math.min(currentPage * pageSize, filteredPatients.length)}
                  </strong>{' '}
                  of <strong className="text-white">{filteredPatients.length}</strong> patients
                </span>
              </div>
            </div>

            {/* Table Element */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-3 py-3">Age</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Allergies</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading && patients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                          <span>Reading Hash Table Buckets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Users className="w-8 h-8 mx-auto text-slate-600" />
                          <div className="text-sm font-semibold text-slate-300">No patients found</div>
                          <p className="text-xs text-slate-500">
                            {tableFilter
                              ? `No patients match filter "${tableFilter}".`
                              : 'The patient repository is currently empty.'}
                          </p>
                          {tableFilter && (
                            <button
                              onClick={() => setTableFilter('')}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-xs font-mono"
                            >
                              Clear Filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPatients.map((patient) => {
                      const isSelected = activePatientDetail?.patient_id === patient.patient_id;
                      const isDuplicate = (nameCounts.get(patient.full_name.trim().toLowerCase()) || 0) > 1;

                      return (
                        <tr
                          key={patient.patient_id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-teal-500/10'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Patient ID */}
                          <td className="px-4 py-3 font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-semibold text-[11px] border border-slate-700/60">
                              {patient.patient_id}
                            </span>
                          </td>

                          {/* Full Name */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{patient.full_name}</span>
                              {isDuplicate && (
                                <span
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  title="Duplicate name resolved via Trie terminal ID set"
                                >
                                  Shared Name
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Registered: {new Date(patient.created_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Age */}
                          <td className="px-3 py-3 text-slate-300">
                            {patient.age ? `${patient.age} yrs` : <span className="text-slate-600">—</span>}
                          </td>

                          {/* Contact Details */}
                          <td className="px-4 py-3 text-slate-300">
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              {patient.phone ? (
                                <span className="flex items-center gap-1.5 text-slate-300">
                                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                  {patient.phone}
                                </span>
                              ) : (
                                <span className="text-slate-600 italic">No phone</span>
                              )}
                              {patient.email && (
                                <span className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                  {patient.email}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Allergies Badge */}
                          <td className="px-4 py-3">
                            {patient.allergies && patient.allergies.toLowerCase() !== 'none' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-medium max-w-[140px] truncate">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span className="truncate">{patient.allergies}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">None</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleLoadPatientDetail(patient.patient_id)}
                                className={`p-1.5 rounded-lg text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                                }`}
                                title="View Patient Profile (O(1) Hash Table Fetch)"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(patient)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Edit Patient Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (onNavigateTab) {
                                    onNavigateTab('scanner');
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors"
                                title="Scan Notes via KMP Engine"
                              >
                                <Search className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setPatientToDelete(patient);
                                  setDeleteConflictError(null);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
                                title="Delete Patient"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-medium transition-all ${
                        currentPage === page
                          ? 'bg-teal-500 text-white shadow-sm'
                          : 'bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PATIENT PROFILE DETAIL PANEL / DRAWER */}
        {(activePatientDetail || isLoadingDetail || detailError) && (
          <div className="xl:col-span-1 space-y-4">
            {isLoadingDetail && !activePatientDetail ? (
              <div className="p-8 rounded-2xl bg-slate-900/90 border border-teal-500/30 text-center space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-400 mx-auto" />
                <div className="text-xs font-mono text-teal-300">Fetching Patient from Hash Table O(1)...</div>
              </div>
            ) : detailError && !activePatientDetail ? (
              <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Lookup Failed
                  </span>
                  <button onClick={() => setDetailError(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>{detailError}</div>
              </div>
            ) : activePatientDetail ? (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-teal-500/30 shadow-2xl relative space-y-5 animate-in fade-in duration-200">
                {/* Drawer Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                        {activePatientDetail.patient_id}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        {isLoadingDetail && <RefreshCw className="w-3 h-3 animate-spin text-teal-400" />}
                        Hash Table O(1) Match
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">
                      {activePatientDetail.full_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setActivePatientDetail(null);
                      if (onSelectPatient) onSelectPatient(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

              {/* Patient Core Demographics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Age</div>
                  <div className="font-semibold text-white mt-0.5">
                    {activePatientDetail.age ? `${activePatientDetail.age} years` : 'Not recorded'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Phone</div>
                  <div className="font-semibold text-white mt-0.5 truncate">
                    {activePatientDetail.phone || 'No phone'}
                  </div>
                </div>

                <div className="col-span-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Email Address</div>
                  <div className="font-semibold text-white mt-0.5 truncate">
                    {activePatientDetail.email || 'No email provided'}
                  </div>
                </div>
              </div>

              {/* Clinical Allergies Alert Box */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Documented Allergies
                  </span>
                  {activePatientDetail.allergies && activePatientDetail.allergies.toLowerCase() !== 'none' && (
                    <span className="text-[10px] text-rose-400 font-mono uppercase">Clinical Warning</span>
                  )}
                </div>
                <div
                  className={`p-3 rounded-xl text-xs ${
                    activePatientDetail.allergies && activePatientDetail.allergies.toLowerCase() !== 'none'
                      ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200 font-medium'
                      : 'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}
                >
                  {activePatientDetail.allergies || 'No documented allergies.'}
                </div>
              </div>

              {/* Medical Notes & Quick KMP Scanner trigger */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>Clinical Medical Notes</span>
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('scanner');
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Scan with KMP
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 whitespace-pre-line max-h-36 overflow-y-auto leading-relaxed">
                  {activePatientDetail.medical_notes || 'No medical notes documented.'}
                </div>
              </div>

              {/* Appointment History (from AVL Interval Tree query) */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Appointment History ({activePatientDetail.appointments?.length || 0})
                  </span>
                  {onOpenBookModal && (
                    <button
                      onClick={() => onOpenBookModal(activePatientDetail.patient_id)}
                      className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-mono"
                    >
                      <Plus className="w-3 h-3" />
                      Book
                    </button>
                  )}
                </div>

                {!activePatientDetail.appointments || activePatientDetail.appointments.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                    No appointment history on record.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {activePatientDetail.appointments.map((apt) => (
                      <div
                        key={apt.appointment_id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-cyan-400 font-semibold">
                            {apt.appointment_id}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              apt.status === 'Completed'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : apt.status === 'Checked In'
                                ? 'bg-cyan-500/15 text-cyan-300'
                                : apt.status === 'Scheduled'
                                ? 'bg-teal-500/15 text-teal-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>
                        <div className="text-white font-medium text-[11px]">
                          {apt.doctor_name || apt.doctor_id} •{' '}
                          <span className="text-slate-400 text-[10px]">{apt.doctor_specialty}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {new Date(apt.start_at).toLocaleDateString()} at{' '}
                            {new Date(apt.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>• {apt.duration_minutes}m</span>
                        </div>
                        <div className="text-[11px] text-slate-300 italic truncate">"{apt.reason}"</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => openEditModal(activePatientDetail)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => {
                    setPatientToDelete(activePatientDetail);
                    setDeleteConflictError(null);
                  }}
                  className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 rounded-xl text-xs font-semibold transition-all"
                  title="Delete Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      </div>

      {/* REGISTER / EDIT PATIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setIsModalOpen(false);
                if (onCloseRegisterModalExternal) onCloseRegisterModalExternal();
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                {editingPatient ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingPatient ? `Edit Patient — ${editingPatient.patient_id}` : 'Register New Patient'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingPatient
                    ? 'Updates record in SQLite and synchronizes in-memory Trie & Hash Table'
                    : 'Generates deterministic sequential PT-XXXX ID, inserts into Hash Table & Trie'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Full Name */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma, Priya Patel"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.full_name
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-800 focus:border-teal-500'
                  }`}
                />
                {formErrors.full_name && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.full_name}</p>
                )}
              </div>

              {/* Age & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    placeholder="e.g. 28"
                    value={formData.age === null ? '' : formData.age}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        age: e.target.value === '' ? null : parseInt(e.target.value, 10),
                      })
                    }
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-all ${
                      formErrors.age
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-800 focus:border-teal-500'
                    }`}
                  />
                  {formErrors.age && (
                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.age}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 555-0101"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. patient@hospital.internal"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.email
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-800 focus:border-teal-500'
                  }`}
                />
                {formErrors.email && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">{formErrors.email}</p>
                )}
              </div>

              {/* Allergies with quick chips */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Allergies (Critical Safety)</label>
                  <div className="flex gap-1 text-[10px] font-mono">
                    {['Penicillin', 'Latex', 'Sulfa', 'None'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          const current = formData.allergies ? formData.allergies.trim() : '';
                          if (!current || current.toLowerCase() === 'none') {
                            setFormData({ ...formData, allergies: chip });
                          } else if (!current.includes(chip)) {
                            setFormData({ ...formData, allergies: `${current}, ${chip}` });
                          }
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300"
                      >
                        +{chip}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Latex (or 'None')"
                  value={formData.allergies || ''}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Medical Notes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Clinical Medical Notes (Scannable by KMP)
                </label>
                <textarea
                  rows={3}
                  placeholder="Clinical history, chronic conditions, medication instructions..."
                  value={formData.medical_notes || ''}
                  onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    if (onCloseRegisterModalExternal) onCloseRegisterModalExternal();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-950/40 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingPatient ? 'Save Changes' : 'Register & Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL WITH 409 CONFLICT HANDLING */}
      {patientToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white text-center">
              Delete Patient Record?
            </h3>
            <p className="text-xs text-slate-300 text-center mt-1">
              You are about to delete{' '}
              <strong className="text-white">{patientToDelete.full_name}</strong> (
              <span className="font-mono text-teal-300">{patientToDelete.patient_id}</span>).
            </p>

            <div className="p-3 my-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 font-mono">ADS Pruning Guarantee:</div>
              <div>• Removes entry from SQLite database</div>
              <div>• Deletes node from Custom Separate Chaining Hash Table</div>
              <div>• Prunes patient ID and unused characters from Standard Prefix Trie</div>
            </div>

            {/* HTTP 409 Active Appointments Error Banner */}
            {deleteConflictError && (
              <div className="p-3 my-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Referential Safety Constraint (HTTP 409)</span>
                </div>
                <div className="text-[11px] text-rose-200 leading-snug">
                  {deleteConflictError}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 italic">
                  Active or historical appointments depend on this record. Cancel or clear appointments before deleting.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setPatientToDelete(null);
                  setDeleteConflictError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeletePatient}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50 flex items-center gap-1.5"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
