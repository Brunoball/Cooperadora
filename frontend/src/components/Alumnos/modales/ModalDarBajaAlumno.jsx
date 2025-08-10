import React, { useEffect, useState } from 'react';
import './ModalDarBajaAlumno.css';

const ModalDarBajaAlumno = ({ mostrar, alumno, onClose, onDarBaja }) => {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (mostrar) {
      setMotivo('');
      setError('');
    }
  }, [mostrar]);

  if (!mostrar || !alumno) return null;

  const confirmar = () => {
    const txt = motivo.trim();
    if (!txt) {
      setError('Por favor, escribí el motivo de la baja.');
      return;
    }
    onDarBaja(alumno.id_alumno, txt);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <h2>Dar de baja al alumno</h2>
        <p>
          ¿Estás seguro de que querés dar de baja a{' '}
          <strong>{alumno?.apellido_nombre ?? alumno?.nombre ?? '—'}</strong>?
        </p>

        {/* Campo MOTIVO */}
        <label htmlFor="motivo" className="modal-label">Motivo de la baja</label>
        <textarea
          id="motivo"
          className="modal-textarea"
          placeholder="Escribí el motivo…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-botones">
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-confirmar" onClick={confirmar}>Dar de baja</button>
        </div>
      </div>
    </div>
  );
};

export default ModalDarBajaAlumno;
