import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faEye, faEyeSlash, faPowerOff, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { asBool, money, personaLabel } from "../ventasConfig";

export default function CampaniasTab({ campanias, onAdd, onEdit, onDelete, onToggleActivo }) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div>
          <h2>Ventas configuradas</h2>
          <p>El bot trabaja con una sola venta activa. Acá elegís el flujo y el producto del catálogo que se va a cobrar.</p>
        </div>
        <button type="button" className="ventas-primary" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} /> Agregar venta
        </button>
      </div>

      <div className="ventas-table-wrap ventas-table-wrap--center">
        <table className="ventas-table ventas-table--campanias">
          <thead>
            <tr>
              <th>Venta</th>
              <th>Flujo</th>
              <th>Producto / precio</th>
              <th>Producto</th>
              <th>Ventas</th>
              <th>Bot</th>
              <th>Estado</th>
              <th>Fechas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campanias.length === 0 ? (
              <tr>
                <td colSpan="9" className="ventas-empty-cell">No hay ventas cargadas todavía.</td>
              </tr>
            ) : (
              campanias.map((c) => {
                const activo = asBool(c.activo);
                return (
                  <tr key={c.id_campania} className={!activo ? "ventas-row-muted" : ""}>
                    <td>
                      <strong>{c.nombre}</strong>
                      <span>Venta #{c.id_campania}</span>
                    </td>
                    <td>
                      <strong>{personaLabel(c.tipo_persona)}</strong>
                      <span>{c.pregunta_persona || "Sin pregunta configurada."}</span>
                    </td>
                    <td>
                      <strong>{c.producto_principal_nombre || "Sin producto"}</strong>
                      <span>{c.producto_principal_nombre ? money(c.producto_principal_precio) : "Seleccioná un producto para mostrarla en el bot."}</span>
                    </td>
                    <td>{c.productos_activos || 0}</td>
                    <td>{c.ordenes_total || 0}</td>
                    <td>
                      <span className={`ventas-status ${asBool(c.disponible_menu) ? "ok" : "muted"}`}>
                        <FontAwesomeIcon icon={asBool(c.disponible_menu) ? faEye : faEyeSlash} />
                        {asBool(c.disponible_menu) ? "Visible" : "Oculta"}
                      </span>
                    </td>
                    <td>
                      <span className={`ventas-status ${activo ? "ok" : "muted"}`}>
                        {activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>
                      <strong>{c.fecha_inicio ? String(c.fecha_inicio).slice(0, 10) : "Sin inicio"}</strong>
                      <span>{c.fecha_fin ? `Hasta ${String(c.fecha_fin).slice(0, 10)}` : "Sin fin"}</span>
                    </td>
                    <td className="ventas-row-actions">
                      <button type="button" onClick={() => onEdit(c)} title="Editar venta">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        type="button"
                        className={activo ? "warning" : "success"}
                        onClick={() => onToggleActivo(c)}
                        title={activo ? "Dar de baja venta" : "Activar venta"}
                      >
                        <FontAwesomeIcon icon={faPowerOff} />
                      </button>
                      <button type="button" className="danger" onClick={() => onDelete(c)} title="Eliminar venta definitivamente">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
