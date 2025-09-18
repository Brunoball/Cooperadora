// src/components/Alumnos/Familias.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaUsers, FaLink, FaSearch } from 'react-icons/fa';
import Toast from '../Global/Toast';
import './Familias.css';
import ModalFamilia from './modales/ModalFamilia';
import ModalMiembros from './modales/ModalMiembros';

export default function Familias() {
  const navigate = useNavigate();

  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState({ mostrar: false, tipo: '', mensaje: '' });

  const [modalFamiliaOpen, setModalFamiliaOpen] = useState(false);
  const [editFamilia, setEditFamilia] = useState(null);

  const [modalMiembrosOpen, setModalMiembrosOpen] = useState(false);
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);

  const showToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const cargarFamilias = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familias_listar&ts=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        setFamilias(j.familias || []);
      } else {
        showToast(j?.mensaje || 'No se pudieron obtener familias', 'error');
        setFamilias([]);
      }
    } catch {
      showToast('Error de red al obtener familias', 'error');
      setFamilias([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { cargarFamilias(); }, [cargarFamilias]);

  const fmtFechaSolo = (val) => {
    if (!val) return '—';
    const s = String(val).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, y, mo, d] = m;
      return `${d}/${mo}/${y}`;
    }
    try {
      const d = new Date(s.replace(' ', 'T'));
      if (isNaN(d.getTime())) return s;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    } catch {
      return s;
    }
  };

  const toUpperSafe = (x) => (x ?? '').toString().toUpperCase();

  const filtradas = useMemo(() => {
    if (!q.trim()) return familias;
    const t = q.trim().toLowerCase();
    return familias.filter(
      f =>
        (f.nombre_familia || '').toLowerCase().includes(t) ||
        (f.observaciones || '').toLowerCase().includes(t)
    );
  }, [familias, q]);

  const onGuardarFamilia = async (payload) => {
    try {
      const payloadUC = {
        ...payload,
        nombre_familia: toUpperSafe(payload?.nombre_familia),
        observaciones: toUpperSafe(payload?.observaciones),
      };

      const r = await fetch(`${BASE_URL}/api.php?action=familia_guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadUC),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || 'Guardado', 'exito');
        setModalFamiliaOpen(false);
        setEditFamilia(null);
        cargarFamilias();
      } else {
        showToast(j?.mensaje || 'No se pudo guardar', 'error');
      }
    } catch {
      showToast('Error al guardar familia', 'error');
    }
  };

  const onEliminarFamilia = async (f) => {
    const confirmar = window.confirm(
      `¿Eliminar la familia "${f.nombre_familia}"?\nSi tiene alumnos vinculados, se bloqueará a menos que fuerces.`
    );
    if (!confirmar) return;

    const forzar = window.confirm('¿Forzar borrado? (Desvincula alumnos y elimina la familia)');
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_eliminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_familia: f.id_familia, forzar: forzar ? 1 : 0 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || 'Eliminada', 'exito');
        setFamilias(prev => prev.filter(x => String(x.id_familia) !== String(f.id_familia)));
        if (familiaSeleccionada?.id_familia === f.id_familia) {
          setModalMiembrosOpen(false);
          setFamiliaSeleccionada(null);
        }
      } else {
        showToast(j?.mensaje || 'No se pudo eliminar', 'error');
      }
    } catch {
      showToast('Error al eliminar familia', 'error');
    }
  };

  const abrirMiembros = (f) => {
    setFamiliaSeleccionada(f);
    setModalMiembrosOpen(true);
  };

  const onDeltaCounts = useCallback(({ id_familia, deltaActivos = 0, deltaTotales = 0 }) => {
    setFamilias(prev =>
      prev.map(f => {
        if (String(f.id_familia) !== String(id_familia)) return f;
        return {
          ...f,
          miembros_activos: (Number(f.miembros_activos) || 0) + deltaActivos,
          miembros_totales: (Number(f.miembros_totales) || 0) + deltaTotales,
        };
      })
    );
    setFamiliaSeleccionada(prev => {
      if (!prev || String(prev.id_familia) !== String(id_familia)) return prev;
      return {
        ...prev,
        miembros_activos: (Number(prev.miembros_activos) || 0) + deltaActivos,
        miembros_totales: (Number(prev.miembros_totales) || 0) + deltaTotales,
      };
    });
  }, []);

  return (
    <div className="fam-wrap">
      {toast.mostrar && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
          duracion={2400}
        />
      )}

      <div className="fam-header">
        <button className="fam-back" onClick={() => navigate('/alumnos')}>
          <FaArrowLeft /> Volver
        </button>
        <h1><FaUsers /> Grupos Familiares</h1>
      </div>

      <div className="fam-toolbar">
        <div className="fam-search">
          <FaSearch />
          <input
            placeholder="Buscar familia..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="fam-btn solid"
          onClick={() => { setEditFamilia(null); setModalFamiliaOpen(true); }}
        >
          <FaPlus /> Nueva familia
        </button>
      </div>

      <div className="fam-table">
        <div className="fam-thead">
          <div>Apellido</div>
          <div>Observaciones</div>
          <div>Fecha alta</div>
          <div>Miembros</div>
          <div>Acciones</div>
        </div>

        <div className="fam-tbody">
          {loading ? (
            <div className="fam-empty">Cargando...</div>
          ) : filtradas.length === 0 ? (
            <div className="fam-empty">Sin resultados</div>
          ) : (
            filtradas.map((f) => {
              const apellido = toUpperSafe(f.nombre_familia);
              const obs = toUpperSafe(f.observaciones);

              return (
                <div key={f.id_familia} className="fam-row">
                  <div title={apellido}>{apellido}</div>
                  <div title={obs} className="fam-obs">
                    {obs && obs.length > 64 ? `${obs.slice(0, 64)}…` : obs}
                  </div>
                  <div title={f.fecha_alta || f.creado_en || ''}>
                    {f.fecha_alta ? f.fecha_alta : fmtFechaSolo(f.creado_en)}
                  </div>
                  {/* Solo un número: total de miembros */}
                  <div>
                    {Number(f.miembros_totales) || 0}
                  </div>
                  <div className="fam-actions">
                    <button title="Gestionar miembros" onClick={() => abrirMiembros(f)}>
                      <FaLink />
                    </button>
                    <button title="Editar" onClick={() => { setEditFamilia(f); setModalFamiliaOpen(true); }}>
                      <FaEdit />
                    </button>
                    <button title="Eliminar" className="danger" onClick={() => onEliminarFamilia(f)}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ModalFamilia
        open={modalFamiliaOpen}
        familia={editFamilia}
        onClose={() => { setModalFamiliaOpen(false); setEditFamilia(null); }}
        onSave={onGuardarFamilia}
      />

      <ModalMiembros
        open={modalMiembrosOpen}
        familia={familiaSeleccionada}
        onClose={() => { setModalMiembrosOpen(false); setFamiliaSeleccionada(null); }}
        notify={showToast}
        onDeltaCounts={onDeltaCounts}
      />
    </div>
  );
}
