import React, { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaCheck, FaSpinner, FaBarcode,
  FaUser, FaHome, FaPhone, FaCalendarAlt, 
  FaMoneyBillWave, FaIdCard, FaExclamationTriangle
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalCodigoBarras.css';

const ModalCodigoBarras = ({ onClose, periodo, onPagoRealizado }) => {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [socioEncontrado, setSocioEncontrado] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!codigo.trim()) {
        setSocioEncontrado(null);
        setMensaje('');
        return;
      }

      const limpio = codigo.replace(/[^0-9]/g, '');
      if (/^\d+$/.test(limpio)) {
        buscarPorCodigo(limpio);
      } else {
        setMensaje('⛔ Solo se permite ingresar código numérico del socio');
        setError(true);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [codigo]);

  const limpiarFormulario = () => {
    setCodigo('');
    setSocioEncontrado(null);
    setMensaje('');
    setError(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const mostrarToast = (tipo, mensaje) => {
    setToastTipo(tipo);
    setToastMensaje(mensaje);
    setToastVisible(true);
  };

  const buscarPorCodigo = async (input) => {
    if (input.length < 2) {
      setMensaje('⛔ El código debe tener al menos 2 dígitos (1 para período y al menos 1 para socio)');
      setError(true);
      return;
    }

    const id_periodo = parseInt(input.charAt(0), 10);
    const id_socio = input.slice(1);

    if (!id_socio || isNaN(id_periodo) || id_periodo < 1 || id_periodo > 6) {
      setMensaje('⛔ Código inválido. Formato esperado: [1 dígito periodo] + [ID socio]');
      setError(true);
      return;
    }

    setMensaje('');
    setError(false);
    setSocioEncontrado(null);

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=buscar_socio_codigo&id_socio=${id_socio}&id_periodo=${id_periodo}`);
      const data = await res.json();
      if (data.exito) {
        const socio = data.socio;
        socio.telefono = socio.telefono_movil || socio.telefono_fijo || '';
        socio.domicilio_completo = [socio.domicilio, socio.numero].filter(Boolean).join(' ');
        setSocioEncontrado({ ...socio, id_periodo });
        setMensaje(`✅ Socio encontrado: ${socio.nombre}`);
        mostrarToast('exito', `Socio ${socio.nombre} encontrado`);
      } else {
        setMensaje(data.mensaje || 'Socio no encontrado');
        setError(true);
        mostrarToast('error', data.mensaje || 'Socio no encontrado');
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
      mostrarToast('error', 'Error al conectar con el servidor');
    }
  };

  const registrarPago = async () => {
    if (!socioEncontrado || !socioEncontrado.id_periodo) {
      setMensaje('⛔ No se puede registrar el pago. Datos incompletos.');
      setError(true);
      mostrarToast('error', 'Datos incompletos para registrar el pago');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socioEncontrado.id_socio,
          periodos: [socioEncontrado.id_periodo]
        })
      });

      const data = await res.json();
      if (data.exito) {
        setMensaje('✅ Pago registrado correctamente');
        setError(false);
        mostrarToast('exito', 'Pago registrado correctamente');
        onPagoRealizado();
      } else if (data.mensaje?.includes('ya fue registrado anteriormente')) {
        setMensaje(data.mensaje);
        setError(false);
        mostrarToast('advertencia', data.mensaje);
      } else {
        setMensaje(data.mensaje || '⛔ Error al registrar el pago');
        setError(true);
        mostrarToast('error', data.mensaje || 'Error al registrar el pago');
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
      mostrarToast('error', 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const mostrarPeriodoFormateado = (id) => {
    const mapa = {
      1: '1/2',
      2: '3/4',
      3: '5/6',
      4: '7/8',
      5: '9/10',
      6: '11/12'
    };
    return mapa[id] || `Período ${id}`;
  };

  return (
    <div className="codb-modal-overlay">
      <div className="codb-modal-container">
        <div className="codb-modal">
          <div className="codb-modal-header">
            <div className="codb-header-icon"><FaBarcode /></div>
            <div className="codb-header-text">
              <h2>Registro de Pagos</h2>
              <p>Escaneá el código de barras o ingresá manualmente el número</p>
            </div>
            <button className="codb-close-button" onClick={onClose}><FaTimes /></button>
          </div>

          <div className="codb-modal-content">
            <div className="codb-search-section">
              <div className="codb-search-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: 1123 (Período + ID del socio)"
                  className={`codb-search-input ${error ? 'codb-input-error' : ''}`}
                />
                <div className="codb-input-hint">
                  <FaIdCard /> Formato: PERÍODO (1 dígito) + ID del socio
                </div>
              </div>
            </div>
            
            {socioEncontrado && (
              <div className="codb-member-info">
                <div className="codb-info-header">
                  <h3>Información del Socio</h3>
                  <div className="codb-member-id">ID: {socioEncontrado.id_socio}</div>
                </div>

                <div className="codb-info-grid">
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaUser /> Nombre:</div>
                    <div className="codb-info-value">{socioEncontrado.nombre}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaHome /> Domicilio:</div>
                    <div className="codb-info-value">{socioEncontrado.domicilio_completo}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaPhone /> Teléfono:</div>
                    <div className="codb-info-value">{socioEncontrado.telefono}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaCalendarAlt /> Período:</div>
                    <div className="codb-info-value codb-badge">
                      {mostrarPeriodoFormateado(socioEncontrado.id_periodo)}
                    </div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaMoneyBillWave /> Monto:</div>
                    <div className="codb-info-value codb-amount">$4,000.00</div>
                  </div>
                </div>

                <div className="codb-payment-button-container">
                  <button
                    onClick={registrarPago}
                    disabled={loading}
                    className="codb-payment-button"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="codb-spinner" /> Procesando...
                      </>
                    ) : (
                      <>
                        <FaCheck /> Registrar Pago
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastVisible && (
        <Toast
          tipo={toastTipo}
          mensaje={toastMensaje}
          duracion={3000}
          onClose={() => {
            setToastVisible(false);
            if (toastTipo === 'exito' && toastMensaje.includes('Pago registrado')) {
              limpiarFormulario();
            }
          }}
        />
      )}
    </div>
  );
};

export default ModalCodigoBarras;