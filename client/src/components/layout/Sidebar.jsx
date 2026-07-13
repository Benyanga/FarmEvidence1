import React from 'react';
import Nav from 'react-bootstrap/Nav';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Contextual sidebar — Farmer Mode only. Farmer Mode is scoped by seasonId:
 * the sidebar appears once a farmer has clicked into a specific season,
 * with Data Entry / CBA Results / Seasonal Reports living inside that
 * season. Research Mode's navigation lives inside the Trial workspace
 * (Treatment Register / Plots / Analysis tabs) instead of a setup-level
 * sidebar — see TrialDetail.jsx / TrialAnalysisDashboard.jsx. Renders as a
 * horizontally-scrollable strip on mobile and a vertical column on md+.
 */
export default function Sidebar({ seasonId }) {
  const { t } = useTranslation();

  const links = [
    { to: `/seasons/${seasonId}/data-entry`, label: t('nav.dataEntry') },
    { to: `/seasons/${seasonId}/cba`, label: t('nav.cbaResults') },
    { to: `/seasons/${seasonId}/seasonal-report`, label: t('nav.seasonalReports') }
  ];

  return (
    <Nav className="sidebar-nav flex-row flex-md-column flex-nowrap overflow-auto border-bottom border-md-end mb-3 pb-2 pb-md-0 pe-md-3">
      {links.map((link) => (
        <Nav.Link key={link.to} as={NavLink} to={link.to} className="text-body text-nowrap" end={Boolean(link.end)}>
          {link.label}
        </Nav.Link>
      ))}
    </Nav>
  );
}
