import React from 'react';
import Spinner from 'react-bootstrap/Spinner';
import { useTranslation } from 'react-i18next';

export default function LoadingSpinner({ inline = false }) {
  const { t } = useTranslation();
  return (
    <div className={inline ? 'd-inline-flex align-items-center gap-2' : 'd-flex justify-content-center align-items-center py-5'}>
      <Spinner animation="border" size={inline ? 'sm' : undefined} role="status" />
      <span className="ms-2">{t('common.loading')}</span>
    </div>
  );
}
