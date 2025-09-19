// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faEdit, faEye, faFileExcel } from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal";
import Toast from "../Global/Toast";
import "./EgresoContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();

/* Confirmación reutilizable */
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
        <div className="lc_modal_body">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="lc_modal_footer">
          <button className="lc_btn" onClick={onCancel}>{cancelText}</button>
          <button className="lc_btn danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

export default function EgresoContable() {
  const [egresos, setEgresos] = useState([]);
  const [loadingEgr, setLoadingEgr] = useState(false);

  const [fStart, setFStart] = useState(`${Y}-01-01`);
  const [fEnd,   setFEnd]   = useState(`${Y}-12-31`);
  const [fCat,   setFCat]   = useState("");
  const [fMedio, setFMedio] = useState("");

  const [mediosPago, setMediosPago] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow,   setEditRow]   = useState(null);

  // ====== TOASTS ======
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const addToast = (tipo, mensaje, duracion = 3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

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

  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      const arr = data?.listas?.medios_pago ?? [];
      setMediosPago(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("Error cargando medios de pago:", e);
      addToast("error", "No se pudieron cargar los medios de pago.");
      setMediosPago([]);
    }
  };

  const loadEgresos = async () => {
    setLoadingEgr(true);
    try {
      const params = new URLSearchParams({ start: fStart, end: fEnd });
      if (fCat)   params.set("categoria", fCat);
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

  const totalEgresos = useMemo(
    () => egresos.reduce((a, b) => a + Number(b.monto || 0), 0),
    [egresos]
  );

  const onCreateEgreso = () => { setEditRow(null); setModalOpen(true); };
  const onEditEgreso   = (row) => { setEditRow(row); setModalOpen(true); };

  // ====== Abrir comprobante (imagen/PDF) ======
  const normalizeUrl = (url = "") => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const clean = String(url).replace(/^\/+/, "");
    return `${BASE_URL}/${clean}`;
  };
  const onViewComprobante = (row) => {
    const candidate = row?.comprobante_url || row?.comprobante || row?.url || "";
    const finalUrl = normalizeUrl(candidate);
    if (!finalUrl) {
      addToast("advertencia", "Este egreso no tiene comprobante adjunto.");
      return;
    }
    try { window.open(finalUrl, "_blank", "noopener,noreferrer"); }
    catch { window.location.href = finalUrl; }
  };

  // ===== Modal de confirmación de ELIMINAR =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId]   = useState(null);
  const askDeleteEgreso = (id) => { setToDeleteId(id); setConfirmOpen(true); };
  const cancelDelete    = () => { setConfirmOpen(false); setToDeleteId(null); };
  const confirmDelete   = async () => {
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

  /* ========= Exportar “Excel” (CSV UTF-8 con BOM) ========= */
  const csvEscape = (value) => {
    const s = String(value ?? "");
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const exportarCSV = () => {
    if (!egresos.length) {
      addToast("advertencia", "No hay datos para exportar.");
      return;
    }

    const headers = ["Fecha","Categoría","Descripción","Medio","Monto"];
    const sep = ";"; // región es-AR (Excel espera ; por coma decimal)

    const rows = egresos.map((e) => [
      e.fecha || "",
      e.categoria || "",
      e.descripcion || "",
      e.medio_nombre || e.medio_pago || "",
      Number(e.monto || 0).toString().replace(".", ","),
    ]);

    const csvLines = [
      headers.map(csvEscape).join(sep),
      ...rows.map((r) => r.map(csvEscape).join(sep)),
    ];

    const bom = "\uFEFF";
    const csvContent = bom + csvLines.join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const ahora = new Date();
    const dd = String(ahora.getDate()).padStart(2, "0");
    const mm = String(ahora.getMonth() + 1).padStart(2, "0");
    const yyyy = ahora.getFullYear();
    const hh = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");

    const a = document.createElement("a");
    a.href = url;
    a.download = `Egresos_${dd}-${mm}-${yyyy}_${hh}${min}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast("exito", "Archivo exportado.");
  };

  return (
    <div className="ec_wrap">
      {/* TOASTS */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast key={t.id} tipo={t.tipo} mensaje={t.mensaje} duracion={t.duracion} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Toolbar / filtros + KPI */}
      <div className="ec_toolbar card">
        <div className="ec_group">
          <label className="ec_label">Desde</label>
          <input className="ec_input" type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} />
        </div>

        <div className="ec_group">
          <label className="ec_label">Hasta</label>
          <input className="ec_input" type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
        </div>

        <div className="ec_group ec_group--sm">
          <label className="ec_label">Categoría</label>
          <input className="ec_input" value={fCat} onChange={(e) => setFCat(e.target.value)} placeholder="(todas)" />
        </div>

        <div className="ec_group ec_group--sm">
          <label className="ec_label">Medio</label>
          <select
            className="ec_select"
            value={fMedio}
            onChange={(e) => setFMedio(e.target.value)}
            disabled={loadingEgr && !mediosPago.length}
          >
            <option value="">(todos)</option>
            {mediosPago.map((m) => (
              <option key={m.id} value={m.nombre}>{m.nombre}</option>
            ))}
          </select>
        </div>

        <div className="ec_spacer" />

        <div className="ec_kpis">
          <div className="ec_kpi">
            <div className="ec_kpi__icon danger">–</div>
            <div>
              <p className="ec_kpi__label">Total egresos</p>
              <p className="ec_kpi__value">${totalEgresos.toLocaleString("es-AR")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <section className="ec_card card">
        <header className="ec_card__header">
          <h3>Egresos</h3>
          <div className="ec_card__actions">
            <button className="btn" onClick={exportarCSV} disabled={!egresos.length}>
              <FontAwesomeIcon icon={faFileExcel} /> Exportar Excel
            </button>
            <button className="btn btn--primary" onClick={onCreateEgreso}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo egreso
            </button>
          </div>
        </header>

        <div className="ec_table__wrap">
          {/* Overlay SOLO para la tabla */}
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
            <div className="gt_header" role="row">
              <div className="gt_cell h" role="columnheader">Fecha</div>
              <div className="gt_cell h" role="columnheader">Categoría</div>
              <div className="gt_cell h" role="columnheader">Descripción</div>
              <div className="gt_cell h" role="columnheader">Medio</div>
              <div className="gt_cell h right" role="columnheader">Monto</div>
              <div className="gt_cell h center" role="columnheader">Acciones</div>
            </div>

            {egresos.map((e) => {
              const hasFile = Boolean(normalizeUrl(e?.comprobante_url || e?.comprobante || e?.url));
              return (
                <div className="gt_row" role="row" key={e.id_egreso}>
                  <div className="gt_cell" role="cell">{e.fecha}</div>
                  <div className="gt_cell" role="cell"><span className="badge">{e.categoria || "-"}</span></div>
                  <div className="gt_cell" role="cell" title={e.descripcion || "-"}>{e.descripcion || "-"}</div>
                  <div className="gt_cell" role="cell">{e.medio_nombre || e.medio_pago || "-"}</div>
                  <div className="gt_cell right" role="cell">${Number(e.monto || 0).toLocaleString("es-AR")}</div>
                  <div className="gt_cell" role="cell">
                    <div className="row_actions">
                      <button
                        className="icon_btn"
                        title="Ver comprobante"
                        onClick={() => onViewComprobante(e)}
                        disabled={!hasFile}
                      >
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

            {!egresos.length && (
              <div className="gt_empty">{loadingEgr ? "Cargando…" : "Sin egresos"}</div>
            )}
          </div>
        </div>
      </section>

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
