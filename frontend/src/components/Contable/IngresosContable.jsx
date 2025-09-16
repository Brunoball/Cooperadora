import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faMoneyBillWave, faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./IngresosContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();

export default function IngresosContable() {
  const [anioIng, setAnioIng] = useState(Y);
  const [mesIng, setMesIng] = useState(new Date().getMonth() + 1);

  const [ingresos, setIngresos] = useState([]);
  const [detalle, setDetalle] = useState({});
  const [mesesCat, setMesesCat] = useState([]); // [{id, nombre}]
  const [aniosCat, setAniosCat] = useState([]); // [2025, 2024, ...]
  const [loadingIng, setLoadingIng] = useState(false);
  const [busqueda, setBusqueda] = useState(""); // filtro por alumno

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const loadMeses = async () => {
    try {
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      if (raw?.exito) {
        const arr = Array.isArray(raw?.listas?.meses) ? raw.listas.meses : [];
        setMesesCat(arr.map((m) => ({ id: Number(m.id), nombre: String(m.nombre) })));
      } else setMesesCat([]);
    } catch (e) {
      console.error("obtener_listas error:", e);
      setMesesCat([]);
    }
  };

  const loadIngresos = async () => {
    setLoadingIng(true);
    try {
      const base = `${BASE_URL}/api.php?action=contable_ingresos&year=${anioIng}`;
      const raw = await fetchJSON(`${base}&detalle=1`);
      if (raw?.exito) {
        setIngresos(raw.resumen || []);
        setDetalle(raw.detalle || {});
        const anios = Array.isArray(raw.anios_disponibles) ? raw.anios_disponibles : [];
        setAniosCat(anios);
        if (anios.length > 0 && !anios.includes(anioIng)) setAnioIng(anios[0]);
      } else {
        setIngresos([]); setDetalle({}); setAniosCat([]);
      }
    } catch (e) {
      console.error("contable_ingresos error:", e);
      setIngresos([]); setDetalle({}); setAniosCat([]);
    } finally { setLoadingIng(false); }
  };

  useEffect(() => { loadMeses(); }, []);
  useEffect(() => { loadIngresos(); }, [anioIng]);

  const monthKey = (y, m) => `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}`;

  const detalleMesSel = useMemo(
    () => detalle[monthKey(anioIng, mesIng)] || [],
    [detalle, anioIng, mesIng]
  );

  const mesesOptions = useMemo(() => {
    if (Array.isArray(mesesCat) && mesesCat.length > 0) return mesesCat;
    return Array.from({ length: 12 }, (_, i) => ({ id: i + 1, nombre: `Mes ${i + 1}` }));
  }, [mesesCat]);

  const getNombreMesPagado = (row) => {
    const nombre = (row?.Mes_pagado || "").toString().trim();
    if (nombre) return nombre;
    const id = Number(row?.Mes_pagado_id || 0);
    const m = mesesOptions.find((x) => x.id === id);
    return m ? m.nombre : "-";
  };

  const detalleFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return detalleMesSel;
    return detalleMesSel.filter((r) => (r.Alumno || "").toLowerCase().includes(q));
  }, [detalleMesSel, busqueda]);

  const resumenMesSel = useMemo(
    () => ingresos.find((x) => x.anio === anioIng && x.mes === mesIng) || {},
    [ingresos, anioIng, mesIng]
  );

  const categoriasOrdenadas = useMemo(() => {
    const arr = Array.isArray(resumenMesSel.categorias) ? resumenMesSel.categorias : [];
    return [...arr].sort((a, b) => (Number(b.monto||0) - Number(a.monto||0)));
  }, [resumenMesSel]);

  return (
    <div className="ing-wrap">
      {/* ===== Toolbar: filtros + Ventanita de categorías (derecha) + KPIs abajo ===== */}
      <div className="ing-toolbar card">
        {/* Filtros (Año, Mes, Buscar) */}
        <div className="ing-filters">
          <div className="ing-group">
            <label className="ing-label">Año</label>
            <select
              className="ing-select"
              value={anioIng}
              onChange={(e) => setAnioIng(Number(e.target.value))}
            >
              {aniosCat.length === 0
                ? <option value={anioIng}>{anioIng}</option>
                : aniosCat.map((a) => <option key={a} value={a}>{a}</option>)
              }
            </select>
          </div>

          <div className="ing-group">
            <label className="ing-label">Mes</label>
            <select
              className="ing-select"
              value={mesIng}
              onChange={(e) => setMesIng(Number(e.target.value))}
            >
              {mesesOptions.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>

          <div className="ing-group ing-group--grow">
            <label className="ing-label">Buscar alumno</label>
            <div className="ing-search">
              <FontAwesomeIcon icon={faSearch} />
              <input
                className="ing-input"
                type="text"
                placeholder="Apellido, nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Ventanita compacta de categorías (ocupa la columna derecha y abarca 2 filas) */}
        <aside className="ing-cat-mini" aria-label="Categorías del mes">
          <header className="ing-cat-mini__header">
            <FontAwesomeIcon icon={faChartPie} />
            <h4>Categorías del mes</h4>
          </header>

          <div className="ing-cat-mini__body">
            {categoriasOrdenadas.length === 0 ? (
              <div className="ing-mini-empty">Sin datos</div>
            ) : (
              <ul className="ing-cat-mini__list">
                {categoriasOrdenadas.map((c, i) => (
                  <li key={i} className="ing-cat-mini__item">
                    <div className="ing-cat-mini__left">
                      <span className="ing-badge">{c.nombre || "-"}</span>
                      <span className="ing-count" title="Registros">{c.cantidad || 0}</span>
                    </div>
                    <div className="ing-cat-mini__right">
                      ${Number(c.monto || 0).toLocaleString("es-AR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* KPIs debajo de los filtros (solo columna de la izquierda) */}
        <div className="ing-kpis">
          <div className="ing-kpi">
            <div className="ing-kpi__icon ingresos">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div>
              <p className="ing-kpi__label">Ingresos del mes</p>
              <p className="ing-kpi__value">
                ${Number(resumenMesSel.ingresos || 0).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="ing-kpi">
            <div className="ing-kpi__icon neutral">🧾</div>
            <div>
              <p className="ing-kpi__label">Cobros (cant.)</p>
              <p className="ing-kpi__value">{resumenMesSel.cantidad || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Contenido principal: Detalle del mes a ancho completo ===== */}
      <section className="ing-card card">
        <header className="ing-card__header">
          <h3>Detalle del mes</h3>
        </header>
        <div className="ing-table__wrap">
          <div className="ing-gt-table ing-gt-cols-5" role="table" aria-label="Detalle de ingresos">
            <div className="ing-gt-headerr" role="row">
              <div className="ing-gt-cell h" role="columnheader">Fecha</div>
              <div className="ing-gt-cell h" role="columnheader">Alumno</div>
              <div className="ing-gt-cell h" role="columnheader">Categoría</div>
              <div className="ing-gt-cell h right" role="columnheader">Monto</div>
              <div className="ing-gt-cell h" role="columnheader">Mes pagado</div>
            </div>

            {detalleFiltrado.map((r, idx) => (
              <div className="ing-gt-roww" role="row" key={idx}>
                <div className="ing-gt-cell" role="cell">{r.fecha_pago}</div>
                <div className="ing-gt-cell strong" role="cell">{r.Alumno}</div>
                <div className="ing-gt-cell" role="cell">
                  <span className="ing-badge ing-badge--soft">{r.Categoria || "-"}</span>
                </div>
                <div className="ing-gt-cell right" role="cell">
                  ${Number(r.Monto || 0).toLocaleString("es-AR")}
                </div>
                <div className="ing-gt-cell" role="cell">{getNombreMesPagado(r)}</div>
              </div>
            ))}

            {!detalleFiltrado.length && <div className="ing-gt-empty">Sin pagos</div>}
          </div>
        </div>
      </section>

      {/* Loader */}
      {loadingIng && (
        <div className="ing-loader">
          <div className="ing-spinner" />
          <span>Cargando…</span>
        </div>
      )}
    </div>
  );
}
