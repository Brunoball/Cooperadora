// src/components/Categorias/CategoriaNueva.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';

const normalizar = (s) => (s || '').toString().trim().toUpperCase();

const CategoriaNueva = () => {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });
  const showToast = (mensaje, tipo = 'exito', duracion = 3000) =>
    setToast({ show: true, tipo, mensaje, duracion });

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
      showToast('El nombre de la categoría es obligatorio', 'error');
      nombreRef.current?.focus();
      return;
    }
    if (isNaN(m) || m < 0) {
      showToast('El monto debe ser un número mayor o igual a 0', 'error');
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

      showToast('Categoría creada con éxito.', 'exito');
      // Pequeño delay para que se vea el toast y volver
      setTimeout(() => navigate('/categorias', { replace: true }), 400);
    } catch (e) {
      showToast(e.message || 'Error al crear la categoría', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="contenedor-modulo" style={{ padding: 16, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => navigate('/categorias')}
          className="btn-volver"
          style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Volver a categorías</span>
        </button>
        <h2 style={{ margin: 0 }}>Agregar categoría</h2>
      </div>

      <form onSubmit={onSubmit}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>Nombre *</label>
            <input
              ref={nombreRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="(ej: INTERNO)"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', textTransform: 'uppercase' }}
              disabled={saving}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>Monto</label>
            <input
              ref={montoRef}
              type="number"
              min="0"
              step="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              disabled={saving}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => navigate('/categorias')}
            disabled={saving}
            style={{
              padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1',
              background: 'transparent', cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: 'var(--soc-primary,#2563eb)', color: '#fff',
              minWidth: 140, cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Guardando…' : (<><FontAwesomeIcon icon={faPlus} /> Guardar</>)}
          </button>
        </div>
      </form>

      {toast.show && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion ?? 3000}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        />
      )}
    </div>
  );
};

export default CategoriaNueva;
