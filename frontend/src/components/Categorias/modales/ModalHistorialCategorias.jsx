// ✅ REEMPLAZAR COMPLETO
// src/components/Categorias/modales/ModalHistorialCategorias.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faClockRotateLeft,
  faArrowTrendUp,
  faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons';

import '../Categorias.css';

/* =========================
   Utils
========================= */
const fmtARS = (n) =>
  (n === null || n === undefined || n === '')
    ? '—'
    : Number(n).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      });

const formatDate = (iso) => {
  if (!iso) return '—';
  // admite "2026-02-26 19:06:53" o "2026-02-26T19:06:53"
  const s = iso.toString().slice(0, 10);
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
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

/* =========================
   Modal base (accesible)
========================= */
const ModalBase = ({ open, title, onClose, children, width = 920 }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cat_modal" role="dialog" aria-modal="true" aria-labelledby="cat_modal_title" onClick={onClose}>
      <div className="cat_modal_card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
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

/* =========================
   Modal Historial con tabs
========================= */
const ModalHistorialCategorias = ({ open, onClose, categoria, BASE_URL, notify }) => {
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState('base');

  const [baseHist, setBaseHist] = useState([]);
  const [hermanosCants, setHermanosCants] = useState([]);
  const [hermHistAll, setHermHistAll] = useState([]);

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }
    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  };

  const catId = categoria?.id;

  useEffect(() => {
    if (!open) return;
    setTab('base');
    setBaseHist([]);
    setHermanosCants([]);
    setHermHistAll([]);
  }, [open, catId]);

  useEffect(() => {
    const run = async () => {
      if (!open || !catId) return;

      try {
        setLoading(true);

        // 1) Historial base
        const jBase = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_historial&id=${encodeURIComponent(catId)}`
        );

        let filasBase = [];
        if (Array.isArray(jBase)) filasBase = jBase;
        else if (jBase?.historial) filasBase = jBase.historial;
        else if (jBase?.exito && Array.isArray(jBase?.data)) filasBase = jBase.data;
        else filasBase = jBase?.resultados || [];

        const normBase = filasBase.map((r) => ({
          tipo: (r.tipo ?? 'BASE').toString(),
          precio_anterior: (r.precio_anterior ?? r.anterior ?? r.old ?? null),
          precio_nuevo: (r.precio_nuevo ?? r.nuevo ?? r.new ?? null),
          fecha: (r.fecha_cambio ?? r.fecha ?? '').toString(),
        }));

        setBaseHist(normBase);

        // 2) Hermanos listar (para tabs)
        const jH = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_hermanos_listar&id_cat_monto=${encodeURIComponent(catId)}`
        );
        const itemsH = Array.isArray(jH?.items) ? jH.items : [];
        const cants = [...new Set(itemsH.map((x) => Number(x.cantidad_hermanos)).filter((n) => Number.isFinite(n) && n >= 2))];
        cants.sort((a, b) => a - b);
        setHermanosCants(cants);

        // 3) Historial hermanos (NUEVO: tipo/anterior/nuevo)
        const jHH = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_hermanos_historial&id_cat_monto=${encodeURIComponent(catId)}`
        );
        const filasHH = Array.isArray(jHH?.historial) ? jHH.historial : [];
        setHermHistAll(filasHH);

        if (!normBase.length && cants.length === 0) {
          notify?.('info', 'No hay historial ni configuración de grupos familiares para esta categoría.');
        }

      } catch (e) {
        console.error(e);
        notify?.('error', `No se pudo cargar el historial: ${e.message}`);
        onClose?.();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, catId, BASE_URL, onClose, notify]);

  const tabs = useMemo(() => {
    const t = [{ key: 'base', label: 'BASE' }];
    for (const cant of (hermanosCants || [])) {
      t.push({ key: `h_${cant}`, label: `${cant} Hermanos` });
    }
    return t;
  }, [hermanosCants]);

  // ✅ Rows para hermanos con la NUEVA estructura (tipo/anterior/nuevo)
  const hermanosRows = useMemo(() => {
    if (!tab.startsWith('h_')) return [];
    const cant = Number(tab.replace('h_', ''));

    const filtered = (hermHistAll || [])
      .filter((r) => Number(r.cantidad_hermanos) === cant)
      .map((r) => ({
        tipo: (r.tipo ?? '').toString(), // MENSUAL / ANUAL
        anterior: r.precio_anterior ?? null,
        nuevo: r.precio_nuevo ?? null,
        fecha: (r.fecha_cambio ?? '').toString(),
      }));

    // orden: fecha desc
    filtered.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    return filtered;
  }, [tab, hermHistAll]);

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faClockRotateLeft} />
          Historial · {categoria?.descripcion || ''}
        </span>
      }
      width={980}
    >
      {/* Tabs */}
      <div className="cat_hist_tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`cat_hist_tab_btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            disabled={loading}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cat_hist_loading">Cargando historial…</div>
      ) : (
        <>
          {/* BASE */}
          {tab === 'base' ? (
            baseHist.length === 0 ? (
              <div className="cat_hist_empty">No hay historial BASE para esta categoría.</div>
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
                    {baseHist.map((h, i) => (
                      <tr key={i}>
                        <td className="cat_td_center">{i + 1}</td>
                        <td className="cat_td_center">{h.tipo || 'BASE'}</td>
                        <td className="cat_td_right">{fmtARS(h.precio_anterior)}</td>
                        <td className="cat_td_right">{fmtARS(h.precio_nuevo)}</td>
                        <td className="cat_td_center">{renderCambio(h.precio_anterior, h.precio_nuevo)}</td>
                        <td className="cat_td_center">{formatDate(h.fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* HERMANOS (NUEVO) */
            hermanosRows.length === 0 ? (
              <div className="cat_hist_empty">No hay historial para este grupo familiar.</div>
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
                    {hermanosRows.map((r, i) => (
                      <tr key={i}>
                        <td className="cat_td_center">{i + 1}</td>
                        <td className="cat_td_center">{r.tipo || '—'}</td>
                        <td className="cat_td_right">{fmtARS(r.anterior)}</td>
                        <td className="cat_td_right">{fmtARS(r.nuevo)}</td>
                        <td className="cat_td_center">{renderCambio(r.anterior, r.nuevo)}</td>
                        <td className="cat_td_center">{formatDate(r.fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </ModalBase>
  );
};

export default ModalHistorialCategorias;