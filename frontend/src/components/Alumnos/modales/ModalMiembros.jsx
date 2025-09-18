// src/components/Familias/modales/ModalMiembros.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { FaTimes, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import './ModalMiembros.css';

/* ====== TUNING ====== */
const ROW_HEIGHT = 68;   // alto aprox. de cada ítem (coincidir con CSS)
const OVERSCAN   = 10;
const VIEWPORT_H = 360;

function Avatar({ name = '?' }) {
  const i = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return <div className="mm_avatar" aria-hidden>{i}</div>;
}

export default function ModalMiembros({ open, onClose, familia, notify, onDeltaCounts }) {
  const [miembros, setMiembros] = useState([]);
  const [allRows, setAllRows]   = useState([]);
  const [q, setQ]               = useState('');
  const [sel, setSel]           = useState(() => new Set());
  const [loading, setLoading]   = useState(false);

  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const onScrollList = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), []);

  useEffect(() => {
    if (!open || !familia) return;
    setQ('');
    setSel(new Set());
    setAllRows([]);
    setScrollTop(0);
    cargarMiembros();
    cargarTodosLosCandidatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familia?.id_familia]);

  const cargarMiembros = async () => {
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=familia_miembros&id_familia=${familia.id_familia}&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const rows = (j?.miembros || []).map(a => ({
        id_alumno: a.id_alumno ?? a.id ?? a.idAlumno,
        nombre: a.nombre_completo
          ? a.nombre_completo
          : [a.apellido, a.nombre].filter(Boolean).join(', '),
        dni: a.dni ?? a.num_documento ?? '',
        domicilio: a.domicilio ?? '',
        localidad: a.localidad ?? '',
        activo: Number(a.activo ?? 1)
      }));
      setMiembros(rows);
    } catch {
      notify?.('Error al obtener miembros', 'error');
    }
  };

  const cargarTodosLosCandidatos = async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=alumnos_sin_familia&all=1&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const rows = (j?.alumnos || []).map(a => {
        const nombre = a.nombre_completo
          ? a.nombre_completo
          : [a.apellido, a.nombre].filter(Boolean).join(', ');
        const dni = a.dni ?? a.num_documento ?? '';
        return {
          id_alumno: a.id_alumno ?? a.id ?? a.idAlumno,
          nombre,
          dni,
          domicilio: a.domicilio ?? '',
          localidad: a.localidad ?? '',
          activo: Number(a.activo ?? 1),
          searchKey: `${nombre} ${dni}`.toLowerCase()
        };
      });
      setAllRows(rows);
    } catch {
      // fallback legacy
      try {
        const r2 = await fetch(
          `${BASE_URL}/api.php?action=socios_sin_familia&ts=${Date.now()}`,
          { cache: 'no-store' }
        );
        const j2 = await r2.json();
        const rows = (j2?.alumnos || j2?.socios || []).map(a => {
          const nombre = a.nombre_completo ??
            (a.nombre || [a.apellido, a.nombre].filter(Boolean).join(', '));
          const dni = a.dni ?? a.num_documento ?? '';
          return {
            id_alumno: a.id_alumno ?? a.id_socio ?? a.id ?? a.idAlumno,
            nombre,
            dni,
            domicilio: a.domicilio ?? '',
            localidad: a.localidad ?? '',
            activo: Number(a.activo ?? 1),
            searchKey: `${nombre} ${dni}`.toLowerCase()
          };
        });
        setAllRows(rows);
      } catch {
        notify?.('Error al obtener alumnos sin familia', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!term) return allRows;
    return allRows.filter(r => r.searchKey.includes(term));
  }, [allRows, term]);

  // Virtualización
  const total = rows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    total,
    Math.ceil((scrollTop + VIEWPORT_H) / ROW_HEIGHT) + OVERSCAN
  );
  const visible   = rows.slice(startIndex, endIndex);
  const padTop    = startIndex * ROW_HEIGHT;
  const padBottom = Math.max(0, (total - endIndex) * ROW_HEIGHT);

  const toggleSel = (id) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const agregarSeleccionados = async () => {
    if (sel.size === 0) return;
    const mapSel = new Set(sel);
    const toAdd = rows.filter(c => mapSel.has(c.id_alumno));
    if (toAdd.length === 0) return;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_agregar_miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_familia: familia.id_familia,
          ids_alumno: toAdd.map(x => x.id_alumno),
        }),
      });
      const j = await r.json();
      if (!j?.exito) {
        notify?.(j?.mensaje || 'No se pudo agregar', 'error');
        return;
      }

      setMiembros(prev => [...prev, ...toAdd.map(c => ({
        id_alumno: c.id_alumno,
        nombre: c.nombre,
        dni: c.dni,
        domicilio: c.domicilio,
        localidad: c.localidad,
        activo: c.activo
      }))]);

      setAllRows(prev => prev.filter(c => !mapSel.has(c.id_alumno)));
      setSel(new Set());

      const deltaTotales = toAdd.length;
      const deltaActivos = toAdd.reduce((acc, c) => acc + (Number(c.activo) === 1 ? 1 : 0), 0);
      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos, deltaTotales });

      notify?.('Miembros agregados');
    } catch {
      notify?.('Error al agregar miembros', 'error');
    }
  };

  const quitarMiembro = async (id_alumno) => {
    if (!window.confirm('¿Quitar este miembro de la familia?')) return;

    const m = miembros.find(x => x.id_alumno === id_alumno);
    const eraActivo = Number(m?.activo) === 1;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_quitar_miembro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno })
      });
      const j = await r.json();
      if (!j?.exito) {
        notify?.(j?.mensaje || 'No se pudo quitar', 'error');
        return;
      }

      setMiembros(prev => prev.filter(x => x.id_alumno !== id_alumno));

      if (m && eraActivo) {
        const back = {
          id_alumno: m.id_alumno,
          nombre: m.nombre,
          dni: m.dni,
          domicilio: m.domicilio,
          localidad: m.localidad,
          activo: m.activo,
          searchKey: `${m.nombre} ${m.dni}`.toLowerCase(),
        };
        setAllRows(prev => (prev.some(x => x.id_alumno === back.id_alumno) ? prev : [back, ...prev]));
      }

      onDeltaCounts?.({
        id_familia: familia.id_familia,
        deltaActivos: eraActivo ? -1 : 0,
        deltaTotales: -1
      });

      notify?.('Miembro quitado');
    } catch {
      notify?.('Error al quitar miembro', 'error');
    }
  };

  if (!open || !familia) return null;

  return (
    <div className="mm_overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mm_modal" onClick={e => e.stopPropagation()}>
        {/* HEADER AZUL */}
        <div className="mm_head">
          <div className="mm_head_left">
            <span className="mm_led" aria-hidden />
            <h3>Miembros de “{familia.nombre_familia}”</h3>
          </div>
          <button className="mm_close" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        {/* BODY */}
        <div className="mm_body">
          {/* Columna izquierda: miembros actuales */}
          <div className="mm_col">
            <h4 className="mm_coltitle">Miembros actuales</h4>
            <div className="mm_list" data-fixed>
              {miembros.length === 0 ? (
                <div className="mm_empty">Sin miembros</div>
              ) : miembros.map(m => {
                  const statusCls = Number(m.activo) === 1 ? 'status-active' : 'status-inactive';
                  return (
                    <div key={m.id_alumno} className={`mm_item ${statusCls}`} style={{ minHeight: ROW_HEIGHT }}>
                      <div className="mm_flag" aria-hidden />
                      <Avatar name={m.nombre} />
                      <div className="mm_main">
                        <strong className="mm_name">{m.nombre}</strong>
                        {/* DNI + Localidad en la misma línea */}
                        <small className="mm_meta">
                          DNI: {m.dni || '—'}{m.localidad ? ` • ${m.localidad}` : ''}
                        </small>
                        {Number(m.activo) !== 1 && <small className="mm_badge danger">Inactivo</small>}
                      </div>
                      <div className="mm_actions">
                        <button className="danger" title="Quitar" onClick={() => quitarMiembro(m.id_alumno)}>
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Columna derecha: candidatos */}
          <div className="mm_col">
            <div className="mm_colhdr">
              <h4 className="mm_coltitle">Agregar socios</h4>
              <div className="mm_search">
                <FaSearch className="mm_search_icon" />
                <input
                  placeholder="Buscar por nombre o DNI..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  aria-label="Buscar alumnos"
                />
              </div>
            </div>

            <div
              className="mm_list"
              data-fixed
              ref={listRef}
              onScroll={onScrollList}
              style={{ position: 'relative', overflow: 'auto', height: VIEWPORT_H }}
            >
              <div style={{ height: padTop }} />
              {visible.length === 0 && !loading ? (
                <div className="mm_empty">{term ? 'Sin resultados' : 'No hay alumnos disponibles'}</div>
              ) : (
                visible.map(c => {
                  const checked = sel.has(c.id_alumno);
                  const statusCls = Number(c.activo) === 1 ? 'status-active' : 'status-inactive';
                  return (
                    <label
                      key={c.id_alumno}
                      className={`mm_item sel ${statusCls} ${checked ? 'checked' : ''}`}
                      style={{ minHeight: ROW_HEIGHT }}
                    >
                      <div className="mm_flag" aria-hidden />
                      <input
                        className="mm_check"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSel(c.id_alumno)}
                      />
                      <div className="mm_main">
                        <strong className="mm_name">{c.nombre}</strong>
                        {/* DNI + Localidad en la misma línea */}
                        <small className="mm_meta">
                          DNI: {c.dni || '—'}{c.localidad ? ` • ${c.localidad}` : ''}
                        </small>
                        {Number(c.activo) !== 1 && <small className="mm_badge danger">Inactivo</small>}
                      </div>
                    </label>
                  );
                })
              )}
              <div style={{ height: padBottom }} />
              {loading && <div className="mm_empty">Cargando…</div>}
            </div>
          </div>
        </div>

        {/* FOOTER (Cerrar + Agregar seleccionados) */}
        <div className="mm_foot">
          <button className="mm_btn ghost" onClick={onClose}>Cerrar</button>
          <button
            className="mm_btn solid"
            onClick={agregarSeleccionados}
            disabled={sel.size === 0}
            title={sel.size === 0 ? 'Seleccioná al menos uno' : 'Agregar seleccionados'}
          >
            <FaPlus /> Agregar seleccionados ({sel.size})
          </button>
        </div>
      </div>
    </div>
  );
}
