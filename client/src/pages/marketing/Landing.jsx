import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Sprout, Wheat, Tractor, Microscope, BarChart3, Satellite, CheckCircle2 } from 'lucide-react';
import './Landing.css';

const FEATURES = [
  {
    Icon: Tractor,
    tone: 'green',
    title: 'Farmer Mode',
    body: 'Record input costs, labour, and yield per plot every season, then see your net benefit and adoption cost the moment you save.'
  },
  {
    Icon: Microscope,
    tone: 'dark',
    title: 'Research Mode',
    body: 'Design RCBD trials with any number of treatments and replicates, register treatments, and log plot-level data with full traceability.'
  },
  {
    Icon: BarChart3,
    tone: 'green',
    title: 'Built-in analysis',
    body: 'Cost-benefit summaries, ANOVA, compact-letter groupings, break-even, sensitivity and partial budgets — computed automatically from your data.'
  },
  {
    Icon: Satellite,
    tone: 'dark',
    title: 'Offline-first',
    body: 'Keep recording in the field with no signal. FarmEvidence saves locally and syncs everything the moment you are back online.'
  }
];

// Drop the real files into client/public/images/landing/ using these exact
// names and they appear here automatically — no code change needed.
const GALLERY_PHOTOS = [
  { src: '/images/landing/field-1.jpg', alt: 'Farmer clearing crop residue on a Conservation Agriculture plot' },
  { src: '/images/landing/field-2.jpg', alt: 'Sorting harvested beans by hand at the drying site' },
  { src: '/images/landing/field-3.jpg', alt: 'Recording plot data next to a labelled trial marker' },
  { src: '/images/landing/field-4.jpg', alt: 'Team threshing dried maize stalks together' },
  { src: '/images/landing/field-5.jpg', alt: 'Logging harvest weights in a field notebook' },
  { src: '/images/landing/field-6.jpg', alt: 'Checking stored produce sacks inside the greenhouse' }
];

const STEPS = [
  { title: 'Set up', body: 'Create a setup, add seasons or a trial, and register your treatments or plots.' },
  { title: 'Record', body: 'Log costs, labour and yield in the field — online or offline, on any device.' },
  { title: 'Analyze', body: 'Open the analysis dashboard for evidence-based CBA and statistics, ready to export.' }
];

