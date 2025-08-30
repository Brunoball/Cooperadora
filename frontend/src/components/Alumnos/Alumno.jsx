// src/components/Alumnos/Alumnos.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback, useDeferredValue } from 'react';
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
  FaUsers,
  FaFilter,
  FaChevronDown
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

// Extrae el número de año desde "anio_nombre" (ej: "1° A", "3ro", "6", "2do B")
const extraerAnioNum = (valor) => {
  if (valor == null) return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const s = String(valor);
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
};

const MAX_CASCADE_ITEMS = 15; // ✅ solo primeros 15

// Hook simple para detectar mobile
function useIsMobile(breakpoint = 768) {
  const getMatch = () =>
    (typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false);
  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [breakpoint]);

  return isMobile;
}

/* ================================
   Componente Alumnos
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
  const prevBusquedaRef = useRef(''); // ✅ para detectar transición vacío -> no vacío
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  const [toast, setToast] = useState({
    mostrar: false,
    tipo: '',
    mensaje: ''
  });

  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('filtros_alumnos');
    return saved
      ? JSON.parse(saved)
      : {
          busqueda: '',
          letraSeleccionada: '',
          anioSeleccionado: null,
          filtroActivo: null, // 'filtros' | 'todos' | null
        };
  });

  const { busqueda, letraSeleccionada, filtroActivo, anioSeleccionado } = filtros;

  const busquedaDefer = useDeferredValue(busqueda);

  const hayFiltros = !!(
    (busquedaDefer && busquedaDefer.trim() !== '') ||
    (letraSeleccionada && letraSeleccionada !== '') ||
    (anioSeleccionado !== null)
  );

  const alumnosFiltrados = useMemo(() => {
    let resultados = alumnos;

    if (busquedaDefer && busquedaDefer.trim() !== '') {
      const q = normalizar(busquedaDefer);
      resultados = resultados.filter(
        (a) =>
          a._n.includes(q) ||
          a._nSolo.includes(q) ||
          a._ap.includes(q) ||
          a._nyap.includes(q) ||
          a._dni.includes(q)
      );
    }

    if (letraSeleccionada && letraSeleccionada !== '') {
      const letra = normalizar(letraSeleccionada).charAt(0);
      resultados = resultados.filter((a) => a._n.startsWith(letra));
    }

    if (anioSeleccionado !== null) {
      resultados = resultados.filter((a) => a._anioNum === anioSeleccionado);
    }

    if (filtroActivo === 'todos') {
      resultados = alumnos;
    }

    return resultados;
  }, [alumnos, busquedaDefer, letraSeleccionada, anioSeleccionado, filtroActivo]);

  const puedeExportar = useMemo(() => {
    return (hayFiltros || filtroActivo === 'todos') && alumnosFiltrados.length > 0 && !cargando;
  }, [hayFiltros, filtroActivo, alumnosFiltrados.length, cargando]);

  /* ================================
     Animación en cascada (helper)
  ================================= */
  const dispararCascadaUnaVez = useCallback((duracionMs = 400) => {
    // Evita re-disparar si ya está activa
    if (animacionActiva) return;
    setAnimacionActiva(true);
    // apaga sola
    window.setTimeout(() => setAnimacionActiva(false), duracionMs);
  }, [animacionActiva]);

  /* ================================
     Efectos
  ================================= */
  useEffect(() => {
    if (alumnosFiltrados.length > 0) {
      const timer = setTimeout(() => setBloquearInteraccion(false), 300);
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
      if (!event.target.closest('.alu-row')) {
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
          const procesados = (data.alumnos || []).map((a) => {
            const _anioNum = extraerAnioNum(a?.anio_nombre);
            return {
              ...a,
              _n: normalizar(combinarNombre(a)),
              _nSolo: normalizar(a?.nombre ?? ''),
              _ap: normalizar(a?.apellido ?? ''),
              _nyap: normalizar(a?.nombre_completo ?? a?.nombreyapellido ?? a?.nyap ?? ''),
              _dni: String(a?.dni ?? '').toLowerCase(),
              _anioNum,
            };
          });

          setAlumnos(procesados);
          setAlumnosDB(procesados);
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
          letraSeleccionada: '',
          anioSeleccionado: null,
          filtroActivo: null,
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

  useEffect(() => {
    if (alumnosFiltrados.length > 200 && animacionActiva) setAnimacionActiva(false);
  }, [alumnosFiltrados.length, animacionActiva]);

  // ✅ Dispara cascada SOLO cuando el buscador pasa de '' a no vacío
  useEffect(() => {
    const prev = prevBusquedaRef.current || '';
    const ahora = (busquedaDefer || '').trim();
    if (prev === '' && ahora !== '') {
      dispararCascadaUnaVez();
    }
    // actualiza ref
    prevBusquedaRef.current = ahora;
  }, [busquedaDefer, dispararCascadaUnaVez]);

  /* ================================
     Handlers
  ================================= */
  const manejarSeleccion = useCallback(
    (alumno) => {
      if (bloquearInteraccion || animacionActiva) return;
      setAlumnoSeleccionado((prev) => (prev?.id_alumno !== alumno.id_alumno ? alumno : null));
    },
    [bloquearInteraccion, animacionActiva]
  );

  const eliminarAlumno = useCallback(
    async (id) => {
      try {
        const response = await fetch(`${BASE_URL}/api.php?action=eliminar_alumno`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_alumno: id }),
        });

        const data = await response.json();
        if (data.exito) {
          setAlumnos((prev) => prev.filter((a) => a.id_alumno !== id));
          setAlumnosDB((prev) => prev.filter((a) => a.id_alumno !== id));
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
    },
    [mostrarToast]
  );

  const darDeBajaAlumno = useCallback(
    async (id, motivo) => {
      try {
        const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_alumno`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_alumno: id, motivo }),
        });
        const data = await response.json();

        if (data.exito) {
          setAlumnos((prev) => prev.filter((a) => a.id_alumno !== id));
          setAlumnosDB((prev) =>
            prev.map((a) => (a.id_alumno === id ? { ...a, activo: 0, motivo, ingreso: data.fecha || a.ingreso } : a))
          );
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
    },
    [mostrarToast]
  );

  const construirDomicilio = useCallback((domicilio) => (domicilio || '').trim(), []);

  // Exporta SOLO lo visible en tabla/tarjetas
  const exportarExcel = useCallback(() => {
    if (!puedeExportar) {
      mostrarToast('No hay filas visibles para exportar.', 'error');
      return;
    }

    const filas = alumnosFiltrados.map((a) => ({
      'Apellido y Nombre': combinarNombre(a),
      'DNI': a?.dni ?? '',
      'Domicilio': construirDomicilio(a?.domicilio),
      'Localidad': a?.localidad ?? '',
      'Año': a?.anio_nombre ?? '',
      'División': a?.division_nombre ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(filas, {
      header: ['Apellido y Nombre', 'DNI', 'Domicilio', 'Localidad', 'Año', 'División'],
    });

    ws['!cols'] = [
      { wch: 32 },
      { wch: 12 },
      { wch: 30 },
      { wch: 18 },
      { wch: 8 },
      { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');

    const sufijo = filtroActivo === 'todos' ? 'Todos' : 'Filtrados';
    saveAs(blob, `Alumnos_${sufijo}_${yyyy}${mm}${dd}(${filas.length}).xlsx`);
    mostrarToast('Exportación completada.', 'exito');
  }, [puedeExportar, alumnosFiltrados, filtroActivo, mostrarToast, construirDomicilio]);

  // Mostrar todos (🔔 ahora dispara cascada también)
  const handleMostrarTodos = useCallback(() => {
    setFiltros({
      busqueda: '',
      letraSeleccionada: '',
      anioSeleccionado: null,
      filtroActivo: 'todos',
    });
    // ✅ Disparar cascada al mostrar todos
    dispararCascadaUnaVez();
  }, [dispararCascadaUnaVez]);

  // Handlers filtros
  const handleBuscarChange = useCallback((valor) => {
    setFiltros((prev) => {
      const next = { ...prev, busqueda: valor };
      next.filtroActivo = (valor?.trim() || prev.letraSeleccionada || prev.anioSeleccionado !== null) ? 'filtros' : null;
      return next;
    });
    // ❗No disparamos acá para evitar que se repita cada tecla.
    // Se maneja en el useEffect de transición '' -> texto.
  }, []);

  const handleFiltrarPorLetra = useCallback((letra) => {
    setFiltros((prev) => {
      const next = { ...prev, letraSeleccionada: letra };
      next.filtroActivo = (prev.busqueda?.trim() || letra || prev.anioSeleccionado !== null) ? 'filtros' : null;
      return next;
    });
    setMostrarFiltros(false);
    dispararCascadaUnaVez(); // ✅ cascada una vez
  }, [dispararCascadaUnaVez]);

  const handleFiltrarPorAnio = useCallback((anio) => {
    setFiltros((prev) => {
      const next = { ...prev, anioSeleccionado: anio };
      next.filtroActivo = (prev.busqueda?.trim() || prev.letraSeleccionada || anio !== null) ? 'filtros' : null;
      return next;
    });
    setMostrarFiltros(false);
    dispararCascadaUnaVez(); // ✅ cascada una vez
  }, [dispararCascadaUnaVez]);

  // Quitar chips individuales
  const quitarBusqueda = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, busqueda: '' };
      next.filtroActivo = (prev.letraSeleccionada || prev.anioSeleccionado !== null) ? 'filtros' : null;
      return next;
    });
  }, []);

  const quitarLetra = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, letraSeleccionada: '' };
      next.filtroActivo = (prev.busqueda?.trim() || prev.anioSeleccionado !== null) ? 'filtros' : null;
      return next;
    });
  }, []);

  const quitarAnio = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, anioSeleccionado: null };
      next.filtroActivo = (prev.busqueda?.trim() || prev.letraSeleccionada) ? 'filtros' : null;
      return next;
    });
  }, []);

  // Limpieza total de chips activos (opcional)
  const limpiarTodosLosChips = useCallback(() => {
    setFiltros((prev) => ({
      ...prev,
      busqueda: '',
      letraSeleccionada: '',
      anioSeleccionado: null,
      filtroActivo: null,
    }));
  }, []);

  const cargarAlumnoConDetalle = useCallback(async (alumnoBase) => {
    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=alumnos&id=${encodeURIComponent(alumnoBase.id_alumno)}&ts=${Date.now()}`
      );
      const data = await res.json();
      if (data?.exito && Array.isArray(data.alumnos) && data.alumnos.length > 0) {
        const conDetalle = { ...alumnoBase, ...data.alumnos[0] };
        setAlumnoInfo(conDetalle);
      } else {
        setAlumnoInfo(alumnoBase);
      }
      setMostrarModalInfo(true);
    } catch {
      setAlumnoInfo(alumnoBase);
      setMostrarModalInfo(true);
    }
  }, []);

  /* ================================
     Fila virtualizada (desktop)
  ================================= */
  const Row = React.memo(({ index, style, data }) => {
    const alumno = data[index];
    const esFilaPar = index % 2 === 0;
    const navigateRow = useNavigate();
    const willAnimate = animacionActiva && index < MAX_CASCADE_ITEMS; // ✅ solo 15

    return (
      <div
        style={{ ...style, animationDelay: willAnimate ? `${index * 0.03}s` : '0s' }}
        className={`alu-row ${esFilaPar ? 'alu-even-row' : 'alu-odd-row'} ${alumnoSeleccionado?.id_alumno === alumno.id_alumno ? 'alu-selected-row' : ''} ${willAnimate ? 'alu-cascade' : ''}`}
        onClick={() => manejarSeleccion(alumno)}
      >
        <div className="alu-column alu-column-nombre" title={combinarNombre(alumno)}>
          {combinarNombre(alumno)}
        </div>
        <div className="alu-column alu-column-dni" title={alumno.dni}>
          {alumno.dni}
        </div>
        <div className="alu-column alu-column-domicilio" title={construirDomicilio(alumno.domicilio)}>
          {construirDomicilio(alumno.domicilio)}
        </div>
        <div className="alu-column alu-column-localidad" title={alumno.localidad}>
          {alumno.localidad}
        </div>
        <div className="alu-column alu-column-anio" title={alumno.anio_nombre}>
          {alumno.anio_nombre}
        </div>
        <div className="alu-column alu-column-division" title={alumno.division_nombre}>
          {alumno.division_nombre}
        </div>
        <div className="alu-column alu-icons-column">
          {alumnoSeleccionado?.id_alumno === alumno.id_alumno && (
            <div className="alu-icons-container">
              <FaInfoCircle
                className="alu-icon"
                title="Ver información"
                onClick={async (e) => {
                  e.stopPropagation();
                  await cargarAlumnoConDetalle(alumno);
                }}
              />
              <FaEdit
                className="alu-icon"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateRow(`/alumnos/editar/${alumno.id_alumno}`);
                }}
              />
              <FaTrash
                className="alu-icon"
                title="Eliminar"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlumnoAEliminar(alumno);
                  setMostrarModalEliminar(true);
                }}
              />
              <FaUserMinus
                className="alu-icon"
                title="Dar de baja"
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
  const hayChips = !!(busqueda || letraSeleccionada || anioSeleccionado !== null);

  return (
    <div className="alu-alumno-container">
      <div className="alu-alumno-box">
        {toast.mostrar && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
            duracion={3000}
          />
        )}

        {/* Header superior */}
        <div className="alu-front-row-alu">
          <span className="alu-alumno-title">Gestión de Alumnos</span>

          {/* Búsqueda */}
          <div className="alu-search-input-container">
            <input
              type="text"
              placeholder="Buscar por apellido, nombre o DNI"
              className="alu-search-input"
              value={busqueda}
              onChange={(e) => handleBuscarChange(e.target.value)}
              disabled={cargando}
            />
            {busqueda ? (
              <FaTimes className="alu-clear-search-icon" onClick={quitarBusqueda} />
            ) : null}
            <button className="alu-search-button" title="Buscar">
              <FaSearch className="alu-search-icon" />
            </button>
          </div>

          {/* Filtros */}
          <div className="alu-filtros-container" ref={filtrosRef}>
            <button
              className="alu-filtros-button"
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              disabled={cargando}
            >
              <FaFilter className="alu-icon-button" />
              <span>Aplicar Filtros</span>
              <FaChevronDown className={`alu-chevron-icon ${mostrarFiltros ? 'alu-rotate' : ''}`} />
            </button>

            {mostrarFiltros && (
              <div className="alu-filtros-menu">
                {/* Submenú LETRA */}
                <div className="alu-filtros-submenu">
                  <div className="alu-alfabeto-filtros">
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letra) => (
                      <button
                        key={letra}
                        className={`alu-letra-filtro ${filtros.letraSeleccionada === letra ? 'alu-active' : ''}`}
                        onClick={() => handleFiltrarPorLetra(letra)}
                        title={`Filtrar por ${letra}`}
                      >
                        {letra}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submenú AÑO 1–7 */}
                <div className="alu-filtros-submenu">
                  <div className="alu-anio-filtros">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={`anio-${n}`}
                        className={`alu-anio-filtro ${filtros.anioSeleccionado === n ? 'alu-active' : ''}`}
                        onClick={() => handleFiltrarPorAnio(n)}
                        title={`Filtrar por Año ${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="alu-filtros-menu-item alu-mostrar-todas"
                  onClick={() => {
                    handleMostrarTodos();
                    setMostrarFiltros(false);
                  }}
                >
                  <span>Mostrar Todos</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONTADOR + CHIPS + LISTADO */}
        <div className="alu-alumnos-list">
          <div className="alu-contenedor-list-items">
            {/* Contador */}
            <div className="alu-left-inline">
              <div className="alu-contador-container">
                <span className="alu-alumnos-desktop">
                  Cant alumnos: {(hayFiltros || filtroActivo === 'todos') ? alumnosFiltrados.length : 0}
                </span>
                <span className="alu-alumnos-mobile">
                  {(hayFiltros || filtroActivo === 'todos') ? alumnosFiltrados.length : 0}
                </span>
                <FaUsers className="alu-icono-alumno" />
              </div>

              {/* Chips agrupados */}
              {hayChips && (
                <div className="alu-chips-container">
                  {busqueda && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Búsqueda: {busqueda}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">
                        {busqueda.length > 3 ? `${busqueda.substring(0, 3)}...` : busqueda}
                      </span>
                      <button
                        className="alu-chip-mini-close"
                        onClick={quitarBusqueda}
                        aria-label="Quitar filtro"
                        title="Quitar este filtro"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {letraSeleccionada && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Letra: {letraSeleccionada}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">{letraSeleccionada}</span>
                      <button
                        className="alu-chip-mini-close"
                        onClick={quitarLetra}
                        aria-label="Quitar filtro"
                        title="Quitar este filtro"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {anioSeleccionado != null && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Año: {anioSeleccionado}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">{anioSeleccionado}</span>
                      <button
                        className="alu-chip-mini-close"
                        onClick={quitarAnio}
                        aria-label="Quitar filtro"
                        title="Quitar este filtro"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <button
                    className="alu-chip-mini alu-chip-clear-all"
                    onClick={limpiarTodosLosChips}
                    title="Quitar todos los filtros"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>
          </div>

        {/* TABLA (solo desktop) */}
          {!isMobile && (
            <div className="alu-box-table">
              <div className="alu-header">
                <div className="alu-column-header alu-header-nombre">Apellido y Nombre</div>
                <div className="alu-column-header alu-header-dni">DNI</div>
                <div className="alu-column-header alu-header-domicilio">Domicilio</div>
                <div className="alu-column-header alu-header-localidad">Localidad</div>
                <div className="alu-column-header alu-header-anio">Año</div>
                <div className="alu-column-header alu-header-division">División</div>
                <div className="alu-column-header alu-icons-column">Acciones</div>
              </div>

              <div className="alu-body">
                {cargando ? (
                  <div className="alu-loading-spinner-container">
                    <div className="alu-loading-spinner"></div>
                  </div>
                ) : alumnos.length === 0 ? (
                  <div className="alu-no-data-message">
                    <div className="alu-message-content">
                      <p>No hay alumnos registrados</p>
                    </div>
                  </div>
                ) : !hayFiltros && filtroActivo !== 'todos' ? (
                  <div className="alu-no-data-message">
                    <div className="alu-message-content">
                      <p>Por favor aplicá búsqueda o filtros para ver los alumnos</p>
                      <button className="alu-btn-show-all" onClick={handleMostrarTodos}>
                        Mostrar todos los alumnos
                      </button>
                    </div>
                  </div>
                ) : alumnosFiltrados.length === 0 ? (
                  <div className="alu-no-data-message">
                    <div className="alu-message-content">
                      <p>No hay resultados con los filtros actuales</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '55vh', width: '100%' }}>
                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          height={height}
                          width={width}
                          itemCount={alumnosFiltrados.length}
                          itemSize={48}
                          itemData={alumnosFiltrados}
                          overscanCount={10}
                          itemKey={(index, data) => data[index]?.id_alumno ?? index}
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TARJETAS (solo mobile) */}
          {isMobile && (
            <div
              className={`alu-cards-wrapper ${
                animacionActiva && alumnosFiltrados.length <= MAX_CASCADE_ITEMS ? 'alu-cascade-animation' : ''
              }`}
            >
              {cargando ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>Cargando datos iniciales...</p>
                  </div>
                </div>
              ) : alumnos.length === 0 ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>No hay alumnos registrados</p>
                  </div>
                </div>
              ) : !hayFiltros && filtroActivo !== 'todos' ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>Usá la búsqueda o aplica filtros para ver resultados</p>
                    <button className="alu-btn-show-all" onClick={handleMostrarTodos}>
                      Mostrar todos
                    </button>
                  </div>
                </div>
              ) : alumnosFiltrados.length === 0 ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>No hay resultados con los filtros actuales</p>
                  </div>
                </div>
              ) : (
                alumnosFiltrados.map((alumno, index) => {
                  const willAnimate = animacionActiva && index < MAX_CASCADE_ITEMS;
                  return (
                    <div
                      key={alumno.id_alumno || `card-${index}`}
                      className={`alu-card ${willAnimate ? 'alu-cascade' : ''}`}
                      style={{ animationDelay: willAnimate ? `${index * 0.03}s` : '0s' }}
                      onClick={() => manejarSeleccion(alumno)}
                    >
                      <div className="alu-card-header">
                        <h3 className="alu-card-title">{combinarNombre(alumno)}</h3>
                      </div>

                      <div className="alu-card-body">
                        <div className="alu-card-row">
                          <span className="alu-card-label">DNI</span>
                          <span className="alu-card-value alu-mono">{alumno.dni}</span>
                        </div>
                        <div className="alu-card-row">
                          <span className="alu-card-label">Domicilio</span>
                          <span className="alu-card-value">{construirDomicilio(alumno.domicilio)}</span>
                        </div>
                        <div className="alu-card-row">
                          <span className="alu-card-label">Localidad</span>
                          <span className="alu-card-value">{alumno.localidad}</span>
                        </div>
                        <div className="alu-card-row">
                          <span className="alu-card-label">Año</span>
                          <span className="alu-card-value">{alumno.anio_nombre}</span>
                        </div>
                        <div className="alu-card-row">
                          <span className="alu-card-label">División</span>
                          <span className="alu-card-value">{alumno.division_nombre}</span>
                        </div>
                      </div>

                      <div className="alu-card-actions">
                        <button
                          className="alu-action-btn"
                          title="Información"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await cargarAlumnoConDetalle(alumno);
                          }}
                        >
                          <FaInfoCircle />
                        </button>
                        <button
                          className="alu-action-btn"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/alumnos/editar/${alumno.id_alumno}`);
                          }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="alu-action-btn"
                          title="Eliminar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlumnoAEliminar(alumno);
                            setMostrarModalEliminar(true);
                          }}
                        >
                          <FaTrash />
                        </button>
                        <button
                          className="alu-action-btn alu-action-danger"
                          title="Dar de baja"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlumnoDarBaja(alumno);
                          setMostrarModalDarBaja(true);
                          }}
                        >
                          <FaUserMinus />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* BOTONERA INFERIOR */}
        <div className="alu-down-container">
          <button
            className="alu-alumno-button alu-hover-effect alu-volver-atras"
            onClick={() => {
              setFiltros({
                busqueda: '',
                letraSeleccionada: '',
                anioSeleccionado: null,
                filtroActivo: null,
              });
              localStorage.removeItem('filtros_alumnos');
              navigate('/panel');
            }}
            aria-label="Volver"
            title="Volver"
          >
            <FaArrowLeft className="alu-alumno-icon-button" />
            <p>Volver Atrás</p>
          </button>

          <div className="alu-botones-container">
            <button
              className="alu-alumno-button alu-hover-effect"
              onClick={() => navigate('/alumnos/agregar')}
              aria-label="Agregar"
              title="Agregar alumno"
            >
              <FaUserPlus className="alu-alumno-icon-button" />
              <p>Agregar Alumno</p>
            </button>

            {/* Exportar Excel: bloqueado si no hay filas visibles */}
            <button
              className="alu-alumno-button alu-hover-effect"
              onClick={exportarExcel}
              disabled={!puedeExportar}
              aria-label="Exportar"
              title={puedeExportar ? 'Exportar a Excel' : 'No hay filas visibles para exportar'}
            >
              <FaFileExcel className="alu-alumno-icon-button" />
              <p>Exportar a Excel</p>
            </button>

            <button
              className="alu-alumno-button alu-hover-effect alu-btn-baja-nav"
              onClick={() => navigate('/alumnos/baja')}
              title="Dados de Baja"
              aria-label="Dados de Baja"
            >
              <FaUserSlash className="alu-alumno-icon-button" />
              <p>Dados de Baja</p>
            </button>
          </div>
        </div>
      </div>

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
  );
};

export default Alumnos;
