import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faUpload, faTrash, faEye, faPlus, faMinus, faCompress } from "@fortawesome/free-solid-svg-icons";
import "./ContableEgresoModal.css";

const VALOR_OTRO = "__OTRO__";

export default function ContableEgresoModal({ open, onClose, onSaved, editRow, notify }) {
  const [fecha, setFecha] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // mediosPago: [{id, nombre}]
  const [mediosPago, setMediosPago] = useState([]);
  const [medioId, setMedioId] = useState("");
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [monto, setMonto] = useState("");
  const [comp, setComp] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");

  // Lightbox / visor
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.mensaje || `HTTP ${res.status}`);
    return data;
  };

  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      const arr = (data?.listas?.medios_pago ?? []).map((m) => ({
        id: Number(m.id),
        nombre: String(m.nombre || ""),
      }));
      setMediosPago(arr);
    } catch (e) {
      console.error("Error cargando medios de pago:", e);
      notify?.("error", "No se pudieron cargar los medios de pago.");
      setMediosPago([]);
    }
  };

  const crearMedioPago = async (nombre) => {
    const nombreOK = String(nombre || "").trim().toUpperCase();
    if (!nombreOK) throw new Error("INGRESÁ EL NUEVO MEDIO DE PAGO.");
    if (nombreOK.length > 100) throw new Error("EL MEDIO DE PAGO NO PUEDE SUPERAR 100 CARACTERES.");
    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    return r; // {exito:true, id, nombre}
  };

  useEffect(() => {
    if (!open) return;
    loadMediosPago();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setFecha(editRow.fecha || "");
      setCategoria(String(editRow.categoria || "").toUpperCase());
      setDescripcion(String(editRow.descripcion || "").toUpperCase());

      if (editRow.id_medio_pago) {
        setMedioId(String(editRow.id_medio_pago));
      } else if (editRow.medio_pago) {
        const buscado = String(editRow.medio_pago).trim().toUpperCase();
        const found = mediosPago.find(
          (m) => String(m.nombre).trim().toUpperCase() === buscado
        );
        setMedioId(found ? String(found.id) : "");
      } else {
        setMedioId("");
      }

      setMedioEsOtro(false);
      setMedioNuevo("");
      setMonto(String(editRow.monto || ""));
      setComp(editRow.comprobante_url || "");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    } else {
      const d = new Date();
      setFecha(d.toISOString().slice(0, 10));
      setCategoria("");
      setDescripcion("");
      setMedioId("");
      setMedioEsOtro(false);
      setMedioNuevo("");
      setMonto("");
      setComp("");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRow, mediosPago]);

  const uploadFile = async (file) => {
    const valid = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!valid.includes(file.type)) {
      notify?.("advertencia", "Formato no permitido. JPG/PNG/GIF/WEBP/PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify?.("advertencia", "El archivo supera 10MB.");
      return;
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setLocalPreview(e.target.result);
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

      if (!res.ok || !data.ok) throw new Error(data?.mensaje || "Error al subir el archivo");

      // Ideal: backend devuelve absolute_url; si no, armamos con BASE_URL
      const finalUrl = data.absolute_url ? data.absolute_url : `${BASE_URL}/${data.relative_url}`;
      setComp(finalUrl);
      notify?.("exito", "Comprobante subido.");
    } catch (err) {
      console.error(err);
      notify?.("error", "No se pudo subir el archivo.");
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

  const clearComprobante = () => {
    setComp("");
    setLocalPreview("");
    fileInputRef.current && (fileInputRef.current.value = "");
    setViewerOpen(false);
    setZoom(1);
    notify?.("advertencia", "Comprobante quitado.");
  };

  // Abre visor
  const openComprobante = () => {
    if (!comp && !localPreview) return;
    setViewerOpen(true);
    setZoom(1);
  };

  const onChangeMedio = (val) => {
    if (val === VALOR_OTRO) {
      setMedioEsOtro(true);
      setMedioId("");
    } else {
      setMedioEsOtro(false);
      setMedioId(val);
      setMedioNuevo("");
    }
  };

  /** Compara el estado actual con los datos originales del registro */
  const isSinCambios = () => {
    if (!editRow) return false;

    let origIdMedio = 0;
    if (editRow.id_medio_pago) {
      origIdMedio = Number(editRow.id_medio_pago);
    } else if (editRow.medio_pago) {
      const f = mediosPago.find(
        (m) => String(m.nombre).trim().toUpperCase() === String(editRow.medio_pago).trim().toUpperCase()
      );
      origIdMedio = f ? Number(f.id) : 0;
    }

    const norm = (s) => String(s || "").toUpperCase();
    const cur = {
      fecha,
      categoria: norm(categoria || "SIN CATEGORÍA"),
      descripcion: norm(descripcion),
      id_medio_pago: Number(medioId || 0),
      monto: Number(monto || 0),
      comprobante_url: comp || null,
    };

    const orig = {
      fecha: editRow.fecha || "",
      categoria: norm(editRow.categoria || "SIN CATEGORÍA"),
      descripcion: norm(editRow.descripcion || ""),
      id_medio_pago: origIdMedio,
      monto: Number(editRow.monto || 0),
      comprobante_url: editRow.comprobante_url || null,
    };

    return (
      cur.fecha === orig.fecha &&
      cur.categoria === orig.categoria &&
      cur.descripcion === orig.descripcion &&
      cur.id_medio_pago === orig.id_medio_pago &&
      cur.monto === orig.monto &&
      cur.comprobante_url === orig.comprobante_url
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      notify?.("advertencia", "Esperá a que termine la subida…");
      return;
    }

    // ===== Validación amigable del MEDIO DE PAGO =====
    if (!medioEsOtro && !String(medioId || "").trim()) {
      notify?.("advertencia", "Seleccioná el medio de pago.");
      return;
    }
    if (medioEsOtro && !String(medioNuevo || "").trim()) {
      notify?.("advertencia", "Escribí el nuevo medio de pago.");
      return;
    }

    try {
      setSaving(true);

      if (editRow && isSinCambios()) {
        notify?.("advertencia", "No se encontraron cambios para actualizar.");
        onSaved?.();
        return;
      }

      let idMedio = medioId;
      if (medioEsOtro) {
        const r = await crearMedioPago(medioNuevo);
        if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear el medio.");
        await loadMediosPago();
        idMedio = String(r.id);
        setMedioId(idMedio);
        setMedioEsOtro(false);
        setMedioNuevo("");
        notify?.("exito", `Medio de pago agregado: ${r.nombre}`);
      }

      const payload = {
        fecha,
        categoria: (categoria || "SIN CATEGORÍA").toUpperCase(),
        descripcion: String(descripcion || "").toUpperCase(),
        id_medio_pago: Number(idMedio || 0),
        monto: Number(monto || 0),
        comprobante_url: comp || null,
      };

      let url = `${BASE_URL}/api.php?action=contable_egresos&op=create`;
      if (editRow) {
        url = `${BASE_URL}/api.php?action=contable_egresos&op=update`;
        payload.id_egreso = editRow.id_egreso;
      }

      await fetchJSON(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      notify?.("exito", editRow ? "Egreso editado correctamente." : "Egreso creado correctamente.");
      onSaved?.();
    } catch (e2) {
      console.error(e2);
      const msg = String(e2?.message || "").toLowerCase();
      // Mapeo de mensaje técnico del backend -> toast amigable
      if (msg.includes("id_medio_pago o medio_pago requerido")) {
        notify?.("advertencia", "Seleccioná el medio de pago.");
      } else {
        notify?.("error", e2.message || "Error al guardar el egreso.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isPDF = (localPreview || comp)?.toLowerCase?.().endsWith(".pdf");

  return createPortal(
    <div className="lc_modal_overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lc_modal" style={{ textTransform: "none" }} onClick={(e) => e.stopPropagation()}>
        <div className="lc_modal_head">
          <h3>{editRow ? "Editar egreso" : "Nuevo egreso"}</h3>
          <button className="lc_icon" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="lc_modal_body">
          <div className="lc_row">
            <label>Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>

            <label>Medio
              <select
                value={medioEsOtro ? VALOR_OTRO : medioId}
                onChange={(e) => onChangeMedio(e.target.value)}
                required={!medioEsOtro}
                aria-invalid={!medioEsOtro && !String(medioId || "").trim() ? true : undefined}
              >
                <option value="">SELECCIONE…</option>
                {mediosPago.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
            </label>
          </div>

          {medioEsOtro && (
            <div className="lc_row">
              <label className="grow">INGRESE NUEVO MEDIO DE PAGO
                <input
                  value={medioNuevo}
                  onChange={(e) => setMedioNuevo(e.target.value.toUpperCase())}
                  placeholder="EJ.: VALE, CUPÓN, TRANSFERENCIA BANCARIA…"
                  required={medioEsOtro}
                />
              </label>
            </div>
          )}

          <div className="lc_row">
            <label className="grow">Categoría
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value.toUpperCase())}
                placeholder="SERVICIOS, INSUMOS, ETC."
              />
            </label>
            <label>Monto
              <input type="number" min="0" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </label>
          </div>

          <label>Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
              placeholder="DETALLE..."
            />
          </label>

          {/* Dropzone + preview */}
          <div className="dz_wrap">
            <div
              ref={dropRef}
              className="dz_area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("dz_over"); }}
              onDragLeave={() => dropRef.current?.classList.remove("dz_over")}
              onDrop={(e) => {
                e.preventDefault();
                dropRef.current?.classList.remove("dz_over");
                const f = e.dataTransfer.files?.[0];
                if (f) uploadFile(f);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
            >
              <div className="dz_icon"><FontAwesomeIcon icon={faUpload} /></div>
              <div className="dz_text">Arrastrá y soltá la imagen/PDF del comprobante acá<br/><span>o</span></div>
              <button
                type="button"
                className="lc_btn"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={uploading}
              >
                Elegir archivo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" hidden onChange={handleFileInput} />
            </div>

            {(localPreview || comp) && (
              <div className="dz_preview">
                {localPreview ? (
                  <img className="dz_thumb" src={localPreview} alt="Preview comprobante" />
                ) : isPDF ? (
                  <div className="dz_pdf"><span className="dz_pdf_label">PDF subido</span></div>
                ) : (
                  <img className="dz_thumb" src={comp} alt="Comprobante" />
                )}

                <div className="dz_meta">
                  <div className="dz_actions">
                    <button type="button" className="lc_btn secondary" onClick={openComprobante} disabled={!(localPreview || comp)} title="Ver comprobante">
                      <FontAwesomeIcon icon={faEye} /> Ver comprobante
                    </button>
                    <button type="button" className="lc_btn danger" onClick={clearComprobante}>
                      <FontAwesomeIcon icon={faTrash} /> Quitar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className="dz_hint">Permitidos: JPG, PNG, GIF, WEBP o PDF. Máx 10 MB. {uploading && <b> Subiendo...</b>}</p>
          </div>

          <div className="lc_modal_footer">
            <button type="button" className="lc_btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="lc_btn primary" disabled={saving || uploading}>
              <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>

      {/* ===== Visor / Lightbox ===== */}
      {viewerOpen && (
        <div
          className="lc_viewer_overlay"
          onClick={() => setViewerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="lc_viewer" onClick={(e) => e.stopPropagation()}>
            <div className="lc_viewer_toolbar">
              {!isPDF && (
                <>
                  <button className="lc_icon" onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.2).toFixed(2))))} title="Alejar">
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <span className="lc_zoom_label">{Math.round(zoom * 100)}%</span>
                  <button className="lc_icon" onClick={() => setZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))} title="Acercar">
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button className="lc_icon" onClick={() => setZoom(1)} title="Restaurar 100%">
                    <FontAwesomeIcon icon={faCompress} />
                  </button>
                </>
              )}
              {isPDF && (comp || localPreview) && (
                <button
                  className="lc_btn"
                  onClick={() => {
                    try { window.open(comp || localPreview, "_blank", "noopener,noreferrer"); }
                    catch { window.location.href = comp || localPreview; }
                  }}
                  title="Abrir en nueva pestaña"
                >
                  Abrir en pestaña
                </button>
              )}
              <button className="lc_icon" onClick={() => setViewerOpen(false)} title="Cerrar">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="lc_viewer_body">
              {!isPDF ? (
                <img
                  src={localPreview || comp}
                  alt="Comprobante"
                  className="lc_viewer_img"
                  style={{ transform: `scale(${zoom})` }}
                />
              ) : (
                <iframe
                  title="PDF comprobante"
                  className="lc_viewer_pdf"
                  src={comp || localPreview}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
