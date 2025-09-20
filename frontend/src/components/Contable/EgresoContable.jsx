// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faEdit,
  faEye,
  faFileExcel,
  faTableList,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal";
import Toast from "../Global/Toast";
import "./EgresoContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();

const MESES = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
];

/* ===== Confirmación simple ===== */
function ConfirmModal({
  open,
  title = "Confirmar",
  message,
  onCancel,
  onConfirm,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
}) {
  if (!open) return null;
  return (
    <div className="lc_modal_overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="lc_modal" onClick={(e) => e.stopPropagation()}>
        <div className="lc_modal_head">
          <h3>{title}</h3>
          <button className="lc_icon" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>
        <div className="lc_modal_body"><p style={{margin:0}}>{message}</p></div>
        <div className="lc_modal_footer">
          <button className="lc_btn" onClick={onCancel}>{cancelText}</button>
          <button className="lc_btn danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

/* ======= Componente ======= */
export default function EgresoContable() {
  // Datos
  const [egresos, setEgresos] = useState([]);
  const [loadingEgr, setLoadingEgr] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);

  // Filtros sidebar (Año/Mes) + otros
  const [year, setYear] = useState(Y);
  const [month, setMonth] = useState(hoy.getMonth()); // 0..11
  const [fCat, setFCat] = useState("");     // también filtrable desde "Categorías"
  const [fMedio, setFMedio] = useState("");
  const [q, setQ] = useState("");           // búsqueda (header de la tabla)

  // Modal CRUD
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const addToast = (tipo, mensaje, duracion = 3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Helpers fetch
  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.mensaje) msg = j.mensaje; } catch {}
      throw new Error(msg);
    }
    return res.json();
  };

  // Rango de fechas según año/mes
  const { fStart, fEnd } = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const toISO = (d) => d.toISOString().slice(0, 10);
    return { fStart: toISO(first), fEnd: toISO(last) };
  }, [year, month]);

  // Cargar listas
  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      setMediosPago(Array.isArray(data?.listas?.medios_pago) ? data.listas.medios_pago : []);
    } catch (e) {
      console.error(e);
      addToast("error", "No se pudieron cargar los medios de pago.");
      setMediosPago([]);
    }
  };

  // Cargar egresos
  const loadEgresos = async () => {
    setLoadingEgr(true);
    try {
      const params = new URLSearchParams({ start: fStart, end: fEnd });
      if (fCat) params.set("categoria", fCat);
      if (fMedio) params.set("medio", fMedio);
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list&${params.toString()}`);
      setEgresos(raw?.datos || []);
    } catch (e) {
      console.error(e);
      addToast("error", "Error al cargar los egresos.");
      setEgresos([]);
    } finally {
      setLoadingEgr(false);
    }
  };

  useEffect(() => { loadMediosPago(); }, []);
  useEffect(() => { loadEgresos(); }, [fStart, fEnd, fCat, fMedio]);

  // KPI
  const totalEgresos = useMemo(
    () => egresos.reduce((a, b) => a + Number(b.monto || 0), 0),
    [egresos]
  );

  // Búsqueda local
  const egresosFiltrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return egresos;
    return egresos.filter((e) => {
      const src = [
        e.descripcion,
        e.categoria,
        e.medio_nombre || e.medio_pago,
        e.fecha,
      ].join(" ").toLowerCase();
      return src.includes(needle);
    });
  }, [egresos, q]);

  // Desglose de categorías (para el panel izquierdo)
  const catBreakdown = useMemo(() => {
    const map = new Map();
    for (const e of egresos) {
      const k = e.categoria || "SIN CATEGORÍA";
      const monto = Number(e.monto || 0);
      if (!map.has(k)) map.set(k, { label: k, total: 0, count: 0 });
      const obj = map.get(k);
      obj.total += monto; obj.count += 1;
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total);
  }, [egresos]);

  // Acciones básicas
  const onCreateEgreso = () => { setEditRow(null); setModalOpen(true); };
  const onEditEgreso = (row) => { setEditRow(row); setModalOpen(true); };

  // Ver comprobante
  const normalizeUrl = (url = "") => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const clean = String(url).replace(/^\/+/, "");
    return `${BASE_URL}/${clean}`;
  };
  const onViewComprobante = (row) => {
    const candidate = row?.comprobante_url || row?.comprobante || row?.url || "";
    const finalUrl = normalizeUrl(candidate);
    if (!finalUrl) { addToast("advertencia", "Este egreso no tiene comprobante adjunto."); return; }
    try { window.open(finalUrl, "_blank", "noopener,noreferrer"); }
    catch { window.location.href = finalUrl; }
  };

  // Eliminar
  const askDeleteEgreso = (id) => { setToDeleteId(id); setConfirmOpen(true); };
  const cancelDelete = () => { setConfirmOpen(false); setToDeleteId(null); };
  const confirmDelete = async () => {
    if (!toDeleteId) return;
    try {
      await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_egreso: toDeleteId }),
      });
      addToast("exito", "Egreso eliminado correctamente.");
      loadEgresos();
    } catch (e) {
      console.error(e);
      addToast("error", "No se pudo eliminar el egreso.");
    } finally {
      cancelDelete();
    }
  };

  const onSavedEgreso = () => { setModalOpen(false); loadEgresos(); };

  /* ===== Export CSV (Excel) ===== */
  const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportarCSV = () => {
    const rows = egresosFiltrados;
    if (!rows.length) { addToast("advertencia", "No hay datos para exportar."); return; }
    const headers = ["Fecha","Categoría","Descripción","Medio","Monto"];
    const sep = ";";
    const data = rows.map((e) => [
      e.fecha || "",
      e.categoria || "",
      e.descripcion || "",
      e.medio_nombre || e.medio_pago || "",
      Number(e.monto || 0).toString().replace(".", ","),
    ]);
    const bom = "\uFEFF";
    const lines = [
      headers.map(csvEscape).join(sep),
      ...data.map((r) => r.map(csvEscape).join(sep)),
    ];
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const name = `Egresos_${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}.csv`;
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    addToast("exito", "Archivo exportado.");
  };

  // Años para el select
  const years = useMemo(() => {
    const arr = [];
    for (let k = Y - 2; k <= Y + 1; k++) arr.push(k);
    return arr.reverse();
  }, []);

  return (
    <div className="eg_layout">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast key={t.id} tipo={t.tipo} mensaje={t.mensaje} duracion={t.duracion} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* ===== Cuerpo dividido en sidebar + contenido ===== */}
      <div className="eg_body">
        {/* Sidebar filtros */}
        <aside className="eg_filters card">
          <h2 className="eg_filters__title">
            <FontAwesomeIcon icon={faTableList} /> Filtros
          </h2>

          {/* Año y Mes en la MISMA fila */}
          <div className="eg_row">
            <div className="eg_field">
              <label>Año</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="eg_field">
              <label>Mes</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ✅ Solo KPI Total (se quitó Registros) */}
          <div className="eg_stats">
            <div className="eg_stat">
              <div className="eg_stat__icon">$</div>
              <div>
                <p className="eg_stat__label">Total</p>
                <p className="eg_stat__value">${totalEgresos.toLocaleString("es-AR")}</p>
              </div>
            </div>
          </div>

          {/* ✅ Medio de pago arriba de Categorías */}
          <div className="eg_field" style={{ marginTop: 8 }}>
            <label>Medio de pago</label>
            <select value={fMedio} onChange={(e) => setFMedio(e.target.value)}>
              <option value="">(todos)</option>
              {mediosPago.map((m) => (
                <option key={m.id} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <h3 className="eg_filters__subtitle" style={{ marginTop: 12 }}>
            <span className="dot" /> Categorías
          </h3>

          <div className="eg_cats">
            {catBreakdown.map((c) => {
              const active = fCat && fCat === c.label;
              return (
                <button
                  key={c.label}
                  className={`eg_cat ${active ? "active" : ""}`}
                  onClick={() => setFCat(active ? "" : c.label)}
                  title={`${c.count} registros`}
                >
                  <div className="eg_cat__left">
                    <span className="eg_chip">{c.label}</span>
                    <small className="eg_cat__count">{c.count} registro{s(c.count)}</small>
                  </div>
                  <div className="eg_cat__value">
                    ${c.total.toLocaleString("es-AR")}
                  </div>
                </button>
              );
            })}
            {!catBreakdown.length && <div className="eg_empty_side">Sin datos</div>}
          </div>

          {(fCat || fMedio) && (
            <button className="eg_btn eg_btn--ghost" onClick={() => { setFCat(""); setFMedio(""); }}>
              Limpiar filtros
            </button>
          )}
        </aside>

        {/* Contenido principal: tabla */}
        <section className="eg_content card">
          <header className="eg_content__header">
            <h3>Egresos — {MESES[month]} {year}</h3>

            {/* === Acciones dentro del header de la caja === */}
            <div className="eg_header_actions">
              {/* 🔎 Buscador */}
              <div className="eg_search eg_search--inline">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  placeholder="Buscar..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Buscar egresos"
                />
              </div>

              <button className="eg_btn eg_btn--ghost" onClick={exportarCSV}>
                <FontAwesomeIcon icon={faFileExcel} />
                Exportar Excel
              </button>
              <button className="eg_btn eg_btn--primary-plain" onClick={onCreateEgreso}>
                <FontAwesomeIcon icon={faPlus} />
                Registrar egreso
              </button>
            </div>
          </header>

          <div className="ec_table__wrap">
            {loadingEgr && (
              <div className="ec_table_loader" role="status" aria-live="polite" aria-label="Cargando egresos">
                <div className="ec_spinner" />
                <span>Cargando…</span>
              </div>
            )}

            <div
              className="gt_table gt_cols-6"
              role="table"
              aria-label="Listado de egresos"
              aria-busy={loadingEgr ? "true" : "false"}
            >
              <div className="gt_headerd" role="row">
                <div className="gt_cell h" role="columnheader">Fecha</div>
                <div className="gt_cell h" role="columnheader">Categoría</div>
                <div className="gt_cell h" role="columnheader">Descripción</div>
                <div className="gt_cell h" role="columnheader">Medio</div>
                <div className="gt_cell h right" role="columnheader">Monto</div>
                <div className="gt_cell h center" role="columnheader">Acciones</div>
              </div>

              {egresosFiltrados.map((e) => {
                const hasFile = Boolean(normalizeUrl(e?.comprobante_url || e?.comprobante || e?.url));
                return (
                  <div className="gt_rowd" role="row" key={e.id_egreso}>
                    <div className="gt_cell" role="cell">{e.fecha}</div>
                    <div className="gt_cell" role="cell"><span className="badge">{e.categoria || "-"}</span></div>
                    <div className="gt_cell truncate" role="cell" title={e.descripcion || "-"}>{e.descripcion || "-"}</div>
                    <div className="gt_cell" role="cell">{e.medio_nombre || e.medio_pago || "-"}</div>
                    <div className="gt_cell right" role="cell">${Number(e.monto || 0).toLocaleString("es-AR")}</div>
                    <div className="gt_cell" role="cell">
                      <div className="row_actions">
                        <button className="icon_btn" title="Ver comprobante" onClick={() => onViewComprobante(e)} disabled={!hasFile}>
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                        <button className="icon_btn" title="Editar" onClick={() => onEditEgreso(e)}>
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button className="icon_btn danger" title="Eliminar" onClick={() => askDeleteEgreso(e.id_egreso)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!egresosFiltrados.length && (
                <div className="gt_empty">{loadingEgr ? "Cargando…" : "Sin egresos"}</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modales */}
      <ContableEgresoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSavedEgreso}
        editRow={editRow}
        notify={addToast}
      />
      <ConfirmModal
        open={confirmOpen}
        title="Eliminar egreso"
        message="¿Seguro que querés eliminar este egreso? Esta acción no se puede deshacer."
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}

/* util plural */
function s(n){ return n === 1 ? "" : "s"; }
