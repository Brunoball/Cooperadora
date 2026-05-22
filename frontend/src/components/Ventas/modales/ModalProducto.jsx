import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import Toggle from "../Toggle";
import { asBool } from "../ventasConfig";

export default function ModalProducto({ abierto, form, setForm, saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const titulo = form?.id_producto ? "Editar producto" : "Nuevo producto";

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Cargá el producto al catálogo. Después lo elegís desde la venta o campaña que corresponda."
      onClose={saving ? undefined : onClose}
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body">
          <div className="ventas-admin-note">
            El producto ya no se relaciona desde acá con una venta. Primero cargás el producto y después, desde Configuración, seleccionás qué producto se va a vender.
          </div>

          <label>
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => setField("nombre", e.target.value)}
              placeholder="Ej: Entrada general"
              maxLength={150}
              required
            />
          </label>

          <label>
            Descripción
            <textarea value={form.descripcion || ""} rows={3} onChange={(e) => setField("descripcion", e.target.value)} />
          </label>

          <div className="ventas-form-row">
            <label>
              Precio
              <input type="number" min="0" step="0.01" value={form.precio} onChange={(e) => setField("precio", e.target.value)} required />
            </label>
            <label>
              Stock opcional
              <input type="number" min="0" value={form.stock ?? ""} onChange={(e) => setField("stock", e.target.value)} placeholder="Sin límite" />
            </label>
          </div>

          <Toggle checked={asBool(form.activo)} label="Producto activo" onChange={(v) => setField("activo", v ? 1 : 0)} />
        </div>

        <footer className="ventas-modal__footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving}>
            <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar producto"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
