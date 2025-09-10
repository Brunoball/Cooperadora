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
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);

  // TOAST
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const nombreRef = useRef(null);
  const montoRef = useRef(null);

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); }
    catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const n = normalizar(nombre);
    const mStr = (monto ?? '').toString().trim();
    const m = mStr === '' ? 0 : Number(mStr);

    if (!n) {
      showToast('error', 'El nombre de la categoría es obligatorio', 2800);
      nombreRef.current?.focus();
      return;
    }
    if (isNaN(m) || m < 0) {
      showToast('error', 'El monto debe ser un número mayor o igual a 0', 2800);
      montoRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      const body = new FormData();
      body.append('descripcion', n);
      body.append('monto', String(m));
      body.append('precio', String(m)); // compat con backend actual

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_crear`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo crear');

      const dur = 2200;
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
        <header className="cat_agr_header">
          <h2 className="cat_agr_title">Nueva categoría</h2>
        </header>

        <form className="cat_agr_form" onSubmit={onSubmit}>
          {/* Nombre (sin asterisco visual, sigue siendo required) */}
          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Nombre</label>
            <input
              ref={nombreRef}
              className="cat_agr_input"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder='Ej: "INTERNO"'
              maxLength={50}
              required
              style={{ textTransform: 'uppercase' }}
              disabled={saving}
            />
          </div>

          {/* Monto — mismo ancho que Nombre */}
          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Monto</label>
            <input
              ref={montoRef}
              className="cat_agr_input"
              type="number"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              disabled={saving}
            />
          </div>

          {/* Acciones: Volver (izquierda) + Guardar (derecha) */}
          <div className="cat_agr_form_actions">
            <button
              type="button"
              className="cat_agr_btn cat_agr_btn_back"
              onClick={() => navigate('/categorias')}
              title="Volver"
              aria-label="Volver"
              disabled={saving}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="cat_agr_btn_text">Volver</span>
            </button>

            <button type="submit" className="cat_agr_btn cat_agr_btn_primary" disabled={saving}>
              <FontAwesomeIcon icon={faPlus} />
              <span className="cat_agr_btn_text">{saving ? 'Guardando…' : 'Guardar'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast.show && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={closeToast}
        />
      )}
    </div>
  );
};

export default CategoriaNueva;
