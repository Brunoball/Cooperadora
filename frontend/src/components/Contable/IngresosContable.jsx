import React, { useEffect, useMemo, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";

const hoy = new Date();
const Y = hoy.getFullYear();

export default function IngresosContable() {
  const [anioIng, setAnioIng] = useState(Y);
  const [mesIng, setMesIng] = useState(new Date().getMonth() + 1);

  const [ingresos, setIngresos] = useState([]);
  const [detalle, setDetalle]   = useState({});
  const [mesesCat, setMesesCat] = useState([]);      // [{id, nombre}] desde obtener_listas
  const [aniosCat, setAniosCat] = useState([]);      // [2025, 2024, ...]
  const [loadingIng, setLoadingIng] = useState(false);
  const [busqueda, setBusqueda] = useState("");      // filtro por apellido/nombre

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // Traer catálogo de meses desde obtener_listas (como pediste)
  const loadMeses = async () => {
    try {
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      if (raw?.exito) {
        const arr = Array.isArray(raw?.listas?.meses) ? raw.listas.meses : [];
        setMesesCat(arr.map(m => ({ id: Number(m.id), nombre: String(m.nombre) })));
      } else {
        setMesesCat([]);
      }
    } catch (e) {
      console.error("obtener_listas error:", e);
      setMesesCat([]);
    }
  };

  const loadIngresos = async () => {
    setLoadingIng(true);
    try {
      const base = `${BASE_URL}/api.php?action=contable_ingresos&year=${anioIng}`;
      const raw  = await fetchJSON(`${base}&detalle=1`);
      if (raw?.exito) {
        setIngresos(raw.resumen || []);
        setDetalle(raw.detalle || {});
        const anios = Array.isArray(raw.anios_disponibles) ? raw.anios_disponibles : [];
        setAniosCat(anios);

        // si el año seleccionado no existe y hay catálogo, seleccionamos el más reciente
        if (anios.length > 0 && !anios.includes(anioIng)) {
          setAnioIng(anios[0]); // más nuevo primero (ORDER BY DESC en el backend)
        }
      } else {
        setIngresos([]); setDetalle({}); setAniosCat([]);
      }
    } catch (e) {
      console.error("contable_ingresos error:", e);
      setIngresos([]); setDetalle({}); setAniosCat([]);
    } finally {
      setLoadingIng(false);
    }
  };

  // Cargar meses una vez y contable cada vez que cambia el año
  useEffect(() => { loadMeses(); }, []);
  useEffect(() => { loadIngresos(); }, [anioIng]);

  const monthKey = (y,m) => `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}`;
  const detalleMesSel = useMemo(
    () => detalle[monthKey(anioIng, mesIng)] || [],
    [detalle, anioIng, mesIng]
  );

  const mesesOptions = useMemo(() => {
    if (Array.isArray(mesesCat) && mesesCat.length > 0) {
      return mesesCat; // [{id, nombre}]
    }
    return Array.from({ length: 12 }, (_, i) => ({ id: i+1, nombre: `Mes ${i+1}` }));
  }, [mesesCat]);

  // helper para nombre del mes pagado
  const getNombreMesPagado = (row) => {
    const nombre = (row?.Mes_pagado || "").toString().trim();
    if (nombre) return nombre;
    const id = Number(row?.Mes_pagado_id || 0);
    const m  = mesesOptions.find(x => x.id === id);
    return m ? m.nombre : "-";
  };

  // filtro por texto en "Alumno"
  const detalleFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return detalleMesSel;
    return detalleMesSel.filter(r => (r.Alumno || "").toLowerCase().includes(q));
  }, [detalleMesSel, busqueda]);

  return (
    <div className="lc_panel">
      <div className="lc_filters">
        <label>Año:
          <select
            value={anioIng}
            onChange={(e)=>setAnioIng(Number(e.target.value))}
          >
            {aniosCat.length === 0
              ? <option value={anioIng}>{anioIng}</option>
              : aniosCat.map(a => <option key={a} value={a}>{a}</option>)
            }
          </select>
        </label>

        <label>Mes:
          <select value={mesIng} onChange={(e)=>setMesIng(Number(e.target.value))}>
            {mesesOptions.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>

        {/* Buscador en vivo en lugar de "Actualizar" */}
        <label style={{ marginLeft: 8, flex: 1 }}>
          Buscar alumno:
          <div className="lc_searchbox" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="text"
              placeholder="Apellido, nombre..."
              value={busqueda}
              onChange={(e)=>setBusqueda(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </label>
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
              {detalleFiltrado.map((r, idx)=>(
                <tr key={idx}>
                  <td>{r.fecha_pago}</td>
                  <td>{r.Alumno}</td>
                  <td>{r.Categoria||'-'}</td>
                  <td>${(r.Monto||0).toLocaleString('es-AR')}</td>
                  <td>{getNombreMesPagado(r)}</td>
                </tr>
              ))}
              {!detalleFiltrado.length && <tr><td colSpan={5} className="lc_empty">Sin pagos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
