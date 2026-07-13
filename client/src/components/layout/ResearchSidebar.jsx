import React from 'react';
import Nav from 'react-bootstrap/Nav';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sprout, ClipboardList, BarChart3, FileText, Settings } from 'lucide-react';

/**
 * Research Mode's persistent sidebar — the same six links on every page,
 * unlike the Farmer-only, per-page-scoped `Sidebar.jsx`. See ProtectedLayout
 * for where this is mounted (role === 'researcher').
 */
export default function ResearchSidebar() {
  const { t } = useTranslation();

  const links = [
    { to: '/dashboard', label: t('nav.dashboard'), Icon: LayoutDashboard },
    { to: '/setups', label: t('nav.setups'), Icon: Sprout },
    { to: '/data-entry', label: t('nav.dataEntry'), Icon: ClipboardList },
    { to: '/analysis', label: t('nav.analysis'), Icon: BarChart3 },
    { to: '/trial-reports', label: t('nav.reports'), Icon: FileText },
    { to: '/settings', label: t('nav.settings'), Icon: Settings }
  ];

  return (
    <Nav
      className="app-sidebar flex-row flex-md-column flex-nowrap overflow-auto border-end bg-light p-2"
      style={{ minWidth: 200, maxWidth: 220 }}
    >
      {links.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-link app-sidebar-link text-nowrap d-flex align-items-center gap-2 mb-1${isActive ? ' active' : ''}`}
        >
          <Icon size={18} strokeWidth={1.8} />
          {label}
        </NavLink>
      ))}
    </Nav>
  );
}
