// src/components/Cuotas/modales/ModalMesCuotas.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { imprimirRecibos } from "../../../utils/imprimirRecibos";
import { imprimirRecibosExternos } from "../../../utils/imprimirRecibosExternos";
import { generarComprobanteAlumnoPDF } from "../../../utils/ComprobanteExternoPDF.jsx";
import BASE_URL from "../../../config/config";
import Toast from "../../Global/Toast";
import "./ModalMesCuotas.css";

/**
 * Modal para seleccionar uno o varios meses y luego:
 *  - Imprimir (usa imprimirRecibos / imprimirRecibosExternos)
 *  - Descargar PDF (usa generarComprobanteAlumnoPDF)
 *
 * Props:
 *   - socio        : objeto del alumno
 *   - meses        : [{id, nombre}] (opcional; si no llega, se arma 1..12)
 *   - anio         : número (año de pago)
 *   - esExterno    : boolean (opcional; si no llega, se infiere por categoría)
 *   - onClose      : () => void
 */

const FALLBACK_MESES = [
  { id: 1,  nombre: "Enero" },
  { id: 2,  nombre: "Febrero" },
  { id: 3,  nombre: "Marzo" },
  { id: 4,  nombre: "Abril" },
  { id: 5,  nombre: "Mayo" },
  { id: 6,  nombre: "Junio" },
  { id: 7,  nombre: "Julio" },
  { id: 8,  nombre: "Agosto" },
  { id: 9,  nombre: "Septiembre" },
  { id: 10, nombre: "Octubre" },
  { id: 11, nombre: "Noviembre" },
  { id: 12, nombre: "Diciembre" },
];

