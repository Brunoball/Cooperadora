// src/components/Categorias/CategoriaEditar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave, faHistory } from '@fortawesome/free-solid-svg-icons';

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

const formatDate = (iso) => {
  if (!iso) return '-';
  const s = iso.toString().slice(0, 10);
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
};

const CategoriaEditar = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');

  const montoRef = useRef(null);

  // Historial (modal)
  const [histOpen, setHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histRows, setHistRows] = useState([]);

  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });
  const showToast = (mensaje, tipo = 'exito', duracion = 3000) =>
    setToast({ show: true, tipo, mensaje, duracion });

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); }
    catch { throw new Error(`Error HTTP ${res.status}`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  // Cargar datos de la categoría
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
        showToast(e.message || 'No se pudo cargar la categoría', 'error');
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
      showToast('El monto debe ser un número mayor o igual a 0', 'error');
      montoRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      const body = new FormData();
      body.append('id', String(id));
      body.append('monto', String(m));
      body.append('precio', String(m)); // compat con backend

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_actualizar`, { method: 'POST', body });
      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo actualizar');

      showToast('Monto actualizado con éxito.', 'exito');
      setTimeout(() => navigate('/categorias', { replace: true }), 400);
    } catch (e) {
      showToast(e.message || 'Error al actualizar la categoría', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Abrir modal de historial (carga on-demand)
  const abrirHistorial = async () => {
    try {
      setHistOpen(true);
      setHistLoading(true);
      setHistRows([]);

      const json = await fetchJSON(`${BASE_URL}/api.php?action=cat_historial&id=${encodeURIComponent(id)}`);
      let filas = [];
      if (Array.isArray(json)) filas = json;
      else if (json?.historial) filas = json.historial;
      else if (json?.exito && Array.isArray(json?.data)) filas = json.data;
      else if (json?.exito && Array.isArray(json?.rows)) filas = json.rows;
      else filas = json?.resultados || [];

      const norm = filas.map((r) => ({
        precio_anterior: Number(r.precio_anterior ?? r.anterior ?? r.old ?? 0),
        precio_nuevo:   Number(r.precio_nuevo   ?? r.nuevo   ?? r.new ?? 0),
        fecha:          (r.fecha_cambio ?? r.fecha ?? '').toString(),
      }));

      setHistRows(norm);
    } catch (e) {
      setHistOpen(false);
      showToast(`No se pudo obtener el historial: ${e.message}`, 'error');
    } finally {
      setHistLoading(false);
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
        <h2 style={{ margin: 0 }}>Editar categoría</h2>
      </div>

      {loading ? (
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          Cargando…
        </div>
      ) : (
        <form onSubmit={onSubmit}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          {/* Botón Historial arriba a la derecha */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={abrirHistorial}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
              title="Ver historial de precios"
            >
              <FontAwesomeIcon icon={faHistory} /> <span style={{ marginLeft: 6 }}>Ver historial</span>
            </button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Nombre (no editable)</label>
              <input
                value={nombre}
                disabled
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f8fafc', textTransform: 'uppercase' }}
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
                background: 'var(--soc-success,#16a34a)', color: '#fff',
                minWidth: 140, cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Guardando…' : (<><FontAwesomeIcon icon={faSave} /> Guardar</>)}
            </button>
          </div>
        </form>
      )}

      {/* Modal Historial */}
      <Modal
        open={histOpen}
        title={`Historial de precios • ${nombre || `ID ${id}`}`}
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
            {histRows.length === 0 ? (
              <div style={{ padding: 10, color: '#475569' }}>Sin registros de historial para esta categoría.</div>
            ) : (
              histRows.map((h, i) => (
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
              ))
            )}
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

export default CategoriaEditar;
