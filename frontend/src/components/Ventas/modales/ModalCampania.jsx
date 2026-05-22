import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faInfoCircle, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import Toggle from "../Toggle";
import {
  asBool,
  defaultMensajeInicio,
  defaultPreguntaPersona,
  money,
  personaConfig,
  tiposPersona,
} from "../ventasConfig";

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
        producto_stock: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      id_producto_principal: producto.id_producto || "",
      producto_nombre: producto.nombre || "",
      producto_descripcion: producto.descripcion || "",
      producto_precio: producto.precio ?? "",
      producto_stock: producto.stock ?? "",
    }));
  };

  const cambiarTipoPersona = (value) => {
    setForm((prev) => ({
      ...prev,
      tipo_persona: value,
      pregunta_persona: defaultPreguntaPersona(value),
      mensaje_inicio: defaultMensajeInicio(value),
    }));
  };

  const tipoActual = personaConfig(form?.tipo_persona);
  const titulo = form?.id_campania ? "Editar venta" : "Nueva venta";
  const productoSeleccionado = productos.find((p) => String(p.id_producto) === String(form.id_producto_principal));

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Definí la venta activa que después va a ejecutar el bot."
      onClose={saving ? undefined : onClose}
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body">
          <div className="ventas-flow-preview">
            <FontAwesomeIcon icon={faInfoCircle} />
            <div>
              <strong>Flujo fijo del bot</strong>
              <span>
                Al elegir la opción de ventas, el bot abre directamente esta venta activa. Acá solo se elige el flujo,
                el producto del catálogo y si la venta queda activa o visible en WhatsApp.
              </span>
            </div>
          </div>

          <div className="ventas-admin-note">
            Solo puede haber <strong>una venta activa para el bot</strong>. Los productos se cargan aparte en la pestaña Productos;
            desde esta pantalla únicamente elegís cuál se va a vender.
          </div>

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

          <div className="ventas-simple-box">
            <h3>¿Qué dato tiene que pedir el bot al iniciar el flujo?</h3>
            <div className="ventas-persona-options">
              {tiposPersona.map((tipo) => (
                <button
                  key={tipo.value}
                  type="button"
                  className={form.tipo_persona === tipo.value ? "active" : ""}
                  onClick={() => cambiarTipoPersona(tipo.value)}
                >
                  <strong>{tipo.shortLabel}</strong>
                  <span>{tipo.ejemplo}</span>
                </button>
              ))}
            </div>
            <p className="ventas-flow-help">{tipoActual.resumen}</p>
          </div>

          <label>
            Pregunta que verá el usuario en WhatsApp
            <textarea
              value={form.pregunta_persona || ""}
              rows={2}
              onChange={(e) => setField("pregunta_persona", e.target.value)}
              placeholder={tipoActual.pregunta}
              required
            />
          </label>

          <div className="ventas-simple-box ventas-product-config">
            <h3>
              <FontAwesomeIcon icon={faBoxOpen} /> Producto que se va a vender
            </h3>

            <label className="ventas-product-selector">
              Producto cargado en la pestaña Productos
              <select
                value={form.id_producto_principal || ""}
                onChange={(e) => seleccionarProducto(e.target.value)}
                required
              >
                <option value="">Seleccionar producto</option>
                {productos.map((producto) => (
                  <option key={producto.id_producto} value={producto.id_producto}>
                    {producto.nombre} - {money(producto.precio || 0)}
                    {Number(producto.activo) === 1 ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
              <span>
                Si necesitás cambiar nombre, precio, detalle o stock, editá el producto desde la pestaña Productos.
              </span>
            </label>

            {productos.length === 0 ? (
              <div className="ventas-admin-note ventas-admin-note--warning">
                Todavía no hay productos cargados. Primero cargá el producto en la pestaña Productos y después volvé a crear la venta.
              </div>
            ) : null}

            <div className="ventas-form-row">
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
                Precio unitario
                <input
                  type="text"
                  value={form.producto_precio !== "" && form.producto_precio !== null && form.producto_precio !== undefined ? money(form.producto_precio) : ""}
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
            ) : (
              <p className="ventas-flow-help">
                La venta usa un solo producto seleccionado del catálogo. Esta pantalla no modifica datos del producto.
              </p>
            )}
          </div>

          <div className="ventas-form-row">
            <label>
              Fecha inicio opcional
              <input type="date" value={form.fecha_inicio || ""} onChange={(e) => setField("fecha_inicio", e.target.value)} />
            </label>
            <label>
              Fecha fin opcional
              <input type="date" value={form.fecha_fin || ""} onChange={(e) => setField("fecha_fin", e.target.value)} />
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
