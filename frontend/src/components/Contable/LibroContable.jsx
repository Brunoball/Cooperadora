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
      {/* Header con título + tabs (y Volver en la misma hilera) */}
      <header className="lc_header gradient" role="banner">
        <div className="lc_header_left">
          {/* Tabs en el header + Volver adentro */}
          <nav
            className="lc_tabs lc_tabs--header"
            role="tablist"
            aria-label="Secciones contables"
          >
            {/* Volver dentro del mismo nav */}
            <button
              type="button"
              className="tab_btn tab_btn--ghost lc_backtab"
              onClick={onBack}
              title="Volver"
              aria-label="Volver"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Volver</span>
            </button>

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
          <div className="lc_title">
            <div className="lc_title_icon" aria-hidden>
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div className="lc_title_text">
              <h1 className="lc_heading">Contable</h1>
              <p className="lc_subtitle">Gestión de ingresos, egresos y resumen</p>
            </div>
          </div>
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
