// ✅ REEMPLAZAR COMPLETO
// src/components/Cuotas/modales/ModalPagos.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt, FaPen, FaCheck, FaTimes, FaInfoCircle, FaSave } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';
import "../../Global/roots.css";

// ================= Utils impresión =================

// Normal (no rotado)
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';

// 🔧 ROTADO → alias porque el archivo exporta `imprimirRecibos`
import { imprimirRecibos as imprimirRecibosRotado } from '../../../utils/imprimirRecibosRotado.jsx';

// Externos rotados
import { imprimirRecibosExternos as imprimirRecibosExternosRotados } from '../../../utils/imprimirRecibosExternosRotados.jsx';

// PDF
import { generarComprobanteAlumnoPDF } from '../../../utils/ComprobanteExternoPDF.jsx';

/* ====== Constantes ====== */
const MIN_YEAR = 2025;
const ID_CONTADO_ANUAL = 13;
const ID_MATRICULA = 14;
// Mitades de contado anual
const ID_CONTADO_ANUAL_H1 = 15; // Mar–Jul
const ID_CONTADO_ANUAL_H2 = 16; // Ago–Dic

/* ====== Helpers ====== */
const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

const capitalizar = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

// Cambiá este flag a true para mostrar siempre el CONTADO ANUAL
const FORZAR_VENTANA_ANUAL = true;

const dentroVentanaAnual = (hoy = new Date()) => {
  if (FORZAR_VENTANA_ANUAL) return true;

  // 15-Dic (y) a 01-Abr (y+1)
  const y = hoy.getFullYear();
  const inicio = new Date(y, 11, 15);
  const fin = new Date(y + 1, 3, 1);
  if (hoy >= inicio && hoy < fin) return true;

  const finEsteAnio = new Date(y, 3, 1);
  const inicioAnterior = new Date(y - 1, 11, 15);
  return hoy >= inicioAnterior && hoy < finEsteAnio;
};

/* ============================================================
   DESCUENTOS POR HERMANOS — por referencia (MENSUAL)
   ============================================================ */
const REFERENCIAS = {
  INTERNO: { mensual: 50000, totals: { 2: 80000 } },
  EXTERNO: { mensual: 6000, totals: { 2: 8000, 3: 10000 } }
};

function getPorcDescuentoDerivado(categoriaNombre = '', familyCount = 1) {
  const catNorm = normalizar(categoriaNombre).includes('extern') ? 'EXTERNO' : 'INTERNO';
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
  const ratio = perCapitaRef / mensualRef; // e.g. 0.8 => 20% OFF
  const descuento = 1 - ratio;
  return Math.max(0, Math.min(descuento, 0.95));
}

// Redondeo a centenas
const roundToHundreds = (n) => {
  const v = Math.round((Number(n) || 0) / 100) * 100;
  return v < 0 ? 0 : v;
};

