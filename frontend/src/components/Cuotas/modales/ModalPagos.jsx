import React, { useEffect, useState } from 'react';
import { FaCoins } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

const obtenerPrimerMesDesdeNombre = (nombre) => {
  const match = nombre.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

const ModalPagos = ({ socio, onClose }) => {
  const [periodos, setPeriodos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  const filtrarPeriodosPorIngreso = () => {
    if (!fechaIngreso) return periodos;

    const fecha = new Date(fechaIngreso);
    const mesIngreso = fecha.getMonth() + 1;
    const anioIngreso = fecha.getFullYear();
    const anioActual = new Date().getFullYear();

    return periodos.filter((p) => {
      const primerMes = obtenerPrimerMesDesdeNombre(p.nombre);
      return (anioIngreso < anioActual) || (anioIngreso === anioActual && primerMes >= mesIngreso);
    });
  };

  const periodosDisponibles = filtrarPeriodosPorIngreso();

  useEffect(() => {
    const fetchDatos = async () => {
      setCargando(true);
      try {
        const [resListas, resPagados] = await Promise.all([
          fetch(`${BASE_URL}/api.php?action=listas`),
          fetch(`${BASE_URL}/api.php?action=periodos_pagados&id_socio=${socio.id_socio}`)
        ]);

        const dataListas = await resListas.json();
        const dataPagados = await resPagados.json();

        if (dataListas.exito) {
          const ordenados = dataListas.listas.periodos.sort((a, b) => a.id - b.id);
          setPeriodos(ordenados);
        }

        if (dataPagados.exito) {
          setPeriodosPagados(dataPagados.periodos_pagados);
          setFechaIngreso(dataPagados.ingreso);
        } else {
          mostrarToast('advertencia', 'Error al obtener períodos pagados');
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
        mostrarToast('error', 'Error al obtener datos del servidor');
      } finally {
        setCargando(false);
      }
    };

    if (socio?.id_socio) {
      fetchDatos();
    }
  }, [socio]);

  useEffect(() => {
    const disponibles = periodosDisponibles
      .filter(p => !periodosPagados.includes(p.id))
      .map(p => p.id);

    const todos = disponibles.length > 0 && disponibles.every(id => seleccionados.includes(id));
    setTodosSeleccionados(todos);
  }, [seleccionados, periodosDisponibles, periodosPagados]);

  const togglePeriodo = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    const disponibles = periodosDisponibles
      .filter((p) => !periodosPagados.includes(p.id))
      .map((p) => p.id);

    if (todosSeleccionados) {
      setSeleccionados([]);
    } else {
      setSeleccionados(disponibles);
    }

    setTodosSeleccionados(!todosSeleccionados);
  };

  const confirmarPago = async () => {
    if (seleccionados.length === 0) {
      mostrarToast('advertencia', 'Seleccioná al menos un período para registrar el pago');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          periodos: seleccionados
        })
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', 'Pago registrado correctamente');
        setTimeout(() => {
          onClose(true);
        }, 1000);
      } else {
        mostrarToast('error', 'Error: ' + data.mensaje);
      }
    } catch (error) {
      console.error('Error al registrar el pago:', error);
      mostrarToast('error', 'Error de conexión al registrar el pago');
    } finally {
      setCargando(false);
    }
  };

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  if (!socio) return null;

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
            <button className="modal-close-btn" onClick={() => onClose(false)} disabled={cargando}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="socio-info-card">
              <div className="socio-info-header">
                <h3 className="socio-nombre">{socio.nombre}</h3>
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
                <h4 className="section-title">Períodos Disponibles</h4>
                <div className="section-header-actions">
                  <button 
                    className="btn btn-small btn-terciario" 
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || periodosDisponibles.length === 0}
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  <div className="selection-info">
                    {seleccionados.length > 0 ? `${seleccionados.length} seleccionados` : 'Ninguno seleccionado'}
                  </div>
                </div>
              </div>

              {cargando && periodos.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando períodos...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {periodosDisponibles.map((periodo) => {
                      const yaPagado = periodosPagados.includes(periodo.id);
                      return (
                        <div 
                          key={periodo.id} 
                          className={`periodo-card ${yaPagado ? 'pagado' : ''} ${seleccionados.includes(periodo.id) ? 'seleccionado' : ''}`}
                          onClick={() => !yaPagado && togglePeriodo(periodo.id)}
                        >
                          <div className="periodo-checkbox">
                            <input
                              type="checkbox"
                              id={`periodo-${periodo.id}`}
                              checked={seleccionados.includes(periodo.id)}
                              onChange={() => togglePeriodo(periodo.id)}
                              disabled={yaPagado || cargando}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label htmlFor={`periodo-${periodo.id}`} className="periodo-label">
                            {periodo.nombre}
                            {yaPagado && (
                              <span className="periodo-status">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button 
              className="btn btn-secondary" 
              onClick={() => onClose(false)}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button 
              className="btn btn-primary" 
              onClick={confirmarPago}
              disabled={seleccionados.length === 0 || cargando}
            >
              {cargando ? (
                <>
                  <span className="spinner-btn"></span> Procesando...
                </>
              ) : (
                'Confirmar Pago'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;