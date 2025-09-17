// src/components/Contable/ResumenContable.jsx
import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";
import "./ResumenContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ---------- Helpers ---------- */
const fetchJSON = async (url, options) => {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ---------- DonutChart (Ingresos = AZUL / Egresos = ROJO) ---------- */
function DonutChart({ ingresos = 0, egresos = 0 }) {
  const total = Math.max(ingresos + egresos, 1);
  const pIng = ingresos / total;
  const pEgr = egresos / total;

  const size = 180;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const arcIng = `${c * pIng} ${c * (1 - pIng)}`;
  const arcEgr = `${c * pEgr} ${c * (1 - pEgr)}`;

  return (
    <div className="rc_donut">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Ingresos vs Egresos"
      >
        <defs>
          {/* Ingresos = AZUL */}
          <linearGradient id="gradIng" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          {/* Egresos = ROJO */}
          <linearGradient id="gradEgr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>

        {/* Fondo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#eef2ff"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Ingresos */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#gradIng)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={arcIng}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Egresos (arranca donde termina ingresos) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#gradEgr)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={arcEgr}
          strokeLinecap="round"
          transform={`rotate(${pIng * 360 - 90} ${size / 2} ${size / 2})`}
        />

        {/* Centro */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="rc_donut_total"
        >
          ${ingresos.toLocaleString("es-AR")}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="rc_donut_label">
          Ingresos
        </text>
      </svg>

      <div className="rc_legend">
        <div className="rc_legend_item">
          <span className="dot ing" /> Ingresos
          <strong>${ingresos.toLocaleString("es-AR")}</strong>
        </div>
        <div className="rc_legend_item">
          <span className="dot egr" /> Egresos
          <strong>${egresos.toLocaleString("es-AR")}</strong>
        </div>
      </div>
    </div>
  );
}

/* ---------- LineChart (color dinámico por serie) ---------- */
function LineChart({ data = [], serieName = "Ingresos", color = "#2563eb" }) {
  const W = 700,
    H = 240,
    P = 24;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const xStep = (W - P * 2) / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = P + i * xStep;
    const y = P + (1 - d.value / maxV) * (H - P * 2);
    return [x, y];
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L ${P + (data.length - 1) * xStep},${H - P} L ${P},${H - P} Z`;

  return (
    <div className="rc_line">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="240"
        role="img"
        aria-label={`Serie mensual ${serieName}`}
      >
        <defs>
          <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#93c5fd" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* grid */}
        <g className="axis">
          {[0.25, 0.5, 0.75, 1].map((p, i) => (
            <line
              key={i}
              x1={P}
              x2={W - P}
              y1={P + (1 - p) * (H - P * 2)}
              y2={P + (1 - p) * (H - P * 2)}
            />
          ))}
        </g>

        <path d={area} fill="url(#gradLine)" />
        <path d={path} stroke={color} strokeWidth="2.5" fill="none" filter="url(#soft)" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3.6" fill={color} />
        ))}
        {data.map((d, i) => (
          <text
            key={i}
            x={P + i * xStep}
            y={H - 4}
            textAnchor="middle"
            className="rc_line_label"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ---------- Página ---------- */
export default function ResumenContable() {
  const [resumen, setResumen] = useState([]);
  const [anioRes, setAnioRes] = useState(Y);
  const [aniosCat, setAniosCat] = useState([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [serie, setSerie] = useState("ingresos"); // ingresos | egresos | saldo
  const [chartTab, setChartTab] = useState("anual"); // anual | mensual

  /* Años disponibles (re-uso del endpoint de ingresos) */
  const loadAniosDisponibles = async (prefer = anioRes) => {
    try {
      const raw = await fetchJSON(
        `${BASE_URL}/api.php?action=contable_ingresos&year=${prefer}&detalle=1`
      );
      const anios = Array.isArray(raw?.anios_disponibles) ? raw.anios_disponibles : [];
      setAniosCat(anios);
      if (anios.length > 0 && !anios.includes(prefer)) setAnioRes(anios[0]);
    } catch (e) {
      console.error("Error cargando años:", e);
      setAniosCat([]);
    }
  };

  const loadResumen = async () => {
    setLoadingRes(true);
    try {
      const raw = await fetchJSON(
        `${BASE_URL}/api.php?action=contable_egresos&op=resumen&year=${anioRes}`
      );
      setResumen(raw?.resumen || []);
    } catch (e) {
      console.error(e);
      setResumen([]);
    } finally {
      setLoadingRes(false);
    }
  };

  useEffect(() => {
    loadAniosDisponibles(Y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioRes]);

  /* Normalizar 12 meses */
  const meses12 = useMemo(() => {
    const byMes = new Map(resumen.map((r) => [Number(r.mes), r]));
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const r =
        byMes.get(m) || { ingresos: 0, egresos: 0, saldo: 0, nombre_mes: MESES[i], mes: m, anio: anioRes };
      return { ...r, nombre_mes: r.nombre_mes || MESES[i] };
    });
  }, [resumen, anioRes]);

  const totals = useMemo(
    () => ({
      ingresos: meses12.reduce((a, b) => a + Number(b.ingresos || 0), 0),
      egresos: meses12.reduce((a, b) => a + Number(b.egresos || 0), 0),
      saldo: meses12.reduce((a, b) => a + Number(b.saldo || 0), 0),
    }),
    [meses12]
  );

  const lineData = useMemo(() => {
    const key = serie;
    return meses12.map((m) => ({ label: m.nombre_mes, value: Number(m[key] || 0) }));
  }, [meses12, serie]);

  // Colores por serie
  const serieColor =
    serie === "ingresos" ? "#2563eb" : // azul
    serie === "egresos"  ? "#ef4444" : // rojo
                           "#334155";  // gris para saldo

  return (
    <div className="rc_shell">
      {/* SIDEBAR (filtros + totales) */}
      <aside className="rc_side">
        <div className="rc_brand">DESKBOARD</div>

        <div className="rc_side_group">
          <div className="rc_side_title">
            <FontAwesomeIcon icon={faFilter} /> Filtros
          </div>

          <label className="rc_slabel" htmlFor="anio">
            Año
          </label>
          <select
            id="anio"
            className="rc_sselect"
            value={anioRes}
            onChange={(e) => setAnioRes(Number(e.target.value))}
          >
            {aniosCat.length ? (
              aniosCat.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))
            ) : (
              <option value={anioRes}>{anioRes}</option>
            )}
          </select>

          <div className="rc_sublabel">Serie</div>
          <div className="rc_spills">
            <button
              className={`rc_spill ${serie === "ingresos" ? "active" : ""}`}
              onClick={() => setSerie("ingresos")}
              type="button"
            >
              Ingresos
            </button>
            <button
              className={`rc_spill ${serie === "egresos" ? "active" : ""}`}
              onClick={() => setSerie("egresos")}
              type="button"
            >
              Egresos
            </button>
            <button
              className={`rc_spill ${serie === "saldo" ? "active" : ""}`}
              onClick={() => setSerie("saldo")}
              type="button"
            >
              Saldo
            </button>
          </div>
        </div>

        {/* Totales en el panel lateral */}
        <div className="rc_side_metrics">
          <div className="rc_metric side">
            <div className="rc_metric__icon ing">+</div>
            <div>
              <p className="rc_metric__label">Total Ingresos</p>
              <p className="rc_metric__value">
                ${totals.ingresos.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
          <div className="rc_metric side">
            <div className="rc_metric__icon egr">–</div>
            <div>
              <p className="rc_metric__label">Total Egresos</p>
              <p className="rc_metric__value">
                ${totals.egresos.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
          <div className="rc_metric side">
            <div className={`rc_metric__icon ${totals.saldo >= 0 ? "ok" : "warn"}`}>Σ</div>
            <div>
              <p className="rc_metric__label">Resultado</p>
              <p className="rc_metric__value">
                ${totals.saldo.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="rc_main">
        <header className="rc_topbar">
          <h2 className="rc_title">Resumen Contable</h2>
        </header>

        {/* Card con pestañas (anual / mensual) */}
        <section className="rc_card card">
          <header className="rc_card__header">
            <div className="rc_tabs_main">
              <button
                className={`rc_mtab ${chartTab === "anual" ? "active" : ""}`}
                onClick={() => setChartTab("anual")}
                type="button"
              >
                Composición anual
              </button>
              <button
                className={`rc_mtab ${chartTab === "mensual" ? "active" : ""}`}
                onClick={() => setChartTab("mensual")}
                type="button"
              >
                Serie mensual
              </button>
            </div>
          </header>

          <div className="rc_chart_body">
            {chartTab === "anual" ? (
              <DonutChart ingresos={totals.ingresos} egresos={totals.egresos} />
            ) : (
              <LineChart data={lineData} serieName={serie} color={serieColor} />
            )}
          </div>
        </section>

        {/* Tabla */}
        <section className="rc_card card">
          <header className="rc_card__header">
            <h3>Resumen anual</h3>
          </header>

          <div className="rc_table__wrap">
            <div className="gt_table gt_cols-4" role="table" aria-label="Resumen por mes">
              <div className="gt_header" role="row">
                <div className="gt_cell h" role="columnheader">Mes</div>
                <div className="gt_cell h right" role="columnheader">Ingresos</div>
                <div className="gt_cell h right" role="columnheader">Egresos</div>
                <div className="gt_cell h right" role="columnheader">Resultado</div>
              </div>

              {meses12.map((r, idx) => (
                <div className="gt_row" role="row" key={idx}>
                  <div className="gt_cell" role="cell">{r.nombre_mes}</div>
                  <div className="gt_cell right" role="cell">
                    ${Number(r.ingresos || 0).toLocaleString("es-AR")}
                  </div>
                  <div className="gt_cell right" role="cell">
                    ${Number(r.egresos || 0).toLocaleString("es-AR")}
                  </div>
                  <div
                    className={`gt_cell right ${Number(r.saldo) >= 0 ? "pos" : "neg"}`}
                    role="cell"
                  >
                    ${Number(r.saldo || 0).toLocaleString("es-AR")}
                  </div>
                </div>
              ))}

              {!meses12.length && !loadingRes && <div className="gt_empty">Sin datos</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
