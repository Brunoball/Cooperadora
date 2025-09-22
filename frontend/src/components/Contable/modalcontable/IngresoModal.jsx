// src/components/Contable/modalcontable/IngresoModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays, faCreditCard, faUser, faFileLines, faDollarSign, faFloppyDisk, faPen
} from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config";
import "../IngresosContable.css";

export default function IngresoModal({ open, onClose, onSaved, medios, editRow }) {
  const U = (v = "") => String(v).toUpperCase(); // helper

  // Hooks al tope (sin early return)
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: (editRow?.fecha) || new Date().toISOString().slice(0,10),
    denominacion: U(editRow?.denominacion || ""),
    descripcion: U(editRow?.descripcion || ""),
    importe: String(editRow?.importe ?? ""),
    id_medio_pago: editRow?.id_medio_pago ? String(editRow.id_medio_pago) : (medios?.[0]?.id || ""),
  });

  const dateRef = useRef(null);

  useEffect(() => {
    if (!editRow) return;
    setForm({
      fecha: editRow.fecha || new Date().toISOString().slice(0,10),
      denominacion: U(editRow.denominacion || ""),
      descripcion: U(editRow.descripcion || ""),
      importe: String(editRow.importe ?? ""),
      id_medio_pago: editRow.id_medio_pago ? String(editRow.id_medio_pago) : (medios?.[0]?.id || ""),
    });
  }, [editRow, medios]);

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

    const importeNumber = Number(String(form.importe).replace(/\./g, "").replace(",", "."));
    if (!form.denominacion.trim()) return alert("Ingresá una denominación.");
    if (!form.fecha) return alert("Seleccioná la fecha.");
    if (!importeNumber || importeNumber <= 0) return alert("Ingresá un importe válido.");
    if (!form.id_medio_pago) return alert("Seleccioná un medio de pago.");

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

      onSaved?.(); // ✅ el padre muestra el toast
      onClose?.();
    } catch (err) {
      alert(`No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // cortar render si no corresponde mostrar el modal
  if (!open || !editRow) return null;

  return (
    <div className="ing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ingModalTitle">
      <div className="ing-modal ing-modal--elev">
        <div className="ing-modal__head gradient--brand-red">
          <div className="ing-modal__title">
            <div className="ing-modal__badge"><FontAwesomeIcon icon={faPen} /></div>
            <h3 id="ingModalTitle">Editar ingreso</h3>
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
