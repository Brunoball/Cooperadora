import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faPlus, faSave, faTrash } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import { asBool, estadosOrden, money, personaLabel } from "../ventasConfig";

const today = () => new Date().toISOString().slice(0, 10);

const abrirCalendario = (event) => {
  const input = event.currentTarget;

  if (!input || input.disabled || input.readOnly || typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch (_) {
    // Algunos navegadores solo permiten abrirlo con una acción directa del usuario.
  }
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").replace("$", "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const crearItemVacio = (codigo = "ITEM") => ({
  id_producto: "",
  producto_nombre: "",
  columna_codigo: codigo,
  columna_nombre: "",
  cantidad: 1,
  precio_unitario: "",
});

const crearItemDesdeCampania = (campania) => ({
  id_producto: campania?.id_producto_principal || "",
  producto_nombre: campania?.producto_principal_nombre || "",
  columna_codigo: "VEN",
  columna_nombre: campania?.producto_principal_nombre || "Venta",
  cantidad: 1,
  precio_unitario: campania?.producto_principal_precio ?? "",
});

const normalizarItems = (form, campaniaSeleccionada) => {
  if (Array.isArray(form.items) && form.items.length > 0) {
    return form.items.map((item, idx) => ({
      id_producto: item.id_producto || "",
      producto_nombre: item.producto_nombre || "",
      columna_codigo: item.columna_codigo || (idx === 0 ? "VEN" : "ITEM"),
      columna_nombre: item.columna_nombre || item.producto_nombre || "",
      cantidad: item.cantidad ?? 1,
      precio_unitario: item.precio_unitario ?? "",
    }));
  }

  if (form.id_producto || form.producto_nombre || campaniaSeleccionada) {
    return [
      {
        id_producto: form.id_producto || campaniaSeleccionada?.id_producto_principal || "",
        producto_nombre: form.producto_nombre || campaniaSeleccionada?.producto_principal_nombre || "",
        columna_codigo: form.columna_codigo || "VEN",
        columna_nombre: form.columna_nombre || form.producto_nombre || campaniaSeleccionada?.producto_principal_nombre || "Venta",
        cantidad: form.cantidad ?? 1,
        precio_unitario: form.precio_unitario ?? campaniaSeleccionada?.producto_principal_precio ?? "",
      },
    ];
  }

  return [crearItemVacio("VEN")];
};

export default function ModalOrden({
  abierto,
  form,
  setForm,
  campanias = [],
  productos = [],
  mediosPago = [],
  saving,
  onClose,
  onSubmit,
}) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const campaniaSeleccionada = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(form.id_campania)),
    [campanias, form.id_campania]
  );

  const items = useMemo(() => normalizarItems(form, campaniaSeleccionada), [form, campaniaSeleccionada]);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, Number(item.cantidad || 0)) * Math.max(0, toNumber(item.precio_unitario)), 0),
    [items]
  );

  const titulo = form?.id_orden ? "Editar venta registrada" : "Agregar venta manual";

  const guardarItems = (nuevosItems) => {
    setForm((prev) => ({ ...prev, items: nuevosItems }));
  };

  const actualizarItem = (index, patch) => {
    const nuevos = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    guardarItems(nuevos);
  };

  const seleccionarProductoEnItem = (index, idProducto) => {
    const producto = productos.find((p) => String(p.id_producto) === String(idProducto));

    if (!producto) {
      actualizarItem(index, {
        id_producto: "",
        producto_nombre: "",
        precio_unitario: "",
      });
      return;
    }

    actualizarItem(index, {
      id_producto: producto.id_producto,
      producto_nombre: producto.nombre || "",
      columna_nombre: items[index]?.columna_nombre || producto.nombre || "",
      precio_unitario: producto.precio ?? "",
    });
  };

  const agregarItem = () => {
    const productoGan = productos.find((p) => String(p.nombre || "").toUpperCase().includes("GAN"));
    const codigo = items.some((item) => String(item.columna_codigo || "").toUpperCase() === "GAN") ? "ITEM" : "GAN";

    guardarItems([
      ...items,
      productoGan && codigo === "GAN"
        ? {
            id_producto: productoGan.id_producto,
            producto_nombre: productoGan.nombre || "",
            columna_codigo: "GAN",
            columna_nombre: productoGan.nombre || "Ganancia",
            cantidad: 1,
            precio_unitario: productoGan.precio ?? "",
          }
        : crearItemVacio(codigo),
    ]);
  };

  const quitarItem = (index) => {
    const nuevos = items.filter((_, i) => i !== index);
    guardarItems(nuevos.length ? nuevos : [crearItemVacio("VEN")]);
  };

  const seleccionarCampania = (idCampania) => {
    const campania = campanias.find((c) => String(c.id_campania) === String(idCampania));
    setForm((prev) => ({
      ...prev,
      id_campania: idCampania,
      id_producto: campania?.id_producto_principal || "",
      producto_nombre: campania?.producto_principal_nombre || "",
      precio_unitario: campania?.producto_principal_precio ?? "",
      persona_tipo: campania?.tipo_persona || "comprador",
      items: [crearItemDesdeCampania(campania)],
    }));
  };

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Registrá ventas cobradas fuera del bot con estructura de columnas tipo Excel: VEN, GAN u otros conceptos."
      onClose={saving ? undefined : onClose}
      className="ventas-modal--orden"
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body ventas-orden-body">
          <div className="ventas-orden-note">
            <span className="ventas-orden-note__icon">
              <FontAwesomeIcon icon={faInfoCircle} />
            </span>
            <div>
              <strong>Estructura tipo planilla</strong>
              <span>
                La cabecera se guarda en ventas_ordenes y cada columna/concepto de cantidad se guarda en ventas_orden_items.
                No se importan registros del Excel.
              </span>
            </div>
          </div>

          <div className="ventas-orden-card">
            <div className="ventas-orden-card__head">
              <div>
                <h3>Datos de la venta</h3>
                <p>Seleccioná la venta/campaña, el medio de pago y cargá los conceptos.</p>
              </div>
              <span>{money(total)}</span>
            </div>

            <div className="ventas-form-row">
              <label className="ventas-orden-field">
                <span>Venta / campaña</span>
                <select value={form.id_campania || ""} onChange={(e) => seleccionarCampania(e.target.value)} required>
                  <option value="">Seleccionar venta</option>
                  {campanias.map((c) => (
                    <option key={c.id_campania} value={c.id_campania}>
                      {c.nombre}{!asBool(c.activo) ? " (inactiva)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ventas-orden-field">
                <span>Medio de pago</span>
                <select value={form.id_medio_pago || ""} onChange={(e) => setField("id_medio_pago", e.target.value)} required>
                  <option value="">Seleccionar medio</option>
                  {mediosPago.map((m) => (
                    <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.medio_pago}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="ventas-orden-card ventas-orden-card--items">
            <div className="ventas-orden-card__head ventas-orden-card__head--plain">
              <div>
                <h3>Conceptos de la venta</h3>
                <p>Usá códigos como VEN, GAN, RIFA, BONO, etc. Esos códigos funcionan como las columnas del Excel.</p>
              </div>
              <button type="button" className="ventas-secondary" onClick={agregarItem}>
                <FontAwesomeIcon icon={faPlus} /> Agregar concepto
              </button>
            </div>

            <div className="ventas-items-grid ventas-items-grid--head">
              <span>Columna</span>
              <span>Producto / concepto</span>
              <span>Nombre visible</span>
              <span>Precio</span>
              <span>Cant.</span>
              <span>Subtotal</span>
              <span></span>
            </div>

            {items.map((item, index) => {
              const cantidad = Math.max(0, Number(item.cantidad || 0));
              const precio = Math.max(0, toNumber(item.precio_unitario));
              const subtotal = cantidad * precio;

              return (
                <div className="ventas-items-grid" key={`item-${index}`}>
                  <input
                    value={item.columna_codigo || ""}
                    onChange={(e) => actualizarItem(index, { columna_codigo: e.target.value.toUpperCase() })}
                    placeholder="VEN"
                    maxLength={30}
                    required
                  />

                  <select value={item.id_producto || ""} onChange={(e) => seleccionarProductoEnItem(index, e.target.value)}>
                    <option value="">Manual / sin catálogo</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre} - {money(p.precio || 0)}{Number(p.activo) === 1 ? "" : " (inactivo)"}
                      </option>
                    ))}
                  </select>

                  <input
                    value={item.producto_nombre || ""}
                    onChange={(e) => actualizarItem(index, { producto_nombre: e.target.value, columna_nombre: e.target.value })}
                    placeholder="Ej: Pan dulce / Ganancia"
                    maxLength={150}
                    required
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.precio_unitario ?? ""}
                    onChange={(e) => actualizarItem(index, { precio_unitario: e.target.value })}
                    required
                  />

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.cantidad ?? 0}
                    onChange={(e) => actualizarItem(index, { cantidad: e.target.value })}
                    required
                  />

                  <strong>{money(subtotal)}</strong>

                  <button type="button" className="ventas-item-delete" onClick={() => quitarItem(index)} title="Quitar concepto">
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              );
            })}

            <div className="ventas-manual-total ventas-manual-total--orden">
              <span>Conceptos: {items.length}</span>
              <strong>Total: {money(total)}</strong>
            </div>
          </div>

          <div className="ventas-orden-card ventas-orden-card--soft">
            <div className="ventas-orden-card__head ventas-orden-card__head--plain">
              <div>
                <h3>Datos del comprador / responsable</h3>
                <p>Estos datos representan la fila de la planilla.</p>
              </div>
            </div>

            <div className="ventas-form-row">
              <label className="ventas-orden-field">
                <span>{form.persona_tipo === "vendedor" ? "Responsable / vendedor" : "Nombre del comprador"}</span>
                <input
                  value={form.persona_nombre || ""}
                  onChange={(e) => setField("persona_nombre", e.target.value)}
                  placeholder="Nombre y apellido"
                  maxLength={160}
                  required
                />
              </label>
              <label className="ventas-orden-field">
                <span>Detalle / curso / DNI</span>
                <input
                  value={form.persona_detalle || ""}
                  onChange={(e) => setField("persona_detalle", e.target.value)}
                  placeholder={form.persona_tipo === "vendedor" ? "DNI, curso, alumno o referencia" : "Curso, DNI o referencia"}
                  maxLength={160}
                />
              </label>
            </div>

            <div className="ventas-form-row ventas-form-row--three">
              <label className="ventas-orden-field">
                <span>Teléfono opcional</span>
                <input value={form.comprador_telefono || ""} onChange={(e) => setField("comprador_telefono", e.target.value)} maxLength={40} />
              </label>
              <label className="ventas-orden-field">
                <span>Estado</span>
                <select value={form.estado || "aprobada"} onChange={(e) => setField("estado", e.target.value)}>
                  {estadosOrden.filter((e) => e.value).map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </label>
              <label className="ventas-orden-field">
                <span>Fecha de venta</span>
                <input
                  type="date"
                  value={form.fecha_venta || today()}
                  onClick={abrirCalendario}
                  onFocus={abrirCalendario}
                  onChange={(e) => setField("fecha_venta", e.target.value)}
                />
              </label>
            </div>

            <div className="ventas-manual-total ventas-manual-total--orden">
              <span>Flujo: {personaLabel(form.persona_tipo || campaniaSeleccionada?.tipo_persona || "comprador")}</span>
              <strong>Total: {money(total)}</strong>
            </div>

            <label className="ventas-orden-field ventas-orden-field--full">
              <span>Observación opcional</span>
              <textarea value={form.observacion || ""} rows={3} onChange={(e) => setField("observacion", e.target.value)} placeholder="Ej: transferencia, pagó en secretaría, recibió comprobante manual, etc." />
            </label>
          </div>
        </div>

        <footer className="ventas-modal__footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving || total <= 0}>
            <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar venta"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
