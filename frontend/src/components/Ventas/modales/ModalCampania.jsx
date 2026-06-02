import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import Toggle from "../Toggle";
import { asBool, money, precioProductoAnticipada, precioProductoPuerta } from "../ventasConfig";

const abrirCalendario = (event) => {
  const input = event.currentTarget;

  if (!input || input.disabled || input.readOnly || typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch (_) {
    // Algunos navegadores solo permiten abrirlo con una acción directa del usuario.
  }
};

export default function ModalCampania({ abierto, form, setForm, productos = [], saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const seleccionarProducto = (idProducto) => {
    const producto = productos.find((p) => String(p.id_producto) === String(idProducto));

    if (!producto) {
      setForm((prev) => ({
        ...prev,
        id_producto_principal: "",
        producto_nombre: "",
        producto_descripcion: "",
        producto_precio: "",
        producto_precio_anticipada: "",
        producto_precio_puerta: "",
        producto_stock: "",
      }));
      return;
    }

    const precioAnticipada = precioProductoAnticipada(producto);
    const precioPuerta = precioProductoPuerta(producto);

    setForm((prev) => ({
      ...prev,
      id_producto_principal: producto.id_producto || "",
      producto_nombre: producto.nombre || "",
      producto_descripcion: producto.descripcion || "",
      producto_precio: precioAnticipada,
      producto_precio_anticipada: precioAnticipada,
      producto_precio_puerta: precioPuerta,
      producto_stock: producto.stock ?? "",
    }));
  };

  const titulo = form?.id_campania ? "Editar venta" : "Nueva venta";
  const productoSeleccionado = productos.find((p) => String(p.id_producto) === String(form.id_producto_principal));
  const precioAnticipada = productoSeleccionado ? precioProductoAnticipada(productoSeleccionado) : form.producto_precio_anticipada ?? form.producto_precio;
  const precioPuerta = productoSeleccionado ? precioProductoPuerta(productoSeleccionado) : form.producto_precio_puerta;

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Definí la venta activa que después va a ejecutar el bot."
      onClose={saving ? undefined : onClose}
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body">
          <label>
            Nombre de la opción en el bot
            <input
              value={form.nombre}
              onChange={(e) => setField("nombre", e.target.value)}
              placeholder="Ej: Venta de talitas / Entradas baile escolar"
              maxLength={150}
              required
            />
          </label>

          <label>
            Pregunta que verá el usuario en WhatsApp
            <textarea
              value={form.pregunta_persona || ""}
              rows={2}
              onChange={(e) => setField("pregunta_persona", e.target.value)}
              placeholder="Ingresá el DNI de la persona o alumno que va a realizar la compra/pago."
              required
            />
          </label>

          <label className="ventas-product-selector">
            <span>
              <FontAwesomeIcon icon={faBoxOpen} /> Producto principal de la venta
            </span>
            <select
              value={form.id_producto_principal || ""}
              onChange={(e) => seleccionarProducto(e.target.value)}
              required
            >
              <option value="">Seleccionar producto</option>
              {productos.map((producto) => (
                <option key={producto.id_producto} value={producto.id_producto}>
                  {producto.nombre} - Anticipada {money(precioProductoAnticipada(producto))} / Puerta {money(precioProductoPuerta(producto))}
                  {Number(producto.activo) === 1 ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
            <small>El bot va a usar siempre el precio anticipada. En ventas manuales se puede elegir anticipada o en puerta.</small>
          </label>

          {productos.length === 0 ? (
            <div className="ventas-admin-note ventas-admin-note--warning">
              Todavía no hay productos cargados. Primero cargá el producto en la pestaña Productos y después volvé a crear la venta.
            </div>
          ) : null}

          <div className="ventas-form-row ventas-form-row--three">
            <label>
              Producto / concepto
              <input
                value={form.producto_nombre || ""}
                placeholder="Seleccioná un producto"
                readOnly
                className="ventas-readonly-field"
              />
            </label>
            <label>
              Precio anticipada
              <input
                type="text"
                value={precioAnticipada !== "" && precioAnticipada !== null && precioAnticipada !== undefined ? money(precioAnticipada) : ""}
                placeholder="Seleccioná un producto"
                readOnly
                className="ventas-readonly-field"
              />
            </label>
            <label>
              Precio en puerta
              <input
                type="text"
                value={precioPuerta !== "" && precioPuerta !== null && precioPuerta !== undefined ? money(precioPuerta) : ""}
                placeholder="Seleccioná un producto"
                readOnly
                className="ventas-readonly-field"
              />
            </label>
          </div>

          <div className="ventas-form-row">
            <label>
              Detalle del producto
              <input
                value={form.producto_descripcion || ""}
                placeholder="Sin detalle"
                readOnly
                className="ventas-readonly-field"
              />
            </label>
            <label>
              Stock
              <input
                type="text"
                value={form.producto_stock === null || form.producto_stock === undefined || form.producto_stock === "" ? "Sin límite" : form.producto_stock}
                readOnly
                className="ventas-readonly-field"
              />
            </label>
          </div>

          {productoSeleccionado && Number(productoSeleccionado.activo) !== 1 ? (
            <p className="ventas-flow-help ventas-flow-help--danger">
              Este producto está inactivo. Para mostrar esta venta en el bot, activalo desde Productos o elegí otro.
            </p>
          ) : null}

          <div className="ventas-form-row">
            <label>
              Fecha inicio opcional
              <input
                type="date"
                value={form.fecha_inicio || ""}
                onClick={abrirCalendario}
                onFocus={abrirCalendario}
                onChange={(e) => setField("fecha_inicio", e.target.value)}
              />
            </label>
            <label>
              Fecha fin opcional
              <input
                type="date"
                value={form.fecha_fin || ""}
                onClick={abrirCalendario}
                onFocus={abrirCalendario}
                onChange={(e) => setField("fecha_fin", e.target.value)}
              />
            </label>
          </div>

          <div className="ventas-toggle-grid ventas-toggle-grid--simple">
            <Toggle checked={asBool(form.activo)} label="Venta activa" onChange={(v) => setField("activo", v ? 1 : 0)} />
            <Toggle checked={asBool(form.visible_menu)} label="Mostrar opción en el bot" onChange={(v) => setField("visible_menu", v ? 1 : 0)} />
          </div>
        </div>

        <footer className="ventas-modal__footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving || productos.length === 0}>
            <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar venta"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
