import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import { Tractor, Microscope } from 'lucide-react';
import api from '../../services/api';
import ErrorAlert from '../../components/common/ErrorAlert';

const ROLES = [
  { key: 'farmer', Icon: Tractor },
  { key: 'researcher', Icon: Microscope }
];

export default function RoleSelect() {
  const { t } = useTranslation();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const selectRole = async (role) => {
    setLoading(role);
    setError(null);
    try {
      await api.post('/auth/set-role', { role });
      await user?.reload();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 700 }}>
      <h2 className="text-center mb-4">{t('auth.selectRole')}</h2>
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <Row className="g-4 justify-content-center">
        {ROLES.map(({ key, Icon }) => (
          <Col xs={12} sm={6} key={key}>
            <Card className="h-100 text-center shadow-sm">
              <Card.Body className="d-flex flex-column">
                <Icon size={40} className="mx-auto mb-2 text-success" strokeWidth={1.6} />
                <Card.Title>{t(`auth.role${key.charAt(0).toUpperCase() + key.slice(1)}`)}</Card.Title>
                <Card.Text className="flex-grow-1">{t(`auth.roleDescription${key.charAt(0).toUpperCase() + key.slice(1)}`)}</Card.Text>
                <Button variant="success" disabled={loading !== null} onClick={() => selectRole(key)}>
                  {loading === key ? t('common.loading') : t('common.create')}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
