// ✅ REEMPLAZAR COMPLETO
// src/components/Alumnos/Alumnos.jsx

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useDeferredValue,
} from 'react';
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
  FaChevronDown,
  FaMoneyBillWave,
  FaCheckCircle,
} from 'react-icons/fa';
import './Alumno.css';

// Modales
import ModalEliminarAlumno from './modales/ModalEliminarAlumno';
import ModalInfoAlumno from './modales/ModalInfoAlumno';
import ModalDarBajaAlumno from './modales/ModalDarBajaAlumno';
import ModalCobradorAlumno from './modales/ModalCobradorAlumno';

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

const extraerAnioNum = (valor) => {
  if (valor == null) return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const s = String(valor);
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
};

const MAX_CASCADE_ITEMS = 15;

const formatearFechaISO = (v) => {
  if (!v || typeof v !== 'string') return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

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

  // ✅ NUEVO: modal cobrador
  const [mostrarModalCobrador, setMostrarModalCobrador] = useState(false);
  const [alumnoCobrador, setAlumnoCobrador] = useState(null);
  const [nuevoValorCobrador, setNuevoValorCobrador] = useState(0);

  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [bloquearInteraccion, setBloquearInteraccion] = useState(true);

  // flags de animación
  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [preCascada, setPreCascada] = useState(false);

  const filtrosRef = useRef(null);
  const prevBusquedaRef = useRef('');
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  const [toast, setToast] = useState({
    mostrar: false,
    tipo: '',
    mensaje: ''
  });

  // categorías disponibles
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);

  // ✅ NUEVO: filtro cobrador
  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('filtros_alumnos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          busqueda: parsed.busqueda ?? '',
          divisionSeleccionada: parsed.divisionSeleccionada ?? '',
          anioSeleccionado: parsed.anioSeleccionado ?? null,
          categoriaSeleccionada: parsed.categoriaSeleccionada ?? '',
          cobradorSeleccionado: parsed.cobradorSeleccionado ?? '', // '' | '1'
          filtroActivo: parsed.filtroActivo ?? null,
        };
      } catch {}
    }
    return {
      busqueda: '',
      divisionSeleccionada: '',
      anioSeleccionado: null,
      categoriaSeleccionada: '',
      cobradorSeleccionado: '',
      filtroActivo: null,
    };
  });

  // Acordeones
  const [openSecciones, setOpenSecciones] = useState({
    division: false,
    anio: false,
    categoria: false,
    cobrador: false, // ✅ nuevo acordeón
  });

  const {
    busqueda,
    divisionSeleccionada,
    filtroActivo,
    anioSeleccionado,
    categoriaSeleccionada,
    cobradorSeleccionado
  } = filtros;

  const busquedaDefer = useDeferredValue(busqueda);

  const hayFiltros = !!(
    (busquedaDefer && busquedaDefer.trim() !== '') ||
    (divisionSeleccionada && divisionSeleccionada !== '') ||
    (anioSeleccionado !== null) ||
    (categoriaSeleccionada && categoriaSeleccionada !== '') ||
    (cobradorSeleccionado && cobradorSeleccionado !== '')
  );

  // Rol
  const [isVista, setIsVista] = useState(false);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('usuario'));
      const role = (u?.rol || '').toString().toLowerCase();
      setIsVista(role === 'vista');
    } catch {
      setIsVista(false);
    }
  }, []);

  const divisionesDisponibles = useMemo(() => {
    const set = new Set(
      (alumnosDB || [])
        .map(a => a?.division_nombre)
        .filter(Boolean)
        .map(d => d.toString().trim())
    );
    return Array.from(set).sort((a, b) => {
      return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
    });
  }, [alumnosDB]);

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

    if (divisionSeleccionada && divisionSeleccionada !== '') {
      const divNorm = normalizar(divisionSeleccionada);
      resultados = resultados.filter((a) => normalizar(a?.division_nombre ?? '') === divNorm);
    }

    if (anioSeleccionado !== null) {
      resultados = resultados.filter((a) => a._anioNum === anioSeleccionado);
    }

    if (categoriaSeleccionada && categoriaSeleccionada !== '') {
      const catNorm = normalizar(categoriaSeleccionada);
      resultados = resultados.filter((a) => normalizar(a?.categoria_nombre ?? '') === catNorm);
    }

    // ✅ NUEVO: solo cobrador
    if (cobradorSeleccionado === '1') {
      resultados = resultados.filter((a) => String(a?.es_cobrador ?? 0) === '1');
    }

    if (filtroActivo === 'todos') {
      resultados = alumnos;
    }

    return resultados;
  }, [
    alumnos,
    busquedaDefer,
    divisionSeleccionada,
    anioSeleccionado,
    categoriaSeleccionada,
    cobradorSeleccionado,
    filtroActivo
  ]);

  const puedeExportar = useMemo(() => {
    return (hayFiltros || filtroActivo === 'todos') && alumnosFiltrados.length > 0 && !cargando;
  }, [hayFiltros, filtroActivo, alumnosFiltrados.length, cargando]);

  const mostrarLoader = useMemo(
    () => cargando && (hayFiltros || filtroActivo === 'todos'),
    [cargando, hayFiltros, filtroActivo]
  );

  const dispararCascadaUnaVez = useCallback((duracionMs) => {
    const safeMs = 400 + (MAX_CASCADE_ITEMS - 1) * 30 + 300;
    const total = typeof duracionMs === 'number' ? duracionMs : safeMs;
    if (animacionActiva) return;
    setAnimacionActiva(true);
    window.setTimeout(() => setAnimacionActiva(false), total);
  }, [animacionActiva]);

  const triggerCascadaConPreMask = useCallback(() => {
    setPreCascada(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispararCascadaUnaVez();
        setPreCascada(false);
      });
    });
  }, [dispararCascadaUnaVez]);

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
              es_cobrador: Number(a?.es_cobrador ?? 0),
              _n: normalizar(combinarNombre(a)),
              _nSolo: normalizar(a?.nombre ?? ''),
              _ap: normalizar(a?.apellido ?? ''),
              _nyap: normalizar(a?.nombre_completo ?? a?.nombreyapellido ?? a?.nyap ?? ''),
              _dni: String(a?.dni ?? a?.num_documento ?? '').toLowerCase(),
              _anioNum,
            };
          });

          setAlumnos(procesados);
          setAlumnosDB(procesados);
        } else {
          mostrarToast(`Error al obtener alumnos: ${data.mensaje}`, 'error');
        }

        // Listas (categorías)
        try {
          const resListas = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
          const dataListas = await resListas.json();
          if (dataListas?.exito && dataListas?.listas?.categorias) {
            const cats = (dataListas.listas.categorias || [])
              .map(c => (c?.nombre ?? '').toString().trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
            setCategoriasDisponibles(cats);
          } else {
            const setCats = new Set(
              (data?.alumnos || [])
                .map(a => (a?.categoria_nombre ?? '').toString().trim())
                .filter(Boolean)
            );
            setCategoriasDisponibles(Array.from(setCats).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
          }
        } catch {
          const setCats = new Set(
            (data?.alumnos || [])
              .map(a => (a?.categoria_nombre ?? '').toString().trim())
              .filter(Boolean)
          );
          setCategoriasDisponibles(Array.from(setCats).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
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
          divisionSeleccionada: '',
          anioSeleccionado: null,
          categoriaSeleccionada: '',
          cobradorSeleccionado: '',
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
    const prev = prevBusquedaRef.current || '';
    const ahora = (busquedaDefer || '').trim();
    if (prev === '' && ahora !== '') {
      triggerCascadaConPreMask();
    }
    prevBusquedaRef.current = ahora;
  }, [busquedaDefer, triggerCascadaConPreMask]);

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

  const exportarExcel = useCallback(() => {
    if (!puedeExportar) {
      mostrarToast('No hay filas visibles para exportar.', 'error');
      return;
    }

    const filas = alumnosFiltrados.map((a) => ({
      'ID Alumno': a?.id_alumno ?? '',
      'Apellido': a?.apellido ?? '',
      'Nombre': a?.nombre ?? '',
      'Tipo de documento': a?.tipo_documento_nombre ?? '',
      'Sigla': a?.tipo_documento_sigla ?? '',
      'Nº Documento': a?.num_documento ?? a?.dni ?? '',
      'Sexo': a?.sexo_nombre ?? '',
      'Teléfono': a?.telefono ?? '',
      'Fecha de ingreso': formatearFechaISO(a?.ingreso ?? ''),
      'Domicilio': construirDomicilio(a?.domicilio),
      'Localidad': a?.localidad ?? '',
      'Año': a?.anio_nombre ?? '',
      'División': a?.division_nombre ?? '',
      'Categoría': a?.categoria_nombre ?? '',
      'Cobrador': Number(a?.es_cobrador ?? 0) === 1 ? 'SI' : 'NO',
    }));

    const headers = [
      'ID Alumno','Apellido','Nombre','Tipo de documento','Sigla','Nº Documento',
      'Sexo','Teléfono','Fecha de ingreso','Domicilio','Localidad','Año','División','Categoría','Cobrador'
    ];

    const ws = XLSX.utils.json_to_sheet(filas, { header: headers });

    ws['!cols'] = [
      { wch: 10 },{ wch: 18 },{ wch: 18 },{ wch: 22 },{ wch: 8  },{ wch: 14 },
      { wch: 10 },{ wch: 14 },{ wch: 14 },{ wch: 28 },{ wch: 20 },{ wch: 10 },{ wch: 10 },{ wch: 16 },{ wch: 10 },
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
    const fechaStr = `${yyyy}-${mm}-${dd}`;
    saveAs(blob, `Alumnos_${sufijo}_${fechaStr}(${filas.length}).xlsx`);
  }, [puedeExportar, alumnosFiltrados, filtroActivo, mostrarToast, construirDomicilio]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros({
      busqueda: '',
      divisionSeleccionada: '',
      anioSeleccionado: null,
      categoriaSeleccionada: '',
      cobradorSeleccionado: '',
      filtroActivo: 'todos',
    });
    triggerCascadaConPreMask();
  }, [triggerCascadaConPreMask]);

  const handleBuscarChange = useCallback((valor) => {
    setFiltros((prev) => {
      const next = { ...prev, busqueda: valor };
      next.filtroActivo =
        (valor?.trim() || prev.divisionSeleccionada || prev.anioSeleccionado !== null || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const handleFiltrarPorDivision = useCallback((division) => {
    setFiltros((prev) => {
      const next = { ...prev, divisionSeleccionada: division };
      next.filtroActivo =
        (prev.busqueda?.trim() || division || prev.anioSeleccionado !== null || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
    setMostrarFiltros(false);
    triggerCascadaConPreMask();
  }, [triggerCascadaConPreMask]);

  const handleFiltrarPorAnio = useCallback((anio) => {
    setFiltros((prev) => {
      const next = { ...prev, anioSeleccionado: anio };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || anio !== null || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
    setMostrarFiltros(false);
    triggerCascadaConPreMask();
  }, [triggerCascadaConPreMask]);

  const handleFiltrarPorCategoria = useCallback((categoria) => {
    setFiltros((prev) => {
      const next = { ...prev, categoriaSeleccionada: categoria };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || prev.anioSeleccionado !== null || categoria || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
    setMostrarFiltros(false);
    triggerCascadaConPreMask();
  }, [triggerCascadaConPreMask]);

  // ✅ NUEVO: filtro cobrador
  const handleFiltrarCobrador = useCallback((valor) => {
    setFiltros((prev) => {
      const next = { ...prev, cobradorSeleccionado: valor ? '1' : '' };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || prev.anioSeleccionado !== null || prev.categoriaSeleccionada || next.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
    setMostrarFiltros(false);
    triggerCascadaConPreMask();
  }, [triggerCascadaConPreMask]);

  const quitarBusqueda = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, busqueda: '' };
      next.filtroActivo =
        (prev.divisionSeleccionada || prev.anioSeleccionado !== null || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const quitarDivision = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, divisionSeleccionada: '' };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.anioSeleccionado !== null || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const quitarAnio = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, anioSeleccionado: null };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || prev.categoriaSeleccionada || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const quitarCategoria = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, categoriaSeleccionada: '' };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || prev.anioSeleccionado !== null || prev.cobradorSeleccionado)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const quitarCobrador = useCallback(() => {
    setFiltros((prev) => {
      const next = { ...prev, cobradorSeleccionado: '' };
      next.filtroActivo =
        (prev.busqueda?.trim() || prev.divisionSeleccionada || prev.anioSeleccionado !== null || prev.categoriaSeleccionada)
          ? 'filtros'
          : null;
      return next;
    });
  }, []);

  const limpiarTodosLosChips = useCallback(() => {
    setFiltros((prev) => ({
      ...prev,
      busqueda: '',
      divisionSeleccionada: '',
      anioSeleccionado: null,
      categoriaSeleccionada: '',
      cobradorSeleccionado: '',
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

  // ✅ NUEVO: abrir modal cobrador
  const abrirModalCobrador = useCallback((alumno) => {
    const actual = Number(alumno?.es_cobrador ?? 0) === 1 ? 1 : 0;
    const nuevo = actual === 1 ? 0 : 1;
    setAlumnoCobrador(alumno);
    setNuevoValorCobrador(nuevo);
    setMostrarModalCobrador(true);
  }, []);

  // ✅ NUEVO: confirmar cambio en backend + update local
  const confirmarToggleCobrador = useCallback(async () => {
    const a = alumnoCobrador;
    if (!a?.id_alumno) {
      setMostrarModalCobrador(false);
      setAlumnoCobrador(null);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=toggle_cobrador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno: a.id_alumno, valor: nuevoValorCobrador }),
      });
      const data = await res.json();

      if (!data?.exito) {
        mostrarToast(data?.mensaje || 'No se pudo actualizar cobrador', 'error');
        return;
      }

      const nuevo = Number(data.es_cobrador ?? nuevoValorCobrador);

      setAlumnos((prev) => prev.map(x => x.id_alumno === a.id_alumno ? { ...x, es_cobrador: nuevo } : x));
      setAlumnosDB((prev) => prev.map(x => x.id_alumno === a.id_alumno ? { ...x, es_cobrador: nuevo } : x));

      mostrarToast(nuevo === 1 ? 'Marcado como COBRADOR' : 'Quitado de COBRADOR', 'exito');
    } catch (e) {
      mostrarToast('Error de red al actualizar cobrador', 'error');
    } finally {
      setMostrarModalCobrador(false);
      setAlumnoCobrador(null);
    }
  }, [alumnoCobrador, nuevoValorCobrador, mostrarToast]);

  const Row = React.memo(({ index, style, data }) => {
    const alumno = data[index];
    const esFilaPar = index % 2 === 0;
    const navigateRow = useNavigate();
    const willAnimate = animacionActiva && index < MAX_CASCADE_ITEMS;
    const preMask = preCascada && index < MAX_CASCADE_ITEMS;

    const esCobrador = Number(alumno?.es_cobrador ?? 0) === 1;

    return (
      <div
        style={{
          ...style,
          animationDelay: willAnimate ? `${index * 0.03}s` : '0s',
          opacity: preMask ? 0 : undefined,
          transform: preMask ? 'translateY(8px)' : undefined,
        }}
        className={`alu-row ${esFilaPar ? 'alu-even-row' : 'alu-odd-row'} ${alumnoSeleccionado?.id_alumno === alumno.id_alumno ? 'alu-selected-row' : ''} ${willAnimate ? 'alu-cascade' : ''}`}
        onClick={() => manejarSeleccion(alumno)}
      >
<div className="alu-column alu-column-nombre" title={combinarNombre(alumno)}>
  {combinarNombre(alumno)}
</div>

        <div className="alu-column alu-column-dni" title={alumno.num_documento ?? alumno.dni}>
          {alumno.num_documento ?? alumno.dni}
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
              {/* INFO */}
              <button
                className="alu-iconchip is-info"
                title="Ver información"
                onClick={async (e) => {
                  e.stopPropagation();
                  await cargarAlumnoConDetalle(alumno);
                }}
                aria-label="Ver información"
              >
                <FaInfoCircle />
              </button>

              {/* ✅ NUEVO: COBRADOR (admin) */}
              {!isVista && (
                <button
                  className={`alu-iconchip is-cobrador ${esCobrador ? 'is-success' : 'is-warning'}`}
                  title={esCobrador ? 'Quitar de COBRADOR' : 'Marcar como COBRADOR'}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirModalCobrador(alumno);
                  }}
                  aria-label="Cobrador"
                >
                  <FaMoneyBillWave />
                </button>
              )}

              {/* Admin: editar / eliminar / baja */}
              {!isVista && (
                <>
                  <button
                    className="alu-iconchip is-edit"
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateRow(`/alumnos/editar/${alumno.id_alumno}`);
                    }}
                    aria-label="Editar"
                  >
                    <FaEdit />
                  </button>

                  <button
                    className="alu-iconchip is-delete"
                    title="Eliminar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlumnoAEliminar(alumno);
                      setMostrarModalEliminar(true);
                    }}
                    aria-label="Eliminar"
                  >
                    <FaTrash />
                  </button>

                  <button
                    className="alu-iconchip is-baja"
                    title="Dar de baja"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlumnoDarBaja(alumno);
                      setMostrarModalDarBaja(true);
                    }}
                    aria-label="Dar de baja"
                  >
                    <FaUserMinus />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  });

  const hayChips = !!(busqueda || divisionSeleccionada || anioSeleccionado !== null || categoriaSeleccionada || cobradorSeleccionado);

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

        <div className="alu-front-row-alu">
          <span className="alu-alumno-title">Gestión de Alumnos</span>

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

          <div className="alu-filtros-container" ref={filtrosRef}>
            <button
              className="alu-filtros-button"
              onClick={() => {
                setMostrarFiltros((prev) => {
                  const next = !prev;
                  return next;
                });
              }}
              disabled={cargando}
            >
              <FaFilter className="alu-icon-button" />
              <span>Aplicar Filtros</span>
              <FaChevronDown className={`alu-chevron-icon ${mostrarFiltros ? 'alu-rotate' : ''}`} />
            </button>

            {mostrarFiltros && (
              <div className="alu-filtros-menu" role="menu">

                {/* AÑO */}
                <div className="alu-filtros-group">
                  <button
                    type="button"
                    className={`alu-filtros-group-header ${openSecciones.anio ? 'is-open' : ''}`}
                    onClick={() => setOpenSecciones((s) => ({ ...s, anio: !s.anio }))}
                    aria-expanded={openSecciones.anio}
                  >
                    <span className="alu-filtros-group-title">Filtrar por año</span>
                    <FaChevronDown className="alu-accordion-caret" />
                  </button>

                  <div className={`alu-filtros-group-body ${openSecciones.anio ? 'is-open' : 'is-collapsed'}`}>
                    <div className="alu-anio-filtros">
                      {[1,2,3,4,5,6,7].map((n) => (
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
                </div>

                {/* DIVISIÓN */}
                <div className="alu-filtros-group">
                  <button
                    type="button"
                    className={`alu-filtros-group-header ${openSecciones.division ? 'is-open' : ''}`}
                    onClick={() => setOpenSecciones((s) => ({ ...s, division: !s.division }))}
                    aria-expanded={openSecciones.division}
                  >
                    <span className="alu-filtros-group-title">Filtrar por división</span>
                    <FaChevronDown className="alu-accordion-caret" />
                  </button>

                  <div className={`alu-filtros-group-body ${openSecciones.division ? 'is-open' : 'is-collapsed'}`}>
                    <div className="alu-alfabeto-filtros">
                      {divisionesDisponibles.length === 0 ? (
                        <span className="alu-filtro-empty">No hay divisiones disponibles</span>
                      ) : (
                        divisionesDisponibles.map((div) => (
                          <button
                            key={`div-${div}`}
                            className={`alu-letra-filtro ${filtros.divisionSeleccionada === div ? 'alu-active' : ''}`}
                            onClick={() => handleFiltrarPorDivision(div)}
                            title={`Filtrar por división ${div}`}
                          >
                            {div}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* CATEGORÍA */}
                <div className="alu-filtros-group">
                  <button
                    type="button"
                    className={`alu-filtros-group-header ${openSecciones.categoria ? 'is-open' : ''}`}
                    onClick={() => setOpenSecciones((s) => ({ ...s, categoria: !s.categoria }))}
                    aria-expanded={openSecciones.categoria}
                  >
                    <span className="alu-filtros-group-title">Filtrar por categoría</span>
                    <FaChevronDown className="alu-accordion-caret" />
                  </button>

                  <div className={`alu-filtros-group-body ${openSecciones.categoria ? 'is-open' : 'is-collapsed'}`}>
                    <div className="alu-alfabeto-filtros">
                      {categoriasDisponibles.length === 0 ? (
                        <span className="alu-filtro-empty">No hay categorías disponibles</span>
                      ) : (
                        categoriasDisponibles.map((cat) => (
                          <button
                            key={`cat-${cat}`}
                            className={`alu-letra-filtro ${filtros.categoriaSeleccionada === cat ? 'alu-active' : ''}`}
                            onClick={() => handleFiltrarPorCategoria(cat)}
                            title={`Filtrar por categoría ${cat}`}
                          >
                            {cat}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* ✅ NUEVO: COBRADOR */}
                <div className="alu-filtros-group">
                  <button
                    type="button"
                    className={`alu-filtros-group-header ${openSecciones.cobrador ? 'is-open' : ''}`}
                    onClick={() => setOpenSecciones((s) => ({ ...s, cobrador: !s.cobrador }))}
                    aria-expanded={openSecciones.cobrador}
                  >
                    <span className="alu-filtros-group-title">Filtrar por cobrador</span>
                    <FaChevronDown className="alu-accordion-caret" />
                  </button>

                  <div className={`alu-filtros-group-body ${openSecciones.cobrador ? 'is-open' : 'is-collapsed'}`}>
                    <div className="alu-alfabeto-filtros">
                      <button
                        className={`Cobrador-btn alu-letra-filtro ${filtros.cobradorSeleccionado === '1' ? 'alu-active' : ''}`}
                        onClick={() => handleFiltrarCobrador(true)}
                        title="Solo alumnos marcados como cobrador"
                      >
                        SOLO COBRADOR
                      </button>

                      <button
                        className={`TodosCobra-btn alu-letra-filtro ${filtros.cobradorSeleccionado === '' ? 'alu-active' : ''}`}
                        onClick={() => handleFiltrarCobrador(false)}
                        title="Quitar filtro cobrador"
                      >
                        TODOS
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mostrar Todos */}
                <div
                  className="alu-filtros-menu-item alu-mostrar-todas"
                  onClick={() => {
                    handleMostrarTodos();
                    setMostrarFiltros(false);
                  }}
                  role="menuitem"
                >
                  <span>Mostrar Todos</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="alu-alumnos-list">
          <div className="alu-contenedor-list-items">
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

              {hayChips && (
                <div className="alu-chips-container">
                  {busqueda && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Búsqueda: {busqueda}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">
                        {busqueda.length > 3 ? `${busqueda.substring(0, 3)}...` : busqueda}
                      </span>
                      <button className="alu-chip-mini-close" onClick={quitarBusqueda} aria-label="Quitar filtro">×</button>
                    </div>
                  )}

                  {divisionSeleccionada && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">División: {divisionSeleccionada}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">{divisionSeleccionada}</span>
                      <button className="alu-chip-mini-close" onClick={quitarDivision} aria-label="Quitar filtro">×</button>
                    </div>
                  )}

                  {anioSeleccionado != null && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Año: {anioSeleccionado}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">{anioSeleccionado}</span>
                      <button className="alu-chip-mini-close" onClick={quitarAnio} aria-label="Quitar filtro">×</button>
                    </div>
                  )}

                  {categoriaSeleccionada && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Categoría: {categoriaSeleccionada}</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">{categoriaSeleccionada}</span>
                      <button className="alu-chip-mini-close" onClick={quitarCategoria} aria-label="Quitar filtro">×</button>
                    </div>
                  )}

                  {cobradorSeleccionado === '1' && (
                    <div className="alu-chip-mini" title="Filtro activo">
                      <span className="alu-chip-mini-text alu-alumnos-desktop">Cobrador: SI</span>
                      <span className="alu-chip-mini-text alu-alumnos-mobile">COBRADOR</span>
                      <button className="alu-chip-mini-close" onClick={quitarCobrador} aria-label="Quitar filtro">×</button>
                    </div>
                  )}

                  <button className="alu-chip-mini alu-chip-clear-all" onClick={limpiarTodosLosChips} title="Quitar todos los filtros">
                    Limpiar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TABLA (desktop) */}
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
                {!hayFiltros && filtroActivo !== 'todos' ? (
                  <div className="alu-no-data-message">
                    <div className="alu-message-content">
                      <p>Por favor aplicá búsqueda o filtros para ver los alumnos</p>
                      <button className="alu-btn-show-all" onClick={handleMostrarTodos}>
                        Mostrar todos los alumnos
                      </button>
                    </div>
                  </div>
                ) : mostrarLoader ? (
                  <div className="alu-loading-spinner-container">
                    <div className="alu-loading-spinner"></div>
                  </div>
                ) : alumnos.length === 0 ? (
                  <div className="alu-no-data-message">
                    <div className="alu-message-content">
                      <p>No hay alumnos registrados</p>
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

          {/* MOBILE */}
          {isMobile && (
            <div className={`alu-cards-wrapper ${animacionActiva && alumnosFiltrados.length <= MAX_CASCADE_ITEMS ? 'alu-cascade-animation' : ''}`}>
              {!hayFiltros && filtroActivo !== 'todos' ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>Usá la búsqueda o aplicá filtros para ver resultados</p>
                    <button className="alu-btn-show-all" onClick={handleMostrarTodos}>
                      Mostrar todos
                    </button>
                  </div>
                </div>
              ) : mostrarLoader ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>Cargando alumnos...</p>
                  </div>
                </div>
              ) : alumnos.length === 0 ? (
                <div className="alu-no-data-message alu-no-data-mobile">
                  <div className="alu-message-content">
                    <p>No hay alumnos registrados</p>
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
                  const preMask = preCascada && index < MAX_CASCADE_ITEMS;
                  const esCobrador = Number(alumno?.es_cobrador ?? 0) === 1;

                  return (
                    <div
                      key={alumno.id_alumno || `card-${index}`}
                      className={`alu-card ${willAnimate ? 'alu-cascade' : ''}`}
                      style={{
                        animationDelay: willAnimate ? `${index * 0.03}s` : '0s',
                        opacity: preMask ? 0 : undefined,
                        transform: preMask ? 'translateY(8px)' : undefined,
                      }}
                      onClick={() => manejarSeleccion(alumno)}
                    >
                      <div className="alu-card-header">
                        <h3 className="alu-card-title">
                          {combinarNombre(alumno)}
                          {esCobrador ? <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.85 }}>COBRADOR</span> : null}
                        </h3>
                      </div>

                      <div className="alu-card-body">
                        <div className="alu-card-row">
                          <span className="alu-card-label">DNI</span>
                          <span className="alu-card-value alu-mono">{alumno.num_documento ?? alumno.dni}</span>
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
                          className="alu-action-btn alu-iconchip is-info"
                          title="Información"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await cargarAlumnoConDetalle(alumno);
                          }}
                          aria-label="Información"
                        >
                          <FaInfoCircle />
                        </button>

                        {!isVista && (
                          <>
                            <button
                              className={`alu-action-btn alu-iconchip ${esCobrador ? 'is-success' : 'is-warning'}`}
                              title={esCobrador ? 'Quitar de COBRADOR' : 'Marcar como COBRADOR'}
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalCobrador(alumno);
                              }}
                              aria-label="Cobrador"
                            >
                              <FaMoneyBillWave />
                            </button>

                            <button
                              className="alu-action-btn alu-iconchip is-edit"
                              title="Editar"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/alumnos/editar/${alumno.id_alumno}`);
                              }}
                              aria-label="Editar"
                            >
                              <FaEdit />
                            </button>
                            <button
                              className="alu-action-btn alu-iconchip is-delete"
                              title="Eliminar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlumnoAEliminar(alumno);
                                setMostrarModalEliminar(true);
                              }}
                              aria-label="Eliminar"
                            >
                              <FaTrash />
                            </button>
                            <button
                              className="alu-action-btn alu-iconchip is-baja"
                              title="Dar de baja"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlumnoDarBaja(alumno);
                                setMostrarModalDarBaja(true);
                              }}
                              aria-label="Dar de baja"
                            >
                              <FaUserMinus />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* BOTONERA */}
        <div className="alu-down-container">
          <button
            className="alu-alumno-button alu-hover-effect alu-volver-atras"
            onClick={() => {
              setFiltros({
                busqueda: '',
                divisionSeleccionada: '',
                anioSeleccionado: null,
                categoriaSeleccionada: '',
                cobradorSeleccionado: '',
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
            {!isVista && (
              <button
                className="alu-alumno-button alu-hover-effect"
                onClick={() => navigate('/alumnos/agregar')}
                aria-label="Agregar"
                title="Agregar alumno"
              >
                <FaUserPlus className="alu-alumno-icon-button" />
                <p>Agregar Alumno</p>
              </button>
            )}

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
              className="alu-alumno-button alu-hover-effect alu-btn-familias"
              onClick={() => navigate('/familias')}
              aria-label="Familias"
              title="Familias"
            >
              <FaUsers className="alu-alumno-icon-button" />
              <p>Familias</p>
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

      {/* ✅ NUEVO */}
      {ReactDOM.createPortal(
        <ModalCobradorAlumno
          mostrar={mostrarModalCobrador}
          alumno={alumnoCobrador}
          nuevoValor={nuevoValorCobrador}
          onClose={() => {
            setMostrarModalCobrador(false);
            setAlumnoCobrador(null);
          }}
          onConfirm={confirmarToggleCobrador}
        />,
        document.body
      )}
    </div>
  );
};

export default Alumnos;