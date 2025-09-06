// src/components/Alumnos/ModalInfoAlumno.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './ModalInfoAlumno.css';

const ModalInfoAlumno = ({ mostrar, alumno, onClose }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!mostrar) return;
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mostrar, onClose]);

  // 'datos' | 'contacto' | 'academico' | 'observaciones'
  const [pestania, setPestania] = useState('datos');

  /* ----------------- Helpers ----------------- */
  const nombreCompleto = useMemo(() => {
    if (!alumno) return '';
    const ap = (alumno.apellido || '').trim();
    const no = (alumno.nombre || '').trim();
    const armado = `${ap} ${no}`.trim();
    return armado || ap || no || '-';
  }, [alumno]);

  const formatearFecha = useCallback((val) => {
    if (!val) return '-';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (m) {
      const [, yyyy, mm, dd] = m;
      return `${dd}/${mm}/${yyyy}`;
    }
    const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const texto = (v) =>
    v === null || v === undefined || String(v).trim() === '' ? '-' : String(v).trim();

  // No render si no corresponde
  if (!mostrar || !alumno) return null;

  /* ----------------- Extracts (todos ya resueltos por backend) ----------------- */
  // Documento
  const tipoDocNombre = alumno.tipo_documento_nombre || '';
  const tipoDocSigla  = alumno.tipo_documento_sigla ? ` (${alumno.tipo_documento_sigla})` : '';
  const tipoDoc       = texto(`${tipoDocNombre}${tipoDocSigla}`);
  const numDoc        = alumno.num_documento || alumno.dni || '-';

  // Sexo
  const sexo = texto(alumno.sexo_nombre);

  // Contacto / domicilio
  const domicilio = texto(alumno.domicilio);
  const localidad = texto(alumno.localidad);
  const cp        = texto(alumno.cp);
  const telefono  = texto(alumno.telefono);

  // Nacimiento
  const lugarNac  = texto(alumno.lugar_nacimiento);
  const fechaNac  = formatearFecha(alumno.fecha_nacimiento);

  // Académico
  const anio      = alumno.anio_nombre      || alumno.nombre_año      || alumno.nombre_anio || texto(alumno.id_año);
  const division  = alumno.division_nombre  || alumno.nombre_division || texto(alumno.id_division);
  const categoria = alumno.categoria_nombre || alumno.nombre_categoria|| texto(alumno.id_categoria);

  // Estado
  const ingreso   = formatearFecha(alumno.ingreso);

  // ✅ Observaciones (texto libre, puede venir null/empty)
  const observaciones = alumno.observaciones; // mostrar tal cual, con pre-wrap

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target.classList.contains('modal-overlay') && onClose()}
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">Información del Alumno</h2>
            <p className="modal-subtitle">
              ID: {alumno.id_alumno} | {nombreCompleto}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">
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
          <div className={`tab ${pestania === 'datos' ? 'active' : ''}`} onClick={() => setPestania('datos')}>
            Datos
          </div>
          <div className={`tab ${pestania === 'contacto' ? 'active' : ''}`} onClick={() => setPestania('contacto')}>
            Contacto
          </div>
          <div className={`tab ${pestania === 'academico' ? 'active' : ''}`} onClick={() => setPestania('academico')}>
            Académico
          </div>
          <div className={`tab ${pestania === 'observaciones' ? 'active' : ''}`} onClick={() => setPestania('observaciones')}>
            Observaciones
          </div>
        </div>

        {/* Contenido */}
        <div className="modal-content">
          {pestania === 'datos' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card info-card-full">
                  <h3 className="info-card-title">Datos Personales</h3>

                  {/* Apellido y Nombre en header */}

                  <div className="info-item">
                    <span className="info-label">Tipo de Documento:</span>
                    <span className="info-value">{tipoDoc}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Nº Documento:</span>
                    <span className="info-value">{texto(numDoc)}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Sexo:</span>
                    <span className="info-value">{sexo}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Lugar de nacimiento:</span>
                    <span className="info-value">{lugarNac}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Fecha de nacimiento:</span>
                    <span className="info-value">{fechaNac}</span>
                  </div>

                  <div className="info-sep" />

                  <div className="info-item">
                    <span className="info-label">Ingreso:</span>
                    <span className="info-value">{ingreso}</span>
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
                    <span className="info-value">{domicilio}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Localidad:</span>
                    <span className="info-value">{localidad}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">CP:</span>
                    <span className="info-value">{cp}</span>
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
                    <span className="info-value">{texto(anio)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">División:</span>
                    <span className="info-value">{texto(division)}</span>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Categoría</h3>
                  <div className="info-item">
                    <span className="info-label">Categoría:</span>
                    <span className="info-value">{texto(categoria)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pestania === 'observaciones' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card info-card-full">
                  <h3 className="info-card-title">Observaciones</h3>
                  <div className="info-item">
                    <span className="info-label">Notas:</span>
                    <span
                      className="info-value"
                      style={{ whiteSpace: 'pre-wrap' }} // ✅ respeta saltos de línea
                    >
                      {texto(observaciones)}
                    </span>
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
