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
  faTimes,
  faClockRotateLeft,
  faArrowTrendUp,
  faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons';
import './Categorias.css';

/* ===========================
   Modal base (accesible)
=========================== */
const Modal = ({ open, title, onClose, children, width = 720 }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cat_modal" role="dialog" aria-modal="true" aria-labelledby="cat_modal_title" onClick={onClose}>
      <div
        className="cat_modal_card"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cat_modal_head">
          <h3 id="cat_modal_title" className="cat_modal_title">{title}</h3>
          <button onClick={onClose} className="cat_modal_close" aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="cat_modal_body">{children}</div>
      </div>
    </div>
  );
};

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

const formatDate = (iso) => {
  if (!iso) return '—';
  const s = iso.toString().slice(0, 10);
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
};

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

  // Historial
  const [modalHistOpen, setModalHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [hist, setHist] = useState([]); // [{precio_anterior, precio_nuevo, fecha, tipo}]
  const [histCategoria, setHistCategoria] = useState({ id: null, nombre: '' });

  // Eliminar
  const [delState, setDelState] = useState({ open: false, cat: null, loading: false });

  // Helpers API
  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); }
    catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  // ⬇⬇⬇ Normalizamos para tener mensual y anual por separado
  const normalizarFilas = (arr) =>
    [...(arr || [])]
      .map((r) => ({
        id: r.id ?? r.id_cat_monto ?? r.id_categoria ?? r.ID ?? null,
        descripcion: (r.descripcion ?? r.nombre_categoria ?? r.nombre ?? '').toString(),
        monto_mensual: r.monto ?? r.monto_mensual ?? null,
        monto_anual:   r.monto_anual ?? null,
        historialCount: r.historial_count ?? r.cant_historial ?? r.tiene_historial ?? 0,
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

  // Abrir modal de confirmación
  const pedirConfirmacionEliminar = (cat) => {
    setDelState({ open: true, cat, loading: false });
  };

  // Confirmar eliminación
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

  // Historial por categoría
  const abrirHistorial = async (cat) => {
    try {
      setHistCategoria({ id: cat.id, nombre: cat.descripcion || '' });
      setHist([]);
      setHistLoading(true);
      setModalHistOpen(false);

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_historial&id=${encodeURIComponent(cat.id)}`);
      let filas = [];
      if (Array.isArray(json)) filas = json;
      else if (json?.historial) {
        if (json.exito === false) throw new Error(json.mensaje || 'Error al obtener historial');
        filas = json.historial;
      } else if (json?.exito && Array.isArray(json?.data)) filas = json.data;
      else if (json?.exito && Array.isArray(json?.rows)) filas = json.rows;
      else filas = json?.resultados || [];

      const norm = filas.map((r) => ({
        precio_anterior: Number(r.precio_anterior ?? r.anterior ?? r.old ?? 0),
        precio_nuevo:   Number(r.precio_nuevo   ?? r.nuevo   ?? r.new ?? 0),
        fecha:          (r.fecha_cambio ?? r.fecha ?? '').toString(),
        tipo:           (r.tipo ?? 'MENSUAL').toString(),
      }));

      // ⬅️ NUEVO: si no hay historial, mostrar toast y NO abrir modal
      if (norm.length === 0) {
        showToast('info', 'No hay historial para esta categoría.');
        setHist([]);
        setModalHistOpen(false);
      } else {
        setHist(norm);
        setModalHistOpen(true);
      }
    } catch (e) {
      console.error(e);
      setModalHistOpen(false);
      showToast('error', `No se pudo cargar el historial: ${e.message}`);
    } finally {
      setHistLoading(false);
    }
  };

  const renderCambio = (viejo, nuevo) => {
    const pv = Number(viejo);
    const pn = Number(nuevo);
    if (!(pv > 0)) return <span className="cat_change_dash">—</span>;

    const diff = pn - pv;
    const pct = (diff / pv) * 100;
    const sign = diff >= 0 ? '+' : '';
    const isUp = diff > 0;
    const isDown = diff < 0;

    return (
      <span className={`cat_change ${isUp ? 'cat_change_up' : ''} ${isDown ? 'cat_change_down' : ''}`}>
        <FontAwesomeIcon icon={isUp ? faArrowTrendUp : faArrowTrendDown} className="cat_change_icon" />
        {sign}{pct.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="cat_page">
      <div className="cat_card">
        {/* Header */}
        <header className="cat_header">
          <h2 className="cat_title">Categorías</h2>
        </header>

        {/* Lista / Tabla */}
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
                  {/* Historial */}
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

        {/* Toolbar */}
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

      {/* Modal Historial */}
      <Modal
        open={delState.open === false ? modalHistOpen : false}
        onClose={() => setModalHistOpen(false)}
        title={`Historial · ${histCategoria.nombre || ''}`}
      >
        {histLoading ? (
          <div className="cat_hist_loading">Cargando historial…</div>
        ) : (
          <div className="cat_hist_table_wrap">
            <table className="cat_hist_table">
              <thead>
                <tr>
                  <th className="cat_th_center">#</th>
                  <th className="cat_th_center">Tipo</th>
                  <th className="cat_th_right">Monto anterior</th>
                  <th className="cat_th_right">Monto nuevo</th>
                  <th className="cat_th_center">Cambio</th>
                  <th className="cat_th_center">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, i) => (
                  <tr key={i}>
                    <td className="cat_td_center" data-label="#"> {i + 1} </td>
                    <td className="cat_td_center" data-label="Tipo">{h.tipo}</td>
                    <td className="cat_td_right" data-label="Monto anterior">{fmtARS(h.precio_anterior)}</td>
                    <td className="cat_td_right" data-label="Monto nuevo">{fmtARS(h.precio_nuevo)}</td>
                    <td className="cat_td_center" data-label="Cambio">
                      {renderCambio(h.precio_anterior, h.precio_nuevo)}
                    </td>
                    <td className="cat_td_center" data-label="Fecha">{formatDate(h.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

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
