import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import "./ModalVentas.css";
import "./ModalVentasForms.css";

export default class ModalBase extends React.PureComponent {
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
    document.body.style.overflow = "hidden";
  }

  desactivarModal() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.body.style.overflow = "";
  }

  render() {
    const { abierto, titulo, subtitulo, children, onClose, size = "md", className = "" } = this.props;

    if (!abierto) return null;

    const puedeCerrar = typeof onClose === "function";

    return (
      <div className="ventas-modal-backdrop" onMouseDown={puedeCerrar ? onClose : undefined}>
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
            <button
              type="button"
              className="ventas-modal__close"
              onClick={puedeCerrar ? onClose : undefined}
              aria-label="Cerrar"
              disabled={!puedeCerrar}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </header>
          {children}
        </section>
      </div>
    );
  }
}
