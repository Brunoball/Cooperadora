import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPrint } from "@fortawesome/free-solid-svg-icons";
import { asBool, money } from "../ventasConfig";

const obtenerCampaniaInicial = (campanias = []) => {
  const activa = campanias.find((c) => asBool(c.activo));
  return activa?.id_campania || campanias[0]?.id_campania || "";
};

const abrirEnNuevaPestana = (url) => {
  const nuevaVentana = window.open(url, "_blank", "noopener,noreferrer");
  if (nuevaVentana) nuevaVentana.opener = null;
};

const NUMERO_BOT_PLANILLAS = "3564 665050";

export default function PlanillasTab({ tableTabs, campanias = [], apiUrl }) {
  const [idCampania, setIdCampania] = useState(() => obtenerCampaniaInicial(campanias));
  const [soloActivos, setSoloActivos] = useState(true);

  useEffect(() => {
    if (!campanias.length) {
      setIdCampania("");
      return;
    }

    const existeSeleccion = campanias.some((c) => String(c.id_campania) === String(idCampania));
    if (!idCampania || !existeSeleccion) {
      setIdCampania(obtenerCampaniaInicial(campanias));
    }
  }, [campanias, idCampania]);

  const campaniaSeleccionada = useMemo(
    () => campanias.find((c) => String(c.id_campania) === String(idCampania)) || null,
    [campanias, idCampania]
  );

  const exportarPlanillas = () => {
    if (!idCampania || !apiUrl) return;

    const params = new URLSearchParams();
    params.set("action", "ventas_planillas_cursos");
    params.set("id_campania", idCampania);
    params.set("solo_activos", soloActivos ? "1" : "0");
    params.set("orientacion", "vertical");
    params.set("formato_hoja", "vertical");
    params.set("estilo", "calcado");
    params.set("numero_bot", NUMERO_BOT_PLANILLAS);

    abrirEnNuevaPestana(`${apiUrl}?${params.toString()}`);
  };

  const campaniaActiva = campaniaSeleccionada && asBool(campaniaSeleccionada.activo);

  return (
    <section className="ventas-card ventas-full-card ventas-planillas-card">
      <div className="ventas-planillas-nav">{tableTabs}</div>

      <div className="ventas-planillas-head">
        <div className="ventas-planillas-heading">
          <h2>Planillas para docentes</h2>
          <p>Exportá hojas por curso y división listas para imprimir y completar.</p>
        </div>

        <span className="ventas-planillas-format">
          <FontAwesomeIcon icon={faPrint} />
          A4 vertical
        </span>
      </div>

      <div className="ventas-planillas-layout">
        <div className="ventas-planillas-panel ventas-planillas-panel--main">
          <div className="ventas-planillas-intro">
            <div className="ventas-planillas-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faClipboardList} />
            </div>

            <div>
              <span className="ventas-planillas-eyebrow">Exportación masiva</span>
              <h3>Una hoja por curso y división</h3>
              <p>Incluye el listado de alumnos y espacios para registrar la venta manualmente.</p>
            </div>
          </div>

          <div className="ventas-planillas-columns" aria-label="Columnas de la planilla">
            <span>VEN</span>
            <span>GAN</span>
            <span>Cobrado</span>
            <span>Observaciones</span>
          </div>

          <p className="ventas-planillas-note">Preparada para entregar a cada docente responsable. Número bot: <strong>{NUMERO_BOT_PLANILLAS}</strong></p>
        </div>

        <div className="ventas-planillas-panel ventas-planillas-panel--controls">
          <label className="ventas-planillas-field">
            <span>Venta / campaña</span>
            <select value={idCampania || ""} onChange={(e) => setIdCampania(e.target.value)}>
              <option value="">Seleccionar venta</option>
              {campanias.map((c) => (
                <option key={c.id_campania} value={c.id_campania}>
                  {c.nombre}{asBool(c.activo) ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>

          {campaniaSeleccionada ? (
            <div className="ventas-planillas-resumen">
              <div className="ventas-planillas-resumen-head">
                <strong>{campaniaSeleccionada.nombre}</strong>
                <span className={campaniaActiva ? "is-active" : "is-inactive"}>
                  {campaniaActiva ? "Activa" : "Inactiva"}
                </span>
              </div>

              <div className="ventas-planillas-meta">
                <span>
                  <small>Producto</small>
                  {campaniaSeleccionada.producto_principal_nombre || "Sin producto"}
                </span>
                <span>
                  <small>Precio VEN</small>
                  {campaniaSeleccionada.producto_principal_precio ? money(campaniaSeleccionada.producto_principal_precio) : "Sin precio"}
                </span>
              </div>
            </div>
          ) : (
            <div className="ventas-planillas-resumen ventas-planillas-resumen--warning">
              <strong>No hay una venta seleccionada</strong>
              <p>Primero cargá una venta/campaña desde Configuración.</p>
            </div>
          )}

          <div className="ventas-planillas-actions">
            <label className="ventas-planillas-check">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              <span className="ventas-planillas-checkmark" aria-hidden="true" />
              <span className="ventas-planillas-check-label">
                <span className="ventas-planillas-check-full">Incluir solo alumnos activos</span>
                <span className="ventas-planillas-check-short">Solo activos</span>
              </span>
            </label>

            <button
              type="button"
              className="ventas-primary ventas-planillas-export"
              onClick={exportarPlanillas}
              disabled={!idCampania}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="ventas-planillas-export-full">Exportar planillas</span>
              <span className="ventas-planillas-export-short">Exportar</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
