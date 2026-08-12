import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import './PdfViewer.css';

export default function PdfViewer({ title, pdfData, show, onHide }) {
  if (!pdfData) return null;

  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <Modal show={show} onHide={onHide} size="xl" fullscreen className="pdf-viewer-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <iframe
          src={pdfUrl}
          style={{ width: '100%', height: '600px', border: 'none' }}
          title={title}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <a href={pdfUrl} download={`${title}.pdf`} className="btn btn-primary">
          Download
        </a>
      </Modal.Footer>
    </Modal>
  );
}
