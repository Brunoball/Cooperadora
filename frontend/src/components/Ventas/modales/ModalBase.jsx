import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import "./ModalVentas.css";
import "./ModalVentasForms.css";

const MODAL_STACK_KEY = "ventasModalOpenCount";

const getModalOpenCount = () => {
  const raw = Number(document.body?.dataset?.[MODAL_STACK_KEY] || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

const setModalOpenCount = (value) => {
  const next = Math.max(0, value);
  if (!document.body) return;

  if (next === 0) {
    delete document.body.dataset[MODAL_STACK_KEY];
    document.body.style.overflow = "";
  } else {
    document.body.dataset[MODAL_STACK_KEY] = String(next);
    document.body.style.overflow = "hidden";
  }
};

export default class ModalBase extends React.PureComponent {
  modalActivo = false;
  componentDidMount() {
    if (this.props.abierto) this.activarModal();
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.abierto && this.props.abierto) {
      this.activarModal();
    }

    if (prevProps.abierto && !this.props.abierto) {
      this.desactivarModal();
    }
  }

  componentWillUnmount() {
    this.desactivarModal();
  }

  onKeyDown = (e) => {
    if (e.key === "Escape" && typeof this.props.onClose === "function") {
      this.props.onClose();
    }
  };

  activarModal() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.addEventListener("keydown", this.onKeyDown);

    if (!this.modalActivo) {
      this.modalActivo = true;
      setModalOpenCount(getModalOpenCount() + 1);
    }
  }

  desactivarModal() {
    document.removeEventListener("keydown", this.onKeyDown);

    if (this.modalActivo) {
      this.modalActivo = false;
      setModalOpenCount(getModalOpenCount() - 1);
    }
  }

  render() {
    const { abierto, titulo, subtitulo, children, onClose, size = "md", className = "", hideClose = false } = this.props;

    if (!abierto) return null;

    const puedeCerrar = typeof onClose === "function";

    return (
      <div className="ventas-modal-backdrop">
        <section
          className={`ventas-modal ${size === "sm" ? "ventas-modal--sm" : ""} ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="ventas-modal__head">
            <div className="ventas-modal__title">
              <h2>{titulo}</h2>
              {subtitulo ? <p>{subtitulo}</p> : null}
            </div>
            {!hideClose ? (
              <button
                type="button"
                className="ventas-modal__close"
                onClick={puedeCerrar ? onClose : undefined}
                aria-label="Cerrar"
                disabled={!puedeCerrar}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : null}
          </header>
          {children}
        </section>
      </div>
    );
  }
}
