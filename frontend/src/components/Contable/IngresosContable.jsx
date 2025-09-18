import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faFilter, faChartPie } from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../config/config";
import "./IngresosContable.css";

/* === Utilidades === */
const hoy = new Date();
const Y = hoy.getFullYear();
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

/* Formateador ARS sin decimales (tablas) */
const fmtMonto = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

/* Clase visual para categorías (Interno/Externo) */
const pillClassByCategoria = (cat) => {
  const n = (cat || "").toString().trim().toLowerCase();
  if (n === "interno" || n === "interna") return "pill pill--interno";
  if (n === "externo" || n === "externa") return "pill pill--externo";
  return "pill";
};

export default function IngresosContable() {
  /* Filtros */
  const [anio, setAnio] = useState(Y);
  const [mes, setMes]   = useState(new Date().getMonth() + 1);
  const [query, setQuery] = useState("");

  /* Datos */
  const [filas, setFilas] = useState([]);          // registros del mes
  const [anios, setAnios] = useState([Y, Y - 1]);  // años disponibles
  const [cargando, setCargando] = useState(false);

  /* Animación en cascada */
  const [cascading, setCascading] = useState(false);

  /* --------------------------
     Carga de datos desde API
  -------------------------- */
  const loadData = async () => {
    setCargando(true);
    try {
      const base = `${BASE_URL}/api.php?action=contable_ingresos&year=${anio}&detalle=1`;
      const res = await fetch(`${base}&ts=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      if (Array.isArray(raw?.anios_disponibles) && raw.anios_disponibles.length) {
        setAnios(raw.anios_disponibles);
      }

      const key = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
      const det = Array.isArray(raw?.detalle?.[key]) ? raw.detalle[key] : [];

      const rows = det.map((r, i) => ({
        id: `${r?.fecha_pago || ""}|${r?.Alumno || ""}|${r?.Monto || 0}|${i}`, // key estable
        fecha: r?.fecha_pago ?? "",
        alumno: r?.Alumno ?? "",
        categoria: r?.Categoria ?? "-",
        monto: Number(r?.Monto ?? 0),
        mesPagado: r?.Mes_pagado || MESES[(Number(r?.Mes_pagado_id || 0) - 1)] || "-",
      }));

      setFilas(rows);
    } catch (e) {
      console.error("Error al cargar ingresos:", e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { loadData(); }, [anio, mes]);

  /* Derivados */
  const filasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q
      ? filas
      : filas.filter((f) =>
          (f.alumno || "").toLowerCase().includes(q) ||
          (f.categoria || "").toLowerCase().includes(q) ||
          (f.fecha || "").toLowerCase().includes(q) ||
          (f.mesPagado || "").toLowerCase().includes(q)
        );
  }, [filas, query]);

  const resumen = useMemo(() => {
    const total = filasFiltradas.reduce((acc, f) => acc + Number(f.monto || 0), 0);
    return { total, cantidad: filasFiltradas.length };
  }, [filasFiltradas]);

  const categoriasMes = useMemo(() => {
    const map = new Map();
    filas.forEach((f) => {
      const key = f.categoria || "-";
      const prev = map.get(key) || { nombre: key, cantidad: 0, monto: 0 };
      prev.cantidad += 1;
      prev.monto += Number(f.monto || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [filas]);

  /* Cascada sutil cuando cambian filtros de vista */
  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 500);
    return () => clearTimeout(t);
  }, [anio, mes, query]);

  return (
    <div className="ing-wrap">
      <div className="ing-main">
        {/* Header simple */}
        <header className="card ing-head">
          <div>
            <h2 className="h2">Ingresos</h2>
            <small className="muted">Detalle — {MESES[mes - 1]} {anio}</small>
          </div>
          <div className="ing-kpis">
            <div className="kpi">
              <span className="kpi-label">Total</span>
              <span className="kpi-value num">{fmtMonto(resumen.total)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Registros</span>
              <span className="kpi-value num">{resumen.cantidad}</span>
            </div>
          </div>
        </header>

        {/* Filtros horizontales */}
        <section className="card ing-filterbar">
          <div className="bar-title">
            <FontAwesomeIcon icon={faFilter} />
            <span>Filtros</span>
          </div>

          <div className="bar-grid">
            <div className="field">
              <label htmlFor="anio">Año</label>
              <select id="anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {anios.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="mes">Mes</label>
              <select id="mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="buscar">Buscar</label>
              <div className="input-icon">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  id="buscar"
                  type="text"
                  placeholder="Alumno, categoría, fecha…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Chips de categorías (top 6) */}
        <section className="card ing-cats">
          <div className="cats-title">
            <FontAwesomeIcon icon={faChartPie} />
            <span>Categorías del mes</span>
          </div>
          <div className="cats-chips">
            {categoriasMes.length === 0 ? (
              <span className="muted">Sin datos</span>
            ) : (
              categoriasMes.slice(0, 6).map((c, i) => (
                <div className="chip" key={i} title={`${c.cantidad} registros`}>
                  <span className="chip-name">{(c.nombre || "-").toString().toUpperCase()}</span>
                  <span className="chip-amount num">{fmtMonto(c.monto)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Tabla */}
        <section className="card ing-page">
          <div
            className={`ing-tablewrap ${cargando ? "is-loading" : ""}`}
            role="table"
            aria-label="Listado de ingresos"
          >
            {/* Overlay de loading SOLO en la tabla */}
            {cargando && (
              <div className="ing-tableloader" role="status" aria-live="polite">
                <div className="ing-spinner" />
                <span>Cargando…</span>
              </div>
            )}

            <div className="ing-row h" role="row">
              <div className="c-fecha">Fecha</div>
              <div className="c-alumno">Alumno</div>
              <div className="c-cat">Categoría</div>
              <div className="c-monto t-right">Monto</div>
              <div className="c-mes">Mes pagado</div>
            </div>

            {filasFiltradas.map((f, idx) => (
              <div
                className={`ing-row data ${cascading ? "casc" : ""}`}
                role="row"
                key={f.id}
                style={{ "--i": idx }}
              >
                <div className="c-fecha">{f.fecha}</div>
                <div className="c-alumno">
                  <div className="ing-alumno">
                    <div className="ing-alumno__text">
                      <div className="strong">{f.alumno}</div>
                    </div>
                  </div>
                </div>
                <div className="c-cat">
                  <span className={pillClassByCategoria(f.categoria)}>{f.categoria}</span>
                </div>
                <div className="c-monto t-right">
                  <span className="num strong-amount">{fmtMonto(f.monto)}</span>
                </div>
                <div className="c-mes">{f.mesPagado}</div>
              </div>
            ))}

            {!filasFiltradas.length && !cargando && (
              <div className="ing-empty big">Sin pagos</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
