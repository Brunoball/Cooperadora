// src/components/Alumnos/modales/ModalEliminarPago.jsx
import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarPago.css';

const ModalEliminarPago = ({ socio, periodoId, periodoNombre, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  const handleEliminar = async () => {
    setCargando(true);
    try {
      // tolerante con nombres alternativos
      const id_alumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
      const id_mes    = periodoId ?? socio?.id_mes ?? socio?.id_periodo ?? 0;

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno, id_mes }),
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', data.mensaje || 'Pago eliminado correctamente');
        setTimeout(() => {
          onEliminado?.();
          onClose?.();
        }, 700);
      } else {
        mostrarToast('error', 'Error: ' + (data.mensaje || 'No se pudo eliminar'));
      }
    } catch (err) {
      console.error(err);
      mostrarToast('error', 'Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  return (
    <>
      {/* Toast arriba del overlay */}
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

          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar el pago del alumno <strong>{socio?.nombre ?? '—'}</strong> para{' '}
            <strong>{periodoNombre ?? periodoId}</strong>?
          </p>

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
              disabled={cargando}
            >
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarPago;
