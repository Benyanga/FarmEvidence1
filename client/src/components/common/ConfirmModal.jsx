import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { useTranslation } from 'react-i18next';

export default function ConfirmModal({ show, title, message, onConfirm, onCancel }) {
  const { t } = useTranslation();

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title || t('common.delete')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message || t('common.confirmDelete')}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('common.delete')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
