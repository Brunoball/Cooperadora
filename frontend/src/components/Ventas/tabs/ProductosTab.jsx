import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPowerOff, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { asBool, money } from "../ventasConfig";

export default function ProductosTab({ productos, onAdd, onEdit, onDelete, onToggleActivo }) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div>
          <h2>Catálogo de productos</h2>
          <p>{productos.length} registros encontrados. Los productos se cargan una sola vez y después se seleccionan desde cada venta.</p>
        </div>
        <button type="button" className="ventas-primary" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} /> Agregar producto
        </button>
      </div>

      <div className="ventas-table-wrap ventas-table-wrap--center">
        <table className="ventas-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Usado en ventas</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 ? (
              <tr>
                <td colSpan="6" className="ventas-empty-cell">Sin productos.</td>
              </tr>
            ) : (
              productos.map((p) => {
                const activo = asBool(p.activo);
                return (
                  <tr key={p.id_producto} className={!activo ? "ventas-row-muted" : ""}>
                    <td>
                      <strong>{p.nombre}</strong>
                      <span>{p.descripcion || "Sin descripción."}</span>
                    </td>
                    <td>{p.campanias_asociadas || "Sin asignar"}</td>
                    <td>{money(p.precio)}</td>
                    <td>{p.stock === null || p.stock === undefined || p.stock === "" ? "Sin límite" : p.stock}</td>
                    <td>
                      <span className={`ventas-status ${activo ? "ok" : "muted"}`}>
                        {activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="ventas-row-actions">
                      <button type="button" onClick={() => onEdit(p)} title="Editar producto">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        type="button"
                        className={activo ? "warning" : "success"}
                        onClick={() => onToggleActivo(p)}
                        title={activo ? "Dar de baja producto" : "Activar producto"}
                      >
                        <FontAwesomeIcon icon={faPowerOff} />
                      </button>
                      <button type="button" className="danger" onClick={() => onDelete(p)} title="Eliminar producto definitivamente">
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
