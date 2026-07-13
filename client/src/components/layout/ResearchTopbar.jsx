import React from 'react';
import BsNavbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Badge from 'react-bootstrap/Badge';
import { UserButton } from '@clerk/clerk-react';
import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, matchPath } from 'react-router-dom';

// Ordered most-specific-first; matched against the current pathname to label the topbar.
const TITLE_ROUTES = [
  { pattern: '/setups/:setupId/years/:year', titleKey: 'setup.years' },
  { pattern: '/setups/new', titleKey: 'dashboard.createSetup' },
  { pattern: '/setups/:setupId', titleKey: 'nav.setups' },
  { pattern: '/setups', titleKey: 'nav.setups' },
  { pattern: '/seasons/:seasonId/trials/new', titleKey: 'trial.newTrial' },
  { pattern: '/seasons/:seasonId', titleKey: 'common.season' },
  { pattern: '/trials/:trialId/analysis', titleKey: 'nav.analysis' },
  { pattern: '/trials/:trialId', titleKey: 'trial.trial' },
  { pattern: '/trial-plots/:id', titleKey: 'nav.plots' },
  { pattern: '/data-entry', titleKey: 'nav.dataEntry' },
  { pattern: '/analysis', titleKey: 'nav.analysis' },
  { pattern: '/trial-reports', titleKey: 'report.trialReports' },
  { pattern: '/settings', titleKey: 'nav.settings' },
  { pattern: '/notifications', titleKey: 'nav.notifications' },
  { pattern: '/dashboard', titleKey: 'nav.dashboard' }
];

function usePageTitle() {
  const { pathname } = useLocation();
  const match = TITLE_ROUTES.find((r) => matchPath({ path: r.pattern, end: true }, pathname));
  return match?.titleKey;
}

/** Research Mode's persistent topbar: page title, mode badge, and the account/profile icon. */
export default function ResearchTopbar() {
  const { t } = useTranslation();
  const titleKey = usePageTitle();

  return (
    <BsNavbar bg="success" variant="dark" className="mb-0 px-3 py-2 app-topbar">
      <BsNavbar.Brand as={Link} to="/dashboard" className="me-3 d-flex align-items-center gap-2">
        <Sprout size={20} /> {t('app.name')}
      </BsNavbar.Brand>
      <span className="app-topbar-divider d-none d-sm-block" />
      <Container fluid className="p-0 d-flex justify-content-between align-items-center">
        <span className="text-white fs-5 fw-medium">{titleKey ? t(titleKey) : ''}</span>
        <div className="d-flex align-items-center gap-2">
          <Badge bg="light" text="dark" className="app-topbar-badge">
            {t('auth.roleResearcher')}
          </Badge>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </Container>
    </BsNavbar>
  );
}
