// src/components/TiposDocumentos/TiposDocumentos.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus, faSave, faTrash, faEdit, faSearch } from '@fortawesome/free-solid-svg-icons';

/* ===========================
   Modal de Confirmación
=========================== */
const ConfirmModal = ({ open, title, message, confirmText = 'Eliminar', cancelText = 'Cancelar', onConfirm, onCancel, loading }) => {
  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && !loading && onCancel?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={() => !loading && onCancel?.()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 92vw)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(2,6,23,.15)',
          padding: 18
        }}
      >
        <h3 id="modal-title" style={{ margin: '4px 0 10px', fontSize: 20 }}>{title}</h3>
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
      </div>
    </div>
  );
};

const TiposDocumentos = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ descripcion: '', sigla: '' });

  // ✅ Siempre usar exito por defecto (verde)
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });

  // Modal eliminar
  const [modalEliminar, setModalEliminar] = useState({ open: false, id: null, label: '' });
  const [eliminando, setEliminando] = useState(false);

  const descripcionRef = useRef(null);
  const showToast = (texto, tipo = 'exito') => setToast({ show: true, tipo, mensaje: texto });

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
      .map((x) => ({
        id: x.id ?? x.id_tipo_documento,
        // ✅ mostrar en mayúsculas también
        descripcion: (x.descripcion ?? '').toUpperCase(),
        sigla: (x.sigla ?? '').toUpperCase(),
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const cargar = async () => {
    try {
      setLoading(true);
      const json = await fetchJSON(`${BASE_URL}/api.php?action=td_listar`);
      if (!json.exito) throw new Error(json.mensaje || 'Error al listar');
      setLista(normalizarFilas(json.tipos_documentos));
    } catch (e) {
      showToast(`Error cargando: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { descripcionRef.current?.focus(); }, [editandoId]);

  const limpiarForm = () => setForm({ descripcion: '', sigla: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (guardando) return;

    // ✅ asegurar mayúsculas al enviar
    const descripcion = form.descripcion.trim().toUpperCase();
    const sigla = form.sigla.trim().toUpperCase();

    if (!descripcion) return showToast('La descripción es obligatoria.', 'error');
    if (!sigla) return showToast('La sigla es obligatoria.', 'error');
    if (sigla.length > 10) return showToast('La sigla no puede superar 10 caracteres.', 'error');

    try {
      setGuardando(true);

      const url = editandoId
        ? `${BASE_URL}/api.php?action=td_actualizar`
        : `${BASE_URL}/api.php?action=td_crear`;

      const body = new FormData();
      if (editandoId) body.append('id', String(editandoId));
      body.append('descripcion', descripcion);
      body.append('sigla', sigla);

      const res = await fetch(url, { method: 'POST', body });
      let json = null;
      try { json = await res.json(); }
      catch { throw new Error(`Error HTTP ${res.status}`); }

      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo guardar');

      // ✅ Mensajes de éxito más detallados
      showToast(
        editandoId ? 'Tipo de documento actualizado con éxito.' : 'Tipo de documento creado con éxito.',
        'exito'
      );
      await cargar();
      setEditandoId(null);
      limpiarForm();
    } catch (e2) {
      showToast(`Error guardando: ${e2.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const onEditar = (item) => {
    setEditandoId(item.id);
    // Pre-cargar en mayúsculas (coherente con el input)
    setForm({
      descripcion: (item.descripcion || '').toUpperCase(),
      sigla: (item.sigla || '').toUpperCase()
    });
  };

  const onCancelarEdicion = () => { setEditandoId(null); limpiarForm(); };

  // Abrir modal eliminar (antes usaba window.confirm)
  const abrirModalEliminar = useCallback((item) => {
    setModalEliminar({
      open: true,
      id: item.id,
      label: `${item.descripcion} (${item.sigla})`
    });
  }, []);

  const cerrarModalEliminar = useCallback(() => {
    setModalEliminar({ open: false, id: null, label: '' });
  }, []);

  const confirmarEliminar = useCallback(async () => {
    if (!modalEliminar.id) return;
    try {
      setEliminando(true);
      const body = new FormData();
      body.append('id', String(modalEliminar.id));
      const res = await fetch(`${BASE_URL}/api.php?action=td_eliminar`, { method: 'POST', body });
      let json = null;
      try { json = await res.json(); }
      catch { throw new Error(`Error HTTP ${res.status}`); }

      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo eliminar');

      showToast('Tipo de documento eliminado con éxito.', 'exito');
      await cargar();
      cerrarModalEliminar();
    } catch (e) {
      showToast(`Error eliminando: ${e.message}`, 'error');
    } finally {
      setEliminando(false);
    }
  }, [modalEliminar, cerrarModalEliminar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(x =>
      (x.descripcion || '').toLowerCase().includes(q) ||
      (x.sigla || '').toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  return (
    <div className="contenedor tipodoc-wrap" style={{ padding: 16 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <button onClick={() => navigate('/panel')} style={{ padding:'8px 12px', borderRadius:10, cursor:'pointer' }}>
          <FontAwesomeIcon icon={faArrowLeft} /> Volver
        </button>
        <h2 style={{ margin:0 }}>Tipos de documento</h2>
      </div>

      <form onSubmit={onSubmit} style={{ padding:16, borderRadius:12, background:'var(--soc-light,#fff)', boxShadow:'0 6px 18px rgba(2,6,23,.08)', marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 220px 200px', gap:12 }}>
          <div>
            <label>Descripción</label>
            <input
              ref={descripcionRef}
              value={form.descripcion}
              onChange={(e) => setForm(s => ({ ...s, descripcion: e.target.value.toUpperCase() }))}
              placeholder="(ej: Documento Nacional de Identidad)"
              style={{
                width:'100%',
                padding:10,
                borderRadius:10,
                border:'1px solid #cbd5e1',
                textTransform:'uppercase'
              }}
            />
          </div>
          <div>
            <label>Sigla</label>
            <input
              value={form.sigla}
              onChange={(e) => setForm(s => ({ ...s, sigla: e.target.value.toUpperCase() }))}
              placeholder="(ej: DNI)"
              style={{ width:'100%', padding:10, borderRadius:10, border:'1px solid #cbd5e1', textTransform:'uppercase' }}
              maxLength={10}
            />
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <button type="submit" disabled={guardando} style={{ padding:'10px 14px', borderRadius:10, border:'none', background: guardando ? '#93c5fd' : 'var(--soc-primary,#2563eb)', color:'#fff', cursor: guardando ? 'not-allowed' : 'pointer' }}>
              <FontAwesomeIcon icon={editandoId ? faSave : faPlus} />{' '}
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar'}
            </button>
            {editandoId && (
              <button type="button" onClick={onCancelarEdicion} disabled={guardando} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #cbd5e1', background:'transparent', cursor: guardando ? 'not-allowed' : 'pointer' }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

      <div style={{ padding:16, borderRadius:12, background:'var(--soc-light,#fff)', boxShadow:'0 6px 18px rgba(2,6,23,.08)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <FontAwesomeIcon icon={faSearch} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por descripción o sigla..."
              style={{ padding:10, borderRadius:10, border:'1px solid #cbd5e1', width:320 }}
            />
          </div>
          {loading && <span style={{ color:'#64748b' }}>Cargando...</span>}
        </div>

        <div style={{ maxHeight:'60vh', overflow:'auto', borderRadius:12, border:'1px solid #e2e8f0' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
            <thead>
              <tr>
                {[
                  {label:'ID', w:90, align:'left'},
                  {label:'Descripción', w:'auto', align:'left'},
                  {label:'Sigla', w:180, align:'left'},
                  {label:'Acciones', w:170, align:'right'},
                ].map((c,i)=>(
                  <th key={i} style={{ position:'sticky', top:0, zIndex:1, background:'#f8fafc', textAlign:c.align, padding:10, borderBottom:'1px solid #e2e8f0', width:c.w }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(it => (
                <tr key={it.id} style={{ background:'#fff' }}>
                  <td style={{ padding:10, borderBottom:'1px solid #f1f5f9' }}>{it.id}</td>
                  <td style={{ padding:10, borderBottom:'1px solid #f1f5f9' }}>{it.descripcion}</td>
                  <td style={{ padding:10, borderBottom:'1px solid #f1f5f9' }}>{it.sigla}</td>
                  <td style={{ padding:10, borderBottom:'1px solid #f1f5f9', textAlign:'right' }}>
                    <button
                      onClick={() => abrirModalEliminar(it)}
                      title="Eliminar"
                      style={{ padding:'8px 10px', borderRadius:10, border:'none', background:'var(--soc-danger,#ef4444)', color:'#fff', cursor:'pointer' }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                    <button
                      onClick={() => onEditar(it)}
                      title="Editar"
                      style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #cbd5e1', background:'transparent', cursor:'pointer' }}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan="4" style={{ padding:16, textAlign:'center', color:'#64748b' }}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        open={modalEliminar.open}
        title="Confirmar eliminación"
        message={
          modalEliminar.label
            ? `¿Seguro que querés eliminar el tipo de documento: ${modalEliminar.label}? Esta acción no se puede deshacer.`
            : '¿Seguro que querés eliminar este tipo de documento? Esta acción no se puede deshacer.'
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmarEliminar}
        onCancel={cerrarModalEliminar}
        loading={eliminando}
      />

      {toast.show && (
        <Toast
          tipo={toast.tipo}        // 'exito' por defecto
          mensaje={toast.mensaje}
          duracion={3000}
          onClose={() => setToast(t => ({ ...t, show:false }))}
        />
      )}
    </div>
  );
};

export default TiposDocumentos;
