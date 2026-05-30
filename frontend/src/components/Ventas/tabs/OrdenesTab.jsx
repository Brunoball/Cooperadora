import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faEdit, faEye, faPlus, faSearch, faTrash } from "@fortawesome/free-solid-svg-icons";
import { asBool, money, origenLabel } from "../ventasConfig";

function fechaSolo(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const fecha = raw.slice(0, 10);
  const partes = fecha.split("-");
  if (partes.length === 3 && partes[0]?.length === 4) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return fecha;
}

export default function OrdenesTab({
  tableTabs,
  ordenes,
  busqueda,
  setBusqueda,
  onBuscar,
  onAdd,
  onEdit,
  onOpenRetiro = () => {},
  onDelete = () => {},
  loading = false,
  campanias = [],
  campaniaSeleccionada = "",
  onCambiarCampania = () => {},
  filtroRetiro = "",
  onCambiarFiltroRetiro = () => {},
}) {
  return (
    <section className="ventas-card ventas-table-card ventas-full-card ventas-ordenes-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div className="ventas-card-tabs-slot">
          {tableTabs}
        </div>
        <div className="ventas-header-actions">
          <div className="ventas-orden-filters">
            <label className="ventas-filter-inline">
              <span>Venta</span>
              <select value={campaniaSeleccionada} onChange={(e) => onCambiarCampania(e.target.value)}>
                <option value="">Todas las ventas</option>
                {campanias.map((c) => (
                  <option key={c.id_campania} value={c.id_campania}>
                    {c.nombre}{!asBool(c.activo) ? " (inactiva)" : ""}
                  </option>
                ))}
              </select>
            </label>


            <label className="ventas-filter-inline ventas-filter-inlineretiro">
              <span>Retiro</span>
              <select value={filtroRetiro} onChange={(e) => onCambiarFiltroRetiro(e.target.value)}>
                <option value="">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="retirado">Retirados</option>
              </select>
            </label>

            <div className="ventas-search-box">
              <FontAwesomeIcon icon={faSearch} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onBuscar()}
                placeholder="Buscar venta"
              />
            </div>
            <button type="button" className="ventas-primary" onClick={onAdd}>
              <FontAwesomeIcon icon={faPlus} /> Nueva venta
            </button>
          </div>
        </div>
      </div>

      <div className="ventas-table-wrap ventas-table-wrap--center">
        <div className="ventas-div-table ventas-div-table--ordenes" role="table" aria-label="Ventas registradas">
          <div className="ventas-div-head" role="rowgroup">
            <div className="ventas-div-row ventas-div-row--head" role="row">
              <div className="ventas-div-cell" role="columnheader">Venta</div>
              <div className="ventas-div-cell" role="columnheader">Nombre informado</div>
              <div className="ventas-div-cell" role="columnheader">Medio</div>
              <div className="ventas-div-cell" role="columnheader">Total</div>
              <div className="ventas-div-cell" role="columnheader">Estado</div>
              <div className="ventas-div-cell" role="columnheader">Retiro</div>
              <div className="ventas-div-cell" role="columnheader">Origen</div>
              <div className="ventas-div-cell" role="columnheader">PDF</div>
              <div className="ventas-div-cell" role="columnheader">Fecha</div>
              <div className="ventas-div-cell ventas-div-cell--actions" role="columnheader">Acciones</div>
            </div>
          </div>

          <div className="ventas-div-body" role="rowgroup">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={`skeleton-orden-${i}`} className="ventas-div-row ventas-skeleton-row" role="row" aria-hidden="true">
                  {Array.from({ length: 10 }).map((__, j) => (
                    <div key={j} className="ventas-div-cell"><span className="ventas-skeleton-line" /></div>
                  ))}
                </div>
              ))
            ) : ordenes.length === 0 ? (
              <div className="ventas-empty-cell" role="row">Todavía no hay ventas aprobadas.</div>
            ) : (
              ordenes.map((o) => (
                <div key={o.id_orden} className="ventas-div-row" role="row">
                  <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                    <strong>{o.campania_nombre || "Sin venta"}</strong>
                    <span>{o.items_resumen || `${o.items_cantidad || 0} concepto(s)`}</span>
                  </div>

                  <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                    <strong>{o.persona_nombre || "Sin nombre"}</strong>
                  </div>

                  <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                    <strong>{o.medio_pago || "Sin medio"}</strong>
                  </div>

                  <div className="ventas-div-cell" role="cell">{money(o.total)}</div>

                  <div className="ventas-div-cell" role="cell">
                    <span className={`ventas-status ${o.estado === "aprobada" ? "ok" : "muted"}`}>
                      {o.estado}
                    </span>
                  </div>

                  <div className="ventas-div-cell ventas-div-cell--main ventas-retire-cell" role="cell">
                    <span className={`ventas-status ${asBool(o.retirado) ? "ok" : "pending"}`}>
                      {asBool(o.retirado) ? "Retirado" : "Pendiente"}
                    </span>
                  </div>

                  <div className="ventas-div-cell" role="cell">
                    <span className={`ventas-status ${o.origen === "manual" ? "manual" : "muted"}`}>
                      {origenLabel(o.origen)}
                    </span>
                  </div>

                  <div className="ventas-div-cell ventas-row-actions ventas-pdf-actions" role="cell">
                    {o.pdf_url ? (
                      <a href={o.pdf_url} target="_blank" rel="noreferrer" title="Ver PDF" aria-label="Ver PDF">
                        <FontAwesomeIcon icon={faEye} />
                      </a>
                    ) : (
                      <button type="button" disabled title="Sin PDF" aria-label="Sin PDF">
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                    )}
                  </div>

                  <div className="ventas-div-cell ventas-div-cell--main" role="cell">
                    <strong>{fechaSolo(o.aprobado_en || o.creado_en)}</strong>
                  </div>

                  <div className="ventas-div-cell ventas-row-actions" role="cell">
                    <button type="button" onClick={() => onOpenRetiro(o)} title="Cambiar estado de retiro" aria-label="Cambiar estado de retiro">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </button>
                    <button type="button" onClick={() => onEdit(o)} title="Editar venta registrada" aria-label="Editar venta registrada">
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button type="button" className="danger" onClick={() => onDelete(o)} title="Eliminar venta registrada" aria-label="Eliminar venta registrada">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <footer className="ventas-ordenes-footer" aria-label="Estado de ventas registradas">
        <span className="ventas-ordenes-footer__label">Estado</span>
        <span className="ventas-ordenes-footer__dot" aria-hidden="true" />
        <span className="ventas-ordenes-footer__value">Solo aprobadas</span>
      </footer>
    </section>
  );
}
