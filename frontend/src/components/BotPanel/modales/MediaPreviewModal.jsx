import React, { useEffect, useRef } from "react";
import "./Modals.css";

const MediaPreviewModal = ({ open, onClose, media }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !media) return null;

  const isImage = /^image\//i.test(media.media_mime);
  const isPdf = media.media_mime === "application/pdf";

  return (
    <div className="modal-backdrop">
      <div className="modal modal--media">
        <div className="modal-header">
          <h3>{media.media_name || "Archivo"}</h3>
          <button
            ref={closeRef}
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="modal-body modal-body--media">
          {isImage ? (
            <img
              src={media.media_url}
              alt={media.media_name || "imagen"}
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                borderRadius: 10,
                display: "block",
                margin: "0 auto",
              }}
            />
          ) : isPdf ? (
            <iframe
              src={media.media_url}
              title="PDF"
              style={{
                width: "100%",
                height: "70vh",
                border: "none",
                borderRadius: 8,
              }}
            />
          ) : (
            <p>No se puede previsualizar este archivo.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;
