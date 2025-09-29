// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt, FaPen, FaCheck, FaTimes, FaInfoCircle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

// Utils impresión
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';
import { imprimirRecibosExternos } from '../../../utils/imprimirRecibosExternos.jsx';
import { generarComprobanteAlumnoPDF } from '../../../utils/ComprobanteExternoPDF.jsx';

/* ====== Constantes ====== */
const MIN_YEAR = 2025;
const ID_CONTADO_ANUAL = 13;
const ID_MATRICULA = 14;
// NUEVOS: Mitades de contado anual
const ID_CONTADO_ANUAL_H1 = 15; // Ene–Jul
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

/* ============================================================
   DESCUENTOS ANUALES
   - EXTERNO: totales anuales por grupo (2: 70000, 3: 80000)
   - INTERNO: usar % de hermanos derivado (sobre el anual base de la DB)
   ============================================================ */
const ANUAL_REFERENCIAS = {
  EXTERNO: { totals: { 2: 70000, 3: 80000 } },
};

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

  // ===== Modo libre =====
  const [libreActivo, setLibreActivo] = useState(false);
  const [libreValor, setLibreValor] = useState('');

  // ===== Estado para controlar modo activo =====
  const [modoActivo, setModoActivo] = useState('meses'); // 'meses' | 'anual' | 'matricula'

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

  // NUEVO: aplicar a grupo familiar
  const [aplicarFamilia, setAplicarFamilia] = useState(false);

  // NUEVOS: mitades de anual
  const [anualH1, setAnualH1] = useState(false); // Ene–Jul
  const [anualH2, setAnualH2] = useState(false); // Ago–Dic

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

  // ====== ANUAL con descuento ======
  const montoAnualConDescuento = useMemo(() => {
    if (condonar) return 0;
    const base = Number(montoAnual || 0);
    if (!base) return 0;

    const N = Math.max(1, Number(familyCount) || 1);

    if (esExterno && N > 1 && ANUAL_REFERENCIAS?.EXTERNO?.totals) {
      const totals = ANUAL_REFERENCIAS.EXTERNO.totals;
      let Nref = totals[N] ? N : undefined;
      if (!Nref && N >= 3 && totals[3]) Nref = 3;
      if (!Nref && totals[2]) Nref = 2;

      if (Nref) {
        const totalGrupoRef = Number(totals[Nref] || 0);
        if (totalGrupoRef > 0) {
          const perCapita = Math.round(totalGrupoRef / Nref);
          return Math.max(0, perCapita);
        }
      }
    }

    const porc = Number(porcDescHermanos || 0);
    return Math.max(0, Math.round(esExterno ? base * (1 - porc) : base));
  }, [condonar, montoAnual, familyCount, esExterno, porcDescHermanos]);

  // ====== NUEVO: cálculo de anual considerando mitades ======
  const anualConfig = useMemo(() => {
    // Devuelve { tipo: 'full'|'h1'|'h2', idPeriodo, importe, etiqueta }
    if (!anualSeleccionado) return { tipo: null, idPeriodo: null, importe: 0, etiqueta: '' };

    // Si marcó ambas mitades o ninguna => FULL
    const halfSelectedCount = (anualH1 ? 1 : 0) + (anualH2 ? 1 : 0);
    if (halfSelectedCount === 0 || halfSelectedCount === 2) {
      return {
        tipo: 'full',
        idPeriodo: ID_CONTADO_ANUAL,
        importe: Math.max(0, Math.round(montoAnualConDescuento || 0)),
        etiqueta: 'CONTADO ANUAL'
      };
    }
    if (anualH1) {
      return {
        tipo: 'h1',
        idPeriodo: ID_CONTADO_ANUAL_H1,
        importe: Math.max(0, Math.round((montoAnualConDescuento || 0) / 2)),
        etiqueta: 'CONTADO ANUAL (1ª mitad)'
      };
    }
    // anualH2
    return {
      tipo: 'h2',
      idPeriodo: ID_CONTADO_ANUAL_H2,
      importe: Math.max(0, Math.round((montoAnualConDescuento || 0) / 2)),
      etiqueta: 'CONTADO ANUAL (2ª mitad)'
    };
  }, [anualSeleccionado, anualH1, anualH2, montoAnualConDescuento]);

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
    const matri = matriculaSeleccionada ? Number(montoMatricula || 0) : 0;
    return anualImp + matri;
  }, [anualSeleccionado, anualConfig.importe, matriculaSeleccionada, montoMatricula]);
  const total = totalMeses + totalExtras; // POR persona

  const periodoTextoFinal = useMemo(() => {
    // Si es anual, priorizar etiqueta especial
    if (anualSeleccionado && anualConfig?.etiqueta) {
      const base = anualConfig.etiqueta;
      const partes = [base];
      if (matriculaSeleccionada) partes.push('MATRÍCULA');
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
  }, [idAlumno, BASE_URL]);

  // Limpiar selección al cambiar alumno o año
  useEffect(() => {
    setSeleccionados([]);
    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setMatriculaSeleccionada(false);
    setModoActivo('meses');
  }, [idAlumno, anioTrabajo]);

  // Sincronizar modoActivo con estados (prioridad: anual > meses > matricula)
  useEffect(() => {
    if (anualSeleccionado) {
      setModoActivo('anual');
    } else if (seleccionados.length > 0) {
      setModoActivo('meses');
    } else if (matriculaSeleccionada) {
      setModoActivo('matricula');
    } else {
      setModoActivo('meses');
    }
  }, [anualSeleccionado, matriculaSeleccionada, seleccionados.length]);

  // Actualizar "Seleccionar todos"
  useEffect(() => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (periodosEstado[id]) return false;
        return !periodosPagados.includes(Number(id));
      });

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
  }, [seleccionados, mesesGrid, periodosPagados, periodosEstado]);

  // Cargar meses/estado
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
          const arrMeses = Array.isArray(dataListas?.listas?.meses) ? dataListas.listas.meses : [];
          const norm = arrMeses
            .map((m) => ({ id: Number(m.id), nombre: m.nombre }))
            .sort((a, b) => a.id - b.id);
          setMeses(norm);
        } else {
          setMeses([]);
          mostrarToast('advertencia', dataListas?.mensaje || 'No se pudieron cargar los meses.');
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

  /* ================= Helpers de exclusión de modos ================= */
  const activarSoloMeses = () => {
    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setModoActivo('meses');
  };

  const activarSoloAnual = () => {
    setSeleccionados([]);
    setMatriculaSeleccionada(false);
    setLibreActivo(false);
    setLibreValor('');
    setModoActivo('anual');
  };

  const activarSoloMatricula = () => {
    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setModoActivo('matricula');
  };

  /* ================= Acciones ================= */

  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (idNum < 1 || idNum > 12) return;
    if (periodosEstado[idNum] || periodosPagados.includes(idNum)) return;

    setAnualSeleccionado(false);
    setAnualH1(false);
    setAnualH2(false);
    setModoActivo('meses');

    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    activarSoloMeses();

    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => !periodosEstado[id] && !periodosPagados.includes(id));

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const toggleAnual = (checked) => {
    if (checked) {
      activarSoloAnual();
      setAnualSeleccionado(true);
      // Por defecto: sin mitades marcadas => toma "full"
      setAnualH1(false);
      setAnualH2(false);
    } else {
      setAnualSeleccionado(false);
      setAnualH1(false);
      setAnualH2(false);
      if (modoActivo === 'anual') setModoActivo('meses');
    }
  };

  const toggleMatricula = (checked) => {
    if (checked) {
      activarSoloMatricula();
      setMatriculaSeleccionada(true);
    } else {
      setMatriculaSeleccionada(false);
      if (modoActivo === 'matricula' && seleccionados.length > 0) {
        setModoActivo('meses');
      }
    }
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
    if (checked) {
      setCondonar(false);
      setAnualSeleccionado(false);
      setAnualH1(false);
      setAnualH2(false);
      if (modoActivo === 'anual') setModoActivo('meses');
    }
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
        mostrarToast('exito', 'Matrícula actualizada.');
      } else {
        mostrarToast('error', data?.mensaje || 'No se pudo actualizar la matrícula.');
      }
    } catch (e) {
      console.error('guardarMatricula()', e);
      mostrarToast('error', 'Error al guardar matrícula.');
    } finally {
      setGuardandoMatricula(false);
    }
  };

  // === NUEVO: ids de familia activos (excluye al actual para evitar duplicar) ===
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

  // === NUEVO: construir SIEMPRE la misma lista base de personas a operar (para impresión / conteo) ===
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

  // ====== NUEVO: totales de grupo para mostrar en UI ======
  const esPagoGrupo = aplicarFamilia && listaParaOperar.length > 1;
  const cantidadRegistrosLista = listaParaOperar.length;

  // Total FINAL que se muestra (si es grupo => total por persona * N)
  const totalParaMostrar = useMemo(() => {
    const totalPersona = Number(total) || 0;
    const n = esPagoGrupo ? cantidadRegistrosLista : 1;
    // Redondea a centenas para evitar mostrar 9.999 (quedará 10.000)
    return roundToHundreds(totalPersona * n);
  }, [total, esPagoGrupo, cantidadRegistrosLista]);


  const etiquetaTotal = esPagoGrupo
    ? `Total grupo (${cantidadRegistrosLista})`
    : 'Total';

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');

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
    if (matriculaSeleccionada) montosPorPeriodo[ID_MATRICULA] = Math.round(Number(montoMatricula || 0));

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
        // meta de anual para auditoría
        meta_anual: anualSeleccionado ? {
          tipo: anualConfig.tipo, // 'full' | 'h1' | 'h2'
          id_periodo: anualConfig.idPeriodo,
          importe: anualConfig.importe
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
        // Actualizamos estado local del actual
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

  // === NUEVO: helper para armar la lista completa con montos y periodos (para imprimir/pdf) ===
  const buildListaCompleta = () => {
    const periodos = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado && anualConfig?.idPeriodo ? [anualConfig.idPeriodo] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];
    const periodoCodigo = periodos[0] || 0;

    // Montos por periodo del alumno actual (plantilla)
    const montosBase = {
      ...Object.fromEntries(periodosMesesOrdenados.map(id => [id, Math.round(condonar ? 0 : Number(precioMensualConDescuento || 0))])),
      ...(anualSeleccionado && anualConfig?.idPeriodo ? { [anualConfig.idPeriodo]: Math.round(Number(anualConfig.importe || 0)) } : {}),
      ...(matriculaSeleccionada ? { [ID_MATRICULA]: Math.round(Number(montoMatricula || 0)) } : {}),
    };

    // Etiqueta periodo texto: anual usa su etiqueta especial
    const periodoTextoCustom = (anualSeleccionado && anualConfig?.etiqueta)
      ? `${anualConfig.etiqueta}${matriculaSeleccionada ? ' / MATRÍCULA' : ''} ${anioTrabajo}`
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

    // Para cada persona usar los mismos periodos/montos (por ahora), ya que es pago conjunto
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
      }
    }));

    return { lista, periodos, periodoCodigo, periodoTextoCustom };
  };

  // Acción post-éxito
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

    // IMPRESIÓN
    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir los comprobantes.');

    const opciones = { anioPago: anioTrabajo };

    if (esExterno) {
      await imprimirRecibosExternos(lista, periodoCodigo, win, opciones);
    } else {
      await imprimirRecibos(lista, periodoCodigo, win, opciones);
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
                      {matriculaSeleccionada && <li><span>Matrícula</span><strong>{formatearARS(montoMatricula)}</strong></li>}
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

              <div className="socio-info-extra">

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
                                  <span
                                    className={`chip ${m.activo ? 'chip-success' : 'chip-muted'}`}
                                  >
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

                {/* === Desplegable de miembros de la familia === */}

              </div>
            </div>

            {/* Condonar + Año */}
            <div className='condonarAño-montoLibre'>
              <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={condonar}
                  onChange={(e) => onToggleCondonar(e.target.checked)}
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
          
            {/* ====== EXTRAS: CONTADO ANUAL y MATRÍCULA ====== */}
            {ventanaAnualActiva && (
              <div className={`condonar-box ${anualSeleccionado ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input
                    type="checkbox"
                    checked={anualSeleccionado}
                    onChange={(e) => toggleAnual(e.target.checked)}
                    disabled={cargando || matriculaSeleccionada || libreActivo}
                  />
                  <span className="switch"><span className="switch-thumb" /></span>
<span className="switch-label sitch-labes">
  <strong>CONTADO ANUAL</strong>
  <span className="subline">
    {montoAnual > 0
      ? `(${formatearARS(montoAnualConDescuento)}${
          (esExterno && familyCount > 1) || (porcDescHermanos > 0) ? ' con desc.' : ''
        })`
      : '(sin monto anual definido)'}
  </span>
</span>
                </label>

                {/* NUEVO: controles de mitades */}
                {anualSeleccionado && (
                  <div className="edit-inline anual-mitades">
                    <label className="condonar-check">
                      <input
                        type="checkbox"
                        checked={anualH1}
                        onChange={(e) => setAnualH1(e.target.checked)}
                        disabled={cargando}
                      />
                      <span className="switch"><span className="switch-thumb" /></span>
                      <span className="switch-label"><strong>1ª mitad</strong> (Ene–Jul)</span>
                    </label>

                    <label className="condonar-check">
                      <input
                        type="checkbox"
                        checked={anualH2}
                        onChange={(e) => setAnualH2(e.target.checked)}
                        disabled={cargando}
                      />
                      <span className="switch"><span className="switch-thumb" /></span>
                      <span className="switch-label"><strong>2ª mitad</strong> (Ago–Dic)</span>
                    </label>

<div className="anual-mitades-info">
  <span className="anual-mitades-importe">
    Importe: {formatearARS(Math.round(anualConfig?.importe || 0))}
  </span>

  <button
    type="button"
    className="info-icon"
    aria-label="Ver información sobre mitades"
  >
    <FaInfoCircle aria-hidden="true" />
    <span className="tip" role="tooltip">
      Si no se eligen mitades, se considera todo el año.
    </span>
  </button>
</div>

                  </div>
                )}
              </div>
            )}

            <div className={`condonar-box ${matriculaSeleccionada ? 'is-active' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={matriculaSeleccionada}
                  onChange={(e) => toggleMatricula(e.target.checked)}
                  disabled={cargando || anualSeleccionado}
                />
                <span className="switch"><span className="switch-thumb" /></span>
                <span className="switch-label matricula-label">
                  <strong>MATRÍCULA</strong>
                  {!matriculaEditando && (
                    <>
                      <span className="matricula-monto">{formatearARS(montoMatricula)}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Editar monto"
                        onClick={()=> setMatriculaEditando(true)}
                      >
                        <FaPen />
                      </button>
                    </>
                  )}
                </span>
              </label>

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
                    title="Guardar matrícula"
                    aria-label="Guardar matrícula"
                  >
                    {guardandoMatricula ? '…' : <FaCheck />}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMatriculaEditando(false)}
                    disabled={guardandoMatricula}
                    title="Cancelar edición"
                    aria-label="Cancelar edición"
                  >
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>

            {/* Selección de meses */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || mesesGrid.length === 0 || anualSeleccionado}
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
                      const yaOcupado = !!estado || periodosPagados.includes(idMes);
                      const sel = seleccionados.includes(idMes);
                      const disabledPorOtroModo = anualSeleccionado;

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaOcupado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''} ${disabledPorOtroModo ? 'disabled' : ''}`}
                          role="button"
                          tabIndex={disabledPorOtroModo ? -1 : 0}
                          onClick={() => {
                            if (cargando || disabledPorOtroModo) return;
                            togglePeriodo(idMes);
                          }}
                          onKeyDown={(e) => {
                            if (cargando || disabledPorOtroModo) return;
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
                              disabled={cargando || disabledPorOtroModo}
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
                                {estado ? capitalizar(estado) : 'Pagado'}
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
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose?.(false)} disabled={cargando} type="button">
                Cancelar
              </button>
              <button
                className={`btn ${condonar ? 'btn-warning' : 'btn-danger'}`}
                onClick={confirmarPago}
                disabled={
                  cargando ||
                  (seleccionados.length === 0 && !anualSeleccionado && !matriculaSeleccionada)
                }
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