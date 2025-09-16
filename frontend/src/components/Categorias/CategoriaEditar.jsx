// src/components/Categorias/CategoriaEditar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import './CategoriaEditar.css';

const CategoriaEditar = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [mMensual, setMMensual] = useState('');
  const [mAnual, setMAnual] = useState('');

  // valores originales para saber si hubo cambio (dirty)
  const original = useRef({ mensual: null, anual: null });
  const mensualRef = useRef(null);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); } catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
        const filas = Array.isArray(json) ? json
          : (json?.categorias ?? json?.data ?? json?.rows ?? json?.result ?? json?.resultados ?? []);
        const lista = filas.map((r) => ({
          id: r.id ?? r.id_cat_monto ?? r.id_categoria,
          descripcion: String(r.descripcion ?? r.nombre_categoria ?? ''),
          monto_mensual: Number(r.monto ?? r.monto_mensual ?? 0),
          monto_anual: Number(r.monto_anual ?? 0),
        }));
        const cat = lista.find((x) => String(x.id) === String(id));
        if (!cat) throw new Error('Categoría no encontrada');

        setNombre(cat.descripcion);
        setMMensual(String(cat.monto_mensual ?? ''));
        setMAnual(String(cat.monto_anual ?? ''));
        original.current = { mensual: cat.monto_mensual, anual: cat.monto_anual };

        setTimeout(() => mensualRef.current?.focus(), 0);
      } catch (e) {
        showToast('error', e.message || 'No se pudo cargar la categoría', 3200);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const mens = mMensual === '' ? null : Number(mMensual);
    const anu  = mAnual === '' ? null : Number(mAnual);

    if (mens !== null && (isNaN(mens) || mens < 0)) {
      showToast('error', 'Monto mensual inválido (>= 0)', 2800);
      mensualRef.current?.focus();
      return;
    }
    if (anu !== null && (isNaN(anu) || anu < 0)) {
      showToast('error', 'Monto anual inválido (>= 0)', 2800);
      return;
    }

    // Enviar SOLO lo que cambió
    const body = new FormData();
    body.append('id', String(id));

    const changedMensual = (mens !== null) && (mens !== original.current.mensual);
    const changedAnual   = (anu  !== null) && (anu  !== original.current.anual);

    if (!changedMensual && !changedAnual) {
      showToast('info', 'No hay cambios para guardar.', 2200);
      return;
    }
    if (changedMensual) body.append('monto', String(mens));           // mensual
    if (changedAnual)   body.append('monto_anual', String(anu));      // anual
    // compat
    if (changedMensual) body.append('precio', String(mens));

    try {
      setSaving(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_actualizar`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo actualizar');

      const dur = 1800;
      showToast('exito', 'Cambios guardados.', dur);
      setTimeout(() => navigate('/categorias', { replace: true }), dur);
    } catch (e) {
      showToast('error', e.message || 'Error al actualizar la categoría', 3200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cat_edi_page">
      <div className="cat_edi_card">
        <header className="cat_edi_header"><h2 className="cat_edi_title">Editar categoría</h2></header>

        {loading ? (
          <div className="cat_edi_loading">Cargando…</div>
        ) : (
          <form className="cat_edi_form" onSubmit={onSubmit}>
            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Nombre (no editable)</label>
              <input className="cat_edi_input" value={nombre} disabled style={{ textTransform: 'uppercase' }} />
            </div>

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

            <div className="cat_edi_form_actions">
              <button type="button" className="cat_edi_btn cat_edi_btn_back" onClick={() => navigate('/categorias')} disabled={saving}>
                <FontAwesomeIcon icon={faArrowLeft} /><span className="cat_edi_btn_text">Volver</span>
              </button>

              <button type="submit" className="cat_edi_btn cat_edi_btn_primary" disabled={saving}>
                <FontAwesomeIcon icon={faSave} /><span className="cat_edi_btn_text">{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
      {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={closeToast} />}
    </div>
  );
};

export default CategoriaEditar;
