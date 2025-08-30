// src/components/Alumnos/AgregarAlumno.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './AgregarAlumno.css';

const AgregarAlumno = () => {
  const navigate = useNavigate();

  const [listas, setListas] = useState({
    anios: [],
    divisiones: [],
    categorias: [],
    loaded: false
  });

  const [formData, setFormData] = useState({
    apellido_nombre: '',
    dni: '',
    domicilio: '',
    localidad: '',
    telefono: '',
    id_año: '',
    id_division: '',
    id_categoria: '1', // default 1
  });

  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);

  // Pasos UI
  const [currentStep, setCurrentStep] = useState(1);

  // 👇 Bandera para cancelar el keyup del Enter cuando se usa para avanzar de paso
  const enterBloqueadoRef = useRef(false);

  const showToast = (message, type = 'exito', duracion = 3000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), duracion);
  };

  useEffect(() => {
    const fetchListas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
        const json = await res.json();

        if (json.exito) {
          const { anios, divisiones, categorias } = json.listas || {};
          setListas({
            anios: Array.isArray(anios) ? anios : [],
            divisiones: Array.isArray(divisiones) ? divisiones : [],
            categorias: Array.isArray(categorias) ? categorias : [],
            loaded: true
          });

          if (!formData.id_categoria && (categorias || []).some(c => String(c.id) === '1')) {
            setFormData(prev => ({ ...prev, id_categoria: '1' }));
          }
        } else {
          showToast('Error al cargar listas: ' + (json.mensaje || 'desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchListas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const telValido = /^[0-9+\-\s]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'apellido_nombre':
        if (!value || !value.trim()) return 'obligatorio';
        if (!/^[A-ZÑa-zñáéíóúÁÉÍÓÚ\s.]+$/u.test(value)) return 'formato inválido';
        if (value.length > 100) return 'máximo 100 caracteres';
        break;
      case 'dni':
        if (!value || !value.trim()) return 'obligatorio';
        if (!soloNumeros.test(value)) return 'solo números';
        if (value.length > 15) return 'máximo 15 caracteres';
        break;
      case 'domicilio':
        if (value && !textoValido.test(value)) return 'caracteres inválidos';
        if (value && value.length > 150) return 'máximo 150 caracteres';
        break;
      case 'localidad':
        if (value && !textoValido.test(value)) return 'caracteres inválidos';
        if (value && value.length > 100) return 'máximo 100 caracteres';
        break;
      case 'telefono':
        if (value && !telValido.test(value)) return 'formato inválido';
        if (value && value.length > 20) return 'máximo 20 caracteres';
        break;
      case 'id_año':
      case 'id_division':
      case 'id_categoria':
        if (!value) return 'obligatorio';
        if (isNaN(Number(value))) return 'valor inválido';
        break;
      default:
        return null;
    }
    return null;
  };

  // ✅ Validación de Paso 1 (solo toast)
  const validarPaso1 = () => {
    const errorNombre = validarCampo('apellido_nombre', formData.apellido_nombre);
    const errorDni = validarCampo('dni', formData.dni);

    if (errorNombre || errorDni) {
      const faltantes = [];
      const invalidos = [];

      if (!formData.apellido_nombre?.trim()) faltantes.push('Apellido y Nombre');
      else if (errorNombre) invalidos.push('Apellido y Nombre');

      if (!formData.dni?.trim()) faltantes.push('DNI');
      else if (errorDni) invalidos.push('DNI');

      const partes = [];
      if (faltantes.length) partes.push(`Completá: ${faltantes.join(' y ')}`);
      if (invalidos.length) partes.push(`Revisá: ${invalidos.join(' y ')}`);

      showToast(partes.join(' | '), 'error');
      return false; // ❌ bloqueo avance
    }
    return true; // ✅ permite avanzar
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const toUpper = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
    const nextVal =
      ['apellido_nombre', 'domicilio', 'localidad'].includes(name) ? toUpper(value) : value;

    setFormData(prev => ({ ...prev, [name]: nextVal }));
  };

  const handleFocus = (fieldName) => setActiveField(fieldName);
  const handleBlur = () => setActiveField(null);

  // ✅ Navegación de pasos con validación del Paso 1
  const handleNextStep = () => {
    if (currentStep === 1 && !validarPaso1()) return;
    setCurrentStep(s => Math.min(3, s + 1));
  };
  const handlePrevStep = () => setCurrentStep(s => Math.max(1, s - 1));

  // Enter para avanzar pasos (y evitar submit fantasma al soltar la tecla)
  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // bloquea submit nativo
      if (currentStep < 3) {
        e.stopPropagation();
        enterBloqueadoRef.current = true; // marcamos para cancelar el keyup
        handleNextStep();
      }
      // En paso 3 mantenemos bloqueado el Enter para no enviar con Enter
    }
  };

  const handleFormKeyUp = (e) => {
    if (e.key === 'Enter' && enterBloqueadoRef.current) {
      e.preventDefault();
      e.stopPropagation();
      enterBloqueadoRef.current = false; // limpiamos la marca
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🚧 Por seguridad, ignoramos cualquier submit fuera del Paso 3
    if (currentStep !== 3) return;

    // 🧠 Etiquetas legibles
    const labels = {
      apellido_nombre: 'Apellido y Nombre',
      dni: 'DNI',
      domicilio: 'Domicilio',
      localidad: 'Localidad',
      telefono: 'Teléfono',
      id_año: 'Año',
      id_division: 'División',
      id_categoria: 'Categoría',
    };

    const obligatorios = ['apellido_nombre', 'dni', 'id_año', 'id_division', 'id_categoria'];

    const faltantes = [];
    const invalidos = [];

    // Faltantes (obligatorios)
    obligatorios.forEach((k) => {
      const val = formData[k];
      if (!val || !String(val).trim()) {
        faltantes.push(labels[k]);
      }
    });

    // Inválidos (cualquier campo con valor inválido)
    Object.entries(formData).forEach(([k, v]) => {
      const err = validarCampo(k, v);
      // Solo marcamos inválido si hay valor (o si es obligatorio y tiene formato inválido)
      if (err && (v || obligatorios.includes(k))) {
        invalidos.push(labels[k] || k);
      }
    });

    if (faltantes.length || invalidos.length) {
      const partes = [];
      if (faltantes.length) partes.push(`Completá: ${faltantes.join(', ')}`);
      if (invalidos.length) partes.push(`Revisá: ${invalidos.join(', ')}`);
      showToast(partes.join(' | '), 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api.php?action=agregar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (data.exito) {
        showToast('Alumno agregado correctamente', 'exito');
        setTimeout(() => navigate('/alumnos'), 1800);
      } else {
        // Si el backend envía errores, mostramos un toast genérico
        showToast('Revisá los datos e intentá nuevamente.', 'error');
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Barra de pasos
  const ProgressSteps = () => (
    <div className="progress-steps">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`progress-step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          onClick={() => currentStep > step && setCurrentStep(step)}
        >
          <div className="step-number">{step}</div>
          <div className="step-label">
            {step === 1 && 'Datos del Alumno'}
            {step === 2 && 'Contacto y Domicilio'}
            {step === 3 && 'Datos Académicos'}
          </div>
        </div>
      ))}
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="add-alumno-container">
      <div className="add-alumno-box">
        {toast.show && (
          <Toast
            tipo={toast.type}
            mensaje={toast.message}
            onClose={() => setToast({ show: false, message: '', type: 'exito' })}
            duracion={3000}
          />
        )}

        {/* Header */}
        <div className="add-header">
          <div className="add-icon-title">
            <FontAwesomeIcon icon={faUserPlus} className="add-icon" />
            <div>
              <h1>Agregar Nuevo Alumno</h1>
              <p>Completá los datos del alumno</p>
            </div>
          </div>

          <button
            className="add-back-btn"
            onClick={() => navigate('/alumnos')}
            disabled={loading}
            type="button"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver
          </button>
        </div>

        <ProgressSteps />

        <form
          onSubmit={handleSubmit}
          className="add-alumno-form"
          onKeyDown={handleFormKeyDown}
          onKeyUp={handleFormKeyUp}
        >
          {/* PASO 1: Datos del Alumno */}
          {currentStep === 1 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Datos del Alumno</h3>
              <div className="add-alumno-section-content">

                <div className={`add-input-wrapper ${formData.apellido_nombre || activeField === 'apellido_nombre' ? 'has-value' : ''}`}>
                  <label className="add-label">Apellido y Nombre *</label>
                  <input
                    name="apellido_nombre"
                    value={formData.apellido_nombre}
                    onChange={handleChange}
                    onFocus={() => handleFocus('apellido_nombre')}
                    onBlur={handleBlur}
                    className="add-input"
                  />
                  <span className="add-input-highlight" />
                </div>

                <div className="add-group">
                  <div className={`add-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">DNI *</label>
                    <input
                      name="dni"
                      value={formData.dni}
                      onChange={handleChange}
                      onFocus={() => handleFocus('dni')}
                      onBlur={handleBlur}
                      className="add-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PASO 2: Contacto y Domicilio */}
          {currentStep === 2 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Contacto y Domicilio</h3>
              <div className="add-alumno-section-content">

                <div className="add-group">
                  <div className={`add-input-wrapper ${formData.telefono || activeField === 'telefono' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Teléfono</label>
                    <input
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      onFocus={() => handleFocus('telefono')}
                      onBlur={handleBlur}
                      className="add-input"
                      type="tel"
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

                <div className="add-group">
                  <div className={`add-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Domicilio</label>
                    <input
                      name="domicilio"
                      value={formData.domicilio}
                      onChange={handleChange}
                      onFocus={() => handleFocus('domicilio')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>

                  <div className={`add-input-wrapper ${formData.localidad || activeField === 'localidad' ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <label className="add-label">Localidad</label>
                    <input
                      name="localidad"
                      value={formData.localidad}
                      onChange={handleChange}
                      onFocus={() => handleFocus('localidad')}
                      onBlur={handleBlur}
                      className="add-input"
                    />
                    <span className="add-input-highlight" />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PASO 3: Datos Académicos */}
          {currentStep === 3 && (
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Datos Académicos</h3>
              <div className="add-alumno-section-content">

                <div className="add-group">
                  <div className="add-input-wrapper always-active" style={{ flex: 1 }}>
                    <label className="add-label">Año *</label>
                    <select
                      name="id_año"
                      value={formData.id_año}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_año')}
                      onBlur={handleBlur}
                      className="add-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar año</option>
                      {listas.anios.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="add-input-wrapper always-active" style={{ flex: 1 }}>
                    <label className="add-label">División *</label>
                    <select
                      name="id_division"
                      value={formData.id_division}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_division')}
                      onBlur={handleBlur}
                      className="add-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar división</option>
                      {listas.divisiones.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="add-input-wrapper always-active" style={{ maxWidth: 420 }}>
                  <label className="add-label">Categoría *</label>
                  <select
                    name="id_categoria"
                    value={formData.id_categoria}
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_categoria')}
                    onBlur={handleBlur}
                    className="add-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="">Seleccionar categoría</option>
                    {listas.categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Botonera inferior */}
          <div className="add-alumno-buttons-container">
            {currentStep > 1 && (
              <button
                key="prev"
                type="button"
                className="add-alumno-button prev-step"
                onClick={handlePrevStep}
                data-mobile-label="Volver"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="add-icon-button" />
                <span className="add-button-text">Anterior</span>
              </button>
            )}

            {currentStep < 3 ? (
              <button
                key="next" // 👈 fuerza remount
                type="button"
                className="add-alumno-button next-step"
                onClick={(e) => {
                  // 👇 evita que el click termine en submit cuando el botón se "convierte"
                  e.preventDefault();
                  e.stopPropagation();
                  handleNextStep();
                }}
              >
                <span className="add-button-text">Siguiente</span>
              </button>
            ) : (
              <button
                key="submit" // 👈 distinto al "next"
                type="submit"
                className="add-alumno-button"
                disabled={loading}
                data-mobile-label="Guardar"
              >
                <FontAwesomeIcon icon={faSave} className="add-icon-button" />
                <span className="add-button-text">{loading ? 'Guardando...' : 'Guardar Alumno'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgregarAlumno;
