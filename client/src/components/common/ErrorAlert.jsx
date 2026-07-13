import React from 'react';
import Alert from 'react-bootstrap/Alert';

export default function ErrorAlert({ error, onClose }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message || 'Something went wrong.';

  return (
    <Alert variant="danger" onClose={onClose} dismissible={Boolean(onClose)}>
      {message}
    </Alert>
  );
}