const ModalPagos = ({ socio, onClose }) => {
  const now = new Date();
  const nowYear = now.getFullYear();
  const ventanaAnualActiva = dentroVentanaAnual(now);

  const [meses, setMeses] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [periodosEstado, setPeriodosEstado] = useState({});
  const [seleccionados, setSeleccionados] = useState([]);
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  // Éxito + modo comprobante
  const [pagoExitoso, setPagoExitoso] = useState(false);
  const [modoComprobante, setModoComprobante] = useState('imprimir'); // 'imprimir' | 'pdf'

  // Condonar + selector de año
  const [condonar, setCondonar] = useState(false);
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // ===== Precio por categoría (dinámico) =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState('');

  // ===== Extras =====
  const [anualSeleccionado, setAnualSeleccionado] = useState(false);
  const [matriculaSeleccionada, setMatriculaSeleccionada] = useState(false);
  const [matriculaEditando, setMatriculaEditando] = useState(false);
  const [montoMatricula, setMontoMatricula] = useState(15000);
  const [guardandoMatricula, setGuardandoMatricula] = useState(false);

  // ===== Anual editable (monto manual solo para esta operación) =====
  const [anualEditando, setAnualEditando] = useState(false);
  const [anualManualActivo, setAnualManualActivo] = useState(false);
  const [montoAnualManual, setMontoAnualManual] = useState('');

  // ===== Modo libre =====
  const [libreActivo, setLibreActivo] = useState(false);
  const [libreValor, setLibreValor] = useState('');

  // ===== Estado para controlar modo activo =====
  const [modoActivo, setModoActivo] = useState('meses'); // 'meses' | 'anual' | 'matricula' | 'combinado'

  // ===== Info de familia =====
  const [familiaInfo, setFamiliaInfo] = useState({
    tieneFamilia: false,
    id_familia: null,
    nombre_familia: '',
    miembros_total: 0,
    miembros_activos: 0,
    miembros: []
  });
  const [mostrarMiembros, setMostrarMiembros] = useState(false);

  // aplicar a grupo familiar
  const [aplicarFamilia, setAplicarFamilia] = useState(false);

  // mitades de anual
  const [anualH1, setAnualH1] = useState(false); // Mar–Jul
  const [anualH2, setAnualH2] = useState(false); // Ago–Dic

  // ===== medios de pago =====
  const [mediosPago, setMediosPago] = useState([]);          // [{id, nombre}]
  const [medioSeleccionado, setMedioSeleccionado] = useState(''); // id como string

  // ===== Estados para matrícula manual =====
  const [matriculaManualActiva, setMatriculaManualActiva] = useState(false);
  const [montoMatriculaManual, setMontoMatriculaManual] = useState('');
  const [editandoMatriculaManual, setEditandoMatriculaManual] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  // ID tolerante
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  /* ================= Helpers ================= */
  const formatearFecha = (f) => {
    if (!f) return '—';
    const parts = String(f).split('-');
    if (parts.length !== 3) return f;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  const mesesGrid = useMemo(() => meses.filter(m => Number(m.id) >= 1 && Number(m.id) <= 12), [meses]);

  const esExterno = useMemo(() => {
    const raw =
      nombreCategoria ||
      socio?.categoria_nombre ||
      socio?.nombre_categoria ||
      socio?.categoria ||
      '';
    return normalizar(raw).includes('extern');
  }, [nombreCategoria, socio]);

  /* ========= Descuento por hermanos ========= */
  const familyCount = useMemo(() => {
    const mA = Number(familiaInfo.miembros_activos || 0);
    const mT = Number(familiaInfo.miembros_total || 0);
    const base = Math.max(mA, mT, 0);
    return familiaInfo.tieneFamilia ? Math.max(1, base) : 1;
  }, [familiaInfo]);

  const porcDescHermanos = useMemo(
    () => getPorcDescuentoDerivado(nombreCategoria, familyCount),
    [nombreCategoria, familyCount]
  );

  const precioMensualConDescuento = useMemo(() => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    const base = Number(precioMensual || 0);
    const porc = Number(porcDescHermanos || 0);
    const ajustado = Math.round(base * (1 - porc));
    return Math.max(0, ajustado);
  }, [condonar, libreActivo, libreValor, precioMensual, porcDescHermanos]);

  // ✅✅✅ FIX CLAVE (EXTERNOS + INTERNOS):
  // ====== ANUAL con descuento: SIEMPRE aplicar el % derivado sobre el ANUAL BASE que viene de la DB ======
  // Ejemplo: anual DB=100000 y desc=33.3% => 66667 (no 35000)
  // Ejemplo: anual DB=100000 y desc=44.4% => 55600 (no 26667)
  const montoAnualConDescuento = useMemo(() => {
    if (condonar) return 0;
    const base = Number(montoAnual || 0);
    if (!base) return 0;

    const porc = Number(porcDescHermanos || 0);
    const ajustado = Math.round(base * (1 - porc));
    return Math.max(0, ajustado);
  }, [condonar, montoAnual, porcDescHermanos]);

  // ====== AUX: estados ya registrados para extras ======
  const estadoAnualFull = periodosEstado[ID_CONTADO_ANUAL];      // 13
  const estadoAnualH1   = periodosEstado[ID_CONTADO_ANUAL_H1];   // 15
  const estadoAnualH2   = periodosEstado[ID_CONTADO_ANUAL_H2];   // 16
  const estadoMatricula = periodosEstado[ID_MATRICULA];          // 14

  // ✅ BLOQUEO ANUAL:
  // - bloquea el "switch" anual solo si ya está cubierto todo el año (full o ambas mitades)
  const bloqueadoAnual = !!(estadoAnualFull || (estadoAnualH1 && estadoAnualH2));
  const bloqueadoMatricula = !!estadoMatricula;

  // ====== cálculo de anual considerando monto manual, mitades y lo YA pagado ======
  const anualConfig = useMemo(() => {
    // Devuelve { tipo: 'full'|'h1'|'h2', idPeriodo, importe, etiqueta }
    if (!anualSeleccionado) return { tipo: null, idPeriodo: null, importe: 0, etiqueta: '' };

    // Base del anual: manual (si activo) o calculado (YA con descuento aplicado si corresponde)
    const baseAnual = Math.max(
      0,
      Math.round(
        anualManualActivo
          ? Number(montoAnualManual || 0)
          : Number(montoAnualConDescuento || 0)
      )
    );

    // Regla: si ya hay una mitad registrada, siempre cobrar la otra mitad
    if (!estadoAnualFull) {
      if (estadoAnualH1 && !estadoAnualH2) {
        return {
          tipo: 'h2',
          idPeriodo: ID_CONTADO_ANUAL_H2,
          importe: Math.max(0, Math.round(baseAnual / 2)),
          etiqueta: 'CONTADO ANUAL (2ª mitad)'
        };
      }
      if (!estadoAnualH1 && estadoAnualH2) {
        return {
          tipo: 'h1',
          idPeriodo: ID_CONTADO_ANUAL_H1,
          importe: Math.max(0, Math.round(baseAnual / 2)),
          etiqueta: 'CONTADO ANUAL (1ª mitad)'
        };
      }
    }

    // Normal:
    // - 0 o 2 checks => FULL
    // - 1 check => mitad correspondiente
    const halfSelectedCount = (anualH1 ? 1 : 0) + (anualH2 ? 1 : 0);
    if (halfSelectedCount === 0 || halfSelectedCount === 2) {
      return {
        tipo: 'full',
        idPeriodo: ID_CONTADO_ANUAL,
        importe: baseAnual,
        etiqueta: 'CONTADO ANUAL'
      };
    }
    if (anualH1) {
      return {
        tipo: 'h1',
        idPeriodo: ID_CONTADO_ANUAL_H1,
        importe: Math.max(0, Math.round(baseAnual / 2)),
        etiqueta: 'CONTADO ANUAL (1ª mitad)'
      };
    }
    return {
      tipo: 'h2',
      idPeriodo: ID_CONTADO_ANUAL_H2,
      importe: Math.max(0, Math.round(baseAnual / 2)),
      etiqueta: 'CONTADO ANUAL (2ª mitad)'
    };
  }, [
    anualSeleccionado,
    anualH1,
    anualH2,
    anualManualActivo,
    montoAnualManual,
    montoAnualConDescuento,
    estadoAnualH1,
    estadoAnualH2,
    estadoAnualFull
  ]);

  // ✅ rangos de meses que cubre el contado anual (según tu regla)
  const RANGO_H1 = useMemo(() => new Set([3, 4, 5, 6, 7]), []);
  const RANGO_H2 = useMemo(() => new Set([8, 9, 10, 11, 12]), []);

  // ✅ meses bloqueados por anual (por registros existentes y/o por selección actual)
  const mesesBloqueadosPorAnual = useMemo(() => {
    const blocked = new Set();

    // Si existe anual FULL registrado -> bloquea Mar–Dic
    if (estadoAnualFull) {
      for (const m of RANGO_H1) blocked.add(m);
      for (const m of RANGO_H2) blocked.add(m);
      return blocked;
    }

    // Si existe mitad registrada -> bloquea su rango
    if (estadoAnualH1) for (const m of RANGO_H1) blocked.add(m);
    if (estadoAnualH2) for (const m of RANGO_H2) blocked.add(m);

    // Si en ESTA operación se está registrando anual, también bloquea lo que corresponda
    if (anualSeleccionado) {
      if (anualConfig?.tipo === 'full') {
        for (const m of RANGO_H1) blocked.add(m);
        for (const m of RANGO_H2) blocked.add(m);
      } else if (anualConfig?.tipo === 'h1') {
        for (const m of RANGO_H1) blocked.add(m);
      } else if (anualConfig?.tipo === 'h2') {
        for (const m of RANGO_H2) blocked.add(m);
      }
    }

    return blocked;
  }, [estadoAnualFull, estadoAnualH1, estadoAnualH2, anualSeleccionado, anualConfig?.tipo, RANGO_H1, RANGO_H2]);

  const isMesBloqueado = (idMes) => mesesBloqueadosPorAnual.has(Number(idMes));

  // ====== Monto de matrícula a usar (manual o global) ======
  const montoMatriculaFinal = useMemo(() => {
    if (matriculaManualActiva) {
      return Math.max(0, Math.round(Number(montoMatriculaManual) || 0));
    }
    return Math.max(0, Math.round(Number(montoMatricula) || 0));
  }, [matriculaManualActiva, montoMatriculaManual, montoMatricula]);

  // Orden de meses
  const periodosMesesOrdenados = useMemo(
    () => [...seleccionados].map(Number).sort((a, b) => a - b),
    [seleccionados]
  );

  // Totales por PERSONA
  const totalMeses = useMemo(
    () => (condonar ? 0 : periodosMesesOrdenados.length * precioMensualConDescuento),
    [condonar, periodosMesesOrdenados.length, precioMensualConDescuento]
  );
  const totalExtras = useMemo(() => {
    const anualImp = anualSeleccionado ? Number(anualConfig.importe || 0) : 0;
    const matri = matriculaSeleccionada ? Number(montoMatriculaFinal || 0) : 0;
    return anualImp + matri;
  }, [anualSeleccionado, anualConfig.importe, matriculaSeleccionada, montoMatriculaFinal]);
  const total = totalMeses + totalExtras; // POR persona

  const periodoTextoFinal = useMemo(() => {
    if (anualSeleccionado && anualConfig?.etiqueta) {
      const base = anualConfig.etiqueta;
      const partes = [base];
      if (matriculaSeleccionada) partes.push('MATRÍCULA');
      if (periodosMesesOrdenados.length > 0) {
        const mapById = new Map(meses.map(m => [Number(m.id), String(m.nombre).trim()]));
        const nombresMeses = periodosMesesOrdenados.map(id => mapById.get(Number(id)) || String(id));
        partes.push(...nombresMeses);
      }
      const suf = partes.join(' / ');
      return `${suf} ${anioTrabajo}`;
    }

    const mapById = new Map(meses.map(m => [Number(m.id), String(m.nombre).trim()]));
    const ids = [
      ...periodosMesesOrdenados,
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];
    if (ids.length === 0) return '';
    const nombres = ids.map(id => mapById.get(Number(id)) || String(id));
    return `${nombres.join(' / ')} ${anioTrabajo}`;
  }, [meses, periodosMesesOrdenados, anualSeleccionado, anualConfig?.etiqueta, matriculaSeleccionada, anioTrabajo]);

  /* ===== Orden de miembros para UI ===== */
  const miembrosOrdenados = useMemo(() => {
    const arr = Array.isArray(familiaInfo.miembros) ? [...familiaInfo.miembros] : [];
    return arr.sort((a, b) => {
      const isAActual = a.id_alumno === idAlumno ? -1 : 0;
      const isBActual = b.id_alumno === idAlumno ? -1 : 0;
      if (isAActual !== isBActual) return isAActual - isBActual;
      if ((b.activo ? 1 : 0) !== (a.activo ? 1 : 0)) return (b.activo ? 1 : 0) - (a.activo ? 1 : 0);
      const na = `${a.apellido ?? ''} ${a.nombre ?? ''}`.trim().toLowerCase();
      const nb = `${b.apellido ?? ''} ${b.nombre ?? ''}`.trim().toLowerCase();
      return na.localeCompare(nb);
    });
  }, [familiaInfo.miembros, idAlumno]);

  // ✅ si por anual se bloquean meses, y estaban seleccionados, los sacamos
  useEffect(() => {
    if (!seleccionados.length) return;
    const next = seleccionados.filter((id) => !isMesBloqueado(id));
    if (next.length !== seleccionados.length) setSeleccionados(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesBloqueadosPorAnual]);

  // ===== Validación para habilitar el botón de confirmar pago =====
  const puedeConfirmarPago = useMemo(() => {
    const tienePeriodosSeleccionados =
      seleccionados.length > 0 || anualSeleccionado || matriculaSeleccionada;

    const tieneMedioPagoSeleccionado = !!medioSeleccionado;

    return tienePeriodosSeleccionados && tieneMedioPagoSeleccionado && !cargando;
  }, [seleccionados.length, anualSeleccionado, matriculaSeleccionada, medioSeleccionado, cargando]);

  /* ================= Efectos ================= */

  // Cargar precio mensual / categoría / monto anual
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setNombreCategoria('');
          setMontoAnual(0);
          return;
        }
        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const montoMensual = Number(
            data?.monto_mensual ?? data?.monto ?? data?.precio ?? data?.Precio_Categoria ?? 0
          );
          const nombre = (data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? '').toString();
          const anual = Number(data?.monto_anual ?? 0);

          setPrecioMensual(Number.isFinite(montoMensual) ? montoMensual : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : '');
          setMontoAnual(Number.isFinite(anual) ? anual : 0);
          if (Number.isFinite(data?.monto_matricula)) {
            setMontoMatricula(Number(data.monto_matricula));
          }
        } else {
          setPrecioMensual(0);
          setNombreCategoria('');
          setMontoAnual(0);
          if (data?.mensaje) mostrarToast('advertencia', data.mensaje);
        }
      } catch (e) {
        console.error('Error al obtener monto por categoría del alumno:', e);
        setPrecioMensual(0);
        setNombreCategoria('');
        setMontoAnual(0);
        mostrarToast('error', 'No se pudo obtener el monto de la categoría del alumno.');
      }
    };
    cargarMontoCategoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // Cargar monto de matrícula (fallback)
  useEffect(() => {
    const cargarMatricula = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=obtener_monto_matricula`);
        if (!res.ok) throw new Error(`obtener_monto_matricula HTTP ${res.status}`);
        const data = await res.json();
        if (data?.exito) {
          const v = Number(data.monto);
          setMontoMatricula(Number.isFinite(v) ? v : 0);
        }
      } catch (e) {
        console.warn('cargarMatricula() fallback', e);
      }
    };
    if (montoMatricula === 15000) cargarMatricula();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // Cargar info de familia + miembros
  useEffect(() => {
    const cargarFamilia = async () => {
      try {
        if (!idAlumno) return;
        const url = `${BASE_URL}/api.php?action=obtener_info_familia&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`obtener_info_familia HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const info = {
            tieneFamilia: !!data.tiene_familia,
            id_familia: data.id_familia ?? null,
            nombre_familia: data.nombre_familia ?? '',
            miembros_total: Number(data.miembros_total || 0),
            miembros_activos: Number(data.miembros_activos || 0),
            miembros: Array.isArray(data.miembros) ? data.miembros : []
          };
          setFamiliaInfo(info);
          const activos = (info.miembros || []).filter(m => m.activo);
          setAplicarFamilia(info.tieneFamilia && activos.length > 0);
        } else {
          setFamiliaInfo({
            tieneFamilia: false,
            id_familia: null,
            nombre_familia: '',
            miembros_total: 0,
            miembros_activos: 0,
            miembros: []
          });
          setAplicarFamilia(false);
        }
      } catch (e) {
        console.error('cargarFamilia()', e);
        setFamiliaInfo({
          tieneFamilia: false,
          id_familia: null,
          nombre_familia: '',
          miembros_total: 0,
          miembros_activos: 0,
          miembros: []
        });
        setAplicarFamilia(false);
      }
    };
    cargarFamilia();
  }, [idAlumno]);

  // ✅ al cambiar alumno NO borrar medio de pago “porque sí”.
  const prevIdAlumnoKey = useMemo(() => String(idAlumno ?? ''), [idAlumno]);
  useEffect(() => {
    setSeleccionados([]);
    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setMatriculaSeleccionada(false);
    setModoActivo('meses');
    setAnualEditando(false);
    setAnualManualActivo(false);
    setMontoAnualManual('');
    setMatriculaManualActiva(false);
    setMontoMatriculaManual('');
    setEditandoMatriculaManual(false);
    // ⚠️ NO tocamos medioSeleccionado acá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevIdAlumnoKey]);

  // Sincronizar modoActivo con estados (permite combinaciones)
  useEffect(() => {
    if (anualSeleccionado && matriculaSeleccionada) {
      setModoActivo('combinado');
    } else if (anualSeleccionado) {
      setModoActivo('anual');
    } else if (matriculaSeleccionada) {
      setModoActivo('matricula');
    } else if (seleccionados.length > 0) {
      setModoActivo('meses');
    } else {
      setModoActivo('meses');
    }
  }, [anualSeleccionado, matriculaSeleccionada, seleccionados.length]);

  // Actualizar "Seleccionar todos"
  useEffect(() => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (id < 1 || id > 12) return false;
        if (periodosEstado[id]) return false;
        if (periodosPagados.includes(Number(id))) return false;
        if (isMesBloqueado(id)) return false;
        return true;
      });

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionados, mesesGrid, periodosPagados, periodosEstado, mesesBloqueadosPorAnual]);

  // Cargar meses/estado + medios de pago
  useEffect(() => {
    const cargar = async () => {
      if (!idAlumno) {
        console.error('ModalPagos: idAlumno inválido ->', idAlumno, socio);
        mostrarToast('error', 'No se recibió el ID del alumno.');
        return;
      }
      setCargando(true);
      try {
        const urlListas  = `${BASE_URL}/api.php?action=obtener_listas`;
        const urlPagados = `${BASE_URL}/api.php?action=meses_pagados&id_alumno=${encodeURIComponent(idAlumno)}&anio=${encodeURIComponent(anioTrabajo)}`;

        const [resListas, resPagados] = await Promise.all([
          fetch(urlListas, { method: 'GET' }),
          fetch(urlPagados, { method: 'GET' }),
        ]);

        if (!resListas.ok) throw new Error(`obtener_listas HTTP ${resListas.status}`);
        if (!resPagados.ok) throw new Error(`meses_pagados HTTP ${resPagados.status}`);

        const [dataListas, dataPagados] = await Promise.all([resListas.json(), resPagados.json()]);

        if (dataListas?.exito) {
          // MESES
          const arrMeses = Array.isArray(dataListas?.listas?.meses) ? dataListas.listas.meses : [];
          const norm = arrMeses
            .map((m) => ({ id: Number(m.id), nombre: m.nombre }))
            .sort((a, b) => a.id - b.id);
          setMeses(norm);

          // MEDIOS DE PAGO (sin autoseleccionar)
          const arrMedios = Array.isArray(dataListas?.listas?.medios_pago) ? dataListas.listas.medios_pago : [];
          const med = arrMedios
            .map(m => ({ id: Number(m.id), nombre: String(m.nombre) }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          setMediosPago(med);

          // Si el valor actual ya no existe en la lista, resetear a ""
          setMedioSeleccionado(prev => (
            med.some(m => String(m.id) === String(prev)) ? prev : ''
          ));
        } else {
          setMeses([]);
          setMediosPago([]);
          setMedioSeleccionado('');
          mostrarToast('advertencia', dataListas?.mensaje || 'No se pudieron cargar las listas.');
        }

        if (dataPagados?.exito) {
          let detalles = [];
          if (Array.isArray(dataPagados?.detalles)) detalles = dataPagados.detalles;
          else if (Array.isArray(dataPagados?.items)) detalles = dataPagados.items;
          else if (Array.isArray(dataPagados?.rows)) detalles = dataPagados.rows;
          else if (Array.isArray(dataPagados?.data)) detalles = dataPagados.data;

          const mapEstado = {};
          for (const d of detalles) {
            const id = Number(d?.id_mes ?? d?.id ?? d?.mes ?? d?.periodo);
            if (!id) continue;
            const est = String(d?.estado ?? '').toLowerCase(); // 'pagado' | 'condonado'
            if (est) mapEstado[id] = est;
          }
          setPeriodosEstado(mapEstado);

          let ids = Object.keys(mapEstado).map(Number);
          if (ids.length === 0) {
            const arrIds = Array.isArray(dataPagados.meses_pagados)
              ? dataPagados.meses_pagados
              : (Array.isArray(dataPagados.periodos_pagados) ? dataPagados.periodos_pagados : []);
            ids = arrIds.map(Number);
          }
          setPeriodosPagados(ids);

          setFechaIngreso(dataPagados.ingreso || '');
        } else {
          setPeriodosEstado({});
          setPeriodosPagados([]);
          mostrarToast('advertencia', dataPagados?.mensaje || 'No se pudo cargar el estado de pagos.');
        }
      } catch (e) {
        console.error('ModalPagos cargar() error:', e);
        mostrarToast('error', String(e.message || e));
      } finally {
        setCargando(false);
      }
    };

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno, anioTrabajo]);

  /* ================= Acciones ================= */

  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (idNum < 1 || idNum > 12) return;

    // ✅ si el mes está cubierto por anual (full/mitad), no se permite
    if (isMesBloqueado(idNum)) return;

    if (periodosEstado[idNum] || periodosPagados.includes(idNum)) return;

    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (id < 1 || id > 12) return false;
        if (periodosEstado[id]) return false;
        if (periodosPagados.includes(id)) return false;
        if (isMesBloqueado(id)) return false;
        return true;
      });

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const toggleAnual = (checked) => {
    if (checked) {
      // Autoselección inteligente:
      if (estadoAnualH1 && !estadoAnualH2) {
        setAnualH1(false);
        setAnualH2(true);
      } else if (!estadoAnualH1 && estadoAnualH2) {
        setAnualH1(true);
        setAnualH2(false);
      } else {
        setAnualH1(false);
        setAnualH2(false);
      }
      setAnualSeleccionado(true);
    } else {
      setAnualSeleccionado(false);
      setAnualH1(false);
      setAnualH2(false);
    }
  };

  const toggleMatricula = (checked) => {
    setMatriculaSeleccionada(checked);
  };

  const onToggleCondonar = (checked) => {
    setCondonar(checked);
    if (checked) {
      setLibreActivo(false);
      setLibreValor('');
    }
  };

  const onToggleLibre = (checked) => {
    setLibreActivo(checked);
    if (!checked) setLibreValor('');
    if (checked) setCondonar(false);
  };

  const handleLibreChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setLibreValor('');
      return;
    }
    let n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (n < 0) n = 0;
    setLibreValor(String(n));
  };

  // Guardar matrícula (persistente)
  const guardarMatricula = async () => {
    try {
      setGuardandoMatricula(true);
      const monto = Math.max(0, Math.round(Number(montoMatricula) || 0));
      const res = await fetch(`${BASE_URL}/api.php?action=actualizar_monto_matricula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto })
      });
      if (!res.ok) throw new Error(`actualizar_monto_matricula HTTP ${res.status}`);
      const data = await res.json();
      if (data?.exito) {
        setMontoMatricula(monto);
        setMatriculaEditando(false);
        mostrarToast('exito', 'Matrícula global actualizada.');
      } else {
        mostrarToast('error', data?.mensaje || 'No se pudo actualizar la matrícula global.');
      }
    } catch (e) {
      console.error('guardarMatricula()', e);
      mostrarToast('error', 'Error al guardar matrícula global.');
    } finally {
      setGuardandoMatricula(false);
    }
  };

  // Guardar matrícula manual (solo para esta operación)
  const guardarMatriculaManual = () => {
    let v = Math.max(0, Math.round(Number(montoMatriculaManual) || 0));
    if (!Number.isFinite(v)) v = 0;
    setMontoMatriculaManual(v);
    setMatriculaManualActiva(true);
    setEditandoMatriculaManual(false);
    mostrarToast('exito', 'Monto manual de matrícula guardado para este pago.');
  };

  const cancelarMatriculaManual = () => {
    setMatriculaManualActiva(false);
    setMontoMatriculaManual('');
    setEditandoMatriculaManual(false);
  };

  // ids de familia activos (excluye al actual para evitar duplicar)
  const idsFamiliaActivos = useMemo(() => {
    if (!familiaInfo?.tieneFamilia) return [];
    const activos = (familiaInfo.miembros || [])
      .filter(m => m.activo && m.id_alumno !== idAlumno)
      .map(m => Number(m.id_alumno))
      .filter(Boolean);
    return Array.from(new Set(activos));
  }, [familiaInfo, idAlumno]);

  const personasFamiliaActivas = useMemo(() => {
    if (!familiaInfo?.tieneFamilia) return [];
    const arr = (familiaInfo.miembros || []).filter(m => m.activo);
    return arr;
  }, [familiaInfo]);

  // construir SIEMPRE la misma lista base de personas a operar
  const listaParaOperar = useMemo(() => {
    const alumnoBaseMin = {
      id_alumno: Number(idAlumno),
      apellido_nombre: socio?.apellido_nombre || socio?.nombre || `#${idAlumno}`,
      categoria_nombre: nombreCategoria || ''
    };

    const lista = [alumnoBaseMin];

    if (aplicarFamilia && personasFamiliaActivas.length > 0) {
      const idsYa = new Set([Number(idAlumno)]);
      for (const m of personasFamiliaActivas) {
        const idm = Number(m.id_alumno);
        if (!m.activo) continue;
        if (!idm || idsYa.has(idm)) continue;
        lista.push({
          id_alumno: idm,
          apellido_nombre: `${m.apellido ?? ''} ${m.nombre ?? ''}`.trim() || `#${idm}`,
          categoria_nombre: nombreCategoria || ''
        });
        idsYa.add(idm);
      }
    }
    return lista;
  }, [aplicarFamilia, personasFamiliaActivas, idAlumno, socio?.apellido_nombre, socio?.nombre, nombreCategoria]);

  // totales de grupo para mostrar en UI
  const esPagoGrupo = aplicarFamilia && listaParaOperar.length > 1;
  const cantidadRegistrosLista = listaParaOperar.length;

  const totalParaMostrar = useMemo(() => {
    const totalPersona = Number(total) || 0;
    const n = esPagoGrupo ? cantidadRegistrosLista : 1;
    return roundToHundreds(totalPersona * n);
  }, [total, esPagoGrupo, cantidadRegistrosLista]);

  const etiquetaTotal = esPagoGrupo ? `Total grupo (${cantidadRegistrosLista})` : 'Total';

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');

    if (!medioSeleccionado) {
      return mostrarToast('error', 'Debés seleccionar un medio de pago antes de continuar.');
    }

    const periodosSeleccionados = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado ? [anualConfig.idPeriodo] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ].filter(Boolean);

    if (periodosSeleccionados.length === 0)
      return mostrarToast('advertencia', 'Seleccioná al menos un período (mes, anual o matrícula).');

    const montosPorPeriodo = {};
    for (const id of periodosMesesOrdenados) {
      montosPorPeriodo[id] = Math.round(condonar ? 0 : Number(precioMensualConDescuento || 0));
    }
    if (anualSeleccionado && anualConfig?.idPeriodo) {
      montosPorPeriodo[anualConfig.idPeriodo] = Math.round(Number(anualConfig.importe || 0));
    }
    if (matriculaSeleccionada) {
      montosPorPeriodo[ID_MATRICULA] = Math.round(Number(montoMatriculaFinal || 0));
    }

    setCargando(true);
    try {
      const payload = {
        id_alumno: Number(idAlumno),
        periodos: periodosSeleccionados,
        anio: Number(anioTrabajo),
        condonar: !!condonar,
        monto_unitario: Math.round(condonar ? 0 : Number(precioMensualConDescuento || 0)),
        montos_por_periodo: montosPorPeriodo,
        meta_descuento_hermanos: {
          familia: familyCount,
          categoria: nombreCategoria,
          porcentaje: porcDescHermanos
        },
        aplicar_a_familia: !!(aplicarFamilia && idsFamiliaActivos.length > 0),
        ids_familia: idsFamiliaActivos,
        id_medio_pago: Number(medioSeleccionado),
        meta_anual: anualSeleccionado ? {
          tipo: anualConfig.tipo,
          id_periodo: anualConfig.idPeriodo,
          importe: anualConfig.importe,
          manual: anualManualActivo ? 1 : 0
        } : null,
        meta_matricula: matriculaSeleccionada ? {
          manual: matriculaManualActiva ? 1 : 0,
          monto_manual: matriculaManualActiva ? Number(montoMatriculaFinal) : null,
          monto_global: !matriculaManualActiva ? Number(montoMatriculaFinal) : null
        } : null
      };

      if (libreActivo && !condonar) {
        payload.monto_libre = Math.round(Number(libreValor) || 0);
      }

      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`registrar_pago HTTP ${res.status}`);

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        setPagoExitoso(true);
        setPeriodosPagados(prev => {
          const set = new Set(prev);
          periodosMesesOrdenados.forEach(id => set.add(Number(id)));
          if (anualSeleccionado && anualConfig?.idPeriodo) set.add(anualConfig.idPeriodo);
          if (matriculaSeleccionada) set.add(ID_MATRICULA);
          return Array.from(set);
        });
      } else {
        if (Array.isArray(data?.ya_registrados) && data.ya_registrados.length > 0) {
          const txt = data.ya_registrados.map(x => `${x.periodo} (${(x.estado || '').toUpperCase()})`).join(', ');
          mostrarToast('advertencia', `Ya registrados: ${txt}`);
        } else {
          mostrarToast('error', data?.mensaje || 'No se pudo registrar.');
        }
      }
    } catch (e) {
      console.error('ModalPagos confirmarPago() error:', e);
      mostrarToast('error', String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  // helper para armar la lista completa (impresión/pdf)
  const buildListaCompleta = () => {
    const periodos = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado && anualConfig?.idPeriodo ? [anualConfig.idPeriodo] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];
    const periodoCodigo = periodos[0] || 0;

    const montosBase = {
      ...Object.fromEntries(periodosMesesOrdenados.map(id => [id, Math.round(condonar ? 0 : Number(precioMensualConDescuento || 0))])),
      ...(anualSeleccionado && anualConfig?.idPeriodo ? { [anualConfig.idPeriodo]: Math.round(Number(anualConfig.importe || 0)) } : {}),
      ...(matriculaSeleccionada ? { [ID_MATRICULA]: Math.round(Number(montoMatriculaFinal || 0)) } : {}),
    };

    const periodoTextoCustom = (anualSeleccionado && anualConfig?.etiqueta)
      ? `${anualConfig.etiqueta}${matriculaSeleccionada ? ' / MATRÍCULA' : ''}${periodosMesesOrdenados.length > 0 ? ' / ' + periodosMesesOrdenados.map(id => {
          const mapById = new Map(meses.map(m => [Number(m.id), String(m.nombre).trim()]));
          return mapById.get(Number(id)) || String(id);
        }).join(' / ') : ''} ${anioTrabajo}`
      : (
        (() => {
          const mapById = new Map(meses.map(m => [Number(m.id), String(m.nombre).trim()]));
          const names = [
            ...periodosMesesOrdenados.map(id => mapById.get(Number(id)) || String(id)),
            ...(matriculaSeleccionada ? ['MATRÍCULA'] : []),
          ];
          return names.length ? `${names.join(' / ')} ${anioTrabajo}` : '';
        })()
      );

    const lista = listaParaOperar.map(p => ({
      ...socio,
      id_alumno: Number(p.id_alumno),
      nombre: p.apellido_nombre,
      apellido_nombre: p.apellido_nombre,
      id_periodo: periodoCodigo,
      periodos,
      periodo_texto: periodoTextoCustom,
      precio_unitario: Math.round(condonar ? 0 : Number(precioMensualConDescuento || 0)),
      importe_total: total,
      precio_total: total,
      anio: anioTrabajo,
      categoria_nombre: libreActivo ? 'LIBRE' : (p.categoria_nombre || nombreCategoria || ''),
      montos_por_periodo: { ...montosBase },
      meta_descuento_hermanos: {
        familia: familyCount,
        categoria: nombreCategoria,
        porcentaje: porcDescHermanos
      },
      meta_matricula: matriculaSeleccionada ? {
        manual: matriculaManualActiva,
        monto_manual: matriculaManualActiva ? Number(montoMatriculaFinal) : null
      } : null
    }));

    return { lista, periodos, periodoCodigo, periodoTextoCustom };
  };

  const handleComprobante = async () => {
    const { lista, periodos, periodoCodigo, periodoTextoCustom } = buildListaCompleta();

    if (modoComprobante === 'pdf') {
      try {
        if (aplicarFamilia && lista.length > 1) {
          const nombres = lista.map(p => p.apellido_nombre || p.nombre || `#${p.id_alumno}`).join(' / ');
          const totalGrupo = roundToHundreds(
            lista.reduce((acc, p) => acc + (Number(p.precio_total) || 0), 0)
          );

          const combinado = {
            ...lista[0],
            id_alumno: lista[0].id_alumno,
            nombre: nombres,
            apellido_nombre: nombres,
            importe_total: totalGrupo,
            precio_total: totalGrupo,
            precio_unitario: 0,
            periodos,
            periodo_texto: periodoTextoCustom,
            montos_por_periodo: { ...lista[0].montos_por_periodo },
          };

          await generarComprobanteAlumnoPDF(combinado, {
            anio: combinado.anio,
            periodoId: combinado.id_periodo,
            periodoTexto: combinado.periodo_texto,
            importeTotal: totalGrupo,
            precioUnitario: 0,
            periodos: combinado.periodos,
          });
        } else {
          const p = lista[0];
          const totalRedondeado = roundToHundreds(Number(p.precio_total) || 0);
          const personaPDF = {
            ...p,
            precio_total: totalRedondeado,
            importe_total: totalRedondeado,
          };
          await generarComprobanteAlumnoPDF(personaPDF, {
            anio: personaPDF.anio,
            periodoId: personaPDF.id_periodo,
            periodoTexto: personaPDF.periodo_texto,
            importeTotal: totalRedondeado,
            precioUnitario: Number(personaPDF.precio_unitario) || 0,
            periodos: personaPDF.periodos,
          });
        }
      } catch (e) {
        console.error('Error al generar PDF:', e);
        mostrarToast('error', 'No se pudo generar el PDF.');
      }
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir los comprobantes.');

    const opciones = { anioPago: anioTrabajo };

    if (esExterno) {
      await imprimirRecibosExternosRotados(lista, periodoCodigo, win, opciones);
    } else {
      await imprimirRecibosRotado(lista, periodoCodigo, win, opciones);
    }
  };

  if (!socio) return null;

  const textoFamilia = familiaInfo.tieneFamilia
    ? `Fam: Sí (${Math.max(familiaInfo.miembros_total, familiaInfo.miembros_activos || 0)})`
    : 'Fam: No';

  /* ================= VISTA: ÉXITO ================= */
  if (pagoExitoso) {
    const tituloExito = condonar ? '¡Condonación registrada!' : '¡Pago registrado!';
    const subExito = condonar
      ? 'El período seleccionado quedó marcado como Condonado.'
      : 'Generá o imprimí los comprobantes cuando quieras.';

    const badgeDesc =
      !condonar && !libreActivo && porcDescHermanos > 0
        ? `Desc. hermanos: ${(porcDescHermanos * 100).toFixed(1)}%`
        : null;

    const etiquetaAnualResumen = (anualSeleccionado && anualConfig?.etiqueta)
      ? anualConfig.etiqueta
      : null;

    const medioNombre = mediosPago.find(m => String(m.id) === String(medioSeleccionado))?.nombre || '—';

    return (
      <>
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido success-elevated">
            <div className="modal-header success-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle success-icon">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">{tituloExito}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose?.(true)} disabled={cargando} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body success-body">
              <div className="success-panel success-panel--full">
                <div className="success-left success-left--full">
                  <div className="success-check">
                    <span className="checkmark-giant" aria-hidden="true">✓</span>
                  </div>
                  <div className="success-texts">
                    <h3 className="success-title">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                    <p className="success-sub">{subExito}</p>
                    <ul className="summary-list" aria-label="Resumen de pago">
                      <li><span>Familia</span><strong>{textoFamilia}</strong></li>
                      {badgeDesc && <li><span>Beneficio</span><strong>{badgeDesc}</strong></li>}
                      <li><span>Valor por mes</span><strong>{formatearARS(precioMensualConDescuento)}</strong></li>
                      <li><span>Meses</span><strong>{periodosMesesOrdenados.length}</strong></li>
                      {etiquetaAnualResumen && <li><span>Contado anual</span><strong>{etiquetaAnualResumen}</strong></li>}
                      {matriculaSeleccionada && (
                        <li>
                          <span>Matrícula</span>
                          <strong>
                            {formatearARS(montoMatriculaFinal)}
                            {matriculaManualActiva && ' (manual)'}
                          </strong>
                        </li>
                      )}
                      <li><span>Medio de pago</span><strong>{medioNombre}</strong></li>
                      <li><span>{etiquetaTotal}</span><strong>{formatearARS(totalParaMostrar)}</strong></li>
                      <li><span>Registros</span><strong>{cantidadRegistrosLista}</strong></li>
                      {periodoTextoFinal && (
                        <li className="full-row"><span>Período</span><strong>{periodoTextoFinal}</strong></li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="success-actions">
                <div className="segmented" role="tablist" aria-label="Modo de comprobante">
                  <button
                    role="tab"
                    aria-selected={modoComprobante === 'imprimir'}
                    className={`segmented-item ${modoComprobante === 'imprimir' ? 'active' : ''}`}
                    onClick={() => setModoComprobante('imprimir')}
                  >
                    Imprimir
                  </button>
                  <button
                    role="tab"
                    aria-selected={modoComprobante === 'pdf'}
                    className={`segmented-item ${modoComprobante === 'pdf' ? 'active' : ''}`}
                    onClick={() => setModoComprobante('pdf')}
                  >
                    PDF
                  </button>
                </div>
                <div className="hint">
                  {modoComprobante === 'pdf'
                    ? 'Generará un único PDF si pagó el grupo familiar.'
                    : 'Abrirá la vista de impresión con un comprobante por persona.'}
                </div>
              </div>
            </div>

            <div className="modal-footer success-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  {etiquetaTotal}: {formatearARS(totalParaMostrar)}
                </span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose?.(true)} type="button">
                  Listo
                </button>
                <button className="btn btn-danger" onClick={handleComprobante} type="button">
                  {modoComprobante === 'pdf' ? 'Descargar PDF' : 'Abrir impresión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ================= VISTA: NORMAL ================= */
  const badgeDescNow =
    !condonar && !libreActivo && porcDescHermanos > 0
      ? `Desc. hermanos: ${(porcDescHermanos * 100).toFixed(1)}%`
      : null;

  return (
    <>
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          {/* Header */}
          <div className="modal-header danger-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle">
                <FaCoins size={20} />
              </div>
              <h2 className="modal-title">Registro de Pagos / Condonar</h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose?.(false)} disabled={cargando} aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div className="socio-info-card socio-info-card--danger">
              <div className="socio-info-header">
                <div className='sep_header'>
                  <h3 className="socio-nombre">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                  <span className="valor-mes valor-mes--danger">
                    <strong>Valor mensual</strong>{' '}
                    {libreActivo ? '(LIBRE)' : (nombreCategoria ? `(${nombreCategoria})` : '')}: {formatearARS(precioMensualConDescuento)}
                  </span>
                </div>

                <div className='sep_headeric'>
                  {badgeDescNow && <span className="badge-info">{badgeDescNow}</span>}
                  <span
                    className="badge-info"
                    title={familiaInfo.nombre_familia ? `Familia: ${familiaInfo.nombre_familia}` : 'Sin familia'}
                  >
                    {familiaInfo.tieneFamilia ? `Fam: Sí (${Math.max(familiaInfo.miembros_total, familiaInfo.miembros_activos || 0)})` : 'Fam: No'}
                  </span>
                </div>

                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>

              {/* Toggle aplicar a familia */}
              {familiaInfo.tieneFamilia && (
                <div className='centrar-familia'>
                  <label className="condonar-check family-toggle">
                    <input
                      type="checkbox"
                      checked={aplicarFamilia}
                      onChange={(e)=> setAplicarFamilia(e.target.checked)}
                      disabled={cargando}
                    />
                    <span className="switch"><span className="switch-thumb" /></span>
                    <span className="switch-label"><strong>Aplicar pago al grupo familiar</strong></span>
                  </label>

                  <div className="family-dropdown">
                    <button
                      type="button"
                      className="btn btn-small btn-terciario"
                      aria-expanded={mostrarMiembros}
                      aria-controls="family-members-panel"
                      onClick={() => setMostrarMiembros((v) => !v)}
                    >
                      {mostrarMiembros ? 'Ocultar miembros' : 'Ver miembros'}
                    </button>

                    {mostrarMiembros && (
                      <div
                        id="family-members-panel"
                        className="family-members-panel"
                        role="region"
                        aria-label="Miembros del grupo familiar"
                      >
                        {miembrosOrdenados.length === 0 ? (
                          <div className="no-members">Sin integrantes cargados.</div>
                        ) : (
                          <ul className="members-list">
                            {miembrosOrdenados.map((m) => {
                              const esActual = m.id_alumno === idAlumno;
                              const etiqueta = `${m.apellido ?? ''} ${m.nombre ?? ''}`.trim() || `#${m.id_alumno}`;
                              return (
                                <li
                                  key={m.id_alumno}
                                  className={`member-item ${esActual ? 'current-member' : ''}`}
                                >
                                  <span className="member-name">
                                    {etiqueta}{esActual ? ' (actual)' : ''}
                                  </span>
                                  <span className={`chip ${m.activo ? 'chip-success' : 'chip-muted'}`}>
                                    {m.activo ? 'Activo' : 'Inactivo'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Condonar + Año */}
            <div className='condonarAño-montoLibre'>
              <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input
                    type="checkbox"
                    checked={condonar}
                    onChange={(e) => setCondonar(e.target.checked)}
                    disabled={cargando}
                  />
                  <span className="switch"><span className="switch-thumb" /></span>
                  <span className="switch-label">Marcar como <strong>Condonado</strong>(no genera cobro)</span>
                </label>

                <div className="year-picker">
                  <button
                    type="button"
                    className="year-button"
                    onClick={() => setShowYearPicker((s) => !s)}
                    disabled={cargando}
                    title="Cambiar año"
                  >
                    <FaCalendarAlt /><span>{anioTrabajo}</span>
                  </button>

                  {showYearPicker && (
                    <div className="year-popover" onMouseLeave={() => setShowYearPicker(false)}>
                      {yearOptions.map((y) => (
                        <button
                          key={y}
                          className={`year-item ${y === anioTrabajo ? 'active' : ''}`}
                          onClick={() => { setAnioTrabajo(y); setShowYearPicker(false); }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modo libre */}
              <div className={`condonar-box ${libreActivo ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input
                    type="checkbox"
                    checked={libreActivo}
                    onChange={(e) => onToggleLibre(e.target.checked)}
                    disabled={cargando}
                  />
                  <span className="switch"><span className="switch-thumb" /></span>
                  <span className="switch-label">Usar <strong>monto libre por mes</strong></span>
                </label>

                <div className="year-picker libre-input-container">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    inputMode="numeric"
                    placeholder="Ingresá el monto libre por mes"
                    value={libreValor}
                    onChange={handleLibreChange}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'Minus') e.preventDefault();
                    }}
                    disabled={!libreActivo || cargando}
                    className="libre-input"
                  />
                </div>
              </div>
            </div>

            {/* ===== EXTRAS: CONTADO ANUAL y MATRÍCULA ===== */}
            {ventanaAnualActiva && (
              <div className={`condonar-box ${anualSeleccionado ? 'is-active' : ''} ${bloqueadoAnual ? 'is-disabled' : ''}`}>
                <label className="condonar-check">
                  <input
                    type="checkbox"
                    checked={anualSeleccionado}
                    onChange={(e) => toggleAnual(e.target.checked)}
                    disabled={cargando || libreActivo || bloqueadoAnual}
                  />
                  <span className="switch"><span className="switch-thumb" /></span>

                  <div className='dis-newedit'>
                    <span className="switch-label">
                      <span className="sitch-labes">
                        <span className={`anual-text ${anualSeleccionado ? 'stack' : 'row'}`}>
                          <strong>CONTADO ANUAL</strong>
                          <span className="subline">
                            {(() => {
                              const base = anualManualActivo
                                ? Number(montoAnualManual || 0)
                                : Number(montoAnualConDescuento || 0);
                              const txtBase = formatearARS(Math.max(0, Math.round(base)));
                              if (anualManualActivo) return `(${txtBase} • monto manual)`;
                              return `(${txtBase}${(familyCount > 1 && porcDescHermanos > 0) ? ' con desc.' : ''})`;
                            })()}
                          </span>
                        </span>
                      </span>
                    </span>

                    {!bloqueadoAnual && !anualEditando && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title="Editar monto anual"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAnualSeleccionado(true);
                            setAnualEditando(true);
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          <FaPen />
                        </button>
                        {anualManualActivo && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Quitar monto manual"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAnualManualActivo(false);
                              setMontoAnualManual('');
                              setAnualSeleccionado(true);
                            }}
                            style={{ marginLeft: 6 }}
                          >
                            <FaTimes />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </label>

                {anualSeleccionado && !bloqueadoAnual && (
                  <>
                    {anualEditando && (
                      <div className="edit-inline matricula-edit" id='btn-editmatricula'>
                        <input
                          id='input-editmetricula'
                          type="number"
                          min="0"
                          step="500"
                          inputMode="numeric"
                          value={montoAnualManual}
                          onChange={(e)=> setMontoAnualManual(e.target.value)}
                          className="matricula-input"
                        />
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let v = Math.max(0, Math.round(Number(montoAnualManual) || 0));
                            if (!Number.isFinite(v)) v = 0;
                            setMontoAnualManual(v);
                            setAnualManualActivo(true);
                            setAnualEditando(false);
                            setAnualSeleccionado(true);
                          }}
                          title="Guardar monto anual"
                          aria-label="Guardar monto anual"
                        >
                          <FaCheck />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAnualEditando(false);
                            setAnualSeleccionado(true);
                          }}
                          title="Cancelar edición"
                          aria-label="Cancelar edición"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    )}

                    <div className="edit-inline anual-mitades">
                      <label className={`condonar-check ${estadoAnualH1 ? 'is-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={anualH1}
                          onChange={(e) => setAnualH1(e.target.checked)}
                          disabled={cargando || !!estadoAnualH1}
                        />
                        <span className="switch"><span className="switch-thumb" /></span>
                        <span className="switch-label">
                          <strong>1ª mitad</strong> (Mar–Jul)
                          {estadoAnualH1 && (
                            <span className={`chip ${estadoAnualH1 === 'condonado' ? 'chip-muted' : 'chip-success'}`} style={{marginLeft:6}}>
                              {capitalizar(estadoAnualH1)}
                            </span>
                          )}
                        </span>
                      </label>

                      <label className={`condonar-check ${estadoAnualH2 ? 'is-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={anualH2}
                          onChange={(e) => setAnualH2(e.target.checked)}
                          disabled={cargando || !!estadoAnualH2}
                        />
                        <span className="switch"><span className="switch-thumb" /></span>
                        <span className="switch-label">
                          <strong>2ª mitad</strong> (Ago–Dic)
                          {estadoAnualH2 && (
                            <span className={`chip ${estadoAnualH2 === 'condonado' ? 'chip-muted' : 'chip-success'}`} style={{marginLeft:6}}>
                              {capitalizar(estadoAnualH2)}
                            </span>
                          )}
                        </span>
                      </label>

                      <div className="anual-mitades-info">
                        <span className="anual-mitades-importe">
                          Importe: {formatearARS(Math.round(anualConfig?.importe || 0))}
                        </span>

                        <button type="button" className="info-icon" aria-label="Ver información sobre mitades">
                          <FaInfoCircle aria-hidden="true" />
                          <span className="tip" role="tooltip">
                            Si no se eligen mitades, se considera todo el año. Si ya hay una mitad pagada, se selecciona automáticamente la restante.
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {bloqueadoAnual && (
                  <div className="hint" style={{marginTop:8}}>
                    Ya existe un registro de contado anual completo (o ambas mitades) para este año.
                  </div>
                )}
              </div>
            )}

            {/* ===== MATRÍCULA + Medio de pago inline ===== */}
            <div className={`condonar-box matricula-box ${matriculaSeleccionada ? 'is-active' : ''} ${bloqueadoMatricula ? 'is-disabled' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={matriculaSeleccionada}
                  onChange={(e) => toggleMatricula(e.target.checked)}
                  disabled={cargando || bloqueadoMatricula}
                />
                <span className="switch"><span className="switch-thumb" /></span>
                <span className="switch-label matricula-label">
                  <strong>MATRÍCULA</strong>

                  {/* Mostrar estado pagado/condonado si existe */}
                  {bloqueadoMatricula && (
                    <span className={`chip ${estadoMatricula === 'condonado' ? 'chip-muted' : 'chip-success'}`} style={{marginLeft:6}}>
                      {capitalizar(estadoMatricula)}
                    </span>
                  )}

                  {!bloqueadoMatricula && !matriculaEditando && !editandoMatriculaManual && (
                    <>
                      <span className="matricula-monto">
                        {formatearARS(montoMatriculaFinal)}
                        {matriculaManualActiva && ' (manual)'}
                      </span>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Editar monto global"
                        onMouseDown={(e)=> e.preventDefault()}
                        onClick={(e)=> { e.preventDefault(); e.stopPropagation(); setMatriculaEditando(true); }}
                      >
                        <FaSave />
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Ingresar monto manual"
                        onMouseDown={(e)=> e.preventDefault()}
                        onClick={(e)=> { e.preventDefault(); e.stopPropagation(); setEditandoMatriculaManual(true); }}
                      >
                        <FaPen />
                      </button>

                      {matriculaManualActiva && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          title="Quitar monto manual"
                          onMouseDown={(e)=> e.preventDefault()}
                          onClick={(e)=> { e.preventDefault(); e.stopPropagation(); cancelarMatriculaManual(); }}
                        >
                          <FaTimes />
                        </button>
                      )}
                    </>
                  )}
                </span>
              </label>

              {!bloqueadoMatricula && (
                <>
                  {matriculaEditando && (
                    <div className="edit-inline matricula-edit">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        inputMode="numeric"
                        value={montoMatricula}
                        onChange={(e)=> setMontoMatricula(Number(e.target.value || 0))}
                        className="matricula-input"
                        disabled={guardandoMatricula}
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={guardarMatricula}
                        disabled={guardandoMatricula}
                        title="Guardar matrícula global"
                        aria-label="Guardar matrícula global"
                      >
                        {guardandoMatricula ? '…' : <FaCheck />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setMatriculaEditando(false)}
                        disabled={guardandoMatricula}
                        title="Cancelar edición global"
                        aria-label="Cancelar edición global"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  )}

                  {editandoMatriculaManual && (
                    <div className="edit-inline matricula-edit">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        inputMode="numeric"
                        value={montoMatriculaManual}
                        onChange={(e)=> setMontoMatriculaManual(e.target.value)}
                        className="matricula-input"
                        placeholder="Ingresá monto manual"
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={guardarMatriculaManual}
                        title="Guardar monto manual"
                        aria-label="Guardar monto manual"
                      >
                        <FaCheck />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditandoMatriculaManual(false)}
                        title="Cancelar monto manual"
                        aria-label="Cancelar monto manual"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Medio de pago inline */}
              <div className="medio-pago-inline">
                <label className="medio-pago-inline-label" htmlFor="medio-pago-select">Medio de pago *</label>
                <div className="medio-pago-input">
                  <select
                    id="medio-pago-select"
                    className="medio-pago-select"
                    value={medioSeleccionado || ""}
                    onChange={(e) => setMedioSeleccionado(e.target.value)}
                    disabled={cargando}
                    required
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {mediosPago.length === 0 && <option value="">(Sin datos)</option>}
                    {mediosPago.map((mp) => (
                      <option key={mp.id} value={String(mp.id)}>{mp.nombre}</option>
                    ))}
                  </select>
                  {!medioSeleccionado && (
                    <div className="hint" style={{marginTop:4, color:'var(--danger)'}}>
                      * Campo obligatorio para registrar el pago
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selección de meses */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || mesesGrid.length === 0}
                    type="button"
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({seleccionados.length})
                  </button>
                </div>
              </div>

              {cargando && mesesGrid.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando meses...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {mesesGrid.map((m) => {
                      const idMes = Number(m.id);
                      const estado = periodosEstado[idMes];

                      const bloqueadoPorAnual = isMesBloqueado(idMes);
                      const yaOcupado = !!estado || periodosPagados.includes(idMes) || bloqueadoPorAnual;

                      const sel = seleccionados.includes(idMes);

                      const statusTxt = estado
                        ? capitalizar(estado)
                        : (periodosPagados.includes(idMes) ? 'Pagado' : (bloqueadoPorAnual ? 'Cubierto por anual' : ''));

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaOcupado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (cargando) return;
                            togglePeriodo(idMes);
                          }}
                          onKeyDown={(e) => {
                            if (cargando) return;
                            if ((e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              togglePeriodo(idMes);
                            }
                          }}
                        >
                          <div className="periodo-checkbox" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              id={`periodo-${idMes}`}
                              checked={sel}
                              onChange={() => togglePeriodo(idMes)}
                              disabled={cargando || yaOcupado}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label
                            htmlFor={`periodo-${idMes}`}
                            className="periodo-label"
                            onClick={(e) => e.preventDefault()}
                          >
                            {m.nombre}
                            {yaOcupado && (
                              <span className="periodo-status">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {statusTxt}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <div className="footer-left">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                {etiquetaTotal}: {formatearARS(totalParaMostrar)}
              </span>
              {!medioSeleccionado && (
                <span className="total-badge total-badge-warning" style={{marginLeft:8}}>
                  Medio de pago requerido
                </span>
              )}
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose?.(false)} disabled={cargando} type="button">
                Cancelar
              </button>
              <button
                className={`btn ${condonar ? 'btn-warning' : 'btn-danger'}`}
                onClick={confirmarPago}
                disabled={!puedeConfirmarPago}
                type="button"
              >
                {cargando ? (<><span className="spinner-btn"></span> Procesando...</>) : (condonar ? 'Condonar' : 'Confirmar Pago')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;