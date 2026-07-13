import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from 'react-bootstrap/Container';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { X } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { formatDate } from '../../utils/formatters';

const SEVERITY_VARIANT = { info: 'info', warning: 'warning', alert: 'danger' };

export default function NotificationCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
    } catch (err) {
      setError(err.response?.data?.error || { message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    await load();
  };

  const openNotification = async (n) => {
    if (!n.read) {
      await api.put(`/notifications/${n._id}/read`);
      await load();
    }
    if (n.actionLink) navigate(n.actionLink);
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    await load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Container style={{ maxWidth: 700 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3">
        <h4 className="mb-0">{t('nav.notifications')}</h4>
        <div className="d-flex flex-wrap gap-2">
          <Button size="sm" variant="outline-secondary" onClick={markAllRead}>
            Mark all read
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/dashboard')}>
            {t('common.back')}
          </Button>
        </div>
      </div>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {notifications.length === 0 ? (
        <p className="text-muted">{t('common.noData')}</p>
      ) : (
        <ListGroup>
          {notifications.map((n) => (
            <ListGroup.Item
              key={n._id}
              action
              onClick={() => openNotification(n)}
              className={n.read ? 'text-muted' : ''}
            >
              <div className="d-flex flex-wrap justify-content-between gap-1">
                <strong>{n.title}</strong>
                <span className="text-nowrap">
                  <Badge bg={SEVERITY_VARIANT[n.severity]} className="me-2">
                    {n.severity}
                  </Badge>
                  <Button
                    size="sm"
                    variant="link"
                    className="text-danger p-0 d-inline-flex align-items-center"
                    onClick={(e) => remove(n._id, e)}
                  >
                    <X size={16} />
                  </Button>
                </span>
              </div>
              <div className="small">{n.message}</div>
              <div className="text-muted small">{formatDate(n.createdAt)}</div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Container>
  );
}
