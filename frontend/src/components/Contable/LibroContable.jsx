import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMoneyBillWave,
  faFileInvoiceDollar,
  faChartPie,
  faArrowLeft,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import IngresosContable from "./IngresosContable";
import EgresoContable from "./EgresoContable";
import ResumenContable from "./ResumenContable";
import "./Librocontable.css";

/**
 * Vista con tabs en el header (sin HUB de tarjetas).
 */
export default function LibroContable({ onBack }) {
  // Pestaña por defecto (sin HUB)
  const [tab, setTab] = useState("ingresos");

  return (
    <div className="lc_wrap">
      {/* Header con título + tabs a la izquierda y Volver a la derecha */}
      <header className="lc_header gradient">
        {/* IZQUIERDA: Tabs + Título */}
        <div className="lc_header_left">
          {/* Tabs en el header (muevas aquí) */}
          <nav
            className="lc_tabs lc_tabs--header"
            role="tablist"
            aria-label="Secciones contables"
          >
            <button
              role="tab"
              aria-selected={tab === "ingresos"}
              className={`tab_btn ${tab === "ingresos" ? "active" : ""}`}
              onClick={() => setTab("ingresos")}
              title="Ingresos"
            >
              <FontAwesomeIcon icon={faMoneyBillWave} />
              <span>Ingresos</span>
            </button>

            <button
              role="tab"
              aria-selected={tab === "egresos"}
              className={`tab_btn ${tab === "egresos" ? "active" : ""}`}
              onClick={() => setTab("egresos")}
              title="Egresos"
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
              <span>Egresos</span>
            </button>

            <button
              role="tab"
              aria-selected={tab === "resumen"}
              className={`tab_btn ${tab === "resumen" ? "active" : ""}`}
              onClick={() => setTab("resumen")}
              title="Resumen"
            >
              <FontAwesomeIcon icon={faChartPie} />
              <span>Resumen</span>
            </button>
          </nav>

          {/* Título */}

        </div>

        {/* DERECHA: Botón Volver */}
        <div className="lc_header_right">
          <button className="lc_back" onClick={onBack} aria-label="Volver">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Volver</span>
          </button>
        </div>
      </header>

      {/* Panel de contenido */}
      <section className="lc_panel card fade-in" role="tabpanel">
        {tab === "ingresos" && <IngresosContable />}
        {tab === "egresos" && <EgresoContable />}
        {tab === "resumen" && <ResumenContable />}
      </section>
    </div>
  );
}
