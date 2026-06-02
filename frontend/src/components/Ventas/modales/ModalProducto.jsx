import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faDollarSign, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import Toggle from "../Toggle";
import { asBool } from "../ventasConfig";

export default function ModalProducto({ abierto, form, setForm, saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setPrecioAnticipada = (value) => setForm((prev) => ({ ...prev, precio_anticipada: value, precio: value }));
  const titulo = form?.id_producto ? "Editar producto" : "Nuevo producto";

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Cargá el producto al catálogo. Después lo elegís desde la venta o campaña que corresponda."
      onClose={saving ? undefined : onClose}
      className="ventas-modal--producto"
    >
      <form className="ventas-form ventas-producto-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-producto-body">
          <div className="ventas-producto-note">
            <span className="ventas-producto-note__icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBoxOpen} />
            </span>
            <span>
              El producto tiene dos precios: <strong>anticipada</strong> y <strong>en puerta</strong>. El bot siempre usa anticipada; en ventas manuales podés elegir cualquiera.
            </span>
          </div>

          <div className="ventas-producto-card">
            <div className="ventas-producto-card__head">
              <span className="ventas-producto-card__icon" aria-hidden="true">
                <FontAwesomeIcon icon={faBoxOpen} />
              </span>
              <div>
                <h3>Datos del producto</h3>
                <p>Completá la información principal del catálogo.</p>
              </div>
            </div>

            <label className="ventas-producto-field ventas-producto-field--full">
              <span>Nombre</span>
              <input
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                placeholder="Ej: Entrada general"
                maxLength={150}
                required
              />
            </label>

            <label className="ventas-producto-field ventas-producto-field--full">
              <span>Descripción</span>
              <textarea value={form.descripcion || ""} rows={3} onChange={(e) => setField("descripcion", e.target.value)} placeholder="Detalle opcional del producto" />
            </label>

            <div className="ventas-form-row ventas-producto-grid">
              <label className="ventas-producto-field ventas-producto-field--money">
                <span>Precio anticipada</span>
                <div className="ventas-producto-inputIcon">
                  <FontAwesomeIcon icon={faDollarSign} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio_anticipada ?? form.precio ?? ""}
                    onChange={(e) => setPrecioAnticipada(e.target.value)}
                    required
                  />
                </div>
              </label>
              <label className="ventas-producto-field ventas-producto-field--money">
                <span>Precio en puerta</span>
                <div className="ventas-producto-inputIcon">
                  <FontAwesomeIcon icon={faDollarSign} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio_puerta ?? ""}
                    onChange={(e) => setField("precio_puerta", e.target.value)}
                    required
                  />
                </div>
              </label>
              <label className="ventas-producto-field">
                <span>Stock opcional</span>
                <input type="number" min="0" value={form.stock ?? ""} onChange={(e) => setField("stock", e.target.value)} placeholder="Sin límite" />
              </label>
            </div>
          </div>

          <div className="ventas-producto-status">
            <Toggle checked={asBool(form.activo)} label="Producto activo" onChange={(v) => setField("activo", v ? 1 : 0)} />
          </div>
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
