import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";

export default function ModalConfirmar({ abierto, titulo, mensaje, confirmText = "Confirmar", saving, onClose, onConfirm }) {
  return (
    <ModalBase abierto={abierto} titulo={titulo || "Confirmar acción"} subtitulo={mensaje} onClose={saving ? undefined : onClose} size="sm">
      <footer className="ventas-modal__footer">
        <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="ventas-modal-danger" onClick={onConfirm} disabled={saving}>
          <FontAwesomeIcon icon={faTrash} /> {saving ? "Procesando..." : confirmText}
        </button>
      </footer>
    </ModalBase>
  );
}
