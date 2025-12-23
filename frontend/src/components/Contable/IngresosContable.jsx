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
  faTrash,
  faEdit,
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../config/config";
import Toast from "../Global/Toast";
import "./IngresosContable.css";
import { IngresoCrearModal, IngresoEditarModal } from "./modalcontable/IngresoModal";

/* === Utilidades === */
const hoy = new Date();
const Y = hoy.getFullYear();
const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

const STORAGE_KEYS = {
  year: "contable_year",
  month: "contable_month",
  especial: "contable_especial", // ✅ nuevo
};

const cap1 = (s = "") => s.charAt(0) + s.slice(1).toLowerCase();
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/* 👇 siempre 2 decimales */
const fmtMonto = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

/* ===== helpers export ===== */
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
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
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
   ConfirmModal (reutiliza estilo de tu logout/confirm)
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
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
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
  // Filtros (leemos de localStorage)
  const [anio, setAnio] = useState(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.year);
      return saved || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [anios, setAnios] = useState([Y]);

  const [mes, setMes] = useState(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.month);
      return saved || "ALL";
    } catch {
      return "ALL";
    }
  });

  // ✅ NUEVO: filtro especial (id_mes de tabla meses pero solo > 12)
  const [mesEspecial, setMesEspecial] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_KEYS.especial) || "";
    } catch {
      return "";
    }
  });
  const [mesesEspeciales, setMesesEspeciales] = useState([]); // [{id_mes, nombre}]

  const [query, setQuery] = useState("");

  const [filas, setFilas] = useState([]); // alumnos
  const [filasIngresos, setFilasIngresos] = useState([]); // ingresos manuales
  const [cargando, setCargando] = useState(false);

  const [sideOpen, setSideOpen] = useState(true);
  const [cascading, setCascading] = useState(false);
  const [innerTab, setInnerTab] = useState("alumnos"); // "alumnos" | "manuales"

  // Filtro por categoría
  const [catFiltro, setCatFiltro] = useState("");

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  /* 🔐 Persistir filtros en localStorage cuando cambian */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.year, anio);
    } catch {}
  }, [anio]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.month, mes);
    } catch {}
  }, [mes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.especial, mesEspecial);
    } catch {}
  }, [mesEspecial]);

  /* ====== Rango de fechas ====== */
  const rango = useMemo(() => {
    if (anio === "ALL") return { start: null, end: null, label: "Todos los años" };
    const y = Number(anio);

    if (mes === "ALL") {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { start, end, label: `Enero–Diciembre ${y}` };
    }

    const m = Number(mes);
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    return { start: ymd(first), end: ymd(last), label: `${cap1(MESES[m])} ${y}` };
  }, [anio, mes]);

  /* ====== CARGA API ====== */
  const fetchJSON = useCallback(async (url, options = {}) => {
    const sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}ts=${Date.now()}`;
    const res = await fetch(finalUrl, { method: "GET", cache: "no-store", ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.exito === false) {
      const msg = data?.mensaje || `Error del servidor (HTTP ${res.status}).`;
      throw new Error(msg);
    }
    return data;
  }, []);

  // ✅ NUEVO: cargar meses especiales desde DB (oculta 1..12)
  const loadMesesEspeciales = useCallback(async () => {
    try {
      // 👇 Si tu acción se llama distinto, cambiá acá:
      const data = await fetchJSON(`${BASE_URL}/api.php?action=meses_list`);
      const items = Array.isArray(data?.items) ? data.items : [];

      const especiales = items
        .map((x) => ({
          id_mes: Number(x.id_mes ?? x.id ?? 0),
          nombre: String(x.nombre ?? x.Nombre ?? "").trim(),
        }))
        .filter((x) => x.id_mes > 12 && x.nombre);

      if (especiales.length) {
        setMesesEspeciales(especiales);
        return;
      }

      // fallback si viene vacío
      setMesesEspeciales([
        { id_mes: 13, nombre: "CONTADO ANUAL" },
        { id_mes: 14, nombre: "MATRICULA" },
        { id_mes: 15, nombre: "1ERA MITAD" },
        { id_mes: 16, nombre: "2DA MITAD" },
      ]);
    } catch {
      // ✅ fallback si no existe endpoint
      setMesesEspeciales([
        { id_mes: 13, nombre: "CONTADO ANUAL" },
        { id_mes: 14, nombre: "MATRICULA" },
        { id_mes: 15, nombre: "1ERA MITAD" },
        { id_mes: 16, nombre: "2DA MITAD" },
      ]);
    }
  }, [fetchJSON]);

  const loadPagosAlumnos = useCallback(async () => {
    setCargando(true);
    try {
      let url = `${BASE_URL}/api.php?action=contable_ingresos&detalle=1`;
      if (rango.start && rango.end) {
        url += `&start=${rango.start}&end=${rango.end}`;
      } else if (anio !== "ALL") {
        url += `&year=${anio}`;
      }
      const raw = await fetchJSON(url);

      if (Array.isArray(raw?.anios_disponibles) && raw.anios_disponibles.length) {
        setAnios(raw.anios_disponibles);
      }

      const detalleCompleto = raw?.detalle || {};
      const todosLosDatos = [];
      Object.keys(detalleCompleto).forEach((key) => {
        if (anio === "ALL") {
          todosLosDatos.push(...detalleCompleto[key]);
        } else if (key.startsWith(`${anio}-`)) {
          if (mes !== "ALL") {
            const mesIdx = Number(mes);
            const mm = String(mesIdx + 1).padStart(2, "0");
            if (key.endsWith(`-${mm}`)) {
              todosLosDatos.push(...detalleCompleto[key]);
            }
          } else {
            todosLosDatos.push(...detalleCompleto[key]);
          }
        }
      });

      const rows = todosLosDatos.map((r, i) => ({
        id: `${r?.fecha_pago || ""}|${r?.Alumno || ""}|${r?.Monto || 0}|${i}`,
        fecha: r?.fecha_pago ?? "",
        alumno: r?.Alumno ?? "",
        categoria: r?.Categoria ?? "-",
        monto: Number(r?.Monto ?? 0),
        mesPagado: r?.Mes_pagado || MESES[(Number(r?.Mes_pagado_id || 0) - 1)] || "-",
        mesPagadoId: Number(r?.Mes_pagado_id || r?.id_mes || 0), // ✅ NUEVO: id del mes pagado
        medio: r?.Medio || r?.medio || "—",
      }));

      setFilas(rows);
    } catch (e) {
      console.error("Error al cargar ingresos alumnos:", e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [anio, mes, rango, fetchJSON]);

  const loadIngresos = useCallback(async () => {
    setCargando(true);
    try {
      let url = `${BASE_URL}/api.php?action=ingresos_list`;
      if (rango.start && rango.end) {
        url += `&start=${rango.start}&end=${rango.end}`;
      } else if (anio !== "ALL") {
        url += `&year=${anio}`;
      }
      const data = await fetchJSON(url);
      const list = Array.isArray(data?.items) ? data.items : [];

      let filteredList = list;
      if (anio !== "ALL" && mes !== "ALL") {
        filteredList = list.filter((item) => {
          if (!item.fecha) return false;
          const fecha = new Date(item.fecha);
          const itemAnio = fecha.getFullYear();
          const itemMes = fecha.getMonth(); // 0-11
          return itemAnio === Number(anio) && itemMes === Number(mes);
        });
      }

      const rows = filteredList.map((r) => {
        const categoriaText = r.categoria || r.denominacion || "-";
        const medioText = r.medio || r.medio_pago || "";
        const proveedorText = r.proveedor || r.nombre_proveedor || "";
        const imputacionText = r.imputacion || r.descripcion || r.descripcion_texto || "";

        return {
          id: `I|${r.id_ingreso}`,
          id_ingreso: Number(r.id_ingreso),
          id_medio_pago: Number(r.id_medio_pago || 0),
          fecha: r.fecha,
          categoria: categoriaText,
          imputacion: imputacionText,
          proveedor: proveedorText,
          importe: Number(r.importe || 0),
          medio: medioText,
          denominacion: categoriaText,
          descripcion: imputacionText,
        };
      });
      setFilasIngresos(rows);
    } catch (e) {
      console.error("Error al cargar tabla ingresos:", e);
      setFilasIngresos([]);
    } finally {
      setCargando(false);
    }
  }, [anio, mes, rango, fetchJSON]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPagosAlumnos(), loadIngresos()]);
  }, [loadPagosAlumnos, loadIngresos]);

  // Cargar años disponibles al inicio
  useEffect(() => {
    const loadAnios = async () => {
      try {
        const data = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&meta=1`);
        if (Array.isArray(data?.anios_disponibles) && data.anios_disponibles.length) {
          const list = [...data.anios_disponibles].sort((a, b) => b - a).map(String);
          setAnios(list);
        }
      } catch (e) {
        console.error("Error al cargar años:", e);
      }
    };
    loadAnios();
  }, [fetchJSON]);

  // ✅ cargar meses especiales 1 vez
  useEffect(() => {
    loadMesesEspeciales();
  }, [loadMesesEspeciales]);

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    loadAll();
  }, [anio, mes, loadAll]);

  // Reset filtro categoría al cambiar contexto
  useEffect(() => {
    setCatFiltro("");
  }, [innerTab, anio, mes]);

  // ✅ si cambia a "Ingresos" (manuales), no tiene sentido el filtro especial
  useEffect(() => {
    if (innerTab !== "alumnos") setMesEspecial("");
  }, [innerTab]);

  // Animación cascada
  useEffect(() => {
    setCascading(true);
    const t = setTimeout(() => setCascading(false), 500);
    return () => clearTimeout(t);
  }, [anio, mes, query, innerTab, catFiltro, mesEspecial]);

  /* Derivados: búsqueda + filtro categoría + ✅ filtro especial */
  const filasFiltradasAlu = useMemo(() => {
    const q = query.trim().toLowerCase();

    let base = !q
      ? filas
      : filas.filter((f) =>
          (f.alumno || "").toLowerCase().includes(q) ||
          (f.categoria || "").toLowerCase().includes(q) ||
          (f.fecha || "").toLowerCase().includes(q) ||
          (f.mesPagado || "").toLowerCase().includes(q) ||
          (f.medio || "").toLowerCase().includes(q)
        );

    if (catFiltro) base = base.filter((f) => (f.categoria || "-") === catFiltro);

    // ✅ SOLO SI HAY SELECCIÓN ESPECIAL (13..)
    if (mesEspecial) {
      const idSel = Number(mesEspecial);
      base = base.filter((f) => Number(f.mesPagadoId || 0) === idSel);
    }

    return base;
  }, [filas, query, catFiltro, mesEspecial]);

  const filasFiltradasIng = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? filasIngresos
      : filasIngresos.filter((f) =>
          (f.categoria || "").toLowerCase().includes(q) ||
          (f.imputacion || f.descripcion || "").toLowerCase().includes(q) ||
          (f.proveedor || "").toLowerCase().includes(q) ||
          (f.fecha || "").toLowerCase().includes(q) ||
          (String(f.importe) || "").toLowerCase().includes(q) ||
          (f.medio || "").toLowerCase().includes(q)
        );
    return catFiltro ? base.filter((f) => (f.categoria || "-") === catFiltro) : base;
  }, [filasIngresos, query, catFiltro]);

  const resumen = useMemo(() => {
    const base = innerTab === "alumnos" ? filasFiltradasAlu : filasFiltradasIng;
    const total = base.reduce((acc, f) => acc + Number((f.monto ?? f.importe) || 0), 0);
    return { total, cantidad: base.length };
  }, [filasFiltradasAlu, filasFiltradasIng, innerTab]);

  // AGRUPA POR CATEGORÍA
  const categoriasMes = useMemo(() => {
    const base = innerTab === "alumnos" ? filas : filasIngresos;
    const map = new Map();
    base.forEach((f) => {
      const key = (f.categoria || "-").toString();
      const prev = map.get(key) || { nombre: key, cantidad: 0, monto: 0 };
      prev.cantidad += 1;
      prev.monto += Number((f.monto ?? f.importe) || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [filas, filasIngresos, innerTab]);

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
        Medio: r.medio,
      }));
    } else {
      rows = base.map((r) => ({
        Fecha: r.fecha,
        Proveedor: r.proveedor || "",
        Imputación: r.imputacion || r.descripcion || "",
        Importe: r.importe,
        Medio: r.medio,
      }));
    }
    const wbName = `Ingresos_${anio === "ALL" ? "Todos_los_años" : (mes === "ALL" ? `Año_${anio}` : `${cap1(MESES[Number(mes)])}_${anio}`)}_${isAlu ? "Alumnos" : "Ingresos"}`;
    await exportToExcelLike({ workbookName: wbName, sheetName: "Datos", rows });
    addToast("exito", "Exportado exitosamente.");
  };

  /* ===== Acciones ===== */
  const onClickCreate = () => setOpenCreate(true);
  const onEdit = (row) => { setEditRow(row); setOpenEdit(true); };

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
          <Toast
            key={t.id}
            tipo={t.tipo}
            mensaje={t.mensaje}
            duracion={t.duracion}
            onClose={() => removeToast(t.id)}
          />
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
                <small className="muted">
                  Detalle —{" "}
                  {anio === "ALL"
                    ? "Todos los años"
                    : mes === "ALL"
                      ? `${anio}`
                      : `${cap1(MESES[Number(mes)])} ${anio}`}
                </small>
              </div>
            </div>

            {/* Año / Mes */}
            <div className="ing-fieldrow">
              <div className="ing-field">
                <label htmlFor="anio">Año</label>
                <select id="anio" value={anio} onChange={(e) => setAnio(e.target.value)}>
                  <option value="ALL">TODOS</option>
                  {anios.map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ing-field">
                <label htmlFor="mes">Mes</label>
                <select
                  id="mes"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  disabled={anio === "ALL"}
                >
                  <option value="ALL">TODOS</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={String(i)}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

{/* ✅ filtro especial (solo alumnos) */}
{innerTab === "alumnos" && (
  <div className="ing-fieldrow">
    <div className="ing-field ing-Especial">
      <label htmlFor="especial">Especial</label>
      <select
        id="especial"
        value={mesEspecial}
        onChange={(e) => setMesEspecial(e.target.value)}
      >
        <option value="">TODOS</option>
        {mesesEspeciales.map((m) => (
          <option key={m.id_mes} value={String(m.id_mes)}>
            {String(m.nombre || "").toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  </div>
)}


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

            {/* Lista de categorías clickeable */}
            <div className="ing-sectiontitle">
              <FontAwesomeIcon icon={faChartPie} />
              <span>{innerTab === "alumnos" ? "Categorías (alumnos)" : "Categorías (ingresos)"}</span>
            </div>

            {categoriasMes.length === 0 ? (
              <div className="ing-empty">Sin datos</div>
            ) : (
              <ul className="ing-catlist" role="list">
                {categoriasMes.map((c, i) => {
                  const active = c.nombre === catFiltro;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`ing-catitem-btn ${active ? "active" : ""}`}
                        onClick={() => setCatFiltro(active ? "" : c.nombre)}
                        title={`${c.cantidad} ${c.cantidad === 1 ? "registro" : "registros"}`}
                        aria-pressed={active}
                      >
                        <div className="ing-catline">
                          <span className="ing-catname">{(c.nombre || "-").toString().toUpperCase()}</span>
                          <span className="ing-catamount num">{fmtMonto(c.monto)}</span>
                        </div>
                        <div className="ing-catmeta">
                          {c.cantidad} {c.cantidad === 1 ? "registro" : "registros"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ======== CONTENIDO ======== */}
        <main className="ing-main">
          <section className="ing-stack cards">
            <div className="ing-head ing-stack__head">
              <button className="ghost-btn show-on-mobile" onClick={() => setSideOpen(true)}>
                <FontAwesomeIcon icon={faBars} />
                <span>Filtros</span>
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

                  <button className="btn sm ghost btn-invert" onClick={onExport} title="Exportar Excel/CSV">
                    <FontAwesomeIcon icon={faFileExcel} />
                    <span>Exportar Excel</span>
                  </button>

                  <button className="btn sm solid btn-invert" onClick={onClickCreate} title="Registrar ingreso">
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Registrar ingreso</span>
                  </button>
                </div>
              </div>

              {/* ===== TABLA: ALUMNOS ===== */}
              {innerTab === "alumnos" ? (
                <div
                  className={`ing-tablewrap ${cargando ? "is-loading" : ""}`}
                  role="table"
                  aria-label="Listado de ingresos (alumnos)"
                >
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
                    <div className="c-medio">Medio</div>
                    <div className="c-mes">Mes pagado</div>
                  </div>

                  {filasFiltradasAlu.map((f, idx) => (
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
                            <div className="strong name-small">{f.alumno}</div>
                          </div>
                        </div>
                      </div>
                      <div className="c-cat">
                        <span className="pill">{f.categoria}</span>
                      </div>
                      <div className="c-monto t-right">
                        <span className="num strong-amount">{fmtMonto(f.monto)}</span>
                      </div>
                      <div className="c-medio">{f.medio || "—"}</div>
                      <div className="c-mes">{f.mesPagado}</div>
                    </div>
                  ))}

                  {!filasFiltradasAlu.length && !cargando && (
                    <div className="ing-empty big">
                      Sin pagos para{" "}
                      {anio === "ALL"
                        ? "todos los años"
                        : mes === "ALL"
                          ? `año ${anio}`
                          : `${cap1(MESES[Number(mes)])} ${anio}`}
                    </div>
                  )}
                </div>
              ) : (
                /* ===== TABLA: MANUALES ===== */
                <div
                  className={`ing-tablewrap is-manuales ${cargando ? "is-loading" : ""}`}
                  role="table"
                  aria-label="Listado de ingresos (tabla ingresos)"
                >
                  {cargando && (
                    <div className="ing-tableloader" role="status" aria-live="polite">
                      <div className="ing-spinner" />
                      <span>Cargando…</span>
                    </div>
                  )}

                  <div className="ing-row h" role="row">
                    <div className="c-fecha">Fecha</div>
                    <div className="c-medio">Medio</div>
                    <div className="c-proveedor">Proveedor</div>
                    <div className="c-cat">Categoría</div>
                    <div className="c-imputacion">Imputación</div>
                    <div className="c-importe">Importe</div>
                    <div className="c-actions center">Acciones</div>
                  </div>

                  {filasFiltradasIng.map((f, idx) => (
                    <div
                      className={`ing-row data ${cascading ? "casc" : ""}`}
                      role="row"
                      key={f.id}
                      style={{ "--i": idx }}
                    >
                      <div className="c-fecha">{f.fecha}</div>
                      <div className="c-medio">{f.medio}</div>
                      <div className="c-proveedor">{f.proveedor || "-"}</div>
                      <div className="c-cat">
                        <span className="pill">{f.categoria || "-"}</span>
                      </div>
                      <div className="c-imputacion">{f.imputacion || f.descripcion || "-"}</div>
                      <div className="c-importe">
                        <span className="num strong-amount">{fmtMonto(f.importe)}</span>
                      </div>
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

                  {!filasFiltradasIng.length && !cargando && (
                    <div className="ing-empty big">
                      Sin ingresos para{" "}
                      {anio === "ALL"
                        ? "todos los años"
                        : mes === "ALL"
                          ? `año ${anio}`
                          : `${cap1(MESES[Number(mes)])} ${anio}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {sideOpen && (
        <button
          className="ing-layout__overlay"
          onClick={() => setSideOpen(false)}
          aria-label="Cerrar panel"
        />
      )}

      {/* === Modales === */}
      <IngresoCrearModal
        open={openCreate}
        defaultDate={new Date().toISOString().slice(0, 10)}
        onClose={() => setOpenCreate(false)}
        onSaved={async () => {
          addToast("exito", "Ingreso creado correctamente.");
          await loadIngresos();
        }}
      />

      <IngresoEditarModal
        open={openEdit}
        editRow={editRow}
        onClose={() => {
          setOpenEdit(false);
          setEditRow(null);
        }}
        onSaved={async () => {
          addToast("exito", "Ingreso actualizado correctamente.");
          await loadIngresos();
        }}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar ingreso"
        message="¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
