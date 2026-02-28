// src/components/Categorias/CategoriaEditar.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave, faPlus, faTrash, faTimes } from '@fortawesome/free-solid-svg-icons';
import './CategoriaEditar.css';

const CategoriaEditar = () => {
  const navigate = useNavigate();
  const params = useParams();

  // ✅ FIX: aseguramos id numérico válido
  const idStr = params?.id ?? '';
  const idNum = Number(idStr);
  const idValido = Number.isFinite(idNum) && idNum > 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [mMensual, setMMensual] = useState('');
  const [mAnual, setMAnual] = useState('');

  // Hermanos dinámico: [{id_cat_hermanos?, cantidad_hermanos, monto_mensual, monto_anual}]
  const [hermanos, setHermanos] = useState([]);
  const [nuevoCant, setNuevoCant] = useState('2');

  const original = useRef({
    mensual: null,
    anual: null,
    hermanos: [],
  });

  const mensualRef = useRef(null);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta no JSON (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const numOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const sortByCant = (arr) => [...arr].sort((a, b) => Number(a.cantidad_hermanos) - Number(b.cantidad_hermanos));

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);

        if (!idValido) {
          throw new Error('ID inválido en la URL. Revisá la ruta: /categorias/editar/:id');
        }

        // 1) base
        const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
        const filas = Array.isArray(json)
          ? json
          : (json?.categorias ?? json?.data ?? json?.rows ?? json?.result ?? json?.resultados ?? []);

        const lista = filas.map((r) => ({
          id: r.id ?? r.id_cat_monto ?? r.id_categoria,
          descripcion: String(r.descripcion ?? r.nombre_categoria ?? ''),
          monto_mensual: Number(r.monto ?? r.monto_mensual ?? 0),
          monto_anual: Number(r.monto_anual ?? 0),
        }));

        const cat = lista.find((x) => String(x.id) === String(idNum));
        if (!cat) throw new Error('Categoría no encontrada');

        setNombre(cat.descripcion);
        setMMensual(String(cat.monto_mensual ?? ''));
        setMAnual(String(cat.monto_anual ?? ''));

        // 2) hermanos
        const urlH = `${BASE_URL}/api.php?action=cat_hermanos_listar&id_cat_monto=${encodeURIComponent(String(idNum))}`;
        const hjson = await fetchJSON(urlH);
        const items = Array.isArray(hjson?.items) ? hjson.items : [];

        const mapped = items.map((x) => ({
          id_cat_hermanos: x.id_cat_hermanos ?? null,
          cantidad_hermanos: Number(x.cantidad_hermanos),
          monto_mensual: String(Number(x.monto_mensual ?? 0)),
          monto_anual: String(Number(x.monto_anual ?? 0)),
        }));

        setHermanos(sortByCant(mapped));

        original.current = {
          mensual: cat.monto_mensual,
          anual: cat.monto_anual,
          hermanos: mapped.map((h) => ({
            id_cat_hermanos: h.id_cat_hermanos,
            cantidad_hermanos: Number(h.cantidad_hermanos),
            monto_mensual: Number(h.monto_mensual),
            monto_anual: Number(h.monto_anual),
          })),
        };

        setTimeout(() => mensualRef.current?.focus(), 0);
      } catch (e) {
        showToast('error', e.message || 'No se pudo cargar la categoría', 3200);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [idStr]); // ✅ depende del string de params

  const hermanosCants = useMemo(() => new Set(hermanos.map((h) => Number(h.cantidad_hermanos))), [hermanos]);

  const agregarFila = () => {
    const cant = Number(nuevoCant);
    if (!Number.isFinite(cant) || cant < 2) {
      showToast('error', 'Cantidad de hermanos inválida (mínimo 2)', 2600);
      return;
    }
    if (hermanosCants.has(cant)) {
      showToast('info', `Ya existe la fila para ${cant} hermanos.`, 2200);
      return;
    }
    setHermanos(
      sortByCant([
        ...hermanos,
        { id_cat_hermanos: null, cantidad_hermanos: cant, monto_mensual: '', monto_anual: '' },
      ])
    );
  };

  const cambiarFila = (idx, key, value) => {
    setHermanos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const borrarFilaDB = async (fila) => {
    if (!fila?.id_cat_hermanos) {
      setHermanos((prev) => prev.filter((h) => h !== fila));
      return;
    }
    try {
      const body = new FormData();
      body.append('id_cat_hermanos', String(fila.id_cat_hermanos));
      const j = await fetchJSON(`${BASE_URL}/api.php?action=cat_hermanos_eliminar`, {
        method: 'POST',
        body,
      });
      if (!j?.exito) throw new Error(j?.mensaje || 'No se pudo eliminar');
      showToast('exito', 'Fila eliminada.', 1800);
      setHermanos((prev) => prev.filter((h) => h.id_cat_hermanos !== fila.id_cat_hermanos));
    } catch (e) {
      showToast('error', e.message || 'Error al eliminar', 3200);
    }
  };

  const normalizarHermanosParaGuardar = () => {
    const out = [];
    for (const h of hermanos) {
      const cant = Number(h.cantidad_hermanos);
      if (!Number.isFinite(cant) || cant < 2) continue;

      const mm = numOrNull(h.monto_mensual);
      const ma = numOrNull(h.monto_anual);

      if (mm === null && ma === null) continue;
      if ((mm !== null && mm < 0) || (ma !== null && ma < 0)) {
        throw new Error(`Montos inválidos en ${cant} hermanos (>= 0).`);
      }
      out.push({ cantidad_hermanos: cant, monto_mensual: mm, monto_anual: ma });
    }
    return out;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!idValido) {
      showToast('error', 'ID inválido en la URL. No se puede guardar.', 3200);
      return;
    }

    const mens = numOrNull(mMensual);
    const anu = numOrNull(mAnual);

    const chk = (n) => n === null || (!Number.isNaN(n) && n >= 0);
    if (!chk(mens)) {
      showToast('error', 'Monto mensual inválido (>= 0)', 2800);
      mensualRef.current?.focus();
      return;
    }
    if (!chk(anu)) {
      showToast('error', 'Monto anual inválido (>= 0)', 2800);
      return;
    }

    let hermanosPayload = [];
    try {
      hermanosPayload = normalizarHermanosParaGuardar();
    } catch (err) {
      showToast('error', err.message || 'Error en montos por hermanos', 3200);
      return;
    }

    const changedBaseMens = mens !== null && mens !== original.current.mensual;
    const changedBaseAnu = anu !== null && anu !== original.current.anual;

    const origMap = new Map(
      original.current.hermanos.map((h) => [
        Number(h.cantidad_hermanos),
        { m: Number(h.monto_mensual), a: Number(h.monto_anual) },
      ])
    );

    let changedH = false;
    for (const hp of hermanosPayload) {
      const o = origMap.get(Number(hp.cantidad_hermanos));
      if (!o) {
        changedH = true;
        break;
      }
      if (
        (hp.monto_mensual !== null && Number(hp.monto_mensual) !== Number(o.m)) ||
        (hp.monto_anual !== null && Number(hp.monto_anual) !== Number(o.a))
      ) {
        changedH = true;
        break;
      }
    }
    if (original.current.hermanos.length > 0 && hermanosPayload.length === 0) changedH = true;

    if (!changedBaseMens && !changedBaseAnu && !changedH) {
      showToast('info', 'No hay cambios para guardar.', 2200);
      return;
    }

    const body = new FormData();
    body.append('id', String(idNum));
    if (changedBaseMens) body.append('monto', String(mens));
    if (changedBaseAnu) body.append('monto_anual', String(anu));
    if (changedBaseMens) body.append('precio', String(mens)); // compat
    if (changedH) body.append('hermanos', JSON.stringify(hermanosPayload));

    try {
      setSaving(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_actualizar`, {
        method: 'POST',
        body,
      });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo actualizar');

      const dur = 1600;
      showToast('exito', 'Cambios guardados.', dur);
      setTimeout(() => navigate('/categorias', { replace: true }), dur);
    } catch (e2) {
      showToast('error', e2.message || 'Error al actualizar la categoría', 3200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cat_edi_page">
      <div className="cat_edi_modal" role="dialog" aria-modal="true">
        

<div className="cat_edi_topbar">
  <div className="cat_edi_headLeft">
    <h1 className="cat_edi_title">Editar categoría</h1>
  </div>

  <button
    type="button"
    className="cat_edi_close"
    onClick={() => navigate('/categorias')}
    disabled={saving}
    aria-label="Cerrar"
    title="Cerrar"
  >
    <FontAwesomeIcon icon={faTimes} />
  </button>
</div>

        <div className="cat_edi_divider" />

        {loading ? (
          <div className="cat_edi_loading">Cargando…</div>
        ) : (
          <form className="cat_edi_form" onSubmit={onSubmit}>
            <div className="cat_edi_grid">
              {/* PANEL IZQ: Datos base */}
              <section className="cat_edi_panel">
                <div className="cat_edi_panelHead">
                  <div className="cat_edi_panelTitle">Datos base</div>
                  <div className="cat_edi_panelDesc">Nombre no editable + montos principales</div>
                </div>

                <div className="cat_edi_panelBody">
                  <div className="cat_edi_form_row">
                    <label className="cat_edi_label">Nombre (no editable)</label>
                    <input
                      className="cat_edi_input"
                      value={nombre}
                      disabled
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>

                  <div className="cat_edi_two_col">
                    <div className="cat_edi_form_row">
                      <label className="cat_edi_label">Monto mensual</label>
                      <input
                        ref={mensualRef}
                        className="cat_edi_input"
                        type="number"
                        inputMode="numeric"
                        value={mMensual}
                        onChange={(e) => setMMensual(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        disabled={saving}
                      />
                    </div>

                    <div className="cat_edi_form_row">
                      <label className="cat_edi_label">Monto anual</label>
                      <input
                        className="cat_edi_input"
                        type="number"
                        inputMode="numeric"
                        value={mAnual}
                        onChange={(e) => setMAnual(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="cat_edi_tip">
                    Tip: si querés “sin anual”, dejalo vacío o 0 según tu lógica del backend.
                  </div>
                </div>
              </section>

              {/* PANEL DER: Grupo familiar */}
              <section className="cat_edi_panel">
                <div className="cat_edi_panelHead">
                  <div className="cat_edi_panelTitle">Grupo familiar</div>
                  <div className="cat_edi_panelDesc">Montos por cantidad de hermanos</div>
                </div>

                <div className="cat_edi_panelBody">
                  <div className="cat_edi_addBox">
                    <div className="cat_edi_form_row" style={{ marginBottom: 0 }}>
                      <label className="cat_edi_label">Cantidad</label>
                      <input
                        className="cat_edi_input"
                        type="number"
                        min="2"
                        step="1"
                        value={nuevoCant}
                        onChange={(e) => setNuevoCant(e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <button
                      type="button"
                      className="cat_edi_btn cat_edi_btn_add"
                      onClick={agregarFila}
                      disabled={saving}
                      title="Agregar fila"
                    >
                      <FontAwesomeIcon icon={faPlus} /> Agregar fila
                    </button>
                  </div>

                  {hermanos.length === 0 ? (
                    <div className="cat_edi_hint">No hay montos por hermanos configurados para esta categoría.</div>
                  ) : (
                    <div className="cat_edi_cardsGrid">
                      {hermanos.map((h, idx) => (
                        <article
                          key={`${h.id_cat_hermanos ?? 'new'}_${h.cantidad_hermanos}`}
                          className="cat_edi_hCard"
                        >
                          <div className="cat_edi_hHead">
                            <div className="cat_edi_badge">{h.cantidad_hermanos}</div>
                            <div className="cat_edi_hTitle">
                              <span className="cat_edi_hTitleStrong">{h.cantidad_hermanos}</span> hermanos
                            </div>

                            <button
                              type="button"
                              className="cat_edi_btn_icon"
                              onClick={() => borrarFilaDB(h)}
                              disabled={saving}
                              title="Eliminar"
                              aria-label="Eliminar"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>

                          <div className="cat_edi_two_col">
                            <div className="cat_edi_form_row">
                              <label className="cat_edi_label">Mensual</label>
                              <input
                                className="cat_edi_input"
                                type="number"
                                min="0"
                                step="1"
                                value={h.monto_mensual}
                                onChange={(e) => cambiarFila(idx, 'monto_mensual', e.target.value)}
                                disabled={saving}
                              />
                            </div>

                            <div className="cat_edi_form_row">
                              <label className="cat_edi_label">Anual</label>
                              <input
                                className="cat_edi_input"
                                type="number"
                                min="0"
                                step="1"
                                value={h.monto_anual}
                                onChange={(e) => cambiarFila(idx, 'monto_anual', e.target.value)}
                                disabled={saving}
                              />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Acciones abajo estilo captura */}
            <div className="cat_edi_actionsBar">
              <button
                type="button"
                className="cat_edi_btn cat_edi_btn_back"
                onClick={() => navigate('/categorias')}
                disabled={saving}
              >
                <FontAwesomeIcon icon={faArrowLeft} /> Volver
              </button>

              <button type="submit" className="cat_edi_btn cat_edi_btn_save" disabled={saving}>
                <FontAwesomeIcon icon={faSave} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={closeToast} />}
      </div>
    </div>
  );
};

export default CategoriaEditar;