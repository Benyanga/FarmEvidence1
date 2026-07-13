import React from 'react';
import BsNavbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import { UserButton } from '@clerk/clerk-react';
import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useRole from '../../hooks/useRole';
import i18n from '../../i18n';
import api from '../../services/api';

export default function Navbar() {
  const { t } = useTranslation();
  const { role } = useRole();

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
    <BsNavbar bg="success" variant="dark" expand="lg" className="mb-3">
      <Container fluid>
        <BsNavbar.Brand as={Link} to="/dashboard" className="d-flex align-items-center gap-2">
          <Sprout size={20} /> {t('app.name')}
        </BsNavbar.Brand>
        <BsNavbar.Toggle aria-controls="main-navbar" />
        <BsNavbar.Collapse id="main-navbar">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/dashboard">
              {t('nav.dashboard')}
            </Nav.Link>
            <Nav.Link as={Link} to="/setups">
              {t('nav.setups')}
            </Nav.Link>
            <Nav.Link as={Link} to="/reports">
              {t('nav.reports')}
            </Nav.Link>
            <Nav.Link as={Link} to="/notifications">
              {t('nav.notifications')}
            </Nav.Link>
          </Nav>
          <Nav className="align-items-lg-center gap-2">
            {role === 'farmer' && (
              <button className="btn btn-sm btn-outline-light" onClick={toggleLanguage}>
                {i18n.language === 'en' ? 'RW' : 'EN'}
              </button>
            )}
            <UserButton afterSignOutUrl="/sign-in" />
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
