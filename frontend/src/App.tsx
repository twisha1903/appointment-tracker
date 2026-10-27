import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { NotesScannerPage } from './pages/NotesScannerPage';
import { AboutSettingsPage } from './pages/AboutSettingsPage';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { NavigationTab } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Trigger refresh on SSE events or polling
  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const { status: syncStatus, lastEventTime } = useRealtimeSync(handleRefresh);

  const handleSelectPatient = (patientId: string | null) => {
    setSelectedPatientId(patientId);
    if (patientId) {
      setCurrentTab('patients');
    }
  };

  const handleOpenRegister = () => {
    setCurrentTab('patients');
    setIsRegisterModalOpen(true);
  };

  const handleOpenBookModal = (patientId?: string) => {
    if (patientId) {
      setSelectedPatientId(patientId);
    }
    setCurrentTab('appointments');
    setIsBookModalOpen(true);
  };

  return (
    <Layout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      syncStatus={syncStatus}
      lastEventTime={lastEventTime}
      onOpenRegisterModal={handleOpenRegister}
      onOpenBookModal={() => handleOpenBookModal()}
      onSelectPatient={handleSelectPatient}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage
          key={refreshTrigger}
          onSelectPatient={handleSelectPatient}
          onNavigateTab={setCurrentTab}
          onOpenBookModal={() => handleOpenBookModal()}
        />
      )}

      {currentTab === 'patients' && (
        <PatientsPage
          key={refreshTrigger}
          selectedPatientId={selectedPatientId}
          onSelectPatient={setSelectedPatientId}
          onNavigateTab={setCurrentTab}
          onOpenBookModal={(patientId) => handleOpenBookModal(patientId)}
          isRegisterModalOpenExternal={isRegisterModalOpen}
          onCloseRegisterModalExternal={() => setIsRegisterModalOpen(false)}
        />
      )}

      {currentTab === 'appointments' && (
        <AppointmentsPage
          key={refreshTrigger}
          onSelectPatient={handleSelectPatient}
          onNavigateTab={setCurrentTab}
          initialPatientId={selectedPatientId}
          isBookModalOpenExternal={isBookModalOpen}
          onCloseBookModalExternal={() => setIsBookModalOpen(false)}
        />
      )}

      {currentTab === 'scanner' && (
        <NotesScannerPage
          key={refreshTrigger}
          onSelectPatient={handleSelectPatient}
          onNavigateTab={setCurrentTab}
          initialPatientId={selectedPatientId}
        />
      )}

      {currentTab === 'about' && (
        <AboutSettingsPage
          key={refreshTrigger}
          onRefreshAll={handleRefresh}
        />
      )}
    </Layout>
  );
}

