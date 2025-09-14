// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faEdit, faFilter } from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal"; // ← sin extensión
import "./EgresoContable.css";

const hoy = new Date();
const Y = hoy.getFullYear();

export default function EgresoContable() {
  const [egresos, setEgresos] = useState([]);
  const [loadingEgr, setLoadingEgr] = useState(false);
  const [fStart, setFStart] = useState(`${Y}-01-01`);
  const [fEnd, setFEnd]     = useState(`${Y}-12-31`);
  const [fCat, setFCat]     = useState("");
  const [fMedio, setFMedio] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const loadEgresos = async () => {
    setLoadingEgr(true);
    try {
      const params = new URLSearchParams({ start: fStart, end: fEnd });
      if (fCat)   params.set("categoria", fCat);
      if (fMedio) params.set("medio", fMedio);
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list&${params.toString()}`);
      setEgresos(raw?.datos || []);
    } catch (e) {
      console.error(e);
      setEgresos([]);
    } finally {
      setLoadingEgr(false);
    }
  };

  useEffect(() => { loadEgresos(); }, [fStart, fEnd, fCat, fMedio]);

  const totalEgresos = useMemo(() => egresos.reduce((a,b)=>a+Number(b.monto||0),0), [egresos]);

  const onCreateEgreso = () => { setEditRow(null); setModalOpen(true); };
  const onEditEgreso   = (row) => { setEditRow(row); setModalOpen(true); };
  const onDeleteEgreso = async (id) => {
    if (!window.confirm("¿Eliminar egreso?")) return;
    try {
      await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=delete`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id_egreso: id })
      });
      loadEgresos();
    } catch(e){ console.error(e); }
  };
  const onSavedEgreso  = () => { setModalOpen(false); loadEgresos(); };

  return (
    <div className="lc_panel">
      <div className="lc_filters">
        <label>Desde: <input type="date" value={fStart} onChange={(e)=>setFStart(e.target.value)} /></label>
        <label>Hasta: <input type="date" value={fEnd} onChange={(e)=>setFEnd(e.target.value)} /></label>
        <label>Categoría: <input value={fCat} onChange={(e)=>setFCat(e.target.value)} placeholder="(todas)"/></label>
        <label>Medio:
          <select value={fMedio} onChange={(e)=>setFMedio(e.target.value)}>
            <option value="">(todos)</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <button className="lc_btn" onClick={loadEgresos} disabled={loadingEgr}>
          <FontAwesomeIcon icon={faFilter}/> Filtrar
        </button>

        <div className="lc_spacer" />
        <button className="lc_btn primary" onClick={onCreateEgreso}>
          <FontAwesomeIcon icon={faPlus}/> Nuevo egreso
        </button>
      </div>

      <div className="lc_cards">
        <div className="lc_card">
          <h3>Total egresos</h3>
          <p className="lc_big">${totalEgresos.toLocaleString('es-AR')}</p>
        </div>
      </div>

      <div className="lc_box">
        <table className="lc_table">
          <thead>
            <tr>
              <th>Fecha</th><th>Categoría</th><th>Descripción</th>
              <th>Medio</th><th>Monto</th><th style={{width:120}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {egresos.map((e)=>(
              <tr key={e.id_egreso}>
                <td>{e.fecha}</td>
                <td>{e.categoria}</td>
                <td>{e.descripcion||'-'}</td>
                <td>{e.medio_pago}</td>
                <td>${Number(e.monto||0).toLocaleString('es-AR')}</td>
                <td className="lc_actions">
                  <button className="lc_icon" onClick={()=>onEditEgreso(e)} title="Editar">
                    <FontAwesomeIcon icon={faEdit}/>
                  </button>
                  <button className="lc_icon danger" onClick={()=>onDeleteEgreso(e.id_egreso)} title="Eliminar">
                    <FontAwesomeIcon icon={faTrash}/>
                  </button>
                </td>
              </tr>
            ))}
            {!egresos.length && <tr><td colSpan={6} className="lc_empty">Sin egresos</td></tr>}
          </tbody>
        </table>
      </div>

      <ContableEgresoModal
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        onSaved={onSavedEgreso}
        editRow={editRow}
      />
    </div>
  );
}
