import React, { useState } from 'react';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarPago.css';

const ModalEliminarPago = ({ socio, periodo, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  const handleEliminar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          id_periodo: periodo
        })
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', 'Pago eliminado correctamente');
        setTimeout(() => {
          onEliminado({ ...socio, estado_pago: 'deudor', medio_pago: '' });
          onClose();
        }, 1000);
      } else {
        mostrarToast('error', 'Error: ' + data.mensaje);
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
      {/* Toast debe estar fuera del overlay */}
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
            ¿Deseás eliminar el pago del socio <strong>{socio.nombre}</strong> 
            para el período <strong>{periodo}</strong>?
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
