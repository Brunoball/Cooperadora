// src/components/Contable/LibroContable.jsx
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoneyBillWave, faFileInvoiceDollar, faChartPie, faArrowLeft, faWallet } from "@fortawesome/free-solid-svg-icons";
import IngresosContable from "./IngresosContable";
import EgresoContable from "./EgresoContable";
import ResumenContable from "./ResumenContable";
import "./Librocontable.css";

export default function LibroContable({ onBack }) {
  const [tab, setTab] = useState("ingresos"); // ingresos | egresos | resumen

  return (
    <div className="lc_wrap">
      {/* Cabecera */}
      <div className="lc_header">
        <button className="lc_back" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft}/> Volver
        </button>
        <h1><FontAwesomeIcon icon={faWallet}/> Libro Contable</h1>
      </div>

      {/* Tabs */}
      <div className="lc_tabs">
        <button className={tab==='ingresos'?'active':''} onClick={()=>setTab('ingresos')}>
          <FontAwesomeIcon icon={faMoneyBillWave}/> Ingresos
        </button>
        <button className={tab==='egresos'?'active':''} onClick={()=>setTab('egresos')}>
          <FontAwesomeIcon icon={faFileInvoiceDollar}/> Egresos
        </button>
        <button className={tab==='resumen'?'active':''} onClick={()=>setTab('resumen')}>
          <FontAwesomeIcon icon={faChartPie}/> Resumen
        </button>
      </div>

      {/* Contenido */}
      {tab==='ingresos' && <IngresosContable />}
      {tab==='egresos' && <EgresoContable />}
      {tab==='resumen' && <ResumenContable />}
    </div>
  );
}
