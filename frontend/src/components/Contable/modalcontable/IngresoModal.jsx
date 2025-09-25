// src/components/Contable/modalcontable/IngresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays, faCreditCard, faFileLines,
  faDollarSign, faFloppyDisk, faPen, faPlus, faTags, faUser
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config";
import Toast from "../../Global/Toast";
import "../modalcontable/IngresoModal.css";

/** Constantes y utils */
const U = (v = "") => String(v).toUpperCase();
const onlyLetters = (v = "") => U(v).replace(/[^\p{L}\s]/gu, ""); // letras+espacios (incluye acentos/ñ)
const onlyDigits = (v = "") => String(v).replace(/\D/g, "");       // solo números
const VALOR_OTRO = "__OTRO__";
const MAX_IMPORTE = 50_000_000;

/** Fetch helper */
async function fetchJSON(url, options) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.exito === false) throw new Error(data?.mensaje || `HTTP ${res.status}`);
  return data;
}

/** =========================================================================
    Modal Crear Ingreso
    ========================================================================= */
export function IngresoCrearModal({ open, onClose, onSaved, defaultDate }) {
  const [saving, setSaving] = useState(false);

  /** Listas */
  const [medios, setMedios] = useState([]);                      // [{id, nombre}]
  const [listaCategorias, setListaCategorias] = useState([]);     // [{id, nombre}]
  const [listaImputaciones, setListaImputaciones] = useState([]); // [{id, nombre}]
  const [listaProveedores, setListaProveedores] = useState([]);   // [{id, nombre}]

  /** Selects + OTRO */
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");

  const [imputacionId, setImputacionId] = useState("");
  const [imputacionEsOtra, setImputacionEsOtra] = useState(false);
  const [imputacionNueva, setImputacionNueva] = useState("");

  const [proveedorId, setProveedorId] = useState("");
  const [proveedorEsOtro, setProveedorEsOtro] = useState(false);
  const [proveedorNuevo, setProveedorNuevo] = useState("");

  /** Form base */
  const [form, setForm] = useState({
    fecha: defaultDate || new Date().toISOString().slice(0, 10),
    importe: "",
    id_medio_pago: "",
  });

  /** ===== TOAST HOST (arriba del modal, dedupe) ===== */
  const [toasts, setToasts] = useState([]);
  const recentToastMapRef = useRef(new Map());
  const pushToast = (tipo, mensaje, dur = 3000) => {
    const key = `${tipo}|${mensaje}`;
    const now = Date.now();
    const last = recentToastMapRef.current.get(key);
    if (last && now - last < 4000) return; // evita duplicados pegados
    recentToastMapRef.current.set(key, now);
    const id = `${now}-${Math.random().toString(36).slice(2)}`;
    setToasts(t => [...t, { id, tipo, mensaje, dur }]);
    setTimeout(() => recentToastMapRef.current.delete(key), Math.max(0, dur + 500));
  };
  const closeToast = (id) => setToasts(ts => ts.filter(x => x.id !== id));
  const safeNotify = (tipo, mensaje, dur = 3000) => pushToast(tipo, mensaje, dur);

  /** ===== Cargar listas ===== */
  const loadListas = async () => {
    const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);

    const mp = (data?.listas?.medios_pago ?? []).map(m => ({ id: String(m.id), nombre: String(m.nombre || m.medio_pago || "") }));

    // Claves contables
    const catsRaw = (data?.listas?.contable_categorias ?? []);
    const impsRaw = (data?.listas?.contable_descripciones ?? []);
    const provsRaw = (data?.listas?.contable_proveedores ?? []);

    const cats = catsRaw.map(c => ({ id: String(c.id), nombre: String(c.nombre || c.nombre_categoria || "") }));
    const imps = impsRaw.map(d => ({ id: String(d.id), nombre: String(d.nombre || d.texto || d.nombre_descripcion || "") }));
    const provs = provsRaw.map(p => ({ id: String(p.id), nombre: String(p.nombre || p.nombre_proveedor || "") }));

    setMedios(mp);
    setListaCategorias(cats);
    setListaImputaciones(imps);
    setListaProveedores(provs);

    setForm(s => ({ ...s, id_medio_pago: s.id_medio_pago || (mp[0]?.id || "") }));
  };

  useEffect(() => {
    if (!open) return;

    // reset toasts al abrir
    setToasts([]); recentToastMapRef.current.clear();

    (async () => {
      try { await loadListas(); }
      catch {
        setMedios([]); setListaCategorias([]); setListaImputaciones([]); setListaProveedores([]);
        safeNotify("error", "No se pudieron cargar las listas.");
      }
    })();

    setForm({
      fecha: defaultDate || new Date().toISOString().slice(0, 10),
      importe: "",
      id_medio_pago: "",
    });

    setMedioEsOtro(false); setMedioNuevo("");
    setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva("");
    setImputacionId(""); setImputacionEsOtra(false); setImputacionNueva("");
    setProveedorId(""); setProveedorEsOtro(false); setProveedorNuevo("");
  }, [open, defaultDate]);

  /** ===== Handlers ===== */
  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = onlyDigits(v);
    else v = U(v);
    setForm((s) => ({ ...s, [k]: v }));
  };

  const onChangeMedio = (val) => {
    if (val === VALOR_OTRO) { setMedioEsOtro(true); setMedioNuevo(""); setForm(s => ({ ...s, id_medio_pago: "" })); }
    else { setMedioEsOtro(false); setMedioNuevo(""); setForm(s => ({ ...s, id_medio_pago: String(val) })); }
  };
  const onChangeCategoria = (val) => {
    if (val === VALOR_OTRO) { setCategoriaEsOtra(true); setCategoriaId(""); }
    else { setCategoriaEsOtra(false); setCategoriaId(val); setCategoriaNueva(""); }
  };
  const onChangeImputacion = (val) => {
    if (val === VALOR_OTRO) { setImputacionEsOtra(true); setImputacionId(""); }
    else { setImputacionEsOtra(false); setImputacionId(val); setImputacionNueva(""); }
  };
  const onChangeProveedor = (val) => {
    if (val === VALOR_OTRO) { setProveedorEsOtro(true); setProveedorId(""); setProveedorNuevo(""); }
    else { setProveedorEsOtro(false); setProveedorId(val); setProveedorNuevo(""); }
  };

  /** ===== Crear al vuelo (con validación solo letras) ===== */
  const crearMedioPago = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo medio de pago (solo letras).");
    if (nombreOK.length > 100) throw new Error("El medio de pago no puede superar 100 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Medio de pago agregado.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearCategoria = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá la nueva categoría (solo letras).");
    if (nombreOK.length > 120) throw new Error("La categoría no puede superar 120 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Categoría agregada.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearImputacion = async (texto) => {
    const textoOK = onlyLetters(texto).trim();
    if (!textoOK) throw new Error("Ingresá la nueva imputación (solo letras).");
    if (textoOK.length > 160) throw new Error("La imputación no puede superar 160 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
    await loadListas();
    safeNotify("exito", "Imputación agregada.");
    return { id: String(r.id), nombre: r.texto || textoOK };
  };

  const crearProveedor = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo proveedor (solo letras).");
    if (nombreOK.length > 120) throw new Error("El proveedor no puede superar 120 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_proveedor`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Proveedor agregado.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  /** ===== Submit ===== */
  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    const importeNumber = Number(onlyDigits(form.importe) || 0);
    if (!form.fecha) { safeNotify("advertencia", "Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { safeNotify("advertencia", "Ingresá un importe válido (solo números)."); return; }
    if (importeNumber > MAX_IMPORTE) { safeNotify("advertencia", `El importe (${new Intl.NumberFormat('es-AR').format(importeNumber)}) supera el máximo permitido (${new Intl.NumberFormat('es-AR').format(MAX_IMPORTE)}).`); return; }
    if (!medioEsOtro && !String(form.id_medio_pago || "").trim()) { safeNotify("advertencia", "Seleccioná un medio de pago."); return; }
    if (categoriaEsOtra && !onlyLetters(categoriaNueva).trim()) { safeNotify("advertencia", "Ingresá la nueva categoría (solo letras)."); return; }
    if (imputacionEsOtra && !onlyLetters(imputacionNueva).trim()) { safeNotify("advertencia", "Ingresá la nueva imputación (solo letras)."); return; }
    if (proveedorEsOtro && !onlyLetters(proveedorNuevo).trim()) { safeNotify("advertencia", "Ingresá el nuevo proveedor (solo letras)."); return; }

    try {
      setSaving(true);

      // Medio de pago
      let medioIdFinal = form.id_medio_pago;
      if (medioEsOtro) {
        const nuevo = await crearMedioPago(medioNuevo);
        medioIdFinal = nuevo.id;
      }

      // Categoría -> ID
      let categoriaIdFinal = categoriaId || null;
      if (categoriaEsOtra) {
        const nueva = await crearCategoria(categoriaNueva);
        categoriaIdFinal = nueva.id;
        setCategoriaId(nueva.id);
        setCategoriaEsOtra(false);
        setCategoriaNueva("");
      }

      // Imputación -> ID
      let imputacionIdFinal = imputacionId || null;
      if (imputacionEsOtra) {
        const nueva = await crearImputacion(imputacionNueva);
        imputacionIdFinal = nueva.id;
        setImputacionId(nueva.id);
        setImputacionEsOtra(false);
        setImputacionNueva("");
      }

      // Proveedor -> ID
      let proveedorIdFinal = proveedorId || null;
      if (proveedorEsOtro) {
        const nuevo = await crearProveedor(proveedorNuevo);
        proveedorIdFinal = nuevo.id;
        setProveedorId(nuevo.id);
        setProveedorEsOtro(false);
        setProveedorNuevo("");
      }

      const payload = {
        fecha: form.fecha,
        id_cont_categoria: categoriaIdFinal ? Number(categoriaIdFinal) : null,
        id_cont_proveedor: proveedorIdFinal ? Number(proveedorIdFinal) : null,
        id_cont_descripcion: imputacionIdFinal ? Number(imputacionIdFinal) : null,
        id_medio_pago: Number(medioIdFinal),
        importe: importeNumber,
      };

      const data = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&op=create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!data?.exito) throw new Error(data?.mensaje || "No se pudo guardar.");
      safeNotify("exito", "Ingreso guardado correctamente.");
      onSaved?.();
      onClose?.();
    } catch (err) {
      safeNotify("error", `No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingCrearTitle">
      {/* Toast host fijo */}
      <ToastHost toasts={toasts} onClose={closeToast} />

      <div className="ing-modal ing-modal--elev">
        {/* HEAD */}
        <div className="ing-modal__head gradient--brand-red">
          <div className="ing-modal__title">
            <div className="ing-modal__badge"><FontAwesomeIcon icon={faPlus} /></div>
            <h3 id="ingCrearTitle">Registrar ingreso</h3>
          </div>
          <button className="ghost-btn ghost-btn--light" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* BODY */}
        <form className="ing-modal__body" onSubmit={submit}>
          <div className="grid2">
            {/* Fecha */}
            <DateField value={form.fecha} onChange={onChange("fecha")} />

            {/* Medio de pago */}
            <SelectField
              icon={faCreditCard}
              label="Medio de pago"
              value={medioEsOtro ? VALOR_OTRO : form.id_medio_pago}
              onChange={(v) => onChangeMedio(v)}
              options={medios}
              extraOption
              required={!medioEsOtro}
              invalid={!medioEsOtro && !String(form.id_medio_pago || "").trim()}
            />
          </div>

          {medioEsOtro && (
            <InputField icon={faCreditCard} label="Nuevo medio de pago" value={medioNuevo} onChange={(e)=>setMedioNuevo(onlyLetters(e.target.value))} required />
          )}

          {/* Proveedor */}
          <SelectField
            icon={faUser}
            label="Proveedor"
            value={proveedorEsOtro ? VALOR_OTRO : proveedorId}
            onChange={(v)=>onChangeProveedor(v)}
            options={listaProveedores}
            extraOption
            placeholder="Seleccione..."
          />
          {proveedorEsOtro && (
            <InputField icon={faUser} label="Nuevo proveedor" value={proveedorNuevo} onChange={(e)=>setProveedorNuevo(onlyLetters(e.target.value))} required />
          )}

          {/* Categoría */}
          <SelectField
            icon={faTags}
            label="Categoría"
            value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
            onChange={(v)=>onChangeCategoria(v)}
            options={listaCategorias}
            extraOption
            placeholder="Seleccione..."
          />
          {categoriaEsOtra && (
            <InputField icon={faTags} label="Nueva categoría" value={categoriaNueva} onChange={(e)=>setCategoriaNueva(onlyLetters(e.target.value))} required />
          )}

          {/* Imputación + Importe */}
          <div className="grid2">
            <SelectField
              icon={faFileLines}
              label="Imputación"
              value={imputacionEsOtra ? VALOR_OTRO : imputacionId}
              onChange={(v)=>onChangeImputacion(v)}
              options={listaImputaciones}
              extraOption
              placeholder="Seleccione..."
            />

            <InputField
              icon={faDollarSign}
              label="Importe (ARS)"
              value={form.importe}
              onChange={(e)=>onChange("importe")(e)}
              inputMode="numeric"
              pattern="\d*"
              placeholder="0"
            />
          </div>

          {imputacionEsOtra && (
            <InputField className="span-2" icon={faFileLines} label="Nueva imputación" value={imputacionNueva} onChange={(e)=>setImputacionNueva(onlyLetters(e.target.value))} required />
          )}

          {/* FOOT */}
          <div className="ing-modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn sm solid" disabled={saving}>
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{saving ? "Guardando…" : "Guardar ingreso"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** =========================================================================
    Modal Editar Ingreso
    ========================================================================= */
export function IngresoEditarModal({ open, onClose, onSaved, editRow }) {
  const [saving, setSaving] = useState(false);

  const [medios, setMedios] = useState([]);
  const [listaCategorias, setListaCategorias] = useState([]);
  const [listaImputaciones, setListaImputaciones] = useState([]);
  const [listaProveedores, setListaProveedores] = useState([]);

  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");

  const [imputacionId, setImputacionId] = useState("");
  const [imputacionEsOtra, setImputacionEsOtra] = useState(false);
  const [imputacionNueva, setImputacionNueva] = useState("");

  const [proveedorId, setProveedorId] = useState("");
  const [proveedorEsOtro, setProveedorEsOtro] = useState(false);
  const [proveedorNuevo, setProveedorNuevo] = useState("");

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    importe: "",
    id_medio_pago: "",
  });

  /** TOASTS */
  const [toasts, setToasts] = useState([]);
  const recentToastMapRef = useRef(new Map());
  const pushToast = (tipo, mensaje, dur = 3000) => {
    const key = `${tipo}|${mensaje}`;
    const now = Date.now();
    const last = recentToastMapRef.current.get(key);
    if (last && now - last < 4000) return;
    recentToastMapRef.current.set(key, now);
    const id = `${now}-${Math.random().toString(36).slice(2)}`;
    setToasts(t => [...t, { id, tipo, mensaje, dur }]);
    setTimeout(() => recentToastMapRef.current.delete(key), Math.max(0, dur + 500));
  };
  const closeToast = (id) => setToasts(ts => ts.filter(x => x.id !== id));
  const safeNotify = (tipo, mensaje, dur = 3000) => pushToast(tipo, mensaje, dur);

  const loadListas = async () => {
    const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);

    const mp = (data?.listas?.medios_pago ?? []).map(m => ({ id: String(m.id), nombre: String(m.nombre || m.medio_pago || "") }));
    const cats = (data?.listas?.contable_categorias ?? []).map(c => ({ id: String(c.id), nombre: String(c.nombre || c.nombre_categoria || "") }));
    const imps = (data?.listas?.contable_descripciones ?? []).map(d => ({ id: String(d.id), nombre: String(d.nombre || d.texto || d.nombre_descripcion || "") }));
    const provs = (data?.listas?.contable_proveedores ?? []).map(p => ({ id: String(p.id), nombre: String(p.nombre || p.nombre_proveedor || "") }));

    setMedios(mp); setListaCategorias(cats); setListaImputaciones(imps); setListaProveedores(provs);
  };

  const loadDetalle = async (id) => {
    const data = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&op=get&id=${encodeURIComponent(id)}`);
    const r = data?.data || {};

    setForm({
      fecha: r.fecha || new Date().toISOString().slice(0, 10),
      importe: onlyDigits(String(r.importe ?? "")),
      id_medio_pago: r.id_medio_pago ? String(r.id_medio_pago) : "",
    });

    setProveedorId(r.id_cont_proveedor ? String(r.id_cont_proveedor) : "");
    setProveedorEsOtro(false); setProveedorNuevo("");

    setCategoriaId(r.id_cont_categoria ? String(r.id_cont_categoria) : "");
    setCategoriaEsOtra(false); setCategoriaNueva("");

    setImputacionId(r.id_cont_descripcion ? String(r.id_cont_descripcion) : "");
    setImputacionEsOtra(false); setImputacionNueva("");

    setMedioEsOtro(false); setMedioNuevo("");
  };

  useEffect(() => {
    if (!open || !editRow?.id_ingreso) return;

    // reset toasts al abrir
    setToasts([]); recentToastMapRef.current.clear();

    (async () => {
      try {
        await loadListas();
        await loadDetalle(editRow.id_ingreso);
      } catch (e) {
        safeNotify("error", "No se pudieron cargar datos del ingreso.");
      }
    })();
  }, [open, editRow]);

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = onlyDigits(v);
    else v = U(v);
    setForm((s) => ({ ...s, [k]: v }));
  };
  const onChangeMedio = (val) => {
    if (val === VALOR_OTRO) { setMedioEsOtro(true); setMedioNuevo(""); setForm(s => ({ ...s, id_medio_pago: "" })); }
    else { setMedioEsOtro(false); setMedioNuevo(""); setForm(s => ({ ...s, id_medio_pago: String(val) })); }
  };
  const onChangeCategoria = (val) => {
    if (val === VALOR_OTRO) { setCategoriaEsOtra(true); setCategoriaId(""); }
    else { setCategoriaEsOtra(false); setCategoriaId(val); setCategoriaNueva(""); }
  };
  const onChangeImputacion = (val) => {
    if (val === VALOR_OTRO) { setImputacionEsOtra(true); setImputacionId(""); }
    else { setImputacionEsOtra(false); setImputacionId(val); setImputacionNueva(""); }
  };
  const onChangeProveedor = (val) => {
    if (val === VALOR_OTRO) { setProveedorEsOtro(true); setProveedorId(""); setProveedorNuevo(""); }
    else { setProveedorEsOtro(false); setProveedorId(val); setProveedorNuevo(""); }
  };

  const crearMedioPago = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo medio de pago (solo letras).");
    if (nombreOK.length > 100) throw new Error("El medio de pago no puede superar 100 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Medio de pago agregado.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };
  const crearCategoria = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá la nueva categoría (solo letras).");
    if (nombreOK.length > 120) throw new Error("La categoría no puede superar 120 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Categoría agregada.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };
  const crearImputacion = async (texto) => {
    const textoOK = onlyLetters(texto).trim();
    if (!textoOK) throw new Error("Ingresá la nueva imputación (solo letras).");
    if (textoOK.length > 160) throw new Error("La imputación no puede superar 160 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
    await loadListas();
    safeNotify("exito", "Imputación agregada.");
    return { id: String(r.id), nombre: r.texto || textoOK };
  };
  const crearProveedor = async (nombre) => {
    const nombreOK = onlyLetters(nombre).trim();
    if (!nombreOK) throw new Error("Ingresá el nuevo proveedor (solo letras).");
    if (nombreOK.length > 120) throw new Error("El proveedor no puede superar 120 caracteres.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_proveedor`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    await loadListas();
    safeNotify("exito", "Proveedor agregado.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  /** Submit */
  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving || !editRow?.id_ingreso) return;

    const importeNumber = Number(onlyDigits(form.importe) || 0);
    if (!form.fecha) { safeNotify("advertencia", "Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { safeNotify("advertencia", "Ingresá un importe válido (solo números)."); return; }
    if (importeNumber > MAX_IMPORTE) { safeNotify("advertencia", `El importe (${new Intl.NumberFormat('es-AR').format(importeNumber)}) supera el máximo permitido (${new Intl.NumberFormat('es-AR').format(MAX_IMPORTE)}).`); return; }
    if (!medioEsOtro && !String(form.id_medio_pago || "").trim()) { safeNotify("advertencia", "Seleccioná un medio de pago."); return; }
    if (categoriaEsOtra && !onlyLetters(categoriaNueva).trim()) { safeNotify("advertencia", "Ingresá la nueva categoría (solo letras)."); return; }
    if (imputacionEsOtra && !onlyLetters(imputacionNueva).trim()) { safeNotify("advertencia", "Ingresá la nueva imputación (solo letras)."); return; }
    if (proveedorEsOtro && !onlyLetters(proveedorNuevo).trim()) { safeNotify("advertencia", "Ingresá el nuevo proveedor (solo letras)."); return; }

    try {
      setSaving(true);

      // Medio
      let medioIdFinal = form.id_medio_pago;
      if (medioEsOtro) {
        const nuevo = await crearMedioPago(medioNuevo);
        medioIdFinal = nuevo.id;
      }

      // Categoría
      let categoriaIdFinal = categoriaId || null;
      if (categoriaEsOtra) {
        const nueva = await crearCategoria(categoriaNueva);
        categoriaIdFinal = nueva.id;
        setCategoriaId(nueva.id);
        setCategoriaEsOtra(false);
        setCategoriaNueva("");
      }

      // Imputación
      let imputacionIdFinal = imputacionId || null;
      if (imputacionEsOtra) {
        const nueva = await crearImputacion(imputacionNueva);
        imputacionIdFinal = nueva.id;
        setImputacionId(nueva.id);
      }

      // Proveedor
      let proveedorIdFinal = proveedorId || null;
      if (proveedorEsOtro) {
        const nuevo = await crearProveedor(proveedorNuevo);
        proveedorIdFinal = nuevo.id;
        setProveedorId(nuevo.id);
      }

      const payload = {
        id_ingreso: Number(editRow.id_ingreso),
        fecha: form.fecha,
        id_cont_categoria: categoriaIdFinal ? Number(categoriaIdFinal) : null,
        id_cont_proveedor: proveedorIdFinal ? Number(proveedorIdFinal) : null,
        id_cont_descripcion: imputacionIdFinal ? Number(imputacionIdFinal) : null,
        id_medio_pago: Number(medioIdFinal),
        importe: importeNumber,
      };

      const data = await fetchJSON(`${BASE_URL}/api.php?action=contable_ingresos&op=update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!data?.exito) throw new Error(data?.mensaje || "No se pudo guardar.");
      safeNotify("exito", "Cambios guardados correctamente.");
      onSaved?.();
      onClose?.();
    } catch (err) {
      safeNotify("error", `No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !editRow) return null;

  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingEditarTitle">
      {/* Toast host fijo */}
      <ToastHost toasts={toasts} onClose={closeToast} />

      <div className="ing-modal ing-modal--elev">
        <div className="ing-modal__head gradient--brand-red">
          <div className="ing-modal__title">
            <div className="ing-modal__badge"><FontAwesomeIcon icon={faPen} /></div>
            <h3 id="ingEditarTitle">Editar ingreso</h3>
          </div>
          <button className="ghost-btn ghost-btn--light" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form className="ing-modal__body" onSubmit={submit}>
          <div className="grid2">
            {/* Fecha */}
            <DateField value={form.fecha} onChange={onChange("fecha")} />

            {/* Medio */}
            <SelectField
              icon={faCreditCard}
              label="Medio de pago"
              value={medioEsOtro ? VALOR_OTRO : form.id_medio_pago}
              onChange={(v) => onChangeMedio(v)}
              options={medios}
              extraOption
              required={!medioEsOtro}
              invalid={!medioEsOtro && !String(form.id_medio_pago || "").trim()}
            />
          </div>

          {medioEsOtro && (
            <InputField icon={faCreditCard} label="Nuevo medio de pago" value={medioNuevo} onChange={(e)=>setMedioNuevo(onlyLetters(e.target.value))} required />
          )}

          {/* Proveedor */}
          <SelectField
            icon={faUser}
            label="Proveedor"
            value={proveedorEsOtro ? VALOR_OTRO : proveedorId}
            onChange={(v)=>onChangeProveedor(v)}
            options={listaProveedores}
            extraOption
            placeholder="Seleccione..."
          />
          {proveedorEsOtro && (
            <InputField icon={faUser} label="Nuevo proveedor" value={proveedorNuevo} onChange={(e)=>setProveedorNuevo(onlyLetters(e.target.value))} required />
          )}

          {/* Categoría */}
          <SelectField
            icon={faTags}
            label="Categoría"
            value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
            onChange={(v)=>onChangeCategoria(v)}
            options={listaCategorias}
            extraOption
            placeholder="Seleccione..."
          />
          {categoriaEsOtra && (
            <InputField icon={faTags} label="Nueva categoría" value={categoriaNueva} onChange={(e)=>setCategoriaNueva(onlyLetters(e.target.value))} required />
          )}

          {/* Imputación + Importe */}
          <div className="grid2">
            <SelectField
              icon={faFileLines}
              label="Imputación"
              value={imputacionEsOtra ? VALOR_OTRO : imputacionId}
              onChange={(v)=>onChangeImputacion(v)}
              options={listaImputaciones}
              extraOption
              placeholder="Seleccione..."
            />

            <InputField
              icon={faDollarSign}
              label="Importe (ARS)"
              value={form.importe}
              onChange={(e)=>onChange("importe")(e)}
              inputMode="numeric"
              pattern="\d*"
              placeholder="0"
            />
          </div>

          {imputacionEsOtra && (
            <InputField className="span-2" icon={faFileLines} label="Nueva imputación" value={imputacionNueva} onChange={(e)=>setImputacionNueva(onlyLetters(e.target.value))} required />
          )}

          <div className="ing-modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn sm solid" disabled={saving}>
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{saving ? "Guardando…" : "Guardar cambios"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ====== Pequeños componentes de UI reutilizados ====== */
function DateField({ value, onChange }) {
  const dateRef = useRef(null);
  return (
    <div className="field field--icon field--date">
      <label>Fecha</label>
      <div
        className="control control--clickable"
        onMouseDown={(e) => {
          if (e.target !== dateRef.current) e.preventDefault();
          const el = dateRef.current;
          if (!el) return;
          if (typeof el.showPicker === "function") { try { el.showPicker(); return; } catch {} }
          el.focus(); el.click();
        }}
        role="button" tabIndex={0} aria-label="Abrir selector de fecha"
      >
        <span className="i"><FontAwesomeIcon icon={faCalendarDays} /></span>
        <input
          ref={dateRef} type="date" value={value}
          onChange={onChange}
          onMouseDown={(e) => { if (dateRef.current?.showPicker) e.preventDefault(); }}
        />
      </div>
    </div>
  );
}

function SelectField({ icon, label, value, onChange, options, extraOption=false, placeholder, required, invalid }) {
  return (
    <div className="field field--icon">
      <label>{label}</label>
      <div className="control">
        <span className="i"><FontAwesomeIcon icon={icon} /></span>
        <select
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          style={{ textTransform: "uppercase" }}
          required={required}
          aria-invalid={invalid ? true : undefined}
        >
          <option value="">{placeholder || "SELECCIONE…"}</option>
          {options.map(o => (<option key={o.id} value={o.id}>{U(o.nombre)}</option>))}
          {extraOption && <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>}
        </select>
      </div>
    </div>
  );
}

function InputField({ icon, label, value, onChange, inputMode, placeholder, required, className }) {
  return (
    <div className={`field field--icon ${className || ""}`}>
      <label>{label}</label>
      <div className="control">
        <span className="i"><FontAwesomeIcon icon={icon} /></span>
        <input
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          pattern={inputMode === "numeric" ? "\\d*" : undefined}
        />
      </div>
    </div>
  );
}

/** Host de Toasts (arriba a la derecha, por encima del modal) */
function ToastHost({ toasts, onClose }) {
  return (
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
          <Toast tipo={t.tipo} mensaje={t.mensaje} duracion={t.dur} onClose={() => onClose(t.id)} />
        </div>
      ))}
    </div>
  );
}
