import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPowerOff, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { asBool, money } from "../ventasConfig";

export default function ProductosTab({ tableTabs, productos, onAdd, onEdit, onDelete, onToggleActivo, loading = false }) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div className="ventas-card-tabs-slot">
          {tableTabs}
        </div>
        <button type="button" className="ventas-primary" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} /> Agregar producto
        </button>
      </div>

      <div className="ventas-table-wrap ventas-table-wrap--center">
        <div className="ventas-div-table ventas-div-table--productos" role="table" aria-label="Catálogo de productos">
          <div className="ventas-div-head" role="rowgroup">
            <div className="ventas-div-row ventas-div-row--head" role="row">
              <div className="ventas-div-cell" role="columnheader">Producto</div>
              <div className="ventas-div-cell" role="columnheader">Usado en ventas</div>
              <div className="ventas-div-cell" role="columnheader">Precio</div>
              <div className="ventas-div-cell" role="columnheader">Stock</div>
              <div className="ventas-div-cell" role="columnheader">Estado</div>
              <div className="ventas-div-cell ventas-div-cell--actions" role="columnheader">Acciones</div>
            </div>
          </div>

          <div className="ventas-div-body" role="rowgroup">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-producto-${i}`} className="ventas-div-row ventas-skeleton-row" role="row" aria-hidden="true">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="ventas-div-cell"><span className="ventas-skeleton-line" /></div>
                  ))}
                </div>
              ))
            ) : productos.length === 0 ? (
              <div className="ventas-empty-cell" role="row">Sin productos.</div>
            ) : (
              productos.map((p) => {
                const activo = asBool(p.activo);
                return (
                  <div key={p.id_producto} className={`ventas-div-row ${!activo ? "ventas-row-muted" : ""}`} role="row">
                    <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                      <strong>{p.nombre}</strong>
                      <span>{p.descripcion || "Sin descripción."}</span>
                    </div>
                    <div className="ventas-div-cell" role="cell">{p.campanias_asociadas || "Sin asignar"}</div>
                    <div className="ventas-div-cell" role="cell">{money(p.precio)}</div>
                    <div className="ventas-div-cell" role="cell">{p.stock === null || p.stock === undefined || p.stock === "" ? "Sin límite" : p.stock}</div>
                    <div className="ventas-div-cell" role="cell">
                      <span className={`ventas-status ${activo ? "ok" : "muted"}`}>
                        {activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="ventas-div-cell ventas-row-actions" role="cell">
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
