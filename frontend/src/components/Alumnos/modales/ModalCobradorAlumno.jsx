import React, { useEffect } from 'react';
import './ModalCobradorAlumno.css';

const ModalCobradorAlumno = ({ mostrar, alumno, nuevoValor, onClose, onConfirm }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (!mostrar) return;
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mostrar, onClose]);

  if (!mostrar) return null;

  const nombre = `${alumno?.apellido ?? ''} ${alumno?.nombre ?? ''}`.trim();

  return (
    <div className="mcob-overlay" onClick={onClose}>
      <div className="mcob-modal" onClick={(e) => e.stopPropagation()}>

        {/* TÍTULO */}
        <div className="mcob-title">
          {nuevoValor === 1
            ? 'Asignar cobro por Cobrador a Domicilio'
            : 'Quitar del cobro por Cobrador a Domicilio'}
        </div>

        {/* CUERPO */}
        <div className="mcob-body">
          <p>
            {nuevoValor === 1
              ? 'El siguiente alumno pasará a ser visitado por el cobrador en su domicilio:'
              : 'El siguiente alumno dejará de ser visitado por el cobrador en su domicilio:'}
          </p>

          <div className="mcob-name">
            {nombre || `Alumno #${alumno?.id_alumno}`}
          </div>

          <p className="mcob-hint">
            Esta opción solo organiza la modalidad de cobro.  
            El monto de la cuota (Interno/Externo) no se modifica.
          </p>
        </div>

        {/* BOTONES */}
        <div className="mcob-actions">
          <button className="mcob-btn mcob-cancel" onClick={onClose}>
            Cancelar
          </button>

          <button className="mcob-btn mcob-ok" onClick={onConfirm}>
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalCobradorAlumno;