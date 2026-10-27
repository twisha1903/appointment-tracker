import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  FileText,
  Table,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  KmpScanResponse,
  Patient,
  NavigationTab,
} from '../types';
import { api } from '../services/api';

interface NotesScannerPageProps {
  onSelectPatient?: (patientId: string) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  initialPatientId?: string | null;
}

export function NotesScannerPage({
  onSelectPatient,
  onNavigateTab,
  initialPatientId,
}: NotesScannerPageProps) {
  // Input states
  const [keywordInput, setKeywordInput] = useState('Penicillin');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || 'all');
  const [patients, setPatients] = useState<Patient[]>([]);

  // Scan execution states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<KmpScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Expanded LPS tables
  const [expandedLps, setExpandedLps] = useState<Record<string, boolean>>({
    Penicillin: true,
  });

  // Demo Preset Chips
  const presetKeywords = [
    'Penicillin',
    'Latex',
    'Peanut allergy',
    'Fever',
    'Shortness of breath',
    'Sulfa',
    'Asthma',
    'Hypertension',
  ];

  // Load patients list for dropdown
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const list = await api.getPatients();
        setPatients(list);
      } catch (err) {
        console.error('Failed to load patients for scanner', err);
      }
    };
    fetchPatients();
  }, []);

  // Update selected patient if initialPatientId changes
  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  // Execute KMP Scan
  const handleExecuteScan = async (overrideKeyword?: string) => {
    const terms = (overrideKeyword || keywordInput)
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (terms.length === 0) {
      setError('Please provide at least one valid search keyword.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const payload: { keywords: string[]; patient_id?: string } = {
        keywords: terms,
      };
      if (selectedPatientId !== 'all') {
        payload.patient_id = selectedPatientId;
      }

      const response = await api.searchNotes(payload);
      setScanResult(response);
      setHasScanned(true);

      // Auto-expand first LPS table
      if (response.scanned_keywords.length > 0) {
        setExpandedLps({ [response.scanned_keywords[0]]: true });
      }
    } catch (err: any) {
      setError(err.message || 'KMP pattern matching scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Safe keyword highlighter using React spans (NO dangerouslySetInnerHTML)
  const renderHighlightedSnippet = (text: string, matchedKeyword: string) => {
    if (!text || !matchedKeyword) return <span>{text}</span>;

    const lowerText = text.toLowerCase();
    const lowerKey = matchedKeyword.toLowerCase();
    const parts: React.ReactNode[] = [];
    let start = 0;

    while (start < text.length) {
      const index = lowerText.indexOf(lowerKey, start);
      if (index === -1) {
        parts.push(text.slice(start));
        break;
      }

      if (index > start) {
        parts.push(text.slice(start, index));
      }

      parts.push(
        <mark
          key={`${index}-${start}`}
          className="bg-amber-400/30 text-amber-200 font-bold px-1 py-0.5 rounded border border-amber-400/40"
        >
          {text.slice(index, index + matchedKeyword.length)}
        </mark>
      );

      start = index + matchedKeyword.length;
    }

    return <span>{parts}</span>;
  };

  // Collect unique LPS tables across all matches or compute visually
  const lpsTablesByKeyword = useMemo(() => {
    const map: Record<string, number[]> = {};
    if (!scanResult) return map;

    scanResult.results.forEach((p) => {
      p.all_matches.forEach((m) => {
        if (m.keyword && m.lps_table && !map[m.keyword]) {
          map[m.keyword] = m.lps_table;
        }
      });
    });

    return map;
  }, [scanResult]);

  return (
    <div className="space-y-6">
      {/* MANDATORY CLINICAL SAFETY WARNING BANNER */}
      <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 shadow-xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold uppercase tracking-wider text-amber-300">
            Mandatory Clinical Safety Notice
          </div>
          <p className="leading-relaxed text-amber-200/90 font-medium">
            Potential keyword match — clinician review required. Keyword matching is a pure text-search
            utility powered by the Knuth-Morris-Pratt (KMP) algorithm and does not constitute a clinical
            diagnosis, prescription validation, or confirmed allergen clearance.
          </p>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Knuth-Morris-Pratt (KMP) Notes Scanner
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Data Structure 4 • Text Processing
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Non-backtracking linear text search in <strong>O(N + M)</strong> time via the precomputed{' '}
                <strong>Longest Proper Prefix which is also a Suffix (LPS / π)</strong> table.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
            Zero Backtracking Pointer <span className="text-amber-400 font-semibold">i</span>
          </span>
        </div>
      </div>

      {/* SCANNER CONTROLS & KEYWORD INPUT */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Patient Scope Selector */}
          <div>
            <label className="block text-slate-300 text-xs font-medium mb-1.5">
              Search Target Scope
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors font-sans"
            >
              <option value="all">All Patients (Global Registry Scan)</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.full_name} ({p.patient_id})
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search Input */}
          <div className="md:col-span-2">
            <label className="block text-slate-300 text-xs font-medium mb-1.5">
              Search Patterns / Clinical Keywords (Comma-separated for batch scan)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Latex, Peanut allergy, Fever..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteScan();
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-sans"
                />
              </div>
              <button
                onClick={() => handleExecuteScan()}
                disabled={isScanning || !keywordInput.trim()}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-950/40 transition-all flex items-center gap-1.5 shrink-0"
              >
                {isScanning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Scan Clinical Notes (KMP)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Demo Preset Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-400 font-mono">Viva Demonstration Keywords:</span>
          {presetKeywords.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setKeywordInput(preset);
                handleExecuteScan(preset);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 text-xs font-mono transition-colors flex items-center gap-1"
            >
              <span>+{preset}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleExecuteScan()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* KMP LPS (π) FAILURE FUNCTION INSPECTOR */}
      {scanResult && Object.keys(lpsTablesByKeyword).length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Table className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  KMP Failure Function: Computed LPS (π) Tables
                </h3>
                <p className="text-[11px] text-slate-400">
                  Precomputed in O(M) time to dictate jump offsets without text backtracking
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
              O(M) Preprocessing
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(lpsTablesByKeyword).map(([kw, lps]) => {
              const chars = kw.split('');
              const isExpanded = expandedLps[kw] ?? true;

              return (
                <div
                  key={kw}
                  className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedLps({ ...expandedLps, [kw]: !isExpanded })}
                    className="w-full px-4 py-2.5 bg-slate-900/60 flex items-center justify-between text-xs font-mono hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">Pattern:</span>
                      <span className="text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        "{kw}"
                      </span>
                      <span className="text-slate-400 text-[11px]">Length M = {kw.length}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 overflow-x-auto">
                      <div className="text-[11px] text-slate-400 mb-2 font-mono">
                        π[j] represents the length of the longest proper prefix of pattern[0..j] which is
                        also a suffix:
                      </div>

                      <div className="inline-block border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                        {/* Index row */}
                        <div className="flex bg-slate-900 border-b border-slate-800">
                          <div className="w-20 px-3 py-1.5 text-slate-400 font-bold border-r border-slate-800 text-[11px]">
                            Index j
                          </div>
                          {chars.map((_, idx) => (
                            <div
                              key={idx}
                              className="w-10 text-center py-1.5 text-slate-400 border-r border-slate-800/60 last:border-r-0 text-[11px]"
                            >
                              {idx}
                            </div>
                          ))}
                        </div>

                        {/* Character row */}
                        <div className="flex bg-slate-950 border-b border-slate-800">
                          <div className="w-20 px-3 py-2 text-slate-300 font-bold border-r border-slate-800 text-[11px]">
                            char[j]
                          </div>
                          {chars.map((ch, idx) => (
                            <div
                              key={idx}
                              className="w-10 text-center py-2 text-white font-bold border-r border-slate-800/60 last:border-r-0"
                            >
                              {ch}
                            </div>
                          ))}
                        </div>

                        {/* LPS / Pi row */}
                        <div className="flex bg-amber-950/30">
                          <div className="w-20 px-3 py-2 text-amber-300 font-bold border-r border-slate-800 text-[11px]">
                            π[j]
                          </div>
                          {lps.map((val, idx) => (
                            <div
                              key={idx}
                              className={`w-10 text-center py-2 font-bold border-r border-slate-800/60 last:border-r-0 ${
                                val > 0 ? 'text-amber-300 bg-amber-500/20' : 'text-slate-500'
                              }`}
                            >
                              {val}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCAN RESULTS SUMMARY & CARDS */}
      {scanResult && (
        <div className="space-y-4">
          {/* Summary counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 text-[11px] uppercase">Total Occurrences Found</div>
              <div className="text-xl font-bold text-amber-300 mt-0.5">
                {scanResult.total_occurrences}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 text-[11px] uppercase">Patients with Matches</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {scanResult.total_patients_matched}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 text-[11px] uppercase">Scanned Keywords</div>
              <div className="text-sm font-bold text-cyan-300 mt-1 truncate">
                {scanResult.scanned_keywords.join(', ')}
              </div>
            </div>
          </div>

          {/* Matches List */}
          {scanResult.results.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Clinical Matches Detected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No occurrences of "{scanResult.scanned_keywords.join(', ')}" were found in the scanned
                clinical notes or allergies fields.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {scanResult.results.map((patientResult) => (
                <div
                  key={patientResult.patient_id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/30 transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-teal-300 font-mono font-bold flex items-center justify-center text-xs">
                        {patientResult.patient_id.slice(-4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (onSelectPatient) onSelectPatient(patientResult.patient_id);
                              if (onNavigateTab) onNavigateTab('patients');
                            }}
                            className="text-base font-bold text-white hover:text-amber-300 transition-colors flex items-center gap-1.5"
                          >
                            <span>{patientResult.full_name}</span>
                            <span className="font-mono text-xs text-teal-400">
                              [{patientResult.patient_id}]
                            </span>
                          </button>
                        </div>
                        <div className="text-xs text-slate-400">
                          Age: {patientResult.age ?? 'N/A'} • Found {patientResult.total_matches}{' '}
                          keyword match(es)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Potential keyword match — clinician review required
                      </span>
                    </div>
                  </div>

                  {/* Individual Match Items */}
                  <div className="space-y-3">
                    {patientResult.all_matches.map((match, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              Keyword: "{match.keyword}"
                            </span>
                            <span className="text-slate-400">
                              Offsets: [{match.start_index}..{match.end_index}]
                            </span>
                          </div>
                          <span className="text-slate-500 text-[10px]">
                            Length: {match.matched_text.length} chars
                          </span>
                        </div>

                        {/* Highlighted Snippet */}
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 font-sans text-slate-200 leading-relaxed">
                          {renderHighlightedSnippet(match.snippet || match.matched_text, match.keyword)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Complete Allergies & Medical Notes Context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">
                        Full Allergies Record
                      </div>
                      <div className="text-slate-300">
                        {patientResult.allergies || 'None documented'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">
                        Full Medical Notes Record
                      </div>
                      <div className="text-slate-300 max-h-24 overflow-y-auto leading-relaxed">
                        {patientResult.medical_notes || 'No medical notes'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INITIAL PROMPT IF NOT YET SCANNED */}
      {!hasScanned && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Knuth-Morris-Pratt Clinical Text Engine Ready</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select a target scope or click any of the preset demo keywords above to execute real-time
            linear text scanning across all patient allergies and clinical medical notes.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleExecuteScan()}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-950/40"
            >
              Scan with Default Keyword ("Penicillin")
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
