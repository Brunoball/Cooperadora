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
const ROW_HEIGHT = 64;   // alto aprox. de cada ítem para virtualización
const OVERSCAN   = 10;   // ítems extra arriba/abajo
const VIEWPORT_H = 360;  // alto del contenedor de la lista (ajustá si tu CSS fija otro)

export default function ModalMiembros({ open, onClose, familia, notify, onDeltaCounts }) {
  // miembros actuales
  const [miembros, setMiembros] = useState([]);

  // listado completo de alumnos activos sin familia
  const [allRows, setAllRows]   = useState([]);    // dataset completo
  const [q, setQ]               = useState('');    // búsqueda instantánea
  const [sel, setSel]           = useState(() => new Set());
  const [loading, setLoading]   = useState(false);

  // scroll + virtualización
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const onScrollList = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // reset cuando abrís/cambiás familia
  useEffect(() => {
    if (!open || !familia) return;
    setQ('');
    setSel(new Set());
    setAllRows([]);
    setScrollTop(0);
    cargarMiembros();
    cargarTodosLosCandidatos(); // una sola vez por apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familia?.id_familia]);

  /* =======================
     Fetch miembros actuales
  ======================= */
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

  /* ===========================================
     Cargar TODOS los alumnos sin familia (1 shot)
  =========================================== */
  const cargarTodosLosCandidatos = async () => {
    setLoading(true);
    try {
      // all=1 => backend devuelve TODOS los activos sin familia
      const r = await fetch(
        `${BASE_URL}/api.php?action=alumnos_sin_familia&all=1&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // Normalizo y creo una "searchKey" ya en minúsculas para filtro instantáneo
      const rows = (j?.alumnos || []).map(a => {
        const nombre = a.nombre_completo
          ? a.nombre_completo
          : [a.apellido, a.nombre].filter(Boolean).join(', ');
        const dni = a.dni ?? a.num_documento ?? '';
        const dom = a.domicilio ?? '';
        const loc = a.localidad ?? '';
        return {
          id_alumno: a.id_alumno ?? a.id ?? a.idAlumno,
          nombre,
          dni,
          domicilio: dom,
          localidad: loc,
          activo: Number(a.activo ?? 1),
          searchKey: `${nombre} ${dni}`.toLowerCase()
        };
      });

      setAllRows(rows);
    } catch (e) {
      // fallback de compat si aún existe alias legacy
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
          const dom = a.domicilio ?? '';
          const loc = a.localidad ?? '';
          return {
            id_alumno: a.id_alumno ?? a.id_socio ?? a.id ?? a.idAlumno,
            nombre,
            dni,
            domicilio: dom,
            localidad: loc,
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

  /* ============================
     Filtro instantáneo en cliente
  ============================ */
  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!term) return allRows;
    // búsqueda instantánea gracias a searchKey precalculada
    return allRows.filter(r => r.searchKey.includes(term));
  }, [allRows, term]);

  /* ======================
     Virtualización simple
  ====================== */
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

      // Optimista
      setMiembros(prev => [...prev, ...toAdd.map(c => ({
        id_alumno: c.id_alumno,
        nombre: c.nombre,
        dni: c.dni,
        domicilio: c.domicilio,
        localidad: c.localidad,
        activo: c.activo
      }))]);

      // Remover del dataset completo
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

      // volver a ponerlo en la lista global si matchea el filtro actual
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
        setAllRows(prev => {
          if (prev.some(x => x.id_alumno === back.id_alumno)) return prev;
          return [back, ...prev];
        });
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
        <div className="mm_head">
          <h3>Miembros de “{familia.nombre_familia}”</h3>
          <button className="mm_close" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="mm_body">
          {/* Columna izquierda: miembros actuales */}
          <div className="mm_col">
            <h4>Miembros actuales</h4>
            <div className="mm_list" data-fixed>
              {miembros.length === 0 ? (
                <div className="mm_empty">Sin miembros</div>
              ) : miembros.map(m => {
                  const statusCls = Number(m.activo) === 1 ? 'status-active' : 'status-inactive';
                  return (
                    <div key={m.id_alumno} className={`mm_item ${statusCls}`} style={{ minHeight: ROW_HEIGHT }}>
                      <div className="mm_main">
                        <strong>{m.nombre}</strong>
                        <small>DNI: {m.dni || '—'}</small>
                        <small>{[m.domicilio, m.localidad].filter(Boolean).join(' • ')}</small>
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

          {/* Columna derecha: candidatos (activos sin familia) */}
          <div className="mm_col">
            <h4>Agregar alumnos</h4>

            <div className="mm_search">
              <FaSearch />
              <input
                placeholder="Buscar por apellido/nombre o DNI…"
                value={q}
                onChange={e => setQ(e.target.value)}
                aria-label="Buscar alumnos"
              />
            </div>

            {/* Lista con virtualización (dataset completo ya cargado) */}
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
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSel(c.id_alumno)}
                      />
                      <div className="mm_main">
                        <strong>{c.nombre}</strong>
                        <small>DNI: {c.dni || '—'}</small>
                        <small>{[c.domicilio, c.localidad].filter(Boolean).join(' • ')}</small>
                        {Number(c.activo) !== 1 && <small className="mm_badge danger">Inactivo</small>}
                      </div>
                    </label>
                  );
                })
              )}
              <div style={{ height: padBottom }} />
              {loading && <div className="mm_empty">Cargando…</div>}
            </div>

            <div className="mm_footer_right">
              <button className="mm_btn solid" onClick={agregarSeleccionados} disabled={sel.size === 0}>
                <FaPlus /> Agregar seleccionados ({sel.size})
              </button>
            </div>
          </div>
        </div>

        <div className="mm_foot">
          <button className="mm_btn ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
