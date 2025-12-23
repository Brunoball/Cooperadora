// src/components/BotPanel/modales/EditEtiquetaModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Modals.css";

const EditEtiquetaModal = ({
  open,
  waId,
  currentEtiquetaId,
  currentEtiquetaNombre,
  etiquetas,
  loading,
  error,
  onClose,
  onSave,

  // ✅ NUEVO: base url puntos para crear etiqueta
  puntosBaseUrl,
  // ✅ NUEVO: para refrescar etiquetas después de crear
  onRefreshEtiquetas,
}) => {
  const cancelRef = useRef(null);

  const [selectedId, setSelectedId] = useState("");

  // ✅ NUEVO: crear etiqueta
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  useEffect(() => {
    if (!open) return;

    setSelectedId(currentEtiquetaId ? String(currentEtiquetaId) : "");
    setNuevoNombre("");
    setCreateErr("");

    setTimeout(() => cancelRef.current?.focus(), 30);
  }, [open, currentEtiquetaId]);

  const etiquetaOptions = useMemo(() => {
    const arr = Array.isArray(etiquetas) ? etiquetas : [];
    // opcional: ordenar por "orden" si existe
    return [...arr].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  }, [etiquetas]);

  if (!open) return null;

  const doSave = () => {
    onSave?.(waId, selectedId === "" ? null : Number(selectedId));
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose?.();
    if (e.key === "Enter") {
      e.preventDefault();
      doSave();
    }
  };

  const postJSON = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  };

  // ✅ Crear etiqueta desde el modal
  const createEtiqueta = async () => {
    const nombre = (nuevoNombre || "").trim();
    if (!nombre) return;

    if (!puntosBaseUrl) {
      setCreateErr("Falta puntosBaseUrl (PANEL_PUNTOS) en el modal");
      return;
    }

    setCreating(true);
    setCreateErr("");

    try {
      const { res, data } = await postJSON(
        `${puntosBaseUrl}/etiquetas_create.php`,
        { nombre }
      );

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      const newId = data?.id_etiqueta;
      if (!newId) throw new Error("No se recibió id_etiqueta");

      // refrescar lista
      await onRefreshEtiquetas?.();

      // seleccionar automáticamente la creada
      setSelectedId(String(newId));
      setNuevoNombre("");
    } catch (e) {
      setCreateErr(e?.message || "No se pudo crear la etiqueta");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="m-overlay"
      role="dialog"
      aria-modal="true"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target?.classList?.contains("m-overlay")) onClose?.();
      }}
    >
      <div className="m-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">Cambiar etiqueta</div>

          <button
            type="button"
            className="m-x"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            disabled={loading || creating}
          >
            ✕
          </button>
        </div>

        <div className="m-body">
          <div className="m-sub">
            Contacto: <b>{waId}</b>
            <br />
            Actual: <b>{currentEtiquetaNombre || "sin etiqueta"}</b>
          </div>

          <div className="m-form">
            <label className="m-label">Etiqueta</label>

            <select
              className="m-input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || creating}
            >
              <option value="">Sin etiqueta</option>

              {etiquetaOptions.map((et) => (
                <option key={et.id_etiqueta} value={String(et.id_etiqueta)}>
                  {et.nombre}
                </option>
              ))}
            </select>

            {/* ✅ BLOQUE: crear etiqueta */}
            <div style={{ marginTop: 8 }}>
              <div className="m-label" style={{ marginBottom: 6 }}>
                Agregar etiqueta
              </div>

              <input
                className="m-input"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: Pagó / Urgente / Nuevo..."
                disabled={loading || creating}
              />

              <div className="m-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="m-btn"
                  onClick={createEtiqueta}
                  disabled={loading || creating || !nuevoNombre.trim()}
                  title="Crear etiqueta"
                >
                  {creating ? "Agregando…" : "Agregar"}
                </button>
              </div>

              {createErr ? <div className="m-err">{createErr}</div> : null}
            </div>

            {error ? <div className="m-err">{error}</div> : null}

            <div className="m-actions">
              <button
                ref={cancelRef}
                type="button"
                className="m-btn m-btn--ghost"
                onClick={onClose}
                disabled={loading || creating}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="m-btn m-btn--primary"
                onClick={doSave}
                disabled={loading || creating}
              >
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditEtiquetaModal;
