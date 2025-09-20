// src/components/Contable/IngresosContable.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faChartPie,
  faBars,
  faPlus,
  faCalendarDays,
  faCreditCard,
  faUser,
  faFileLines,
  faDollarSign,
  faFloppyDisk,
  faFileExcel,
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../config/config";
import "./IngresosContable.css";

/* === Utilidades === */
const hoy = new Date();
const Y = hoy.getFullYear();
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const fmtMonto = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

/* ===== helpers export (versión robusta) ===== */
function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n;]/.test(s);
    const withQ = s.replace(/"/g, '""');
    return needs ? `"${withQ}"` : withQ;
  };
  const head = headers.map(esc).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  // BOM para que Excel abra UTF-8 con acentos correctamente
  return `\uFEFF${head}\n${body}`;
}

async function exportToExcelLike({ workbookName, sheetName, rows }) {
  const safeDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // revocar luego para no interrumpir descarga
  };

  if (!rows || !rows.length) return;

  // Intentar XLSX
  try {
    // Asegurate de tener: npm i xlsx
    const maybe = await import("xlsx");
    const XLSX = maybe.default || maybe;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Datos");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    safeDownload(blob, `${workbookName}.xlsx`);
    return;
  } catch (e) {
    // Fallback a CSV si no está xlsx o falla el import
  }

  const headers = Object.keys(rows[0] || {});
  const csv = toCSV(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  safeDownload(blob, `${workbookName}.csv`);
}

