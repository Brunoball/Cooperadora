// src/components/Categorias/CategoriaNueva.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
import './CategoriaNueva.css';

const normalizar = (s) => (s || '').toString().trim().toUpperCase();

const CategoriaNueva = () => {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [mMensual, setMMensual] = useState('');
  const [mAnual, setMAnual] = useState('');
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const nombreRef = useRef(null);
  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); } catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const n = normalizar(nombre);
    if (!n) {
      showToast('error', 'El nombre de la categoría es obligatorio', 2800);
      nombreRef.current?.focus();
      return;
    }

    const mens = mMensual === '' ? 0 : Number(mMensual);
    const anu  = mAnual   === '' ? 0 : Number(mAnual);

    if (isNaN(mens) || mens < 0) { showToast('error', 'Mensual inválido (>= 0)', 2800); return; }
    if (isNaN(anu)  || anu  < 0) { showToast('error', 'Anual inválido (>= 0)', 2800); return; }

    try {
      setSaving(true);
      const body = new FormData();
      body.append('descripcion', n);
      body.append('monto', String(mens));
      body.append('monto_anual', String(anu));
      // compat
      body.append('precio', String(mens));

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_crear`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo crear');

      const dur = 2000;
      showToast('exito', 'Categoría creada con éxito.', dur);
      setTimeout(() => navigate('/categorias', { replace: true }), dur);
    } catch (e) {
      showToast('error', e.message || 'Error al crear la categoría', 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cat_agr_page">
      <div className="cat_agr_card">
        <header className="cat_agr_header"><h2 className="cat_agr_title">Nueva categoría</h2></header>

        <form className="cat_agr_form" onSubmit={onSubmit}>
          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Nombre</label>
            <input
              ref={nombreRef}
              className="cat_agr_input"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder='Ej: "A"'
              maxLength={50}
              required
              style={{ textTransform: 'uppercase' }}
              disabled={saving}
            />
          </div>

          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Monto mensual</label>
            <input
              className="cat_agr_input"
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

          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Monto anual</label>
            <input
              className="cat_agr_input"
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

          <div className="cat_agr_form_actions">
            <button type="button" className="cat_agr_btn cat_agr_btn_back" onClick={() => navigate('/categorias')} disabled={saving}>
              <FontAwesomeIcon icon={faArrowLeft} /><span className="cat_agr_btn_text">Volver</span>
            </button>
            <button type="submit" className="cat_agr_btn cat_agr_btn_primary" disabled={saving}>
              <FontAwesomeIcon icon={faPlus} /><span className="cat_agr_btn_text">{saving ? 'Guardando…' : 'Guardar'}</span>
            </button>
          </div>
        </form>
      </div>

      {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={closeToast} />}
    </div>
  );
};

export default CategoriaNueva;
