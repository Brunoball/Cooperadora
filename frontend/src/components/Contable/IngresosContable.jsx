// src/components/Contable/IngresosContable.jsx
import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";

const MESES = [
  { id:1, nombre:"ENERO" },{ id:2, nombre:"FEBRERO" },{ id:3, nombre:"MARZO" },
  { id:4, nombre:"ABRIL" },{ id:5, nombre:"MAYO" },{ id:6, nombre:"JUNIO" },
  { id:7, nombre:"JULIO" },{ id:8, nombre:"AGOSTO" },{ id:9, nombre:"SEPTIEMBRE" },
  { id:10, nombre:"OCTUBRE" },{ id:11, nombre:"NOVIEMBRE" },{ id:12, nombre:"DICIEMBRE" },
];

const hoy = new Date();
const Y = hoy.getFullYear();

export default function IngresosContable() {
  const [anioIng, setAnioIng] = useState(Y);
  const [mesIng, setMesIng] = useState(new Date().getMonth()+1);
  const [ingresos, setIngresos] = useState([]);
  const [detalle, setDetalle]   = useState({});
  const [loadingIng, setLoadingIng] = useState(false);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const loadIngresos = async () => {
    setLoadingIng(true);
    try {
      const base = `${BASE_URL}/api.php?action=contable_ingresos&year=${anioIng}`;
      const raw  = await fetchJSON(`${base}&detalle=1`);
      if (raw?.exito) {
        setIngresos(raw.resumen || []);
        setDetalle(raw.detalle || {});
      } else {
        setIngresos([]);
        setDetalle({});
      }
    } catch (e) {
      console.error(e);
      setIngresos([]); setDetalle({});
    } finally {
      setLoadingIng(false);
    }
  };

  useEffect(() => { loadIngresos(); }, [anioIng]);

  const monthKey = (y,m) => `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}`;
  const detalleMesSel = useMemo(
    () => detalle[monthKey(anioIng, mesIng)] || [],
    [detalle, anioIng, mesIng]
  );

  return (
    <div className="lc_panel">
      <div className="lc_filters">
        <label>Año:
          <input type="number" value={anioIng} onChange={(e)=>setAnioIng(Number(e.target.value)||Y)} />
        </label>
        <label>Mes:
          <select value={mesIng} onChange={(e)=>setMesIng(Number(e.target.value))}>
            {MESES.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <button className="lc_btn" onClick={loadIngresos} disabled={loadingIng}>
          <FontAwesomeIcon icon={faSearch}/> Actualizar
        </button>
      </div>

      <div className="lc_cards">
        <div className="lc_card">
          <h3><FontAwesomeIcon icon={faMoneyBillWave}/> Ingresos del mes</h3>
          <p className="lc_big">
            $
            {(ingresos.find(x => x.anio===anioIng && x.mes===mesIng)?.ingresos || 0)
              .toLocaleString('es-AR')}
          </p>
        </div>
        <div className="lc_card">
          <h3>Cobros (cant.)</h3>
          <p className="lc_big">
            {(ingresos.find(x => x.anio===anioIng && x.mes===mesIng)?.cantidad || 0)}
          </p>
        </div>
      </div>

      <div className="lc_grid2">
        <div className="lc_box">
          <h3>Por categoría</h3>
          <table className="lc_table">
            <thead>
              <tr><th>Categoría</th><th>Monto</th><th>Cant.</th></tr>
            </thead>
            <tbody>
              {(ingresos.find(x=>x.anio===anioIng && x.mes===mesIng)?.categorias || [])
                .map((c, i)=>(
                  <tr key={i}>
                    <td>{c.nombre || '-'}</td>
                    <td>${(c.monto||0).toLocaleString('es-AR')}</td>
                    <td>{c.cantidad||0}</td>
                  </tr>
              ))}
              {!(ingresos.find(x=>x.anio===anioIng && x.mes===mesIng)?.categorias || []).length && (
                <tr><td colSpan={3} className="lc_empty">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lc_box">
          <h3>Detalle del mes</h3>
          <table className="lc_table">
            <thead>
              <tr><th>Fecha</th><th>Alumno</th><th>Categoría</th><th>Monto</th><th>Mes pagado</th></tr>
            </thead>
            <tbody>
              {detalleMesSel.map((r, idx)=>(
                <tr key={idx}>
                  <td>{r.fecha_pago}</td>
                  <td>{r.Alumno}</td>
                  <td>{r.Categoria||'-'}</td>
                  <td>${(r.Monto||0).toLocaleString('es-AR')}</td>
                  <td>{r.Mes_pagado_id}</td>
                </tr>
              ))}
              {!detalleMesSel.length && <tr><td colSpan={5} className="lc_empty">Sin pagos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
