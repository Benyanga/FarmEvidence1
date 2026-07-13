import React from 'react';
import Nav from 'react-bootstrap/Nav';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Tractor, ClipboardList, Calculator, FileText } from 'lucide-react';

/**
 * Farmer Mode's persistent sidebar — the same five links on every page,
 * mirroring Research Mode's ResearchSidebar. See ProtectedLayout for where
 * this is mounted (role === 'farmer').
 */
export default function FarmerSidebar() {
  const { t } = useTranslation();

  const links = [
    { to: '/dashboard', label: t('nav.dashboard'), Icon: LayoutDashboard },
    { to: '/farms', label: t('nav.farms'), Icon: Tractor },
    { to: '/data-entry', label: t('nav.dataEntry'), Icon: ClipboardList },
    { to: '/cba-results', label: t('nav.cbaResults'), Icon: Calculator },
    { to: '/seasonal-reports', label: t('nav.seasonalReports'), Icon: FileText }
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
