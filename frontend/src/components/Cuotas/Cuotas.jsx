// ✅ REEMPLAZAR COMPLETO
// src/components/Cuotas/Cuotas.jsx

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDollarSign,
  faPrint,
  faSearch,
  faCalendarAlt,
  faFilter,
  faSort,
  faUsers,
  faTimes,
  faArrowLeft,
  faFileExcel,
  faCheckCircle,
  faExclamationTriangle,
  faCog,
  faMoneyCheckAlt,
  faList
} from '@fortawesome/free-solid-svg-icons';

import BASE_URL from '../../config/config';
import ModalPagos from './modales/ModalPagos';
import ModalCodigoBarras from './modales/ModalCodigoBarras';
import ModalEliminarPago from './modales/ModalEliminarPago';
import ModalEliminarCondonacion from './modales/ModalEliminarCondonacion';
import ModalMesCuotas from './modales/ModalMesCuotas';
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import { imprimirRecibosExternos } from '../../utils/imprimirRecibosExternos';
import Toast from '../Global/Toast';
import './Cuotas.css';
import "../Global/roots.css";

const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const CURRENT_YEAR = new Date().getFullYear();

/* =========================
   ✅ IDs especiales (del backend)
========================= */
const ID_MES_ANUAL     = 13; // CONTADO ANUAL
const ID_MES_MATRICULA = 14; // MATRÍCULA
const ID_MES_1ER_MITAD = 15; // 1ER MITAD
const ID_MES_2DA_MITAD = 16; // 2DA MITAD

/* =========================
   ✅ DESCUENTO HERMANOS (mismo que ModalMesCuotas)
========================= */
const REFERENCIAS = {
  INTERNO: { mensual: 50000, totals: { 2: 80000 } },
  EXTERNO: { mensual: 6000, totals: { 2: 8000, 3: 10000 } },
};

function getPorcDescuentoDerivado(categoriaNombre = "", familyCount = 1) {
  const catNorm = normalizar(categoriaNombre).includes("extern") ? "EXTERNO" : "INTERNO";
  const ref = REFERENCIAS[catNorm];
  if (!ref?.mensual || !ref?.totals) return 0;

  const N = Math.max(1, Number(familyCount) || 1);
  if (N === 1) return 0;

  let Nref = ref.totals[N] ? N : undefined;
  if (!Nref && N >= 3 && ref.totals[3]) Nref = 3;
  if (!Nref && ref.totals[2]) Nref = 2;
  if (!Nref) return 0;

  const totalGrupoRef = Number(ref.totals[Nref] || 0);
  const mensualRef = Number(ref.mensual || 0);
  if (!(totalGrupoRef > 0) || !(mensualRef > 0)) return 0;

  const perCapitaRef = totalGrupoRef / Nref;
  const ratio = perCapitaRef / mensualRef;
  const descuento = 1 - ratio;
  return Math.max(0, Math.min(descuento, 0.95));
}

/* =========================
   ✅ Pool de promesas (concurrencia limitada)
========================= */
async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

