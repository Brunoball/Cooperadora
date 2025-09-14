// src/components/Contable/ResumenContable.jsx
import React, { useEffect, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";

const hoy = new Date();
const Y = hoy.getFullYear();

export default function ResumenContable() {
  const [resumen, setResumen] = useState([]);
  const [anioRes, setAnioRes] = useState(Y);
  const [aniosCat, setAniosCat] = useState([]);   // años disponibles
  const [loadingRes, setLoadingRes] = useState(false);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // Cargar años de pagos desde contable_ingresos (igual que IngresosContable)
  const loadAniosDisponibles = async (prefer = anioRes) => {
    try {
      const raw = await fetchJSON(
        `${BASE_URL}/api.php?action=contable_ingresos&year=${prefer}&detalle=1`
      );
      const anios = Array.isArray(raw?.anios_disponibles) ? raw.anios_disponibles : [];
      setAniosCat(anios);

      // Si el año elegido no existe, selecciona el más reciente
      if (anios.length > 0 && !anios.includes(prefer)) {
        setAnioRes(anios[0]); // backend debería traerlos DESC
      }
    } catch (e) {
      console.error("Error cargando años disponibles:", e);
      setAniosCat([]);
    }
  };

  const loadResumen = async () => {
    setLoadingRes(true);
    try {
      const raw = await fetchJSON(
        `${BASE_URL}/api.php?action=contable_egresos&op=resumen&year=${anioRes}`
      );
      setResumen(raw?.resumen || []);
    } catch (e) {
      console.error(e);
      setResumen([]);
    } finally {
      setLoadingRes(false);
    }
  };

  // Al montar: carga catálogo de años (preferencia: actual)
  useEffect(() => { loadAniosDisponibles(Y); }, []);
  // Cada vez que cambia el año: trae resumen automáticamente
  useEffect(() => { loadResumen(); }, [anioRes]);

  return (
    <div className="lc_panel">
      <div className="lc_filters">
        <label>Año:&nbsp;
          <select
            value={anioRes}
            onChange={(e)=>setAnioRes(Number(e.target.value))}
            disabled={loadingRes && aniosCat.length === 0}
          >
            {aniosCat.length === 0
              ? <option value={anioRes}>{anioRes}</option>
              : aniosCat.map(a => <option key={a} value={a}>{a}</option>)
            }
          </select>
        </label>
      </div>

      <div className="lc_box">
        <h3><FontAwesomeIcon icon={faChartPie}/> Resumen anual</h3>
        <table className="lc_table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Ingresos</th>
              <th>Egresos</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map(r => (
              <tr key={`${r.anio}-${r.mes}`}>
                <td>{r.nombre_mes}</td>
                <td>${(r.ingresos || 0).toLocaleString("es-AR")}</td>
                <td>${(r.egresos || 0).toLocaleString("es-AR")}</td>
                <td className={r.saldo >= 0 ? "lc_pos" : "lc_neg"}>
                  ${(r.saldo || 0).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
            {!resumen.length && !loadingRes && (
              <tr>
                <td colSpan={4} className="lc_empty">Sin datos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
