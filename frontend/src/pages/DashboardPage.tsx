import { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  ArrowRight,
  Database,
  Binary,
  Layers,
  Sparkles,
  Stethoscope,
  RefreshCw,
  Search,
} from 'lucide-react';
import { DashboardSummary, AppointmentStatus } from '../types';
import { api } from '../services/api';

interface DashboardPageProps {
  onSelectPatient: (patientId: string) => void;
  onNavigateTab: (tab: any) => void;
  onOpenBookModal: () => void;
}

export function DashboardPage({
  onSelectPatient,
  onNavigateTab,
  onOpenBookModal,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const summary = await api.getDashboardSummary();
      setData(summary);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setActionLoadingId(appointmentId);
    try {
      await api.patchAppointmentStatus(appointmentId, newStatus);
      await fetchDashboard();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-teal-400 font-mono text-sm animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Hydrating CareTrack ADS Live State...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200">
        <h3 className="font-bold text-base mb-1">Backend Connection Issue</h3>
        <p className="text-xs text-rose-300 mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const counts = data?.counts || {
    total_patients: 0,
    todays_appointments: 0,
    checked_in: 0,
    completed: 0,
    cancelled: 0,
    scheduled: 0,
    patients: 0,
    doctors: 0,
    appointments: 0,
  };

  const schedule = data?.todays_schedule || [];
  const recentPatients = data?.recent_patients || [];
  const telemetry = data?.ads_telemetry;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/20 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Advanced Data Structures Clinical Evaluation Platform
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Hospital Clinical Workflow &amp; Scheduling Engine
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl mt-1 leading-relaxed">
              Real-time synchronization between durable SQLite storage and in-memory algorithmic 
              indexes: <span className="text-teal-300 font-medium">Custom Hash Table</span>, <span className="text-teal-300 font-medium">Prefix Trie</span>, <span className="text-teal-300 font-medium">Augmented AVL Tree</span>, and <span className="text-teal-300 font-medium">KMP Matcher</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('scanner')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-teal-400" />
              Notes Scanner
            </button>
            <button
              onClick={onOpenBookModal}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </button>
          </div>
        </div>
      </div>

      {/* 6 Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Patients</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{counts.total_patients}</div>
          <div className="text-[11px] text-teal-400/80 mt-1 flex items-center gap-1 font-mono">
            <span>O(1) Hash Table</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Today's Visits</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{counts.todays_appointments}</div>
          <div className="text-[11px] text-cyan-400/80 mt-1 flex items-center gap-1 font-mono">
            <span>AVL Chronological</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Checked In</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{counts.checked_in}</div>
          <div className="text-[11px] text-slate-500 mt-1">In clinic waiting</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{counts.completed}</div>
          <div className="text-[11px] text-slate-500 mt-1">Discharged today</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Upcoming</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{counts.scheduled}</div>
          <div className="text-[11px] text-slate-500 mt-1">Scheduled slots</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Cancelled</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{counts.cancelled}</div>
          <div className="text-[11px] text-slate-500 mt-1">Freed slots</div>
        </div>
      </div>

      {/* Main Grid: Today's Timeline + Recent Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule Timeline (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/70 border border-slate-800 p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                Today's Chronological Appointment Schedule
              </h3>
              <p className="text-xs text-slate-400">
                Ordered in O(n) via Augmented AVL Tree in-order traversal
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('appointments')}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 group"
            >
              Full Calendar
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {schedule.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Calendar className="w-10 h-10 mb-2 text-slate-600" />
              <p className="text-sm">No appointments scheduled for today.</p>
              <button
                onClick={onOpenBookModal}
                className="mt-3 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium"
              >
                + Book First Visit
              </button>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
              {schedule.map((apt) => {
                const startTime = apt.start_at.split('T')[1]?.substring(0, 5) || '';
                const endTime = apt.end_at.split('T')[1]?.substring(0, 5) || '';

                const statusStyles: Record<string, string> = {
                  'Scheduled': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                  'Checked In': 'bg-teal-500/10 text-teal-300 border-teal-500/30',
                  'Completed': 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                  'Cancelled': 'bg-rose-500/10 text-rose-300 border-rose-500/30',
                };

                return (
                  <div
                    key={apt.appointment_id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-center min-w-[70px]">
                        <span className="text-xs font-bold text-white font-mono block">{startTime}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">to {endTime}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectPatient(apt.patient_id)}
                            className="font-bold text-sm text-white hover:text-teal-300 transition-colors text-left"
                          >
                            {apt.patient_name || apt.patient_id}
                          </button>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusStyles[apt.status] || 'bg-slate-800 text-slate-300'}`}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                          <span>{apt.doctor_name || apt.doctor_id}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{apt.doctor_specialty || 'General'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 italic">
                          "{apt.reason}"
                        </div>
                      </div>
                    </div>

                    {/* Quick Status Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {apt.status === 'Scheduled' && (
                        <button
                          disabled={actionLoadingId === apt.appointment_id}
                          onClick={() => handleStatusChange(apt.appointment_id, 'Checked In')}
                          className="px-2.5 py-1 bg-teal-600/80 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition-all"
                        >
                          Check In
                        </button>
                      )}
                      {apt.status === 'Checked In' && (
                        <button
                          disabled={actionLoadingId === apt.appointment_id}
                          onClick={() => handleStatusChange(apt.appointment_id, 'Completed')}
                          className="px-2.5 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all"
                        >
                          Complete
                        </button>
                      )}
                      {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                        <button
                          disabled={actionLoadingId === apt.appointment_id}
                          onClick={() => handleStatusChange(apt.appointment_id, 'Cancelled')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800/40 rounded-lg text-xs transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Patients */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Recent Patients
              </h3>
              <p className="text-xs text-slate-400">Indexed in Custom Hash Table</p>
            </div>
            <button
              onClick={() => onNavigateTab('patients')}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 group"
            >
              All Directory
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
            {recentPatients.map((p) => (
              <button
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className="w-full text-left p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-teal-500/40 hover:bg-slate-800/70 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-sm text-white group-hover:text-teal-300 transition-colors flex items-center gap-2">
                    {p.full_name}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {p.patient_id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Age: {p.age ?? 'N/A'} • {p.phone || 'No phone'}
                  </div>
                  {p.allergies && (
                    <div className="text-[11px] text-amber-300/90 truncate max-w-[200px] mt-1">
                      ⚠ {p.allergies}
                    </div>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live ADS Engine Telemetry Section (Viva Highlights) */}
      {telemetry && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  Live Advanced Data Structures Telemetry
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono font-medium border border-teal-500/30">
                    Viva Instrumentation
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time algorithmic state computed in pure memory without Python dictionary index shortcuts
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Hash Table */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-teal-400 mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">1. Hash Table</span>
                <Binary className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-xs font-semibold text-slate-300 mb-3">Separate Chaining</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Capacity:</span>
                  <span className="text-white font-bold">{telemetry.hash_table.capacity} buckets</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Entries:</span>
                  <span className="text-white font-bold">{telemetry.hash_table.size}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Load Factor:</span>
                  <span className={`font-bold ${telemetry.hash_table.load_factor > 0.75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {telemetry.hash_table.load_factor} / 0.75
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Max Chain:</span>
                  <span className="text-white font-bold">{telemetry.hash_table.max_chain_length} nodes</span>
                </div>
              </div>
            </div>

            {/* 2. Prefix Trie */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-cyan-400 mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">2. Prefix Trie</span>
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xs font-semibold text-slate-300 mb-3">Autocomplete Engine</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Total Nodes:</span>
                  <span className="text-white font-bold">{telemetry.trie.total_nodes}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Terminal Words:</span>
                  <span className="text-white font-bold">{telemetry.trie.terminal_nodes}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Indexed IDs:</span>
                  <span className="text-white font-bold">{telemetry.trie.total_indexed_ids}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Root Branches:</span>
                  <span className="text-white font-bold">{telemetry.trie.root_branches}</span>
                </div>
              </div>
            </div>

            {/* 3. Augmented AVL Tree */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">3. Augmented AVL</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xs font-semibold text-slate-300 mb-3">Interval Conflict Tree</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Tree Size:</span>
                  <span className="text-white font-bold">{telemetry.avl_tree.size} appointments</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Root Height:</span>
                  <span className="text-white font-bold">{telemetry.avl_tree.root_height}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Root Balance:</span>
                  <span className="text-emerald-400 font-bold">{telemetry.avl_tree.root_balance}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Max Endpoint:</span>
                  <span className="text-white font-bold truncate max-w-[90px]" title={telemetry.avl_tree.max_end_at}>
                    {telemetry.avl_tree.max_end_at.split('T')[1]?.substring(0, 5) || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. KMP Engine */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-amber-400 mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">4. KMP Engine</span>
                <Search className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xs font-semibold text-slate-300 mb-3">Clinical Pattern Matcher</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Algorithm:</span>
                  <span className="text-white font-bold">Non-backtracking</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Time Complexity:</span>
                  <span className="text-amber-400 font-bold">O(N + M)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Failure Array:</span>
                  <span className="text-white font-bold">LPS Table π</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Safety Guard:</span>
                  <span className="text-teal-400 font-bold">Active Banner</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
