// src/components/Categorias/Categorias.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus, faTrash, faEdit, faHistory } from '@fortawesome/free-solid-svg-icons';

/* ===========================
   Modal base
=========================== */
const Modal = ({ open, title, children, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(2,6,23,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 92vw)', background: '#fff', borderRadius: 14,
          boxShadow: '0 20px 50px rgba(2,6,23,.25)', padding: 18
        }}
      >
        <h3 id="modal-title" style={{ margin: '4px 0 10px', fontSize: 20 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
};

/* ===========================
   Confirmación (Eliminar)
=========================== */
const ConfirmModal = ({ open, title, message, confirmText = 'Eliminar', cancelText = 'Cancelar', onConfirm, onCancel, loading }) => {
  return (
    <Modal open={open} title={title} onClose={loading ? undefined : onCancel}>
      <p style={{ margin: '0 0 18px', color: '#334155', lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--soc-danger,#ef4444)',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            minWidth: 120
          }}
        >
          {loading ? 'Eliminando…' : confirmText}
        </button>
      </div>
    </Modal>
  );
};

const formatDate = (iso) => {
  if (!iso) return '-';
  const s = iso.toString().slice(0, 10);
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
};

const Categorias = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });
  const showToast = (mensaje, tipo = 'exito', duracion = 3000) =>
    setToast({ show: true, tipo, mensaje, duracion });

  // Eliminar
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delId, setDelId] = useState(null);
  const [delNombre, setDelNombre] = useState('');

  // Historial
  const [histOpen, setHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histNombre, setHistNombre] = useState('');
  const [histRows, setHistRows] = useState([]);

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); }
    catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const normalizarFilas = (arr) =>
    [...(arr || [])]
      .map((r) => ({
        id: r.id ?? r.id_categoria ?? r.ID ?? null,
        descripcion: (r.descripcion ?? r.nombre_categoria ?? r.nombre ?? '').toString().toUpperCase(),
        precio: r.monto ?? r.precio ?? r.Precio_Categoria ?? null,
        historialCount: r.historial_count ?? r.cant_historial ?? r.tiene_historial ?? 0,
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const cargarCategorias = async () => {
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
      showToast(`No se pudieron cargar las categorías: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarCategorias(); }, []);

  const abrirModalEliminar = (cat) => {
    setDelId(cat.id);
    setDelNombre(cat.descripcion || '');
    setEliminarOpen(true);
  };

  const confirmarEliminar = async () => {
    if (deleting || !delId) return;
    try {
      setDeleting(true);
      const body = new FormData();
      body.append('id', String(delId));
      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_eliminar`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo eliminar');

      showToast('Categoría eliminada con éxito.', 'exito');
      setEliminarOpen(false);
      await cargarCategorias();
    } catch (e) {
      showToast(e.message || 'Error al eliminar la categoría', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const abrirHistorial = async (cat) => {
    try {
      setHistNombre(cat.descripcion || '');
      setHistRows([]);
      setHistOpen(true);
      setHistLoading(true);

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
      }));

      if (norm.length === 0) {
        setHistOpen(false);
        showToast('Esta categoría no tiene historial aún.', 'exito');
        return;
      }

      setHistRows(norm);
    } catch (e) {
      setHistOpen(false);
      showToast(`No se pudo obtener el historial: ${e.message}`, 'error');
    } finally {
      setHistLoading(false);
    }
  };

  const filas = useMemo(() => lista, [lista]);

  return (
    <div className="contenedor-modulo" style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/panel')}
            className="btn-volver"
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Volver</span>
          </button>
          <h2 style={{ margin: 0 }}>Categorías</h2>
        </div>

        <button
          onClick={() => navigate('/categorias/nueva')}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--soc-primary,#2563eb)',
            color: '#fff',
            display: 'inline-flex',
            gap: 8,
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Agregar categoría
        </button>
      </div>

      {/* Tabla / Lista */}
      <div
        style={{
          background: 'var(--soc-light,#fff)',
          border: '1px solid var(--soc-gray-200,#e5e7eb)',
          borderRadius: 12,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 160px 220px',
            gap: 10,
            fontWeight: 700,
            padding: '10px 12px',
            background: 'var(--soc-gray-50,#f8fafc)',
            borderBottom: '1px solid var(--soc-gray-200,#e5e7eb)'
          }}
        >
          <div>ID</div>
          <div>Nombre</div>
          <div>Monto</div>
          <div style={{ textAlign: 'right' }}>Acciones</div>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>Cargando...</div>
        ) : filas.length === 0 ? (
          <div style={{ padding: 16 }}>No hay categorías cargadas.</div>
        ) : (
          filas.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 160px 220px',
                gap: 10,
                padding: '10px 12px',
                borderTop: '1px solid var(--soc-gray-100,#f1f5f9)',
                alignItems: 'center'
              }}
            >
              <div>{c.id ?? '-'}</div>
              <div>{c.descripcion || '-'}</div>
              <div>{c.precio === null || c.precio === undefined || c.precio === '' ? '-' : `$ ${Number(c.precio).toLocaleString('es-AR')}`}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {Number(c.historialCount) > 0 && (
                  <button
                    title="Historial de precios"
                    onClick={() => abrirHistorial(c)}
                    style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                  >
                    <FontAwesomeIcon icon={faHistory} /> <span style={{ marginLeft: 6 }}>Historial</span>
                  </button>
                )}
                <button
                  title="Editar"
                  onClick={() => navigate(`/categorias/editar/${c.id}`)}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  title="Eliminar"
                  onClick={() => abrirModalEliminar(c)}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--soc-danger,#ef4444)', background: 'transparent', color: 'var(--soc-danger,#ef4444)', cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Eliminar */}
      <ConfirmModal
        open={eliminarOpen}
        title="Eliminar categoría"
        message={
          delNombre
            ? `¿Seguro que querés eliminar la categoría: ${delNombre}? Esta acción no se puede deshacer.`
            : '¿Seguro que querés eliminar esta categoría? Esta acción no se puede deshacer.'
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmarEliminar}
        onCancel={() => setEliminarOpen(false)}
        loading={deleting}
      />

      {/* Modal Historial */}
      <Modal
        open={histOpen}
        title={`Historial de precios • ${histNombre}`}
        onClose={histLoading ? undefined : () => setHistOpen(false)}
      >
        {histLoading ? (
          <div style={{ padding: 10 }}>Cargando…</div>
        ) : (
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                fontWeight: 700,
                padding: '8px 10px',
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                marginBottom: 8
              }}
            >
              <div>Fecha</div>
              <div>Precio viejo</div>
              <div>Precio nuevo</div>
            </div>
            {histRows.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  padding: '8px 10px',
                  borderBottom: '1px solid #eef2f7'
                }}
              >
                <div>{formatDate(h.fecha)}</div>
                <div>{isNaN(h.precio_anterior) ? '-' : `$ ${Number(h.precio_anterior).toLocaleString('es-AR')}`}</div>
                <div>{isNaN(h.precio_nuevo)   ? '-' : `$ ${Number(h.precio_nuevo).toLocaleString('es-AR')}`}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={() => setHistOpen(false)}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Toast */}
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

export default Categorias;