const normalizar = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const ModalMesCuotas = ({ socio, meses = [], anio, esExterno: esExternoProp = undefined, onClose }) => {
  const nowYear = new Date().getFullYear();

  // ===== AÑOS CON PAGOS (desde API) =====
  const [aniosPago, setAniosPago] = useState([]); // [{id, nombre}]
  const [loadingAnios, setLoadingAnios] = useState(true);
  const [errorAnios, setErrorAnios] = useState(null);

  // Año elegido para trabajar en el modal
  const [anioTrabajo, setAnioTrabajo] = useState(Number(anio || nowYear));
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Util: elegir año por defecto a partir de la lista
  const pickDefaultYear = useCallback((lista, anioProp, currentYear) => {
    const ids = (lista || []).map(a => String(a.id));
    if (anioProp && ids.includes(String(anioProp))) return Number(anioProp);
    if (ids.includes(String(currentYear))) return Number(currentYear);
    if (lista && lista.length > 0) return Number(lista[0].id);
    // Si no hay años en la lista, caer al año actual para no romper UI (botón mostrará ese valor)
    return Number(currentYear);
  }, []);

  // Cargar años con pagos
  useEffect(() => {
    let cancelled = false;
    const fetchAniosPago = async () => {
      setLoadingAnios(true);
      setErrorAnios(null);
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=cuotas&listar_anios=1`);
        if (!res.ok) throw new Error(`listar_anios HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const lista = (data?.anios && Array.isArray(data.anios)) ? data.anios : [];
        if (cancelled) return;

        setAniosPago(lista);
        const def = pickDefaultYear(lista, anio, nowYear);
        setAnioTrabajo(def);
      } catch (e) {
        if (cancelled) return;
        console.error("ModalMesCuotas listar_anios error:", e);
        setErrorAnios(e);
        setAniosPago([]);
        // A falta de lista, quedar con año actual o prop
        setAnioTrabajo(Number(anio || nowYear));
      } finally {
        if (!cancelled) setLoadingAnios(false);
      }
    };
    fetchAniosPago();
    return () => { cancelled = true; };
  }, [anio, nowYear, pickDefaultYear]);

  // ===== MESES =====
  const listaMeses = useMemo(() => {
    const arr = Array.isArray(meses) && meses.length ? meses : FALLBACK_MESES;
    return arr.map((m) => ({ id: Number(m.id), nombre: String(m.nombre) }));
  }, [meses]);

  const [seleccionados, setSeleccionados] = useState([]); // [id_mes,...]
  const [modoSalida, setModoSalida] = useState("imprimir"); // 'imprimir' | 'pdf'
  const [cargando, setCargando] = useState(false);

  // Toast local
  const [toast, setToast] = useState(null);
  const showToast = (tipo, mensaje, duracion = 1800) =>
    setToast({ tipo, mensaje, duracion });

  // ===== Precio por categoría (dinámico) =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState(""); // p.ej. "INTERNO" | "EXTERNO"

  // ID alumno tolerante
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  // Inferir externo si no lo pasan por props
  const esExternoInferido = useMemo(() => {
    const raw =
      nombreCategoria ||
      socio?.categoria_nombre ||
      socio?.nombre_categoria ||
      socio?.categoria ||
      "";
    return normalizar(raw) === "externo";
  }, [nombreCategoria, socio]);

  const esExterno = esExternoProp !== undefined ? !!esExternoProp : esExternoInferido;

  // Ordenados para cálculo / salida
  const periodosOrdenados = useMemo(
    () => [...seleccionados].map(Number).sort((a, b) => a - b),
    [seleccionados]
  );

  // Texto tipo “ENE / FEB / MAR 2025”
  const periodoTextoFinal = useMemo(() => {
    if (periodosOrdenados.length === 0) return "";
    const mapById = new Map(listaMeses.map((m) => [Number(m.id), m.nombre]));
    const nombres = periodosOrdenados.map((id) => (mapById.get(id) || String(id)).trim());
    return `${nombres.join(" / ")} ${anioTrabajo}`;
  }, [periodosOrdenados, listaMeses, anioTrabajo]);

  // TOTAL
  const total = useMemo(() => {
    const unit = Number(precioMensual || 0);
    return periodosOrdenados.length * unit;
  }, [periodosOrdenados.length, precioMensual]);

  const formatearARS = (monto) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(monto || 0);

  // Cargar precio por categoría del alumno
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setNombreCategoria("");
          return;
        }
        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(
          idAlumno
        )}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);

        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const monto = Number(
            data?.monto_mensual ??
              data?.monto ??
              data?.precio ??
              data?.Precio_Categoria ??
              0
          );
          const nombre = (
            data?.categoria_nombre ??
            data?.nombre_categoria ??
            data?.nombre ??
            ""
          ).toString();
          setPrecioMensual(Number.isFinite(monto) ? monto : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : "");
        } else {
          setPrecioMensual(0);
          setNombreCategoria("");
        }
      } catch (e) {
        console.error("ModalMesCuotas obtener_monto_categoria error:", e);
        setPrecioMensual(0);
        setNombreCategoria("");
      }
    };
    cargarMontoCategoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // Reset selección al cambiar de año
  useEffect(() => { setSeleccionados([]); }, [anioTrabajo]);

  // Interacciones
  const toggleMes = (id) => {
    const num = Number(id);
    setSeleccionados((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]
    );
  };

  const allSelected =
    listaMeses.length > 0 &&
    seleccionados.length === listaMeses.length;

  const toggleSeleccionarTodos = () => {
    if (allSelected) setSeleccionados([]);
    else setSeleccionados(listaMeses.map((m) => Number(m.id)));
  };

  // Salidas
  const abrirImpresion = async () => {
    const periodoCodigo = periodosOrdenados[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodos: periodosOrdenados,
      periodo_texto: periodoTextoFinal,
      precio_unitario: Number(precioMensual || 0),
      importe_total: total,
      precio_total: total,
      anio: anioTrabajo,
      categoria_nombre: nombreCategoria || "",
    };

    const w = window.open("", "_blank");
    if (!w) {
      alert("Habilitá ventanas emergentes para imprimir.");
      return;
    }

    const opciones = { anioPago: anioTrabajo };
    if (esExterno) {
      await imprimirRecibosExternos([alumnoParaImprimir], periodoCodigo, w, opciones);
    } else {
      await imprimirRecibos([alumnoParaImprimir], periodoCodigo, w, opciones);
    }
  };

  const descargarPDF = async () => {
    const periodoCodigo = periodosOrdenados[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodos: periodosOrdenados,
      periodo_texto: periodoTextoFinal,
      precio_unitario: Number(precioMensual || 0),
      importe_total: total,
      precio_total: total,
      anio: anioTrabajo,
      categoria_nombre: nombreCategoria || "",
    };

    try {
      await generarComprobanteAlumnoPDF(alumnoParaImprimir, {
        anio: anioTrabajo,
        periodoId: periodoCodigo,
        periodoTexto: periodoTextoFinal,
        importeTotal: total,
        precioUnitario: Number(precioMensual || 0),
        periodos: periodosOrdenados,
      });
      showToast("exito", "PDF descargado correctamente");
      return true;
    } catch (e) {
      console.error("Error al generar PDF:", e);
      showToast("error", "No se pudo generar el PDF");
      return false;
    }
  };

  const handleConfirmar = async () => {
    if (periodosOrdenados.length === 0) return;
    try {
      setCargando(true);
      if (modoSalida === "imprimir") {
        await abrirImpresion();
        onClose?.();
      } else {
        const ok = await descargarPDF();
        if (ok) setTimeout(() => onClose?.(), 900);
      }
    } finally {
      setCargando(false);
    }
  };

  // Cerrar con ESC
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modmes_overlay">
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modmes_contenido">
        {/* Header */}
        <div className="modmes_header">
          <div className="modmes_header-left">
            <div className="modmes_icon-circle">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="modmes_header-texts">
              <h2 className="modmes_title">Seleccionar Períodos</h2>
            </div>
          </div>
          <button className="modmes_close-btn" onClick={() => onClose?.()} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modmes_body">
          <div className="modmes_periodos-section">
            <div className="modmes_section-header">
              <h4 className="modmes_section-title">PERÍODOS DISPONIBLES</h4>

              {/* Centro: Imprimir / PDF */}
              <div className="modmes_section-center">
                <div className="modmes_output-mode" role="tablist" aria-label="Modo de salida">
                  <label className={`modmes_mode-option ${modoSalida === 'imprimir' ? 'active' : ''}`} role="tab" aria-selected={modoSalida === 'imprimir'}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="imprimir"
                      checked={modoSalida === 'imprimir'}
                      onChange={() => setModoSalida('imprimir')}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>Imprimir</span>
                  </label>

                  <label className={`modmes_mode-option ${modoSalida === 'pdf' ? 'active' : ''}`} role="tab" aria-selected={modoSalida === 'pdf'}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="pdf"
                      checked={modoSalida === 'pdf'}
                      onChange={() => setModoSalida('pdf')}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>PDF</span>
                  </label>
                </div>
              </div>

              {/* Derecha: Selector de año (desde API) + botón Todos/Quitar */}
              <div className="modmes_section-header-actions">
                <div className="modmes_year-picker">
                  <button
                    type="button"
                    className="modmes_year-button"
                    onClick={() => setShowYearPicker((s) => !s)}
                    title="Cambiar año"
                    aria-haspopup="listbox"
                    aria-expanded={showYearPicker}
                    disabled={loadingAnios}
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>
                      {loadingAnios
                        ? "Cargando..."
                        : (aniosPago.length > 0 ? anioTrabajo : "—")}
                    </span>
                  </button>

                  {showYearPicker && !loadingAnios && (
                    <div className="modmes_year-popover" role="listbox" aria-label="Seleccionar año">
                      {errorAnios ? (
                        <div className="modmes_year-empty">Error al cargar años</div>
                      ) : aniosPago.length === 0 ? (
                        <div className="modmes_year-empty">Sin años con pagos</div>
                      ) : (
                        aniosPago.map((a) => {
                          const val = String(a.id);
                          const isActive = String(anioTrabajo) === val;
                          return (
                            <button
                              key={val}
                              className={`modmes_year-item ${isActive ? "active" : ""}`}
                              onClick={() => { setAnioTrabajo(Number(val)); setShowYearPicker(false); }}
                              role="option"
                              aria-selected={isActive}
                            >
                              {a.nombre ?? a.id}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="modmes_btn modmes_btn-small modmes_btn-terciario"
                  onClick={toggleSeleccionarTodos}
                  disabled={listaMeses.length === 0}
                  title={allSelected ? "Quitar selección" : "Seleccionar todos"}
                >
                  {allSelected ? "Quitar" : "Todos"}
                </button>
              </div>
            </div>

            <div className="modmes_periodos-grid-container">
              <div className="modmes_periodos-grid">
                {listaMeses.map((m) => {
                  const checked = seleccionados.includes(Number(m.id));
                  return (
                    <label
                      key={m.id}
                      className={`modmes_periodo-card ${checked ? "modmes_seleccionado" : ""}`}
                    >
                      <div className="modmes_periodo-checkbox">
                        <input
                          type="checkbox"
                          name="mes"
                          checked={checked}
                          onChange={() => toggleMes(Number(m.id))}
                          aria-checked={checked}
                          aria-label={m.nombre}
                        />
                        <span className="modmes_checkmark" aria-hidden="true" />
                      </div>
                      <span className="modmes_periodo-label">{m.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <div className="modmes_total-badge">
              Total: {formatearARS(total)}
            </div>
          </div>

          <div className="modmes_footer-right">
            <button
              type="button"
              className="modmes_btn modmes_btn-secondary modmes_action-btn"
              onClick={() => onClose?.()}
              disabled={cargando}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="btn-label">Cancelar</span>
            </button>

            <button
              type="button"
              className={`modmes_btn ${modoSalida === 'imprimir' ? 'modmes_btn-primary' : 'modmes_btn-primary' } modmes_action-btn`}
              onClick={handleConfirmar}
              disabled={periodosOrdenados.length === 0 || cargando || precioMensual <= 0 || loadingAnios || aniosPago.length === 0}
              title={
                loadingAnios ? "Cargando años..."
                : aniosPago.length === 0 ? "No hay años con pagos"
                : periodosOrdenados.length === 0
                  ? "Elegí al menos un período"
                  : (precioMensual <= 0 ? "No hay valor mensual definido" : "")
              }
            >
              {modoSalida === 'imprimir' ? (
                <>
                  <FontAwesomeIcon icon={faPrint} />
                  <span className="btn-label">Imprimir</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFilePdf} />
                  <span className="btn-label">PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalMesCuotas;
