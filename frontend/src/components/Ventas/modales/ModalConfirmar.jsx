import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff, faTrash } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";

export default function ModalConfirmar({ abierto, titulo, mensaje, confirmText = "Confirmar", saving, onClose, onConfirm }) {
  const esEliminar = String(titulo || confirmText).toLowerCase().includes("eliminar");
  const icono = esEliminar ? faTrash : faPowerOff;

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo || "Confirmar acción"}
      onClose={saving ? undefined : onClose}
      size="sm"
      className={`ventas-modal--global-confirm ${esEliminar ? "ventas-modal--confirm-delete" : "ventas-modal--confirm-baja"}`}
    >
      <div className="ventas-modal__body ventas-global-confirm__body">
        <div className="ventas-global-confirm__icon" aria-hidden="true">
          <FontAwesomeIcon icon={icono} />
        </div>
        <p>{mensaje}</p>
      </div>
      <footer className="ventas-modal__footer ventas-global-confirm__actions">
        <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="ventas-modal-danger" onClick={onConfirm} disabled={saving}>
          <FontAwesomeIcon icon={icono} /> {saving ? "Procesando..." : confirmText}
        </button>
      </footer>
    </ModalBase>
  );
}
