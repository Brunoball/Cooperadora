// src/components/Contable/ResumenContable.jsx
import React, { useEffect, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faChartPie } from "@fortawesome/free-solid-svg-icons";

const hoy = new Date();
const Y = hoy.getFullYear();

export default function ResumenContable() {
  const [resumen, setResumen] = useState([]);
  const [anioRes, setAnioRes] = useState(Y); // ← FIX
  const [loadingRes, setLoadingRes] = useState(false);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const loadResumen = async () => {
    setLoadingRes(true);
    try {
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=resumen&year=${anioRes}`);
      setResumen(raw?.resumen || []);
    } catch (e) {
      console.error(e);
      setResumen([]);
    } finally {
      setLoadingRes(false);
    }
  };

  useEffect(() => { loadResumen(); }, [anioRes]);

  return (
    <div className="lc_panel">
      <div className="lc_filters">
        <label>Año:
          <input type="number" value={anioRes} onChange={(e)=>setAnioRes(Number(e.target.value)||Y)} />
        </label>
        <button className="lc_btn" onClick={loadResumen} disabled={loadingRes}>
          <FontAwesomeIcon icon={faSearch}/> Actualizar
        </button>
      </div>

      <div className="lc_box">
        <h3><FontAwesomeIcon icon={faChartPie}/> Resumen anual</h3>
        <table className="lc_table">
          <thead>
            <tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr>
          </thead>
          <tbody>
            {resumen.map(r=>(
              <tr key={`${r.anio}-${r.mes}`}>
                <td>{r.nombre_mes}</td>
                <td>${(r.ingresos||0).toLocaleString('es-AR')}</td>
                <td>${(r.egresos||0).toLocaleString('es-AR')}</td>
                <td className={r.saldo>=0 ? 'lc_pos' : 'lc_neg'}>
                  ${(r.saldo||0).toLocaleString('es-AR')}
                </td>
              </tr>
            ))}
            {!resumen.length && <tr><td colSpan={4} className="lc_empty">Sin datos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
