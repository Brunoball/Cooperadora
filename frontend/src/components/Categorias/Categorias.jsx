// ✅ REEMPLAZAR COMPLETO
// src/components/Categorias/Categorias.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faTrash,
  faEdit,
  faClockRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import './Categorias.css';

// ✅ Modal historial aparte
import ModalHistorialCategorias from './modales/ModalHistorialCategorias';

/* ===========================
   Modal Confirmar Eliminación
=========================== */
function ConfirmDeleteModal({ open, categoria, onConfirm, onCancel, loading }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="catdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catdel-modal-title"
      onClick={onCancel}
    >
      <div
        className="catdel-modal-container catdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catdel-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="catdel-modal-title" className="catdel-modal-title catdel-modal-title--danger">
          Eliminar categoría
        </h3>

        <p className="catdel-modal-text">
          {categoria?.descripcion
            ? <>¿Seguro que querés eliminar <strong>{categoria.descripcion}</strong>? Esta acción no se puede deshacer.</>
            : <>¿Seguro que querés eliminar esta categoría? Esta acción no se puede deshacer.</>}
        </p>

        <p className="catdel-modal-text" style={{ marginTop: 8 }}>
          <strong>Importante:</strong> todos los <strong>alumnos</strong> que tengan asignada esta
          categoría de monto quedarán <strong>sin ninguna categoría</strong>.
        </p>

        <div className="catdel-modal-buttons">
          <button className="catdel-btn catdel-btn--ghost" onClick={onCancel} autoFocus disabled={loading}>
            Cancelar
          </button>
          <button
            className="catdel-btn catdel-btn--solid-danger"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Utils
=========================== */
const fmtARS = (n) =>
  (n === null || n === undefined || n === '')
    ? '—'
    : Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/* ===========================
   Componente principal
=========================== */
const Categorias = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  // TOAST
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  // Eliminar
  const [delState, setDelState] = useState({ open: false, cat: null, loading: false });

  // ✅ Historial modal state
  const [histState, setHistState] = useState({ open: false, cat: null });

  // Helpers API
  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  // Normalización
  const normalizarFilas = (arr) =>
    [...(arr || [])]
      .map((r) => ({
        id: r.id ?? r.id_cat_monto ?? r.id_categoria ?? r.ID ?? null,
        descripcion: (r.descripcion ?? r.nombre_categoria ?? r.nombre ?? '').toString(),
        monto_mensual: r.monto ?? r.monto_mensual ?? null,
        monto_anual: r.monto_anual ?? null,
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const cargar = async () => {
    try {
      setLoading(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_listar`);
      let filas = [];
      if (Array.isArray(json)) filas = json;
      else if (json?.categorias) {
        if (json.exito === false) throw new Error(json.mensaje || 'Error al listar');
        filas = json.categorias;
      } else if (json?.exito && Array.isArray(json?.data)) filas = json.data;
      else if (json?.exito && Array.isArray(json?.rows)) filas = json.rows;
      else if (json?.exito && Array.isArray(json?.result)) filas = json.result;
      else filas = json?.resultados || [];
      setLista(normalizarFilas(filas));
    } catch (e) {
      console.error(e);
      setLista([]);
      showToast('error', `No se pudieron cargar las categorías: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => lista, [lista]);

  // Eliminar
  const pedirConfirmacionEliminar = (cat) => setDelState({ open: true, cat, loading: false });

  const confirmarEliminar = async () => {
    const cat = delState.cat;
    if (!cat) return setDelState({ open: false, cat: null, loading: false });

    try {
      setDelState((s) => ({ ...s, loading: true }));
      const body = new FormData();
      body.append('id', String(cat.id));
      const resp = await fetchJSON(`${BASE_URL}/api.php?action=cat_eliminar`, { method: 'POST', body });
      if (!resp?.exito) throw new Error(resp?.mensaje || 'No se pudo eliminar');
      showToast('exito', 'Categoría eliminada.');
      setDelState({ open: false, cat: null, loading: false });
      await cargar();
    } catch (e) {
      console.error(e);
      showToast('error', e.message || 'No se pudo eliminar la categoría.');
      setDelState((s) => ({ ...s, loading: false }));
    }
  };

  // ✅ Abrir historial modal
  const abrirHistorial = (cat) => {
    setHistState({ open: true, cat });
  };

  return (
    <div className="cat_page">
      <div className="cat_card">
        <header className="cat_header">
          <h2 className="cat_title">Categorías</h2>
        </header>

        <div className="cat_list">
          <div className="cat_list_head">
            <div className="cat_col cat_col_name cat_head_cell">Nombre</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Mensual</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Anual</div>
            <div className="cat_col cat_col_actions cat_head_cell cat_right">Acciones</div>
          </div>

          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="cat_row cat_row_skeleton">
                  <span className="cat_skel cat_skel_text" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_icon" />
                </div>
              ))}
            </>
          ) : filtradas.length === 0 ? (
            <div className="cat_empty">No hay categorías para mostrar.</div>
          ) : (
            filtradas.map((c, index) => (
              <div
                key={c.id}
                className="cat_row"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="cat_cell cat_col_name" data-label="Nombre">
                  {c.descripcion || '—'}
                </div>

                <div className="cat_cell cat_col_amount cat_center" data-label="Mensual">
                  {fmtARS(c.monto_mensual)}
                </div>

                <div className="cat_cell cat_col_amount cat_center" data-label="Anual">
                  {fmtARS(c.monto_anual)}
                </div>

                <div className="cat_cell cat_col_actions cat_right" data-label="Acciones">
                  <button
                    className="cat_icon_btn cat_icon_btn_history"
                    onClick={() => abrirHistorial(c)}
                    title="Historial de cambios"
                    aria-label={`Ver historial de ${c.descripcion || 'categoría'}`}
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                  </button>

                  <button
                    className="cat_icon_btn"
                    onClick={() => navigate(`/categorias/editar/${c.id}`)}
                    title="Editar"
                    aria-label={`Editar categoría ${c.descripcion || ''}`}
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>

                  <button
                    className="cat_icon_btn cat_icon_btn_danger"
                    onClick={() => pedirConfirmacionEliminar(c)}
                    title="Eliminar"
                    aria-label={`Eliminar categoría ${c.descripcion || ''}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <section className="cat_toolbar">
          <button
            className="cat_btn cat_btn_primary cat_btn_back"
            onClick={() => navigate('/panel')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="cat_btn_text">Volver</span>
          </button>

          <div className="cat_toolbar_spacer" />

          <button
            className="cat_btn cat_btn_outline"
            onClick={() => navigate('/categorias/nueva')}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="cat_btn_text">Nueva</span>
          </button>
        </section>
      </div>

      {/* ✅ Modal Historial (APARTE) */}
      <ModalHistorialCategorias
        open={histState.open}
        onClose={() => setHistState({ open: false, cat: null })}
        categoria={histState.cat}
        BASE_URL={BASE_URL}
        notify={(tipo, mensaje) => showToast(tipo, mensaje, 3200)}
      />

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteModal
        open={delState.open}
        categoria={delState.cat}
        onConfirm={confirmarEliminar}
        onCancel={() => setDelState({ open: false, cat: null, loading: false })}
        loading={delState.loading}
      />

      {/* TOAST */}
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

export default Categorias;