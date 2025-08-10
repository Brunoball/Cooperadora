import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './ModalInfoAlumno.css';

const ModalInfoAlumno = ({ mostrar, alumno, onClose }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!mostrar) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mostrar, onClose]);

  const [pestania, setPestania] = useState('datos'); // 'datos' | 'contacto' | 'academico'

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

  const construirDomicilio = useCallback((v) => (v || '').trim(), []);
  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    },
    [onClose]
  );

  // No render si no corresponde
  if (!mostrar || !alumno) return null;

  const dni = alumno?.dni || '-';
  const domicilio = construirDomicilio(alumno?.domicilio);
  const localidad = alumno?.localidad || '-';
  const telefono = alumno?.telefono || alumno?.tel || '-';
  const anio = alumno?.anio_nombre || alumno?.anio || '-';
  const division = alumno?.division_nombre || alumno?.division || '-';
  const categoria = alumno?.categoria_nombre || alumno?.id_categoria || '-';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">Información del Alumno</h2>
            <p className="modal-subtitle">
              ID: {alumno.id_alumno} | {nombreMostrado}
            </p>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Pestañas */}
        <div className="modal-tabs">
          <div
            className={`tab ${pestania === 'datos' ? 'active' : ''}`}
            onClick={() => setPestania('datos')}
          >
            Datos
          </div>
          <div
            className={`tab ${pestania === 'contacto' ? 'active' : ''}`}
            onClick={() => setPestania('contacto')}
          >
            Contacto
          </div>
          <div
            className={`tab ${pestania === 'academico' ? 'active' : ''}`}
            onClick={() => setPestania('academico')}
          >
            Académico
          </div>
        </div>

        {/* Contenido */}
        <div className="modal-content">
          {pestania === 'datos' && (
            <div className="tab-content active">
              <div className="info-grid">
                {/* Datos Personales ocupa todo el ancho */}
                <div className="info-card info-card-full">
                  <h3 className="info-card-title">Datos Personales</h3>
                  <div className="info-item">
                    <span className="info-label">Apellido y Nombre:</span>
                    <span className="info-value">{nombreMostrado}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">DNI:</span>
                    <span className="info-value">{dni}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pestania === 'contacto' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Dirección</h3>
                  <div className="info-item">
                    <span className="info-label">Domicilio:</span>
                    <span className="info-value">{domicilio || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Localidad:</span>
                    <span className="info-value">{localidad}</span>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Contacto</h3>
                  <div className="info-item">
                    <span className="info-label">Teléfono:</span>
                    <span className="info-value">{telefono}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pestania === 'academico' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Curso</h3>
                  <div className="info-item">
                    <span className="info-label">Año:</span>
                    <span className="info-value">{anio}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">División:</span>
                    <span className="info-value">{division}</span>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Categoría</h3>
                  <div className="info-item">
                    <span className="info-label">Categoría:</span>
                    <span className="info-value">{categoria}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ModalInfoAlumno;
