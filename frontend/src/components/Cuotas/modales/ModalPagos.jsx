// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

// Usamos el named export del util
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';

/* ====== Config ====== */
const PRECIO_MENSUAL = 4000;
const MIN_YEAR = 2025; // el sistema existe desde 2025

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

const ModalPagos = ({ socio, onClose }) => {
  const nowYear = new Date().getFullYear();

  const [meses, setMeses] = useState([]);                     // [{ id, nombre }]
  const [periodosPagados, setPeriodosPagados] = useState([]); // [id_mes,...] (del año elegido)
  const [seleccionados, setSeleccionados] = useState([]);     // [id_mes,...]
  const [fechaIngreso, setFechaIngreso] = useState('');       // 'YYYY-MM-DD'
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  // Vista de éxito con botón "Comprobante"
  const [pagoExitoso, setPagoExitoso] = useState(false);

  // Condonar + selector de año
  const [condonar, setCondonar] = useState(false);
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  // Tolerancia de ID desde distintas fuentes
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  /* ================= Helpers ================= */
  const formatearFecha = (f) => {
    if (!f) return '—';
    const parts = String(f).split('-'); // [yyyy, mm, dd]
    if (parts.length !== 3) return f;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  const mesesDisponibles = useMemo(() => meses, [meses]);

  const total = condonar ? 0 : seleccionados.length * PRECIO_MENSUAL;

  // Texto tipo “ENE / FEB / MAR 2025”
  const periodoTextoFinal = useMemo(() => {
    if (seleccionados.length === 0) return '';
    const mapById = new Map(mesesDisponibles.map(m => [Number(m.id), m.nombre]));
    const nombres = seleccionados
      .map(Number)
      .sort((a,b)=>a-b)
      .map(id => (mapById.get(id) || String(id)).trim());
    return `${nombres.join(' / ')} ${anioTrabajo}`;
  }, [seleccionados, mesesDisponibles, anioTrabajo]);

  /* ================= Efectos ================= */
  useEffect(() => { setSeleccionados([]); }, [idAlumno, anioTrabajo]);

  useEffect(() => {
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => !periodosPagados.includes(Number(id)));

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
  }, [seleccionados, mesesDisponibles, periodosPagados]);

  useEffect(() => {
    const cargar = async () => {
      if (!idAlumno) {
        console.error('ModalPagos: idAlumno inválido ->', idAlumno, socio);
        mostrarToast('error', 'No se recibió el ID del alumno.');
        return;
      }
      setCargando(true);
      try {
        const urlListas  = `${BASE_URL}/api.php?action=obtener_listas`;
        const urlPagados = `${BASE_URL}/api.php?action=meses_pagados&id_alumno=${encodeURIComponent(idAlumno)}&anio=${encodeURIComponent(anioTrabajo)}`;

        const [resListas, resPagados] = await Promise.all([
          fetch(urlListas, { method: 'GET' }),
          fetch(urlPagados, { method: 'GET' }),
        ]);

        if (!resListas.ok) throw new Error(`obtener_listas HTTP ${resListas.status}`);
        if (!resPagados.ok) throw new Error(`meses_pagados HTTP ${resPagados.status}`);

        const [dataListas, dataPagados] = await Promise.all([resListas.json(), resPagados.json()]);

        if (dataListas?.exito) {
          const arrMeses = Array.isArray(dataListas?.listas?.meses) ? dataListas.listas.meses : [];
          const norm = arrMeses
            .map((m) => ({ id: Number(m.id), nombre: m.nombre }))
            .sort((a, b) => a.id - b.id);
          setMeses(norm);
        } else {
          setMeses([]);
          mostrarToast('advertencia', dataListas?.mensaje || 'No se pudieron cargar los meses.');
        }

        if (dataPagados?.exito) {
          const arrIds = Array.isArray(dataPagados.meses_pagados)
            ? dataPagados.meses_pagados
            : (Array.isArray(dataPagados.periodos_pagados) ? dataPagados.periodos_pagados : []);
          const ya = arrIds.map(Number);
          setPeriodosPagados(ya);
          setFechaIngreso(dataPagados.ingreso || '');
        } else {
          setPeriodosPagados([]);
          mostrarToast('advertencia', dataPagados?.mensaje || 'No se pudo cargar el estado de pagos.');
        }
      } catch (e) {
        console.error('ModalPagos cargar() error:', e);
        mostrarToast('error', String(e.message || e));
      } finally {
        setCargando(false);
      }
    };

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno, anioTrabajo]);

  /* ================= Acciones ================= */
  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (periodosPagados.includes(idNum)) return;
    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => !periodosPagados.includes(id));

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');
    if (seleccionados.length === 0) return mostrarToast('advertencia', 'Seleccioná al menos un mes.');

    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno: Number(idAlumno),
          periodos: seleccionados.map(Number),
          condonar: !!condonar,
          anio: Number(anioTrabajo),
        }),
      });

      if (!res.ok) throw new Error(`registrar_pago HTTP ${res.status}`);

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        // Cambiamos a la pantalla de éxito (no cerramos aún)
        setPagoExitoso(true);

        // Marcamos como pagados en memoria por si vuelve atrás
        setPeriodosPagados(prev => {
          const set = new Set(prev);
          seleccionados.forEach(id => set.add(Number(id)));
          return Array.from(set);
        });
      } else {
        if (Array.isArray(data?.ya_registrados) && data.ya_registrados.length > 0) {
          const txt = data.ya_registrados.map(x => `${x.periodo} (${(x.estado || '').toUpperCase()})`).join(', ');
          mostrarToast('advertencia', `Ya registrados: ${txt}`);
        } else {
          mostrarToast('error', data?.mensaje || 'No se pudo registrar.');
        }
      }
    } catch (e) {
      console.error('ModalPagos confirmarPago() error:', e);
      mostrarToast('error', String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  // === Impresión usando tu util; NO hacemos win.print() aquí (el util ya lo hace) ===
  const handleImprimirComprobante = async () => {
    const periodoCodigo = [...seleccionados].map(Number).sort((a,b)=>a-b)[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodo_texto: periodoTextoFinal,
      importe_total: total,
      anio: anioTrabajo,
    };

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir el comprobante.');

    // El util escribe el HTML y ejecuta window.print() en onload
    await imprimirRecibos([alumnoParaImprimir], periodoCodigo, win);
  };

  if (!socio) return null;

  /* ================= VISTA: ÉXITO ================= */
  if (pagoExitoso) {
    const tituloExito = condonar ? '¡Condonación registrada con éxito!' : '¡Pago realizado con éxito!';
    const subExito = 'Se generará el comprobante a continuación.';

    return (
      <>
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido">
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">Registro de Pagos</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose?.(true)} disabled={cargando} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="success-card">
                <h3 className="success-title">{tituloExito}</h3>
                <p className="success-sub">{subExito}</p>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  Total: {formatearARS(total)}
                </span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose?.(true)} type="button">
                  Cerrar
                </button>
                <button className="btn btn-primary" onClick={handleImprimirComprobante} type="button">
                  Comprobante
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ================= VISTA: NORMAL ================= */
  return (
    <>
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle">
                <FaCoins size={20} />
              </div>
              <h2 className="modal-title">Registro de Pagos / Condonar</h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose?.(false)} disabled={cargando} aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div className="socio-info-card">
              <div className="socio-info-header">
                <h3 className="socio-nombre">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Caja condonar + selector de año */}
            <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={condonar}
                  onChange={(e) => setCondonar(e.target.checked)}
                  disabled={cargando}
                />
                <span className="switch">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">
                  Marcar como <strong>Condonado</strong> (no genera cobro)
                </span>
              </label>

              <div className="year-picker">
                <button
                  type="button"
                  className="year-button"
                  onClick={() => setShowYearPicker((s) => !s)}
                  disabled={cargando}
                  title="Cambiar año"
                >
                  <FaCalendarAlt />
                  <span>{anioTrabajo}</span>
                </button>

                {showYearPicker && (
                  <div className="year-popover" onMouseLeave={() => setShowYearPicker(false)}>
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        className={`year-item ${y === anioTrabajo ? 'active' : ''}`}
                        onClick={() => { setAnioTrabajo(y); setShowYearPicker(false); }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selección de meses */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || mesesDisponibles.length === 0}
                    type="button"
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({seleccionados.length})
                  </button>
                </div>
              </div>

              {cargando && meses.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando meses...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {mesesDisponibles.map((m) => {
                      const idMes = Number(m.id);
                      const yaPagado = periodosPagados.includes(idMes);
                      const sel = seleccionados.includes(idMes);

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaPagado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => !cargando && togglePeriodo(idMes)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !cargando) {
                              e.preventDefault();
                              togglePeriodo(idMes);
                            }
                          }}
                        >
                          <div className="periodo-checkbox" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              id={`periodo-${idMes}`}
                              checked={sel}
                              onChange={() => togglePeriodo(idMes)}
                              disabled={cargando}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label
                            htmlFor={`periodo-${idMes}`}
                            className="periodo-label"
                            onClick={(e) => e.preventDefault()}
                          >
                            {m.nombre}
                            {yaPagado && (
                              <span className="periodo-status">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Pagado
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <div className="footer-left">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                Total: {formatearARS(total)}
              </span>
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose?.(false)} disabled={cargando} type="button">
                Cancelar
              </button>
              <button
                className={`btn ${condonar ? 'btn-warning' : 'btn-primary'}`}
                onClick={confirmarPago}
                disabled={seleccionados.length === 0 || cargando}
                type="button"
              >
                {cargando ? (<><span className="spinner-btn"></span> Procesando...</>) : (condonar ? 'Condonar' : 'Confirmar Pago')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;
