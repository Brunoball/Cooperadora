// src/components/Contable/modalcontable/IngresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays, faCreditCard, faFileLines,
  faDollarSign, faFloppyDisk, faPen, faPlus, faTags
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config";
import "../IngresosContable.css";

/** Utils */
const U = (v = "") => String(v).toUpperCase();
const VALOR_OTRO = "__OTRO__";

async function fetchJSON(url, options) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.mensaje || `HTTP ${res.status}`);
  return data;
}

/* =========================================================================
   Modal Crear Ingreso  (Categoría reemplaza Denominación)
   ========================================================================= */
export function IngresoCrearModal({ open, onClose, onSaved, defaultDate }) {
  const [saving, setSaving] = useState(false);

  /** Listas */
  const [medios, setMedios] = useState([]);                       // [{id, nombre}]
  const [listaCategorias, setListaCategorias] = useState([]);      // [{id, nombre}]
  const [listaDescripciones, setListaDescripciones] = useState([]);// [{id, texto}]

  /** Selects + OTRO */
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");

  const [descripcionId, setDescripcionId] = useState("");
  const [descripcionEsOtra, setDescripcionEsOtra] = useState(false);
  const [descripcionNueva, setDescripcionNueva] = useState("");

  /** Form base (sin denominación) */
  const [form, setForm] = useState({
    fecha: defaultDate || new Date().toISOString().slice(0, 10),
    importe: "",
    id_medio_pago: "",
  });

  const dateRef = useRef(null);

  /** ===== Cargar listas ===== */
  const loadListas = async () => {
    const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
    const mp = (data?.listas?.medios_pago ?? []).map(m => ({ id: String(m.id), nombre: String(m.nombre || "") }));
    const cats = (data?.listas?.egreso_categorias ?? []).map(c => ({ id: String(c.id), nombre: String(c.nombre || "") }));
    const descs = (data?.listas?.egreso_descripciones ?? []).map(d => ({ id: String(d.id), texto: String(d.texto || "") }));

    setMedios(mp);
    setListaCategorias(cats);
    setListaDescripciones(descs);

    setForm(s => ({ ...s, id_medio_pago: s.id_medio_pago || (mp[0]?.id || "") }));
  };

  useEffect(() => {
    if (!open) return;

    (async () => {
      try { await loadListas(); }
      catch { setMedios([]); setListaCategorias([]); setListaDescripciones([]); }
    })();

    setForm({
      fecha: defaultDate || new Date().toISOString().slice(0, 10),
      importe: "",
      id_medio_pago: "",
    });

    setMedioEsOtro(false); setMedioNuevo("");
    setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva("");
    setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva("");
  }, [open, defaultDate]);

  /** ===== Handlers ===== */
  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = v.replace(/[^\d.,]/g, "");
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
  const onChangeDescripcion = (val) => {
    if (val === VALOR_OTRO) { setDescripcionEsOtra(true); setDescripcionId(""); }
    else { setDescripcionEsOtra(false); setDescripcionId(val); setDescripcionNueva(""); }
  };

  /** ===== Crear al vuelo ===== */
  const crearMedioPago = async (nombre) => {
    const nombreOK = U(String(nombre || "").trim());
    if (!nombreOK) throw new Error("INGRESÁ EL NUEVO MEDIO DE PAGO.");
    if (nombreOK.length > 100) throw new Error("EL MEDIO DE PAGO NO PUEDE SUPERAR 100 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear el medio.");

    await loadListas();
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearCategoria = async (nombre) => {
    const nombreOK = U(String(nombre || "").trim());
    if (!nombreOK) throw new Error("INGRESÁ LA NUEVA CATEGORÍA.");
    if (nombreOK.length > 100) throw new Error("LA CATEGORÍA NO PUEDE SUPERAR 100 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la categoría.");

    await loadListas();
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearDescripcion = async (texto) => {
    const textoOK = U(String(texto || "").trim());
    if (!textoOK) throw new Error("INGRESÁ LA NUEVA DESCRIPCIÓN.");
    if (textoOK.length > 150) throw new Error("LA DESCRIPCIÓN NO PUEDE SUPERAR 150 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la descripción.");

    await loadListas();
    return { id: String(r.id), texto: r.texto || textoOK };
  };

  /** ===== Submit ===== */
  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.fecha) { alert("Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { alert("Ingresá un importe válido."); return; }
    if (!medioEsOtro && !String(form.id_medio_pago || "").trim()) { alert("Seleccioná un medio de pago."); return; }
    if (categoriaEsOtra && !String(categoriaNueva || "").trim()) { alert("Ingresá la nueva categoría."); return; }
    if (descripcionEsOtra && !String(descripcionNueva || "").trim()) { alert("Ingresá la nueva descripción."); return; }

    try {
      setSaving(true);

      // Medio de pago
      let medioIdFinal = form.id_medio_pago;
      if (medioEsOtro) {
        const nuevo = await crearMedioPago(medioNuevo);
        medioIdFinal = nuevo.id;
      }

      // Categoría (texto) -> reemplaza "denominación" en la DB
      let categoriaTexto = "";
      if (categoriaEsOtra) {
        const nueva = await crearCategoria(categoriaNueva);
        categoriaTexto = U(nueva.nombre || categoriaNueva);
        setCategoriaId(nueva.id);
        setCategoriaEsOtra(false);
        setCategoriaNueva("");
      } else {
        categoriaTexto = U(listaCategorias.find(c => c.id === String(categoriaId))?.nombre || "SIN CATEGORÍA");
      }
      if (!categoriaTexto) categoriaTexto = "SIN CATEGORÍA";

      // Descripción (texto)
      let descripcionTexto = "";
      if (descripcionEsOtra) {
        const nueva = await crearDescripcion(descripcionNueva);
        descripcionTexto = U(nueva.texto || descripcionNueva);
        setDescripcionId(nueva.id);
        setDescripcionEsOtra(false);
        setDescripcionNueva("");
      } else {
        descripcionTexto = U(listaDescripciones.find(d => d.id === String(descripcionId))?.texto || "");
      }

      const payload = {
        fecha: form.fecha,
        // IMPORTANTE: enviamos la categoría como "denominacion"
        denominacion: categoriaTexto,
        descripcion: descripcionTexto,
        importe: importeNumber,
        id_medio_pago: Number(medioIdFinal),
      };

      const res = await fetch(`${BASE_URL}/api.php?action=ingresos_create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.exito) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);

      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingCrearTitle">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const el = dateRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") { try { el.showPicker(); return; } catch {} }
                    el.focus(); el.click();
                  }
                }}
                role="button" tabIndex={0} aria-label="Abrir selector de fecha"
              >
                <span className="i"><FontAwesomeIcon icon={faCalendarDays} /></span>
                <input
                  ref={dateRef} type="date" value={form.fecha}
                  onChange={onChange("fecha")}
                  onMouseDown={(e) => { if (dateRef.current?.showPicker) e.preventDefault(); }}
                />
              </div>
            </div>

            {/* Medio de pago (select + OTRO) */}
            <div className="field field--icon">
              <label>Medio de pago</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faCreditCard} /></span>
                <select
                  value={medioEsOtro ? VALOR_OTRO : form.id_medio_pago}
                  onChange={(e) => onChangeMedio(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required={!medioEsOtro}
                  aria-invalid={!medioEsOtro && !String(form.id_medio_pago || "").trim() ? true : undefined}
                >
                  <option value="">SELECCIONE…</option>
                  {medios.map(mp => (<option key={mp.id} value={mp.id}>{U(mp.nombre)}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
              </div>
            </div>
          </div>

          {medioEsOtro && (
            <div className="field field--icon">
              <label>Nuevo medio de pago</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faCreditCard} /></span>
                <input type="text" placeholder="Ej: TRANSFERENCIA BNA" value={medioNuevo} onChange={(e) => setMedioNuevo(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Categoría (select + OTRO) */}
          <div className="field field--icon">
            <label>Categoría</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faTags} /></span>
              <select
                value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
                onChange={(e) => onChangeCategoria(e.target.value)}
              >
                <option value="">(SIN CATEGORÍA)</option>
                {listaCategorias.map(c => (<option key={c.id} value={c.id}>{U(c.nombre)}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
            </div>
          </div>

          {categoriaEsOtra && (
            <div className="field field--icon">
              <label>Nueva categoría</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faTags} /></span>
                <input type="text" value={categoriaNueva} onChange={(e)=>setCategoriaNueva(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Descripción (select + OTRO) */}
          <div className="field field--icon">
            <label>Descripción</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faFileLines} /></span>
              <select
                value={descripcionEsOtra ? VALOR_OTRO : descripcionId}
                onChange={(e) => onChangeDescripcion(e.target.value)}
              >
                <option value="">(SIN DESCRIPCIÓN)</option>
                {listaDescripciones.map(d => (<option key={d.id} value={d.id}>{U(d.texto)}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
            </div>
          </div>

          {descripcionEsOtra && (
            <div className="field field--icon">
              <label>Nueva descripción</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faFileLines} /></span>
                <input type="text" value={descripcionNueva} onChange={(e)=>setDescripcionNueva(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Importe */}
          <div className="field field--icon">
            <label>Importe (ARS)</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faDollarSign} /></span>
              <input inputMode="decimal" placeholder="0" value={form.importe} onChange={onChange("importe")} />
            </div>
          </div>

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

/* =========================================================================
   Modal Editar Ingreso (Categoría reemplaza Denominación)
   ========================================================================= */
export function IngresoEditarModal({ open, onClose, onSaved, editRow }) {
  const [saving, setSaving] = useState(false);

  /** Listas */
  const [medios, setMedios] = useState([]);
  const [listaCategorias, setListaCategorias] = useState([]);
  const [listaDescripciones, setListaDescripciones] = useState([]);

  /** Selects + OTRO */
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEsOtra, setCategoriaEsOtra] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");

  const [descripcionId, setDescripcionId] = useState("");
  const [descripcionEsOtra, setDescripcionEsOtra] = useState(false);
  const [descripcionNueva, setDescripcionNueva] = useState("");

  /** Form base (sin denominación) */
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    importe: "",
    id_medio_pago: "",
  });

  const dateRef = useRef(null);

  const loadListas = async () => {
    const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
    const mp = (data?.listas?.medios_pago ?? []).map(m => ({ id: String(m.id), nombre: String(m.nombre || "") }));
    const cats = (data?.listas?.egreso_categorias ?? []).map(c => ({ id: String(c.id), nombre: String(c.nombre || "") }));
    const descs = (data?.listas?.egreso_descripciones ?? []).map(d => ({ id: String(d.id), texto: String(d.texto || "") }));
    setMedios(mp); setListaCategorias(cats); setListaDescripciones(descs);
    setForm(s => ({ ...s, id_medio_pago: s.id_medio_pago || (mp[0]?.id || "") }));
  };

  useEffect(() => {
    if (!open || !editRow) return;

    (async () => {
      try { await loadListas(); }
      catch { setMedios([]); setListaCategorias([]); setListaDescripciones([]); }

      // set form base
      setForm({
        fecha: editRow.fecha || new Date().toISOString().slice(0, 10),
        importe: String(editRow.importe ?? ""),
        id_medio_pago: editRow.id_medio_pago ? String(editRow.id_medio_pago) : "",
      });

      // MEDIO: si no hay id, intentar matchear por nombre
      if (!editRow.id_medio_pago && editRow.medio) {
        const busc = U(String(editRow.medio || "").trim());
        const found = (medios || []).find(m => U(m.nombre) === busc);
        if (found) { setForm(s => ({ ...s, id_medio_pago: String(found.id) })); setMedioEsOtro(false); setMedioNuevo(""); }
        else { setForm(s => ({ ...s, id_medio_pago: "" })); setMedioEsOtro(true); setMedioNuevo(busc); }
      } else {
        setMedioEsOtro(false); setMedioNuevo("");
      }

      // CATEGORÍA: tomamos la que viene en "denominacion" de la DB (reemplazo)
      const catTxt = U(String(editRow.denominacion || "").trim());
      if (catTxt) {
        const f = (listaCategorias || []).find(c => U(c.nombre) === catTxt);
        if (f) { setCategoriaId(String(f.id)); setCategoriaEsOtra(false); setCategoriaNueva(""); }
        else { setCategoriaId(""); setCategoriaEsOtra(true); setCategoriaNueva(catTxt); }
      } else { setCategoriaId(""); setCategoriaEsOtra(false); setCategoriaNueva(""); }

      // DESCRIPCIÓN: texto → match u OTRO
      const descTxt = U(String(editRow.descripcion || "").trim());
      if (descTxt) {
        const f = (listaDescripciones || []).find(d => U(d.texto) === descTxt);
        if (f) { setDescripcionId(String(f.id)); setDescripcionEsOtra(false); setDescripcionNueva(""); }
        else { setDescripcionId(""); setDescripcionEsOtra(true); setDescripcionNueva(descTxt); }
      } else { setDescripcionId(""); setDescripcionEsOtra(false); setDescripcionNueva(""); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRow]);

  /** Handlers */
  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = v.replace(/[^\d.,]/g, "");
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
  const onChangeDescripcion = (val) => {
    if (val === VALOR_OTRO) { setDescripcionEsOtra(true); setDescripcionId(""); }
    else { setDescripcionEsOtra(false); setDescripcionId(val); setDescripcionNueva(""); }
  };

  /** Crear al vuelo */
  const crearMedioPago = async (nombre) => {
    const nombreOK = U(String(nombre || "").trim());
    if (!nombreOK) throw new Error("INGRESÁ EL NUEVO MEDIO DE PAGO.");
    if (nombreOK.length > 100) throw new Error("EL MEDIO DE PAGO NO PUEDE SUPERAR 100 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear el medio.");

    await loadListas();
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearCategoria = async (nombre) => {
    const nombreOK = U(String(nombre || "").trim());
    if (!nombreOK) throw new Error("INGRESÁ LA NUEVA CATEGORÍA.");
    if (nombreOK.length > 100) throw new Error("LA CATEGORÍA NO PUEDE SUPERAR 100 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_categoria`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la categoría.");

    await loadListas();
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const crearDescripcion = async (texto) => {
    const textoOK = U(String(texto || "").trim());
    if (!textoOK) throw new Error("INGRESÁ LA NUEVA DESCRIPCIÓN.");
    if (textoOK.length > 150) throw new Error("LA DESCRIPCIÓN NO PUEDE SUPERAR 150 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=agregar_descripcion`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear la descripción.");

    await loadListas();
    return { id: String(r.id), texto: r.texto || textoOK };
  };

  /** Submit */
  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving || !editRow?.id_ingreso) return;

    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.fecha) { alert("Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { alert("Ingresá un importe válido."); return; }
    if (!medioEsOtro && !String(form.id_medio_pago || "").trim()) { alert("Seleccioná un medio de pago."); return; }
    if (categoriaEsOtra && !String(categoriaNueva || "").trim()) { alert("Ingresá la nueva categoría."); return; }
    if (descripcionEsOtra && !String(descripcionNueva || "").trim()) { alert("Ingresá la nueva descripción."); return; }

    try {
      setSaving(true);

      // Medio
      let medioIdFinal = form.id_medio_pago;
      if (medioEsOtro) {
        const nuevo = await crearMedioPago(medioNuevo);
        medioIdFinal = nuevo.id;
      }

      // Categoría -> "denominacion" en DB
      let categoriaTexto = "";
      if (categoriaEsOtra) {
        const nueva = await crearCategoria(categoriaNueva);
        categoriaTexto = U(nueva.nombre || categoriaNueva);
        setCategoriaId(nueva.id);
        setCategoriaEsOtra(false);
        setCategoriaNueva("");
      } else {
        categoriaTexto = U(listaCategorias.find(c => c.id === String(categoriaId))?.nombre || "SIN CATEGORÍA");
      }
      if (!categoriaTexto) categoriaTexto = "SIN CATEGORÍA";

      // Descripción
      let descripcionTexto = "";
      if (descripcionEsOtra) {
        const nueva = await crearDescripcion(descripcionNueva);
        descripcionTexto = U(nueva.texto || descripcionNueva);
        setDescripcionId(nueva.id);
        setDescripcionEsOtra(false);
        setDescripcionNueva("");
      } else {
        descripcionTexto = U(listaDescripciones.find(d => d.id === String(descripcionId))?.texto || "");
      }

      const payload = {
        id_ingreso: Number(editRow.id_ingreso),
        fecha: form.fecha,
        // **reemplazo**: guardar categoría en campo denominacion
        denominacion: categoriaTexto,
        descripcion: descripcionTexto,
        importe: importeNumber,
        id_medio_pago: Number(medioIdFinal),
      };

      const res = await fetch(`${BASE_URL}/api.php?action=editar_ingresos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.exito) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);

      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !editRow) return null;

  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingEditarTitle">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const el = dateRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") { try { el.showPicker(); return; } catch {} }
                    el.focus(); el.click();
                  }
                }}
                role="button" tabIndex={0} aria-label="Abrir selector de fecha"
              >
                <span className="i"><FontAwesomeIcon icon={faCalendarDays} /></span>
                <input
                  ref={dateRef} type="date" value={form.fecha}
                  onChange={onChange("fecha")}
                  onMouseDown={(e) => { if (dateRef.current?.showPicker) e.preventDefault(); }}
                />
              </div>
            </div>

            {/* Medio (select + OTRO) */}
            <div className="field field--icon">
              <label>Medio de pago</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faCreditCard} /></span>
                <select
                  value={medioEsOtro ? VALOR_OTRO : form.id_medio_pago}
                  onChange={(e) => onChangeMedio(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required={!medioEsOtro}
                  aria-invalid={!medioEsOtro && !String(form.id_medio_pago || "").trim() ? true : undefined}
                >
                  <option value="">SELECCIONE…</option>
                  {medios.map(mp => (<option key={mp.id} value={mp.id}>{U(mp.nombre)}</option>))}
                  <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                </select>
              </div>
            </div>
          </div>

          {medioEsOtro && (
            <div className="field field--icon">
              <label>Nuevo medio de pago</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faCreditCard} /></span>
                <input type="text" value={medioNuevo} onChange={(e)=>setMedioNuevo(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Categoría (reemplaza denominación) */}
          <div className="field field--icon">
            <label>Categoría</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faTags} /></span>
              <select
                value={categoriaEsOtra ? VALOR_OTRO : categoriaId}
                onChange={(e)=>onChangeCategoria(e.target.value)}
              >
                <option value="">(SIN CATEGORÍA)</option>
                {listaCategorias.map(c => (<option key={c.id} value={c.id}>{U(c.nombre)}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
            </div>
          </div>

          {categoriaEsOtra && (
            <div className="field field--icon">
              <label>Nueva categoría</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faTags} /></span>
                <input type="text" value={categoriaNueva} onChange={(e)=>setCategoriaNueva(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="field field--icon">
            <label>Descripción</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faFileLines} /></span>
              <select
                value={descripcionEsOtra ? VALOR_OTRO : descripcionId}
                onChange={(e)=>onChangeDescripcion(e.target.value)}
              >
                <option value="">(SIN DESCRIPCIÓN)</option>
                {listaDescripciones.map(d => (<option key={d.id} value={d.id}>{U(d.texto)}</option>))}
                <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
              </select>
            </div>
          </div>

          {descripcionEsOtra && (
            <div className="field field--icon">
              <label>Nueva descripción</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faFileLines} /></span>
                <input type="text" value={descripcionNueva} onChange={(e)=>setDescripcionNueva(U(e.target.value))} required />
              </div>
            </div>
          )}

          {/* Importe */}
          <div className="field field--icon">
            <label>Importe (ARS)</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faDollarSign} /></span>
              <input inputMode="decimal" placeholder="0" value={form.importe} onChange={onChange("importe")} />
            </div>
          </div>

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
