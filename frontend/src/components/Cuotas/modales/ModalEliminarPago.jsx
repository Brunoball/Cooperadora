import React, { useState } from 'react';
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
      // Tolerancia por si el objeto viene con otras claves (id_socio/id)
      const id_alumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
      const id_mes    = periodoId ?? socio?.id_mes ?? socio?.id_periodo ?? 0;

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno,   // <-- nombres que espera el backend real
          id_mes       // <-- tinyint del mes (1..12)
        })
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', data.mensaje || 'Pago eliminado correctamente');
        setTimeout(() => {
          onEliminado?.();
          onClose?.();
        }, 800);
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

  return (
    <>
      {/* Toast fuera del overlay para que no se tape */}
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

      <div className="modal-eliminar-overlay">
        <div className="modal-eliminar-contenido">
          <h3>¿Eliminar pago?</h3>
          <p>
            ¿Deseás eliminar el pago del alumno <strong>{socio?.nombre ?? '—'}</strong>{' '}
            para el período <strong>{periodoNombre ?? periodoId}</strong>?
          </p>
          <div className="modal-eliminar-botones">
            <button className="btn-cancelar" onClick={onClose} disabled={cargando}>Cancelar</button>
            <button className="btn-confirmar" onClick={handleEliminar} disabled={cargando}>
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarPago;
