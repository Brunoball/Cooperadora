import React from "react";
import "./Modals.css";

const ConfirmActionModal = ({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading,
  error,
  danger,
  onClose,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div className="m-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="m-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">{title}</div>
          <button className="m-x" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="m-body">
          <div className="m-sub">{description}</div>

          {error ? <div className="m-err">{error}</div> : null}

          <div className="m-actions">
            <button type="button" className="m-btn m-btn--ghost" onClick={onClose}>
              {cancelText}
            </button>

            <button
              type="button"
              className={`m-btn ${danger ? "m-btn--danger" : "m-btn--primary"}`}
              onClick={onConfirm}
              disabled={!!loading}
            >
              {loading ? "Procesando…" : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