/* ========= Modal de Ingreso ========= */
function ModalIngreso({ open, onClose, onSaved, defaultDate, medios }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: defaultDate || new Date().toISOString().slice(0,10),
    denominacion: "",
    descripcion: "",
    importe: "",
    id_medio_pago: medios?.[0]?.id || "",
  });

  const dateRef = useRef(null);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      fecha: defaultDate || new Date().toISOString().slice(0,10),
      id_medio_pago: medios?.[0]?.id || "",
    }));
  }, [defaultDate, medios]);

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = v.replace(/[^\d.,]/g, "");
    setForm((s) => ({ ...s, [k]: v }));
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.denominacion.trim()) return alert("Ingresá una denominación.");
    if (!form.fecha) return alert("Seleccioná la fecha.");
    if (!importeNumber || importeNumber <= 0) return alert("Ingresá un importe válido.");
    if (!form.id_medio_pago) return alert("Seleccioná un medio de pago.");

    try {
      setSaving(true);
      const res = await fetch(`${BASE_URL}/api.php?action=ingresos_create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: form.fecha,
          denominacion: form.denominacion.trim(),
          descripcion: form.descripcion.trim(),
          importe: importeNumber,
          id_medio_pago: Number(form.id_medio_pago),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.exito) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingModalTitle">
      <div className="ing-modal ing-modal--elev">
        {/* HEAD */}
        <div className="ing-modal__head gradient--brand-red">
          <div className="ing-modal__title">
            <div className="ing-modal__badge">
              <FontAwesomeIcon icon={faPlus} />
            </div>
            <h3 id="ingModalTitle">Registrar ingreso</h3>
          </div>
          <button className="ghost-btn ghost-btn--light" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* BODY */}
        <form className="ing-modal__body" onSubmit={submit}>
          <div className="grid2">
            {/* Fecha: click en TODO el control abre el calendario */}
            <div className="field field--icon field--date">
              <label>Fecha</label>
              <div
                className="control control--clickable"
                onMouseDown={(e) => {
                  if (e.target !== dateRef.current) e.preventDefault();
                  const el = dateRef.current;
                  if (!el) return;
                  if (typeof el.showPicker === "function") {
                    try { el.showPicker(); return; } catch {}
                  }
                  el.focus();
                  el.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const el = dateRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") {
                      try { el.showPicker(); return; } catch {}
                    }
                    el.focus();
                    el.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Abrir selector de fecha"
              >
                <span className="i">
                  <FontAwesomeIcon icon={faCalendarDays} />
                </span>
                <input
                  ref={dateRef}
                  type="date"
                  value={form.fecha}
                  onChange={onChange("fecha")}
                  onMouseDown={(e) => {
                    if (dateRef.current?.showPicker) {
                      e.preventDefault(); // deja que el wrapper haga el gesto
                    }
                  }}
                />
              </div>
            </div>

            <div className="field field--icon">
              <label>Medio de pago</label>
              <div className="control">
                <span className="i">
                  <FontAwesomeIcon icon={faCreditCard} />
                </span>
                <select value={form.id_medio_pago} onChange={onChange("id_medio_pago")}>
                  {Array.isArray(medios) && medios.length ? (
                    medios.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)
                  ) : (
                    <option value="">(sin medios)</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="field field--icon">
            <label>Denominación</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faUser} />
              </span>
              <input
                type="text"
                placeholder="Ej: GAMBOGGI ALEXANDER"
                value={form.denominacion}
                onChange={onChange("denominacion")}
              />
            </div>
          </div>

          <div className="field field--icon">
            <label>Descripción</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faFileLines} />
              </span>
              <input
                type="text"
                placeholder="Ej: INTERNADO, ALQ. CARTEL"
                value={form.descripcion}
                onChange={onChange("descripcion")}
              />
            </div>
          </div>

          <div className="field field--icon">
            <label>Importe (ARS)</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faDollarSign} />
              </span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={form.importe}
                onChange={onChange("importe")}
              />
            </div>
          </div>

          {/* FOOT */}
          <div className="ing-modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn sm solid" disabled={saving}>
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{saving ? "Guardando…" : "Guardar ingreso"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========= Componente principal ========= */
export default function IngresosContable() {
  const [anio, setAnio] = useState(Y);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [query, setQuery] = useState("");

  const [filas, setFilas] = useState([]);           // alumnos
  const [anios, setAnios] = useState([Y, Y - 1]);
  const [cargando, setCargando] = useState(false);

  const [filasIngresos, setFilasIngresos] = useState([]); // ingresos manuales
  const [cargandoIngresos, setCargandoIngresos] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);

  const [sideOpen, setSideOpen] = useState(true);
  const [cascading, setCascading] = useState(false);
  const [innerTab, setInnerTab] = useState("alumnos"); // "alumnos" | "manuales"
  const [openModal, setOpenModal] = useState(false);

  /* ====== CARGA API ====== */
  const loadPagosAlumnos = useCallback(async () => {
    setCargando(true);
    try {
      const url = `${BASE_URL}/api.php?action=contable_ingresos&year=${anio}&detalle=1&ts=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      if (Array.isArray(raw?.anios_disponibles) && raw.anios_disponibles.length) {
        setAnios(raw.anios_disponibles);
      }

      const key = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
      const det = Array.isArray(raw?.detalle?.[key]) ? raw.detalle[key] : [];

      const rows = det.map((r, i) => ({
        id: `${r?.fecha_pago || ""}|${r?.Alumno || ""}|${r?.Monto || 0}|${i}`,
        fecha: r?.fecha_pago ?? "",
        alumno: r?.Alumno ?? "",
        categoria: r?.Categoria ?? "-",
        monto: Number(r?.Monto ?? 0),
        mesPagado: r?.Mes_pagado || MESES[(Number(r?.Mes_pagado_id || 0) - 1)] || "-",
      }));

      setFilas(rows);
    } catch (e) {
      console.error("Error al cargar ingresos alumnos:", e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [anio, mes]);

  const loadMediosPago = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=obtener_listas&ts=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = data?.listas?.medios_pago || [];
      setMediosPago(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("Error cargando medios de pago:", e);
      setMediosPago([]);
    }
  }, []);

  const loadIngresos = useCallback(async () => {
    setCargandoIngresos(true);
    try {
      const url = `${BASE_URL}/api.php?action=ingresos_list&year=${anio}&month=${mes}&ts=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : [];
      const rows = list.map((r) => ({
        id: `I|${r.id_ingreso}`,
        fecha: r.fecha,
        denominacion: r.denominacion,
        descripcion: r.descripcion || "",
        importe: Number(r.importe || 0),
        medio: r.medio_pago || "",
      }));
      setFilasIngresos(rows);
    } catch (e) {
      console.error("Error al cargar tabla ingresos:", e);
      setFilasIngresos([]);
    } finally {
      setCargandoIngresos(false);
    }
  }, [anio, mes]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPagosAlumnos(), loadMediosPago(), loadIngresos()]);
  }, [loadPagosAlumnos, loadMediosPago, loadIngresos]);

  useEffect(() => { loadAll(); }, [anio, mes, loadAll]);

  /* Derivados */
  const filasFiltradasAlu = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? filas : filas.filter((f) =>
      (f.alumno || "").toLowerCase().includes(q) ||
      (f.categoria || "").toLowerCase().includes(q) ||
      (f.fecha || "").toLowerCase().includes(q) ||
      (f.mesPagado || "").toLowerCase().includes(q)
    );
  }, [filas, query]);

  const filasFiltradasIng = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? filasIngresos : filasIngresos.filter((f) =>
      (f.denominacion || "").toLowerCase().includes(q) ||
      (f.descripcion || "").toLowerCase().includes(q) ||
      (f.fecha || "").toLowerCase().includes(q) ||
      (String(f.importe) || "").toLowerCase().includes(q) ||
      (f.medio || "").toLowerCase().includes(q)
    );
  }, [filasIngresos, query]);

  const resumen = useMemo(() => {
    const base = innerTab === "alumnos" ? filasFiltradasAlu : filasFiltradasIng;
    const total = base.reduce((acc, f) => acc + Number((f.monto ?? f.importe) || 0), 0);
    return { total, cantidad: base.length };
  }, [filasFiltradasAlu, filasFiltradasIng, innerTab]);

  const categoriasMes = useMemo(() => {
    const map = new Map();
    const base = innerTab === "alumnos" ? filas : filasIngresos;
    base.forEach((f) => {
      const key = innerTab === "alumnos" ? (f.categoria || "-") : (f.medio || "-");
      const prev = map.get(key) || { nombre: key, cantidad: 0, monto: 0 };
      prev.cantidad += 1;
      prev.monto += Number((f.monto ?? f.importe) || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [filas, filasIngresos, innerTab]);

  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 500);
    return () => clearTimeout(t);
  }, [anio, mes, query, innerTab]);

  const sideClass = ["ing-side", sideOpen ? "is-open" : "is-closed"].join(" ");

  /* ===== Export handler ===== */
  const onExport = async () => {
    const isAlu = innerTab === "alumnos";
    const base = isAlu ? filasFiltradasAlu : filasFiltradasIng;
    if (!base.length) {
      alert("No hay datos para exportar.");
      return;
    }
    let rows;
    if (isAlu) {
      rows = base.map((r) => ({
        Fecha: r.fecha,
        Alumno: r.alumno,
        Categoría: r.categoria,
        Monto: r.monto,
        "Mes pagado": r.mesPagado,
      }));
    } else {
      rows = base.map((r) => ({
        Fecha: r.fecha,
        Denominación: r.denominacion,
        Descripción: r.descripcion,
        Importe: r.importe,
        Medio: r.medio,
      }));
    }
    const wbName = `Ingresos_${MESES[mes - 1]}_${anio}_${isAlu ? "Alumnos" : "Ingresos"}`;
    await exportToExcelLike({ workbookName: wbName, sheetName: "Datos", rows });
  };

  return (
    <div className="ing-wrap">
      <div className="ing-layout">
        {/* Sidebar */}
        <aside className={sideClass} aria-label="Barra lateral">
          <div className="ing-side__inner">
            {/* Fila título + Detalle al lado */}
            <div className="ing-side__row ing-side__row--top gradient--brand-red">
              <div className="ing-sectiontitle">
                <FontAwesomeIcon icon={faFilter} />
                <span>Filtros</span>
              </div>
              <div className="ing-detail-inline">
                <small className="muted">Detalle — {MESES[mes - 1]} {anio}</small>
              </div>
            </div>

            {/* Año / Mes */}
            <div className="ing-fieldrow">
              <div className="ing-field">
                <label htmlFor="anio">Año</label>
                <select id="anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                  {anios.map((a) => (<option key={a} value={a}>{a}</option>))}
                </select>
              </div>
              <div className="ing-field">
                <label htmlFor="mes">Mes</label>
                <select id="mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tarjetas KPI */}
            <div className="ing-kpi-cards">
              <div className="kpi-card">
                <div className="kpi-card__icon" aria-hidden>$</div>
                <div className="kpi-card__text">
                  <div className="kpi-card__label">Total</div>
                  <div className="kpi-card__value num">{fmtMonto(resumen.total)}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card__icon" aria-hidden>#</div>
                <div className="kpi-card__text">
                  <div className="kpi-card__label">Registros</div>
                  <div className="kpi-card__value num">{resumen.cantidad}</div>
                </div>
              </div>
            </div>

            <div className="ing-divider" />

            <div className="ing-sectiontitle">
              <FontAwesomeIcon icon={faChartPie} />
              <span>{innerTab === "alumnos" ? "Categorías (alumnos)" : "Medios de pago (ingresos)"}</span>
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
                    <div className="ing-catmeta">{c.cantidad} {c.cantidad === 1 ? "registro" : "registros"}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ======== CONTENIDO: HEAD + TOOLBAR + TABLA ======== */}
        <main className="ing-main">
          <section className="ing-stack cards">
            {/* HEAD */}
            <div className="ing-head ing-stack__head">
              <button className="ghost-btn show-on-mobile" onClick={() => setSideOpen(true)}>
                <FontAwesomeIcon icon={faBars} /><span>Filtros</span>
              </button>
            </div>

            {/* BODY: toolbar + tabla */}
            <div className="ing-page ing-stack__body">
              {/* Tabs + acciones */}
              <div className="seg-tabs gradient--brand-red" role="tablist" aria-label="Vista de tabla">
                <div className="seg-tabs-left">
                  <button
                    role="tab"
                    aria-selected={innerTab === "alumnos"}
                    className={`seg-tab ${innerTab === "alumnos" ? "active" : ""}`}
                    onClick={() => setInnerTab("alumnos")}
                  >
                    Alumnos
                  </button>
                  <button
                    role="tab"
                    aria-selected={innerTab === "manuales"}
                    className={`seg-tab ${innerTab === "manuales" ? "active" : ""}`}
                    onClick={() => setInnerTab("manuales")}
                  >
                    Ingresos
                  </button>
                </div>

                <div className="seg-tabs-actions">
                  <div className="seg-search">
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                      type="text"
                      placeholder="Buscar…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Buscar en la tabla"
                    />
                  </div>

                  {/* Botón Exportar Excel con inversión de colores en hover */}
                  <button
                    className="btn sm ghost btn-invert"
                    onClick={onExport}
                    title="Exportar Excel/CSV"
                  >
                    <FontAwesomeIcon icon={faFileExcel} />
                    <span>Exportar Excel</span>
                  </button>

                  {/* Botón Registrar ingreso con inversión de colores en hover */}
                  <button
                    className="btn sm solid btn-invert"
                    onClick={() => setOpenModal(true)}
                    title="Registrar ingreso"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Registrar ingreso</span>
                  </button>
                </div>
              </div>

              {/* Tablas */}
              {innerTab === "alumnos" ? (
                <div className={`ing-tablewrap ${cargando ? "is-loading" : ""}`} role="table" aria-label="Listado de ingresos (alumnos)">
                  {cargando && <div className="ing-tableloader" role="status" aria-live="polite"><div className="ing-spinner" /><span>Cargando…</span></div>}
                  <div className="ing-row h" role="row">
                    <div className="c-fecha">Fecha</div>
                    <div className="c-alumno">Alumno</div>
                    <div className="c-cat">Categoría</div>
                    <div className="c-monto t-right">Monto</div>
                    <div className="c-mes">Mes pagado</div>
                  </div>
                  {filasFiltradasAlu.map((f, idx) => (
                    <div className={`ing-row data ${cascading ? "casc" : ""}`} role="row" key={f.id} style={{ "--i": idx }}>
                      <div className="c-fecha">{f.fecha}</div>
                      <div className="c-alumno">
                        <div className="ing-alumno">
                          <div className="ing-alumno__text">
                            <div className="strong name-small">{f.alumno}</div>
                          </div>
                        </div>
                      </div>
                      <div className="c-cat"><span className="pill">{f.categoria}</span></div>
                      <div className="c-monto t-right"><span className="num strong-amount">{fmtMonto(f.monto)}</span></div>
                      <div className="c-mes">{f.mesPagado}</div>
                    </div>
                  ))}
                  {!filasFiltradasAlu.length && !cargando && <div className="ing-empty big">Sin pagos</div>}
                </div>
              ) : (
                <div className={`ing-tablewrap ${cargandoIngresos ? "is-loading" : ""}`} role="table" aria-label="Listado de ingresos (tabla ingresos)">
                  {cargandoIngresos && <div className="ing-tableloader" role="status" aria-live="polite"><div className="ing-spinner" /><span>Cargando…</span></div>}
                  <div className="ing-row h" role="row">
                    <div className="c-fecha">Fecha</div>
                    <div className="c-alumno">Denominación</div>
                    <div className="c-concepto">Descripción</div>
                    <div className="c-monto t-right">Importe</div>
                    <div className="c-medio">Medio</div>
                  </div>
                  {filasFiltradasIng.map((f, idx) => (
                    <div className={`ing-row data ${cascading ? "casc" : ""}`} role="row" key={f.id} style={{ "--i": idx }}>
                      <div className="c-fecha">{f.fecha}</div>
                      <div className="c-alumno">
                        <div className="ing-alumno">
                          <div className="ing-alumno__text">
                            <div className="strong name-small">{f.denominacion}</div>
                          </div>
                        </div>
                      </div>
                      <div className="c-concepto">{f.descripcion}</div>
                      <div className="c-monto t-right"><span className="num strong-amount">{fmtMonto(f.importe)}</span></div>
                      <div className="c-medio">{f.medio}</div>
                    </div>
                  ))}
                  {!filasFiltradasIng.length && !cargandoIngresos && <div className="ing-empty big">Sin ingresos</div>}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {sideOpen && <button className="ing-layout__overlay" onClick={() => setSideOpen(false)} aria-label="Cerrar panel" />}

      <ModalIngreso
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={() => loadIngresos()}
        defaultDate={new Date(anio, mes - 1, Math.min(28, new Date().getDate())).toISOString().slice(0,10)}
        medios={mediosPago}
      />
    </div>
  );
}
