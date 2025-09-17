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

  /* UI: sidebar móvil */
  const [sideOpen, setSideOpen] = useState(true);

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

  /* Dispara cascada cuando cambian filtros de vista */
  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 600);
    return () => clearTimeout(t);
  }, [anio, mes, query]);

  /* Clases sidebar */
  const sideClass = ["ing-side", sideOpen ? "is-open" : "is-closed"].join(" ");

  return (
    <div className="ing-wrap">
      {/* ====== Layout ====== */}
      <div className="ing-layout">
        {/* Sidebar con filtros + categorías del mes */}
        <aside className={sideClass} aria-label="Barra lateral">
          <div className="ing-side__inner">
            <div className="ing-side__row">
              <div className="ing-sectiontitle">
                <FontAwesomeIcon icon={faFilter} />
                <span>Filtros</span>
              </div>
            </div>

            {/* Año + Mes en la misma fila */}
            <div className="ing-fieldrow">
              <div className="ing-field">
                <label htmlFor="anio">Año</label>
                <select id="anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                  {anios.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="ing-field">
                <label htmlFor="mes">Mes</label>
                <select id="mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ing-field">
              <label htmlFor="buscar">Buscar alumno / categoría</label>
              <div className="ing-inputicon">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  id="buscar"
                  type="text"
                  placeholder="Escribe para filtrar…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="ing-divider" />

            <div className="ing-sectiontitle">
              <FontAwesomeIcon icon={faChartPie} />
              <span>Categorías del mes</span>
            </div>

            {categoriasMes.length === 0 ? (
              <div className="ing-empty">Sin datos</div>
            ) : (
              <ul className="ing-catlist" role="list">
                {categoriasMes.map((c, i) => (
                  <li className="ing-catitem" key={i}>
                    <div className="ing-catline">
                      <span className="ing-catname">{(c.nombre || "-").toString().toUpperCase()}</span>
                      <span className="ing-catamount num">{fmtMonto(c.monto)}</span>
                    </div>
                    <div className="ing-catmeta">
                      {c.cantidad} {c.cantidad === 1 ? "registro" : "registros"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Contenido */}
        <main className="ing-main">
          <div className="ing-tabs card">
            <header className="ing-page__header">
              <div>
                <h2 className="h2">Ingresos</h2>
                <small className="muted">
                  Detalle del mes — {MESES[mes - 1]} {anio}
                </small>
              </div>
              <div className="ing-rightstats">
                <div>Total ingresos: <b className="num highlight">{fmtMonto(resumen.total)}</b></div>
                <div>Registros: <b className="num">{resumen.cantidad}</b></div>
              </div>
            </header>
          </div>

          <div className="ing-page card">
            {/* Tabla (scroll interno + header sticky + zebra + cascada + loader interno) */}
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
                    <span className="num highlight strong-amount">{fmtMonto(f.monto)}</span>
                  </div>
                  <div className="c-mes">{f.mesPagado}</div>
                </div>
              ))}

              {!filasFiltradas.length && !cargando && (
                <div className="ing-empty big">Sin pagos</div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Overlay móvil para cerrar sidebar */}
      {sideOpen && (
        <button
          className="ing-layout__overlay"
          onClick={() => setSideOpen(false)}
          aria-label="Cerrar panel"
        />
      )}
    </div>
  );
}