/* =========================
   ✅ Parser de montos (tolera formato AR)
========================= */
const parseMonto = (v) => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d,.-]/g, '');
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const [busqueda, setBusqueda] = useState('');

  // pestaña: deudor | pagado | condonado
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');

  // Año **de pago**
  const [anioPagoSeleccionado, setAnioPagoSeleccionado] = useState('');

  // Año lectivo
  const [anioLectivoSeleccionado, setAnioLectivoSeleccionado] = useState('');

  // Otros filtros
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [divisionSeleccionada, setDivisionSeleccionada] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');

  // ✅ NUEVO: filtro cobrador
  const [soloCobrador, setSoloCobrador] = useState(false);

  // Listas
  const [aniosPago, setAniosPago] = useState([]);
  const [aniosLectivos, setAniosLectivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [divisiones, setDivisiones] = useState([]);
  const [meses, setMeses] = useState([]);

  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });

  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');

  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [mostrarModalEliminarCond, setMostrarModalEliminarCond] = useState(false);

  const [socioParaPagar, setSocioParaPagar] = useState(null);

  // Selector de meses (impresión)
  const [mostrarModalMesCuotas, setMostrarModalMesCuotas] = useState(false);
  const [socioParaImprimir, setSocioParaImprimir] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedRow, setSelectedRow] = useState(null);

  // ===== abort controllers (evitar respuestas viejas) =====
  const abortRef = useRef({ cuotas: null, listas: null, anios: null });

  // ✅ caches para imprimir todos (no repetir fetches) - incluye familyCount en key
  const cacheMontoCategoriaRef = useRef(new Map()); // id_alumno::familyCount -> data
  const cacheFamiliaRef = useRef(new Map());        // id_alumno -> data

  // Animación cascada
  const [cascadeActive, setCascadeActive] = useState(false);
  const [cascadeRunId, setCascadeRunId] = useState(0);
  const cascadeTimerRef = useRef(null);
  const triggerCascade = useCallback(() => {
    setCascadeActive(true);
    setCascadeRunId(prev => prev + 1);
    if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    cascadeTimerRef.current = setTimeout(() => setCascadeActive(false), 800);
  }, []);
  useEffect(() => () => { if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current); }, []);

  const navigate = useNavigate();
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helpers de lectura (según estructura del backend)
  const getIdMesFromCuota = (c) => c?.id_mes ?? c?.id_periodo ?? '';
  const getNombreCuota = (c) => c?.nombre ?? '';
  const getDomicilioCuota = (c) => c?.domicilio ?? '';
  const getDocumentoCuota = (c) => c?.documento ?? c?.dni ?? c?.num_documento ?? '';
  const getIdAlumnoFromCuota = (c) => c?.id_alumno ?? c?.id_socio ?? c?.id ?? '';

  // Año lectivo posible en cuota
  const getIdAnioLectivo = (c) =>
    c?.id_anio ?? c?.id_año ?? c?.anio_id ?? c?.anio ?? '';
  const getNombreAnioLectivo = (c) =>
    c?.anio_nombre ?? c?.nombre_anio ?? c?.nombre_año ?? '';

  const getNombreDivision = (id) => (divisiones.find(d => String(d.id) === String(id))?.nombre) || '';
  const getNombreCategoria = (id) => (categorias.find(c => String(c.id) === String(id))?.nombre) || '';
  const getNombreMes = (id) => (meses.find(m => String(m.id) === String(id))?.nombre) || id;

  // ✅ NUEVO helper: obtener ID de categoría "EXTERNO"
  const getCategoriaExternoId = useCallback(() => {
    const cat = categorias.find(c => normalizar(c?.nombre) === 'externo');
    return cat ? String(cat.id) : '';
  }, [categorias]);

  // ✅ REGLA:
  // - Imprimir normal SOLO en pagados
  // - PERO si "Solo cobrador" está activo => habilitar imprimir
  const canPrint = (estadoPagoSeleccionado === 'pagado') || (soloCobrador === true);

  /* =========================================================
     ✅ FIX: no cambiar el año seleccionado automáticamente
  ========================================================= */
  const fetchAniosPago = useCallback(async () => {
    try {
      if (abortRef.current.anios) abortRef.current.anios.abort();
      abortRef.current.anios = new AbortController();

      const res = await fetch(`${BASE_URL}/api.php?action=cuotas&listar_anios=1`, {
        signal: abortRef.current.anios.signal
      });
      const data = await res.json().catch(() => ({}));
      const lista = (data?.anios && Array.isArray(data.anios)) ? data.anios : [];
      setAniosPago(lista);

      const seleccionado = String(anioPagoSeleccionado || '');
      const existeSeleccionado = seleccionado && lista.some(a => String(a.id) === seleccionado);
      if (existeSeleccionado) return;

      const hasCurrent = lista.some(a => String(a.id) === String(CURRENT_YEAR));
      if (hasCurrent) setAnioPagoSeleccionado(String(CURRENT_YEAR));
      else if (lista.length > 0) setAnioPagoSeleccionado(String(lista[0].id));
      else setAnioPagoSeleccionado('');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('Error al obtener años de pago:', e);
      setAniosPago([]);
    }
  }, [anioPagoSeleccionado]);

  // === Obtener cuotas + listas ===
  const obtenerCuotasYListas = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('action', 'cuotas');
      if (mesSeleccionado) params.set('id_mes', String(mesSeleccionado));
      if (anioPagoSeleccionado) params.set('anio', String(anioPagoSeleccionado));

      // ✅ filtro cobrador al backend
      if (soloCobrador) params.set('solo_cobrador', '1');

      if (abortRef.current.cuotas) abortRef.current.cuotas.abort();
      if (abortRef.current.listas) abortRef.current.listas.abort();
      abortRef.current.cuotas = new AbortController();
      abortRef.current.listas = new AbortController();

      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?${params.toString()}`, { signal: abortRef.current.cuotas.signal }),
        fetch(`${BASE_URL}/api.php?action=obtener_listas`, { signal: abortRef.current.listas.signal })
      ]);

      const dataCuotas = await resCuotas.json().catch(() => ({}));
      const dataListas = await resListas.json().catch(() => ({}));

      setCuotas(dataCuotas?.exito && Array.isArray(dataCuotas.cuotas) ? dataCuotas.cuotas : []);

      if (dataListas?.exito) {
        const L = dataListas.listas || {};
        setCategorias(Array.isArray(L.categorias) ? L.categorias : []);
        setDivisiones(Array.isArray(L.divisiones) ? L.divisiones : []);
        setMeses(Array.isArray(L.meses) ? L.meses : []);
        setAniosLectivos(Array.isArray(L.anios) ? L.anios : []);
      } else {
        setCategorias([]); setDivisiones([]); setMeses([]); setAniosLectivos([]);
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('Error al conectar con el servidor:', e);
      setCuotas([]); setCategorias([]); setDivisiones([]); setMeses([]); setAniosLectivos([]);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado, anioPagoSeleccionado, soloCobrador]);

  // Cargar años de pago y luego datos
  useEffect(() => { fetchAniosPago(); }, [fetchAniosPago]);
  useEffect(() => { obtenerCuotasYListas(); /* eslint-disable-next-line */ }, [mesSeleccionado, anioPagoSeleccionado, soloCobrador]);

  // ===== Patch optimista tras pagar/condonar/eliminar =====
  const patchCuotasAfterAccion = useCallback(({ idAlumno, periodos, estado }) => {
    if (!idAlumno || !Array.isArray(periodos) || periodos.length === 0) return;

    const periodosNum = periodos
      .map(p => Number(String(p).trim()))
      .filter(n => Number.isFinite(n));

    if (periodosNum.length === 0) return;

    const estadoNorm = String(estado || '').toLowerCase().trim();
    if (!estadoNorm) return;

    setCuotas(prev =>
      prev.map((c) => {
        const sameAlumno = String(getIdAlumnoFromCuota(c)) === String(idAlumno);
        if (!sameAlumno) return c;

        const mes = Number(String(getIdMesFromCuota(c)).trim());
        if (!Number.isFinite(mes)) return c;

        if (periodosNum.includes(mes)) {
          return { ...c, estado_pago: estadoNorm };
        }
        return c;
      })
    );
  }, []);

  // Filtros locales
  const coincideBusquedaLibre = (c) => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(getNombreCuota(c)).includes(q) ||
      normalizar(getDomicilioCuota(c)).includes(q) ||
      normalizar(getDocumentoCuota(c)).includes(q)
    );
  };
  const coincideCategoria = (c) =>
    !categoriaSeleccionada || String(c?.id_categoria ?? '') === String(categoriaSeleccionada);
  const coincideDivision = (c) =>
    !divisionSeleccionada || String(c?.id_division ?? '') === String(divisionSeleccionada);
  const coincideMes = (c) =>
    !mesSeleccionado || String(getIdMesFromCuota(c)) === String(mesSeleccionado);

  const coincideEstadoPago = (c) =>
    !estadoPagoSeleccionado ||
    String(c?.estado_pago ?? '').toLowerCase().trim() === String(estadoPagoSeleccionado).toLowerCase().trim();

  // Año lectivo
  const coincideAnioLectivo = (c) => {
    if (!anioLectivoSeleccionado) return true;
    const idCuota = String(getIdAnioLectivo(c));
    if (idCuota) return idCuota === String(anioLectivoSeleccionado);

    const nombreCuota = normalizar(getNombreAnioLectivo(c));
    const nombreSeleccionado = normalizar(
      aniosLectivos.find(a => String(a.id) === String(anioLectivoSeleccionado))?.nombre ?? ''
    );
    return nombreSeleccionado ? nombreCuota === nombreSeleccionado : true;
  };

  const ordenarPor = (a, b, campo, asc) => {
    let va = '', vb = '';
    switch (campo) {
      case 'nombre': va = getNombreCuota(a); vb = getNombreCuota(b); break;
      case 'domicilio': va = getDomicilioCuota(a); vb = getDomicilioCuota(b); break;
      case 'dni': va = String(getDocumentoCuota(a)); vb = String(getDocumentoCuota(b)); break;
      default: va = getNombreCuota(a); vb = getNombreCuota(b);
    }
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  };

  // Lista para la pestaña seleccionada
  const cuotasFiltradas = useMemo(() => {
    if (!mesSeleccionado) return [];
    return cuotas
      .filter(coincideEstadoPago)
      .filter(coincideBusquedaLibre)
      .filter(coincideCategoria)
      .filter(coincideDivision)
      .filter(coincideAnioLectivo)
      .filter(coincideMes)
      .sort((a, b) => ordenarPor(a, b, orden.campo, orden.ascendente));
  }, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, anioLectivoSeleccionado, mesSeleccionado, estadoPagoSeleccionado, orden]);

  // Contadores
  const contarConFiltros = (estadoPago) =>
    cuotas.filter((c) =>
      String(getIdMesFromCuota(c)) === String(mesSeleccionado || '') &&
      (!busqueda || coincideBusquedaLibre(c)) &&
      coincideCategoria(c) &&
      coincideDivision(c) &&
      coincideAnioLectivo(c) &&
      (String(c?.estado_pago ?? '').toLowerCase().trim() === String(estadoPago).toLowerCase().trim())
    ).length;

  const cantidadFiltradaDeudores   = useMemo(() => mesSeleccionado ? contarConFiltros('deudor')    : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, anioLectivoSeleccionado, mesSeleccionado]);
  const cantidadFiltradaPagados    = useMemo(() => mesSeleccionado ? contarConFiltros('pagado')    : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, anioLectivoSeleccionado, mesSeleccionado]);
  const cantidadFiltradaCondonados = useMemo(() => mesSeleccionado ? contarConFiltros('condonado') : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, anioLectivoSeleccionado, mesSeleccionado]);

  const toggleOrden = useCallback((campo) => {
    setOrden(prev => ({ campo, ascendente: prev.campo === campo ? !prev.ascendente : true }));
    triggerCascade();
  }, [triggerCascade]);

  /* =========================================================
     ✅ FETCH helpers: monto_categoria (con familyCount + parse)
  ========================================================= */
  const fetchMontoCategoria = useCallback(async (idAlumno, familyCount = 1) => {
    const key = `${idAlumno}::${familyCount}`;
    if (!idAlumno) return null;
    if (cacheMontoCategoriaRef.current.has(key)) return cacheMontoCategoriaRef.current.get(key);

    try {
      const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(String(idAlumno))}&family_count=${encodeURIComponent(String(familyCount))}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));

      const out = {
        exito: !!data?.exito,
        monto_mensual: parseMonto(data?.monto_mensual ?? data?.monto ?? data?.precio ?? data?.Precio_Categoria),
        monto_anual: parseMonto(data?.monto_anual),
        monto_matricula: parseMonto(data?.monto_matricula ?? data?.matricula),
        categoria_nombre: String(data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? '').toUpperCase(),
      };

      cacheMontoCategoriaRef.current.set(key, out);
      return out;
    } catch (e) {
      console.error('fetchMontoCategoria error:', e);
      const out = { exito: false, monto_mensual: 0, monto_anual: 0, monto_matricula: 0, categoria_nombre: '' };
      cacheMontoCategoriaRef.current.set(key, out);
      return out;
    }
  }, []);

  const fetchFamilia = useCallback(async (idAlumno) => {
    const key = String(idAlumno);
    if (!key) return null;
    if (cacheFamiliaRef.current.has(key)) return cacheFamiliaRef.current.get(key);

    try {
      const url = `${BASE_URL}/api.php?action=obtener_info_familia&id_alumno=${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`obtener_info_familia HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));

      const out = {
        exito: !!data?.exito,
        tiene_familia: !!data?.tiene_familia,
        miembros_total: Number(data?.miembros_total || 0),
        miembros_activos: Number(data?.miembros_activos || 0),
      };

      cacheFamiliaRef.current.set(key, out);
      return out;
    } catch (e) {
      console.error('fetchFamilia error:', e);
      const out = { exito: false, tiene_familia: false, miembros_total: 0, miembros_activos: 0 };
      cacheFamiliaRef.current.set(key, out);
      return out;
    }
  }, []);

  /* =========================================================
     ✅ Determinar "período real a imprimir"
  ========================================================= */
  const getPeriodoImpresion = useCallback((cuota) => {
    const anio = Number(anioPagoSeleccionado) || CURRENT_YEAR;

    const idMesCuota = Number(getIdMesFromCuota(cuota));
    const idMesSel = Number(mesSeleccionado);

    const esEspecial = [ID_MES_ANUAL, ID_MES_MATRICULA, ID_MES_1ER_MITAD, ID_MES_2DA_MITAD].includes(idMesCuota);
    const origenAnual = Number(cuota?.origen_anual || 0) === 1;

    let idMesImprimir = idMesSel || idMesCuota || 0;

    if (esEspecial) {
      idMesImprimir = idMesCuota;
    } else if (origenAnual) {
      idMesImprimir = ID_MES_ANUAL;
    } else if (idMesCuota > 0) {
      idMesImprimir = idMesCuota;
    }

    let periodoTexto = `${getNombreMes(idMesImprimir)} ${anio}`;

    if (idMesImprimir === ID_MES_ANUAL) periodoTexto = `CONTADO ANUAL ${anio}`;
    if (idMesImprimir === ID_MES_MATRICULA) periodoTexto = `MATRÍCULA ${anio}`;
    if (idMesImprimir === ID_MES_1ER_MITAD) periodoTexto = `1ER MITAD ${anio}`;
    if (idMesImprimir === ID_MES_2DA_MITAD) periodoTexto = `2DA MITAD ${anio}`;

    return { idMesImprimir, periodoTexto, anio };
  }, [anioPagoSeleccionado, mesSeleccionado, getNombreMes]);

  /* =========================================================
     ✅ Armar “alumno para imprimir” (1 ítem)
  ========================================================= */
  const buildAlumnoParaImprimir = useCallback(async (cuota) => {
    const idAlumno = getIdAlumnoFromCuota(cuota);
    const { idMesImprimir, periodoTexto, anio } = getPeriodoImpresion(cuota);

    const catFallback = (getNombreCategoria(cuota?.id_categoria) || '').toUpperCase();

    // 1) familia => familyCount
    const fam = await fetchFamilia(idAlumno);
    const mA = Number(fam?.miembros_activos || 0);
    const mT = Number(fam?.miembros_total || 0);
    const baseFam = Math.max(mA, mT, 0);
    const familyCount = (fam?.tiene_familia) ? Math.max(1, baseFam) : 1;

    // 2) monto_categoria con familyCount
    const mCat = await fetchMontoCategoria(idAlumno, familyCount);
    const categoriaNombre = (mCat?.categoria_nombre || catFallback || '').toUpperCase();

    const porc = getPorcDescuentoDerivado(categoriaNombre, familyCount);

    const mensualBase = Number(mCat?.monto_mensual || 0);
    const anualBase   = Number(mCat?.monto_anual || 0);
    const matricBase  = Number(mCat?.monto_matricula || 0);

    let precio = 0;

    if (idMesImprimir === ID_MES_ANUAL) {
      const base = anualBase > 0 ? anualBase : (mensualBase * 12);
      precio = Math.max(0, Math.round(base * (1 - porc)));
    } else if (idMesImprimir === ID_MES_MATRICULA) {
      // matrícula: normalmente NO aplica descuento de hermanos
      precio = Math.max(0, Math.round(matricBase));
    } else if (idMesImprimir === ID_MES_1ER_MITAD || idMesImprimir === ID_MES_2DA_MITAD) {
      const base = mensualBase * 5;
      precio = Math.max(0, Math.round(base * (1 - porc)));
    } else {
      precio = Math.max(0, Math.round(mensualBase * (1 - porc)));
    }

    return {
      ...cuota,
      id_alumno: idAlumno,

      periodos: [idMesImprimir],
      extras_periodos: [],
      periodos_completos: [idMesImprimir],
      cantidad_meses: 1,
      id_periodo: idMesImprimir,
      periodo_texto: periodoTexto,

      anio,
      categoria_nombre: categoriaNombre,

      precio_unitario: precio,
      importe_total: precio,
      precio_total: precio,

      meta_descuento_hermanos: {
        familia: familyCount,
        categoria: categoriaNombre,
        porcentaje: porc,
      },
    };
  }, [
    fetchFamilia,
    fetchMontoCategoria,
    getNombreCategoria,
    getPeriodoImpresion,
  ]);

  /* =========================================================
     ✅ IMPRESIÓN DIRECTA (sin modal) SOLO EN PAGADOS
  ========================================================= */
  const imprimirUnoDirecto = useCallback(async (cuota) => {
    try {
      if (!cuota) return;
      if (!mesSeleccionado) return;

      setLoadingPrint(true);

      const alumno = await buildAlumnoParaImprimir(cuota);

      const nombreCat = getNombreCategoria(cuota?.id_categoria);
      const isExterno = normalizar(nombreCat) === 'externo';

      const { idMesImprimir } = getPeriodoImpresion(cuota);

      const w = window.open('', '_blank');
      if (!w) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }

      if (isExterno) {
        await imprimirRecibosExternos([alumno], idMesImprimir, w, { anioPago: anioPagoSeleccionado });
      } else {
        await imprimirRecibos([alumno], idMesImprimir, w, { anioPago: anioPagoSeleccionado });
      }
    } catch (e) {
      console.error('imprimirUnoDirecto error:', e);
      setToastTipo('error');
      setToastMensaje('Error al imprimir. Revisá consola.');
      setToastVisible(true);
    } finally {
      setLoadingPrint(false);
    }
  }, [
    mesSeleccionado,
    anioPagoSeleccionado,
    buildAlumnoParaImprimir,
    getNombreCategoria,
    getPeriodoImpresion,
  ]);

  // Imprimir TODOS: separar internos/externos
  const handleImprimirTodos = async () => {
    if (!canPrint) {
      setToastTipo('advertencia');
      setToastMensaje(soloCobrador
        ? 'Activá "Solo cobrador" para imprimir desde cualquier pestaña.'
        : 'La impresión está disponible únicamente en la pestaña de Pagados.');
      setToastVisible(true);
      return;
    }

    if (!categoriaSeleccionada) {
      setToastTipo('advertencia');
      setToastMensaje('Seleccioná una categoría (Interno o Externo) para habilitar la impresión.');
      setToastVisible(true);
      return;
    }

    if (!mesSeleccionado || cuotasFiltradas.length === 0) return;

    setLoadingPrint(true);
    try {
      const getCatNombreDeCuota = (c) => (categorias.find(x => String(x.id) === String(c?.id_categoria))?.nombre) || '';
      const internosRaw = [];
      const externosRaw = [];

      for (const c of cuotasFiltradas) {
        const tipo = normalizar(getCatNombreDeCuota(c));
        if (tipo === 'externo') externosRaw.push(c);
        else internosRaw.push(c);
      }

      const CONCURRENCY = 8;

      const internos = await asyncPool(CONCURRENCY, internosRaw, buildAlumnoParaImprimir);
      const externos = await asyncPool(CONCURRENCY, externosRaw, buildAlumnoParaImprimir);

      if (internos.length) {
        const w1 = window.open('', '_blank');
        if (!w1) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
        await imprimirRecibos(internos, mesSeleccionado, w1, { anioPago: anioPagoSeleccionado });
      }
      if (externos.length) {
        const w2 = window.open('', '_blank');
        if (!w2) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
        await imprimirRecibosExternos(externos, mesSeleccionado, w2, { anioPago: anioPagoSeleccionado });
      }

      setToastTipo('exito');
      setToastMensaje('Impresión generada con montos reales por alumno (incluye descuentos).');
      setToastVisible(true);
    } catch (e) {
      console.error('Error al imprimir:', e);
      setToastTipo('error');
      setToastMensaje('Error al imprimir. Revisá consola.');
      setToastVisible(true);
    } finally {
      setLoadingPrint(false);
    }
  };

  // Selección de filas
  const handleRowClick = useCallback((index) => {
    if (cascadeActive) return;
    if (typeof index === 'number' && index >= 0) {
      setSelectedRow(prev => (prev === index ? null : index));
    }
  }, [cascadeActive]);

  const handlePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalPagos(true); }, []);
  const handleDeletePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarPago(true); }, []);
  const handleDeleteCondClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarCond(true); }, []);

  // ✅ Imprimir UNO:
  // - En PAGADOS => imprime DIRECTO (sin modal)
  // - En otros casos => mantiene ModalMesCuotas
  const handlePrintClick = useCallback(async (item) => {
    if (!canPrint) {
      setToastTipo('advertencia');
      setToastMensaje(soloCobrador
        ? 'Activá "Solo cobrador" para imprimir desde cualquier pestaña.'
        : 'La impresión está disponible únicamente en la pestaña de Pagados.');
      setToastVisible(true);
      return;
    }

    if (estadoPagoSeleccionado === 'pagado') {
      await imprimirUnoDirecto(item);
      return;
    }

    setSocioParaImprimir(item);
    setMostrarModalMesCuotas(true);
  }, [canPrint, soloCobrador, estadoPagoSeleccionado, imprimirUnoDirecto]);

  const handleExportExcel = useCallback(() => {
    if (!mesSeleccionado) { setToastTipo('advertencia'); setToastMensaje('Seleccione mes'); setToastVisible(true); return; }
    if (loading) { setToastTipo('advertencia'); setToastMensaje('Esperando datos...'); setToastVisible(true); return; }
    if (cuotasFiltradas.length === 0) { setToastTipo('advertencia'); setToastMensaje('No hay datos'); setToastVisible(true); return; }
    setToastTipo('exito'); setToastMensaje('Exportación a Excel iniciada'); setToastVisible(true);
  }, [mesSeleccionado, loading, cuotasFiltradas.length]);

  const onChangeMes        = (e) => { setMesSeleccionado(e.target.value); triggerCascade(); };
  const onChangeAnioPago   = (e) => { setAnioPagoSeleccionado(e.target.value); triggerCascade(); };
  const onChangeCategoria  = (e) => { setCategoriaSeleccionada(e.target.value); triggerCascade(); };
  const onChangeDivision   = (e) => { setDivisionSeleccionada(e.target.value); triggerCascade(); };
  const onChangeAnioLect   = (e) => { setAnioLectivoSeleccionado(e.target.value); triggerCascade(); };
  const onChangeBusqueda   = (e) => { setBusqueda(e.target.value); triggerCascade(); };

  // ✅ toggle cobrador
  // - Si lo ACTIVO => fuerzo pestaña "deudor"
  // - ✅ al ACTIVAR => setear categoría automáticamente a EXTERNO (si existe)
  const onToggleSoloCobrador = () => {
    setSoloCobrador(prev => {
      const next = !prev;

      if (next) {
        setEstadoPagoSeleccionado('deudor');

        const externoId = getCategoriaExternoId();
        if (externoId) {
          setCategoriaSeleccionada(externoId);
        }
      }

      return next;
    });

    triggerCascade();
  };

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    const isSelected = selectedRow === index;

    const nombreDiv  = getNombreDivision(cuota?.id_division);
    const nombreCat  = getNombreCategoria(cuota?.id_categoria);
    const tipoCat    = normalizar(nombreCat);
    const isInterno  = tipoCat === 'interno';
    const isExterno  = tipoCat === 'externo';

    const cascadeClass = cascadeActive && index < 25 ? `gcuotas-cascade gcuotas-cascade-${index}` : '';
    const zebraClass   = index % 2 === 0 ? 'gcuotas-row-even' : 'gcuotas-row-odd';

    const actionButtons = (
      <div className="gcuotas-actions-inline">
        {canPrint && (
          <button
            className="gcuotas-action-button gcuotas-print-button"
            onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
            title="Imprimir"
            disabled={loadingPrint}
          >
            <FontAwesomeIcon icon={faPrint} />
          </button>
        )}

        {estadoPagoSeleccionado === 'deudor' ? (
          <button
            className="gcuotas-action-button gcuotas-payment-button"
            onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
            title="Registrar pago / Condonar"
          >
            <FontAwesomeIcon icon={faDollarSign} />
          </button>
        ) : estadoPagoSeleccionado === 'pagado' ? (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
            title="Eliminar pago"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        ) : (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
            title="Eliminar condonación"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div
          style={style}
          className={`gcuotas-mobile-card ${cascadeClass} ${isSelected ? "gcuotas-selected-card" : ""}`}
          onClick={() => { if (!cascadeActive) handleRowClick(index); }}
        >
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Alumno:</span>
            <span>{getNombreCuota(cuota)}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">DNI:</span>
            <span>{getDocumentoCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Domicilio:</span>
            <span>{getDomicilioCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">División:</span>
            <span>{nombreDiv || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Categoría:</span>
            <span>
              <span
                className={`gcuotas-chip ${
                  isInterno ? 'gcuotas-chip--interno'
                  : isExterno ? 'gcuotas-chip--externo'
                  : 'gcuotas-chip--default'
                }`}
              >
                {nombreCat || '—'}
              </span>
            </span>
          </div>

          <div className="gcuotas-mobile-actions">
            {canPrint && (
              <button
                className="gcuotas-mobile-print-button"
                onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
                disabled={loadingPrint}
              >
                <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
              </button>
            )}

            {estadoPagoSeleccionado === 'deudor' ? (
              <button
                className="gcuotas-mobile-payment-button"
                onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
              >
                <FontAwesomeIcon icon={faDollarSign} /><span>Pagar</span>
              </button>
            ) : estadoPagoSeleccionado === 'pagado' ? (
              <button
                className="gcuotas-mobile-deletepay-button"
                onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
              >
                <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
              </button>
            ) : (
              <button
                className="gcuotas-mobile-deletepay-button"
                onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
              >
                <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        style={style}
        className={`gcuotas-virtual-row ${zebraClass} ${cascadeClass} ${isSelected ? "gcuotas-selected-row" : ""}`}
        onClick={() => { if (!cascadeActive) handleRowClick(index); }}
      >
        <div className="gcuotas-virtual-cell">{getNombreCuota(cuota)}</div>
        <div className="gcuotas-virtual-cell">{getDocumentoCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getDomicilioCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getNombreDivision(cuota?.id_division) || '—'}</div>
        <div className="gcuotas-virtual-cell">
          <span
            className={`gcuotas-chip ${
              isInterno ? 'gcuotas-chip--interno'
              : isExterno ? 'gcuotas-chip--externo'
              : 'gcuotas-chip--default'
            }`}
          >
            {getNombreCategoria(cuota?.id_categoria) || '—'}
          </span>
        </div>
        <div className="gcuotas-virtual-cell gcuotas-virtual-actions">{actionButtons}</div>
      </div>
    );
  };

  const LoadingIndicator = () => (
    <div className="gcuotas-loading-container">
      <div className="gcuotas-loading-spinner"></div>
      <p>Cargando datos...</p>
    </div>
  );
  const NoMonthSelected  = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faCalendarAlt} size="3x" />
      <p>Por favor seleccione un mes para ver los datos</p>
    </div>
  );
  const NoDataFound      = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
      <p>No se encontraron datos para los filtros seleccionados</p>
    </div>
  );

  // ✅ RESYNC FUERTE (ordenado y esperado)
  const resyncAll = useCallback(async () => {
    setSelectedRow(null);
    await fetchAniosPago();
    await obtenerCuotasYListas();
    triggerCascade();
  }, [fetchAniosPago, obtenerCuotasYListas, triggerCascade]);

  return (
    <div className={`gcuotas-container gcuotas--table-fullwidth ${cascadeActive ? 'gcuotas-cascading' : ''}`}>
      {toastVisible && (
        <Toast
          tipo={toastTipo}
          mensaje={toastMensaje}
          onClose={() => setToastVisible(false)}
          duracion={3000}
        />
      )}

      {mostrarModalPagos && (
        <ModalPagos
          socio={socioParaPagar}
          onClose={async (ok, payload) => {
            setMostrarModalPagos(false);

            if (ok && payload?.idAlumno && Array.isArray(payload?.periodos) && payload?.estado) {
              patchCuotasAfterAccion(payload);
            }

            await resyncAll();
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={async () => {
            setMostrarModalCodigoBarras(false);
            await resyncAll();
          }}
          periodo={getNombreMes(mesSeleccionado)}
          periodoId={mesSeleccionado}
          onPagoRealizado={resyncAll}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodoId={Number(mesSeleccionado)}
          periodoNombre={getNombreMes(mesSeleccionado)}
          anioPago={anioPagoSeleccionado}
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={async () => {
            const idAlumno = socioParaPagar?.id_alumno ?? socioParaPagar?.id_socio ?? socioParaPagar?.id;
            const mes = Number(mesSeleccionado);
            if (idAlumno && mes) patchCuotasAfterAccion({ idAlumno, periodos: [mes], estado: 'deudor' });

            await resyncAll();
          }}
        />
      )}

      {mostrarModalEliminarCond && (
        <ModalEliminarCondonacion
          socio={socioParaPagar}
          periodo={Number(mesSeleccionado)}
          periodoTexto={getNombreMes(mesSeleccionado)}
          onClose={() => setMostrarModalEliminarCond(false)}
          onEliminado={async () => {
            const idAlumno = socioParaPagar?.id_alumno ?? socioParaPagar?.id_socio ?? socioParaPagar?.id;
            const mes = Number(mesSeleccionado);
            if (idAlumno && mes) patchCuotasAfterAccion({ idAlumno, periodos: [mes], estado: 'deudor' });

            await resyncAll();
          }}
        />
      )}

      {/* ModalMesCuotas queda SOLO para casos no-pagados (ej: solo cobrador) */}
      {canPrint && mostrarModalMesCuotas && socioParaImprimir && (
        <ModalMesCuotas
          socio={socioParaImprimir}
          meses={meses}
          anio={Number(anioPagoSeleccionado) || new Date().getFullYear()}
          esExterno={normalizar(getNombreCategoria(socioParaImprimir?.id_categoria)) === 'externo'}
          onClose={() => { setMostrarModalMesCuotas(false); setSocioParaImprimir(null); }}
        />
      )}

      <div className="gcuotas-left-section gcuotas-box">
        <div className="gcuotas-header-section">
          <h2 className="gcuotas-title">
            <FontAwesomeIcon icon={faMoneyCheckAlt} className="gcuotas-title-icon" />
            Gestión de Cuotas
          </h2>
        </div>

        <div className="gcuotas-scrollable-content">
          <div className="gcuotas-top-section">
            <div className="gcuotas-filter-card">
              <div className="gcuotas-filter-header">
                <div className="gcuotas-filter-header-left">
                  <FontAwesomeIcon icon={faFilter} className="gcuotas-filter-icon" />
                  <span>Filtros</span>
                </div>
              </div>

              <div className="gcuotas-select-container">
                <div className="gcuotas-input-row">
                  {/* ✅ Floating label: Año de pago */}
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="anioPago"
                        value={anioPagoSeleccionado}
                        onChange={onChangeAnioPago}
                        className="fl-control fl-select"
                        disabled={loading || aniosPago.length === 0}
                      >
                        {aniosPago.length === 0 ? (
                          <option value="">Sin pagos</option>
                        ) : (
                          aniosPago.map((a, idx) => (
                            <option key={idx} value={a.id}>{a.nombre}</option>
                          ))
                        )}
                      </select>
                      <label htmlFor="anioPago" className="fl-label">Año</label>
                    </div>
                  </div>

                  {/* ✅ Floating label: Mes */}
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="meses"
                        value={mesSeleccionado}
                        onChange={onChangeMes}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Mes</option>
                        {meses.map((mes, idx) => (
                          <option key={idx} value={mes.id}>{mes.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="meses" className="fl-label">Mes</label>
                    </div>
                  </div>
                </div>

                {/* ✅ CATEGORÍA + COBRADOR */}
                <div className="gcuotas-input-row gcuotas-input-row-categoria-cobrador">
                  {/* ✅ Floating label: Categoría */}
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="categoria"
                        value={categoriaSeleccionada}
                        onChange={onChangeCategoria}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Todas</option>
                        {categorias.map((c, idx) => (
                          <option key={idx} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="categoria" className="fl-label">Categoría</label>
                    </div>
                  </div>

                  {/* Cobrador (botón) */}
                  <div className="gcuotas-input-group">
                    <label className="gcuotas-input-label">
                      <FontAwesomeIcon icon={faFilter} /> Cobrador
                    </label>
                    <button
                      type="button"
                      onClick={onToggleSoloCobrador}
                      className={`gcuotas-button gcuotas-button-cobrador ${
                        soloCobrador ? "gcuotas-button-print-all" : "gcuotas-button-export"
                      }`}
                      disabled={loading}
                      title="Filtrar alumnos con es_cobrador=1"
                    >
                      {soloCobrador ? "ACTIVADO" : "Desactivado"}
                    </button>
                  </div>
                </div>

                <div className="gcuotas-input-row">
                  {/* ✅ Floating label: Año lectivo */}
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="anioLectivo"
                        value={anioLectivoSeleccionado}
                        onChange={onChangeAnioLect}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Todos</option>
                        {aniosLectivos.map((a, idx) => (
                          <option key={idx} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="anioLectivo" className="fl-label">Año</label>
                    </div>
                  </div>

                  {/* ✅ Floating label: División */}
                  <div className="gcuotas-input-group">
                    <div className="fl-field">
                      <select
                        id="division"
                        value={divisionSeleccionada}
                        onChange={onChangeDivision}
                        className="fl-control fl-select"
                        disabled={loading}
                      >
                        <option value="">Todas</option>
                        {divisiones.map((d, idx) => (
                          <option key={idx} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                      <label htmlFor="division" className="fl-label">División</label>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="gcuotas-tabs-card">
              <div className="gcuotas-tabs-header">
                <FontAwesomeIcon icon={faList} className="gcuotas-tabs-icon" />
                <span>Estado de cuotas</span>
              </div>
              <div className="gcuotas-tab-container">
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'deudor' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('deudor')}
                  disabled={loading}
                  title="Deudores"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaDeudores}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'pagado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                  title="Pagados"
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaPagados}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'condonado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('condonado')}
                  disabled={loading}
                  title="Condonados"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaCondonados}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="gcuotas-actions-card">
            <div className="gcuotas-actions-header">
              <FontAwesomeIcon icon={faCog} className="gcuotas-actions-icon" />
              <span>Acciones</span>
            </div>
            <div className="gcuotas-buttons-container">
              <button
                className="gcuotas-button gcuotas-button-back"
                onClick={() => navigate('/panel')}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
              </button>
              <button
                className="gcuotas-button gcuotas-button-export"
                onClick={handleExportExcel}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
              </button>

              <button
                className={`gcuotas-button gcuotas-button-print-all ${loadingPrint ? 'gcuotas-button-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={
                  !canPrint ||
                  loadingPrint ||
                  !mesSeleccionado ||
                  cuotasFiltradas.length === 0 ||
                  loading ||
                  !categoriaSeleccionada
                }
                title={
                  !canPrint
                    ? (soloCobrador ? 'Activá "Solo cobrador" para imprimir' : 'Disponible solo en Pagados')
                    : (categoriaSeleccionada ? 'Imprimir' : 'Seleccioná categoría: Interno o Externo')
                }
              >
                <FontAwesomeIcon icon={faPrint} /><span>{loadingPrint ? 'Generando...' : 'Imprimir'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`gcuotas-right-section gcuotas-box ${isMobile ? 'gcuotas-has-bottombar' : ''}`}>
        <div className="gcuotas-table-header">
          <h3>
            <FontAwesomeIcon icon={estadoPagoSeleccionado === 'pagado' ? faCheckCircle : faExclamationTriangle} />
            {estadoPagoSeleccionado === 'pagado'
              ? 'Cuotas Pagadas'
              : estadoPagoSeleccionado === 'condonado'
                ? 'Cuotas Condonadas'
                : 'Cuotas Pendientes'}
            {mesSeleccionado && (<span className="gcuotas-periodo-seleccionado"> - {getNombreMes(mesSeleccionado)}</span>)}
          </h3>

          {/* ✅ Floating label: Search */}
          <div className="gcuotas-input-group gcuotas-search-group">
            <div className="fl-field">
              <FontAwesomeIcon icon={faSearch} className="gcuotas-search-icon" />
              <input
                type="text"
                value={busqueda}
                onChange={onChangeBusqueda}
                disabled={loading || !mesSeleccionado}
                className="fl-control fl-search"
              />
              <label className="fl-label">Buscar alumno</label>
            </div>
          </div>

          <div className="gcuotas-summary-info">
            <span className="gcuotas-summary-item">
              <FontAwesomeIcon icon={faUsers} /> Total: {mesSeleccionado ? cuotasFiltradas.length : 0}
            </span>
          </div>
        </div>

        <div className="gcuotas-table-container">
          {loading ? <LoadingIndicator /> :
            !mesSeleccionado ? <NoMonthSelected /> :
              cuotasFiltradas.length === 0 ? <NoDataFound /> :
                isMobile ? (
                  <div className="gcuotas-mobile-list">
                    {cuotasFiltradas.map((item, index) => (
                      <Row key={`${cascadeRunId}-${index}`} index={index} style={{}} data={cuotasFiltradas} />
                    ))}
                  </div>
                ) : (
                  <div className="gcuotas-virtual-tables" style={{ height: "80vh" }}>
                    <div className="gcuotas-virtual-header">
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('nombre')}>
                        Alumno <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'nombre' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'nombre' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('dni')}>
                        DNI <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'dni' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'dni' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('domicilio')}>
                        Domicilio <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'domicilio' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'domicilio' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell">División</div>
                      <div className="gcuotas-virtual-cell">Categoría</div>
                      <div className="gcuotas-virtual-cell">Acciones</div>
                    </div>

                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          key={`list-${cascadeRunId}`}
                          height={height}
                          itemCount={cuotasFiltradas.length}
                          itemSize={45}
                          width={width}
                          itemData={cuotasFiltradas}
                          className="gcuotas-listoverflow"
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                )}
        </div>
      </div>

      {isMobile && (
        <div className="gcuotas-mobile-bottombar">
          <button
            className="gcuotas-mbar-btn mbar-back"
            onClick={() => navigate('/panel')}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
          </button>
          <button
            className="gcuotas-mbar-btn mbar-excel"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-imprimir"
            onClick={handleImprimirTodos}
            disabled={
              !canPrint ||
              loadingPrint ||
              !mesSeleccionado ||
              cuotasFiltradas.length === 0 ||
              loading ||
              !categoriaSeleccionada
            }
            title={
              !canPrint
                ? (soloCobrador ? 'Activá "Solo cobrador" para imprimir' : 'Disponible solo en Pagados')
                : (categoriaSeleccionada ? 'Imprimir' : 'Seleccioná categoría: Interno o Externo')
            }
          >
            <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Cuotas;