import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faDollarSign, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import "./ModalProducto.css";
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
      subtitulo="Definí la información, los precios y la disponibilidad del producto para tus ventas."
      onClose={saving ? undefined : onClose}
      className="ventas-modal--producto"
    >
      <form className="ventas-form ventas-producto-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-producto-body">
          <div className="ventas-producto-note">
            <span className="ventas-producto-note__icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBoxOpen} />
            </span>
            <div>
              <strong>Precios de venta</strong>
              <span>
                El bot utiliza el precio anticipada. En las ventas manuales también podés elegir el precio en puerta.
              </span>
            </div>
          </div>

          <div className="ventas-producto-sections">
            <section className="ventas-producto-panel ventas-producto-panel--identity">
              <div className="ventas-producto-panel__head">
                <span className="ventas-producto-panel__icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faBoxOpen} />
                </span>
                <div>
                  <h3>Información del producto</h3>
                  <p>Nombre y detalle que identificarán la venta.</p>
                </div>
              </div>

              <label className="ventas-producto-field ventas-floating-field">
                <span className="ventas-floating-label">Nombre del producto</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setField("nombre", e.target.value)}
                  placeholder="Ej: Entrada general"
                  maxLength={150}
                  required
                />
              </label>

              <label className="ventas-producto-field ventas-producto-field--description ventas-floating-field">
                <span className="ventas-floating-label">Descripción</span>
                <textarea
                  value={form.descripcion || ""}
                  rows={4}
                  onChange={(e) => setField("descripcion", e.target.value)}
                  placeholder="Detalle opcional del producto"
                />
                <small>Podés indicar condiciones, sector o una referencia interna.</small>
              </label>
            </section>

            <section className="ventas-producto-panel ventas-producto-panel--commercial">
              <div className="ventas-producto-panel__head">
                <span className="ventas-producto-panel__icon ventas-producto-panel__icon--price" aria-hidden="true">
                  <FontAwesomeIcon icon={faDollarSign} />
                </span>
                <div>
                  <h3>Precios y disponibilidad</h3>
                  <p>Configurá cómo se venderá y si estará disponible.</p>
                </div>
              </div>

              <div className="ventas-producto-commercial-grid">
                <label className="ventas-producto-price-card">
                  <span className="ventas-producto-price-card__title">
                    <strong>Precio anticipada</strong>
                    <em>Bot</em>
                  </span>
                  <div className="ventas-producto-inputIcon">
                    <FontAwesomeIcon icon={faDollarSign} />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precio_anticipada ?? form.precio ?? ""}
                      onChange={(e) => setPrecioAnticipada(e.target.value)}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <small>Precio principal de la venta.</small>
                </label>

                <label className="ventas-producto-price-card ventas-producto-price-card--door">
                  <span className="ventas-producto-price-card__title">
                    <strong>Precio en puerta</strong>
                    <em>Manual</em>
                  </span>
                  <div className="ventas-producto-inputIcon">
                    <FontAwesomeIcon icon={faDollarSign} />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precio_puerta ?? ""}
                      onChange={(e) => setField("precio_puerta", e.target.value)}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <small>Alternativa para ventas presenciales.</small>
                </label>

                <label className="ventas-producto-stock-card">
                  <span>Stock disponible</span>
                  <input
                    type="number"
                    min="0"
                    value={form.stock ?? ""}
                    onChange={(e) => setField("stock", e.target.value)}
                    placeholder="Sin límite"
                  />
                  <small>Dejá vacío para no limitar unidades.</small>
                </label>

                <div className="ventas-producto-status-card">
                  <span className="ventas-producto-status-card__title">Visibilidad</span>
                  <Toggle checked={asBool(form.activo)} label="Producto activo" onChange={(v) => setField("activo", v ? 1 : 0)} />
                  <small>Activo permite utilizarlo en nuevas ventas.</small>
                </div>
              </div>
            </section>
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
