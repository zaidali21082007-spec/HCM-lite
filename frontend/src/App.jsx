import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AiAssistantModal from './components/AiAssistantModal';
import AttendanceCheckInModal from './components/AttendanceCheckInModal';

// Pages
import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import LeavesPage from './pages/LeavesPage';
import PayrollPage from './pages/PayrollPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { user, loading, isConfigured, isAdmin, isHR } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-muted)',
          fontSize: '1rem',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Initializing HCM Lite...
      </div>
    );
  }

  // 1. Initial first-run setup required
  if (!isConfigured) {
    return <SetupPage />;
  }

  // 2. Authentication required
  if (!user) {
    return <LoginPage />;
  }

  // 3. Mandatory password change for temporary passwords
  if (user.isTemporaryPassword && currentPath !== '/change-password') {
    return <ChangePasswordPage />;
  }

  // Router dispatcher
  const renderActivePage = () => {
    switch (currentPath) {
      case '/dashboard':
      case '/':
        return (
          <DashboardPage
            onOpenCheckInModal={() => setIsCheckInOpen(true)}
            onOpenAiModal={() => setIsAiOpen(true)}
          />
        );
      case '/employees':
        return isAdmin || isHR ? <EmployeesPage /> : <DashboardPage />;
      case '/attendance':
        return <AttendancePage onOpenCheckInModal={() => setIsCheckInOpen(true)} />;
      case '/leaves':
        return <LeavesPage />;
      case '/payroll':
        return <PayrollPage />;
      case '/settings':
        return isAdmin ? <CompanySettingsPage /> : <DashboardPage />;
      case '/audit':
        return isAdmin ? <AuditLogsPage /> : <DashboardPage />;
      case '/announcements':
        return <AnnouncementsPage />;
      case '/profile':
        return <ProfilePage />;
      case '/change-password':
        return <ChangePasswordPage />;
      default:
        return (
          <DashboardPage
            onOpenCheckInModal={() => setIsCheckInOpen(true)}
            onOpenAiModal={() => setIsAiOpen(true)}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={navigate}
        isOpen={isSidebarOpen}
        onOpenAiModal={() => setIsAiOpen(true)}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenAiModal={() => setIsAiOpen(true)}
        />

        <main style={{ flex: 1 }}>{renderActivePage()}</main>
      </div>

      {/* Floating AI Assistant Drawer */}
      <AiAssistantModal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />

      {/* Web Check-In / Check-Out Modal */}
      <AttendanceCheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onAttendanceRecorded={() => {
          // Triggers refresh of views
        }}
      />
    </div>
  );
}
