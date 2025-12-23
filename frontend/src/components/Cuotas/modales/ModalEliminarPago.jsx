import React, { useEffect, useMemo, useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import BASE_URL from "../../../config/config";
import Toast from "../../Global/Toast";
import "./ModalEliminarPago.css";

const ModalEliminarPago = ({
  socio,
  periodoId,
  periodoNombre,
  anioPago,
  onClose,
  onEliminado,
}) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState(null); // respuesta buscar_pago_eliminar

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  const idAlumno = useMemo(() => {
    return socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
  }, [socio]);

  const idMesSeleccionado = useMemo(() => {
    return periodoId ?? socio?.id_mes ?? socio?.id_periodo ?? 0;
  }, [periodoId, socio]);

  const anio = useMemo(() => {
    const n = Number(anioPago);
    return Number.isFinite(n) && n > 0 ? n : new Date().getFullYear();
  }, [anioPago]);

  // ✅ Al abrir modal: detectar qué pago corresponde eliminar (silencioso)
  useEffect(() => {
    if (!socio) return;

    const run = async () => {
      setChecking(true);
      setInfo(null);
      try {
        const res = await fetch(
          `${BASE_URL}/api.php?action=buscar_pago_eliminar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_alumno: idAlumno,
              id_mes: Number(idMesSeleccionado),
              anio,
            }),
          }
        );

        const data = await res.json().catch(() => ({}));
        if (data?.exito) setInfo(data);
        else setInfo(null);
      } catch (e) {
        console.error(e);
        setInfo(null);
      } finally {
        setChecking(false);
      }
    };

    run();
  }, [socio, idAlumno, idMesSeleccionado, anio]);

  const handleEliminar = async () => {
    setCargando(true);
    try {
      // ✅ Si el backend detectó contado, usamos id_mes_real
      const id_mes_real = info?.exito ? Number(info.id_mes_real || 0) : 0;

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_alumno: idAlumno,
          id_mes: Number(idMesSeleccionado), // mes seleccionado (ej: enero)
          anio,
          id_mes_real: id_mes_real > 0 ? id_mes_real : undefined, // 🔥 clave
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        mostrarToast("exito", data.mensaje || "Pago eliminado correctamente");
        setTimeout(() => {
          onEliminado?.();
          onClose?.();
        }, 650);
      } else {
        mostrarToast(
          "error",
          "Error: " + (data?.mensaje || "No se pudo eliminar")
        );
      }
    } catch (err) {
      console.error(err);
      mostrarToast("error", "Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  const warning = info?.warning === true;
  const textoWarning = info?.warning_text || "";

  return (
    <>
      <div className="toast-fixed-container">
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      <div className="soc-modal-overlay-eliminar" role="dialog" aria-modal="true">
        <div className="soc-modal-contenido-eliminar" role="document">
          <div className="soc-modal-icono-eliminar" aria-hidden="true">
            <FaExclamationTriangle />
          </div>

          <h3 className="soc-modal-titulo-eliminar">Eliminar Pago</h3>

          {/* ✅ CARTEL ROJO si es contado anual/H1/H2 */}
          {warning && (
            <div
              style={{
                background: "rgba(220, 38, 38, 0.12)",
                border: "1px solid rgba(220, 38, 38, 0.45)",
                color: "#dc2626",
                padding: "10px 12px",
                borderRadius: 10,
                marginTop: 10,
                marginBottom: 8,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {textoWarning ||
                "⚠️ Este pago es de contado anual/periodo. Si lo eliminás, eliminás el registro de contado."}
            </div>
          )}

          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar el pago del alumno{" "}
            <strong>{socio?.nombre ?? "—"}</strong> para{" "}
            <strong>{periodoNombre ?? periodoId}</strong> ({anio})?
          </p>

          {/* ✅ Si no se encontró nada, avisar (sin “Pago detectado…”) */}
          {!checking && !(info?.exito) && (
            <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
              No se encontró un pago para eliminar en {anio}.
            </div>
          )}

          <div className="soc-modal-botones-eliminar">
            <button
              className="soc-boton-cancelar-eliminar"
              onClick={onClose}
              disabled={cargando}
            >
              Cancelar
            </button>

            <button
              className="soc-boton-confirmar-eliminar"
              onClick={handleEliminar}
              disabled={cargando || checking || !(info?.exito)}
              title={!info?.exito ? "No hay un pago detectado para eliminar" : ""}
            >
              {cargando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarPago;
