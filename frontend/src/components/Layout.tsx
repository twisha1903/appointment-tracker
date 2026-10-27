import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Calendar,
  Users,
  Search,
  Cpu,
  Radio,
  Clock,
  UserPlus,
  CalendarPlus,
  X,
} from 'lucide-react';
import { NavigationTab, Patient, SyncStatus } from '../types';
import { api } from '../services/api';

interface LayoutProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  syncStatus: SyncStatus;
  lastEventTime: string | null;
  onOpenRegisterModal: () => void;
  onOpenBookModal: () => void;
  onSelectPatient: (patientId: string) => void;
  children: React.ReactNode;
}

export function Layout({
  currentTab,
  onSelectTab,
  syncStatus,
  lastEventTime,
  onOpenRegisterModal,
  onOpenBookModal,
  onSelectPatient,
  children,
}: LayoutProps) {
  // Global search state with Trie autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const matches = await api.autocompletePatients(trimmed, 8);
        setSuggestions(matches);
        setShowDropdown(true);
      } catch (err) {
        console.error('Autocomplete failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (patientId: string) => {
    onSelectPatient(patientId);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const navItems = [
    { id: 'dashboard' as NavigationTab, label: 'Overview', icon: Activity, subtitle: 'Live Clinical Dashboard' },
    { id: 'patients' as NavigationTab, label: 'Patients', icon: Users, subtitle: 'Hash Table & Trie Directory' },
    { id: 'appointments' as NavigationTab, label: 'Appointments', icon: Calendar, subtitle: 'AVL Interval Scheduler' },
    { id: 'scanner' as NavigationTab, label: 'Notes Scanner', icon: Search, subtitle: 'KMP Pattern Matcher' },
    { id: 'about' as NavigationTab, label: 'Architecture & Viva', icon: Cpu, subtitle: 'ADS Telemetry & Demo Reset' },
  ];

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">


      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col">
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold text-lg">
                C
              </div>
              <div>
                <h1 className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
                  CareTrack
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    ADS v1.0
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Hospital Patient &amp; Appointment Tracker
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate leading-snug">{item.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/40">
            <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                {currentDateFormatted}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Top Navbar */}
          <header className="h-16 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
            {/* Global Search with Live Trie Autocomplete */}
            <div className="relative flex-1 max-w-md" ref={dropdownRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Quick Search Patient (Trie Prefix: e.g., 'Aarav', 'Sharma')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40 transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                      setShowDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && (
                <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/80">
                  <div className="px-3 py-1.5 bg-slate-800/70 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Matches via Prefix Trie</span>
                    <span className="text-teal-400 font-medium">O(L) Subtree Search</span>
                  </div>

                  {isSearching ? (
                    <div className="p-4 text-center text-xs text-slate-400">Searching Trie branches...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No patients matching "{searchQuery}"</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {suggestions.map((p) => (
                        <button
                          key={p.patient_id}
                          onClick={() => handleSelectSuggestion(p.patient_id)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-teal-500/10 flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white group-hover:text-teal-300 flex items-center gap-2">
                              {p.full_name}
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {p.patient_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Age: {p.age ?? 'N/A'} • {p.phone || 'No phone'}
                            </div>
                          </div>
                          {p.allergies && p.allergies !== 'None' && (
                            <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              Allergy
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Topbar Tools */}
            <div className="flex items-center gap-3">
              {/* Live Connection Status Badge */}
              <div
                className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : syncStatus === 'fallback'
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
                title={`Last received sync: ${lastEventTime || 'none'}`}
              >
                <Radio className={`w-3.5 h-3.5 ${syncStatus === 'connected' ? 'animate-pulse text-emerald-400' : ''}`} />
                <span>
                  {syncStatus === 'connected'
                    ? 'SSE Live'
                    : syncStatus === 'fallback'
                    ? 'Polling Sync (3s)'
                    : 'Offline'}
                </span>
              </div>

              {/* Quick Actions */}
              <button
                onClick={onOpenRegisterModal}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-all shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden md:inline">+ Register Patient</span>
                <span className="md:hidden">+ Patient</span>
              </button>

              <button
                onClick={onOpenBookModal}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-teal-900/30 transition-all"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">+ Book Appointment</span>
                <span className="md:hidden">+ Book</span>
              </button>
            </div>
          </header>

          {/* Page Body View */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
