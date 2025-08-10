// src/components/Alumnos/AlumnoBaja.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaUserCheck, FaTrashAlt } from 'react-icons/fa';
import Toast from '../Global/Toast';
import './AlumnoBaja.css';

const normalizar = (str = '') =>
  str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const combinarNombre = (a = {}) => {
  if (a?.nombre_apellido) return a.nombre_apellido; // viene así desde backend para bajas
  const partes = [
    a?.apellido ?? '',
    a?.nombre ?? '',
    a?.apellido_nombre ?? '',
    a?.nombre_completo ?? '',
    a?.nombreyapellido ?? '',
    a?.nyap ?? '',
  ].filter(Boolean);
  const arm = partes.join(' ').trim();
  return arm || a?.nombre || '';
};

const formatearFecha = (val) => {
  if (!val) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const AlumnoBaja = () => {
  const [alumnos, setAlumnos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState({ show: false, tipo: '', mensaje: '' });
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [mostrarConfirmacionAlta, setMostrarConfirmacionAlta] = useState(false);

  // Modales de eliminación
  const [mostrarConfirmacionEliminarUno, setMostrarConfirmacionEliminarUno] = useState(false);
  const [mostrarConfirmacionEliminarTodos, setMostrarConfirmacionEliminarTodos] = useState(false);
  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null);

  const navigate = useNavigate();

  const alumnosFiltrados = useMemo(() => {
    if (!busqueda) return alumnos;
    const q = normalizar(busqueda);
    return alumnos.filter((a) => normalizar(combinarNombre(a)).includes(q));
  }, [alumnos, busqueda]);

  useEffect(() => {
    const obtenerAlumnosBaja = async () => {
      setCargando(true);
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=alumnos_baja`);
        const data = await res.json();
        if (data.exito) {
          // Espera: id_alumno, nombre_apellido, domicilio, ingreso, motivo
          setAlumnos(Array.isArray(data.alumnos) ? data.alumnos : []);
        } else {
          setToast({ show: true, tipo: 'error', mensaje: data.mensaje || 'Error al cargar' });
        }
      } catch {
        setToast({ show: true, tipo: 'error', mensaje: 'Error de conexión al cargar alumnos' });
      } finally {
        setCargando(false);
      }
    };
    obtenerAlumnosBaja();
  }, []);

  const darAltaAlumno = async (id_alumno) => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=dar_alta_alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_alumno }),
      });
      const data = await res.json();
      if (data.exito) {
        setAlumnos(prev => prev.filter(a => a.id_alumno !== id_alumno));
        setMostrarConfirmacionAlta(false);
        setAlumnoSeleccionado(null);
        setToast({ show: true, tipo: 'exito', mensaje: 'Alumno dado de alta correctamente' });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: data.mensaje || 'No se pudo dar de alta' });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al dar de alta' });
    }
  };

  // Eliminar definitivamente (solo alumnos inactivos) usando el nuevo endpoint eliminar_bajas
  const eliminarAlumnoDefinitivo = async (id_alumno) => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_bajas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // este endpoint YA filtra activo=0, no hace falta enviar flags
        body: JSON.stringify({ id_alumno }),
      });
      const data = await res.json();
      if (data.exito) {
        setAlumnos(prev => prev.filter(a => a.id_alumno !== id_alumno));
        setToast({ show: true, tipo: 'exito', mensaje: 'Alumno eliminado definitivamente' });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: data.mensaje || 'No se pudo eliminar' });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al eliminar' });
    } finally {
      setMostrarConfirmacionEliminarUno(false);
      setAlumnoAEliminar(null);
    }
  };

  const eliminarTodosDefinitivo = async () => {
    const ids = alumnosFiltrados.map(a => a.id_alumno);
    if (ids.length === 0) {
      setToast({ show: true, tipo: 'info', mensaje: 'No hay registros para eliminar.' });
      setMostrarConfirmacionEliminarTodos(false);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_bajas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // borra todos los visibles (inactivos) de una
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.exito) {
        setAlumnos(prev => prev.filter(a => !ids.includes(a.id_alumno)));
        setToast({
          show: true,
          tipo: 'exito',
          mensaje: `Se eliminaron definitivamente ${data.eliminados ?? ids.length} alumno(s).`,
        });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: data.mensaje || 'No se pudo eliminar' });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al eliminar' });
    } finally {
      setMostrarConfirmacionEliminarTodos(false);
    }
  };

  return (
    <div className="soc-container-baja">
      <div className="soc-glass-effect-baja" />
      <div className="soc-barra-superior-baja">
        <div className="soc-titulo-container-baja">
          <h2 className="soc-titulo-baja">Alumnos Dados de Baja</h2>
        </div>

        <div className="soc-acciones-superiores-baja">
          {/* Eliminar todos los visibles */}
          <button
            className="soc-boton-eliminar-todos-baja"
            title="Eliminar definitivamente todos los registros visibles"
            onClick={() => setMostrarConfirmacionEliminarTodos(true)}
            disabled={alumnosFiltrados.length === 0}
          >
            <FaTrashAlt />
          </button>

          <button className="soc-boton-volver-baja" onClick={() => navigate('/alumnos')}>
            ← Volver
          </button>
        </div>
      </div>

      <div className="soc-buscador-container-baja">
        <input
          type="text"
          className="soc-buscador-baja"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="soc-buscador-iconos-baja">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>

      {toast.show && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          onClose={() => setToast(s => ({ ...s, show: false }))}
          duracion={3000}
        />
      )}

      {cargando ? (
        <p className="soc-cargando-baja">Cargando alumnos dados de baja...</p>
      ) : (
        <div className="soc-tabla-container-baja">
          <div className="soc-contador-baja">
            Mostrando <strong>{alumnosFiltrados.length}</strong> alumnos
          </div>

          <div className="soc-tabla-header-container-baja">
            <div className="soc-tabla-header-baja">
              <div className="soc-col-id-baja">ID</div>
              <div className="soc-col-nombre-baja">Nombre</div>
              <div className="soc-col-domicilio-baja">Domicilio</div>
              <div className="soc-col-ingreso-baja">Ingreso</div>
              <div className="soc-col-comentario-baja">Motivo</div>
              <div className="soc-col-acciones-baja">Acciones</div>
            </div>
          </div>

          <div className="soc-tabla-body-baja">
            {alumnosFiltrados.length === 0 ? (
              <div className="soc-sin-resultados-container-baja">
                <div className="soc-sin-resultados-baja">
                  <FaUserCheck className="soc-icono-sin-resultados-baja" />
                  No hay alumnos dados de baja
                </div>
              </div>
            ) : (
              alumnosFiltrados.map((a) => (
                <div className="soc-tabla-fila-baja" key={a.id_alumno}>
                  <div className="soc-col-id-baja">{a.id_alumno}</div>
                  <div className="soc-col-nombre-baja">{combinarNombre(a)}</div>
                  <div className="soc-col-domicilio-baja">{(a.domicilio || '').trim()}</div>
                  <div className="soc-col-ingreso-baja">{formatearFecha(a.ingreso)}</div>
                  <div className="soc-col-comentario-baja">{a.motivo || ''}</div>
                  <div className="soc-col-acciones-baja">
                    <div className="soc-iconos-acciones-baja">
                      {/* Dar de alta */}
                      <FaUserCheck
                        title="Dar de alta"
                        className="soc-icono-baja"
                        onClick={() => {
                          setAlumnoSeleccionado(a);
                          setMostrarConfirmacionAlta(true);
                        }}
                      />
                      {/* Eliminar definitivamente (ícono por fila) */}
                      <FaTrashAlt
                        title="Eliminar definitivamente"
                        className="soc-icono-baja soc-icono-eliminar"
                        onClick={() => {
                          setAlumnoAEliminar(a);
                          setMostrarConfirmacionEliminarUno(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Confirmar DAR ALTA */}
      {mostrarConfirmacionAlta && alumnoSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-baja">
            <h3>
              ¿Deseás dar de alta nuevamente al alumno{' '}
              <strong>{combinarNombre(alumnoSeleccionado)}</strong>?
            </h3>
            <div className="soc-modal-botones-baja">
              <button
                className="soc-boton-confirmar-baja"
                onClick={() => darAltaAlumno(alumnoSeleccionado.id_alumno)}
              >
                Sí, dar de alta
              </button>
              <button
                className="soc-boton-cancelar-baja"
                onClick={() => {
                  setMostrarConfirmacionAlta(false);
                  setAlumnoSeleccionado(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar ELIMINAR UNO */}
      {mostrarConfirmacionEliminarUno && alumnoAEliminar && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-baja">
            <h3>
              ¿Eliminar definitivamente al alumno{' '}
              <strong>{combinarNombre(alumnoAEliminar)}</strong>? Esta acción no se puede deshacer.
            </h3>
            <div className="soc-modal-botones-baja">
              <button
                className="soc-boton-confirmar-eliminar"
                onClick={() => eliminarAlumnoDefinitivo(alumnoAEliminar.id_alumno)}
              >
                Sí, eliminar
              </button>
              <button
                className="soc-boton-cancelar-baja"
                onClick={() => {
                  setMostrarConfirmacionEliminarUno(false);
                  setAlumnoAEliminar(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar ELIMINAR TODOS (visibles) */}
      {mostrarConfirmacionEliminarTodos && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-baja">
            <h3>
              ¿Eliminar definitivamente <strong>todos</strong> los alumnos actualmente visibles en
              la tabla? Esta acción no se puede deshacer.
            </h3>
            <div className="soc-modal-botones-baja">
              <button
                className="soc-boton-confirmar-eliminar"
                onClick={eliminarTodosDefinitivo}
              >
                Sí, eliminar todos
              </button>
              <button
                className="soc-boton-cancelar-baja"
                onClick={() => setMostrarConfirmacionEliminarTodos(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlumnoBaja;
