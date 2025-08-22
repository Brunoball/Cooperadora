// src/components/Alumnos/EditarAlumno.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUserEdit, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './EditarAlumno.css';
import '../Global/roots.css';

const aMayus = (v) => (typeof v === 'string' ? v.toUpperCase() : v);

// Zona horaria fija (Córdoba) para evitar desfasajes
const TZ_CBA = 'America/Argentina/Cordoba';

// Hoy en formato YYYY-MM-DD en TZ Córdoba
const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CBA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

const esFechaISO = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

const EditarAlumno = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const fechaInputRef = useRef(null);

  const [formData, setFormData] = useState({
    apellido_nombre: '',
    dni: '',
    domicilio: '',
    localidad: '',
    telefono: '',
    id_anio: '',
    id_division: '',
    id_categoria: '1',
    ingreso: '', // <<< NUEVO
  });

  const [listas, setListas] = useState({
    anios: [],
    divisiones: [],
    categorias: [],
    loaded: false
  });

  const [datosOriginales, setDatosOriginales] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const [activeField, setActiveField] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = (message, type = 'exito') => setToast({ show: true, message, type });

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  };

  // Abrir datepicker desde todo el contenedor
  const openDatePicker = (e) => {
    e.preventDefault();
    const el = fechaInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else { el.focus(); el.click(); }
    } catch {
      el.focus(); el.click();
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Listas globales
        const resListas = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
        const jsonListas = await resListas.json();
        if (jsonListas.exito) {
          setListas({ ...jsonListas.listas, loaded: true });
        } else {
          showToast('Error al cargar listas: ' + jsonListas.mensaje, 'error');
        }

        // Datos del alumno
        const resAlumno = await fetch(`${BASE_URL}/api.php?action=editar_alumno&id=${id}`);
        const dataAlumno = await resAlumno.json();
        if (dataAlumno.exito) {
          const a = dataAlumno.alumno || {};
          const mapeado = {
            apellido_nombre: a.apellido_nombre ?? '',
            dni: a.dni ?? '',
            domicilio: a.domicilio ?? '',
            localidad: a.localidad ?? '',
            telefono: a.telefono ?? '',
            id_anio: a.id_anio ?? '',         // backend devuelve alias id_anio
            id_division: a.id_division ?? '',
            id_categoria: a.id_categoria ?? '1',
            ingreso: a.ingreso ?? '',         // <<< NUEVO (YYYY-MM-DD)
          };
          setFormData(mapeado);
          setDatosOriginales(mapeado);
        } else {
          showToast('Error al cargar datos del alumno: ' + dataAlumno.mensaje, 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'ingreso') {
      // no upper-case; validación sencilla
      setFormData(prev => ({ ...prev, ingreso: value }));
      return;
    }
    const v = ['apellido_nombre', 'domicilio', 'localidad'].includes(name) ? aMayus(value) : value;
    setFormData(prev => ({ ...prev, [name]: v }));
  };

  const handleFocus = (name) => setActiveField(name);
  const handleBlur = () => setActiveField(null);

  const normalizar = (obj) => {
    const out = { ...obj };
    Object.keys(out).forEach(k => { if (out[k] === '') out[k] = null; });
    return out;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar ingreso si viene cargado
    if (formData.ingreso && !esFechaISO(formData.ingreso)) {
      showToast('La fecha de ingreso debe tener formato AAAA-MM-DD.', 'error');
      return;
    }

    const formN = normalizar(formData);
    const originalN = normalizar(datosOriginales);
    if (JSON.stringify(formN) === JSON.stringify(originalN)) {
      showToast('No se encontraron cambios para realizar', 'advertencia');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api.php?action=editar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_alumno: id }),
      });
      const data = await res.json();
      if (data.exito) {
        showToast('Alumno actualizado correctamente', 'exito');
        setTimeout(() => navigate('/alumnos'), 1800);
      } else {
        showToast('Error al actualizar: ' + data.mensaje, 'error');
      }
    } catch (error) {
      showToast('Error de red: ' + error, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-socio-container">
      <div className="edit-socio-box">
        {toast.show && (
          <Toast
            tipo={toast.type}
            mensaje={toast.message}
            onClose={() => setToast(prev => ({ ...prev, show: false }))}
            duracion={3000}
          />
        )}

        <div className="edit-header">
          <div className="edit-icon-title">
            <FontAwesomeIcon icon={faUserEdit} className="edit-icon" />
            <div>
              <h1>Editar Alumno #{id}</h1>
              <p>Actualiza la información del alumno</p>
            </div>
          </div>
          <button className="edit-back-btn" onClick={() => navigate('/alumnos')}>
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver
          </button>
        </div>

        <form onSubmit={handleSubmit} ref={formRef} className="edit-socio-form">
          <div className="edit-socio-sections">
            {/* Básicos */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Datos del Alumno</h3>
              <div className="edit-socio-section-content">
                <div className={`edit-socio-input-wrapper ${formData.apellido_nombre || activeField === 'apellido_nombre' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Apellido y Nombre</label>
                  <input
                    name="apellido_nombre"
                    value={formData.apellido_nombre || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('apellido_nombre')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className="edit-socio-group-row">
                  <div className={`edit-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">DNI</label>
                    <input
                      name="dni"
                      value={formData.dni || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('dni')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      inputMode="numeric"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.telefono || activeField === 'telefono' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">Teléfono</label>
                    <input
                      name="telefono"
                      value={formData.telefono || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('telefono')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      inputMode="tel"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>

                <div className="edit-socio-domicilio-group">
                  <div className={`edit-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`} style={{ flex: 2 }}>
                    <label className="edit-socio-label">Domicilio</label>
                    <input
                      name="domicilio"
                      value={formData.domicilio || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('domicilio')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.localidad || activeField === 'localidad' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="edit-socio-label">Localidad</label>
                    <input
                      name="localidad"
                      value={formData.localidad || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('localidad')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>

                <div className="edit-socio-group-row">
                  <div className={`edit-socio-input-wrapper ${formData.id_anio || activeField === 'id_anio' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">Año</label>
                    <select
                      name="id_anio"
                      value={formData.id_anio || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_anio')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione año</option>
                      {listas.anios.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.id_division || activeField === 'id_division' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">División</label>
                    <select
                      name="id_division"
                      value={formData.id_division || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_division')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione división</option>
                      {listas.divisiones.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">Categoría</label>
                    <select
                      name="id_categoria"
                      value={formData.id_categoria || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_categoria')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione categoría</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                      ))}
                    </select>
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>

                {/* NUEVO: Fecha de Ingreso con datepicker y zona horaria Cba */}
                <div className="edit-socio-group-row">
                  <div className={`edit-socio-input-wrapper ${formData.ingreso || activeField === 'ingreso' ? 'has-value' : ''}`} style={{ maxWidth: 260 }}>
                    <label className="edit-socio-label">Ingreso</label>
                    <div
                      className="edit-socio-date-container"
                      role="button"
                      tabIndex={0}
                      onMouseDown={openDatePicker}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDatePicker(e)}
                      aria-label="Abrir selector de fecha"
                    >
                      <input
                        ref={fechaInputRef}
                        type="date"
                        name="ingreso"
                        className="edit-socio-input"
                        value={formData.ingreso || ''}
                        onChange={handleChange}
                        onFocus={() => handleFocus('ingreso')}
                        onBlur={handleBlur}
                        max="9999-12-31"
                        placeholder={hoyISO()}
                      />
                      <FontAwesomeIcon icon={faCalendarDays} className="edit-socio-date-icon" />
                    </div>
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="edit-socio-buttons-container">
            <button type="submit" className="edit-socio-button" disabled={loading}>
              <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
              <span className="edit-socio-button-text">
                {loading ? 'Guardando...' : 'Actualizar Alumno'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarAlumno;
