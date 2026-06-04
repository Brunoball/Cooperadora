// src/components/BotPanel/modales/EditEtiquetaModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useModalEscapeStack } from "./useModalEscapeStack";
import "./EditEtiquetaModal.css";

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

  useModalEscapeStack(open, onClose);

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
      className="bp-tag-overlay"
      role="dialog"
      aria-modal="true"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target?.classList?.contains("bp-tag-overlay")) onClose?.();
      }}
    >
      <div className="bp-tag-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bp-tag-head">
          <div className="bp-tag-heading">
            <span className="bp-tag-eyebrow">Organización</span>
            <div className="bp-tag-title">Cambiar etiqueta</div>
            <p className="bp-tag-subtitle">Clasificá el contacto o creá una nueva categoría.</p>
          </div>

          <button
            type="button"
            className="bp-tag-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            disabled={loading || creating}
          >
            ✕
          </button>
        </div>

        <div className="bp-tag-body">
          <div className="bp-tag-contact">
            <div className="bp-tag-detail">
              <span>Contacto</span>
              <b>{waId}</b>
            </div>
            <div className="bp-tag-detail">
              <span>Etiqueta actual</span>
              <b>{currentEtiquetaNombre || "Sin etiqueta"}</b>
            </div>
          </div>

          <div className="bp-tag-form">
            <label className="bp-tag-label" htmlFor="bp-tag-select">Etiqueta asignada</label>

            <select
              id="bp-tag-select"
              className="bp-tag-input"
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
            <div className="bp-tag-create">
              <div className="bp-tag-create-head">
                <div className="bp-tag-label bp-tag-label--create">Nueva etiqueta</div>
                <p>Agregala a la lista y quedará seleccionada automáticamente.</p>
              </div>

              <input
                className="bp-tag-input"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: Pagó / Urgente / Nuevo..."
                disabled={loading || creating}
              />

              <div className="bp-tag-actions bp-tag-actions--create">
                <button
                  type="button"
                  className="bp-tag-btn"
                  onClick={createEtiqueta}
                  disabled={loading || creating || !nuevoNombre.trim()}
                  title="Crear etiqueta"
                >
                  {creating ? "Agregando…" : "Agregar"}
                </button>
              </div>

              {createErr ? <div className="bp-tag-error">{createErr}</div> : null}
            </div>

            {error ? <div className="bp-tag-error">{error}</div> : null}

            <div className="bp-tag-actions">
              <button
                ref={cancelRef}
                type="button"
                className="bp-tag-btn bp-tag-btn--ghost"
                onClick={onClose}
                disabled={loading || creating}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="bp-tag-btn bp-tag-btn--primary"
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
