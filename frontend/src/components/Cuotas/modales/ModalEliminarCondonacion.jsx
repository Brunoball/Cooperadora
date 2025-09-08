// src/components/Cuotas/modales/ModalEliminarCondonacion.jsx
import React, { useState } from 'react';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
// Reutilizamos los mismos estilos del modal de eliminar pago
import './ModalEliminarPago.css';

const ModalEliminarCondonacion = ({ socio, periodo, periodoTexto, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  const handleEliminar = async () => {
    setCargando(true);
    try {
      // Tolerancia por si el objeto viene con otras claves (id_socio/id)
      const id_alumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
      // El id del mes lo tomamos del prop "periodo" o del socio si viniera allí
      const id_mes = Number(periodo ?? socio?.id_mes ?? socio?.id_periodo ?? 0);

      if (!id_alumno || !id_mes) {
        mostrarToast('error', 'Faltan datos para eliminar la condonación.');
        setCargando(false);
        return;
      }

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno, id_mes }),
      });

      // Ignoramos el mensaje del backend (que dice "Pago eliminado correctamente")
      await res.json().catch(() => ({}));

      // Mostramos SIEMPRE el texto de condonación
      mostrarToast('exito', 'Condonación eliminada correctamente');
      setTimeout(() => {
        onEliminado?.();
        onClose?.();
      }, 700);
    } catch (e) {
      console.error(e);
      mostrarToast('error', 'Error al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {/* Toast flotante */}
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
          <h3>¿Eliminar condonación?</h3>
          <p>
            ¿Deseás quitar la condonación del alumno{' '}
            <strong>{socio?.nombre ?? socio?.apellido_nombre ?? '—'}</strong>{' '}
            para el período <strong>{periodoTexto ?? periodo}</strong>?
          </p>
          <div className="modal-eliminar-botones">
            <button className="btn-cancelar" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button className="btn-confirmar" onClick={handleEliminar} disabled={cargando}>
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarCondonacion;
