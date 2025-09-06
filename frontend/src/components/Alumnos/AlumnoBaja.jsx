import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BASE_URL from "../../config/config";
import { FaUserCheck, FaTrashAlt, FaCalendarAlt, FaArrowLeft } from "react-icons/fa";
import Toast from "../Global/Toast";
import "./AlumnoBaja.css";

/* ========= Utils ========= */
const TZ_CBA = "America/Argentina/Cordoba";
const hoyISO = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CBA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

const esFechaISO = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

const normalizar = (str = "") =>
  str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const nombreApellido = (a = {}) =>
  `${(a.apellido || "").trim()} ${(a.nombre || "").trim()}`.trim();

const formatearFecha = (val) => {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(val.includes("T") ? val : `${val}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const AlumnoBaja = () => {
  const [alumnos, setAlumnos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState({ show: false, tipo: "", mensaje: "" });

  // Alta
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [mostrarConfirmacionAlta, setMostrarConfirmacionAlta] = useState(false);
  const [fechaAlta, setFechaAlta] = useState("");
  const fechaInputRef = useRef(null);

  // Eliminaciones
  const [mostrarConfirmacionEliminarUno, setMostrarConfirmacionEliminarUno] = useState(false);
  const [mostrarConfirmacionEliminarTodos, setMostrarConfirmacionEliminarTodos] = useState(false);
  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null);

  const navigate = useNavigate();

  /* ============ Filtrado ============ */
  const alumnosFiltrados = useMemo(() => {
    if (!busqueda) return alumnos;
    const q = normalizar(busqueda);
    return alumnos.filter((a) => normalizar(nombreApellido(a)).includes(q));
  }, [alumnos, busqueda]);

  /* ============ Carga inicial ============ */
  useEffect(() => {
    const obtenerAlumnosBaja = async () => {
      setCargando(true);
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=alumnos_baja&ts=${Date.now()}`);
        const data = await res.json();
        if (data.exito) {
          setAlumnos(Array.isArray(data.alumnos) ? data.alumnos : []);
        } else {
          setToast({ show: true, tipo: "error", mensaje: data.mensaje || "Error al cargar" });
        }
      } catch {
        setToast({ show: true, tipo: "error", mensaje: "Error de conexión al cargar alumnos" });
      } finally {
        setCargando(false);
      }
    };
    obtenerAlumnosBaja();
  }, []);

  /* ============ UX: abrir datepicker ============ */
  const openDatePicker = (e) => {
    e.preventDefault();
    const el = fechaInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
  };
  const handleKeyDownPicker = (e) => {
    if (e.key === "Enter" || e.key === " ") openDatePicker(e);
  };

  /* ============ Dar alta ============ */
  const darAltaAlumno = async (id_alumno) => {
    if (!esFechaISO(fechaAlta)) {
      setToast({ show: true, tipo: "error", mensaje: "Fecha inválida. Usá AAAA-MM-DD." });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("id_alumno", String(id_alumno));
      params.set("fecha_ingreso", fechaAlta);

      const res = await fetch(`${BASE_URL}/api.php?action=dar_alta_alumno&ts=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: params.toString(),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { exito: false, mensaje: text || "Respuesta no válida" };
      }

      if (res.ok && data.exito) {
        setAlumnos((prev) => prev.filter((a) => a.id_alumno !== id_alumno));
        setMostrarConfirmacionAlta(false);
        setAlumnoSeleccionado(null);
        setToast({ show: true, tipo: "exito", mensaje: "Alumno dado de alta correctamente" });
      } else {
        setToast({ show: true, tipo: "error", mensaje: data.mensaje || "No se pudo dar de alta" });
      }
    } catch {
      setToast({ show: true, tipo: "error", mensaje: "Error de red al dar de alta" });
    }
  };

  /* ============ Eliminar uno ============ */
  const eliminarAlumnoDefinitivo = async (id_alumno) => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_bajas&ts=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_alumno }),
      });
      const data = await res.json();
      if (data.exito) {
        setAlumnos((prev) => prev.filter((a) => a.id_alumno !== id_alumno));
        setToast({ show: true, tipo: "exito", mensaje: "Alumno eliminado definitivamente" });
      } else {
        setToast({ show: true, tipo: "error", mensaje: data.mensaje || "No se pudo eliminar" });
      }
    } catch {
      setToast({ show: true, tipo: "error", mensaje: "Error de red al eliminar" });
    } finally {
      setMostrarConfirmacionEliminarUno(false);
      setAlumnoAEliminar(null);
    }
  };

  /* ============ Eliminar visibles ============ */
  const eliminarTodosDefinitivo = async () => {
    const ids = alumnosFiltrados.map((a) => a.id_alumno);
    if (ids.length === 0) {
      setToast({ show: true, tipo: "info", mensaje: "No hay registros para eliminar." });
      setMostrarConfirmacionEliminarTodos(false);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_bajas&ts=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.exito) {
        setAlumnos((prev) => prev.filter((a) => !ids.includes(a.id_alumno)));
        setToast({
          show: true,
          tipo: "exito",
          mensaje: `Se eliminaron definitivamente ${data.eliminados ?? ids.length} alumno(s).`,
        });
      } else {
        setToast({ show: true, tipo: "error", mensaje: data.mensaje || "No se pudo eliminar" });
      }
    } catch {
      setToast({ show: true, tipo: "error", mensaje: "Error de red al eliminar" });
    } finally {
      setMostrarConfirmacionEliminarTodos(false);
    }
  };

  /* ============ Cerrar toast ============ */
  const closeToast = () => setToast((s) => ({ ...s, show: false }));

  /* ============ ESC para cerrar modales ============ */
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (mostrarConfirmacionAlta) {
          setMostrarConfirmacionAlta(false);
          setAlumnoSeleccionado(null);
        }
        if (mostrarConfirmacionEliminarUno) {
          setMostrarConfirmacionEliminarUno(false);
          setAlumnoAEliminar(null);
        }
        if (mostrarConfirmacionEliminarTodos) {
          setMostrarConfirmacionEliminarTodos(false);
        }
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [mostrarConfirmacionAlta, mostrarConfirmacionEliminarUno, mostrarConfirmacionEliminarTodos]);

  return (
    <div className="emp-baja-container">
      {/* Franja superior */}
      <div className="emp-baja-glass">
        <div className="emp-baja-barra-superior">
          <div className="emp-baja-titulo-container">
            <h2 className="emp-baja-titulo">Alumnos Dados de Baja</h2>
          </div>

          {/* Volver (solo desktop) */}
          <button className="emp-baja-boton-volver-top" onClick={() => navigate("/alumnos")}>
            <FaArrowLeft className="icon-button-baja" />
            Volver
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="emp-baja-buscador-container">
        <input
          type="text"
          className="emp-baja-buscador"
          placeholder="Buscar por apellido o nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="emp-baja-buscador-icono">
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

      {/* Toast */}
      {toast.show && (
        <Toast tipo={toast.tipo} mensaje={toast.mensaje} onClose={closeToast} duracion={3000} />
      )}

      {/* Tabla / Lista */}
      {cargando ? (
        <p className="emp-baja-cargando">Cargando alumnos dados de baja...</p>
      ) : (
        <div className="emp-baja-tabla-container">
          <div className="emp-baja-controles-superiores">
            <div className="emp-baja-contador">
              Mostrando <strong>{alumnosFiltrados.length}</strong> alumnos
            </div>

            <button
              className="emp-baja-eliminar-todos"
              title="Eliminar definitivamente todos los alumnos visibles"
              onClick={() => setMostrarConfirmacionEliminarTodos(true)}
              disabled={alumnosFiltrados.length === 0}
            >
              <FaTrashAlt className="ico" />
              <span className="txt">Eliminar todos</span>
            </button>
          </div>

          <div className="emp-baja-tabla-header-container">
            <div className="emp-baja-tabla-header">
              <div className="emp-baja-col-id">ID</div>
              <div className="emp-baja-col-nombre">Apellido y Nombre</div>
              <div className="emp-baja-col-fecha">Fecha de Baja</div>
              <div className="emp-baja-col-motivo">Motivo</div>
              <div className="emp-baja-col-acciones">Acciones</div>
            </div>
          </div>

          <div className="emp-baja-tabla-body">
            {alumnosFiltrados.length === 0 ? (
              <div className="emp-baja-sin-resultados">
                <FaUserCheck className="emp-baja-sin-icono" />
                No hay alumnos dados de baja
              </div>
            ) : (
              alumnosFiltrados.map((a) => (
                <div className="emp-baja-fila" key={a.id_alumno}>
                  <div className="emp-baja-col-id">{a.id_alumno}</div>
                  <div className="emp-baja-col-nombre">{nombreApellido(a) || "—"}</div>
                  {/* Se usa 'ingreso' porque en la baja se pisa con la fecha de baja */}
                  <div className="emp-baja-col-fecha">{formatearFecha(a.ingreso)}</div>
                  <div className="emp-baja-col-motivo">{(a.motivo || "").trim() || "—"}</div>
                  <div className="emp-baja-col-acciones">
                    <div className="emp-baja-iconos">
                      <FaUserCheck
                        title="Dar de alta"
                        className="emp-baja-icono"
                        onClick={() => {
                          setAlumnoSeleccionado(a);
                          setFechaAlta(hoyISO());
                          setMostrarConfirmacionAlta(true);
                        }}
                      />
                      <FaTrashAlt
                        title="Eliminar definitivamente"
                        className="emp-baja-icono emp-baja-icono-danger"
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

      {/* Modal DAR ALTA */}
      {mostrarConfirmacionAlta && alumnoSeleccionado && (
        <div
          className="emp-baja-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-alta-alumno-title"
        >
          <div className="emp-baja-modal emp-baja-modal--success">
            <div className="emp-baja-modal__icon" aria-hidden="true">
              <FaUserCheck />
            </div>
            <h3
              id="modal-alta-alumno-title"
              className="emp-baja-modal__title emp-baja-modal__title--success"
            >
              Reactivar alumno
            </h3>
            <p className="emp-baja-modal__body">
              ¿Deseás dar de alta nuevamente a{" "}
              <strong>{nombreApellido(alumnoSeleccionado)}</strong>?
            </p>

            <div className="soc-campo-fecha-alta">
              <label htmlFor="fecha_alta_alumno" className="soc-label-fecha-alta">
                Fecha de alta
              </label>
              <div
                className="soc-input-fecha-container"
                role="button"
                tabIndex={0}
                onMouseDown={openDatePicker}
                onKeyDown={handleKeyDownPicker}
                aria-label="Abrir selector de fecha"
              >
                <input
                  id="fecha_alta_alumno"
                  ref={fechaInputRef}
                  type="date"
                  className="soc-input-fecha-alta"
                  value={fechaAlta}
                  onChange={(e) => setFechaAlta(e.target.value)}
                />
                <FaCalendarAlt className="soc-icono-calendario" />
              </div>
            </div>

            <div className="emp-baja-modal__actions">
              <button
                className="emp-baja-btn emp-baja-btn--ghost"
                onClick={() => {
                  setMostrarConfirmacionAlta(false);
                  setAlumnoSeleccionado(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="emp-baja-btn emp-baja-btn--solid-success"
                onClick={() => darAltaAlumno(alumnoSeleccionado.id_alumno)}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ELIMINAR UNO */}
      {mostrarConfirmacionEliminarUno && alumnoAEliminar && (
        <div
          className="emp-baja-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-alumno-title"
        >
          <div className="emp-baja-modal emp-baja-modal--danger">
            <div className="emp-baja-modal__icon emp-baja-modal__icon--danger" aria-hidden="true">
              <FaTrashAlt />
            </div>
            <h3
              id="modal-eliminar-alumno-title"
              className="emp-baja-modal__title emp-baja-modal__title--danger"
            >
              Eliminar permanentemente
            </h3>
            <p className="emp-baja-modal__body">
              ¿Eliminar definitivamente al alumno{" "}
              <strong>{nombreApellido(alumnoAEliminar)}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="emp-baja-modal__actions">
              <button
                className="emp-baja-btn emp-baja-btn--ghost"
                onClick={() => {
                  setMostrarConfirmacionEliminarUno(false);
                  setAlumnoAEliminar(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="emp-baja-btn emp-baja-btn--solid-danger"
                onClick={() => eliminarAlumnoDefinitivo(alumnoAEliminar.id_alumno)}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ELIMINAR TODOS */}
      {mostrarConfirmacionEliminarTodos && (
        <div
          className="emp-baja-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-todos-title"
        >
          <div className="emp-baja-modal emp-baja-modal--danger">
            <div className="emp-baja-modal__icon emp-baja-modal__icon--danger" aria-hidden="true">
              <FaTrashAlt />
            </div>
            <h3
              id="modal-eliminar-todos-title"
              className="emp-baja-modal__title emp-baja-modal__title--danger"
            >
              Eliminar permanentemente
            </h3>
            <p className="emp-baja-modal__body">
              ¿Eliminar definitivamente <strong>todos</strong> los alumnos actualmente visibles? Esta
              acción no se puede deshacer.
            </p>
            <div className="emp-baja-modal__actions">
              <button
                className="emp-baja-btn emp-baja-btn--ghost"
                onClick={() => setMostrarConfirmacionEliminarTodos(false)}
              >
                Cancelar
              </button>
              <button className="emp-baja-btn emp-baja-btn--solid-danger" onClick={eliminarTodosDefinitivo}>
                Sí, eliminar todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior móvil: Volver (solo mobile) */}
      <div className="emp-baja-navbar-mobile">
        <button className="emp-baja-boton-volver-mobile" onClick={() => navigate("/alumnos")}>
          <FaArrowLeft className="alu-alumno-icon-button" />
          Volver
        </button>
      </div>
    </div>
  );
};

export default AlumnoBaja;
