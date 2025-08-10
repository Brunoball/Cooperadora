import React, { useEffect, useState } from 'react';
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
    id_categoria: '1', // default 1 (requerido por la tabla)
  });

  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);

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
        if (!value || !value.trim()) return 'El apellido y nombre es obligatorio';
        if (!/^[A-ZÑa-zñáéíóúÁÉÍÓÚ\s.]+$/u.test(value)) return 'Solo letras, espacios y puntos';
        if (value.length > 100) return 'Máximo 100 caracteres';
        break;

      case 'dni':
        if (!value || !value.trim()) return 'El DNI es obligatorio';
        if (!soloNumeros.test(value)) return 'Solo números';
        if (value.length > 15) return 'Máximo 15 caracteres';
        break;

      case 'domicilio':
        if (value && !textoValido.test(value)) return 'Caracteres inválidos';
        if (value && value.length > 150) return 'Máximo 150 caracteres';
        break;

      case 'localidad':
        if (value && !textoValido.test(value)) return 'Caracteres inválidos';
        if (value && value.length > 100) return 'Máximo 100 caracteres';
        break;

      case 'telefono':
        if (value && !telValido.test(value)) return 'Solo números, espacios y guiones';
        if (value && value.length > 20) return 'Máximo 20 caracteres';
        break;

      case 'id_año':
      case 'id_division':
      case 'id_categoria':
        if (!value) return 'Campo obligatorio';
        if (isNaN(Number(value))) return 'Valor inválido';
        break;

      default:
        return null;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Campos de texto a MAYÚSCULAS (excepto dni/telefono que quedan tal cual)
    const toUpper = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
    const nextVal =
      ['apellido_nombre', 'domicilio', 'localidad'].includes(name) ? toUpper(value) : value;

    setFormData(prev => ({ ...prev, [name]: nextVal }));

    // Limpiar error puntual si el usuario corrige
    const error = validarCampo(name, nextVal);
    setErrores(prev => ({ ...prev, [name]: error || undefined }));
  };

  const handleFocus = (fieldName) => setActiveField(fieldName);
  const handleBlur = () => setActiveField(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMostrarErrores(true);

    const nuevosErrores = {};
    Object.entries(formData).forEach(([key, val]) => {
      const err = validarCampo(key, val);
      if (err) nuevosErrores[key] = err;
    });

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
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
        if (data.errores) {
          setErrores(data.errores);
          showToast('Revisá los campos marcados.', 'error');
        } else {
          showToast('Error: ' + (data.mensaje || 'No se pudo guardar'), 'error');
        }
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="add-alumno-form">
          <div className="add-alumno-sections">
            {/* Información básica */}
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Información Básica</h3>
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
                  {mostrarErrores && errores.apellido_nombre && (
                    <span className="add-error">{errores.apellido_nombre}</span>
                  )}
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
                    {mostrarErrores && errores.dni && (
                      <span className="add-error">{errores.dni}</span>
                    )}
                  </div>

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
                    {mostrarErrores && errores.telefono && (
                      <span className="add-error">{errores.telefono}</span>
                    )}
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
                    {mostrarErrores && errores.domicilio && (
                      <span className="add-error">{errores.domicilio}</span>
                    )}
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
                    {mostrarErrores && errores.localidad && (
                      <span className="add-error">{errores.localidad}</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Académico */}
            <div className="add-alumno-section">
              <h3 className="add-alumno-section-title">Datos Académicos</h3>
              <div className="add-alumno-section-content">
                <div className="add-group">
                  <div className="add-input-wrapper has-value" style={{ flex: 1 }}>
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
                    {mostrarErrores && errores.id_año && (
                      <span className="add-error">{errores.id_año}</span>
                    )}
                  </div>

                  <div className="add-input-wrapper has-value" style={{ flex: 1 }}>
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
                    {mostrarErrores && errores.id_division && (
                      <span className="add-error">{errores.id_division}</span>
                    )}
                  </div>
                </div>

                <div className="add-input-wrapper has-value" style={{ maxWidth: 420 }}>
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
                  {mostrarErrores && errores.id_categoria && (
                    <span className="add-error">{errores.id_categoria}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="add-alumno-buttons-container">
            <button type="submit" className="add-alumno-button" disabled={loading}>
              <FontAwesomeIcon icon={faSave} className="add-icon-button" />
              <span className="add-button-text">{loading ? 'Guardando...' : 'Guardar Alumno'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgregarAlumno;
