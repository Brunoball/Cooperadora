// src/components/Alumnos/Alumnos.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import BASE_URL from '../../config/config';
import {
  FaInfoCircle,
  FaEdit,
  FaTrash,
  FaUserMinus,
  FaArrowLeft,
  FaUserPlus,
  FaFileExcel,
  FaUserSlash,
  FaSearch,
  FaTimes,
  FaUsers
} from 'react-icons/fa';
import './Alumno.css';

// Modales
import ModalEliminarAlumno from './modales/ModalEliminarAlumno';
import ModalInfoAlumno from './modales/ModalInfoAlumno';
import ModalDarBajaAlumno from './modales/ModalDarBajaAlumno';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Toast from '../Global/Toast';
import '../Global/roots.css';

/* ================================
   Utils
================================ */
const normalizar = (str = '') =>
  str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const combinarNombre = (a) => {
  const partes = [
    a?.apellido ?? '',
    a?.nombre ?? '',
    a?.nombre_completo ?? '',
    a?.nombreyapellido ?? '',
    a?.nyap ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return partes || (a?.nombre ?? '');
};

/* ================================
   Componentes puros
================================ */
const BotonesInferiores = React.memo(({
  cargando,
  navigate,
  alumnosFiltrados,
  alumnos,
  exportarExcel,
  filtroActivo,
  setFiltros
}) => (
  <div className="soc-barra-inferior">
    <button
      className="soc-boton soc-boton-volver"
      onClick={() => {
        setFiltros({
          busqueda: '',
          letraSeleccionada: 'TODOS',
          filtroActivo: null
        });
        localStorage.removeItem('filtros_alumnos');
        navigate('/panel');
      }}
    >
      <FaArrowLeft className="soc-boton-icono" /> Volver
    </button>

    <div className="soc-botones-derecha">
      <button
        className="soc-boton soc-boton-agregar"
        onClick={() => navigate('/alumnos/agregar')}
      >
        <FaUserPlus className="soc-boton-icono" /> Agregar Alumno
      </button>
      <button
        className="soc-boton soc-boton-exportar"
        onClick={exportarExcel}
        disabled={cargando || alumnosFiltrados.length === 0 || alumnos.length === 0 || filtroActivo === null}
      >
        <FaFileExcel className="soc-boton-icono" /> Exportar a Excel
      </button>
      <button
        className="soc-boton soc-boton-baja"
        onClick={() => navigate('/alumnos/baja')}
      >
        <FaUserSlash className="soc-boton-icono" /> Dados de Baja
      </button>
    </div>
  </div>
));

const BarraSuperior = React.memo(({
  cargando,
  busqueda,
  letraSeleccionada,
  setFiltros,
  filtrosRef,
  mostrarFiltros,
  setMostrarFiltros,
  filtroActivo,
  setAnimacionActiva
}) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const handleLetraClick = useCallback((letra) => {
    setFiltros(prev => ({
      ...prev,
      letraSeleccionada: letra,
      busqueda: '',
      filtroActivo: 'letra'
    }));
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 1000);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros(prev => ({
      ...prev,
      letraSeleccionada: 'TODOS',
      busqueda: '',
      filtroActivo: 'todos'
    }));
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 1000);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  return (
    <div className="soc-barra-superior">
      <div className="soc-titulo-container">
        <h2 className="soc-titulo">Gestión de Alumnos</h2>
      </div>

      <div className="soc-buscador-container">
        <input
          type="text"
          placeholder="Buscar por apellido, nombre o DNI"
          value={busqueda}
          onChange={(e) => {
            setFiltros(prev => ({
              ...prev,
              busqueda: e.target.value,
              letraSeleccionada: 'TODOS',
              filtroActivo: e.target.value ? 'busqueda' : null
            }));
            setAnimacionActiva(true);
            setTimeout(() => setAnimacionActiva(false), 1000);
          }}
          className="soc-buscador"
          disabled={cargando}
        />
        <div className="soc-buscador-iconos">
          {busqueda ? (
            <FaTimes
              className="soc-buscador-icono"
              onClick={() => {
                setFiltros(prev => ({ ...prev, busqueda: '', filtroActivo: null }));
                setAnimacionActiva(true);
                setTimeout(() => setAnimacionActiva(false), 1000);
              }}
            />
          ) : (
            <FaSearch className="soc-buscador-icono" />
          )}
        </div>
      </div>

      <div className="soc-filtros-container" ref={filtrosRef}>
        <button
          className="soc-boton-filtros"
          onClick={(e) => {
            e.stopPropagation();
            setMostrarFiltros(!mostrarFiltros);
          }}
          disabled={cargando}
        >
          Filtros {mostrarFiltros ? '▲' : '▼'}
        </button>

        <div className="soc-filtros-activos-container">
          {busqueda ? (
            <div className="soc-filtro-activo">
              <span className="soc-filtro-activo-busqueda">
                <FaSearch className="soc-filtro-activo-busqueda-icono" size={12} />
                {busqueda.length > 3 ? `${busqueda.substring(0, 3)}...` : busqueda}
              </span>
            </div>
          ) : (filtroActivo === 'letra' && letraSeleccionada !== 'TODOS') ? (
            <div className="soc-filtro-activo">
              <span className="soc-filtro-activo-letra">{letraSeleccionada}</span>
            </div>
          ) : null}
        </div>

        {mostrarFiltros && (
          <div
            className="soc-menu-filtros"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="soc-letras-filtro">
              {letras.map((letra) => (
                <button
                  key={letra}
                  className={`soc-letra-filtro ${letraSeleccionada === letra ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLetraClick(letra);
                  }}
                >
                  {letra}
                </button>
              ))}
            </div>
            <button
              className="soc-boton-todos"
              onClick={(e) => {
                e.stopPropagation();
                handleMostrarTodos();
              }}
            >
              Mostrar Todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

/* ================================
   Página Alumnos
================================ */
const Alumnos = () => {
  const [alumnos, setAlumnos] = useState([]);
  const [alumnosDB, setAlumnosDB] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);

  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null);

  const [mostrarModalInfo, setMostrarModalInfo] = useState(false);
  const [alumnoInfo, setAlumnoInfo] = useState(null);

  const [mostrarModalDarBaja, setMostrarModalDarBaja] = useState(false);
  const [alumnoDarBaja, setAlumnoDarBaja] = useState(null);

  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [bloquearInteraccion, setBloquearInteraccion] = useState(true);
  const [animacionActiva, setAnimacionActiva] = useState(false);

  const filtrosRef = useRef(null);
  const navigate = useNavigate();

  const [toast, setToast] = useState({
    mostrar: false,
    tipo: '',
    mensaje: ''
  });

  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('filtros_alumnos');
    return saved ? JSON.parse(saved) : {
      busqueda: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: null
    };
  });

  const { busqueda, letraSeleccionada, filtroActivo } = filtros;

  /* ================================
     Derivados y filtros
  ================================= */
  const alumnosFiltrados = useMemo(() => {
    let resultados = [...alumnos];

    if (filtroActivo === 'busqueda' && busqueda) {
      const q = normalizar(busqueda);
      resultados = resultados.filter((a) => {
        const nombreCombo = normalizar(combinarNombre(a));
        const campoNombre = normalizar(a?.nombre ?? '');
        const apellido = normalizar(a?.apellido ?? '');
        const nombreCompleto = normalizar(a?.nombre_completo ?? a?.nombreyapellido ?? a?.nyap ?? '');
        const dni = (a?.dni ?? '').toString().toLowerCase();

        return (
          nombreCombo.includes(q) ||
          campoNombre.includes(q) ||
          apellido.includes(q) ||
          nombreCompleto.includes(q) ||
          dni.includes(q)
        );
      });
    } else if (filtroActivo === 'letra' && letraSeleccionada) {
      const letra = normalizar(letraSeleccionada).charAt(0);
      resultados = resultados.filter((a) => {
        const base = normalizar(combinarNombre(a));
        return base.startsWith(letra);
      });
    } else if (filtroActivo === 'todos') {
      return resultados;
    }

    return resultados;
  }, [alumnos, busqueda, letraSeleccionada, filtroActivo]);

  /* ================================
     Efectos
  ================================= */
  useEffect(() => {
    if (alumnosFiltrados.length > 0) {
      const timer = setTimeout(() => {
        setBloquearInteraccion(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [alumnosFiltrados]);

  useEffect(() => {
    const handleClickOutsideFiltros = (event) => {
      if (filtrosRef.current && !filtrosRef.current.contains(event.target)) {
        setMostrarFiltros(false);
      }
    };

    const handleClickOutsideTable = (event) => {
      if (!event.target.closest('.soc-tabla-fila')) {
        setAlumnoSeleccionado(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideFiltros);
    document.addEventListener('click', handleClickOutsideTable);

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideFiltros);
      document.removeEventListener('click', handleClickOutsideTable);
    };
  }, []);

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setCargando(true);
        const response = await fetch(`${BASE_URL}/api.php?action=alumnos`);
        const data = await response.json();

        if (data.exito) {
          setAlumnos(data.alumnos || []);
          setAlumnosDB(data.alumnos || []);
        } else {
          mostrarToast(`Error al obtener alumnos: ${data.mensaje}`, 'error');
        }
      } catch (error) {
        mostrarToast('Error de red al obtener alumnos', 'error');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosIniciales();

    const handlePopState = () => {
      if (window.location.pathname === '/panel') {
        setFiltros({
          busqueda: '',
          letraSeleccionada: 'TODOS',
          filtroActivo: null
        });
        localStorage.removeItem('filtros_alumnos');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mostrarToast]);

  useEffect(() => {
    localStorage.setItem('filtros_alumnos', JSON.stringify(filtros));
  }, [filtros]);

  /* ================================
     Handlers
  ================================= */
  const manejarSeleccion = useCallback((alumno) => {
    if (bloquearInteraccion || animacionActiva) return;
    setAlumnoSeleccionado(prev =>
      prev?.id_alumno !== alumno.id_alumno ? alumno : null
    );
  }, [bloquearInteraccion, animacionActiva]);

  const eliminarAlumno = useCallback(async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=eliminar_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno: id }),
      });

      const data = await response.json();
      if (data.exito) {
        setAlumnos(prev => prev.filter((a) => a.id_alumno !== id));
        setAlumnosDB(prev => prev.filter((a) => a.id_alumno !== id));
        mostrarToast('Alumno eliminado correctamente');
      } else {
        mostrarToast(`Error al eliminar: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarToast('Error de red al intentar eliminar', 'error');
    } finally {
      setMostrarModalEliminar(false);
      setAlumnoAEliminar(null);
    }
  }, [mostrarToast]);

  // Dar de baja con motivo
  const darDeBajaAlumno = useCallback(async (id, motivo) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno: id, motivo }),
      });
      const data = await response.json();

      if (data.exito) {
        setAlumnos(prev => prev.filter((a) => a.id_alumno !== id));
        setAlumnosDB(prev => prev.map(a => (
          a.id_alumno === id ? { ...a, activo: 0, motivo, ingreso: data.fecha || a.ingreso } : a
        )));
        mostrarToast('Alumno dado de baja correctamente');
      } else {
        mostrarToast(`Error: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarToast('Error de red al intentar dar de baja', 'error');
    } finally {
      setMostrarModalDarBaja(false);
      setAlumnoDarBaja(null);
    }
  }, [mostrarToast]);

  const construirDomicilio = useCallback((domicilio) => {
    return (domicilio || '').trim();
  }, []);

  const exportarExcel = useCallback(() => {
    if (alumnosDB.length === 0) {
      mostrarToast('No hay alumnos registrados para exportar.', 'error');
      return;
    }
    const datos = alumnosDB.map((a) => ({ ...a }));
    const allKeys = Array.from(
      datos.reduce((acc, obj) => {
        Object.keys(obj || {}).forEach((k) => acc.add(k));
        return acc;
      }, new Set())
    );
    const datosUniformes = datos.map((obj) => {
      const fila = {};
      allKeys.forEach((k) => {
        fila[k] = obj?.[k] ?? '';
      });
      return fila;
    });

    const ws = XLSX.utils.json_to_sheet(datosUniformes, { header: allKeys });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');

    saveAs(blob, `Alumnos_Completo_${yyyy}${mm}${dd}.xlsx`);
    mostrarToast('Exportación completada.', 'exito');
  }, [alumnosDB, mostrarToast]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros({
      busqueda: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: 'todos'
    });
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 500);
  }, [setFiltros]);

  // === NUEVO: obtener alumno por ID para asegurar ingreso (y más campos) ===
  const cargarAlumnoConDetalle = useCallback(async (alumnoBase) => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=alumnos&id=${encodeURIComponent(alumnoBase.id_alumno)}&ts=${Date.now()}`);
      const data = await res.json();
      if (data?.exito && Array.isArray(data.alumnos) && data.alumnos.length > 0) {
        // merge: lo del detalle pisa lo de la lista
        const conDetalle = { ...alumnoBase, ...data.alumnos[0] };
        setAlumnoInfo(conDetalle);
      } else {
        // fallback: abrimos con lo que tenemos
        setAlumnoInfo(alumnoBase);
      }
      setMostrarModalInfo(true);
    } catch {
      // En error de red, abrir con lo que tengamos
      setAlumnoInfo(alumnoBase);
      setMostrarModalInfo(true);
    }
  }, []);

  /* ================================
     Fila virtualizada
  ================================= */
  const Row = React.memo(({ index, style, data }) => {
    const alumno = data[index];
    const esFilaPar = index % 2 === 0;
    const animationDelay = `${index * 0.05}s`;

    const nombreMostrado = combinarNombre(alumno) || alumno?.nombre || '';
    const localidad = alumno?.localidad ?? '';
    const navigateRow = useNavigate(); // Ok: Row es un componente React

    return (
      <div
        style={{
          ...style,
          background: esFilaPar ? 'rgba(255, 255, 255, 0.9)' : 'rgba(179, 180, 181, 0.47)',
          animationDelay: animacionActiva ? animationDelay : '0s',
          animationName: animacionActiva ? 'fadeIn' : 'none'
        }}
        className={`soc-tabla-fila ${alumnoSeleccionado?.id_alumno === alumno.id_alumno ? 'soc-fila-seleccionada' : ''}`}
        onClick={() => !animacionActiva && manejarSeleccion(alumno)}
      >
        <div className="soc-col-nombre" title={nombreMostrado}>{nombreMostrado}</div>
        <div className="soc-col-dni" title={alumno.dni}>{alumno.dni}</div>
        <div className="soc-col-domicilio" title={construirDomicilio(alumno.domicilio)}>
          {construirDomicilio(alumno.domicilio)}
        </div>
        <div className="soc-col-localidad" title={localidad}>
          {localidad}
        </div>
        <div className="soc-col-anio" title={alumno.anio_nombre || alumno['anio_nombre']}>
          {alumno.anio_nombre || alumno['anio_nombre']}
        </div>
        <div className="soc-col-division" title={alumno.division_nombre}>
          {alumno.division_nombre}
        </div>
        <div className="soc-col-acciones">
          {alumnoSeleccionado?.id_alumno === alumno.id_alumno && (
            <div className="soc-iconos-acciones">
              <FaInfoCircle
                title="Ver información"
                onClick={async (e) => {
                  e.stopPropagation();
                  // NUEVO: antes de abrir, traemos detalle por ID para asegurar ingreso
                  await cargarAlumnoConDetalle(alumno);
                }}
                className="soc-icono"
              />
              <FaEdit
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateRow(`/alumnos/editar/${alumno.id_alumno}`);
                }}
                className="soc-icono"
              />
              <FaTrash
                title="Eliminar"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlumnoAEliminar(alumno);
                  setMostrarModalEliminar(true);
                }}
                className="soc-icono"
              />
              <FaUserMinus
                title="Dar de baja"
                className="soc-icono"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlumnoDarBaja(alumno);
                  setMostrarModalDarBaja(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  });

  /* ================================
     Render
  ================================= */
  return (
    <div className={`soc-main-container ${animacionActiva ? 'soc-cascade-animation' : ''}`}>
      <div className="soc-container">
        {toast.mostrar && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
            duracion={3000}
          />
        )}

        <BarraSuperior
          cargando={cargando}
          busqueda={busqueda}
          letraSeleccionada={letraSeleccionada}
          setFiltros={setFiltros}
          filtrosRef={filtrosRef}
          mostrarFiltros={mostrarFiltros}
          setMostrarFiltros={setMostrarFiltros}
          filtroActivo={filtroActivo}
          setAnimacionActiva={setAnimacionActiva}
        />

        <div className="soc-tabla-container">
          <div className="soc-tabla-header-container">
            <div className="soc-contador">
              <FaUsers className="soc-contador-icono" size={14} />
              {filtroActivo === 'todos' ? 'Total de alumnos:' :
                filtroActivo === null ? 'Filtre para ver alumnos:' : 'Alumnos filtrados:'}
              <strong>
                {filtroActivo === null ? 0 : alumnosFiltrados.length}
              </strong>
            </div>
            <div className="soc-tabla-header">
              <div className="soc-col-nombre">Apellido y Nombre</div>
              <div className="soc-col-dni">DNI</div>
              <div className="soc-col-domicilio">Domicilio</div>
              <div className="soc-col-localidad">Localidad</div>
              <div className="soc-col-anio">Año</div>
              <div className="soc-col-division">División</div>
              <div className="soc-col-acciones">Acciones</div>
            </div>
          </div>

          {cargando ? (
            <div className="soc-skeleton-rows">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="soc-skeleton-row"></div>
              ))}
            </div>
          ) : alumnos.length === 0 ? (
            <div className="soc-sin-resultados">No hay alumnos registrados</div>
          ) : filtroActivo === null ? (
            <div className="soc-boton-mostrar-container">
              <div className="soc-mensaje-inicial">Por favor aplique al menos un filtro para ver los alumnos</div>
              <button
                className="soc-boton-mostrar-todos"
                onClick={handleMostrarTodos}
                disabled={cargando}
              >
                Mostrar todos los alumnos
              </button>
            </div>
          ) : alumnosFiltrados.length === 0 ? (
            <div className="soc-sin-resultados">No hay resultados con los filtros actuales</div>
          ) : (
            <div style={{ height: '55vh', width: '100%' }}>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    itemCount={alumnosFiltrados.length}
                    itemSize={45}
                    itemData={alumnosFiltrados}
                    overscanCount={10}
                    key={`list-${busqueda}-${letraSeleccionada}`}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
            </div>
          )}
        </div>

        <BotonesInferiores
          cargando={cargando}
          navigate={navigate} 
          alumnosFiltrados={alumnosFiltrados}
          alumnos={alumnos}
          exportarExcel={exportarExcel}
          filtroActivo={filtroActivo}
          setFiltros={setFiltros}
        />

        {ReactDOM.createPortal(
          <ModalEliminarAlumno
            mostrar={mostrarModalEliminar}
            alumno={alumnoAEliminar}
            onClose={() => {
              setMostrarModalEliminar(false);
              setAlumnoAEliminar(null);
            }}
            onEliminar={eliminarAlumno}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalInfoAlumno
            mostrar={mostrarModalInfo}
            alumno={alumnoInfo}
            onClose={() => {
              setMostrarModalInfo(false);
              setAlumnoInfo(null);
            }}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalDarBajaAlumno
            mostrar={mostrarModalDarBaja}
            alumno={alumnoDarBaja}
            onClose={() => {
              setMostrarModalDarBaja(false);
              setAlumnoDarBaja(null);
            }}
            onDarBaja={darDeBajaAlumno}
          />,
          document.body
        )}
      </div>
    </div>
  );
};

export default Alumnos;
