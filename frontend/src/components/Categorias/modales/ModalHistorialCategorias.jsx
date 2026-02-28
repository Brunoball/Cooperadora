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
   fetchJSON con timeout + abort
========================= */
async function fetchJSON(url, { signal, timeoutMs = 12000, ...options } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();

    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }

    if (!res.ok) throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/* =========================
   Modal Historial optimizado
========================= */
const ModalHistorialCategorias = ({ open, onClose, categoria, BASE_URL }) => {
  const catId = categoria?.id;

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('base');

  const [baseHist, setBaseHist] = useState([]);
  const [hermanosCants, setHermanosCants] = useState([]);
  const [hermHistAll, setHermHistAll] = useState([]);

  // ✅ Estado “vacío real” (sin historial y sin config)
  const [emptyMsg, setEmptyMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('base');
    setBaseHist([]);
    setHermanosCants([]);
    setHermHistAll([]);
    setEmptyMsg('');
  }, [open, catId]);

  useEffect(() => {
    if (!open || !catId) return;

    const ac = new AbortController();

    const run = async () => {
      try {
        setLoading(true);

        // =========================
        // 1) Historial BASE (siempre)
        // =========================
        const jBase = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_historial&id=${encodeURIComponent(catId)}`,
          { signal: ac.signal, timeoutMs: 12000 }
        );

        let filasBase = [];
        if (Array.isArray(jBase)) filasBase = jBase;
        else if (Array.isArray(jBase?.historial)) filasBase = jBase.historial;
        else if (jBase?.exito && Array.isArray(jBase?.data)) filasBase = jBase.data;
        else filasBase = jBase?.resultados || [];

        const normBase = (filasBase || []).map((r) => ({
          tipo: (r.tipo ?? 'BASE').toString(),
          precio_anterior: (r.precio_anterior ?? r.anterior ?? r.old ?? null),
          precio_nuevo: (r.precio_nuevo ?? r.nuevo ?? r.new ?? null),
          fecha: (r.fecha_cambio ?? r.fecha ?? '').toString(),
        }));

        setBaseHist(normBase);

        // =========================
        // 2) Config hermanos (para tabs)
        // =========================
        const jH = await fetchJSON(
          `${BASE_URL}/api.php?action=cat_hermanos_listar&id_cat_monto=${encodeURIComponent(catId)}`,
          { signal: ac.signal, timeoutMs: 12000 }
        );

        const itemsH = Array.isArray(jH?.items) ? jH.items : (Array.isArray(jH) ? jH : []);
        const cants = [...new Set(
          (itemsH || [])
            .map((x) => Number(x.cantidad_hermanos))
            .filter((n) => Number.isFinite(n) && n >= 2)
        )].sort((a, b) => a - b);

        setHermanosCants(cants);

        // ✅ Si NO hay historial base y NO hay config, cortamos acá (NO pedimos historial hermanos)
        //    (igual mostramos badge "sin historial" en BASE)
if (normBase.length === 0 && cants.length === 0) {
  setHermHistAll([]);
  setEmptyMsg('No hay historial ni configuración de grupos familiares para esta categoría.');
  return;
}

        // =========================
        // 3) Historial hermanos (SOLO si hay config)
        // =========================
        if (cants.length > 0) {
          const jHH = await fetchJSON(
            `${BASE_URL}/api.php?action=cat_hermanos_historial&id_cat_monto=${encodeURIComponent(catId)}`,
            { signal: ac.signal, timeoutMs: 12000 }
          );

          const filasHH = Array.isArray(jHH?.historial)
            ? jHH.historial
            : (Array.isArray(jHH) ? jHH : []);

          setHermHistAll(filasHH || []);
        } else {
          setHermHistAll([]);
        }

      } catch (e) {
        if (e?.name === 'AbortError') return;
        console.error(e);
        setEmptyMsg(`No se pudo cargar el historial: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    run();

    return () => ac.abort();
  }, [open, catId, BASE_URL]);

  // ✅ Tabs con indicador "sin historial" al lado
  const tabs = useMemo(() => {
    const t = [{
      key: 'base',
      label: 'BASE',
      empty: (baseHist?.length || 0) === 0,
    }];

    for (const cant of (hermanosCants || [])) {
      const hasRows = (hermHistAll || []).some(
        (r) => Number(r.cantidad_hermanos) === Number(cant)
      );

      t.push({
        key: `h_${cant}`,
        label: `${cant} Hermanos`,
        empty: !hasRows,
      });
    }

    return t;
  }, [hermanosCants, baseHist, hermHistAll]);

  const hermanosRows = useMemo(() => {
    if (!tab.startsWith('h_')) return [];
    const cant = Number(tab.replace('h_', ''));

    const filtered = (hermHistAll || [])
      .filter((r) => Number(r.cantidad_hermanos) === cant)
      .map((r) => ({
        tipo: (r.tipo ?? '').toString(),
        anterior: r.precio_anterior ?? r.anterior ?? null,
        nuevo: r.precio_nuevo ?? r.nuevo ?? null,
        fecha: (r.fecha_cambio ?? r.fecha ?? '').toString(),
      }))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

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
      <div className="cat_hist_tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`cat_hist_tab_btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            disabled={loading}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.empty && !loading && (
                <span className="cat_hist_badge_empty">sin historial</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cat_hist_loading">Cargando historial…</div>
      ) : (
        <>
          {/* ✅ Solo mostramos mensaje grande si es ERROR (emptyMsg) */}
          {emptyMsg ? (
            <div className="cat_hist_empty">{emptyMsg}</div>
          ) : tab === 'base' ? (
            // ✅ En BASE: si está vacío, NO mostramos caja grande (solo badge al lado del tab)
            baseHist.length === 0 ? null : (
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
                        <td className="cat_td_center" data-label="#"> {i + 1} </td>
                        <td className="cat_td_center" data-label="Tipo">{h.tipo || 'BASE'}</td>
                        <td className="cat_td_right" data-label="Monto anterior">{fmtARS(h.precio_anterior)}</td>
                        <td className="cat_td_right" data-label="Monto nuevo">{fmtARS(h.precio_nuevo)}</td>
                        <td className="cat_td_center" data-label="Cambio">{renderCambio(h.precio_anterior, h.precio_nuevo)}</td>
                        <td className="cat_td_center" data-label="Fecha">{formatDate(h.fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            // Hermanos: si está vacío, tampoco mostramos caja grande; el badge ya lo indica
            hermanosRows.length === 0 ? null : (
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
                        <td className="cat_td_center" data-label="#"> {i + 1} </td>
                        <td className="cat_td_center" data-label="Tipo">{r.tipo || '—'}</td>
                        <td className="cat_td_right" data-label="Monto anterior">{fmtARS(r.anterior)}</td>
                        <td className="cat_td_right" data-label="Monto nuevo">{fmtARS(r.nuevo)}</td>
                        <td className="cat_td_center" data-label="Cambio">{renderCambio(r.anterior, r.nuevo)}</td>
                        <td className="cat_td_center" data-label="Fecha">{formatDate(r.fecha)}</td>
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