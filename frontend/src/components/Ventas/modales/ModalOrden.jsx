import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faSave } from "@fortawesome/free-solid-svg-icons";
import ModalBase from "./ModalBase";
import { asBool, estadosOrden, money, personaLabel } from "../ventasConfig";

const today = () => new Date().toISOString().slice(0, 10);

export default function ModalOrden({ abierto, form, setForm, campanias = [], mediosPago = [], saving, onClose, onSubmit }) {
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const campaniasConProducto = useMemo(
    () => campanias.filter((c) => c.id_producto_principal || c.producto_principal_nombre),
    [campanias]
  );

  const campaniaSeleccionada = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(form.id_campania)),
    [campanias, form.id_campania]
  );

  const cantidad = Math.max(1, Number(form.cantidad || 1));
  const precio = Number(form.precio_unitario || campaniaSeleccionada?.producto_principal_precio || 0);
  const total = cantidad * precio;
  const titulo = form?.id_orden ? "Editar venta registrada" : "Agregar venta manual";

  const seleccionarCampania = (idCampania) => {
    const campania = campanias.find((c) => String(c.id_campania) === String(idCampania));
    setForm((prev) => ({
      ...prev,
      id_campania: idCampania,
      id_producto: campania?.id_producto_principal || "",
      producto_nombre: campania?.producto_principal_nombre || "",
      precio_unitario: campania?.producto_principal_precio ?? "",
      persona_tipo: campania?.tipo_persona || "comprador",
    }));
  };

  return (
    <ModalBase
      abierto={abierto}
      titulo={titulo}
      subtitulo="Registrá ventas cobradas fuera del bot, por ejemplo pagos en efectivo a la cooperadora."
      onClose={saving ? undefined : onClose}
    >
      <form className="ventas-form" onSubmit={onSubmit}>
        <div className="ventas-modal__body">
          <div className="ventas-flow-preview">
            <FontAwesomeIcon icon={faInfoCircle} />
            <div>
              <strong>Registro manual de caja</strong>
              <span>
                Los pagos creados por WhatsApp quedan como transferencia por defecto. Acá podés cargar o corregir ventas manuales indicando el medio de pago real.
              </span>
            </div>
          </div>

          <div className="ventas-form-row">
            <label>
              Venta / campaña
              <select value={form.id_campania || ""} onChange={(e) => seleccionarCampania(e.target.value)} required>
                <option value="">Seleccionar venta</option>
                {campaniasConProducto.map((c) => (
                  <option key={c.id_campania} value={c.id_campania}>
                    {c.nombre}{!asBool(c.activo) ? " (inactiva)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Medio de pago
              <select value={form.id_medio_pago || ""} onChange={(e) => setField("id_medio_pago", e.target.value)} required>
                <option value="">Seleccionar medio</option>
                {mediosPago.map((m) => (
                  <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.medio_pago}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="ventas-form-row ventas-form-row--three">
            <label>
              Producto
              <input value={form.producto_nombre || campaniaSeleccionada?.producto_principal_nombre || ""} readOnly className="ventas-readonly-field" />
            </label>
            <label>
              Precio unitario
              <input value={money(precio)} readOnly className="ventas-readonly-field" />
            </label>
            <label>
              Cantidad
              <input type="number" min="1" step="1" value={form.cantidad || 1} onChange={(e) => setField("cantidad", e.target.value)} required />
            </label>
          </div>

          <div className="ventas-form-row">
            <label>
              {form.persona_tipo === "vendedor" ? "Responsable / vendedor" : "Nombre del comprador"}
              <input
                value={form.persona_nombre || ""}
                onChange={(e) => setField("persona_nombre", e.target.value)}
                placeholder="Nombre y apellido"
                maxLength={160}
                required
              />
            </label>
            <label>
              Detalle opcional
              <input
                value={form.persona_detalle || ""}
                onChange={(e) => setField("persona_detalle", e.target.value)}
                placeholder={form.persona_tipo === "vendedor" ? "DNI, curso, alumno o referencia" : "DNI o referencia"}
                maxLength={160}
              />
            </label>
          </div>

          <div className="ventas-form-row ventas-form-row--three">
            <label>
              Teléfono opcional
              <input value={form.comprador_telefono || ""} onChange={(e) => setField("comprador_telefono", e.target.value)} maxLength={40} />
            </label>
            <label>
              Estado
              <select value={form.estado || "aprobada"} onChange={(e) => setField("estado", e.target.value)}>
                {estadosOrden.filter((e) => e.value).map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha de venta
              <input type="date" value={form.fecha_venta || today()} onChange={(e) => setField("fecha_venta", e.target.value)} />
            </label>
          </div>

          <div className="ventas-manual-total">
            <span>Flujo: {personaLabel(form.persona_tipo || campaniaSeleccionada?.tipo_persona || "comprador")}</span>
            <strong>Total: {money(total)}</strong>
          </div>

          <label>
            Observación opcional
            <textarea value={form.observacion || ""} rows={3} onChange={(e) => setField("observacion", e.target.value)} placeholder="Ej: pagó en secretaría, recibió comprobante manual, etc." />
          </label>
        </div>

        <footer className="ventas-modal__footer">
          <button type="button" className="ventas-modal-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="ventas-primary" type="submit" disabled={saving}>
            <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar venta"}
          </button>
        </footer>
      </form>
    </ModalBase>
  );
}
