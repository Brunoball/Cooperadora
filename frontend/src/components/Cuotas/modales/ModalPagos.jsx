// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

const ModalPagos = ({ socio, onClose }) => {
  const [meses, setMeses] = useState([]);                    // [{ id: 1..12, nombre: 'ENERO' }, ...]
  const [periodosPagados, setPeriodosPagados] = useState([]); // [1, 2, ...]
  const [seleccionados, setSeleccionados] = useState([]);     // [1, 5, ...]
  const [fechaIngreso, setFechaIngreso] = useState('');        // 'YYYY-MM-DD'
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  // Tolerancia de ID desde distintas fuentes
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  // ========= Helpers de fecha/mes =========
  const getMesNumero = (idMes) => Number(idMes) || 1;

  // Evita desfase horario: no usar new Date() para YYYY-MM-DD
  const formatearFecha = (f) => {
    if (!f) return '—';
    const parts = String(f).split('-'); // [yyyy, mm, dd]
    if (parts.length !== 3) return f;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  // Mostrar TODOS los meses (sin filtrar por fecha de ingreso)
  const mesesDisponibles = useMemo(() => meses, [meses]);

  // ========= Efectos =========

  // Reset de selección al cambiar de alumno
  useEffect(() => {
    setSeleccionados([]);
  }, [idAlumno]);

  // Sincroniza "Seleccionar todos"
  useEffect(() => {
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => !periodosPagados.includes(Number(id)));

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
  }, [seleccionados, mesesDisponibles, periodosPagados]);

  // Cargar listas + estado de pagos
  useEffect(() => {
    const cargar = async () => {
      if (!idAlumno) {
        console.error('ModalPagos: idAlumno inválido ->', idAlumno, socio);
        mostrarToast('error', 'No se recibió el ID del alumno.');
        return;
      }
      setCargando(true);
      try {
        const urlListas = `${BASE_URL}/api.php?action=obtener_listas`;
        const urlPagados = `${BASE_URL}/api.php?action=periodos_pagados&id_alumno=${encodeURIComponent(idAlumno)}`;

        const [resListas, resPagados] = await Promise.all([
          fetch(urlListas, { method: 'GET' }),
          fetch(urlPagados, { method: 'GET' }),
        ]);

        if (!resListas.ok) throw new Error(`obtener_listas HTTP ${resListas.status}`);
        if (!resPagados.ok) throw new Error(`periodos_pagados HTTP ${resPagados.status}`);

        const [dataListas, dataPagados] = await Promise.all([resListas.json(), resPagados.json()]);

        // Meses
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

        // Pagados + ingreso
        if (dataPagados?.exito) {
          const ya = Array.isArray(dataPagados.periodos_pagados)
            ? dataPagados.periodos_pagados.map(Number)
            : [];
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
  }, [idAlumno]);

  // ========= Acciones =========

  const togglePeriodo = (id) => {
    const idNum = Number(id);
    // Si querés permitir incluso seleccionar pagados, comentá la siguiente línea:
    if (periodosPagados.includes(idNum)) return; // no permitir seleccionar pagados

    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    // Usa TODOS los meses (sin filtrar por fecha ingreso)
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => !periodosPagados.includes(id));

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const confirmarPago = async () => {
    if (!idAlumno) {
      mostrarToast('error', 'Falta ID del alumno.');
      return;
    }
    if (seleccionados.length === 0) {
      mostrarToast('advertencia', 'Seleccioná al menos un mes.');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno: Number(idAlumno),
          periodos: seleccionados.map(Number),
        }),
      });

      if (!res.ok) throw new Error(`registrar_pago HTTP ${res.status}`);

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        mostrarToast('exito', 'Pago registrado correctamente.');
        setTimeout(() => onClose(true), 800);
      } else {
        mostrarToast('error', data?.mensaje || 'No se pudo registrar el pago.');
      }
    } catch (e) {
      console.error('ModalPagos confirmarPago() error:', e);
      mostrarToast('error', String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  // ========= Render =========
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
            <button className="modal-close-btn" onClick={() => onClose(false)} disabled={cargando} aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

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
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  <div className="selection-info">
                    {seleccionados.length > 0 ? `${seleccionados.length} seleccionados` : 'Ninguno seleccionado'}
                  </div>
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
                              disabled={cargando /* permitir marcar aunque sea pagado si quitás la validación arriba */}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label
                            htmlFor={`periodo-${idMes}`}
                            className="periodo-label"
                            onClick={(e) => e.preventDefault()} // evitamos doble toggle por label
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

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => onClose(false)} disabled={cargando} type="button">
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarPago}
              disabled={seleccionados.length === 0 || cargando}
              type="button"
            >
              {cargando ? (<><span className="spinner-btn"></span> Procesando...</>) : 'Confirmar Pago'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;