export default function Landing() {
  const { t } = useTranslation();
  const { isLoaded, isSignedIn } = useAuth();
  const showDashboardCta = isLoaded && isSignedIn;

  return (
    <div className="landing">
      <Navbar expand="md" sticky="top" className="landing-nav py-3">
        <Container>
          <Navbar.Brand as={Link} to="/" className="landing-brand d-flex align-items-center gap-2">
            <Sprout size={22} /> {t('app.name')}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="landing-nav" />
          <Navbar.Collapse id="landing-nav" className="justify-content-end">
            <Nav className="align-items-md-center gap-2 mt-3 mt-md-0">
              {showDashboardCta ? (
                <Button as={Link} to="/dashboard" className="btn-landing-solid text-white" size="sm">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/sign-in" variant="outline-success" size="sm">
                    Sign In
                  </Button>
                  <Button as={Link} to="/sign-up" className="btn-landing-solid text-white" size="sm">
                    Sign Up Free
                  </Button>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <header className="hero-section">
        <div className="hero-blob hero-blob-green" />
        <div className="hero-blob hero-blob-dark" />
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <span className="hero-eyebrow">
                <Wheat size={15} /> Conservation Agriculture, backed by evidence
              </span>
              <h1 className="hero-title mt-3 mb-3">
                Turn field data into <span className="text-gradient">decisions you can trust</span>
              </h1>
              <p className="hero-lead mb-4">
                FarmEvidence helps farmers and researchers track costs, labour, and yield trial-by-trial or
                season-by-season — then does the cost-benefit and statistical analysis for you, online or offline.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-2">
                {showDashboardCta ? (
                  <Button as={Link} to="/dashboard" size="lg" className="btn-landing-solid text-white">
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button as={Link} to="/sign-up" size="lg" className="btn-landing-solid text-white">
                      Get Started Free
                    </Button>
                    <Button as={Link} to="/sign-in" size="lg" variant="outline-success">
                      Sign In
                    </Button>
                  </>
                )}
              </div>
            </Col>

            <Col lg={6}>
              <div className="hero-mock">
                <div className="hero-photo">
                  <img src="/images/landing/field-5.jpg" alt="Recording harvest data in a field notebook" />
                </div>
                <div className="hero-stat-overlay">
                  <div className="hero-stat-tile">
                    <div className="text-muted small">Net Benefit</div>
                    <div className="stat-value">RWF 482K</div>
                  </div>
                  <div className="hero-stat-tile">
                    <div className="text-muted small">Avg Yield</div>
                    <div className="stat-value">3.4 t/ha</div>
                  </div>
                </div>
                <div className="hero-floating-badge">
                  <CheckCircle2 size={16} className="text-success" /> Synced offline
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </header>

      <section className="py-5 py-md-6" id="features">
        <Container className="py-4">
          <div className="text-center mb-5">
            <div className="section-label">Why FarmEvidence</div>
            <h2 className="section-title mt-2">Everything a trial or season needs, in one place</h2>
          </div>
          <Row className="g-4">
            {FEATURES.map((f) => (
              <Col xs={12} sm={6} lg={3} key={f.title}>
                <div className="feature-card">
                  <div className={`feature-icon feature-icon-${f.tone}`}>
                    <f.Icon size={26} strokeWidth={1.8} className={f.tone === 'green' ? 'text-success' : 'text-dark'} />
                  </div>
                  <h5 className="fw-bold mb-2">{f.title}</h5>
                  <p className="text-muted mb-0 small">{f.body}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="py-5 py-md-6" id="gallery">
        <Container className="py-4">
          <div className="text-center mb-5">
            <div className="section-label">In the field</div>
            <h2 className="section-title mt-2">Real farms, real evidence</h2>
          </div>
          <Row className="g-3">
            {GALLERY_PHOTOS.map((photo) => (
              <Col xs={6} md={4} key={photo.src}>
                <div className="gallery-tile">
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="py-5 py-md-6 bg-light" id="how-it-works">
        <Container className="py-4">
          <div className="text-center mb-5">
            <div className="section-label">How it works</div>
            <h2 className="section-title mt-2">From setup to evidence in three steps</h2>
          </div>
          <Row className="g-4">
            {STEPS.map((s, i) => (
              <Col xs={12} md={4} key={s.title}>
                <div className="how-step">
                  <div className="how-step-number">{i + 1}</div>
                  <h5 className="fw-bold mb-2">{s.title}</h5>
                  <p className="text-muted mb-0 small">{s.body}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="py-5">
        <Container>
          <div className="cta-band">
            <h2 className="fw-bold mb-2">Ready to bring evidence to your fields?</h2>
            <p className="mb-4 opacity-75">Create your free account and start recording your first season or trial today.</p>
            {showDashboardCta ? (
              <Button as={Link} to="/dashboard" size="lg" className="btn-cta-white">
                Go to Dashboard
              </Button>
            ) : (
              <Button as={Link} to="/sign-up" size="lg" className="btn-cta-white">
                Get Started Free
              </Button>
            )}
          </div>
        </Container>
      </section>

      <footer className="landing-footer">
        <Container>
          <Row className="g-4">
            <Col xs={12} md={4}>
              <div className="footer-brand mb-2 d-flex align-items-center gap-2">
                <Sprout size={20} /> {t('app.name')}
              </div>
              <p className="small mb-0">
                Evidence-based Conservation Agriculture tracking for farmers and researchers — costs, yield, and
                statistics, online or offline.
              </p>
            </Col>
            <Col xs={6} md={2}>
              <h6>Product</h6>
              <Nav className="flex-column">
                <Nav.Link as="a" href="#features" className="px-0 py-1">
                  Features
                </Nav.Link>
                <Nav.Link as="a" href="#how-it-works" className="px-0 py-1">
                  How it works
                </Nav.Link>
              </Nav>
            </Col>
            <Col xs={6} md={2}>
              <h6>Modes</h6>
              <Nav className="flex-column">
                <Nav.Link as="a" href="#features" className="px-0 py-1">
                  Farmer Mode
                </Nav.Link>
                <Nav.Link as="a" href="#features" className="px-0 py-1">
                  Research Mode
                </Nav.Link>
              </Nav>
            </Col>
            <Col xs={12} md={4}>
              <h6>Get started</h6>
              <Nav className="flex-column">
                <Nav.Link as={Link} to="/sign-in" className="px-0 py-1">
                  Sign In
                </Nav.Link>
                <Nav.Link as={Link} to="/sign-up" className="px-0 py-1">
                  Sign Up
                </Nav.Link>
              </Nav>
            </Col>
          </Row>
          <hr />
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 footer-bottom">
            <span>© {new Date().getFullYear()} FarmEvidence. All rights reserved.</span>
            <span>Built for Conservation Agriculture trials and practice.</span>
          </div>
        </Container>
      </footer>
    </div>
  );
}
