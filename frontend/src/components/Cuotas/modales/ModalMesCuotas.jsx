// ✅ REEMPLAZAR COMPLETO
// src/components/Cuotas/modales/ModalMesCuotas.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faPrint, faFilePdf, faTimes } from "@fortawesome/free-solid-svg-icons";

import { imprimirRecibos as imprimirRecibosRotado } from "../../../utils/imprimirRecibosRotado";
import { imprimirRecibosExternos as imprimirRecibosExternosRotados } from "../../../utils/imprimirRecibosExternosRotados";

import { generarComprobanteAlumnoPDF } from "../../../utils/ComprobanteExternoPDF.jsx";

import BASE_URL from "../../../config/config";
import Toast from "../../Global/Toast";
import "./ModalMesCuotas.css";

/**
 * ✅ UI FIX (pedido):
 * - La grilla del medio muestra SOLO ENERO..DICIEMBRE (1..12).
 * - EXTRAS arriba: MATRÍCULA + CONTADO ANUAL
 * - Si se marca CONTADO ANUAL => aparecen 1ª mitad y 2ª mitad (arriba), pero NO en la grilla.
 */

// ====== IDs “extras” (mismos que ModalPagos) ======
const ID_CONTADO_ANUAL = 13;
const ID_MATRICULA = 14;
const ID_CONTADO_ANUAL_H1 = 15; // Mar–Jul
const ID_CONTADO_ANUAL_H2 = 16; // Ago–Dic

const FALLBACK_MESES = [
  { id: 1, nombre: "Enero" },
  { id: 2, nombre: "Febrero" },
  { id: 3, nombre: "Marzo" },
  { id: 4, nombre: "Abril" },
  { id: 5, nombre: "Mayo" },
  { id: 6, nombre: "Junio" },
  { id: 7, nombre: "Julio" },
  { id: 8, nombre: "Agosto" },
  { id: 9, nombre: "Septiembre" },
  { id: 10, nombre: "Octubre" },
  { id: 11, nombre: "Noviembre" },
  { id: 12, nombre: "Diciembre" },
];

const normalizar = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// ====== Descuento por hermanos ======
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

const formatearARS = (monto) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(monto || 0));

function leerMontoDetalle(d) {
  const candidates = [
    d?.monto,
    d?.importe,
    d?.monto_pagado,
    d?.monto_cobrado,
    d?.monto_periodo,
    d?.precio_total,
    d?.importe_total,
    d?.total,
    d?.valor,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
    if (Number.isFinite(n) && n === 0) return 0;
  }
  return null;
}

