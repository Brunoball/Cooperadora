// src/components/TiposDocumentos/TiposDocumentos.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faSave,
  faTrash,
  faEdit,
  faTimes,
  faSearch
} from '@fortawesome/free-solid-svg-icons';
import './TiposDocumentos.css';

/* ===== Modal Confirmar Eliminación (estilo Categorías) ===== */
function ConfirmDeleteModal({ open, tipoDocumento, onConfirm, onCancel, loading }) {
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
      className="td-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="td-modal-title"
      onClick={onCancel}
    >
      <div
        className="td-modal-container td-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="td-modal-title" className="td-modal-title td-modal-title--danger">
          Eliminar tipo de documento
        </h3>

        <p className="td-modal-text">
          ¿Seguro que querés eliminar <strong>{tipoDocumento?.descripcion} ({tipoDocumento?.sigla})</strong>? Esta acción no se puede deshacer.
        </p>

        <div className="td-modal-buttons">
          <button className="td-btn td-btn--ghost" onClick={onCancel} autoFocus disabled={loading}>
            Cancelar
          </button>
          <button
            className="td-btn td-btn--solid-danger"
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

const TiposDocumentos = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ descripcion: '', sigla: '' });

  // Toast
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });

  // Modal eliminar
  const [delState, setDelState] = useState({ open: false, tipoDoc: null, loading: false });

  const descripcionRef = useRef(null);
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  // Helpers
  const api = (action) => `${BASE_URL}/api.php?action=${action}`;

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
        descripcion: (x.descripcion ?? '').toUpperCase(),
        sigla: (x.sigla ?? '').toUpperCase(),
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const cargar = async () => {
    try {
      setLoading(true);
      const json = await fetchJSON(api('td_listar'));
      if (!json.exito) throw new Error(json.mensaje || 'Error al listar');
      setLista(normalizarFilas(json.tipos_documentos));
    } catch (e) {
      showToast('error', `Error cargando: ${e.message}`);
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

    const descripcion = form.descripcion.trim().toUpperCase();
    const sigla = form.sigla.trim().toUpperCase();

    if (!descripcion) return showToast('error', 'La descripción es obligatoria.');
    if (!sigla) return showToast('error', 'La sigla es obligatoria.');
    if (sigla.length > 10) return showToast('error', 'La sigla no puede superar 10 caracteres.');

    try {
      setGuardando(true);

      const url = editandoId
        ? api('td_actualizar')
        : api('td_crear');

      const body = new FormData();
      if (editandoId) body.append('id', String(editandoId));
      body.append('descripcion', descripcion);
      body.append('sigla', sigla);

      const res = await fetch(url, { method: 'POST', body });
      let json = null;
      try { json = await res.json(); }
      catch { throw new Error(`Error HTTP ${res.status}`); }

      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo guardar');

      showToast(
        'exito',
        editandoId ? 'Tipo de documento actualizado con éxito.' : 'Tipo de documento creado con éxito.'
      );
      await cargar();
      setEditandoId(null);
      limpiarForm();
    } catch (e2) {
      showToast('error', `Error guardando: ${e2.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const onEditar = (item) => {
    setEditandoId(item.id);
    setForm({
      descripcion: (item.descripcion || '').toUpperCase(),
      sigla: (item.sigla || '').toUpperCase()
    });
  };

  const onCancelarEdicion = () => { setEditandoId(null); limpiarForm(); };

  // Abrir modal de confirmación
  const pedirConfirmacionEliminar = (tipoDoc) => {
    setDelState({ open: true, tipoDoc, loading: false });
  };

  // Confirmar eliminación (llamado por el modal)
  const confirmarEliminar = async () => {
    const tipoDoc = delState.tipoDoc;
    if (!tipoDoc) return setDelState({ open: false, tipoDoc: null, loading: false });
    try {
      setDelState((s) => ({ ...s, loading: true }));
      
      const body = new FormData();
      body.append('id', String(tipoDoc.id));
      
      const res = await fetch(api('td_eliminar'), { method: 'POST', body });
      let json = null;
      try { json = await res.json(); }
      catch { throw new Error(`Error HTTP ${res.status}`); }

      if (!json?.exito) throw new Error(json?.mensaje || 'No se pudo eliminar');

      showToast('exito', 'Tipo de documento eliminado con éxito.');
      setDelState({ open: false, tipoDoc: null, loading: false });
      await cargar();
    } catch (e) {
      console.error(e);
      showToast('error', 'No se pudo eliminar el tipo de documento.');
      setDelState((s) => ({ ...s, loading: false }));
    }
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(x =>
      (x.descripcion || '').toLowerCase().includes(q) ||
      (x.sigla || '').toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  return (
    <div className="td_page">
      <div className="td_card">
        <header className="td_header">
          <h2 className="td_title">Tipos de Documento</h2>
        </header>

        {/* Form */}
        <form className="td_form" onSubmit={onSubmit}>
          <div className="td_form_grid">
            <div className="td_form_field">
              <label className="td_label">Descripción</label>
              <input
                ref={descripcionRef}
                value={form.descripcion}
                onChange={(e) => setForm(s => ({ ...s, descripcion: e.target.value.toUpperCase() }))}
                placeholder="(ej: Documento Nacional de Identidad)"
                className="td_input td_input_upper"
              />
            </div>

            <div className="td_form_field">
              <label className="td_label">Sigla</label>
              <input
                value={form.sigla}
                onChange={(e) => setForm(s => ({ ...s, sigla: e.target.value.toUpperCase() }))}
                placeholder="(ej: DNI)"
                className="td_input td_input_upper"
                maxLength={10}
              />
            </div>

            <div className="td_actions">
              <button
                type="submit"
                disabled={guardando}
                className="td_btn td_btn_primary"
              >
                <FontAwesomeIcon icon={editandoId ? faSave : faPlus} />
                <span className="td_btn_text">
                  {guardando ? 'Guardando...' : editandoId ? 'Guardar' : 'Agregar'}
                </span>
              </button>

              {editandoId && (
                <button
                  type="button"
                  onClick={onCancelarEdicion}
                  disabled={guardando}
                  className="td_btn td_btn_outline"
                >
                  <span className="td_btn_text">Cancelar</span>
                </button>
              )}
            </div>
          </div>
        </form>



        {/* Lista / Tabla */}
        <div className="td_list">
          <div className="td_list_head">
            <div className="td_col td_col_id td_head_cell">ID</div>
            <div className="td_col td_col_desc td_head_cell">Descripción</div>
            <div className="td_col td_col_sigla td_head_cell td_center">Sigla</div>
            <div className="td_col td_col_actions td_head_cell td_right">Acciones</div>
          </div>

          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="td_row td_row_skeleton">
                  <span className="td_skel td_skel_text" />
                  <span className="td_skel td_skel_text" />
                  <span className="td_skel td_skel_text td_skel_short" />
                  <span className="td_skel td_skel_icon" />
                </div>
              ))}
            </>
          ) : filtrados.length === 0 ? (
            <div className="td_empty">No hay tipos de documento para mostrar.</div>
          ) : (
            filtrados.map((t, index) => (
              <div
                key={t.id}
                className="td_row"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="td_cell td_col_id">{t.id}</div>
                <div className="td_cell td_col_desc">{t.descripcion}</div>
                <div className="td_cell td_col_sigla td_center">{t.sigla}</div>
                <div className="td_cell td_col_actions td_right">
                  <button
                    className="td_icon_btn"
                    onClick={() => onEditar(t)}
                    title="Editar"
                    aria-label={`Editar tipo de documento ${t.descripcion}`}
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    className="td_icon_btn td_icon_btn_danger"
                    onClick={() => pedirConfirmacionEliminar(t)}
                    title="Eliminar"
                    aria-label={`Eliminar tipo de documento ${t.descripcion}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <section className="td_toolbar">
          <button
            className="td_btn td_btn_primary td_btn_back"
            onClick={() => navigate('/panel')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="td_btn_text">Volver</span>
          </button>
        </section>
      </div>

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteModal
        open={delState.open}
        tipoDocumento={delState.tipoDoc}
        onConfirm={confirmarEliminar}
        onCancel={() => setDelState({ open: false, tipoDoc: null, loading: false })}
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

export default TiposDocumentos;