// src/components/Contable/modalcontable/IngresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays, faCreditCard, faUser, faFileLines, faDollarSign, faFloppyDisk, faPen, faPlus
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config";
import "../IngresosContable.css";

/** Util */
const U = (v = "") => String(v).toUpperCase();
const VALOR_OTRO = "__OTRO__";

async function fetchJSON(url, options) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.mensaje || `HTTP ${res.status}`);
  return data;
}

/* ============ Modal Crear Ingreso (incluye "OTRO" medio de pago) ============ */
export function IngresoCrearModal({ open, onClose, onSaved, defaultDate }) {
  const [saving, setSaving] = useState(false);
  const [medios, setMedios] = useState([]);
  const [medioEsOtro, setMedioEsOtro] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState("");

  const [form, setForm] = useState({
    fecha: defaultDate || new Date().toISOString().slice(0,10),
    denominacion: "",
    descripcion: "",
    importe: "",
    id_medio_pago: "",
  });

  const dateRef = useRef(null);

  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      const arr = (data?.listas?.medios_pago ?? []).map((m) => ({
        id: String(m.id),
        nombre: String(m.nombre || ""),
      }));
      setMedios(arr);
      setForm((s) => ({ ...s, id_medio_pago: arr?.[0]?.id || "" }));
    } catch {
      setMedios([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadMediosPago();
    setForm({
      fecha: defaultDate || new Date().toISOString().slice(0,10),
      denominacion: "",
      descripcion: "",
      importe: "",
      id_medio_pago: "",
    });
    setMedioEsOtro(false);
    setMedioNuevo("");
  }, [open, defaultDate]);

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = v.replace(/[^\d.,]/g, "");
    else v = U(v);
    setForm((s) => ({ ...s, [k]: v }));
  };
  const onBlurUpper = (k) => (e) => {
    if (k === "importe") return;
    setForm((s) => ({ ...s, [k]: U(e.target.value) }));
  };

  const onChangeMedio = (val) => {
    if (val === VALOR_OTRO) {
      setMedioEsOtro(true);
      setMedioNuevo("");
      setForm((s) => ({ ...s, id_medio_pago: "" }));
    } else {
      setMedioEsOtro(false);
      setMedioNuevo("");
      setForm((s) => ({ ...s, id_medio_pago: String(val) }));
    }
  };

  const crearMedioPago = async (nombre) => {
    const nombreOK = U(String(nombre || "").trim());
    if (!nombreOK) throw new Error("INGRESÁ EL NUEVO MEDIO DE PAGO.");
    if (nombreOK.length > 100) throw new Error("EL MEDIO DE PAGO NO PUEDE SUPERAR 100 CARACTERES.");

    const r = await fetchJSON(`${BASE_URL}/api.php?action=medio_pago_crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreOK }),
    });
    if (!r?.exito || !r.id) throw new Error(r?.mensaje || "No se pudo crear el medio.");
    return { id: String(r.id), nombre: r.nombre || nombreOK };
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.denominacion.trim()) { alert("Ingresá una denominación."); return; }
    if (!form.fecha) { alert("Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { alert("Ingresá un importe válido."); return; }

    try {
      setSaving(true);

      // crear medio si se eligió OTRO
      let medioIdFinal = form.id_medio_pago;
      if (medioEsOtro) {
        if (!String(medioNuevo || "").trim()) { alert("Escribí el nuevo medio de pago."); setSaving(false); return; }
        const nuevo = await crearMedioPago(medioNuevo);
        const arr = await loadMediosPago(); // refresca lista
        medioIdFinal = String(nuevo.id);
        // setMedios ya ocurrió arriba; form:
        setForm((s) => ({ ...s, id_medio_pago: medioIdFinal }));
      } else {
        if (!String(medioIdFinal || "").trim()) { alert("Seleccioná un medio de pago."); setSaving(false); return; }
      }

      const payload = {
        fecha: form.fecha,
        denominacion: U(form.denominacion.trim()),
        descripcion: U(form.descripcion.trim()),
        importe: importeNumber,
        id_medio_pago: Number(medioIdFinal),
      };

      const res = await fetch(`${BASE_URL}/api.php?action=ingresos_create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            <div className="ing-modal__badge">
              <FontAwesomeIcon icon={faPlus} />
            </div>
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
                  if (typeof el.showPicker === "function") {
                    try { el.showPicker(); return; } catch {}
                  }
                  el.focus(); el.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const el = dateRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") {
                      try { el.showPicker(); return; } catch {}
                    }
                    el.focus(); el.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Abrir selector de fecha"
              >
                <span className="i">
                  <FontAwesomeIcon icon={faCalendarDays} />
                </span>
                <input
                  ref={dateRef}
                  type="date"
                  value={form.fecha}
                  onChange={onChange("fecha")}
                  onMouseDown={(e) => { if (dateRef.current?.showPicker) e.preventDefault(); }}
                />
              </div>
            </div>

            {/* Medio de pago con OTRO */}
            <div className="field field--icon">
              <label>Medio de pago</label>
              <div className="control">
                <span className="i">
                  <FontAwesomeIcon icon={faCreditCard} />
                </span>
                <select
                  value={medioEsOtro ? VALOR_OTRO : form.id_medio_pago}
                  onChange={(e) => onChangeMedio(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required={!medioEsOtro}
                  aria-invalid={!medioEsOtro && !String(form.id_medio_pago || "").trim() ? true : undefined}
                >
                  {Array.isArray(medios) && medios.length ? (
                    <>
                      <option value="">SELECCIONE…</option>
                      {medios.map(mp => (
                        <option key={mp.id} value={mp.id}>
                          {String(mp.nombre || "").toUpperCase()}
                        </option>
                      ))}
                      <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                    </>
                  ) : (
                    <>
                      <option value="">(SIN MEDIOS)</option>
                      <option value={VALOR_OTRO}>OTRO (AGREGAR…)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {medioEsOtro && (
            <div className="field field--icon">
              <label>Nuevo medio de pago</label>
              <div className="control">
                <span className="i">
                  <FontAwesomeIcon icon={faCreditCard} />
                </span>
                <input
                  type="text"
                  placeholder="Ej: TRANSFERENCIA BNA"
                  value={medioNuevo}
                  onChange={(e) => setMedioNuevo(U(e.target.value))}
                  required
                />
              </div>
            </div>
          )}

          <div className="field field--icon">
            <label>Denominación</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faUser} />
              </span>
              <input
                type="text"
                placeholder="Ej: GAMBOGGI ALEXANDER"
                value={form.denominacion}
                onChange={onChange("denominacion")}
                onBlur={onBlurUpper("denominacion")}
                autoCapitalize="characters"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>

          <div className="field field--icon">
            <label>Descripción</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faFileLines} />
              </span>
              <input
                type="text"
                placeholder="Ej: INTERNADO, ALQ. CARTEL"
                value={form.descripcion}
                onChange={onChange("descripcion")}
                onBlur={onBlurUpper("descripcion")}
                autoCapitalize="characters"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>

          <div className="field field--icon">
            <label>Importe (ARS)</label>
            <div className="control">
              <span className="i">
                <FontAwesomeIcon icon={faDollarSign} />
              </span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={form.importe}
                onChange={onChange("importe")}
              />
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

/* ============ Modal Editar Ingreso (sin "OTRO" en medios) ============ */
export function IngresoEditarModal({ open, onClose, onSaved, editRow }) {
  const [saving, setSaving] = useState(false);
  const [medios, setMedios] = useState([]);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0,10),
    denominacion: "",
    descripcion: "",
    importe: "",
    id_medio_pago: "",
  });
  const dateRef = useRef(null);

  const loadMediosPago = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api.php?action=obtener_listas`);
      const arr = (data?.listas?.medios_pago ?? []).map((m) => ({
        id: String(m.id),
        nombre: String(m.nombre || ""),
      }));
      setMedios(arr);
      // si no hay id en form, setear primero
      setForm((s) => ({ ...s, id_medio_pago: s.id_medio_pago || (arr?.[0]?.id || "") }));
    } catch {
      setMedios([]);
    }
  };

  // Cargar medios y setear form en cada apertura/row
  useEffect(() => {
    if (!open || !editRow) return;
    loadMediosPago();
    setForm({
      fecha: editRow.fecha || new Date().toISOString().slice(0,10),
      denominacion: U(editRow.denominacion || ""),
      descripcion: U(editRow.descripcion || ""),
      importe: String(editRow.importe ?? ""),
      id_medio_pago: editRow.id_medio_pago ? String(editRow.id_medio_pago) : "",
    });
  }, [open, editRow]);

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "importe") v = v.replace(/[^\d.,]/g, "");
    else v = U(v);
    setForm((s) => ({ ...s, [k]: v }));
  };
  const onBlurUpper = (k) => (e) => {
    if (k === "importe") return;
    setForm((s) => ({ ...s, [k]: U(e.target.value) }));
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;

    if (!editRow?.id_ingreso) return;
    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.denominacion.trim()) { alert("Ingresá una denominación."); return; }
    if (!form.fecha) { alert("Seleccioná la fecha."); return; }
    if (!importeNumber || importeNumber <= 0) { alert("Ingresá un importe válido."); return; }
    if (!form.id_medio_pago) { alert("Seleccioná un medio de pago."); return; }

    try {
      setSaving(true);
      const payload = {
        id_ingreso: Number(editRow.id_ingreso),
        fecha: form.fecha,
        denominacion: U(form.denominacion.trim()),
        descripcion: U(form.descripcion.trim()),
        importe: importeNumber,
        id_medio_pago: Number(form.id_medio_pago),
      };

      const res = await fetch(`${BASE_URL}/api.php?action=editar_ingresos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            <div className="field field--icon field--date">
              <label>Fecha</label>
              <div
                className="control control--clickable"
                onMouseDown={(e) => {
                  if (e.target !== dateRef.current) e.preventDefault();
                  const el = dateRef.current;
                  if (!el) return;
                  if (typeof el.showPicker === "function") {
                    try { el.showPicker(); return; } catch {}
                  }
                  el.focus(); el.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const el = dateRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") {
                      try { el.showPicker(); return; } catch {}
                    }
                    el.focus(); el.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Abrir selector de fecha"
              >
                <span className="i"><FontAwesomeIcon icon={faCalendarDays} /></span>
                <input
                  ref={dateRef}
                  type="date"
                  value={form.fecha}
                  onChange={onChange("fecha")}
                  onMouseDown={(e) => { if (dateRef.current?.showPicker) e.preventDefault(); }}
                />
              </div>
            </div>

            <div className="field field--icon">
              <label>Medio de pago</label>
              <div className="control">
                <span className="i"><FontAwesomeIcon icon={faCreditCard} /></span>
                <select
                  value={form.id_medio_pago}
                  onChange={onChange("id_medio_pago")}
                  style={{ textTransform: "uppercase" }}
                >
                  {Array.isArray(medios) && medios.length
                    ? medios.map(mp => <option key={mp.id} value={mp.id}>{String(mp.nombre || "").toUpperCase()}</option>)
                    : <option value="">(SIN MEDIOS)</option>}
                </select>
              </div>
            </div>
          </div>

          <div className="field field--icon">
            <label>Denominación</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faUser} /></span>
              <input
                type="text"
                value={form.denominacion}
                onChange={onChange("denominacion")}
                onBlur={onBlurUpper("denominacion")}
                autoCapitalize="characters"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>

          <div className="field field--icon">
            <label>Descripción</label>
            <div className="control">
              <span className="i"><FontAwesomeIcon icon={faFileLines} /></span>
              <input
                type="text"
                value={form.descripcion}
                onChange={onChange("descripcion")}
                onBlur={onBlurUpper("descripcion")}
                autoCapitalize="characters"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>

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
