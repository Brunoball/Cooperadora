import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Modals.css";

const norm = (v) => String(v ?? "").trim();

const EditNombreModal = ({
  open,
  waId,
  currentName,
  loading,
  error,
  onClose,
  onSave,
}) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState("");

  const initial = useMemo(() => norm(currentName), [currentName]);

  useEffect(() => {
    if (!open) return;
    setValue(initial);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave?.(waId, value);
  };

  return (
    <div className="m-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="m-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">Editar nombre</div>
          <button className="m-x" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="m-body">
          <div className="m-sub">
            Número: <b>{waId}</b>
          </div>

          <form onSubmit={submit} className="m-form">
            <label className="m-label">Nombre</label>
            <input
              ref={inputRef}
              className="m-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: Juan Pérez"
              maxLength={80}
            />

            {error ? <div className="m-err">{error}</div> : null}

            <div className="m-actions">
              <button type="button" className="m-btn m-btn--ghost" onClick={onClose}>
                Cancelar
              </button>

              <button type="submit" className="m-btn m-btn--primary" disabled={!!loading}>
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditNombreModal;
