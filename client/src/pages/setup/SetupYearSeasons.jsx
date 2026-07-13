import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';
import ErrorAlert from '../../components/common/ErrorAlert';

const SEASON_CODES = ['A', 'B', 'C'];

/** Research Mode only — the year drill-down: pick Season A/B/C, lazily created on first click. */
export default function SetupYearSeasons() {
  const { t } = useTranslation();
  const { setupId, year } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [openingCode, setOpeningCode] = useState(null);

  const openSeason = async (seasonCode) => {
    setOpeningCode(seasonCode);
    try {
      const { data } = await api.post(`/setups/${setupId}/seasons/get-or-create`, { year: Number(year), seasonCode });
      navigate(`/seasons/${data.season._id}`);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
      setOpeningCode(null);
    }
  };

  return (
    <Container style={{ maxWidth: 600 }}>
      <div className="d-flex justify-content-between align-items-center my-3">
        <h4 className="mb-0">{year}</h4>
        <Button as={Link} to={`/setups/${setupId}`} variant="secondary" size="sm">
          {t('common.back')}
        </Button>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <Row className="g-3">
        {SEASON_CODES.map((code) => (
          <Col xs={12} sm={4} key={code}>
            <Button
              variant="outline-dark"
              className="w-100 py-4"
              onClick={() => openSeason(code)}
              disabled={Boolean(openingCode)}
            >
              {openingCode === code ? t('common.loading') : t('season.seasonCodeLabel', { code })}
            </Button>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
