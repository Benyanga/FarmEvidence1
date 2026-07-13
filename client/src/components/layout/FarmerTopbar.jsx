import React from 'react';
import BsNavbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Badge from 'react-bootstrap/Badge';
import { UserButton } from '@clerk/clerk-react';
import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, matchPath } from 'react-router-dom';
import i18n from '../../i18n';
import api from '../../services/api';

// Ordered most-specific-first; matched against the current pathname to label the topbar.
const TITLE_ROUTES = [
  { pattern: '/setups/new', titleKey: 'dashboard.createFarm' },
  { pattern: '/setups/:setupId', titleKey: 'setup.farm' },
  { pattern: '/farms/:setupId/data-entry', titleKey: 'nav.dataEntry' },
  { pattern: '/farms/:setupId/cba-results', titleKey: 'nav.cbaResults' },
  { pattern: '/farms/:setupId/seasonal-reports', titleKey: 'nav.seasonalReports' },
  { pattern: '/farms', titleKey: 'nav.farms' },
  { pattern: '/seasons/:seasonId/data-entry', titleKey: 'nav.dataEntry' },
  { pattern: '/seasons/:seasonId/cba', titleKey: 'nav.cbaResults' },
  { pattern: '/seasons/:seasonId/seasonal-report', titleKey: 'nav.seasonalReports' },
  { pattern: '/data-entry', titleKey: 'nav.dataEntry' },
  { pattern: '/cba-results', titleKey: 'nav.cbaResults' },
  { pattern: '/seasonal-reports', titleKey: 'nav.seasonalReports' },
  { pattern: '/notifications', titleKey: 'nav.notifications' },
  { pattern: '/dashboard', titleKey: 'nav.dashboard' }
];

function usePageTitle() {
  const { pathname } = useLocation();
  const match = TITLE_ROUTES.find((r) => matchPath({ path: r.pattern, end: true }, pathname));
  return match?.titleKey;
}

/** Farmer Mode's persistent topbar: page title, mode badge, language toggle, and the account icon. */
export default function FarmerTopbar() {
  const { t } = useTranslation();
  const titleKey = usePageTitle();

  const toggleLanguage = async () => {
    const next = i18n.language === 'en' ? 'rw' : 'en';
    i18n.changeLanguage(next);
    try {
      await api.put('/users/me', { preferredLanguage: next });
    } catch {
      // best-effort; language still switches locally
    }
  };

  return (
    <BsNavbar bg="success" variant="dark" className="mb-0 px-3 py-2 app-topbar">
      <BsNavbar.Brand as={Link} to="/dashboard" className="me-3 d-flex align-items-center gap-2">
        <Sprout size={20} /> {t('app.name')}
      </BsNavbar.Brand>
      <span className="app-topbar-divider d-none d-sm-block" />
      <Container fluid className="p-0 d-flex justify-content-between align-items-center">
        <span className="text-white fs-5 fw-medium">{titleKey ? t(titleKey) : ''}</span>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-light" onClick={toggleLanguage}>
            {i18n.language === 'en' ? 'RW' : 'EN'}
          </button>
          <Badge bg="light" text="dark" className="app-topbar-badge">
            {t('auth.roleFarmer')}
          </Badge>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </Container>
    </BsNavbar>
  );
}
