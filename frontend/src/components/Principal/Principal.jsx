import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faMoneyCheckDollar,
  faUserPlus,
  faSignOutAlt,
  faIdCard,
  faLayerGroup,
  faRobot,
} from "@fortawesome/free-solid-svg-icons";
import logoRH from "../../imagenes/Escudo.png";
import "./principal.css";
import "../Global/roots.css";

const PANEL_API =
  process.env.REACT_APP_BOT_PANEL_URL ||
  "https://cooperadora.ipet50.edu.ar/api/bot_wp/funciones/Panel/endpoints";

/* =========== Modal cierre de sesión ============= */
const ConfirmLogoutModal = ({ open, onClose, onConfirm }) => {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="modalprincipal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalprincipal-title"
      onMouseDown={onClose}
    >
      <div
        className="modalprincipal-container modalprincipal--danger"
        onMouseDown={stop}
      >
        <div className="modalprincipal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faSignOutAlt} />
        </div>

        <h3 id="modalprincipal-title" className="modalprincipal-title">
          Confirmar cierre de sesión
        </h3>

        <p className="modalprincipal-text">
          ¿Estás seguro de que deseas cerrar la sesión?
        </p>

        <div className="modalprincipal-buttons">
          <button
            type="button"
            className="modalprincipal-btn modalprincipal-btn--ghost"
            onClick={onClose}
            ref={cancelBtnRef}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="modalprincipal-btn modalprincipal-btn--solid-danger"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtBadge = (n) => {
  const v = toNum(n);
  if (v <= 0) return "";
  return v > 99 ? "99+" : String(v);
};

const calcularBadgesDesdeChats = (rows) => {
  const chats = Array.isArray(rows) ? rows : [];

  let normal = 0;
  let urgent = 0;

  for (const c of chats) {
    const unread = Math.max(0, toNum(c?.unread || 0));
    const consultasPendientes = Math.max(
      0,
      toNum(c?.consultas_pendientes || c?.pending_consultas || 0)
    );

    const urgentesChat = Math.min(unread, consultasPendientes);
    const normalesChat = Math.max(0, unread - urgentesChat);

    urgent += urgentesChat;
    normal += normalesChat;
  }

  return { normal, urgent };
};

const Principal = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const [normalUnread, setNormalUnread] = useState(0);
  const [urgentUnread, setUrgentUnread] = useState(0);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("usuario"));
      setUsuario(u || null);
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("ultimaBusqueda");
      localStorage.removeItem("ultimosResultados");
      localStorage.removeItem("alumnoSeleccionado");
      localStorage.removeItem("ultimaAccion");
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;

    const hasSession = () => {
      try {
        return (
          !!localStorage.getItem("token") || !!localStorage.getItem("usuario")
        );
      } catch {
        return false;
      }
    };

    const tick = async () => {
      if (!hasSession()) return;

      try {
        const res = await fetch(`${PANEL_API}/panel_chats.php?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (res.ok && data?.success) {
          const { normal, urgent } = calcularBadgesDesdeChats(data.chats);

          setNormalUnread(Math.max(0, toNum(normal)));
          setUrgentUnread(Math.max(0, toNum(urgent)));
        }
      } catch {
        // silencio
      }
    };

    tick();
    const t = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const role = (usuario?.rol || "").toLowerCase();
  const isAdmin = role === "admin";

  const menuItems = [
    { icon: faUsers, text: "Gestionar Alumnos", ruta: "/alumnos" },
    { icon: faMoneyCheckDollar, text: "Gestionar Cuotas", ruta: "/cuotas" },
    {
      icon: faIdCard,
      text: "Tipos de Documento",
      ruta: "/tipos-documentos",
    },
    { icon: faLayerGroup, text: "Categorías", ruta: "/categorias" },
    { icon: faUserPlus, text: "Registro de Usuarios", ruta: "/registro" },
    { icon: faMoneyCheckDollar, text: "Contable", ruta: "/contable/libro" },
  ];

  const visibleItems = isAdmin
    ? menuItems
    : menuItems.filter((m) => m.ruta === "/alumnos");

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
      try {
        sessionStorage.clear();
      } catch {}
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      } catch {}
      setShowModal(false);
      navigate("/", { replace: true });
    }, 400);
  };

  const irPanelBot = () => {
    window.open("/bot/panel", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`pagina-principal-container ${
        isExiting ? "slide-fade-out" : ""
      }`}
    >
      <div className="pagina-principal-card">
        <div className="pagina-principal-header header--row">
          <div className="header-text">
            <h1 className="title">
              Sistema de Gestión{" "}
              <span className="title-accent">Cooperadora IPET 50</span>
            </h1>
            <p className="subtitle">
              {isAdmin ? "Panel de administración" : "Panel de consulta"}
            </p>
          </div>

          <div className="logo-container logo-container--right">
            <img src={logoRH} alt="Logo IPET 50" className="logo" />
          </div>
        </div>

        <div className="menu-container">
          <div className="menu-grid flex--compact">
            {visibleItems.map((item, index) => (
              <button
                type="button"
                key={index}
                className="menu-button card--compact"
                onClick={() => handleItemClick(item)}
                aria-label={item.text}
              >
                <div className="button-icon icon--sm">
                  <FontAwesomeIcon icon={item.icon} size="lg" />
                </div>
                <span className="button-text text--sm">{item.text}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleCerrarSesion}
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          <span className="logout-text-full">Cerrar Sesión</span>
          <span className="logout-text-short">Salir</span>
        </button>

        <footer className="pagina-principal-footer">
          Desarrollado por{" "}
          <a
            href="https://3devsnet.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            3devs.solutions
          </a>
        </footer>
      </div>

      <button
        type="button"
        className="bot-fab"
        onClick={irPanelBot}
        aria-label="Abrir panel interno del bot"
        title="Panel interno del Bot (WhatsApp)"
        style={{ position: "fixed" }}
      >
        <FontAwesomeIcon icon={faRobot} />

        {normalUnread > 0 ? (
          <span
            aria-label={`Notificaciones normales: ${normalUnread}`}
            title={`Normales: ${normalUnread}`}
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 22,
              height: 22,
              padding: "0 6px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#22c55e",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1,
              boxShadow: "0 0 0 3px rgba(15,23,42,.35)",
              zIndex: 3,
            }}
          >
            {fmtBadge(normalUnread)}
          </span>
        ) : null}

        {urgentUnread > 0 ? (
          <span
            aria-label={`Notificaciones urgentes: ${urgentUnread}`}
            title={`Urgentes: ${urgentUnread}`}
            style={{
              position: "absolute",
              bottom: -4,
              right: -8,
              minWidth: 22,
              height: 22,
              padding: "0 6px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1,
              boxShadow: "0 0 0 3px rgba(15,23,42,.35)",
              zIndex: 4,
            }}
          >
            {fmtBadge(urgentUnread)}
          </span>
        ) : null}
      </button>

      <ConfirmLogoutModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={confirmarCierreSesion}
      />
    </div>
  );
};

export default Principal;