import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./ResumenContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();

const MESES = [
  "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"
];

/* ---------- Helpers de fetch ---------- */
const fetchJSON = async (url, options) => {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ---------- DonutChart (Ingresos vs Egresos) ---------- */
function DonutChart({ ingresos = 0, egresos = 0 }) {
  const total = Math.max(ingresos + egresos, 1);
  const pIng  = ingresos / total;
  const pEgr  = egresos / total;

  const size = 180;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const arcIng = `${c * pIng} ${c * (1 - pIng)}`;
  const arcEgr = `${c * pEgr} ${c * (1 - pEgr)}`;

  return (
    <div className="rc_donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Ingresos vs Egresos">
        <defs>
          <linearGradient id="gradIng" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="gradEgr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        {/* base */}
        <circle cx={size/2} cy={size/2} r={r} stroke="#eef2ff" strokeWidth={stroke} fill="none"/>
        {/* ingresos */}
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#gradIng)" strokeWidth={stroke} fill="none"
          strokeDasharray={arcIng} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        {/* egresos (continua el círculo) */}
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#gradEgr)" strokeWidth={stroke} fill="none"
          strokeDasharray={arcEgr} strokeLinecap="round"
          transform={`rotate(${(pIng*360)-90} ${size/2} ${size/2})`}
        />

        {/* valor total en el centro */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="rc_donut_total">
          ${(ingresos).toLocaleString("es-AR")}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="rc_donut_label">Ingresos</text>
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

/* ---------- LineChart (serie mensual) ---------- */
function LineChart({ data = [], serieName = "Ingresos" }) {
  // data: [{label:'Ene', value:1234}]
  const W = 700, H = 240, P = 24;
  const maxV = Math.max(...data.map(d => d.value), 1);
  const xStep = (W - P*2) / Math.max(data.length-1, 1);

  const points = data.map((d, i) => {
    const x = P + i * xStep;
    const y = P + (1 - (d.value / maxV)) * (H - P*2);
    return [x, y];
  });

  const path = points.map((p,i)=>`${i===0?'M':'L'}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L ${P + (data.length-1)*xStep},${H-P} L ${P},${H-P} Z`;

  return (
    <div className="rc_line">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={`Serie mensual ${serieName}`}>
        <defs>
          <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#93c5fd" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* ejes suaves */}
        <g className="axis">
          {[0.25,0.5,0.75,1].map((p, i)=>(
            <line key={i} x1={P} x2={W-P} y1={P + (1-p)*(H-P*2)} y2={P + (1-p)*(H-P*2)} />
          ))}
        </g>

        {/* área + línea */}
        <path d={area} fill="url(#gradLine)" />
        <path d={path} stroke="#6366f1" strokeWidth="2.5" fill="none" filter="url(#soft)" />

        {/* puntos */}
        {points.map((p, i)=>(
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="3.6" fill="#6366f1" />
          </g>
        ))}

        {/* labels X */}
        {data.map((d,i)=>(
          <text key={i} x={P + i*xStep} y={H-4} textAnchor="middle" className="rc_line_label">{d.label}</text>
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

  // Años desde endpoint de ingresos (igual que IngresosContable)
  const loadAniosDisponibles = async (prefer = anioRes) => {
    try {
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&year=${prefer}&detalle=1`);
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
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=resumen&year=${anioRes}`);
      setResumen(raw?.resumen || []);
    } catch (e) {
      console.error(e);
      setResumen([]);
    } finally {
      setLoadingRes(false);
    }
  };

  useEffect(() => { loadAniosDisponibles(Y); }, []);
  useEffect(() => { loadResumen(); }, [anioRes]);

  // Normalizamos 12 meses
  const meses12 = useMemo(() => {
    const byMes = new Map(resumen.map(r => [Number(r.mes), r]));
    return Array.from({length:12}, (_,i)=>{
      const m = i+1;
      const r = byMes.get(m) || { ingresos:0, egresos:0, saldo:0, nombre_mes: MESES[i], mes:m, anio:anioRes };
      return { ...r, nombre_mes: r.nombre_mes || MESES[i] };
    });
  }, [resumen, anioRes]);

  const totals = useMemo(()=>({
    ingresos: meses12.reduce((a,b)=> a + Number(b.ingresos||0), 0),
    egresos:  meses12.reduce((a,b)=> a + Number(b.egresos||0), 0),
    saldo:    meses12.reduce((a,b)=> a + Number(b.saldo  ||0), 0),
  }), [meses12]);

  const lineData = useMemo(()=> {
    const key = serie;
    return meses12.map((m)=>({ label: m.nombre_mes, value: Number(m[key]||0) }));
  }, [meses12, serie]);

  return (
    <div className="rc_wrap">
      {/* Toolbar */}


      {/* Métricas */}
      <div className="rc_metrics">
        <div className="rc_metric card">
          <div className="rc_metric__icon ing">+</div>
          <div>
            <p className="rc_metric__label">Total Ingresos</p>
            <p className="rc_metric__value">${totals.ingresos.toLocaleString("es-AR")}</p>
          </div>
        </div>
        <div className="rc_metric card">
          <div className="rc_metric__icon egr">–</div>
          <div>
            <p className="rc_metric__label">Total Egresos</p>
            <p className="rc_metric__value">${totals.egresos.toLocaleString("es-AR")}</p>
          </div>
        </div>
        <div className="rc_metric card">
          <div className={`rc_metric__icon ${totals.saldo>=0?'ok':'warn'}`}>Σ</div>
          <div>
            <p className="rc_metric__label">Resultado</p>
            <p className="rc_metric__value">${totals.saldo.toLocaleString("es-AR")}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="rc_grid">
        <section className="rc_card card">
          <header className="rc_card__header">
            <h3><FontAwesomeIcon icon={faChartPie}/> Composición anual</h3>
          </header>
          <DonutChart ingresos={totals.ingresos} egresos={totals.egresos} />
        </section>

        <section className="rc_card card">
          <header className="rc_card__header">
            <h3>Serie mensual: {serie[0].toUpperCase()+serie.slice(1)}</h3>
          </header>
          <LineChart data={lineData} serieName={serie} />
        </section>
      </div>

      {/* Tabla (Grid) */}
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

            {meses12.map((r, idx)=>(
              <div className="gt_row" role="row" key={idx}>
                <div className="gt_cell" role="cell">{r.nombre_mes}</div>
                <div className="gt_cell right" role="cell">${Number(r.ingresos||0).toLocaleString("es-AR")}</div>
                <div className="gt_cell right" role="cell">${Number(r.egresos||0).toLocaleString("es-AR")}</div>
                <div className={`gt_cell right ${Number(r.saldo)>=0?'pos':'neg'}`} role="cell">
                  ${Number(r.saldo||0).toLocaleString("es-AR")}
                </div>
              </div>
            ))}

            {!meses12.length && !loadingRes && (
              <div className="gt_empty">Sin datos</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
