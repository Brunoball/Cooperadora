// src/components/Cuotas/modales/ModalMesCuotas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { imprimirRecibos } from "../../../utils/imprimirRecibos";
import { imprimirRecibosExternos } from "../../../utils/imprimirRecibosExternos";
import { generarComprobanteAlumnoPDF } from "../../../utils/ComprobanteExternoPDF.jsx";
import BASE_URL from "../../../config/config";
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
  const year = useMemo(() => Number(anio || new Date().getFullYear()), [anio]);

  const listaMeses = useMemo(() => {
    const arr = Array.isArray(meses) && meses.length ? meses : FALLBACK_MESES;
    return arr.map((m) => ({ id: Number(m.id), nombre: String(m.nombre) }));
  }, [meses]);

  const [seleccionados, setSeleccionados] = useState([]); // [id_mes,...]
  const [modoSalida, setModoSalida] = useState("imprimir"); // 'imprimir' | 'pdf'
  const [cargando, setCargando] = useState(false);

  // ===== Precio por categoría (dinámico) =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState(""); // p.ej. "INTERNO" | "EXTERNO"

  // --- ID alumno tolerante ---
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  // ——— Inferir externo si no lo pasan por props ———
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

  // --- Ordenados para cálculo / salida ---
  const periodosOrdenados = useMemo(
    () => [...seleccionados].map(Number).sort((a, b) => a - b),
    [seleccionados]
  );

  // Texto tipo “ENE / FEB / MAR 2025”
  const periodoTextoFinal = useMemo(() => {
    if (periodosOrdenados.length === 0) return "";
    const mapById = new Map(listaMeses.map((m) => [Number(m.id), m.nombre]));
    const nombres = periodosOrdenados.map((id) => (mapById.get(id) || String(id)).trim());
    return `${nombres.join(" / ")} ${year}`;
  }, [periodosOrdenados, listaMeses, year]);

  // TOTAL (igual que ModalPagos pero sin condonar/libre aquí)
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

  // ------- Cargar precio por categoría del alumno (igual que ModalPagos) -------
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
          // silencioso acá; si querés, podés agregar tu Toast
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

  // ------- Interacciones -------
  const toggleMes = (id) => {
    const num = Number(id);
    setSeleccionados((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]
    );
  };

  const seleccionarTodos = () =>
    setSeleccionados(listaMeses.map((m) => Number(m.id)));
  const limpiar = () => setSeleccionados([]);

  // ------- Salidas (idéntico “contrato” que ModalPagos) -------

  const abrirImpresion = async () => {
    // Un SOLO llamado con todos los meses: el util toma importe_total y periodo_texto
    const periodoCodigo = periodosOrdenados[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,         // compat
      periodos: periodosOrdenados,       // lista completa
      periodo_texto: periodoTextoFinal,  // “ENE / FEB / MAR 2025”
      precio_unitario: Number(precioMensual || 0),
      importe_total: total,              // monto final multi-mes
      precio_total: total,               // alias
      anio: year,
      categoria_nombre: nombreCategoria || "",
    };

    const w = window.open("", "_blank");
    if (!w) {
      alert("Habilitá ventanas emergentes para imprimir.");
      return;
    }

    const opciones = { anioPago: year };
    if (esExterno) {
      await imprimirRecibosExternos([alumnoParaImprimir], periodoCodigo, w, opciones);
    } else {
      await imprimirRecibos([alumnoParaImprimir], periodoCodigo, w, opciones);
    }
  };

  const descargarPDF = async () => {
    // Un SOLO PDF con todos los meses (como ModalPagos)
    const periodoCodigo = periodosOrdenados[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodos: periodosOrdenados,
      periodo_texto: periodoTextoFinal,
      precio_unitario: Number(precioMensual || 0),
      importe_total: total,
      precio_total: total,
      anio: year,
      categoria_nombre: nombreCategoria || "",
    };

    await generarComprobanteAlumnoPDF(alumnoParaImprimir, {
      anio: year,
      periodoId: periodoCodigo,
      periodoTexto: periodoTextoFinal,
      importeTotal: total,
      precioUnitario: Number(precioMensual || 0),
      periodos: periodosOrdenados,
    });
  };

  const handleConfirmar = async () => {
    if (periodosOrdenados.length === 0) return;
    try {
      setCargando(true);
      if (modoSalida === "imprimir") await abrirImpresion();
      else await descargarPDF();
      onClose?.();
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
      <div className="modmes_contenido">
        {/* Header */}
        <div className="modmes_header">
          <div className="modmes_header-left">
            <div className="modmes_icon-circle">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="modmes_header-texts">
              <h2 className="modmes_title">Seleccionar mes(es) — {year}</h2>
              <small style={{ color: "#64748b" }}>
                {socio?.nombre || socio?.apellido_nombre || "Alumno"}
              </small>
            </div>
          </div>
          <button className="modmes_close-btn" onClick={() => onClose?.()} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modmes_body">
          {/* Info monto y total (igual criterio que ModalPagos) */}
          <div className="modmes_info-row">
            <span className="modmes_chip">
              Valor mensual {nombreCategoria ? `(${nombreCategoria})` : ""}: <strong>{formatearARS(precioMensual)}</strong>
            </span>
            <span className="modmes_chip">
              Meses: <strong>{periodosOrdenados.length}</strong>
            </span>
            <span className="modmes_chip">
              Total: <strong>{formatearARS(total)}</strong>
            </span>
          </div>

          <div className="modmes_periodos-section">
            <div className="modmes_section-header">
              <h4 className="modmes_section-title">MESES</h4>

              {/* Centro: Imprimir / PDF */}
              <div className="modmes_section-center">
                <div className="modmes_output-mode">
                  <label className={`modmes_mode-option ${modoSalida === 'imprimir' ? 'active' : ''}`}>
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

                  <label className={`modmes_mode-option ${modoSalida === 'pdf' ? 'active' : ''}`}>
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

              {/* Acciones rápidas */}
              <div className="modmes_section-right" style={{ display: 'flex', gap: 10 }}>
                <button className="modmes_small_btn" onClick={seleccionarTodos} type="button">Todos</button>
                <button className="modmes_small_btn" onClick={limpiar} type="button">Limpiar</button>
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

            {periodoTextoFinal && (
              <div className="modmes_periodo-texto">
                <em>Período seleccionado: {periodoTextoFinal}</em>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <span className="modmes_hint">
              Seleccionados: <strong>{periodosOrdenados.length}</strong>
            </span>
            <span className="modmes_hint">
              Total: <strong>{formatearARS(total)}</strong>
            </span>
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
              className="modmes_btn modmes_btn-primary modmes_action-btn"
              onClick={handleConfirmar}
              disabled={periodosOrdenados.length === 0 || cargando || precioMensual <= 0}
              title={
                periodosOrdenados.length === 0
                  ? "Elegí al menos un mes"
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
