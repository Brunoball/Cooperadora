// ContableChartsModal.jsx
import React, { useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faChartPie } from "@fortawesome/free-solid-svg-icons";

import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import "./ContableChartsModal.css";

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

/**
 * Props:
 * - open
 * - onClose
 * - datosMeses: [{ nombre: "PERÍODO 1 Y 2", pagos: [...] }]
 * - datosEmpresas: (no usado)
 * - mesSeleccionado: etiqueta del período seleccionado (p.ej. "PERÍODO 7 Y 8")
 * - medioSeleccionado: nombre de cobrador o "todos"
 * - totalSocios: número total de socios (activos)
 */
export default function ContableChartsModal({
  open,
  onClose,
  datosMeses = [],
  datosEmpresas = [],
  mesSeleccionado = "Selecciona un periodo",
  medioSeleccionado = "todos",
  totalSocios = 0,
}) {
  // ===== utils =====
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const periodoRank = (label) => {
    const nums = (label || "").match(/\d{1,2}/g);
    if (!nums || nums.length === 0) return 999;
    const ints = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    return ints.length ? Math.min(...ints) : 999;
  };

  const extractMonthsFromPeriodLabel = (label) => {
    const nums = (label || "").match(/\d{1,2}/g) || [];
    const months = nums
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    return Array.from(new Set(months));
  };

  const monthFromDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || yyyy_mm_dd.length < 7) return null;
    const mm = parseInt(yyyy_mm_dd.substring(5, 7), 10);
    return Number.isNaN(mm) ? null : mm;
  };

  const nombreCobrador = (p) =>
    p?.Cobrador ||
    p?.Nombre_Cobrador ||
    p?.nombre_cobrador ||
    p?.cobrador ||
    p?.Cobrador_Nombre ||
    "";

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  // ===== períodos disponibles (según labels que trae el backend) =====
  const periodosOrdenados = useMemo(() => {
    const labels = (datosMeses || []).map((b) => b?.nombre).filter(Boolean);
    const uniq = Array.from(new Set(labels));
    return uniq.sort((a, b) => periodoRank(a) - periodoRank(b));
  }, [datosMeses]);

  // Mapa período -> meses que representa (e.g. "PERÍODO 7 Y 8" -> [7,8])
  const mapaPeriodoMeses = useMemo(() => {
    const m = new Map();
    for (const per of periodosOrdenados) m.set(per, extractMonthsFromPeriodLabel(per));
    return m;
  }, [periodosOrdenados]);

  // Todos los pagos (solo socios) unificados
  const todosLosPagos = useMemo(() => {
    const out = [];
    for (const b of datosMeses || []) if (Array.isArray(b?.pagos)) out.push(...b.pagos);
    return out;
  }, [datosMeses]);

  // Filtro por cobrador (si aplica)
  const pagosFiltradosPorCobrador = useMemo(() => {
    if (medioSeleccionado === "todos") return todosLosPagos;
    return (todosLosPagos || []).filter((p) => norm(nombreCobrador(p)) === norm(medioSeleccionado));
  }, [todosLosPagos, medioSeleccionado]);

  // ===== helper: sumar por período usando FECHA DE PAGO =====
  const sumaPeriodoPorFecha = (labelPeriodo) => {
    const meses = mapaPeriodoMeses.get(labelPeriodo) || [];
    if (!meses.length) return 0;
    const lista = pagosFiltradosPorCobrador.filter((p) => {
      const m = monthFromDate(p?.fechaPago);
      return m !== null && meses.includes(m);
    });
    return lista.reduce((acc, p) => acc + (parseFloat(p?.Precio) || 0), 0);
  };

  // ===== construir labels de la LÍNEA según selección / período actual =====
  const currentMonth = new Date().getMonth() + 1; // 1..12

  // Períodos hasta el actual (incluye el que contiene el mes actual)
  const periodosHastaActual = useMemo(() => {
    return periodosOrdenados.filter((per) => {
      const meses = mapaPeriodoMeses.get(per) || [];
      if (!meses.length) return false;
      const minMes = Math.min(...meses);
      // incluir todos los períodos cuyo mínimo mes sea <= mes actual
      return minMes <= currentMonth;
    });
  }, [periodosOrdenados, mapaPeriodoMeses, currentMonth]);

  // Cuando hay selección: solo [anterior, seleccionado]. Si no hay anterior, solo [seleccionado].
  const lineLabels = useMemo(() => {
    if (mesSeleccionado && mesSeleccionado !== "Selecciona un periodo") {
      // buscar índice del seleccionado dentro de todos los períodos ordenados
      const idxSel = periodosOrdenados.findIndex((l) => norm(l) === norm(mesSeleccionado));
      if (idxSel === -1) return [mesSeleccionado]; // por si el label no está en la lista
      const prev = idxSel > 0 ? periodosOrdenados[idxSel - 1] : null;
      return prev ? [prev, periodosOrdenados[idxSel]] : [periodosOrdenados[idxSel]];
    }
    // sin selección: mostrar hasta el período actual
    return periodosHastaActual;
  }, [mesSeleccionado, periodosOrdenados, periodosHastaActual]);

  // Serie para esos labels
  const serieSocios = useMemo(() => lineLabels.map((per) => sumaPeriodoPorFecha(per)), [lineLabels]);

  const maxSocios = useMemo(() => Math.max(0, ...serieSocios), [serieSocios]);

  /* ========= LINE CHART ========= */
  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: "Socios",
        data: serieSocios,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: serieSocios.map((v) => (v === maxSocios && v > 0 ? 6 : 3)),
        pointHoverRadius: 7,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y || 0;
            return `Recaudación: $${val.toLocaleString("es-AR")}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { autoSkip: false } },
      y: { ticks: { callback: (v) => "$" + Number(v).toLocaleString("es-AR") } },
    },
  };

  // ===== Texto de variaciones bajo la línea =====
  const variacionesTexto = useMemo(() => {
    const arr = [];
    for (let i = 1; i < lineLabels.length; i++) {
      const prevLabel = lineLabels[i - 1];
      const currLabel = lineLabels[i];
      const prevVal = serieSocios[i - 1] || 0;
      const currVal = serieSocios[i] || 0;
      const diff = currVal - prevVal;
      const pct = prevVal === 0 ? 0 : (diff / prevVal) * 100;
      const signo = diff > 0 ? "aumentó" : diff < 0 ? "cayó" : "se mantuvo";
      arr.push(
        `De ${prevLabel} a ${currLabel} ${signo} $${Math.abs(diff).toLocaleString("es-AR")} (${(diff >= 0 ? "+" : "")}${pct.toFixed(1)}%).`
      );
    }
    return arr;
  }, [lineLabels, serieSocios]);

  /* ========= PIE CHART (Pagaron vs No pagaron por FECHA de pago) ========= */
  // Período efectivo del pie: seleccionado o, si no hay selección, el período actual (último de periodosHastaActual)
  const periodoEfectivo = useMemo(() => {
    if (mesSeleccionado && mesSeleccionado !== "Selecciona un periodo") return mesSeleccionado;
    if (periodosHastaActual.length > 0) return periodosHastaActual[periodosHastaActual.length - 1];
    return periodosOrdenados[periodosOrdenados.length - 1] || undefined;
  }, [mesSeleccionado, periodosHastaActual, periodosOrdenados]);

  // Socios únicos que pagaron en los meses del período efectivo (fechaPago)
  const pagaronEnPeriodo = useMemo(() => {
    if (!periodoEfectivo) return 0;
    const meses = mapaPeriodoMeses.get(periodoEfectivo) || [];
    if (!meses.length) return 0;

    const pagos = pagosFiltradosPorCobrador.filter((p) => {
      const m = monthFromDate(p?.fechaPago);
      return m !== null && meses.includes(m);
    });

    const setSocios = new Set(
      pagos
        .map((p) => p?.ID_Socio ?? p?.id_socio ?? null)
        .filter((id) => id !== null && id !== undefined)
    );
    return setSocios.size;
  }, [periodoEfectivo, pagosFiltradosPorCobrador, mapaPeriodoMeses]);

  // Universo total para el pie (si no llega totalSocios, usar unión de todos los socios observados)
  const universoTotal = totalSocios > 0 ? totalSocios : (() => {
    const s = new Set();
    for (const p of todosLosPagos || []) {
      const id = p?.ID_Socio ?? p?.id_socio ?? null;
      if (id !== null && id !== undefined) s.add(id);
    }
    return s.size;
  })();

  const noPagaron = Math.max(universoTotal - pagaronEnPeriodo, 0);

  // Mostrar siempre verde/rojo (mínimo visual 2%) — solo visual
  const realPie = [pagaronEnPeriodo, noPagaron];
  const MIN_PCT = 0.02;
  let displayPie = realPie.slice();
  const totalReal = realPie[0] + realPie[1];
  if (totalReal > 0) {
    const pct0 = realPie[0] / totalReal;
    const pct1 = realPie[1] / totalReal;
    if (realPie[0] > 0 && pct0 < MIN_PCT) {
      displayPie[0] = Math.max(realPie[0], Math.ceil(totalReal * MIN_PCT));
      displayPie[1] = totalReal - displayPie[0];
    } else if (realPie[1] > 0 && pct1 < MIN_PCT) {
      displayPie[1] = Math.max(realPie[1], Math.ceil(totalReal * MIN_PCT));
      displayPie[0] = totalReal - displayPie[1];
    }
  }

  const pieData = {
    labels: ["Pagaron", "No pagaron"],
    datasets: [
      {
        data: displayPie,                      // datos para dibujar (con mínimo visual)
        backgroundColor: ["#22c55e", "#ef4444"], // VERDE/ROJO rellenos
        borderColor: "#ffffff",
        borderWidth: 1,
        spacing: 0,                            // torta sin separación
        cutout: "0%",                          // 0% => PIE (no dona)
        rotation: -90,
        hoverOffset: 6,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          // Mostrar siempre los valores reales
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const realVal = realPie[idx] || 0;
            const total = realPie[0] + realPie[1];
            const pct = total === 0 ? 0 : (realVal / total) * 100;
            return `${ctx.label}: ${realVal.toLocaleString("es-AR")} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  if (!open) return null;

  return (
    <div className="contable-modal-overlay" role="dialog" aria-modal="true">
      <div className="contable-modal">
        <div className="contable-modal-header">
          <h3>
            <FontAwesomeIcon icon={faChartPie} /> Gráficos de Recaudación
            {medioSeleccionado !== "todos" ? ` · ${medioSeleccionado}` : ""}
          </h3>
          <button className="contable-modal-close" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="contable-modal-body">
          {/* ===== LÍNEAS ===== */}
          <div className="contable-chart-card">
            <h4>
              {mesSeleccionado && mesSeleccionado !== "Selecciona un periodo"
                ? "Comparativa de períodos (seleccionado vs anterior)"
                : "Evolución por período (hasta el período actual)"}
            </h4>

            <div className="contable-chart-wrapper">
              <Line data={lineData} options={lineOptions} />
            </div>

            {variacionesTexto.length > 0 && (
              <div className="contable-chart-footnote" style={{ marginTop: 8 }}>
                {variacionesTexto.map((t, i) => (
                  <div key={i}>• {t}</div>
                ))}
              </div>
            )}

            <small className="contable-chart-footnote">
              {mesSeleccionado && mesSeleccionado !== "Selecciona un periodo"
                ? "Se comparan únicamente el período seleccionado y su anterior. La suma usa la fecha de pago."
                : "Se muestran los períodos desde el inicio del año hasta el período actual. La suma usa la fecha de pago."}
            </small>
          </div>

          {/* ===== PIE ===== */}
          <div className="contable-chart-card">
            <h4>
              Pagos en {periodoEfectivo || "—"} · {universoTotal.toLocaleString("es-AR")} socios
            </h4>
            <div className="contable-chart-wrapper contable-chart-wrapper--pie">
              <Pie data={pieData} options={pieOptions} />
            </div>

            <div className="contable-pie-totals">
              <div className="contable-pie-totals__item socios">
                <span className="label">Pagaron:</span>
                <span className="value">{realPie[0].toLocaleString("es-AR")}</span>
              </div>
              <div className="contable-pie-totals__item empresas">
                <span className="label">No pagaron:</span>
                <span className="value">{realPie[1].toLocaleString("es-AR")}</span>
              </div>
              <div className="contable-pie-totals__item total">
                <span className="label">Total socios:</span>
                <span className="value">{(realPie[0] + realPie[1]).toLocaleString("es-AR")}</span>
              </div>
            </div>

            <small className="contable-chart-footnote">
              El circular usa la <b>fecha de pago</b> para contar socios que pagaron en el período.
              Se aplica un <i>mínimo visual</i> para que siempre se vean ambas franjas (verde/rojo);
              los valores reales se muestran en cifras y tooltips.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
