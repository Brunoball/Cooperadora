// src/components/BotPanel/modales/GaleriaModal.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faFilePdf, faImages } from "@fortawesome/free-solid-svg-icons";
import "./GaleriaModal.css";

const GaleriaModal = ({ open, onClose, items, onOpenItem, title }) => {
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    const onDown = (e) => {
      const box = boxRef.current;
      if (!box) return;
      if (!box.contains(e.target)) onClose?.();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  const arr = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  if (!open) return null;

  return (
    <div className="wp-gal-backdrop" role="dialog" aria-label="Galería del chat">
      <div className="wp-gal-modal" ref={boxRef}>
        <div className="wp-gal-top">
          <div className="wp-gal-title">
            <FontAwesomeIcon icon={faImages} />{" "}
            <span>{title || "Galería"}</span>
            <span className="wp-gal-count">{arr.length}</span>
          </div>

          <button className="wp-gal-close" type="button" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="wp-gal-body">
          {arr.length === 0 ? (
            <div className="wp-gal-empty">No hay archivos en este chat.</div>
          ) : (
            <div className="wp-gal-grid">
              {arr.map((it, idx) => {
                const isPdf = it?.kind === "pdf";
                const isImg = it?.kind === "image";

                return (
                  <button
                    key={`${it.url}-${idx}`}
                    type="button"
                    className={`wp-gal-item ${isPdf ? "is-pdf" : ""}`}
                    onClick={() => onOpenItem?.(it)}
                    title={it.name || "archivo"}
                  >
                    {isImg ? (
                      <img className="wp-gal-thumb" src={it.url} alt={it.name || "imagen"} loading="lazy" />
                    ) : isPdf ? (
                      <div className="wp-gal-pdf">
                        <div className="wp-gal-pdf-ico">
                          <FontAwesomeIcon icon={faFilePdf} />
                        </div>
                        <div className="wp-gal-pdf-name">{it.name || "documento.pdf"}</div>
                      </div>
                    ) : (
                      <div className="wp-gal-pdf">
                        <div className="wp-gal-pdf-ico">📎</div>
                        <div className="wp-gal-pdf-name">{it.name || "archivo"}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GaleriaModal;