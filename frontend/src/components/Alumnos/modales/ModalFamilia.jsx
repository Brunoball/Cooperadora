// src/components/Familias/ModalFamilia.jsx
import React, { useEffect, useState } from 'react';
import { FaTimes, FaSave } from 'react-icons/fa';
import './ModalFamilia.css';

export default function ModalFamilia({ open, onClose, familia, onSave }) {
  const [nombre, setNombre] = useState('');
  const [obs, setObs] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    // Al abrir, normalizamos a MAYÚSCULAS
    setNombre((familia?.nombre_familia || '').toString().toUpperCase());
    setObs((familia?.observaciones || '').toString().toUpperCase());
    setActivo((familia?.activo ?? 1) === 1);
  }, [open, familia]);

  if (!open) return null;

  // Handlers que fuerzan MAYÚSCULAS al tipear
  const handleNombre = (e) => setNombre(e.target.value.toUpperCase());
  const handleObs = (e) => setObs(e.target.value.toUpperCase());

  const handleGuardar = () => {
    onSave({
      id_familia: familia?.id_familia ?? null,
      nombre_familia: nombre.trim(),   // ya viene en MAYÚSCULAS
      observaciones: obs.trim(),       // ya viene en MAYÚSCULAS
      activo: activo ? 1 : 0,
    });
  };

  return (
    <div className="mf_overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mf_modal" onClick={e => e.stopPropagation()}>
        <div className="mf_head">
          <h3>{familia ? 'Editar familia' : 'Nueva familia'}</h3>
          <button className="mf_close" onClick={onClose} aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>

        <div className="mf_body">
          {/* Si preferís, podés cambiar "Nombre" por "Apellido" */}
          <label>Apellido *</label>
          <input
            value={nombre}
            onChange={handleNombre}
            maxLength={120}
            style={{ textTransform: 'uppercase' }}
          />

          <label>Observaciones</label>
          <textarea
            rows={3}
            value={obs}
            onChange={handleObs}
            style={{ textTransform: 'uppercase' }}
          />

          <label className="mf_check">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            Activo
          </label>
        </div>

        <div className="mf_foot">
          <button onClick={onClose} className="mf_btn ghost">Cancelar</button>
          <button onClick={handleGuardar} className="mf_btn solid">
            <FaSave /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
