// src/components/Contable/modalcontable/ContableEgresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes, faSave, faUpload, faTrash, faEye,
  faPlus, faMinus, faCompress, faFileInvoiceDollar,
  faCalendar, faCreditCard, faTags, faHashtag,
  faDollarSign, faPen
} from "@fortawesome/free-solid-svg-icons";
import "./ContableEgresoModal.css";

const VALOR_OTRO = "__OTRO__";

export default function ContableEgresoModal({
  open,
  onClose,
  onSaved,
  editRow,
  /** ⬇️ nuevo: función para toasts */
  notify,
}) {
  const [fecha, setFecha] = useState("");

  /** ====== CATEGORÍA (lista + OTRO) ====== */
  const [listaCategorias, setListaCategorias] = useState([]); // [{id, nombre}]
  const [categoriaId, setCategoriaId] = useState("");         // id seleccionado
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");   // texto si es OTRO

  /** ====== DESCRIPCIÓN (lista + OTRO) ====== */
  const [listaDescripciones, setListaDescripciones] = useState([]); // [{id, texto}]
  const [descripcionId, setDescripcionId] = useState("");
  const [descripcionEsOtra, setDescripcionEsOtra] = useState(false);
  const [descripcionNueva, setDescripcionNueva] = useState("");

  /** ====== MEDIO DE PAGO ====== */
  const [mediosPago, setMediosPago] = useState([]); // [{id, nombre}]
  const [medioId, setMedioId] = useState("");
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  /** ====== OTROS CAMPOS ====== */
  const [numeroFactura, setNumeroFactura] = useState("");
  const [monto, setMonto] = useState("");
  const [comp, setComp] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const dateInputRef = useRef(null);

  /** helper: evita crashear si no pasan notify */
  const safeNotify = (tipo, mensaje, duracion = 3000) => {
    try { typeof notify === "function" && notify(tipo, mensaje, duracion); }
    catch {}
  };

  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.mensaje || `HTTP ${res.status}`);
    return data;
  };

  /** =======================
   *  Cargar listas (API)
   *  ======================= */
  const loadListas = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      const mp = (data?.listas?.medios_pago ?? []).map(m => ({ id: Number(m.id), nombre: String(m.nombre || "") }));
      setMediosPago(mp);

      const cats = (data?.listas?.egreso_categorias ?? []).map(c => ({ id: Number(c.id), nombre: String(c.nombre || "") }));
      setListaCategorias(cats);

      const descs = (data?.listas?.egreso_descripciones ?? []).map(d => ({ id: Number(d.id), texto: String(d.texto || "") }));
      setListaDescripciones(descs);
    } catch (e) {
      console.error("Error cargando listas:", e);
      setMediosPago([]); setListaCategorias([]); setListaDescripciones([]);
    }
  };

  /** =======================
   *  Crear ítems al vuelo
   *  ======================= */
  const crearMedioPago = async (nombre) => {
    const nombreOK = String(nombre || "").trim().toUpperCase();
    if (!nombreOK) throw new Error("INGRESÁ EL NUEVO MEDIO DE PAGO.");
    if (nombreOK.length > 100) throw new Error("EL MEDIO DE PAGO NO PUEDE SUPERAR 100 CARACTERES.");
    return fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
  };

  const crearEgresoCategoria = async (nombre) => {
    const nombreOK = String(nombre || "").trim().toUpperCase();
    if (!nombreOK) throw new Error("INGRESÁ LA NUEVA CATEGORÍA.");
    if (nombreOK.length > 100) throw new Error("LA CATEGORÍA NO PUEDE SUPERAR 100 CARACTERES.");
    // usar los endpoints nuevos del backend
    return fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
  };

  const crearEgresoDescripcion = async (texto) => {
    const textoOK = String(texto || "").trim().toUpperCase();
    if (!textoOK) throw new Error("INGRESÁ LA NUEVA DESCRIPCIÓN.");
    if (textoOK.length > 150) throw new Error("LA DESCRIPCIÓN NO PUEDE SUPERAR 150 CARACTERES.");
    // usar los endpoints nuevos del backend
    return fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
  };

  /** =======================
   *  Efectos de apertura
   *  ======================= */
  useEffect(() => { if (open) loadListas(); }, [open]);

  useEffect(() => {
    if (!open) return;

    if (editRow) {
      // Fecha
      setFecha(editRow.fecha || "");

      // MEDIO DE PAGO
      if (editRow.id_medio_pago) {
        setMedioId(String(editRow.id_medio_pago));
        setMedioEsOtro(false);
        setMedioNuevo("");
      } else if (editRow.medio_pago) {
        const buscado = String(editRow.medio_pago).trim().toUpperCase();
        const found = mediosPago.find(m => String(m.nombre).trim().toUpperCase() === buscado);
        if (found) { setMedioId(String(found.id)); setMedioEsOtro(false); setMedioNuevo(""); }
        else { setMedioId(""); setMedioEsOtro(true); setMedioNuevo(buscado); }
      } else {
        setMedioId(""); setMedioEsOtro(false); setMedioNuevo("");
      }

      // CATEGORÍA (texto en base, intentar matchear con lista)
      const catTxt = String(editRow.categoria || "").trim().toUpperCase();
      if (catTxt) {
        const f = listaCategorias.find(c => String(c.nombre).trim().toUpperCase() === catTxt);
        if (f) { setCategoriaId(String(f.id)); setCategoriaEsOtra(false); setCategoriaNueva(""); }
        else { setCategoriaId(""); setCategoriaEsOtra(true); setCategoriaNueva(catTxt); }
      } else {
        setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva("");
      }

      // DESCRIPCIÓN (texto en base, intentar matchear con lista)
      const descTxt = String(editRow.descripcion || "").trim().toUpperCase();
      if (descTxt) {
        const f = listaDescripciones.find(d => String(d.texto).trim().toUpperCase() === descTxt);
        if (f) { setDescripcionId(String(f.id)); setDescripcionEsOtra(false); setDescripcionNueva(""); }
        else { setDescripcionId(""); setDescripcionEsOtra(true); setDescripcionNueva(descTxt); }
      } else {
        setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva("");
      }

      // Otros campos
      setNumeroFactura(String(editRow.numero_factura || "").toUpperCase());
      setMonto(String(editRow.monto || ""));
      setComp(editRow.comprobante_url || "");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    } else {
      const d = new Date();
      setFecha(d.toISOString().slice(0,10));

      setMedioId(""); setMedioEsOtro(false); setMedioNuevo("");
      setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva("");
      setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva("");

      setNumeroFactura("");
      setMonto("");
      setComp("");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRow, mediosPago, listaCategorias, listaDescripciones]);

  /** =======================
   *  Upload comprobante
   *  ======================= */
  const uploadFile = async (file) => {
    const valid = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!valid.includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;

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

      const finalUrl = data.absolute_url ? data.absolute_url : `${BASE_URL}/${data.relative_url}`;
      setComp(finalUrl);
    } catch (err) {
      console.error(err);
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
    setComp(""); setLocalPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setViewerOpen(false); setZoom(1);
  };

  /** =======================
   *  Handlers selects
   *  ======================= */
  const onChangeMedio = (val) => {
    if (val === VALOR_OTRO) { setMedioEsOtro(true); setMedioId(""); }
    else { setMedioEsOtro(false); setMedioId(val); setMedioNuevo(""); }
  };

  const onChangeCategoria = (val) => {
    if (val === VALOR_OTRO) { setCategoriaEsOtra(true); setCategoriaId(""); }
    else { setCategoriaEsOtra(false); setCategoriaId(val); setCategoriaNueva(""); }
  };

  const onChangeDescripcion = (val) => {
    if (val === VALOR_OTRO) { setDescripcionEsOtra(true); setDescripcionId(""); }
    else { setDescripcionEsOtra(false); setDescripcionId(val); setDescripcionNueva(""); }
  };

  /** =======================
   *  Comparar cambios
   *  ======================= */
  const isSinCambios = () => {
    if (!editRow) return false;

    // Medio original (id si lo tenemos, si no, matchear por nombre)
    let origIdMedio = 0;
    if (editRow.id_medio_pago) {
      origIdMedio = Number(editRow.id_medio_pago);
    } else if (editRow.medio_pago) {
      const f = mediosPago.find(m => String(m.nombre).trim().toUpperCase() === String(editRow.medio_pago).trim().toUpperCase());
      origIdMedio = f ? Number(f.id) : 0;
    }

    const norm = (s) => String(s || "").toUpperCase();

    // Resolver textos actuales de categoría y descripción según selección
    const categoriaTextoActual =
      categoriaEsOtra ? norm(categoriaNueva) :
      (listaCategorias.find(c => String(c.id) === String(categoriaId))?.nombre || "");

    const descripcionTextoActual =
      descripcionEsOtra ? norm(descripcionNueva) :
      (listaDescripciones.find(d => String(d.id) === String(descripcionId))?.texto || "");

    const cur = {
      fecha,
      categoria: norm(categoriaTextoActual || "SIN CATEGORÍA"),
      numero_factura: norm(numeroFactura || ""),
      descripcion: norm(descripcionTextoActual || ""),
      id_medio_pago: Number(medioId || 0),
      monto: Number(monto || 0),
      comprobante_url: comp || null,
    };

    const orig = {
      fecha: editRow.fecha || "",
      categoria: norm(editRow.categoria || "SIN CATEGORÍA"),
      numero_factura: norm(editRow.numero_factura || ""),
      descripcion: norm(editRow.descripcion || ""),
      id_medio_pago: origIdMedio,
      monto: Number(editRow.monto || 0),
      comprobante_url: editRow.comprobante_url || null,
    };

    return (
      cur.fecha === orig.fecha &&
      cur.categoria === orig.categoria &&
      cur.numero_factura === orig.numero_factura &&
      cur.descripcion === orig.descripcion &&
      cur.id_medio_pago === orig.id_medio_pago &&
      cur.monto === orig.monto &&
      cur.comprobante_url === orig.comprobante_url
    );
  };

  /** =======================
   *  Submit
   *  ======================= */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;

    // Validaciones mínimas (silenciosas, sin toast)
    if (!medioEsOtro && !String(medioId || "").trim()) return;
    if (medioEsOtro && !String(medioNuevo || "").trim()) return;
    if (numeroFactura && numeroFactura.length > 50) return;
    if (categoriaEsOtra && !String(categoriaNueva || "").trim()) return;
    if (descripcionEsOtra && !String(descripcionNueva || "").trim()) return;

    try {
      setSaving(true);
      if (editRow && isSinCambios()) {
        onSaved?.();
        return;
      }

      /** --- Medio de pago: crear si es OTRO --- */
      let idMedio = medioId;
      if (medioEsOtro) {
        const r = await crearMedioPago(medioNuevo);
        if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear el medio.");
        await loadListas();
        idMedio = String(r.id);
        setMedioId(idMedio);
        setMedioEsOtro(false);
        setMedioNuevo("");
      }

      /** --- Categoría: resolver texto y crear si es OTRO --- */
      let categoriaTexto = "";
      if (categoriaEsOtra) {
        const r = await crearEgresoCategoria(categoriaNueva);
        if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la categoría.");
        await loadListas();
        categoriaTexto = String(r.nombre || categoriaNueva).toUpperCase();
        // fijar selección a la creada
        const nueva = (await (async () => {
          const c = (await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`))?.listas?.egreso_categorias ?? [];
          return c.find(x => String(x.nombre).trim().toUpperCase() === categoriaTexto);
        })());
        if (nueva) { setCategoriaId(String(nueva.id)); setCategoriaEsOtra(false); setCategoriaNueva(""); }
      } else {
        categoriaTexto = String(
          listaCategorias.find(c => String(c.id) === String(categoriaId))?.nombre || ""
        ).toUpperCase();
      }
      if (!categoriaTexto) categoriaTexto = "SIN CATEGORÍA";

      /** --- Descripción: resolver texto y crear si es OTRO --- */
      let descripcionTexto = "";
      if (descripcionEsOtra) {
        const r = await crearEgresoDescripcion(descripcionNueva);
        if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la descripción.");
        await loadListas();
        descripcionTexto = String(r.texto || descripcionNueva).toUpperCase();
        // fijar selección a la creada
        const nueva = (await (async () => {
          const d = (await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`))?.listas?.egreso_descripciones ?? [];
          return d.find(x => String(x.texto).trim().toUpperCase() === descripcionTexto);
        })());
        if (nueva) { setDescripcionId(String(nueva.id)); setDescripcionEsOtra(false); setDescripcionNueva(""); }
      } else {
        descripcionTexto = String(
          listaDescripciones.find(d => String(d.id) === String(descripcionId))?.texto || ""
        ).toUpperCase();
      }

      /** --- Armar payload (texto para cat/desc; id para medio) --- */
      const payload = {
        fecha,
        categoria: categoriaTexto,
        numero_factura: (String(numeroFactura || "").toUpperCase()) || null,
        descripcion: descripcionTexto,
        id_medio_pago: Number(idMedio || 0),
        monto: Number(monto || 0),
        comprobante_url: comp || null,
      };

      let url = `${BASE_URL}/api.php?action=contable_egresos&op=create`;
      if (editRow) { url = `${BASE_URL}/api.php?action=contable_egresos&op=update`; payload.id_egreso = editRow.id_egreso; }

      await fetchJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      /** ⬇️ toasts de éxito según acción */
      if (editRow) {
        safeNotify("exito", "Egreso actualizado correctamente.");
      } else {
        safeNotify("exito", "Egreso agregado correctamente.");
      }

      onSaved?.();
    } catch (e2) {
      console.error(e2);
    } finally { setSaving(false); }
  };

  if (!open) return null;
  const isPDF = (localPreview || comp)?.toLowerCase?.().endsWith(".pdf");

  return createPortal(
    <div className="mm_overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mm_modal" onClick={(e) => e.stopPropagation()}>

        <header className="mm_head">
          <h3 className="mm_title">
            <FontAwesomeIcon className="mm_title_icon" icon={faFileInvoiceDollar} />
            {editRow ? "Editar egreso" : "Nuevo egreso"}
          </h3>
          <button className="mm_icon" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </header>

        {/* El footer queda dentro del <form> para usar onSubmit */}
        <form onSubmit={onSubmit} className="mm_body">

          {/* Row 1 */}
          <div className="mm_row">
            {/* Fecha */}
            <div
              className="mm_field has-icon"
              onMouseDown={(e) => {
                if (e.target !== dateInputRef.current) {
                  e.preventDefault();
                  const el = dateInputRef.current;
                  if (!el) return;
                  try {
                    el.focus();
                    if (typeof el.showPicker === "function") el.showPicker();
                    else el.click();
                  } catch { try { el.click(); } catch {} }
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && e.currentTarget === document.activeElement) {
                  e.preventDefault();
                  const el = dateInputRef.current;
                  if (!el) return;
                  try { el.focus(); el.showPicker?.(); } catch { try { el.click?.(); } catch {} }
                }
              }}
              tabIndex={0}
              role="group"
              aria-label="Campo de fecha"
            >
              <input
                ref={dateInputRef}
                className="date-no-native"
                type="date"
                value={fecha}
                onChange={(e)=>setFecha(e.target.value)}
                onClick={(e)=>{ try { e.currentTarget.showPicker?.(); } catch { e.currentTarget.click?.(); } }}
                required
              />
              <label>Fecha</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faCalendar} /></span>
            </div>

            {/* Medio */}
            <div className="mm_field always-float has-icon">
              <select
                value={medioEsOtro ? VALOR_OTRO : medioId}
                onChange={(e)=>onChangeMedio(e.target.value)}
                required={!medioEsOtro}
                aria-invalid={!medioEsOtro && !String(medioId || "").trim() ? true : undefined}
              >
                <option value="">SELECCIONE…</option>
                {mediosPago.map((m)=>(<option key={m.id} value={m.id}>{m.nombre}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
              <label>Medio</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faCreditCard} /></span>
            </div>
          </div>

          {medioEsOtro && (
            <div className="mm_row">
              <div className="mm_field grow has-icon">
                <input
                  value={medioNuevo}
                  onChange={(e)=>setMedioNuevo(e.target.value.toUpperCase())}
                  placeholder=" "
                  required
                />
                <label>Nuevo medio de pago</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faCreditCard} /></span>
              </div>
            </div>
          )}

          {/* Row 2 */}
          <div className="mm_row">
            {/* Categoría (select + OTRO) */}
            <div className="mm_field always-float has-icon">
              <select
                value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
                onChange={(e)=>onChangeCategoria(e.target.value)}
              >
                <option value="">(sin categoría)</option>
                {listaCategorias.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
              <label>Categoría</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
            </div>

            {/* N° factura */}
            <div className="mm_field has-icon">
              <input
                value={numeroFactura}
                onChange={(e)=>setNumeroFactura((e.target.value || "").toUpperCase())}
                placeholder=" "
                maxLength={50}
              />
              <label>N° factura</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faHashtag} /></span>
            </div>

            {/* Monto */}
            <div className="mm_field has-icon">
              <input
                type="number"
                min="0"
                step="1"
                value={monto}
                onChange={(e)=>setMonto(e.target.value)}
                placeholder=" "
                required
              />
              <label>Monto</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faDollarSign} /></span>
            </div>
          </div>

          {categoriaEsOtra && (
            <div className="mm_row">
              <div className="mm_field grow has-icon">
                <input
                  value={categoriaNueva}
                  onChange={(e)=>setCategoriaNueva(e.target.value.toUpperCase())}
                  placeholder=" "
                  required
                />
                <label>Nueva categoría</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
              </div>
            </div>
          )}

          {/* Row 3 */}
          <div className="mm_row">
            {/* Descripción (select + OTRO) */}
            <div className="mm_field always-float has-icon">
              <select
                value={descripcionEsOtra ? VALOR_OTRO : descripcionId}
                onChange={(e)=>onChangeDescripcion(e.target.value)}
              >
                <option value="">(sin descripción)</option>
                {listaDescripciones.map(d => (<option key={d.id} value={d.id}>{d.texto}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
              <label>Descripción</label>
              <span className="mm_iconField"><FontAwesomeIcon icon={faPen} /></span>
            </div>
          </div>

          {descripcionEsOtra && (
            <div className="mm_row">
              <div className="mm_field grow has-icon">
                <input
                  value={descripcionNueva}
                  onChange={(e)=>setDescripcionNueva(e.target.value.toUpperCase())}
                  placeholder=" "
                  required
                />
                <label>Nueva descripción</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faPen} /></span>
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div className="dz_wrap">
            <div
              ref={dropRef}
              className="dz_area mm_surface"
              onClick={()=>fileInputRef.current?.click()}
              onDragOver={(e)=>{ e.preventDefault(); dropRef.current?.classList.add("dz_over"); }}
              onDragLeave={()=>dropRef.current?.classList.remove("dz_over")}
              onDrop={(e)=>{ e.preventDefault(); dropRef.current?.classList.remove("dz_over"); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e)=>{ if (e.key === "Enter") fileInputRef.current?.click(); }}
            >
              <div className="dz_header">
                <div className="dz_icon dz_icon--lg"><FontAwesomeIcon icon={faUpload} /></div>
                <div className="dz_text">Arrastrá y soltá la imagen/PDF acá <span>o</span></div>
                <button
                  type="button"
                  className="mm_btn"
                  onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }}
                  disabled={uploading}
                >
                  Elegir archivo
                </button>
              </div>

              <p className="dz_hint">
                JPG, PNG, GIF, WEBP o PDF. Máx 10 MB.
                {uploading && <b> Subiendo…</b>}
              </p>

              {(comp || localPreview) && (
                <div className="dz_preview">
                  {comp && (
                    <div className="dz_file">
                      {(() => {
                        try {
                          const u = new URL(comp);
                          return decodeURIComponent(u.pathname.split("/").pop() || "archivo");
                        } catch {
                          return comp.split("/").pop() || "archivo";
                        }
                      })()}
                    </div>
                  )}

                  {!((localPreview || comp)?.toLowerCase?.().endsWith(".pdf")) ? (
                    <img
                      src={localPreview || comp}
                      alt="Vista previa del comprobante"
                      className="dz_thumb"
                    />
                  ) : (
                    <div className="dz_pdf">PDF listo para ver</div>
                  )}

                  <div className="dz_actions">
                    <button type="button" className="mm_btn" onClick={()=>{ if (comp || localPreview) { setViewerOpen(true); setZoom(1); } }}>
                      <FontAwesomeIcon icon={faEye} /> Ver
                    </button>
                    <button type="button" className="mm_btn danger" onClick={clearComprobante}>
                      <FontAwesomeIcon icon={faTrash} /> Quitar
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Footer dentro del form */}
          <div className="mm_footer">
            <button type="button" className="mm_btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mm_btn primary" disabled={saving || uploading}>
              <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>

        {/* Visor / Lightbox */}
        {viewerOpen && (
          <div className="viewer_overlay" onClick={()=>setViewerOpen(false)} role="dialog" aria-modal="true">
            <div className="viewer" onClick={(e)=>e.stopPropagation()}>
              <div className="viewer_toolbar">
                {!isPDF && (
                  <>
                    <button className="mm_icon" onClick={()=>setZoom(z=>Math.max(0.2, Number((z-0.2).toFixed(2))))} title="Alejar"><FontAwesomeIcon icon={faMinus} /></button>
                    <span className="zoom_label">{Math.round(zoom*100)}%</span>
                    <button className="mm_icon" onClick={()=>setZoom(z=>Math.min(5, Number((z+0.2).toFixed(2))))} title="Acercar"><FontAwesomeIcon icon={faPlus} /></button>
                    <button className="mm_icon" onClick={()=>setZoom(1)} title="Restaurar 100%"><FontAwesomeIcon icon={faCompress} /></button>
                  </>
                )}
                {isPDF && (comp || localPreview) && (
                  <button
                    className="mm_btn ghost"
                    onClick={()=>{ try{ window.open(comp || localPreview, "_blank","noopener,noreferrer"); } catch{ window.location.href = comp || localPreview; } }}
                  >
                    Abrir en pestaña
                  </button>
                )}
                <button className="mm_icon" onClick={()=>setViewerOpen(false)} title="Cerrar"><FontAwesomeIcon icon={faTimes} /></button>
              </div>
              <div className="viewer_body">
                {!isPDF ? (
                  <img src={localPreview || comp} alt="Comprobante" className="viewer_img" style={{ transform:`scale(${zoom})` }} />
                ) : (
                  <iframe title="PDF comprobante" className="viewer_pdf" src={comp || localPreview} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
