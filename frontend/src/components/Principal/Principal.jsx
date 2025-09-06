// src/components/Principal/Principal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logoRH from '../../imagenes/Escudo.png';
import './principal.css';
import '../Global/roots.css';

// Font Awesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faMoneyBillWave,
  faTags,
  faUserPlus,
  faSignOutAlt,
  faExclamationTriangle,
  faIdCard,           // ⬅️ NUEVO (icono Tipos de documento)
} from '@fortawesome/free-solid-svg-icons';

/* =========== Modal simple ============= */
const ConfirmLogoutModal = ({ open, onClose, onConfirm }) => {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };
  const modalStyle = {
    width: 'min(520px, 92vw)',
    background: 'var(--soc-light, #fff)',
    color: 'var(--soc-dark, #0f172a)',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
    padding: '22px'
  };
  const headerStyle = { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 };
  const titleStyle = { margin: 0, fontSize: 20, fontWeight: 700 };
  const textStyle = { margin: '8px 0 18px', lineHeight: 1.5, color: 'var(--soc-gray-600,#475569)' };
  const actionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: 12 };

  return (
    <div style={backdropStyle} onMouseDown={onClose} aria-modal="true" role="dialog" aria-labelledby="logout-title">
      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 22, color: '#F59E0B' }} />
          <h3 id="logout-title" style={titleStyle}>¿Cerrar sesión?</h3>
        </div>
        <p style={textStyle}>
          Vas a salir del sistema y se borrarán los datos de tu sesión en este navegador.
        </p>
        <div style={actionsStyle}>
          <button
            ref={cancelBtnRef}
            onClick={onClose}
            className="princ-modal-btn-sec"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--soc-gray-300,#cbd5e1)',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="princ-modal-btn-primary"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--soc-danger,#ef4444)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

const Principal = () => {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClickCerrar = () => setShowConfirm(true);
  const confirmarCerrarSesion = () => {
    localStorage.removeItem('usuario');
    setShowConfirm(false);
    navigate('/');
  };
  const cancelarCerrarSesion = () => setShowConfirm(false);
  const redirectTo3Devs = () => window.open('https://3devsnet.com', '_blank');

  return (
    <div className="princ-contenedor-padre">
      <div className="princ-contenedor">
        <div className="princ-glass-effect"></div>

        <div className="princ-encabezado">
          <div className="princ-logo-container">
            <img src={logoRH} alt="Logo IPET 50" className="princ-logo" />
            <div className="princ-logo-glow"></div>
          </div>
          <h1>Sistema de Gestión <span>Cooperadora IPET 50</span></h1>
          <p className="princ-subtitulo">Panel de administración integral para la gestión eficiente de tu organización</p>

          <div className="princ-usuario-info">
            <h2>Bienvenido, <span>{usuario?.Nombre_Completo || 'Usuario'}</span></h2>
            <div className="princ-usuario-status"></div>
          </div>
        </div>

        <div className="princ-grid-opciones">
          {/* Alumnos */}
          <button className="princ-opcion princ-opcion-socios" onClick={() => navigate('/alumnos')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faUsers} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestionar Alumnos</span>
              <span className="princ-opcion-desc">Administra el listado completo de alumnos</span>
            </div>
          </button>

          {/* Cuotas */}
          <button className="princ-opcion princ-opcion-cuotas" onClick={() => navigate('/cuotas')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faMoneyBillWave} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestionar Cuotas</span>
              <span className="princ-opcion-desc">Control de pagos y cuotas mensuales</span>
            </div>
          </button>

          {/* Contable */}
          <button className="princ-opcion princ-opcion-categorias" onClick={() => navigate('/contable')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faTags} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestión Contable</span>
              <span className="princ-opcion-desc">Dashboard contable y reportes</span>
            </div>
          </button>

          {/* Registro de usuarios */}
          <button className="princ-opcion princ-opcion-usuarios" onClick={() => navigate('/registro')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faUserPlus} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Registro de Usuarios</span>
              <span className="princ-opcion-desc">Administra accesos al sistema</span>
            </div>
          </button>

          {/* ⬇️ NUEVA CAJA: Tipos de documento */}
          <button className="princ-opcion princ-opcion-docs" onClick={() => navigate('/tipos-documentos')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faIdCard} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Tipos de Documento</span>
              <span className="princ-opcion-desc">ABM de tipos y siglas</span>
            </div>
          </button>
        </div>

        <div className="princ-footer">
          <div className="princ-footer-container">
            <div className="princ-creditos-container">
              <p className="princ-creditos" onClick={redirectTo3Devs}>
                Desarrollado por 3devs.solutions
              </p>
            </div>
            <div className="princ-boton-salir-container">
              <button onClick={handleClickCerrar} className="princ-boton-salir">
                <FontAwesomeIcon icon={faSignOutAlt} className="princ-boton-salir-icono" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmLogoutModal
        open={showConfirm}
        onClose={cancelarCerrarSesion}
        onConfirm={confirmarCerrarSesion}
      />
    </div>
  );
};

export default Principal;
