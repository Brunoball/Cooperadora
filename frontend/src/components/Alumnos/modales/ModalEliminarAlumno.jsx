import React, { useEffect, useMemo, useCallback } from 'react';
import './ModalEliminarAlumno.css';

const ModalEliminarAlumno = ({ mostrar, alumno, onClose, onEliminar }) => {
  // Hook siempre al tope (sin returns antes)
  useEffect(() => {
    if (!mostrar) return; // si no está visible, no agregamos el listener
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mostrar, onClose]);

  const nombreMostrado = useMemo(() => {
    if (!alumno) return '';
    const partes = [
      alumno?.apellido ?? '',
      alumno?.nombre ?? '',
      alumno?.nombre_completo ?? '',
      alumno?.nombreyapellido ?? '',
      alumno?.nyap ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return partes || alumno?.nombre || '';
  }, [alumno]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    },
    [onClose]
  );

  // Ahora sí, si no hay que mostrar o no hay alumno, no renderizamos
  if (!mostrar || !alumno) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <h3>¿Deseás eliminar a {nombreMostrado}?</h3>
        <p>Esta acción no se puede deshacer.</p>

        <div className="botones-modal">
          <button className="btn-cancelar" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-aceptar"
            onClick={() => onEliminar(alumno.id_alumno)}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalEliminarAlumno;
