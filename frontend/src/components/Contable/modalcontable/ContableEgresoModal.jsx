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
import Toast from "../../Global/Toast";
import "./ContableEgresoModal.css";

const VALOR_OTRO = "__OTRO__";
const MAX_IMPORTE_SOSPECHOSO = 50_000_000;

// Helpers de saneo
const toUpper = (v = "") => String(v).toUpperCase();
// Solo letras (mantiene acentos/ñ) + espacios
const onlyLetters = (v = "") => toUpper(v).replace(/[^\p{L}\s]/gu, "");
// Letras (incl. tildes) + dígitos + espacios  ✅ NUEVO para PROVEEDOR
const onlyLettersDigits = (v = "") => toUpper(v).replace(/[^\p{L}\p{N}\s]/gu, "");
// Solo dígitos
const onlyDigits = (v = "") => String(v).replace(/\D/g, "");

export default function ContableEgresoModal({
  open,
  onClose,
  onSaved,
  editRow,
  notify, // opcional: notify(tipo, mensaje, durMs)
}) {
  const [fecha, setFecha] = useState("");

  // === Listas ===
  const [listaCategorias, setListaCategorias] = useState([]);
  const [listaDescripciones, setListaDescripciones] = useState([]);
  const [listaProveedores, setListaProveedores] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  // === Selecciones ===
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");

  const [descripcionId, setDescripcionId] = useState("");
  const [descripcionEsOtra, setDescripcionEsOtra] = useState(false);
  const [descripcionNueva, setDescripcionNueva] = useState("");

  const [proveedorId, setProveedorId] = useState("");
  const [proveedorEsOtro, setProveedorEsOtro] = useState(false);
  const [proveedorNuevo, setProveedorNuevo] = useState("");

  const [medioId, setMedioId] = useState("");
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  // === Otros ===
  const [comprobante, setComprobante] = useState("");
  const [importe, setImporte] = useState("");
  const [compURL, setCompURL] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const dateInputRef = useRef(null);

  // ====== HOST LOCAL DE TOASTS ======
  const [toasts, setToasts] = useState([]);
  const recentToastMapRef = useRef(new Map());

  useEffect(() => {
    if (!open) {
      setToasts([]);
      recentToastMapRef.current.clear();
    } else {
      setToasts([]);
      recentToastMapRef.current.clear();
    }
  }, [open]);

  const pushToast = (tipo, mensaje, dur = 3000) => {
    const key = `${tipo}|${mensaje}`;
    const now = Date.now();
    const last = recentToastMapRef.current.get(key);
    if (last && now - last < 4000) return;
    recentToastMapRef.current.set(key, now);

    const id = `${now}-${Math.random().toString(36).slice(2)}`;
    setToasts(t => [...t, { id, tipo, mensaje, dur }]);

    setTimeout(() => {
      recentToastMapRef.current.delete(key);
    }, Math.max(0, dur + 500));
  };

  const closeToast = (id) => setToasts(t => t.filter(x => x.id !== id));

  const safeNotify = (tipo, mensaje, dur = 3000) => {
    pushToast(tipo, mensaje, dur);
    try { typeof notify === "function" && notify(tipo, mensaje, dur); } catch {}
  };

  // ===== infra fetch =====
  const fetchJSON = async (url, options) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.exito === false || data?.ok === false) {
      const msg = data?.mensaje || `Error del servidor (HTTP ${res.status}).`;
      throw new Error(msg);
    }
    return data;
  };

  // ===== Cargar listas =====
  const loadListas = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);

      const mp = (data?.listas?.medios_pago ?? []).map(m => ({
        id: Number(m.id),
        nombre: String(m.nombre || m.medio_pago || "")
      }));
      setMediosPago(mp);

      const cats = (data?.listas?.egreso_categorias ?? data?.listas?.contable_categorias ?? []).map(c => ({
        id: Number(c.id),
        nombre: String(c.nombre || c.nombre_categoria || "")
      }));
      setListaCategorias(cats);

      const descs = (data?.listas?.egreso_descripciones ?? data?.listas?.contable_descripciones ?? []).map(d => ({
        id: Number(d.id),
        texto: String(d.texto || d.nombre || d.nombre_descripcion || "")
      }));
      setListaDescripciones(descs);

      const provs = (data?.listas?.contable_proveedores ?? data?.listas?.proveedores ?? data?.listas?.egreso_proveedores ?? []).map(p => ({
        id: Number(p.id),
        nombre: String(p.nombre || p.nombre_proveedor || "")
      }));
      setListaProveedores(provs);
    } catch {
      setMediosPago([]); setListaCategorias([]); setListaDescripciones([]); setListaProveedores([]);
      safeNotify("error", "No se pudieron cargar las listas. Reintentá más tarde.");
    }
  };

  // ===== Crear al vuelo =====
  const crearMedioPago = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo medio de pago (solo letras).");
    if (nombreOK.length > 100) throw new Error("El medio de pago no puede superar los 100 caracteres.");
    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    return r;
  };

  const crearEgresoCategoria = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá la nueva categoría (solo letras).");
    if (nombreOK.length > 100) throw new Error("La categoría no puede superar los 100 caracteres.");
    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    return r;
  };

  const crearEgresoDescripcion = async (texto) => {
    const textoOK = onlyLetters(texto).trim();
    if (!textoOK) throw new Error("Ingresá la nueva descripción (solo letras).");
    if (textoOK.length > 150) throw new Error("La descripción no puede superar los 150 caracteres.");
    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
    return r;
  };

  // ✅ ACEPTA LETRAS Y NÚMEROS
  const crearProveedor = async (nombre) => {
    const nombreOK = onlyLettersDigits(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo proveedor (letras y números).");
    if (nombreOK.length > 120) throw new Error("El proveedor no puede superar los 120 caracteres.");
    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_proveedor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    return r;
  };

  useEffect(() => { if (open) loadListas(); }, [open]);

  const findIdByName = (list, nameKey, value) => {
    const needle = toUpper(value).trim();
    if (!needle) return null;
    const item = list.find(x => toUpper(x[nameKey]).trim() === needle);
    return item ? String(item.id) : null;
  };

  // Prefill
  useEffect(() => {
    if (!open) return;

    if (editRow) {
      setFecha(editRow.fecha || "");

      if (editRow.id_medio_pago) {
        setMedioId(String(editRow.id_medio_pago));
        setMedioEsOtro(false); setMedioNuevo("");
      } else {
        const medioNombre = editRow.medio_pago || editRow.medio_nombre || "";
        const id = findIdByName(mediosPago, "nombre", medioNombre);
        if (id) { setMedioId(id); setMedioEsOtro(false); setMedioNuevo(""); }
        else if (medioNombre) { setMedioId(""); setMedioEsOtro(true); setMedioNuevo(toUpper(medioNombre)); }
        else { setMedioId(""); setMedioEsOtro(false); setMedioNuevo(""); }
      }

      if (editRow.id_cont_categoria) {
        setCategoriaId(String(editRow.id_cont_categoria));
        setCategoriaEsOtra(false); setCategoriaNueva("");
      } else {
        const catNombre = editRow.categoria || editRow.nombre_categoria || "";
        const id = findIdByName(listaCategorias, "nombre", catNombre);
        if (id) { setCategoriaId(id); setCategoriaEsOtra(false); setCategoriaNueva(""); }
        else if (catNombre) { setCategoriaId(""); setCategoriaEsOtra(true); setCategoriaNueva(toUpper(catNombre)); }
        else { setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva(""); }
      }

      if (editRow.id_cont_descripcion) {
        setDescripcionId(String(editRow.id_cont_descripcion));
        setDescripcionEsOtra(false); setDescripcionNueva("");
      } else {
        const descNombre = editRow.descripcion || editRow.nombre_descripcion || "";
        const id = findIdByName(listaDescripciones, "texto", descNombre);
        if (id) { setDescripcionId(id); setDescripcionEsOtra(false); setDescripcionNueva(""); }
        else if (descNombre) { setDescripcionId(""); setDescripcionEsOtra(true); setDescripcionNueva(toUpper(descNombre)); }
        else { setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva(""); }
      }

      if (editRow.id_cont_proveedor) {
        setProveedorId(String(editRow.id_cont_proveedor));
        setProveedorEsOtro(false); setProveedorNuevo("");
      } else {
        const provNombre = editRow.proveedor || editRow.nombre_proveedor || "";
        const id = findIdByName(listaProveedores, "nombre", provNombre);
        if (id) { setProveedorId(id); setProveedorEsOtro(false); setProveedorNuevo(""); }
        else if (provNombre) { setProveedorId(""); setProveedorEsOtro(true); setProveedorNuevo(toUpper(provNombre)); }
        else { setProveedorId(""); setProveedorEsOtro(false); setProveedorNuevo(""); }
      }

      setComprobante(toUpper(String(editRow.comprobante ?? editRow.numero_factura ?? "")));
      setImporte(String(editRow.importe ?? editRow.monto ?? "").replace(/\D/g, ""));
      setCompURL(editRow.comprobante_url || "");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    } else {
      const d = new Date();
      setFecha(d.toISOString().slice(0,10));

      setMedioId(""); setMedioEsOtro(false); setMedioNuevo("");
      setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva("");
      setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva("");
      setProveedorId(""); setProveedorEsOtro(false); setProveedorNuevo("");

      setComprobante("");
      setImporte("");
      setCompURL("");
      setLocalPreview("");
      setViewerOpen(false);
      setZoom(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRow, mediosPago, listaCategorias, listaDescripciones, listaProveedores]);

  // ===== Upload comprobante =====
  const uploadFile = async (file) => {
    const valid = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!valid.includes(file.type)) {
      safeNotify("error", "Formato no soportado. Usá JPG, PNG, GIF, WEBP o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      safeNotify("error", "El archivo supera los 10 MB permitidos.");
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
      // 👉 Enviamos fecha y comprobante para que el backend nombre el archivo
      form.append("fecha", fecha || "");
      form.append("comprobante", comprobante || "");

      const url = `${BASE_URL}/api.php?action=contable_egresos_upload`;
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.exito === false || data?.ok === false) {
        throw new Error(data?.mensaje || "No se pudo subir el archivo.");
      }

      const finalUrl = data.absolute_url ? data.absolute_url : `${BASE_URL}/${data.relative_url}`;
      setCompURL(finalUrl);
      safeNotify("exito", "Archivo subido correctamente.");
    } catch (err) {
      setLocalPreview("");
      setCompURL("");
      safeNotify("error", err.message || "Ocurrió un problema al subir el archivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const clearComprobante = (e) => {
    if (e) e.stopPropagation(); // ⛔ Evita abrir el picker
    setCompURL(""); setLocalPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setViewerOpen(false); setZoom(1);
    safeNotify("advertencia", "Se quitó el comprobante adjunto.");
  };

  // ===== Handlers selects =====
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
  const onChangeProveedor = (val) => {
    if (val === VALOR_OTRO) { setProveedorEsOtro(true); setProveedorId(""); }
    else { setProveedorEsOtro(false); setProveedorId(val); setProveedorNuevo(""); }
  };

  // ====== Abrir el almanaque desde cualquier parte del campo de fecha ======
  const openDatePicker = (withKeyboard = false) => {
    const el = dateInputRef.current;
    if (!el) return;

    try { el.focus({ preventScroll: true }); } catch {}

    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    } catch {
      setTimeout(() => {
        try { el.click(); } catch {}
      }, 0);
    }

    if (withKeyboard) return false;
    return true;
  };

  // ===== Submit =====
  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      safeNotify("advertencia", "Esperá a que termine la subida del archivo para guardar.");
      return;
    }

    if (!fecha) { safeNotify("advertencia", "Seleccioná la fecha del egreso."); return; }

    if (!medioEsOtro && !String(medioId || "").trim()) {
      safeNotify("advertencia", "Seleccioná un medio de pago.");
      return;
    }
    if (medioEsOtro && !onlyLetters(medioNuevo).trim()) {
      safeNotify("advertencia", "Ingresá el nuevo medio de pago (solo letras).");
      return;
    }

    // ✅ Proveedor permite letras y números
    if (proveedorEsOtro && !onlyLettersDigits(proveedorNuevo).trim()) {
      safeNotify("advertencia", "Ingresá el nombre del proveedor (letras y números).");
      return;
    }

    if (comprobante && comprobante.length > 50) {
      safeNotify("advertencia", "El número de comprobante no puede superar 50 caracteres.");
      return;
    }

    const importeNum = Number(onlyDigits(importe) || 0);
    if (!Number.isFinite(importeNum) || importeNum <= 0) {
      safeNotify("advertencia", "Ingresá un importe válido (solo números, mayor a cero).");
      return;
    }
    if (importeNum > MAX_IMPORTE_SOSPECHOSO) {
      safeNotify("advertencia", `El importe ingresado (${new Intl.NumberFormat('es-AR').format(importeNum)}) parece inusualmente alto. Verificalo antes de guardar.`);
      return;
    }

    try {
      setSaving(true);

      // 1) medio de pago -> id
      let idMedio = medioId;
      if (medioEsOtro) {
        const r = await crearMedioPago(medioNuevo);
        await loadListas();
        idMedio = String(r.id);
        setMedioId(idMedio);
        setMedioEsOtro(false);
        setMedioNuevo("");
        safeNotify("exito", "Medio de pago agregado.");
      }

      // 2) categoría -> id
      let idCat = categoriaId || null;
      if (categoriaEsOtra) {
        const r = await crearEgresoCategoria(categoriaNueva);
        await loadListas();
        idCat = String(r.id);
        setCategoriaId(idCat);
        setCategoriaEsOtra(false);
        setCategoriaNueva("");
        safeNotify("exito", "Categoría agregada.");
      }

      // 3) descripción -> id
      let idDesc = descripcionId || null;
      if (descripcionEsOtra) {
        const r = await crearEgresoDescripcion(descripcionNueva);
        await loadListas();
        idDesc = String(r.id);
        setDescripcionId(idDesc);
        setDescripcionEsOtra(false);
        setDescripcionNueva("");
        safeNotify("exito", "Descripción agregada.");
      }

      // 4) proveedor -> id  ✅ usa crearProveedor con alfanumérico
      let idProv = proveedorId || null;
      if (proveedorEsOtro) {
        const r = await crearProveedor(proveedorNuevo);
        await loadListas();
        idProv = String(r.id);
        setProveedorId(idProv);
        setProveedorEsOtro(false);
        setProveedorNuevo("");
        safeNotify("exito", "Proveedor agregado.");
      }

      // 5) payload
      const payload = {
        fecha,
        id_cont_categoria: idCat ? Number(idCat) : null,
        id_cont_proveedor: idProv ? Number(idProv) : null,
        comprobante: (toUpper(comprobante) || null),
        id_cont_descripcion: idDesc ? Number(idDesc) : null,
        id_medio_pago: Number(idMedio || 0),
        importe: Number(onlyDigits(importe) || 0),
        comprobante_url: compURL || null,
      };

      let url = `${BASE_URL}/api.php?action=contable_egresos&op=create`;
      if (editRow && editRow.id_egreso) {
        url = `${BASE_URL}/api.php?action=contable_egresos&op=update`;
        payload.id_egreso = editRow.id_egreso;
      }

      await fetchJSON(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      safeNotify("exito", editRow ? "Egreso actualizado correctamente." : "Egreso agregado correctamente.");
      onSaved?.();
    } catch (err) {
      safeNotify("error", err.message || "No se pudo guardar el egreso.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const isPDF = (localPreview || compURL)?.toLowerCase?.().endsWith(".pdf");
  const hasFile = Boolean(localPreview || compURL);

  return createPortal(
    <>
      {/* === Toast host fijo, por encima del modal === */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <Toast
              tipo={t.tipo}
              mensaje={t.mensaje}
              duracion={t.dur}
              onClose={() => closeToast(t.id)}
            />
          </div>
        ))}
      </div>

      {/* === Modal === */}
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

          <form onSubmit={onSubmit} className="mm_body">
            {/* Row 1: Fecha + Medio */}
            <div className="mm_row">
              {/* Fecha */}
              <div
                className="mm_field has-icon"
                role="button"
                tabIndex={0}
                aria-label="Campo de fecha (abrir calendario)"
                onPointerDown={(e) => {
                  if (e.pointerType !== "mouse" && e.pointerType !== "pen" && e.pointerType !== "touch") return;
                  e.preventDefault();
                  openDatePicker();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  openDatePicker();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDatePicker(true);
                  }
                }}
              >
                <input
                  ref={dateInputRef}
                  className="date-no-native"
                  type="date"
                  value={fecha}
                  onChange={(e)=>setFecha(e.target.value)}
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
                >
                  <option value="">SELECCIONE…</option>
                  {mediosPago.map((m)=>(<option key={m.id} value={m.id}>{m.nombre}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
                <label>Medio</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faCreditCard} /></span>
              </div>
            </div>

            {/* Nuevo medio (si corresponde) */}
            {medioEsOtro && (
              <div className="mm_row">
                <div className="mm_field grow has-icon">
                  <input
                    value={medioNuevo}
                    onChange={(e)=>setMedioNuevo(onlyLetters(e.target.value))}
                    placeholder=" "
                    required
                  />
                  <label>Nuevo medio de pago</label>
                  <span className="mm_iconField"><FontAwesomeIcon icon={faCreditCard} /></span>
                </div>
              </div>
            )}

            {/* Row 2: Categoría + Comprobante */}
            <div className="mm_row">
              <div className="mm_field always-float has-icon">
                <select
                  value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
                  onChange={(e)=>onChangeCategoria(e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {listaCategorias.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
                <label>Categoría</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
              </div>

              <div className="mm_field has-icon">
                <input
                  value={comprobante}
                  onChange={(e)=>setComprobante(toUpper(e.target.value))}
                  placeholder=" "
                  maxLength={50}
                />
                <label>Comprobante</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faHashtag} /></span>
              </div>
            </div>

            {categoriaEsOtra && (
              <div className="mm_row">
                <div className="mm_field grow has-icon">
                  <input
                    value={categoriaNueva}
                    onChange={(e)=>setCategoriaNueva(onlyLetters(e.target.value))}
                    placeholder=" "
                    required
                  />
                  <label>Nueva categoría</label>
                  <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
                </div>
              </div>
            )}

            {/* Row 3: Proveedor + Descripción (misma fila) */}
            <div className="mm_row">
              {/* Proveedor */}
              <div className="mm_field always-float has-icon">
                <select
                  value={proveedorEsOtro ? VALOR_OTRO : proveedorId}
                  onChange={(e)=>onChangeProveedor(e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {listaProveedores.map(p => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
                <label>Proveedor</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
              </div>

              {/* Descripción */}
              <div className="mm_field always-float has-icon">
                <select
                  value={descripcionEsOtra ? VALOR_OTRO : descripcionId}
                  onChange={(e)=>onChangeDescripcion(e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {listaDescripciones.map(d => (<option key={d.id} value={d.id}>{d.texto}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
                <label>Descripción</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faPen} /></span>
              </div>
            </div>

            {/* Campos al vuelo */}
            {proveedorEsOtro && (
              <div className="mm_row">
                <div className="mm_field grow has-icon">
                  <input
                    value={proveedorNuevo}
                    onChange={(e)=>setProveedorNuevo(onlyLettersDigits(e.target.value))}  
                    placeholder=" "
                    required
                  />
                  <label>Nuevo proveedor</label>
                  <span className="mm_iconField"><FontAwesomeIcon icon={faTags} /></span>
                </div>
              </div>
            )}

            {descripcionEsOtra && (
              <div className="mm_row">
                <div className="mm_field grow has-icon">
                  <input
                    value={descripcionNueva}
                    onChange={(e)=>setDescripcionNueva(onlyLetters(e.target.value))}
                    placeholder=" "
                    required
                  />
                  <label>Nueva descripción</label>
                  <span className="mm_iconField"><FontAwesomeIcon icon={faPen} /></span>
                </div>
              </div>
            )}

            <div className="mm_row">
              <div className="mm_field has-icon grow">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={importe}
                  onChange={(e)=>setImporte(onlyDigits(e.target.value))}
                  placeholder=" "
                  required
                />
                <label>Importe</label>
                <span className="mm_iconField"><FontAwesomeIcon icon={faDollarSign} /></span>
              </div>
            </div>

            {/* Dropzone */}
            <div className="dz_wrap">
              <div
                ref={dropRef}
                className="dz_area mm_surface"
                onClick={(e)=>{
                  // ⛔ Si ya hay archivo, NO abrir el explorador con click en la caja.
                  if (hasFile) return;
                  fileInputRef.current?.click();
                }}
                onDragOver={(e)=>{ e.preventDefault(); dropRef.current?.classList.add("dz_over"); }}
                onDragLeave={()=>dropRef.current?.classList.remove("dz_over")}
                onDrop={(e)=>{ e.preventDefault(); dropRef.current?.classList.remove("dz_over"); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e)=>{ 
                  if (e.key === "Enter" && !hasFile) fileInputRef.current?.click();
                }}
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

                {(compURL || localPreview) && (
                  <div className="dz_preview" onClick={(e)=>e.stopPropagation()}>
                    {compURL && (
                      <div className="dz_file">
                        {(() => {
                          try {
                            const u = new URL(compURL);
                            return decodeURIComponent(u.pathname.split("/").pop() || "archivo");
                          } catch {
                            return compURL.split("/").pop() || "archivo";
                          }
                        })()}
                      </div>
                    )}

                    {!((localPreview || compURL)?.toLowerCase?.().endsWith(".pdf")) ? (
                      <img
                        src={localPreview || compURL}
                        alt="Vista previa del comprobante"
                        className="dz_thumb"
                        onClick={(e)=>{ e.stopPropagation(); setViewerOpen(true); setZoom(1); }}
                      />
                    ) : (
                      <div className="dz_pdf">PDF listo para ver</div>
                    )}

                    <div className="dz_actions" onClick={(e)=>e.stopPropagation()}>
                      <button
                        type="button"
                        className="mm_btn"
                        onClick={(e)=>{ 
                          e.stopPropagation(); 
                          if (compURL || localPreview) { setViewerOpen(true); setZoom(1); } 
                        }}
                      >
                        <FontAwesomeIcon icon={faEye} /> Ver
                      </button>
                      <button
                        type="button"
                        className="mm_btn danger"
                        onClick={clearComprobante}
                      >
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

            {/* Footer */}
            <div className="mm_footer">
              <button type="button" className="mm_btn ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="mm_btn primary" disabled={saving || uploading}>
                <FontAwesomeIcon icon={faSave} /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>

          {viewerOpen && (
            <div className="viewer_overlay" onClick={()=>setViewerOpen(false)} role="dialog" aria-modal="true">
              <div className="viewer" onClick={(e)=>e.stopPropagation()}>
                <div className="viewer_toolbar">
                  {!isPDF && (
                    <>
                      <button className="mm_icon" onClick={()=>setZoom(z=>Math.max(0.2, Number((z-0.2).toFixed(2))))}><FontAwesomeIcon icon={faMinus} /></button>
                      <span className="zoom_label">{Math.round(zoom*100)}%</span>
                      <button className="mm_icon" onClick={()=>setZoom(z=>Math.min(5, Number((z+0.2).toFixed(2))))}><FontAwesomeIcon icon={faPlus} /></button>
                      <button className="mm_icon" onClick={()=>setZoom(1)}><FontAwesomeIcon icon={faCompress} /></button>
                    </>
                  )}
                  {isPDF && (compURL || localPreview) && (
                    <button
                      className="mm_btn ghost"
                      onClick={()=>{ 
                        try{ window.open(compURL || localPreview, "_blank","noopener,noreferrer"); } 
                        catch{ window.location.href = compURL || localPreview; } 
                      }}
                    >
                      Abrir en pestaña
                    </button>
                  )}
                  <button className="mm_icon" onClick={()=>setViewerOpen(false)}><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <div className="viewer_body">
                  {!isPDF ? (
                    <img src={localPreview || compURL} alt="Comprobante" className="viewer_img" style={{ transform:`scale(${zoom})` }} />
                  ) : (
                    <iframe title="PDF comprobante" className="viewer_pdf" src={compURL || localPreview} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
