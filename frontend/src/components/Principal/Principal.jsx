import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faMoneyCheckDollar,   // Cuotas
  faFileInvoiceDollar,   // Contable
  faUserPlus,            // Registro
  faSignOutAlt,          // Salir
  faIdCard,              // Tipos de documento
  faLayerGroup           // Categorías
} from "@fortawesome/free-solid-svg-icons";
import logoRH from "../../imagenes/Escudo.png";
import "./principal.css";

/* =========== Modal cierre de sesión (estilo LALCEC) ============= */
const ConfirmLogoutModal = ({ open, onClose, onConfirm }) => {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onMouseDown={onClose}
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faSignOutAlt} />
        </div>

        <h3 id="logout-modal-title" className="logout-modal-title logout-modal-title--danger">
          Confirmar cierre de sesión
        </h3>

        <p className="logout-modal-text">
          ¿Estás seguro de que deseas cerrar la sesión?
        </p>

        <div className="logout-modal-buttons">
          <button
            type="button"
            className="logout-btn logout-btn--ghost"
            onClick={onClose}
            ref={cancelBtnRef}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="logout-btn logout-btn--solid-danger"
            onClick={onConfirm}
          >
            Confirmar
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
    { icon: faUsers,            text: "Gestionar Alumnos",     ruta: "/alumnos" },
    { icon: faMoneyCheckDollar, text: "Gestionar Cuotas",      ruta: "/cuotas" },
    { icon: faFileInvoiceDollar,text: "Gestión Contable",      ruta: "/contable" },
    { icon: faUserPlus,         text: "Registro de Usuarios",  ruta: "/registro" },
    { icon: faIdCard,           text: "Tipos de Documento",    ruta: "/tipos-documentos" },
    { icon: faLayerGroup,       text: "Categorías",            ruta: "/categorias" }
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

      <ConfirmLogoutModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={confirmarCierreSesion}
      />
    </div>
  );
};

export default Principal;
