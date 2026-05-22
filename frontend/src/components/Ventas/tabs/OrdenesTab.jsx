import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPlus, faSearch } from "@fortawesome/free-solid-svg-icons";
import { estadosOrden, money, origenLabel, personaLabel } from "../ventasConfig";

export default function OrdenesTab({ ordenes, estado, setEstado, busqueda, setBusqueda, onBuscar, onAdd, onEdit }) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div>
          <h2>Ventas registradas</h2>
          <p>Acá aparecen las ventas del bot y también las ventas cargadas manualmente por pagos en efectivo u otros medios.</p>
        </div>
        <div className="ventas-header-actions">
          <button type="button" className="ventas-primary" onClick={onAdd}>
            <FontAwesomeIcon icon={faPlus} /> Agregar venta
          </button>
          <div className="ventas-orden-filters">
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {estadosOrden.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            <div className="ventas-search-box">
              <FontAwesomeIcon icon={faSearch} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onBuscar()}
                placeholder="Buscar nombre, código, pago o medio"
              />
              <button type="button" onClick={onBuscar}>Buscar</button>
            </div>
          </div>
        </div>
      </div>
      <div className="ventas-table-wrap ventas-table-wrap--center">
        <table className="ventas-table ventas-table--ordenes">
          <thead>
            <tr>
              <th>Código</th>
              <th>Venta</th>
              <th>Nombre informado</th>
              <th>Medio</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Origen</th>
              <th>PDF</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 ? (
              <tr>
                <td colSpan="10" className="ventas-empty-cell">Todavía no hay ventas registradas.</td>
              </tr>
            ) : (
              ordenes.map((o) => (
                <tr key={o.id_orden}>
                  <td>
                    <strong>{o.codigo_orden}</strong>
                    <span>{o.payment_id || (o.origen === "manual" ? "Carga manual" : "Sin payment_id")}</span>
                  </td>
                  <td>
                    <strong>{o.campania_nombre || "Sin venta"}</strong>
                    <span>{o.items_cantidad || 0} producto(s)</span>
                  </td>
                  <td>
                    <strong>{o.persona_nombre || "Sin nombre"}</strong>
                    <span>{o.persona_detalle || personaLabel(o.persona_tipo)}</span>
                  </td>
                  <td>
                    <strong>{o.medio_pago || "Sin medio"}</strong>
                    <span>{o.id_medio_pago ? `ID ${o.id_medio_pago}` : "No informado"}</span>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>
                    <span className={`ventas-status ${o.estado === "aprobada" ? "ok" : "muted"}`}>
                      {o.estado}
                    </span>
                  </td>
                  <td>
                    <span className={`ventas-status ${o.origen === "manual" ? "manual" : "muted"}`}>
                      {origenLabel(o.origen)}
                    </span>
                  </td>
                  <td>
                    {o.pdf_url ? <a href={o.pdf_url} target="_blank" rel="noreferrer">Abrir PDF</a> : "Sin PDF"}
                  </td>
                  <td>
                    <strong>{o.aprobado_en ? String(o.aprobado_en).slice(0, 16) : String(o.creado_en || "").slice(0, 16)}</strong>
                    <span>{o.actualizado_en ? `Actualizado ${String(o.actualizado_en).slice(0, 16)}` : ""}</span>
                  </td>
                  <td className="ventas-row-actions">
                    <button type="button" onClick={() => onEdit(o)} title="Editar venta registrada">
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
