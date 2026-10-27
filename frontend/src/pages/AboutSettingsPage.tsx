import { useState, useEffect } from 'react';
import {
  Cpu,
  Binary,
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Hash,
  Activity,
  Code2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { AdsTelemetry } from '../types';
import { api } from '../services/api';

interface AboutSettingsPageProps {
  onRefreshAll?: () => void;
}

export function AboutSettingsPage({ onRefreshAll }: AboutSettingsPageProps) {
  const [telemetry, setTelemetry] = useState<AdsTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Accordion state for Viva Questions
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });

  const toggleFaq = (idx: number) => {
    setOpenFaq((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const summary = await api.getDashboardSummary();
      setTelemetry(summary.ads_telemetry);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch live ADS telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleResetDemoData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the SQLite database to the initial deterministic seed data and re-index all 4 in-memory data structures?'
    );
    if (!confirmed) return;

    setIsResetting(true);
    setResetSuccessMessage(null);
    try {
      const res = await api.resetDemoData();
      setResetSuccessMessage(
        `Demo data successfully reset! Re-indexed ${res.indexed_entities?.patients || 9} patients into Hash Table & Trie, and ${res.indexed_entities?.appointments || 7} appointments into Augmented AVL Tree.`
      );
      await fetchTelemetry();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const vivaQuestions = [
    {
      q: 'Why was a custom Hash Table implemented with Separate Chaining instead of Open Addressing or built-in dicts?',
      a: 'Separate Chaining using linked HashNode lists handles deletions gracefully without clustering or tombstone degradation. It provides expected O(1) retrieval by patient_id using a base-31 polynomial rolling hash, with automatic dynamic resizing at load factor > 0.75.',
    },
    {
      q: 'How does the Prefix Trie handle duplicate patient names without overwriting?',
      a: 'Each Trie terminal node stores a set[patient_id] rather than a single ID. If two distinct patients are named "Aarav Sharma" (PT-1001 and PT-1002), both IDs reside at the same terminal node, allowing O(L) prefix search to return both unique patient profiles cleanly.',
    },
    {
      q: 'How does the Augmented AVL Interval Tree detect double-booking conflicts in O(log N + K)?',
      a: 'Each node maintains an augmented max_end_at value representing the latest completion timestamp in its entire subtree. When scheduling a new interval [start, end), if left.max_end_at > start, an overlapping appointment can only exist in the left branch. This prunes unneeded subtree traversals and prevents double-booking for the same doctor or same patient.',
    },
    {
      q: 'What is the role of the LPS (π) table in the Knuth-Morris-Pratt (KMP) algorithm?',
      a: 'The Longest Proper Prefix which is also a Suffix (LPS) table is precomputed in O(M) time. When a mismatch occurs during clinical text search at pattern[j], the algorithm shifts the pattern to π[j - 1] without ever backtracking the text pointer i, ensuring strict linear O(N + M) scanning.',
    },
    {
      q: 'How is state consistency maintained between SQLite and in-memory structures?',
      a: 'HospitalIndexService acts as the single source of truth: mutations commit first to SQLite via parameterized SQL, and upon commit success, immediately synchronize the in-memory PatientHashTable, PatientNameTrie, and AppointmentAVLTree before broadcasting real-time SSE events.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                System Architecture &amp; Viva Defense Guide
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  ADS Evaluation
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                CareTrack — Hospital Patient &amp; Appointment Tracker (Pure Custom Data Structures)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Refresh ADS Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            <span className="hidden sm:inline">Refresh Dials</span>
          </button>
          <button
            onClick={handleResetDemoData}
            disabled={isResetting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/40 transition-all flex items-center gap-2 group"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset Demo Database</span>
          </button>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {resetSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="leading-snug">{resetSuccessMessage}</span>
          <button
            onClick={() => setResetSuccessMessage(null)}
            className="text-slate-400 hover:text-white ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchTelemetry}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* LIVE ADS TELEMETRY METRIC CONSOLE */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Live ADS Engine Telemetry (Evaluator Dials)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Hash Table Telemetry Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/20">
                <Hash className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/60">
                O(1) Hash Table
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">Patient Record Buckets</div>
              <div className="text-[11px] text-slate-400">Separate Chaining linked lists</div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Active Keys (Size):</span>
                <span className="text-white font-bold">{telemetry?.hash_table.size ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Bucket Capacity:</span>
                <span className="text-white font-bold">{telemetry?.hash_table.capacity ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Load Factor:</span>
                <span
                  className={`font-bold ${
                    (telemetry?.hash_table.load_factor || 0) > 0.75
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {telemetry?.hash_table.load_factor?.toFixed(3) ?? '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Max Chain Length:</span>
                <span className="text-white font-bold">
                  {telemetry?.hash_table.max_chain_length ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Standard Prefix Trie Telemetry Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                <Binary className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                O(L) Prefix Trie
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">Name Autocomplete Tree</div>
              <div className="text-[11px] text-slate-400">Terminal node multi-ID sets</div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total Trie Nodes:</span>
                <span className="text-white font-bold">{telemetry?.trie.total_nodes ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Terminal Words:</span>
                <span className="text-white font-bold">
                  {telemetry?.trie.terminal_nodes ?? '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Indexed Patient IDs:</span>
                <span className="text-cyan-300 font-bold">
                  {telemetry?.trie.total_indexed_ids ?? '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Root Branches:</span>
                <span className="text-white font-bold">{telemetry?.trie.root_branches ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* 3. Augmented AVL Interval Tree Telemetry Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                O(log N + K) AVL
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">Interval Scheduler Tree</div>
              <div className="text-[11px] text-slate-400">Self-balancing height augmentation</div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Active Appointments:</span>
                <span className="text-white font-bold">{telemetry?.avl_tree.size ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tree Root Height:</span>
                <span className="text-white font-bold">
                  {telemetry?.avl_tree.root_height ?? '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Balance Factor:</span>
                <span className="text-emerald-400 font-bold">
                  {telemetry?.avl_tree.root_balance ?? '0'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 truncate">
                <span>Subtree Max End:</span>
                <span className="text-white font-bold truncate max-w-[90px]">
                  {telemetry?.avl_tree.max_end_at?.slice(11, 16) || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. KMP Text Processing Telemetry Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                O(N + M) KMP
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">Clinical Notes Matcher</div>
              <div className="text-[11px] text-slate-400">LPS failure function search</div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Engine Status:</span>
                <span className="text-emerald-400 font-bold">Active</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>LPS Complexity:</span>
                <span className="text-amber-300 font-bold">O(M)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Text Search:</span>
                <span className="text-amber-300 font-bold">O(N + M)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Backtracking:</span>
                <span className="text-emerald-400 font-bold">Zero (i strictly++)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SYLLABUS MAPPING & COMPLEXITY COMPARISON TABLE */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Academic ADS Syllabus Alignment &amp; Theoretical Complexity
          </h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Syllabus Topic</th>
                <th className="px-4 py-3">Implemented Structure</th>
                <th className="px-4 py-3">Time Complexity</th>
                <th className="px-4 py-3">Clinical Function</th>
                <th className="px-4 py-3">Zero Shortcut Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-teal-300">Unit 2: Hashing</td>
                <td className="px-4 py-3 font-mono text-white">PatientHashTable (Separate Chaining)</td>
                <td className="px-4 py-3 font-mono text-teal-400">O(1) expected lookup / insert</td>
                <td className="px-4 py-3 text-slate-300">Instant O(1) patient retrieval by patient_id</td>
                <td className="px-4 py-3 text-slate-400 text-[11px]">
                  Custom HashNode linked lists &amp; base-31 polynomial hash; zero dict shortcuts.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-cyan-300">Unit 5: Tries</td>
                <td className="px-4 py-3 font-mono text-white">PatientNameTrie (Prefix Trie)</td>
                <td className="px-4 py-3 font-mono text-cyan-400">O(L) where L is prefix length</td>
                <td className="px-4 py-3 text-slate-300">Character-by-character live autocomplete</td>
                <td className="px-4 py-3 text-slate-400 text-[11px]">
                  Terminal node set[patient_id] stores duplicate names; recursive pruning.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-emerald-300">Unit 3: AVL Trees</td>
                <td className="px-4 py-3 font-mono text-white">AppointmentAVLTree (Augmented)</td>
                <td className="px-4 py-3 font-mono text-emerald-400">O(log N + K) conflict check</td>
                <td className="px-4 py-3 text-slate-300">Double-booking overlap conflict prevention</td>
                <td className="px-4 py-3 text-slate-400 text-[11px]">
                  4-case rotations (LL, RR, LR, RL) with subtree max_end_at augmentation.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-amber-300">Unit 5: Pattern Matching</td>
                <td className="px-4 py-3 font-mono text-white">Knuth-Morris-Pratt (KMP) Matcher</td>
                <td className="px-4 py-3 font-mono text-amber-400">O(M) table + O(N + M) search</td>
                <td className="px-4 py-3 text-slate-300">Contraindication &amp; allergy text screening</td>
                <td className="px-4 py-3 text-slate-400 text-[11px]">
                  Pure π-table tracking; zero Python "in" or regex usage.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* VIVA DEFENSE PREPARATION ACCORDIONS */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Viva Defense Q&amp;A: Key Examiner Questions &amp; Proofs
          </h3>
        </div>

        <div className="space-y-2">
          {vivaQuestions.map((item, idx) => {
            const isOpen = openFaq[idx] ?? false;

            return (
              <div
                key={idx}
                className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden text-xs"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between font-semibold text-white hover:bg-slate-900/60 transition-colors"
                >
                  <span className="flex items-center gap-2 pr-4">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono text-[10px] shrink-0">
                      Q{idx + 1}
                    </span>
                    <span>{item.q}</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-slate-300 leading-relaxed border-t border-slate-800/60 text-xs">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
