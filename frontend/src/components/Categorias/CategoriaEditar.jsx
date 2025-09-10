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
  const [monto, setMonto] = useState('');

  const montoRef = useRef(null);

  // TOAST
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); }
    catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  // Cargar datos iniciales
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
        let filas = [];
        if (Array.isArray(json)) filas = json;
        else if (json?.categorias) filas = json.categorias;
        else if (json?.exito && Array.isArray(json?.data)) filas = json.data;
        else if (json?.exito && Array.isArray(json?.rows)) filas = json.rows;
        else if (json?.exito && Array.isArray(json?.result)) filas = json.result;
        else filas = json?.resultados || [];

        const norm = filas.map((r) => ({
          id: r.id ?? r.id_categoria ?? r.ID ?? null,
          descripcion: (r.descripcion ?? r.nombre_categoria ?? r.nombre ?? '').toString().toUpperCase(),
          precio: r.monto ?? r.precio ?? r.Precio_Categoria ?? null,
        }));

        const cat = norm.find((x) => String(x.id) === String(id));
        if (!cat) throw new Error('Categoría no encontrada');

        setNombre(cat.descripcion || '');
        setMonto(cat.precio ?? '');
        setTimeout(() => montoRef.current?.focus(), 0);
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

    const mStr = (monto ?? '').toString().trim();
    const m = mStr === '' ? 0 : Number(mStr);

    if (isNaN(m) || m < 0) {
      showToast('error', 'El monto debe ser un número mayor o igual a 0', 2800);
      montoRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      const body = new FormData();
      body.append('id', String(id));
      body.append('monto', String(m));
      body.append('precio', String(m)); // compat backend

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_actualizar`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo actualizar');

      const dur = 2000;
      showToast('exito', 'Monto actualizado con éxito.', dur);
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
        <header className="cat_edi_header">
          <h2 className="cat_edi_title">Editar categoría</h2>
        </header>

        {loading ? (
          <div className="cat_edi_loading">Cargando…</div>
        ) : (
          <form className="cat_edi_form" onSubmit={onSubmit}>
            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Nombre (no editable)</label>
              <input
                className="cat_edi_input"
                value={nombre}
                disabled
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Monto</label>
              <input
                ref={montoRef}
                className="cat_edi_input"
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

            {/* Acciones: Volver (izq) + Guardar (der) */}
            <div className="cat_edi_form_actions">
              <button
                type="button"
                className="cat_edi_btn cat_edi_btn_back"
                onClick={() => navigate('/categorias')}
                title="Volver"
                aria-label="Volver"
                disabled={saving}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span className="cat_edi_btn_text">Volver</span>
              </button>

              <button
                type="submit"
                className="cat_edi_btn cat_edi_btn_primary"
                disabled={saving}
              >
                <FontAwesomeIcon icon={faSave} />
                <span className="cat_edi_btn_text">{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

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

export default CategoriaEditar;
