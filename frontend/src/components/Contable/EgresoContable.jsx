// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faEdit, faEye } from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal";
import Toast from "../Global/Toast";

const hoy = new Date();
const Y = hoy.getFullYear();

/* Confirmación reutilizable (modal simple) */
function ConfirmModal({ open, title = "Confirmar", message, onCancel, onConfirm, confirmText = "Eliminar", cancelText = "Cancelar" }) {
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
  const [fEnd, setFEnd] = useState(`${Y}-12-31`);
  const [fCat, setFCat] = useState("");
  const [fMedio, setFMedio] = useState("");

  const [mediosPago, setMediosPago] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // ====== TOASTS (renderizados SOLO acá) ======
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
      if (fCat)  params.set("categoria", fCat);
      if (fMedio) params.set("medio", fMedio);
      const raw = await fetchJSON(
        `${BASE_URL}/api.php?action=contable_egresos&op=list&${params.toString()}`
      );
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
    // si es absoluta, devolver tal cual
    if (/^https?:\/\//i.test(url)) return url;
    // relativa: unir con BASE_URL cuidando las barras
    const clean = String(url).replace(/^\/+/, "");
    return `${BASE_URL}/${clean}`;
  };

  const onViewComprobante = (row) => {
    // campos posibles: comprobante_url (nuevo), comprobante, url
    const candidate =
      row?.comprobante_url || row?.comprobante || row?.url || "";
    const finalUrl = normalizeUrl(candidate);

    if (!finalUrl) {
      addToast("advertencia", "Este egreso no tiene comprobante adjunto.");
      return;
    }
    try {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = finalUrl;
    }
  };

  // ===== Modal de confirmación de ELIMINAR =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);

  const askDeleteEgreso = (id) => {
    setToDeleteId(id);
    setConfirmOpen(true);
  };
  const cancelDelete = () => {
    setConfirmOpen(false);
    setToDeleteId(null);
  };
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

  // Cuando el modal guarda, SOLO refrescamos y cerramos (los toasts los dispara el modal)
  const onSavedEgreso = () => {
    setModalOpen(false);
    loadEgresos();
  };

  return (
    <div className="lc_panel">
      {/* TOAST STACK */}
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

      <div className="lc_filters">
        <label>Desde:{" "}
          <input type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} />
        </label>
        <label>Hasta:{" "}
          <input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
        </label>
        <label>Categoría:{" "}
          <input value={fCat} onChange={(e) => setFCat(e.target.value)} placeholder="(todas)" />
        </label>

        <label>Medio:
          <select
            value={fMedio}
            onChange={(e) => setFMedio(e.target.value)}
            disabled={loadingEgr && !mediosPago.length}
          >
            <option value="">(todos)</option>
            {mediosPago.map((m) => (
              <option key={m.id} value={m.nombre}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="lc_spacer" />
        <button className="lc_btn primary" onClick={onCreateEgreso}>
          <FontAwesomeIcon icon={faPlus} /> Nuevo egreso
        </button>
      </div>

      <div className="lc_cards">
        <div className="lc_card">
          <h3>Total egresos</h3>
          <p className="lc_big">${totalEgresos.toLocaleString("es-AR")}</p>
        </div>
      </div>

      <div className="lc_box">
        <table className="lc_table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Medio</th>
              <th>Monto</th>
              <th style={{ width: 180 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {egresos.map((e) => (
              <tr key={e.id_egreso}>
                <td>{e.fecha}</td>
                <td>{e.categoria}</td>
                <td>{e.descripcion || "-"}</td>
                <td>{e.medio_nombre || e.medio_pago || "-"}</td>
                <td>${Number(e.monto || 0).toLocaleString("es-AR")}</td>
                <td className="lc_actions">
                  {/* Ver comprobante */}
                  <button
                    className="lc_icon"
                    onClick={() => onViewComprobante(e)}
                    title="Ver comprobante"
                    disabled={!normalizeUrl(e?.comprobante_url || e?.comprobante || e?.url)}
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>

                  {/* Editar */}
                  <button className="lc_icon" onClick={() => onEditEgreso(e)} title="Editar">
                    <FontAwesomeIcon icon={faEdit} />
                  </button>

                  {/* Eliminar */}
                  <button
                    className="lc_icon danger"
                    onClick={() => askDeleteEgreso(e.id_egreso)}
                    title="Eliminar"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </td>
              </tr>
            ))}
            {!egresos.length && (
              <tr>
                <td colSpan={6} className="lc_empty">
                  {loadingEgr ? "Cargando..." : "Sin egresos"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de ABM de egresos */}
      <ContableEgresoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSavedEgreso}
        editRow={editRow}
        notify={addToast}
      />

      {/* Modal de confirmación de eliminación */}
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
