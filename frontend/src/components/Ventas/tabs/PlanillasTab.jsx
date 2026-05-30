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

    abrirEnNuevaPestana(`${apiUrl}?${params.toString()}`);
  };

  return (
    <section className="ventas-card ventas-full-card ventas-planillas-card">
      <div className="ventas-card-head ventas-card-head--stack">
        <div>
          <h2>Planillas para docentes</h2>
          <p>
            Generá una exportación masiva para imprimir en hoja A4 vertical: una hoja por cada año y división, con el listado de alumnos y
            columnas vacías para VEN, GAN, cobrado y observaciones.
          </p>
        </div>
        {tableTabs}
      </div>

      <div className="ventas-planillas-layout">
        <div className="ventas-planillas-panel ventas-planillas-panel--main">
          <div className="ventas-planillas-icon">
            <FontAwesomeIcon icon={faClipboardList} />
          </div>
          <div>
            <span className="ventas-kicker">Exportación masiva</span>
            <h3>Una planilla vertical por curso y división</h3>
            <p>
              Esta vista no carga ventas ni importa datos. Es solamente para imprimir hojas, entregarlas a cada docente
              responsable y que después Carina cargue manualmente lo vendido.
            </p>
          </div>
        </div>

        <div className="ventas-planillas-panel">
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
              <strong>{campaniaSeleccionada.nombre}</strong>
              <span>
                Producto principal: {campaniaSeleccionada.producto_principal_nombre || "sin producto seleccionado"}
              </span>
              <span>
                Precio VEN: {campaniaSeleccionada.producto_principal_precio ? money(campaniaSeleccionada.producto_principal_precio) : "sin precio"}
              </span>
              <span>
                Estado: {asBool(campaniaSeleccionada.activo) ? "activa" : "inactiva"}
              </span>
            </div>
          ) : (
            <div className="ventas-planillas-resumen ventas-planillas-resumen--warning">
              <strong>No hay una venta seleccionada</strong>
              <span>Primero cargá una venta/campaña desde la pestaña Configuración.</span>
            </div>
          )}

          <label className="ventas-planillas-check">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            <span>Incluir solo alumnos activos</span>
          </label>

          <button
            type="button"
            className="ventas-primary ventas-planillas-export"
            onClick={exportarPlanillas}
            disabled={!idCampania}
          >
            <FontAwesomeIcon icon={faPrint} /> Exportar planillas verticales
          </button>
        </div>
      </div>

    </section>
  );
}
