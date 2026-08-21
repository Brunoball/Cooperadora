// src/components/Cuotas/modales/ModalEliminarCondonacion.jsx
import React, { useMemo, useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarCondonacion.css';

const ModalEliminarCondonacion = ({
  socio,
  periodo,
  periodoTexto,
  anioPago,
  onClose,
  onEliminado,
}) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  const anio = useMemo(() => {
    const n = Number(anioPago);
    return Number.isFinite(n) && n > 0 ? n : new Date().getFullYear();
  }, [anioPago]);

  const handleEliminar = async () => {
    setCargando(true);
    try {
      // Tolerante con nombres alternativos
      const id_alumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? 0;
      const id_mes = Number(periodo ?? socio?.id_mes ?? socio?.id_periodo ?? 0);

      if (!id_alumno || !id_mes || !anio) {
        mostrarToast('error', 'Faltan datos para eliminar la condonación.');
        setCargando(false);
        return;
      }

      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_alumno,
          id_mes,
          anio,
          // El backend solo aplica este filtro cuando viene informado.
          // El modal de pago normal no lo envía y conserva su comportamiento previo.
          estado_esperado: 'condonado',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.exito) {
        mostrarToast(
          'error',
          data?.mensaje || 'No se pudo eliminar la condonación.'
        );
        return;
      }

      mostrarToast('exito', data?.mensaje || 'Condonación eliminada correctamente');
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

  if (!socio) return null;

  return (
    <>
      {/* Toast por encima del overlay */}
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

          <h3 className="soc-modal-titulo-eliminar">Eliminar Condonación</h3>

          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar la condonación del alumno{' '}
            <strong>{socio?.nombre ?? socio?.apellido_nombre ?? '—'}</strong>{' '}
            para el período <strong>{periodoTexto ?? periodo}</strong>?
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

export default ModalEliminarCondonacion;
