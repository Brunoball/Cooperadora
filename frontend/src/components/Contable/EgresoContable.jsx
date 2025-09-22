// src/components/Contable/EgresoContable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus, faTrash, faEdit, faEye, faFileExcel,
  faSearch, faFilter, faChartPie,
} from "@fortawesome/free-solid-svg-icons";
import ContableEgresoModal from "./modalcontable/ContableEgresoModal";
import Toast from "../Global/Toast";
import "./EgresoContable.css";
import * as XLSX from "xlsx"; // ⬅️ Excel real (.xlsx)

const hoy = new Date();
const Y = hoy.getFullYear();
const MESES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
const cap1 = (s="") => s.charAt(0) + s.slice(1).toLowerCase();
function s(n){ return n===1 ? "" : "s"; }

/* ===========================================================
   ConfirmModal – misma estética que el modal de "Cerrar sesión"
   (usa clases: logout-modal-*)
   =========================================================== */
function ConfirmModal({
  open,
  title = "Eliminar egreso",
  message = "¿Seguro que querés eliminar este egreso? Esta acción no se puede deshacer.",
  onCancel,
  onConfirm,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="egdel-title"
      aria-describedby="egdel-desc"
      onMouseDown={onCancel} /* click fuera => cierra */
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onMouseDown={(e) => e.stopPropagation()} /* evita cierre al click interno */
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="egdel-title" className="logout-modal-title logout-modal-title--danger">
          {title}
        </h3>

        <p id="egdel-desc" className="logout-modal-text">
          {message}
        </p>

        <div className="logout-modal-buttons">
          <button
            type="button"
            className="logout-btn logout-btn--ghost"
            onClick={onCancel}
            ref={cancelBtnRef}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="logout-btn logout-btn--solid-danger"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EgresoContable(){
  const [egresos, setEgresos] = useState([]);
  const [loadingEgr, setLoadingEgr] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);

  const [anio, setAnio] = useState(Y);
  const [anios, setAnios] = useState([Y, Y - 1]); // fallback inicial
  const [month, setMonth] = useState(hoy.getMonth());
  const [fCat, setFCat] = useState("");
  const [fMedio, setFMedio] = useState("");
  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const addToast = (tipo, mensaje, duracion=3000) => {
    const id = `${Date.now()}_${toastSeq.current++}`;
    setToasts(prev=>[...prev, {id,tipo,mensaje,duracion}]);
  };
  const removeToast = (id)=> setToasts(prev=>prev.filter(t=>t.id!==id));

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.mensaje) msg = j.mensaje; } catch {}
      throw new Error(msg);
    }
    return res.json();
  };

  /* ==== Fechas (por año/mes seleccionados) ==== */
  const { fStart, fEnd } = useMemo(() => {
    const first = new Date(anio, month, 1);
    const last = new Date(anio, month + 1, 0);
    const toISO = (d) => d.toISOString().slice(0,10);
    return { fStart: toISO(first), fEnd: toISO(last) };
  }, [anio, month]);

  /* ==== Medios de pago ==== */
  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      setMediosPago(Array.isArray(data?.listas?.medios_pago) ? data.listas.medios_pago : []);
    } catch {
      addToast("error","No se pudieron cargar los medios de pago.");
      setMediosPago([]);
    }
  };

  /* ==== Egresos ==== */
  const loadEgresos = async () => {
    setLoadingEgr(true);
    try {
      const params = new URLSearchParams({ start:fStart, end:fEnd });
      if (fCat) params.set("categoria", fCat);
      if (fMedio) params.set("medio", fMedio);
      const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list&${params.toString()}`);
      const datos = raw?.datos || [];
      setEgresos(datos);

      // Derivar años si backend todavía no los expone
      if (!Array.isArray(anios) || !anios.length || anios.length <= 2) {
        const yearsFromData = Array.from(
          new Set(
            datos
              .map(e => (e?.fecha ? Number(String(e.fecha).slice(0,4)) : null))
              .filter(v => Number.isFinite(v))
          )
        ).sort((a,b)=>b-a);
        if (yearsFromData.length) {
          setAnios(yearsFromData);
          if (!yearsFromData.includes(anio)) {
            setAnio(yearsFromData[0]); // ajustar al más reciente
          }
        }
      }
    } catch {
      addToast("error","Error al cargar los egresos.");
      setEgresos([]);
    } finally { setLoadingEgr(false); }
  };

  /* ==== Años disponibles ==== */
  const loadAniosDisponibles = async () => {
    // 1) Endpoint dedicado
    try {
      const j1 = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list_years`);
      if (Array.isArray(j1?.anios_disponibles) && j1.anios_disponibles.length) {
        const list = [...j1.anios_disponibles].sort((a,b)=>b-a);
        setAnios(list);
        if (!list.includes(anio)) setAnio(list[0]);
        return;
      }
    } catch { /* sigue */ }

    // 2) meta=1 en list
    try {
      const j2 = await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=list&meta=1`);
      if (Array.isArray(j2?.anios_disponibles) && j2.anios_disponibles.length) {
        const list = [...j2.anios_disponibles].sort((a,b)=>b-a);
        setAnios(list);
        if (!list.includes(anio)) setAnio(list[0]);
        return;
      }
    } catch { /* sigue */ }

    // 3) Si no hay soporte en backend: queda el fallback y se derivan desde loadEgresos
  };

  useEffect(()=>{ loadMediosPago(); },[]);
  useEffect(()=>{ loadAniosDisponibles(); },[]);
  useEffect(()=>{ loadEgresos(); },[fStart,fEnd,fCat,fMedio]);

  /* ==== Derivados ==== */
  const totalEgresos = useMemo(()=> egresos.reduce((a,b)=> a + Number(b.monto||0),0),[egresos]);

  const egresosFiltrados = useMemo(()=>{
    const needle = q.trim().toLowerCase();
    if (!needle) return egresos;
    return egresos.filter(e=>{
      const src = [e.descripcion, e.categoria, e.numero_factura, e.medio_nombre || e.medio_pago, e.fecha]
        .join(" ").toLowerCase();
      return src.includes(needle);
    });
  },[egresos,q]);

  const catBreakdown = useMemo(()=>{
    const map = new Map();
    for (const e of egresos){
      const k = e.categoria || "SIN CATEGORÍA";
      const monto = Number(e.monto || 0);
      if (!map.has(k)) map.set(k, { label:k, total:0, count:0 });
      const obj = map.get(k);
      obj.total += monto; obj.count += 1;
    }
    return Array.from(map.values()).sort((a,b)=> b.total - a.total);
  },[egresos]);

  /* ==== Acciones fila ==== */
  const onCreateEgreso = ()=>{ setEditRow(null); setModalOpen(true); };
  const onEditEgreso = (row)=>{ setEditRow(row); setModalOpen(true); };

  const normalizeUrl = (url="")=>{
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const clean = String(url).replace(/^\/+/, "");
    return `${BASE_URL}/${clean}`;
  };
  const onViewComprobante = (row)=>{
    const candidate = row?.comprobante_url || row?.comprobante || row?.url || "";
    const finalUrl = normalizeUrl(candidate);
    if (!finalUrl){ addToast("advertencia","Este egreso no tiene comprobante adjunto."); return; }
    try { window.open(finalUrl,"_blank","noopener,noreferrer"); }
    catch { window.location.href = finalUrl; }
  };

  const askDeleteEgreso = (id)=>{ setToDeleteId(id); setConfirmOpen(true); };
  const cancelDelete = ()=>{ setConfirmOpen(false); setToDeleteId(null); };
  const confirmDelete = async ()=>{
    if (!toDeleteId) return;
    try{
      await fetchJSON(`${BASE_URL}/api.php?action=contable_egresos&op=delete`,{
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ id_egreso: toDeleteId }),
      });
      addToast("exito","Egreso eliminado correctamente.");
      loadEgresos();
    }catch{ addToast("error","No se pudo eliminar el egreso."); }
    finally{ cancelDelete(); }
  };

  const onSavedEgreso = ()=>{ setModalOpen(false); loadEgresos(); };

  /* ===== Exportar Excel real (.xlsx) ===== */
  const exportarXLSX = () => {
    const rows = egresosFiltrados;
    if (!rows.length) {
      addToast("advertencia","No hay datos para exportar.");
      return;
    }

    const headers = ["Fecha","Categoría","N° Factura","Descripción","Medio","Monto (ARS)"];
    const data = rows.map(e => ([
      e.fecha || "",
      e.categoria || "",
      e.numero_factura || "",
      e.descripcion || "",
      e.medio_nombre || e.medio_pago || "",
      Number(e.monto || 0)
    ]));

    const aoa = [headers, ...data];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Forzar números en la col 'Monto'
    const startRow = 2;
    const endRow = aoa.length;
    for (let r = startRow; r <= endRow; r++) {
      const addr = XLSX.utils.encode_cell({ r: r-1, c: 5 });
      if (ws[addr]) ws[addr].t = 'n';
    }
    ws["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 14 },
    ];
    const rangeMontos = XLSX.utils.decode_range(`F2:F${endRow}`);
    for (let R = rangeMontos.s.r; R <= rangeMontos.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: 5 });
      if (ws[cellRef]) ws[cellRef].z = '#,##0';
    }

    XLSX.utils.book_append_sheet(wb, ws, `Egresos_${cap1(MESES[month])}_${anio}`);

    const d = new Date();
    const name = `Egresos_${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}.xlsx`;
    XLSX.writeFile(wb, name);
    addToast("exito","Excel exportado.");
  };

  /* ===== (Opcional) Exportar CSV ===== */
  const exportarCSV = () => {
    const rows = egresosFiltrados;
    if (!rows.length) {
      addToast("advertencia","No hay datos para exportar.");
      return;
    }
    const headers = ["Fecha","Categoría","N° Factura","Descripción","Medio","Monto"];
    const sep = ";";
    const csvEscape = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const data = rows.map(e => [
      e.fecha || "",
      e.categoria || "",
      e.numero_factura || "",
      e.descripcion || "",
      e.medio_nombre || e.medio_pago || "",
      (Number(e.monto || 0)).toString().replace(".", ","),
    ]);
    const bom = "\uFEFF";
    const lines = [ headers.map(csvEscape).join(sep), ...data.map(r=> r.map(csvEscape).join(sep)) ];
    const csvStr = bom + lines.join("\r\n");
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8" });

    if (navigator.msSaveOrOpenBlob) {
      const d = new Date();
      const name = `Egresos_${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}.csv`;
      navigator.msSaveOrOpenBlob(blob, name);
      addToast("exito","Archivo exportado (CSV).");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `Egresos_${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
    addToast("exito","Archivo exportado (CSV).");
  };

  return (
    <div className="eg_layout">
      <div className="toast-stack">
        {toasts.map(t=>(
          <Toast key={t.id} tipo={t.tipo} mensaje={t.mensaje} duracion={t.duracion} onClose={()=>removeToast(t.id)} />
        ))}
      </div>

      <div className="eg_body">
        {/* Panel izquierdo */}
        <aside className="eg_filters cardd">
          <div className="textcenterfiltros">
            <h2 className="eg_filters__title">
              <FontAwesomeIcon icon={faFilter} />
              Filtros
            </h2>
            <h3>Detalle — {cap1(MESES[month])} {anio}</h3>
          </div>

          <div className="paddingcenter">
            <div className="eg_row">
              <div className="eg_field">
                <label>Año</label>
                <select
                  value={anio}
                  onChange={e=> setAnio(Number(e.target.value))}
                >
                  {anios.map(a=> <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="eg_field">
                <label>Mes</label>
                <select value={month} onChange={e=>setMonth(Number(e.target.value))}>
                  + {MESES.map((m,i)=> <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="eg_stats">
              <div className="eg_stat">
                <div className="eg_stat__icon">$</div>
                <div>
                  <p className="eg_stat__label">Total</p>
                  <p className="eg_stat__value">${totalEgresos.toLocaleString("es-AR")}</p>
                </div>
              </div>
            </div>

            <div className="eg_field" style={{ marginTop: 8 }}>
              <label>Medio de pago</label>
              <select value={fMedio} onChange={e=>setFMedio(e.target.value)}>
                <option value="">(todos)</option>
                {mediosPago.map(m=> <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            </div>

            <h3 className="eg_cats__header">
              <FontAwesomeIcon icon={faChartPie} />
              Categorías
            </h3>

            <div className="eg_cats">
              {catBreakdown.map(c=>{
                const active = fCat && fCat === c.label;
                return (
                  <button
                    key={c.label}
                    className={`eg_catcard ${active ? "active" : ""}`}
                    onClick={()=> setFCat(active ? "" : c.label)}
                    title={`${c.count} registro${s(c.count)}`}
                  >
                    <div className="eg_catcard__left">
                      <div className="eg_catcard__title">{(c.label || "").toUpperCase()}</div>
                      <div className="eg_catcard__count">{c.count} registro{s(c.count)}</div>
                    </div>
                    <div className="eg_catcard__value">
                      ${c.total.toLocaleString("es-AR")}
                    </div>
                  </button>
                );
              })}
              {!catBreakdown.length && <div className="eg_empty_side">Sin datos</div>}
            </div>

            {(fCat || fMedio) && (
              <button className="eg_btn eg_btn--ghost" onClick={()=>{ setFCat(""); setFMedio(""); }}>
                Limpiar filtros
              </button>
            )}
          </div>
        </aside>

        {/* Panel derecho */}
        <section className="eg_content cardd">
          <header className="eg_content__header">
            <button className="seg-tabbb">Egresos</button>

            <div className="eg_header_actions">
              <div className="eg_search eg_search--redpill">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  placeholder="Buscar..."
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  aria-label="Buscar egresos"
                />
              </div>

              <button type="button" className="eg_btn eg_btn--redpill" onClick={exportarXLSX}>
                <FontAwesomeIcon icon={faFileExcel} />
                Exportar Excel
              </button>

              {/* Si querés habilitar CSV, descomentá: */}
              {/* <button type="button" className="eg_btn eg_btn--ghost" onClick={exportarCSV}>
                Exportar CSV
              </button> */}

              <button type="button" className="eg_btn eg_btn--whitepill" onClick={onCreateEgreso}>
                <FontAwesomeIcon icon={faPlus} />
                Registrar egreso
              </button>
            </div>
          </header>

          <div className="ec_table__wrap">
            {loadingEgr && (
              <div className="ec_table_loader" role="status" aria-live="polite" aria-label="Cargando egresos">
                <div className="ec_spinner" />
                <span>Cargando…</span>
              </div>
            )}

            <div className="gt_table gt_cols-7" role="table" aria-label="Listado de egresos" aria-busy={loadingEgr ? "true" : "false"}>
              <div className="gt_headerd" role="row">
                <div className="gt_cell h center" role="columnheader">Fecha</div>
                <div className="gt_cell h center" role="columnheader">Categoría</div>
                <div className="gt_cell h center" role="columnheader">N° Factura</div>
                <div className="gt_cell h" role="columnheader">Descripción</div>
                <div className="gt_cell h center" role="columnheader">Medio</div>
                <div className="gt_cell h center" role="columnheader">Monto</div>
                <div className="gt_cell h center" role="columnheader">Acciones</div>
              </div>

              {egresosFiltrados.map(e=>{
                const hasFile = Boolean(normalizeUrl(e?.comprobante_url || e?.comprobante || e?.url));
                return (
                  <div className="gt_rowd" role="row" key={e.id_egreso}>
                    <div className="gt_cell center" role="cell">{e.fecha}</div>
                    <div className="gt_cell center" role="cell"><span className="badge">{e.categoria || "-"}</span></div>
                    <div className="gt_cell center" role="cell">{e.numero_factura || "-"}</div>
                    <div className="gt_cell truncate" role="cell" title={e.descripcion || "-"}>{e.descripcion || "-"}</div>
                    <div className="gt_cell center" role="cell">{e.medio_nombre || e.medio_pago || "-"}</div>
                    <div className="gt_cell center" role="cell">${Number(e.monto || 0).toLocaleString("es-AR")}</div>
                    <div className="gt_cell" role="cell">
                      <div className="row_actions">
                        <button className="icon_btn view" title="Ver comprobante" onClick={()=>onViewComprobante(e)} disabled={!hasFile}>
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                        <button className="icon_btn edit" title="Editar" onClick={()=>onEditEgreso(e)}>
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button className="icon_btn danger" title="Eliminar" onClick={()=>askDeleteEgreso(e.id_egreso)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!egresosFiltrados.length && (<div className="gt_empty">{loadingEgr ? "Cargando…" : "Sin egresos"}</div>)}
            </div>
          </div>
        </section>
      </div>

      <ContableEgresoModal
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        onSaved={onSavedEgreso}
        editRow={editRow}
        notify={addToast}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar egreso"
        message="¿Seguro que querés eliminar este egreso? Esta acción no se puede deshacer."
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
