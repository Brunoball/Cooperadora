// src/components/Contable/IngresosContable.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faChartPie,
  faBars,
  faPlus,
  faFileExcel,
  faPen,
  faTrash,
  faEye,
  faEdit,        // 👈 agregado para "ver"
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../config/config";
import Toast from "../Global/Toast";
import "./IngresosContable.css";
import { IngresoCrearModal, IngresoEditarModal } from "./modalcontable/IngresoModal";

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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!rows || !rows.length) return;

  try {
    const maybe = await import("xlsx");
    const XLSX = maybe.default || maybe;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Datos");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    safeDownload(blob, `${workbookName}.xlsx`);
    return;
  } catch {
    /* fallback CSV */
  }

  const headers = Object.keys(rows[0] || {});
  const csv = toCSV(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  safeDownload(blob, `${workbookName}.csv`);
}

/* ===========================================================
   ConfirmModal – mismo patrón visual que en Egresos
   (clases "logout-modal-*")
   =========================================================== */
function ConfirmModal({
  open,
  title = "Eliminar ingreso",
  message = "¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer.",
  onCancel,
  onConfirm,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingdel-title"
      aria-describedby="ingdel-desc"
      onMouseDown={onCancel}
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="ingdel-title" className="logout-modal-title logout-modal-title--danger">
          {title}
        </h3>

        <p id="ingdel-desc" className="logout-modal-text">
          {message}
        </p>

        <div className="logout-modal-buttons">
          <button
            type="button"
            className="logout-btn logout-btn--ghost"
            onClick={onCancel}
            ref={cancelBtnRef}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="logout-btn logout-btn--solid-danger"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
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

  const [sideOpen, setSideOpen] = useState(true);
  const [cascading, setCascading] = useState(false);
  const [innerTab, setInnerTab] = useState("alumnos"); // "alumnos" | "manuales"

  // Modales
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const addToast = (tipo, mensaje, duracion = 3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Confirmación delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

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
        id_ingreso: Number(r.id_ingreso),
        id_medio_pago: Number(r.id_medio_pago || 0),
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
    await Promise.all([loadPagosAlumnos(), loadIngresos()]);
  }, [loadPagosAlumnos, loadIngresos]);

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
      addToast("advertencia", "No hay datos para exportar.");
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
        // Si querés quitar también el ID del export, borrá la línea siguiente:
        "N°": r.id_ingreso,
        Fecha: r.fecha,
        Denominación: r.denominacion,
        Descripción: r.descripcion,
        Importe: r.importe,
        Medio: r.medio,
      }));
    }
    const wbName = `Ingresos_${MESES[mes - 1]}_${anio}_${isAlu ? "Alumnos" : "Ingresos"}`;
    await exportToExcelLike({ workbookName: wbName, sheetName: "Datos", rows });
    addToast("exito", "Exportación iniciada.");
  };

  /* ===== Acciones ===== */
  const onClickCreate = () => setOpenCreate(true);
  const onEdit = (row) => { setEditRow(row); setOpenEdit(true); };

  const onView = (row) => {
    // Dejalo como vista previa simple con toast o adaptalo a tu flujo
    addToast("info", `Vista previa: ${row?.denominacion ?? "—"}`);
  };

  const askDelete = (row) => { setToDelete(row); setConfirmOpen(true); };
  const cancelDelete = () => { setConfirmOpen(false); setToDelete(null); };
  const confirmDelete = async () => {
    if (!toDelete?.id_ingreso) return;
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_ingresos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_ingreso: Number(toDelete.id_ingreso) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.exito) throw new Error(data?.mensaje || `HTTP ${res.status}`);
      addToast("exito", "Ingreso eliminado correctamente.");
      await loadIngresos();
    } catch (e) {
      addToast("error", `No se pudo eliminar: ${e.message}`);
    } finally {
      cancelDelete();
    }
  };

  return (
    <div className="ing-wrap">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast key={t.id} tipo={t.tipo} mensaje={t.mensaje} duracion={t.duracion} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="ing-layout">
        {/* Sidebar */}
        <aside className={sideClass} aria-label="Barra lateral">
          <div className="ing-side__inner">
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

            {/* KPIs */}
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

        {/* ======== CONTENIDO ======== */}
        <main className="ing-main">
          <section className="ing-stack cards">
            <div className="ing-head ing-stack__head">
              <button className="ghost-btn show-on-mobile" onClick={() => setSideOpen(true)}>
                <FontAwesomeIcon icon={faBars} /><span>Filtros</span>
              </button>
            </div>

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

                  <button
                    className="btn sm ghost btn-invert"
                    onClick={onExport}
                    title="Exportar Excel/CSV"
                  >
                    <FontAwesomeIcon icon={faFileExcel} />
                    <span>Exportar Excel</span>
                  </button>

                  <button
                    className="btn sm solid btn-invert"
                    onClick={onClickCreate}
                    title="Registrar ingreso"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Registrar ingreso</span>
                  </button>
                </div>
              </div>

              {/* ===== TABLA: ALUMNOS ===== */}
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
                /* ===== TABLA: MANUALES (SIN columna N°) ===== */
                <div
                  className={`ing-tablewrap is-manuales ${cargandoIngresos ? "is-loading" : ""}`}
                  role="table"
                  aria-label="Listado de ingresos (tabla ingresos)"
                >
                  {cargandoIngresos && (
                    <div className="ing-tableloader" role="status" aria-live="polite">
                      <div className="ing-spinner" /><span>Cargando…</span>
                    </div>
                  )}

                  <div className="ing-row h" role="row">
                    {/* N° eliminado */}
                    <div className="c-fecha">Fecha</div>
                    <div className="c-alumno">Denominación</div>
                    <div className="c-concepto">Descripción</div>
                    <div className="c-importe">Importe</div>
                    <div className="c-medio">Medio</div>
                    <div className="c-actions center">Acciones</div>
                  </div>

                  {filasFiltradasIng.map((f, idx) => (
                    <div className={`ing-row data ${cascading ? "casc" : ""}`} role="row" key={f.id} style={{ "--i": idx }}>
                      {/* N° eliminado */}
                      <div className="c-fecha">{f.fecha}</div>
                      <div className="c-alumno">
                        <div className="ing-alumno">
                          <div className="ing-alumno__text">
                            <div className="strong name-small">{f.denominacion}</div>
                          </div>
                        </div>
                      </div>
                      <div className="c-concepto">{f.descripcion}</div>
                      <div className="c-importe"><span className="num strong-amount">{fmtMonto(f.importe)}</span></div>
                      <div className="c-medio">{f.medio}</div>
                      <div className="c-actions center">

                        <button className="act-btn is-edit" title="Editar" onClick={() => onEdit(f)}>
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button className="act-btn is-del" title="Eliminar" onClick={() => askDelete(f)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
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

      {/* === Modales (gestionados internamente en su propio archivo) === */}
      <IngresoCrearModal
        open={openCreate}
        defaultDate={new Date(anio, mes - 1, Math.min(28, new Date().getDate())).toISOString().slice(0,10)}
        onClose={() => setOpenCreate(false)}
        onSaved={async () => { addToast("exito", "Ingreso creado correctamente."); await loadIngresos(); }}
      />
      <IngresoEditarModal
        open={openEdit}
        editRow={editRow}
        onClose={() => { setOpenEdit(false); setEditRow(null); }}
        onSaved={async () => { addToast("exito", "Ingreso actualizado correctamente."); await loadIngresos(); }}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar ingreso"
        message="¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer."
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
