import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";
import "./ChatOptionsMenu.css";

const MENU_W = 190;
const GAP = 8;

const ChatOptionsMenu = ({
  open,
  onOpen,
  onClose,

  onEditarNombre,
  onCambiarEtiqueta,
  onVaciarChat,
  onEliminarContacto,

  onVerGaleria, // ✅ NUEVO
}) => {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const calcPos = () => {
    const b = btnRef.current;
    if (!b) return;

    const r = b.getBoundingClientRect();
    let top = r.bottom + GAP;
    let left = r.right - MENU_W;

    const maxLeft = window.innerWidth - MENU_W - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;

    const menuH = 230; // ✅ un poco más alto por "Ver galería"
    const maxTop = window.innerHeight - menuH - 8;
    if (top > maxTop) top = Math.max(8, r.top - menuH - GAP);

    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;

    calcPos();

    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) onClose?.();
    };

    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    const onRecalc = () => calcPos();

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [open, onClose]);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (open) return onClose?.();
    calcPos();
    onOpen?.();
  };

  return (
    <div
      className="chatopts chatopts--header"
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className={`chatopts-btn ${open ? "is-open" : ""}`}
        title="Opciones del chat"
        aria-label="Opciones del chat"
        onClick={toggle}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>

      {open ? (
        <div className="chatopts-menu" style={{ top: pos.top, left: pos.left, width: MENU_W }}>
          <button
            type="button"
            className="chatopts-item"
            onClick={() => {
              onClose?.();
              onEditarNombre?.();
            }}
          >
            Editar nombre
          </button>

          <button
            type="button"
            className="chatopts-item"
            onClick={() => {
              onClose?.();
              onCambiarEtiqueta?.();
            }}
          >
            Cambiar etiqueta
          </button>

          {/* ✅ NUEVO */}
          <button
            type="button"
            className="chatopts-item"
            onClick={() => {
              onClose?.();
              onVerGaleria?.();
            }}
          >
            Ver galería
          </button>

          <button
            type="button"
            className="chatopts-item"
            onClick={() => {
              onClose?.();
              onVaciarChat?.();
            }}
          >
            Vaciar chat
          </button>

          <button
            type="button"
            className="chatopts-item chatopts-item--danger"
            onClick={() => {
              onClose?.();
              onEliminarContacto?.();
            }}
          >
            Eliminar contacto
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ChatOptionsMenu;