const ModalMesCuotas = ({ socio, meses = [], anio, esExterno: esExternoProp = undefined, onClose }) => {
  const nowYear = new Date().getFullYear();
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  const [toast, setToast] = useState(null);
  const showToast = (tipo, mensaje, duracion = 1800) => setToast({ tipo, mensaje, duracion });

  // ===== AÑOS CON PAGOS =====
  const [aniosPago, setAniosPago] = useState([]);
  const [loadingAnios, setLoadingAnios] = useState(true);
  const [errorAnios, setErrorAnios] = useState(null);

  const [anioTrabajo, setAnioTrabajo] = useState(Number(anio || nowYear));
  const [showYearPicker, setShowYearPicker] = useState(false);

  const pickDefaultYear = useCallback((lista, anioProp, currentYear) => {
    const ids = (lista || []).map((a) => String(a.id));
    if (anioProp && ids.includes(String(anioProp))) return Number(anioProp);
    if (ids.includes(String(currentYear))) return Number(currentYear);
    if (lista && lista.length > 0) return Number(lista[0].id);
    return Number(currentYear);
  }, []);

  // ✅ FIX CLAVE: la grilla solo debe tener 1..12
  const listaMeses = useMemo(() => {
    const arr = Array.isArray(meses) && meses.length ? meses : FALLBACK_MESES;

    // normaliza y filtra SOLO ids 1..12
    const normalizados = arr
      .map((m) => ({ id: Number(m.id), nombre: String(m.nombre) }))
      .filter((m) => Number.isFinite(m.id) && m.id >= 1 && m.id <= 12);

    // si por algún motivo viene vacío, fallback
    if (!normalizados.length) return FALLBACK_MESES.map((m) => ({ id: Number(m.id), nombre: String(m.nombre) }));

    // ordenados 1..12
    normalizados.sort((a, b) => a.id - b.id);
    return normalizados;
  }, [meses]);

  // ===== Selección =====
  const [seleccionMeses, setSeleccionMeses] = useState([]);
  const [selAnual, setSelAnual] = useState(false);
  const [selAnualH1, setSelAnualH1] = useState(false);
  const [selAnualH2, setSelAnualH2] = useState(false);
  const [selMatricula, setSelMatricula] = useState(false);

  const [modoSalida, setModoSalida] = useState("imprimir");
  const [cargando, setCargando] = useState(false);

  // ===== Datos base =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);
  const [montoMatricula, setMontoMatricula] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState("");

  // ===== Familia =====
  const [familiaInfo, setFamiliaInfo] = useState({
    tieneFamilia: false,
    miembros_total: 0,
    miembros_activos: 0,
  });

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

  const esExternoInferido = useMemo(() => {
    const raw =
      nombreCategoria ||
      socio?.categoria_nombre ||
      socio?.nombre_categoria ||
      socio?.categoria ||
      "";
    return normalizar(raw) === "externo" || normalizar(raw).includes("extern");
  }, [nombreCategoria, socio]);

  const esExterno = esExternoProp !== undefined ? !!esExternoProp : esExternoInferido;

  const precioMensualConDescuento = useMemo(() => {
    const base = Number(precioMensual || 0);
    const porc = Number(porcDescHermanos || 0);
    return Math.max(0, Math.round(base * (1 - porc)));
  }, [precioMensual, porcDescHermanos]);

  const montoAnualConDescuento = useMemo(() => {
    const base = Number(montoAnual || 0);
    if (!base) return 0;
    const porc = Number(porcDescHermanos || 0);
    return Math.max(0, Math.round(base * (1 - porc)));
  }, [montoAnual, porcDescHermanos]);

  // ===== Estado real + montos reales =====
  const [periodosEstado, setPeriodosEstado] = useState({});
  const [montosReales, setMontosReales] = useState({});

  useEffect(() => {
    setSeleccionMeses([]);
    setSelAnual(false);
    setSelAnualH1(false);
    setSelAnualH2(false);
    setSelMatricula(false);
  }, [anioTrabajo]);

  // ===== Cargar años con pagos =====
  useEffect(() => {
    let cancelled = false;

    const fetchAnios = async () => {
      setLoadingAnios(true);
      setErrorAnios(null);
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=cuotas&listar_anios=1`);
        if (!res.ok) throw new Error(`listar_anios HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const lista = data?.anios && Array.isArray(data.anios) ? data.anios : [];
        if (cancelled) return;

        setAniosPago(lista);
        const def = pickDefaultYear(lista, anio, nowYear);
        setAnioTrabajo(def);
      } catch (e) {
        if (cancelled) return;
        console.error("ModalMesCuotas listar_anios error:", e);
        setErrorAnios(e);
        setAniosPago([]);
        setAnioTrabajo(Number(anio || nowYear));
      } finally {
        if (!cancelled) setLoadingAnios(false);
      }
    };

    fetchAnios();
    return () => {
      cancelled = true;
    };
  }, [anio, nowYear, pickDefaultYear]);

  // ===== Cargar monto_categoria =====
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setMontoAnual(0);
          setMontoMatricula(0);
          setNombreCategoria("");
          return;
        }

        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);

        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const mensual = Number(data?.monto_mensual ?? data?.monto ?? data?.precio ?? data?.Precio_Categoria ?? 0);
          const anual = Number(data?.monto_anual ?? 0);
          const matri = Number(data?.monto_matricula ?? data?.matricula ?? 0);

          const nombre = (data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? "").toString();

          setPrecioMensual(Number.isFinite(mensual) ? mensual : 0);
          setMontoAnual(Number.isFinite(anual) ? anual : 0);
          setMontoMatricula(Number.isFinite(matri) ? matri : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : "");
        } else {
          setPrecioMensual(0);
          setMontoAnual(0);
          setMontoMatricula(0);
          setNombreCategoria("");
        }
      } catch (e) {
        console.error("ModalMesCuotas obtener_monto_categoria error:", e);
        setPrecioMensual(0);
        setMontoAnual(0);
        setMontoMatricula(0);
        setNombreCategoria("");
      }
    };

    cargarMontoCategoria();
  }, [idAlumno]);

  // ===== Cargar familia =====
  useEffect(() => {
    const cargarFamilia = async () => {
      try {
        if (!idAlumno) return;

        const url = `${BASE_URL}/api.php?action=obtener_info_familia&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`obtener_info_familia HTTP ${res.status}`);

        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          setFamiliaInfo({
            tieneFamilia: !!data.tiene_familia,
            miembros_total: Number(data.miembros_total || 0),
            miembros_activos: Number(data.miembros_activos || 0),
          });
        } else {
          setFamiliaInfo({ tieneFamilia: false, miembros_total: 0, miembros_activos: 0 });
        }
      } catch (e) {
        console.error("ModalMesCuotas obtener_info_familia error:", e);
        setFamiliaInfo({ tieneFamilia: false, miembros_total: 0, miembros_activos: 0 });
      }
    };

    cargarFamilia();
  }, [idAlumno]);

  // ===== Cargar estado real + montos reales =====
  useEffect(() => {
    const cargarEstado = async () => {
      try {
        if (!idAlumno || !anioTrabajo) {
          setPeriodosEstado({});
          setMontosReales({});
          return;
        }

        const url = `${BASE_URL}/api.php?action=meses_pagados&id_alumno=${encodeURIComponent(
          idAlumno
        )}&anio=${encodeURIComponent(anioTrabajo)}`;

        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`meses_pagados HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));

        if (!data?.exito) {
          setPeriodosEstado({});
          setMontosReales({});
          return;
        }

        let detalles = [];
        if (Array.isArray(data?.detalles)) detalles = data.detalles;
        else if (Array.isArray(data?.items)) detalles = data.items;
        else if (Array.isArray(data?.rows)) detalles = data.rows;
        else if (Array.isArray(data?.data)) detalles = data.data;

        const mapEstado = {};
        const mapMonto = {};

        for (const d of detalles) {
          const id = Number(d?.id_mes ?? d?.id ?? d?.mes ?? d?.periodo);
          if (!id) continue;

          const est = String(d?.estado ?? d?.estado_pago ?? "").toLowerCase();
          if (est) mapEstado[id] = est;

          const m = leerMontoDetalle(d);
          if (m !== null) mapMonto[id] = m;
        }

        setPeriodosEstado(mapEstado);
        setMontosReales(mapMonto);
      } catch (e) {
        console.error("ModalMesCuotas meses_pagados error:", e);
        setPeriodosEstado({});
        setMontosReales({});
      }
    };

    cargarEstado();
  }, [idAlumno, anioTrabajo]);

  // ===== UI helpers =====
  const mapMesNombre = useMemo(() => {
    const m = new Map();
    for (const x of listaMeses) m.set(Number(x.id), x.nombre);
    return m;
  }, [listaMeses]);

  const toggleMes = (id) => {
    const num = Number(id);
    setSeleccionMeses((prev) => (prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]));
  };

  const allSelected = listaMeses.length > 0 && seleccionMeses.length === listaMeses.length;

  const toggleSeleccionarTodos = () => {
    if (allSelected) setSeleccionMeses([]);
    else setSeleccionMeses(listaMeses.map((m) => Number(m.id)));
  };

  const anualConfig = useMemo(() => {
    if (!selAnual) return { tipo: null, idPeriodo: null, importe: 0, etiqueta: "" };

    const base = Math.max(0, Math.round(Number(montoAnualConDescuento || 0)));
    const halfCount = (selAnualH1 ? 1 : 0) + (selAnualH2 ? 1 : 0);

    if (halfCount === 1) {
      if (selAnualH1) {
        return { tipo: "h1", idPeriodo: ID_CONTADO_ANUAL_H1, importe: Math.max(0, Math.round(base / 2)), etiqueta: "CONTADO ANUAL (1ª mitad)" };
      }
      return { tipo: "h2", idPeriodo: ID_CONTADO_ANUAL_H2, importe: Math.max(0, Math.round(base / 2)), etiqueta: "CONTADO ANUAL (2ª mitad)" };
    }

    return { tipo: "full", idPeriodo: ID_CONTADO_ANUAL, importe: base, etiqueta: "CONTADO ANUAL" };
  }, [selAnual, selAnualH1, selAnualH2, montoAnualConDescuento]);

  const periodosSeleccionados = useMemo(() => {
    const mesesSel = [...seleccionMeses].map(Number).filter((x) => x >= 1 && x <= 12);
    mesesSel.sort((a, b) => a - b);

    const extras = [];
    if (selMatricula) extras.push(ID_MATRICULA);
    if (selAnual && anualConfig?.idPeriodo) extras.push(anualConfig.idPeriodo);

    return [...mesesSel, ...extras];
  }, [seleccionMeses, selMatricula, selAnual, anualConfig?.idPeriodo]);

  const periodoTextoFinal = useMemo(() => {
    if (periodosSeleccionados.length === 0) return "";

    const labels = [];
    for (const id of periodosSeleccionados) {
      if (id === ID_MATRICULA) labels.push("MATRÍCULA");
      else if (id === ID_CONTADO_ANUAL) labels.push("CONTADO ANUAL");
      else if (id === ID_CONTADO_ANUAL_H1) labels.push("CONTADO ANUAL (1ª mitad)");
      else if (id === ID_CONTADO_ANUAL_H2) labels.push("CONTADO ANUAL (2ª mitad)");
      else labels.push((mapMesNombre.get(Number(id)) || String(id)).trim());
    }
    return `${labels.join(" / ")} ${anioTrabajo}`;
  }, [periodosSeleccionados, anioTrabajo, mapMesNombre]);

  const montosPorPeriodo = useMemo(() => {
    const mp = {};

    for (const id of periodosSeleccionados) {
      const estado = String(periodosEstado[id] || "").toLowerCase();
      const real = montosReales?.[id];

      if (real !== undefined && real !== null && Number.isFinite(Number(real))) {
        mp[id] = Math.max(0, Math.round(Number(real)));
        continue;
      }

      if (estado === "condonado") {
        mp[id] = 0;
        continue;
      }

      if (id >= 1 && id <= 12) mp[id] = Math.max(0, Math.round(Number(precioMensualConDescuento || 0)));
      else if (id === ID_MATRICULA) mp[id] = Math.max(0, Math.round(Number(montoMatricula || 0)));
      else if (id === ID_CONTADO_ANUAL) mp[id] = Math.max(0, Math.round(Number(montoAnualConDescuento || 0)));
      else if (id === ID_CONTADO_ANUAL_H1 || id === ID_CONTADO_ANUAL_H2) {
        const base = Math.max(0, Math.round(Number(montoAnualConDescuento || 0)));
        mp[id] = Math.max(0, Math.round(base / 2));
      } else mp[id] = 0;
    }

    return mp;
  }, [periodosSeleccionados, periodosEstado, montosReales, precioMensualConDescuento, montoMatricula, montoAnualConDescuento]);

  const total = useMemo(() => periodosSeleccionados.reduce((acc, id) => acc + Number(montosPorPeriodo[id] || 0), 0), [
    periodosSeleccionados,
    montosPorPeriodo,
  ]);

  const buildAlumnoParaImprimir = useCallback(() => {
    const periodoCodigo = periodosSeleccionados[0] || 0;

    return {
      ...socio,
      id_periodo: periodoCodigo,
      periodos: periodosSeleccionados,
      periodo_texto: periodoTextoFinal,
      precio_unitario: Math.max(0, Math.round(Number(precioMensualConDescuento || 0))),
      importe_total: total,
      precio_total: total,
      anio: anioTrabajo,
      categoria_nombre: nombreCategoria || "",
      montos_por_periodo: { ...montosPorPeriodo },
      meta_descuento_hermanos: { familia: familyCount, categoria: nombreCategoria, porcentaje: porcDescHermanos },
      meta_estado_periodos: { ...periodosEstado },
    };
  }, [
    socio,
    periodosSeleccionados,
    periodoTextoFinal,
    precioMensualConDescuento,
    total,
    anioTrabajo,
    nombreCategoria,
    montosPorPeriodo,
    familyCount,
    porcDescHermanos,
    periodosEstado,
  ]);

  const abrirImpresion = async () => {
    const alumnoParaImprimir = buildAlumnoParaImprimir();
    const periodoCodigo = alumnoParaImprimir.id_periodo;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Habilitá ventanas emergentes para imprimir.");
      return;
    }

    const opciones = { anioPago: anioTrabajo };

    if (esExterno) await imprimirRecibosExternosRotados([alumnoParaImprimir], periodoCodigo, w, opciones);
    else await imprimirRecibosRotado([alumnoParaImprimir], periodoCodigo, w, opciones);
  };

  const descargarPDF = async () => {
    const alumnoParaImprimir = buildAlumnoParaImprimir();
    try {
      await generarComprobanteAlumnoPDF(alumnoParaImprimir, {
        anio: anioTrabajo,
        periodoId: alumnoParaImprimir.id_periodo,
        periodoTexto: alumnoParaImprimir.periodo_texto,
        importeTotal: total,
        precioUnitario: Number(precioMensualConDescuento || 0),
        periodos: alumnoParaImprimir.periodos,
        montosPorPeriodo: alumnoParaImprimir.montos_por_periodo,
      });
      showToast("exito", "PDF descargado correctamente");
      return true;
    } catch (e) {
      console.error("Error al generar PDF:", e);
      showToast("error", "No se pudo generar el PDF");
      return false;
    }
  };

  const handleConfirmar = async () => {
    if (periodosSeleccionados.length === 0) return;
    try {
      setCargando(true);
      if (modoSalida === "imprimir") {
        await abrirImpresion();
        onClose?.();
      } else {
        const ok = await descargarPDF();
        if (ok) setTimeout(() => onClose?.(), 900);
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!socio) return null;

  const labelEstado = (id) => {
    const est = String(periodosEstado?.[id] || "").toLowerCase();
    if (!est) return "";
    return est === "pagado" ? "Pagado" : est === "condonado" ? "Condonado" : est;
  };

  const deshabilitarConfirmar =
    periodosSeleccionados.length === 0 || cargando || loadingAnios || aniosPago.length === 0;

  return (
    <div className="modmes_overlay">
      {toast && (
        <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />
      )}

      <div className="modmes_contenido">
        {/* Header */}
        <div className="modmes_header">
          <div className="modmes_header-left">
            <div className="modmes_icon-circle">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="modmes_header-texts">
              <h2 className="modmes_title">Seleccionar Períodos</h2>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {nombreCategoria ? `Categoría: ${nombreCategoria}` : ""}
                {familiaInfo.tieneFamilia ? ` • Familia: ${familyCount}` : ""}
                {porcDescHermanos > 0 ? ` • Desc: ${(porcDescHermanos * 100).toFixed(1)}%` : ""}
              </div>
            </div>
          </div>

          <button className="modmes_close-btn" onClick={() => onClose?.()} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modmes_body">
          <div className="modmes_periodos-section">
            <div className="modmes_section-header">
              <h4 className="modmes_section-title">PERÍODOS DISPONIBLES</h4>

              <div className="modmes_section-center">
                <div className="modmes_output-mode" role="tablist" aria-label="Modo de salida">
                  <label className={`modmes_mode-option ${modoSalida === "imprimir" ? "active" : ""}`} role="tab">
                    <input
                      type="radio"
                      name="modoSalida"
                      value="imprimir"
                      checked={modoSalida === "imprimir"}
                      onChange={() => setModoSalida("imprimir")}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>Imprimir</span>
                  </label>

                  <label className={`modmes_mode-option ${modoSalida === "pdf" ? "active" : ""}`} role="tab">
                    <input
                      type="radio"
                      name="modoSalida"
                      value="pdf"
                      checked={modoSalida === "pdf"}
                      onChange={() => setModoSalida("pdf")}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>PDF</span>
                  </label>
                </div>
              </div>

              <div className="modmes_section-header-actions">
                <div className="modmes_year-picker">
                  <button
                    type="button"
                    className="modmes_year-button"
                    onClick={() => setShowYearPicker((s) => !s)}
                    title="Cambiar año"
                    aria-haspopup="listbox"
                    aria-expanded={showYearPicker}
                    disabled={loadingAnios}
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>{loadingAnios ? "Cargando..." : aniosPago.length > 0 ? anioTrabajo : "—"}</span>
                  </button>

                  {showYearPicker && !loadingAnios && (
                    <div className="modmes_year-popover" role="listbox" aria-label="Seleccionar año">
                      {errorAnios ? (
                        <div className="modmes_year-empty">Error al cargar años</div>
                      ) : aniosPago.length === 0 ? (
                        <div className="modmes_year-empty">Sin años con pagos</div>
                      ) : (
                        aniosPago.map((a) => {
                          const val = String(a.id);
                          const isActive = String(anioTrabajo) === val;
                          return (
                            <button
                              key={val}
                              className={`modmes_year-item ${isActive ? "active" : ""}`}
                              onClick={() => {
                                setAnioTrabajo(Number(val));
                                setShowYearPicker(false);
                              }}
                              role="option"
                              aria-selected={isActive}
                            >
                              {a.nombre ?? a.id}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="modmes_btn modmes_btn-small modmes_btn-terciario"
                  onClick={toggleSeleccionarTodos}
                  disabled={listaMeses.length === 0}
                  title={allSelected ? "Quitar selección" : "Seleccionar todos"}
                >
                  {allSelected ? "Quitar" : "Todos"}
                </button>
              </div>
            </div>

            {/* EXTRAS arriba */}
            <div style={{ marginTop: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, marginBottom: 8 }}>EXTRAS</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="modmes_periodo-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={selMatricula} onChange={(e) => setSelMatricula(e.target.checked)} />
                  <span>
                    MATRÍCULA{" "}
                    {labelEstado(ID_MATRICULA) ? (
                      <strong style={{ marginLeft: 6, opacity: 0.8 }}>({labelEstado(ID_MATRICULA)})</strong>
                    ) : null}
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {formatearARS(montosReales?.[ID_MATRICULA] ?? montoMatricula ?? 0)}
                    </div>
                  </span>
                </label>

                <label className="modmes_periodo-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={selAnual} onChange={(e) => setSelAnual(e.target.checked)} />
                  <span>
                    CONTADO ANUAL{" "}
                    {labelEstado(ID_CONTADO_ANUAL) ? (
                      <strong style={{ marginLeft: 6, opacity: 0.8 }}>({labelEstado(ID_CONTADO_ANUAL)})</strong>
                    ) : null}
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {formatearARS(
                        montosReales?.[anualConfig?.idPeriodo || ID_CONTADO_ANUAL] ??
                          anualConfig?.importe ??
                          montoAnualConDescuento ??
                          0
                      )}
                    </div>
                  </span>
                </label>

                {selAnual && (
                  <>
                    <label className="modmes_periodo-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={selAnualH1} onChange={(e) => setSelAnualH1(e.target.checked)} />
                      <span>
                        1ª mitad (Mar–Jul)
                        {labelEstado(ID_CONTADO_ANUAL_H1) ? (
                          <strong style={{ marginLeft: 6, opacity: 0.8 }}>({labelEstado(ID_CONTADO_ANUAL_H1)})</strong>
                        ) : null}
                      </span>
                    </label>

                    <label className="modmes_periodo-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={selAnualH2} onChange={(e) => setSelAnualH2(e.target.checked)} />
                      <span>
                        2ª mitad (Ago–Dic)
                        {labelEstado(ID_CONTADO_ANUAL_H2) ? (
                          <strong style={{ marginLeft: 6, opacity: 0.8 }}>({labelEstado(ID_CONTADO_ANUAL_H2)})</strong>
                        ) : null}
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* ✅ GRILLA SOLO MESES (1..12) */}
            <div className="modmes_periodos-grid-container">
              <div className="modmes_periodos-grid">
                {listaMeses.map((m) => {
                  const id = Number(m.id);
                  const checked = seleccionMeses.includes(id);
                  const est = labelEstado(id);

                  const montoMostrado = montosReales?.[id] !== undefined ? montosReales[id] : precioMensualConDescuento;

                  return (
                    <label key={m.id} className={`modmes_periodo-card ${checked ? "modmes_seleccionado" : ""}`}>
                      <div className="modmes_periodo-checkbox">
                        <input
                          type="checkbox"
                          name="mes"
                          checked={checked}
                          onChange={() => toggleMes(id)}
                          aria-checked={checked}
                          aria-label={m.nombre}
                        />
                        <span className="modmes_checkmark" aria-hidden="true" />
                      </div>

                      <span className="modmes_periodo-label">
                        {m.nombre}
                        {est ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>({est})</span> : null}
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{formatearARS(montoMostrado)}</div>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Resumen */}
            <div style={{ marginTop: 14, fontSize: 13, opacity: 0.9 }}>
              <div>
                <strong>Período:</strong> {periodoTextoFinal || "—"}
              </div>
              <div>
                <strong>Total:</strong> {formatearARS(total)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <div className="modmes_total-badge">Total: {formatearARS(total)}</div>
          </div>

          <div className="modmes_footer-right">
            <button
              type="button"
              className="modmes_btn modmes_btn-secondary modmes_action-btn"
              onClick={() => onClose?.()}
              disabled={cargando}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="btn-label">Cancelar</span>
            </button>

            <button
              type="button"
              className="modmes_btn modmes_btn-primary modmes_action-btn"
              onClick={handleConfirmar}
              disabled={deshabilitarConfirmar}
              title={
                loadingAnios
                  ? "Cargando años..."
                  : aniosPago.length === 0
                  ? "No hay años con pagos"
                  : periodosSeleccionados.length === 0
                  ? "Elegí al menos un período"
                  : ""
              }
            >
              {modoSalida === "imprimir" ? (
                <>
                  <FontAwesomeIcon icon={faPrint} />
                  <span className="btn-label">Imprimir</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFilePdf} />
                  <span className="btn-label">PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalMesCuotas;