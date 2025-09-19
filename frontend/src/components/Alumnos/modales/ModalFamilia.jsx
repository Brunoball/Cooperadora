// src/components/Alumnos/modales/ModalFamilia.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FaTimes, FaSave, FaPlus, FaEdit } from 'react-icons/fa';
import './ModalFamilia.css';

export default function ModalFamilia({ open, onClose, familia, onSave }) {
  const [nombre, setNombre] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!familia;
  const titleId = 'mf_alumnos_title';
  const firstInputRef = useRef(null);
  const triggerRef = useRef(null); // para devolver foco al cerrar

  // Guardar el elemento que tenía el foco para devolverlo al cerrar
  useEffect(() => {
    if (open) triggerRef.current = document.activeElement;
  }, [open]);

  // Cargar valores al abrir y poner foco
  useEffect(() => {
    if (!open) return;
    setNombre((familia?.nombre_familia || '').toString().toUpperCase());
    setObs((familia?.observaciones || '').toString().toUpperCase());

    const t = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, familia]);

  // Atajos: Esc (cerrar) y Ctrl/Cmd+Enter (guardar)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGuardar();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nombre, obs]);

  // Devolver foco al trigger al cerrar
  useEffect(() => {
    if (!open && triggerRef.current instanceof HTMLElement) {
      const t = setTimeout(() => triggerRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleNombre = (e) => setNombre(e.target.value.toUpperCase());
  const handleObs = (e) => setObs(e.target.value.toUpperCase());

  const handleGuardar = useCallback(async () => {
    if (!nombre.trim() || saving) return;
    try {
      setSaving(true);
      await onSave?.({
        id_familia: familia?.id_familia ?? null,
        nombre_familia: nombre.trim(),
        observaciones: obs.trim(),
      });
    } finally {
      setSaving(false);
    }
  }, [onSave, familia, nombre, obs, saving]);

  const onOverlayClick = (e) => {
    if (e.currentTarget === e.target) onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="mf_overlay"
      onClick={onOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`mf_modal ${isEdit ? 'mf_mode_edit' : 'mf_mode_new'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mf_head">
          <h3 id={titleId} className="mf_title">
            <span className="mf_title_icon" aria-hidden="true">
              {isEdit ? <FaEdit /> : <FaPlus />}
            </span>
            {isEdit ? 'Editar familia' : 'Nueva familia'}
          </h3>
          <button className="mf_close" onClick={onClose} aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="mf_body">
          <label htmlFor="mf_nombre" className="mf_label">Apellido *</label>
          <input
            id="mf_nombre"
            ref={firstInputRef}
            className="mf_input mf_upper"
            value={nombre}
            onChange={handleNombre}
            maxLength={120}
            placeholder="EJ.: PÉREZ"
          />

          <label htmlFor="mf_obs" className="mf_label">Observaciones</label>
          <textarea
            id="mf_obs"
            className="mf_textarea mf_upper"
            rows={3}
            value={obs}
            onChange={handleObs}
            placeholder="Notas internas..."
          />
        </div>

        {/* Footer */}
        <div className="mf_foot">
          <button onClick={onClose} className="mf_btn mf_ghost">Cancelar</button>
          <button
            onClick={handleGuardar}
            className="mf_btn mf_solid"
            disabled={!nombre.trim() || saving}
            title={!nombre.trim() ? 'Completá el Apellido' : 'Guardar'}
          >
            <FaSave /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
