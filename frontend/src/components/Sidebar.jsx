import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Settings,
  ShieldAlert,
  Megaphone,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({ currentPath, onNavigate, isOpen, onOpenAiModal }) {
  const { user, isAdmin, isHR, isEmployee } = useAuth();

  const adminNav = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Employees', path: '/employees', icon: Users },
    { label: 'Attendance Board', path: '/attendance', icon: CalendarCheck },
    { label: 'Leave Approvals', path: '/leaves', icon: CalendarDays },
    { label: 'Payroll & Slabs', path: '/payroll', icon: DollarSign },
    { label: 'Company Settings', path: '/settings', icon: Settings },
    { label: 'Audit Logs', path: '/audit', icon: ShieldAlert },
    { label: 'Announcements', path: '/announcements', icon: Megaphone },
  ];

  const hrNav = [
    { label: 'HR Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Employee Directory', path: '/employees', icon: Users },
    { label: 'Daily Attendance', path: '/attendance', icon: CalendarCheck },
    { label: 'Leave Reviews', path: '/leaves', icon: CalendarDays },
    { label: 'Payroll Drafts', path: '/payroll', icon: DollarSign },
    { label: 'Announcements', path: '/announcements', icon: Megaphone },
  ];

  const employeeNav = [
    { label: 'Personal Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance & Check-in', path: '/attendance', icon: CalendarCheck },
    { label: 'My Leaves', path: '/leaves', icon: CalendarDays },
    { label: 'My Payslips (PDF)', path: '/payroll', icon: DollarSign },
    { label: 'My Profile', path: '/profile', icon: UserCheck },
    { label: 'Announcements', path: '/announcements', icon: Megaphone },
  ];

  let items = employeeNav;
  if (isAdmin) items = adminNav;
  else if (isHR) items = hrNav;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={() => onNavigate(currentPath)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            display: 'block',
          }}
          className="sidebar-backdrop"
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: 260,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '20px 14px',
          height: 'calc(100vh - 64px)',
          position: 'sticky',
          top: 64,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 45,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: '0 10px 10px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {user?.role} PORTAL
          </div>

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* AI Assistant Quick Card in Sidebar */}
        <div
          onClick={onOpenAiModal}
          style={{
            padding: 14,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
            border: '1px solid rgba(168,85,247,0.25)',
            cursor: 'pointer',
            marginTop: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Sparkles size={16} color="#A855F7" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#C084FC' }}>
              HCM Lite AI
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
            Instant policy Q&A, leave balances, and live company statistics.
          </p>
        </div>
      </aside>

      <style>{`
        @media (max-width: 900px) {
          .sidebar {
            position: fixed !important;
            top: 64px !important;
            left: 0 !important;
            bottom: 0 !important;
            height: calc(100vh - 64px) !important;
            transform: translateX(-100%);
            box-shadow: var(--shadow-lg);
          }
          .sidebar-open {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </>
  );
}
