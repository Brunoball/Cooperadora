import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {

  faUsers,
  faMoneyBillWave,
  faTags,
  faUserPlus,
  faSignOutAlt,
  faExclamationTriangle,
  faIdCard,
  faLayerGroup, // ⬅️ NUEVO (icono Categorías)
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
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem("ultimaBusqueda");
      localStorage.removeItem("ultimosResultados");
      localStorage.removeItem("alumnoSeleccionado");
      localStorage.removeItem("ultimaAccion");
    } catch {}
  }, []);

  const menuItems = [
    { icon: faUsers, text: "Gestionar Alumnos", ruta: "/alumnos" },
    { icon: faMoneyCheckDollar, text: "Gestionar Cuotas", ruta: "/cuotas" },
    { icon: faFileInvoiceDollar, text: "Gestión Contable", ruta: "/contable" },
    { icon: faUserPlus, text: "Registro de Usuarios", ruta: "/registro" },
    { icon: faIdCard, text: "Tipos de Documento", ruta: "/tipos-documentos" },
    { icon: faTags, text: "Categorías (opcional)", ruta: "/categorias" },
  ];

  const handleItemClick = (item) => {
    navigate(item.ruta);
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  };

  const handleCerrarSesion = () => setShowModal(true);

  const confirmarCierreSesion = () => {
    setIsExiting(true);
    setTimeout(() => {
      try { sessionStorage.clear(); } catch {}
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      } catch {}
      setShowModal(false);
      navigate("/", { replace: true });
    }, 400);
  };

  return (
    <div className={`pagina-principal-container ${isExiting ? "slide-fade-out" : ""}`}>
      <div className="pagina-principal-card">
        <div className="pagina-principal-header">
          <div className="logo-container">
            <img src={logoRH} alt="Logo IPET 50" className="logo" />
          </div>
          <h1 className="title">Sistema de Gestión IPET 50</h1>
          <p className="subtitle">Panel de administración</p>
        </div>

        <div className="menu-container">
          <div className="menu-grid">
            {menuItems.map((item, index) => (
              <button
                type="button"
                key={index}
                className="menu-button"
                onClick={() => handleItemClick(item)}
                aria-label={item.text}
              >
                <div className="button-icon">
                  <FontAwesomeIcon icon={item.icon} size="lg" />
                </div>
                <span className="button-text">{item.text}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="logout-button" onClick={handleCerrarSesion}>
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          <span className="logout-text-full">Cerrar Sesión</span>
          <span className="logout-text-short">Salir</span>
        </button>

        <footer className="pagina-principal-footer">
          Desarrollado por{" "}
          <a href="https://3devsnet.com" target="_blank" rel="noopener noreferrer">
            3devs.solutions
          </a>
        </footer>
      </div>

      {showModal && (
        <div
          className="logout-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
        >
          <div className="logout-modal-container logout-modal--danger">
            <div className="logout-modal__icon" aria-hidden="true">
              <FontAwesomeIcon icon={faSignOutAlt} />
            </div>

            <h3 id="logout-modal-title" className="logout-modal-title logout-modal-title--danger">
              Confirmar cierre de sesión
            </h3>


          {/* Tipos de documento */}
          <button className="princ-opcion princ-opcion-docs" onClick={() => navigate('/tipos-documentos')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faIdCard} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Tipos de Documento</span>
              <span className="princ-opcion-desc">ABM de tipos y siglas</span>
            </div>
          </button>

          {/* ⬇️ NUEVA CAJA: Categorías */}
          <button className="princ-opcion princ-opcion-categorias" onClick={() => navigate('/categorias')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faLayerGroup} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Categorías</span>
              <span className="princ-opcion-desc">ABM de categorías y montos</span>
            </div>
          </button>
        </div>


            <div className="logout-modal-buttons">
              <button
                type="button"
                className="logout-btn logout-btn--ghost"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="logout-btn logout-btn--solid-danger"
                onClick={confirmarCierreSesion}
              >
                Confirmar
              </button>
            </div>
          </div>
        
      )}
    </div>
  );
};

export default Principal;
