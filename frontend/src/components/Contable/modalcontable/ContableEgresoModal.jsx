// src/components/Contable/modalcontable/ContableEgresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faUpload, faTrash, faEye } from "@fortawesome/free-solid-svg-icons";
import "./ContableEgresoModal.css"; // ⬅️ IMPORTA EL CSS DEL MODAL

export default function ContableEgresoModal({ open, onClose, onSaved, editRow }) {
  const [fecha, setFecha] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [monto, setMonto] = useState("");
  const [comp, setComp] = useState(""); // URL final guardada en DB
  const [saving, setSaving] = useState(false);

  // Estados para upload
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(""); // preview de imagen (miniatura)
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setFecha(editRow.fecha || "");
      setCategoria(editRow.categoria || "");
      setDescripcion(editRow.descripcion || "");
      setMedio(editRow.medio_pago || "efectivo");
      setMonto(String(editRow.monto || ""));
      setComp(editRow.comprobante_url || "");
      setLocalPreview("");
    } else {
      const d = new Date();
      setFecha(d.toISOString().slice(0,10));
      setCategoria("");
      setDescripcion("");
      setMedio("efectivo");
      setMonto("");
      setComp("");
      setLocalPreview("");
    }
  }, [open, editRow]);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const uploadFile = async (file) => {
    const valid = ["image/jpeg","image/png","image/gif","image/webp","application/pdf"];
    if (!valid.includes(file.type)) {
      alert("Formato no permitido. Permitidos: JPG, PNG, GIF, WEBP, PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo supera 10MB.");
      return;
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setLocalPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setLocalPreview("");
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const url = `${BASE_URL}/api.php?action=contable_egresos_upload`;
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.mensaje || "Error al subir el archivo");
      }

      const finalUrl = `${BASE_URL}/${data.relative_url}`;
      setComp(finalUrl);
    } catch (err) {
      console.error(err);
      alert("No se pudo subir el archivo.");
      setLocalPreview("");
      setComp("");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  // Drag & Drop
  const onDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add("dz_over");
  };
  const onDragLeave = () => {
    dropRef.current?.classList.remove("dz_over");
  };
  const onDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove("dz_over");
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const clearComprobante = () => {
    setComp("");
    setLocalPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openComprobante = () => {
    if (!comp) return;
    try {
      window.open(comp, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = comp;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      alert("Esperá a que termine la subida del archivo…");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha,
        categoria: categoria || 'SIN CATEGORÍA',
        descripcion,
        medio_pago: medio,
        monto: Number(monto||0),
        comprobante_url: comp || null,
      };
      let url = `${BASE_URL}/api.php?action=contable_egresos&op=create`;
      if (editRow) {
        url = `${BASE_URL}/api.php?action=contable_egresos&op=update`;
        payload.id_egreso = editRow.id_egreso;
      }
      await fetchJSON(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      onSaved?.();
    } catch (e) {
      console.error(e);
      alert("Error al guardar el egreso");
    } finally {
      setSaving(false);
    }
  };

  // Si no está abierto, no renderizo nada
  if (!open) return null;

  // PORTAL: renderizar en <body> para que siempre flote centrado
  return createPortal(
    <div className="lc_modal_overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lc_modal" onClick={(e)=>e.stopPropagation()}>
        <div className="lc_modal_head">
          <h3>{editRow ? 'Editar egreso' : 'Nuevo egreso'}</h3>
          <button className="lc_icon" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes}/>
          </button>
        </div>

        <form onSubmit={onSubmit} className="lc_modal_body">
          <div className="lc_row">
            <label>Fecha
              <input type="date" value={fecha} onChange={(e)=>setFecha(e.target.value)} required/>
            </label>
            <label>Medio
              <select value={medio} onChange={(e)=>setMedio(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </label>
          </div>

          <div className="lc_row">
            <label className="grow">Categoría
              <input value={categoria} onChange={(e)=>setCategoria(e.target.value)} placeholder="Servicios, Insumos, etc."/>
            </label>
            <label>Monto
              <input type="number" min="0" step="1" value={monto} onChange={(e)=>setMonto(e.target.value)} required/>
            </label>
          </div>

          <label>Descripción
            <input value={descripcion} onChange={(e)=>setDescripcion(e.target.value)} placeholder="Detalle..."/>
          </label>

          {/* Dropzone + preview */}
          <div className="dz_wrap">
            <div
              ref={dropRef}
              className="dz_area"
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e)=>{ if(e.key === 'Enter') fileInputRef.current?.click(); }}
            >
              <div className="dz_icon"><FontAwesomeIcon icon={faUpload} /></div>
              <div className="dz_text">
                Arrastrá y soltá la imagen/PDF del comprobante acá<br/>
                <span>o</span>
              </div>
              <button
                type="button"
                className="lc_btn"
                onClick={()=>fileInputRef.current?.click()}
                disabled={uploading}
              >
                Elegir archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={handleFileInput}
              />
            </div>

            {(localPreview || comp) && (
              <div className="dz_preview">
                {localPreview ? (
                  <img className="dz_thumb" src={localPreview} alt="Preview comprobante" />
                ) : (
                  <>
                    {comp?.toLowerCase().endsWith('.pdf') ? (
                      <div className="dz_pdf">
                        <span className="dz_pdf_label">PDF subido</span>
                      </div>
                    ) : (
                      <img className="dz_thumb" src={comp} alt="Comprobante" />
                    )}
                  </>
                )}

                <div className="dz_meta">
                  <div className="dz_actions">
                    <button
                      type="button"
                      className="lc_btn secondary"
                      onClick={openComprobante}
                      disabled={!comp}
                      title="Ver comprobante en nueva pestaña"
                    >
                      <FontAwesomeIcon icon={faEye} /> Ver comprobante
                    </button>

                    <button type="button" className="lc_btn danger" onClick={clearComprobante}>
                      <FontAwesomeIcon icon={faTrash}/> Quitar
                    </button>
                  </div>

                  {comp && (
                    <a className="dz_link" href={comp} target="_blank" rel="noreferrer">
                      {comp}
                    </a>
                  )}
                </div>
              </div>
            )}

            <p className="dz_hint">
              Permitidos: JPG, PNG, GIF, WEBP o PDF. Máx 10 MB.
              {uploading && <b> Subiendo...</b>}
            </p>
          </div>

          <label>Comprobante (URL)
            <input
              value={comp}
              onChange={(e)=>setComp(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="lc_modal_footer">
            <button type="button" className="lc_btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lc_btn primary" disabled={saving || uploading}>
              <FontAwesomeIcon icon={faSave}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
