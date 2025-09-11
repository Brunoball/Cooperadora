import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUser, faGraduationCap, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './EditarAlumno.css';

const aMayus = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
const TZ_CBA = 'America/Argentina/Cordoba';

const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CBA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

const esFechaISO = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

const EditarAlumno = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('informacion');

  // ===== Campos (nueva tabla) =====
  const [apellido, setApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [id_tipo_documento, setIdTipoDocumento] = useState('');
  const [num_documento, setNumDocumento] = useState('');
  const [id_sexo, setIdSexo] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [id_anio, setIdAnio] = useState('');
  const [id_division, setIdDivision] = useState('');
  const [id_categoria, setIdCategoria] = useState('');
  const [ingreso, setIngreso] = useState('');

  // ✅ NUEVO: Observaciones (texto libre)
  const [observaciones, setObservaciones] = useState('');

  // Listas
  const [anios, setAnios] = useState([]);
  const [divisiones, setDivisiones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [sexos, setSexos] = useState([]);
  const [tiposDocumento, setTiposDocumento] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [idAlumno, setIdAlumno] = useState(null);

  const fechaInputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const showToast = (message, type = 'exito') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const abrirCalendario = () => {
    const el = fechaInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
    try { el.click(); } catch {}
  };

  const obtenerAlumno = async (signal) => {
    try {
      setCargando(true);

      // Listas globales (incluye sexos y tipos de doc.)
      const resListas = await fetch(`${BASE_URL}/api.php?action=obtener_listas`, { signal });
      const jsonListas = await resListas.json();

      if (jsonListas.exito) {
        const L = jsonListas.listas || {};
        setAnios(L.anios || []);
        setDivisiones(L.divisiones || []);
        setCategorias(L.categorias || []);
        setSexos(L.sexos || []);
        setTiposDocumento(L.tipos_documentos || []);
      } else {
        showToast('Error al cargar listas: ' + (jsonListas.mensaje || ''), 'error');
      }

      // Datos del alumno
      const response = await fetch(`${BASE_URL}/api.php?action=editar_alumno&id=${encodeURIComponent(id)}`, { signal });
      const data = await response.json();

      if (data.exito) {
        const a = data.alumno || {};
        setIdAlumno(a.id_alumno || id);
        setApellido(a.apellido || '');
        setNombre(a.nombre || '');
        setIdTipoDocumento(a.id_tipo_documento ?? '');
        setNumDocumento(a.num_documento || '');
        setIdSexo(a.id_sexo ?? '');
        setDomicilio(a.domicilio || '');
        setLocalidad(a.localidad || '');
        setTelefono(a.telefono || '');
        setIdAnio(a.id_anio || '');          // viene como alias id_anio
        setIdDivision(a.id_division || '');
        setIdCategoria(a.id_categoria || '');
        setIngreso(a.ingreso || '');
        // ✅ Observaciones desde backend
        setObservaciones(a.observaciones || '');
      } else {
        showToast('Error al cargar datos del alumno: ' + (data.mensaje || ''), 'error');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        showToast('Hubo un error al obtener los datos: ' + error.message, 'error');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    if (id) obtenerAlumno(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleOnlyDigits = (e, setter) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setter(value);
  };

  const guardarAlumno = async () => {
    // Validaciones mínimas
    if (!apellido?.trim()) {
      showToast('El apellido es obligatorio.', 'error');
      return;
    }
    if (!num_documento?.trim()) {
      showToast('El documento es obligatorio.', 'error');
      return;
    }
    if (!id_anio || !id_division || !id_categoria) {
      showToast('Año, División y Categoría son obligatorios.', 'error');
      return;
    }
    if (!ingreso || !esFechaISO(ingreso)) {
      showToast('La fecha de ingreso es obligatoria y debe ser AAAA-MM-DD.', 'error');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api.php?action=editar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno: id,
          apellido: aMayus(apellido),
          nombre: aMayus(nombre) || null,
          id_tipo_documento: id_tipo_documento || null,
          num_documento: num_documento,
          id_sexo: id_sexo || null,
          domicilio: aMayus(domicilio) || null,
          localidad: aMayus(localidad) || null,
          telefono: telefono || null,
          id_anio: id_anio || null,          // mapea a `id_año`
          id_division: id_division || null,
          id_categoria: id_categoria || null,
          ingreso: ingreso,                   // requerido (NOT NULL)
          // ✅ incluir observaciones (texto libre, sin mayúsculas forzadas)
          observaciones: (observaciones !== '' ? observaciones : null)
        }),
      });

      const data = await response.json();

      if (data.exito) {
        showToast('Alumno actualizado correctamente', 'exito');
        setTimeout(() => navigate('/alumnos'), 800);
      } else {
        showToast(data.mensaje || 'Error al actualizar.', 'error');
      }
    } catch (error) {
      showToast('Error en la solicitud: ' + error.message, 'error');
    }
  };

  // --- SKELETON VIEW ---
  const Header = (
    <div className="edit-socio-header">
      {cargando ? (
        <div className="edit-socio-header-skel">
          <div className="skel skel-title" />
          <div className="skel skel-subtitle" />
        </div>
      ) : (
        <>
          <h2 className="edit-socio-title">Editar Alumno #{idAlumno}</h2>
          <div className="edit-socio-subtitle">
            {[apellido, nombre].filter(Boolean).join(' ')}
          </div>
        </>
      )}
    </div>
  );

  const Tabs = (
    <div className="edit-socio-tabs" role="tablist" aria-label="Secciones de edición">
      {['informacion','escolaridad','otros'].map(tab => (
        <button
          key={tab}
          className={`edit-socio-tab ${activeTab === tab ? 'active' : ''} ${cargando ? 'is-disabled' : ''}`}
          onClick={() => !cargando && setActiveTab(tab)}
          role="tab"
          aria-selected={activeTab === tab}
          aria-label={tab}
          title={tab.charAt(0).toUpperCase() + tab.slice(1)}
          disabled={cargando}
        >
          <FontAwesomeIcon
            icon={
              tab==='informacion' ? faUser :
              tab==='escolaridad' ? faGraduationCap : faInfoCircle
            }
            className="edit-socio-tab-icon"
          />
          <span className="tab-text">
            {tab==='informacion' ? 'Información' :
             tab==='escolaridad' ? 'Escolaridad' : 'Otros'}
          </span>
        </button>
      ))}
    </div>
  );

  // Contenido de carga
  const ContentLoading = (
    <div className="edit-socio-form">
      <div className="edit-socio-tab-content">
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
        <div className="edit-socio-input-group">
          <div className="skel skel-input" />
          <div className="skel skel-input" />
        </div>
      </div>

      <div className="edit-socio-buttons-container">
        <div className="skel skel-btn" />
        <div className="skel skel-btn" />
      </div>
    </div>
  );

  return (
    <div className="edit-socio-container">
      {toast.show && (
        <Toast
          tipo={toast.type}
          mensaje={toast.message}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
          duracion={3000}
        />
      )}

      <div className="edit-socio-box edit-socio-animate-in" role="region" aria-label="Editar alumno">
        {Header}
        {Tabs}

        {cargando ? (
          ContentLoading
        ) : (
          <form className="edit-socio-form" onSubmit={(e) => e.preventDefault()}>
            {activeTab === 'informacion' && (
              <div className="edit-socio-tab-content">

                {/* Apellido / Nombre */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={apellido}
                      onChange={(e) => setApellido(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="apellido"
                      required
                    />
                    <label htmlFor="apellido" className={`edit-socio-floating-label ${apellido ? 'edit-socio-floating-label-filled' : ''}`}>
                      Apellido *
                    </label>
                  </div>

                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="nombre"
                    />
                    <label htmlFor="nombre" className={`edit-socio-floating-label ${nombre ? 'edit-socio-floating-label-filled' : ''}`}>
                      Nombre
                    </label>
                  </div>
                </div>

                {/* ✅ Documento + Tipo de documento + Sexo en una fila */}
                <div className="edit-socio-input-group cols-3">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={num_documento}
                      onChange={(e) => handleOnlyDigits(e, setNumDocumento)}
                      placeholder=" "
                      className="edit-socio-input"
                      id="num_documento"
                      inputMode="numeric"
                      required
                    />
                    <label htmlFor="num_documento" className={`edit-socio-floating-label ${num_documento ? 'edit-socio-floating-label-filled' : ''}`}>
                      Documento *
                    </label>
                  </div>

                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_tipo_documento" className="edit-fl-label">Tipo de documento</label>
                    <select
                      id="id_tipo_documento"
                      value={id_tipo_documento || ''}
                      onChange={(e) => setIdTipoDocumento(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="">Seleccionar</option>
                      {tiposDocumento.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.descripcion}{t.sigla ? ` (${t.sigla})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_sexo" className="edit-fl-label">Sexo</label>
                    <select
                      id="id_sexo"
                      value={id_sexo || ''}
                      onChange={(e) => setIdSexo(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="">Seleccionar</option>
                      {sexos.map((s) => (
                        <option key={s.id} value={s.id}>{s.sexo}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Teléfono / Fecha de ingreso */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => handleOnlyDigits(e, setTelefono)}
                      placeholder=" "
                      className="edit-socio-input"
                      id="telefono"
                      inputMode="tel"
                    />
                    <label htmlFor="telefono" className={`edit-socio-floating-label ${telefono ? 'edit-socio-floating-label-filled' : ''}`}>
                      Teléfono
                    </label>
                  </div>

                  <div
                    className="edit-socio-floating-label-wrapper date-clickable"
                    onClick={abrirCalendario}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && abrirCalendario()}
                    aria-label="Fecha de ingreso (abrir calendario)"
                    title="Fecha de ingreso"
                  >
                    <input
                      ref={fechaInputRef}
                      type="date"
                      value={ingreso || ''}
                      onChange={(e) => setIngreso(e.target.value)}
                      className="edit-socio-input date-no-effect"
                      id="ingreso"
                      max="9999-12-31"
                      placeholder={hoyISO()}
                      required
                    />
                    <label htmlFor="ingreso" className="edit-socio-floating-label date-label-fixed">
                      Fecha de ingreso *
                    </label>
                  </div>
                </div>

                {/* Domicilio / Localidad */}
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={domicilio}
                      onChange={(e) => setDomicilio(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="domicilio"
                    />
                    <label htmlFor="domicilio" className={`edit-socio-floating-label ${domicilio ? 'edit-socio-floating-label-filled' : ''}`}>
                      Domicilio
                    </label>
                  </div>

                  <div className="edit-socio-floating-label-wrapper">
                    <input
                      type="text"
                      value={localidad}
                      onChange={(e) => setLocalidad(aMayus(e.target.value))}
                      placeholder=" "
                      className="edit-socio-input"
                      id="localidad"
                    />
                    <label htmlFor="localidad" className={`edit-socio-floating-label ${localidad ? 'edit-socio-floating-label-filled' : ''}`}>
                      Localidad
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'escolaridad' && (
              <div className="edit-socio-tab-content">
                <div className="edit-socio-input-group">
                  {/* Año */}
                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_anio" className="edit-fl-label">Año *</label>
                    <select
                      id="id_anio"
                      value={id_anio || ''}
                      onChange={(e) => setIdAnio(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="" disabled>Seleccione un año</option>
                      {anios.map((anio) => (
                        <option key={anio.id} value={anio.id}>
                          {anio.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* División */}
                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_division" className="edit-fl-label">División *</label>
                    <select
                      id="id_division"
                      value={id_division || ''}
                      onChange={(e) => setIdDivision(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="" disabled>Seleccione una división</option>
                      {divisiones.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="edit-socio-input-group">
                  {/* Categoría */}
                  <div className="edit-fl-wrapper always-active">
                    <label htmlFor="id_categoria" className="edit-fl-label">Categoría *</label>
                    <select
                      id="id_categoria"
                      value={id_categoria || ''}
                      onChange={(e) => setIdCategoria(e.target.value)}
                      className="edit-socio-input edit-select"
                    >
                      <option value="" disabled>Seleccione una categoría</option>
                      {categorias.map((categoria) => (
                        <option key={categoria.id} value={String(categoria.id)}>
                          {categoria.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'otros' && (
              <div className="edit-socio-tab-content">
                <div className="edit-socio-input-group">
                  <div className="edit-socio-floating-label-wrapper">
                    <textarea
                      placeholder=" "
                      className="edit-socio-input edit-socio-textarea"
                      id="observaciones"
                      rows="4"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)} // ✅ editable
                    />
                    <label htmlFor="observaciones" className={`edit-socio-floating-label ${observaciones ? 'edit-socio-floating-label-filled' : ''}`}>
                      Observaciones
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="edit-socio-buttons-container">
              <button
                type="button"
                onClick={guardarAlumno}
                className="edit-socio-button"
                aria-label="Guardar"
                title="Guardar"
              >
                <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
                <span className="btn-text">Guardar</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/alumnos')}
                className="edit-socio-back-button"
                aria-label="Volver"
                title="Volver"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="edit-socio-icon-button" />
                <span className="btn-text">Volver</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditarAlumno;
