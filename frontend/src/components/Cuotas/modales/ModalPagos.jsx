// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

// Utils de impresión (internos y externos)
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';
import { imprimirRecibosExternos } from '../../../utils/imprimirRecibosExternos.jsx';
// PDF “para el alumno” (export real del archivo)
import { generarComprobanteAlumnoPDF } from '../../../utils/ComprobanteExternoPDF.jsx';

/* ====== Helpers/Config ====== */
const MIN_YEAR = 2025; // el sistema existe desde 2025
const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

const capitalizar = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

const ModalPagos = ({ socio, onClose }) => {
  const nowYear = new Date().getFullYear();

  const [meses, setMeses] = useState([]);                     // [{ id, nombre }]
  const [periodosPagados, setPeriodosPagados] = useState([]); // [id_mes,...] (del año elegido)
  const [periodosEstado, setPeriodosEstado] = useState({});   // { [id_mes]: 'pagado' | 'condonado' }
  const [seleccionados, setSeleccionados] = useState([]);     // [id_mes,...]
  const [fechaIngreso, setFechaIngreso] = useState('');       // 'YYYY-MM-DD'
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  // Vista de éxito con selector "Imprimir / PDF"
  const [pagoExitoso, setPagoExitoso] = useState(false);
  const [modoComprobante, setModoComprobante] = useState('imprimir'); // 'imprimir' | 'pdf'

  // Condonar + selector de año
  const [condonar, setCondonar] = useState(false);
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // ===== Precio por categoría (dinámico) =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [nombreCategoria, setNombreCategoria] = useState(''); // p.ej. "INTERNO" | "EXTERNO"

  // ===== Modo libre =====
  const [libreActivo, setLibreActivo] = useState(false);
  const [libreValor, setLibreValor] = useState(''); // string para input

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  // Tolerancia de ID desde distintas fuentes
  const idAlumno = socio?.id_alumno ?? socio?.id_socio ?? socio?.id ?? null;

  /* ================= Helpers ================= */
  const formatearFecha = (f) => {
    if (!f) return '—';
    const parts = String(f).split('-'); // [yyyy, mm, dd]
    if (parts.length !== 3) return f;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  const mesesDisponibles = useMemo(() => meses, [meses]);

  // === ¿Externo o Interno? (tolerante a distintas fuentes) ===
  const esExterno = useMemo(() => {
    const raw =
      nombreCategoria ||
      socio?.categoria_nombre ||
      socio?.nombre_categoria ||
      socio?.categoria ||
      '';
    return normalizar(raw) === 'externo';
  }, [nombreCategoria, socio]);

  // === UNITARIO vigente (condonar/libre/categoría) ===
  const precioUnitarioVigente = useMemo(() => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    return Number(precioMensual || 0);
  }, [condonar, libreActivo, libreValor, precioMensual]);

  const periodosOrdenados = useMemo(
    () => [...seleccionados].map(Number).sort((a, b) => a - b),
    [seleccionados]
  );

  const total = useMemo(() => {
    return condonar ? 0 : periodosOrdenados.length * precioUnitarioVigente;
  }, [condonar, periodosOrdenados.length, precioUnitarioVigente]);

  // Texto tipo “ENE / FEB / MAR 2025”
  const periodoTextoFinal = useMemo(() => {
    if (periodosOrdenados.length === 0) return '';
    const mapById = new Map(mesesDisponibles.map(m => [Number(m.id), m.nombre]));
    const nombres = periodosOrdenados
      .map(id => (mapById.get(id) || String(id)).trim());
    return `${nombres.join(' / ')} ${anioTrabajo}`;
  }, [periodosOrdenados, mesesDisponibles, anioTrabajo]);

  /* ================= Efectos ================= */

  // ✅ Cargar precio mensual exacto y nombre de categoría del alumno
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setNombreCategoria('');
          return;
        }

        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: 'GET' });
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
          const nombre = (data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? '').toString();
          setPrecioMensual(Number.isFinite(monto) ? monto : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : '');
        } else {
          setPrecioMensual(0);
          setNombreCategoria('');
          if (data?.mensaje) mostrarToast('advertencia', data.mensaje);
        }
      } catch (e) {
        console.error('Error al obtener monto por categoría del alumno:', e);
        setPrecioMensual(0);
        setNombreCategoria('');
        mostrarToast('error', 'No se pudo obtener el monto de la categoría del alumno.');
      }
    };

    cargarMontoCategoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // Limpiar selección al cambiar alumno o año
  useEffect(() => { setSeleccionados([]); }, [idAlumno, anioTrabajo]);

  useEffect(() => {
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => {
        if (periodosEstado[id]) return false;
        return !periodosPagados.includes(Number(id));
      });

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
  }, [seleccionados, mesesDisponibles, periodosPagados, periodosEstado]);

  // Carga de meses y estado de pagos
  useEffect(() => {
    const cargar = async () => {
      if (!idAlumno) {
        console.error('ModalPagos: idAlumno inválido ->', idAlumno, socio);
        mostrarToast('error', 'No se recibió el ID del alumno.');
        return;
      }
      setCargando(true);
      try {
        const urlListas  = `${BASE_URL}/api.php?action=obtener_listas`;
        const urlPagados = `${BASE_URL}/api.php?action=meses_pagados&id_alumno=${encodeURIComponent(idAlumno)}&anio=${encodeURIComponent(anioTrabajo)}`;

        const [resListas, resPagados] = await Promise.all([
          fetch(urlListas, { method: 'GET' }),
          fetch(urlPagados, { method: 'GET' }),
        ]);

        if (!resListas.ok) throw new Error(`obtener_listas HTTP ${resListas.status}`);
        if (!resPagados.ok) throw new Error(`meses_pagados HTTP ${resPagados.status}`);

        const [dataListas, dataPagados] = await Promise.all([resListas.json(), resPagados.json()]);

        if (dataListas?.exito) {
          const arrMeses = Array.isArray(dataListas?.listas?.meses) ? dataListas.listas.meses : [];
          const norm = arrMeses
            .map((m) => ({ id: Number(m.id), nombre: m.nombre }))
            .sort((a, b) => a.id - b.id);
          setMeses(norm);
        } else {
          setMeses([]);
          mostrarToast('advertencia', dataListas?.mensaje || 'No se pudieron cargar los meses.');
        }

        if (dataPagados?.exito) {
          let detalles = [];
          if (Array.isArray(dataPagados?.detalles)) detalles = dataPagados.detalles;
          else if (Array.isArray(dataPagados?.items)) detalles = dataPagados.items;
          else if (Array.isArray(dataPagados?.rows)) detalles = dataPagados.rows;
          else if (Array.isArray(dataPagados?.data)) detalles = dataPagados.data;

          const mapEstado = {};
          for (const d of detalles) {
            const id = Number(d?.id_mes ?? d?.id ?? d?.mes ?? d?.periodo);
            if (!id) continue;
            const est = String(d?.estado ?? '').toLowerCase(); // 'pagado' | 'condonado'
            if (est) mapEstado[id] = est;
          }
          setPeriodosEstado(mapEstado);

          let ids = Object.keys(mapEstado).map(Number);
          if (ids.length === 0) {
            const arrIds = Array.isArray(dataPagados.meses_pagados)
              ? dataPagados.meses_pagados
              : (Array.isArray(dataPagados.periodos_pagados) ? dataPagados.periodos_pagados : []);
            ids = arrIds.map(Number);
          }
          setPeriodosPagados(ids);

          setFechaIngreso(dataPagados.ingreso || '');
        } else {
          setPeriodosEstado({});
          setPeriodosPagados([]);
          mostrarToast('advertencia', dataPagados?.mensaje || 'No se pudo cargar el estado de pagos.');
        }
      } catch (e) {
        console.error('ModalPagos cargar() error:', e);
        mostrarToast('error', String(e.message || e));
      } finally {
        setCargando(false);
      }
    };

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno, anioTrabajo]);

  /* ================= Acciones ================= */
  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (periodosEstado[idNum] || periodosPagados.includes(idNum)) return;
    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    const idsDisponibles = mesesDisponibles
      .map((m) => Number(m.id))
      .filter((id) => !periodosEstado[id] && !periodosPagados.includes(id));

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const onToggleCondonar = (checked) => {
    setCondonar(checked);
    if (checked) {
      setLibreActivo(false);
      setLibreValor('');
    }
  };

  const onToggleLibre = (checked) => {
    setLibreActivo(checked);
    if (checked) {
      setCondonar(false);
    } else {
      setLibreValor('');
    }
  };

  const handleLibreChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setLibreValor('');
      return;
    }
    let n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (n < 0) n = 0;
    setLibreValor(String(n));
  };

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');
    if (periodosOrdenados.length === 0) return mostrarToast('advertencia', 'Seleccioná al menos un mes.');

    if (libreActivo && !condonar) {
      const v = Number(libreValor);
      if (!Number.isFinite(v) || v <= 0) {
        return mostrarToast('error', 'Ingresá un monto libre válido (mayor a 0).');
      }
    }

    setCargando(true);
    try {
      const payload = {
        id_alumno: Number(idAlumno),
        periodos: periodosOrdenados,
        condonar: !!condonar,
        anio: Number(anioTrabajo),
        monto_unitario: Math.round(condonar ? 0 : Number(precioUnitarioVigente || 0)),
      };

      if (libreActivo && !condonar) {
        payload.monto_libre = Math.round(Number(libreValor) || 0);
      }

      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`registrar_pago HTTP ${res.status}`);

      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        setPagoExitoso(true);
        setPeriodosPagados(prev => {
          const set = new Set(prev);
          periodosOrdenados.forEach(id => set.add(Number(id)));
          return Array.from(set);
        });
      } else {
        if (Array.isArray(data?.ya_registrados) && data.ya_registrados.length > 0) {
          const txt = data.ya_registrados.map(x => `${x.periodo} (${(x.estado || '').toUpperCase()})`).join(', ');
          mostrarToast('advertencia', `Ya registrados: ${txt}`);
        } else {
          mostrarToast('error', data?.mensaje || 'No se pudo registrar.');
        }
      }
    } catch (e) {
      console.error('ModalPagos confirmarPago() error:', e);
      mostrarToast('error', String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  // === Acción post-éxito según modo seleccionado ===
  const handleComprobante = async () => {
    // Ordenamos y definimos el primer período (para título/compatibilidad)
    const periodos = periodosOrdenados;
    const periodoCodigo = periodos[0] || 0;

    // Objeto unificado para los 3 flujos (print interno, print externo, PDF)
    const alumnoParaImprimir = {
      ...socio,

      // Campos clave para tus utils:
      id_periodo: periodoCodigo,           // compat
      periodos,                            // <-- lista completa de meses pagados
      periodo_texto: periodoTextoFinal,    // <-- “ENE / FEB / MAR 2025”
      precio_unitario: precioUnitarioVigente,
      importe_total: total,                // <-- monto final (multi-mes)
      precio_total: total,                 // alias por si algún util lo usa
      anio: anioTrabajo,

      // Nombre de categoría que queremos mostrar
      categoria_nombre: libreActivo ? 'LIBRE' : (nombreCategoria || ''),
    };

    if (modoComprobante === 'pdf') {
      try {
        await generarComprobanteAlumnoPDF(alumnoParaImprimir, {
          anio: anioTrabajo,
          periodoId: periodoCodigo,
          periodoTexto: periodoTextoFinal,
          importeTotal: total,
          precioUnitario: precioUnitarioVigente,
          periodos, // también paso explícito en opciones
        });
      } catch (e) {
        console.error('Error al generar PDF:', e);
        mostrarToast('error', 'No se pudo generar el PDF.');
      }
      return;
    }

    // Imprimir (abre ventana y llama a tu util)
    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir el comprobante.');

    const opciones = { anioPago: anioTrabajo };
    if (esExterno) {
      await imprimirRecibosExternos([alumnoParaImprimir], periodoCodigo, win, opciones);
    } else {
      await imprimirRecibos([alumnoParaImprimir], periodoCodigo, win, opciones);
    }
  };

  if (!socio) return null;

  /* ================= VISTA: ÉXITO ================= */
  if (pagoExitoso) {
    const tituloExito = condonar ? '¡Condonación registrada con éxito!' : '¡Pago realizado con éxito!';
    const subExito = 'Elegí cómo querés obtener el comprobante.';

    return (
      <>
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido">
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">Registro de Pagos</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose?.(true)} disabled={cargando} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="success-card">
                <h3 className="success-title">{tituloExito}</h3>
                <p className="success-sub">{subExito}</p>
                {!condonar && (
                  <p className="success-sub" style={{ marginTop: 6 }}>
                    <strong>Valor por mes:</strong> {formatearARS(precioUnitarioVigente)} — <strong>Meses:</strong> {periodosOrdenados.length} — <strong>Total:</strong> {formatearARS(total)}
                  </p>
                )}
                {periodoTextoFinal && (
                  <p className="success-sub" style={{ marginTop: 2 }}>
                    <strong>Período:</strong> {periodoTextoFinal}
                  </p>
                )}
              </div>

              {/* Selector de modo */}
              <div style={{ marginTop: 12, display: 'flex', gap: 18, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="modoComprobante"
                    value="imprimir"
                    checked={modoComprobante === 'imprimir'}
                    onChange={() => setModoComprobante('imprimir')}
                  />
                  <span>Imprimir</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="modoComprobante"
                    value="pdf"
                    checked={modoComprobante === 'pdf'}
                    onChange={() => setModoComprobante('pdf')}
                  />
                  <span>PDF</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  Total: {formatearARS(total)}
                </span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose?.(true)} type="button">
                  Cerrar
                </button>
                <button className="btn btn-primary" onClick={handleComprobante} type="button">
                  {modoComprobante === 'pdf' ? 'Descargar PDF' : 'Abrir impresión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ================= VISTA: NORMAL ================= */
  return (
    <>
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle">
                <FaCoins size={20} />
              </div>
              <h2 className="modal-title">Registro de Pagos / Condonar</h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose?.(false)} disabled={cargando} aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div className="socio-info-card">
              <div className="socio-info-header">
                <h3 className="socio-nombre">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>
              <div className="socio-info-extra">
                <span className="valor-mes">
                  <strong>Valor mensual</strong>{' '}
                  {libreActivo ? '(LIBRE)' : (nombreCategoria ? `(${nombreCategoria})` : '')}: {formatearARS(precioUnitarioVigente)}
                </span>
              </div>
            </div>

            {/* Caja condonar + selector de año */}
            <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={condonar}
                  onChange={(e) => onToggleCondonar(e.target.checked)}
                  disabled={cargando}
                />
                <span className="switch">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">
                  Marcar como <strong>Condonado</strong> (no genera cobro)
                </span>
              </label>

              <div className="year-picker">
                <button
                  type="button"
                  className="year-button"
                  onClick={() => setShowYearPicker((s) => !s)}
                  disabled={cargando}
                  title="Cambiar año"
                >
                  <FaCalendarAlt />
                  <span>{anioTrabajo}</span>
                </button>

                {showYearPicker && (
                  <div className="year-popover" onMouseLeave={() => setShowYearPicker(false)}>
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        className={`year-item ${y === anioTrabajo ? 'active' : ''}`}
                        onClick={() => { setAnioTrabajo(y); setShowYearPicker(false); }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modo libre */}
            <div className={`condonar-box ${libreActivo ? 'is-active' : ''}`} style={{ marginTop: 10 }}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={libreActivo}
                  onChange={(e) => onToggleLibre(e.target.checked)}
                  disabled={cargando}
                />
                <span className="switch">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">
                  Usar <strong>monto libre por mes</strong>
                </span>
              </label>

              <div className="year-picker" style={{ gap: 10 }}>
                <input
                  type="number"
                  min="0"
                  step="500"
                  inputMode="numeric"
                  placeholder="Ingresá el monto libre por mes"
                  value={libreValor}
                  onChange={handleLibreChange}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'Minus') e.preventDefault();
                  }}
                  disabled={!libreActivo || cargando}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', width: 220 }}
                />
              </div>
            </div>

            {/* Selección de meses */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || mesesDisponibles.length === 0}
                    type="button"
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({seleccionados.length})
                  </button>
                </div>
              </div>

              {cargando && meses.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando meses...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {mesesDisponibles.map((m) => {
                      const idMes = Number(m.id);
                      const estado = periodosEstado[idMes]; // 'pagado' | 'condonado' | undefined
                      const yaOcupado = !!estado || periodosPagados.includes(idMes);
                      const sel = seleccionados.includes(idMes);

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaOcupado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => !cargando && togglePeriodo(idMes)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !cargando) {
                              e.preventDefault();
                              togglePeriodo(idMes);
                            }
                          }}
                        >
                          <div className="periodo-checkbox" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              id={`periodo-${idMes}`}
                              checked={sel}
                              onChange={() => togglePeriodo(idMes)}
                              disabled={cargando}
                            />
                            <span className="checkmark"></span>
                          </div>
                          <label
                            htmlFor={`periodo-${idMes}`}
                            className="periodo-label"
                            onClick={(e) => e.preventDefault()}
                          >
                            {m.nombre}
                            {yaOcupado && (
                              <span className="periodo-status">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {estado ? capitalizar(estado) : 'Pagado'}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <div className="footer-left">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                Total: {formatearARS(total)}
              </span>
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose?.(false)} disabled={cargando} type="button">
                Cancelar
              </button>
              <button
                className={`btn ${condonar ? 'btn-warning' : 'btn-primary'}`}
                onClick={confirmarPago}
                disabled={periodosOrdenados.length === 0 || cargando}
                type="button"
              >
                {cargando ? (<><span className="spinner-btn"></span> Procesando...</>) : (condonar ? 'Condonar' : 'Confirmar Pago')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;
