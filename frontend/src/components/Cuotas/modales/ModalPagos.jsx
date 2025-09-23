// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FaCoins, FaCalendarAlt, FaPen, FaCheck, FaTimes } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';

// Utils impresión
import { imprimirRecibos } from '../../../utils/imprimirRecibos.jsx';
import { imprimirRecibosExternos } from '../../../utils/imprimirRecibosExternos.jsx';
import { generarComprobanteAlumnoPDF } from '../../../utils/ComprobanteExternoPDF.jsx';

/* ====== Constantes ====== */
const MIN_YEAR = 2025;
const ID_CONTADO_ANUAL = 13;
const ID_MATRICULA = 14;

/* ====== Helpers ====== */
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

const dentroVentanaAnual = (hoy = new Date()) => {
  // 15-Dic (y) a 01-Abr (y+1)
  const y = hoy.getFullYear();
  const inicio = new Date(y, 11, 15);
  const fin = new Date(y + 1, 3, 1);
  if (hoy >= inicio && hoy < fin) return true;
  const finEsteAnio = new Date(y, 3, 1);
  const inicioAnterior = new Date(y - 1, 11, 15);
  return hoy >= inicioAnterior && hoy < finEsteAnio;
};

const ModalPagos = ({ socio, onClose }) => {
  const now = new Date();
  const nowYear = now.getFullYear();
  const ventanaAnualActiva = dentroVentanaAnual(now);

  const [meses, setMeses] = useState([]);                     // [{ id, nombre }]
  const [periodosPagados, setPeriodosPagados] = useState([]); // [id_mes,...]
  const [periodosEstado, setPeriodosEstado] = useState({});   // { [id_mes]: 'pagado' | 'condonado' }
  const [seleccionados, setSeleccionados] = useState([]);     // [id_mes,...] (solo 1..12)
  const [fechaIngreso, setFechaIngreso] = useState('');       // 'YYYY-MM-DD'
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);

  // Éxito + modo comprobante
  const [pagoExitoso, setPagoExitoso] = useState(false);
  const [modoComprobante, setModoComprobante] = useState('imprimir'); // 'imprimir' | 'pdf'

  // Condonar + selector de año
  const [condonar, setCondonar] = useState(false);
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // ===== Precio por categoría (dinámico) =====
  const [precioMensual, setPrecioMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);            // <-- desde API categoria_monto
  const [nombreCategoria, setNombreCategoria] = useState(''); // "INTERNO"/"EXTERNO"/...

  // ===== Extras: CONTADO ANUAL (ID 13) y MATRÍCULA (ID 14) =====
  const [anualSeleccionado, setAnualSeleccionado] = useState(false);
  const [matriculaSeleccionada, setMatriculaSeleccionada] = useState(false);
  const [matriculaEditando, setMatriculaEditando] = useState(false);
  const [montoMatricula, setMontoMatricula] = useState(15000); // valor local (se actualiza al cargar)
  const [guardandoMatricula, setGuardandoMatricula] = useState(false);

  // ===== Modo libre =====
  const [libreActivo, setLibreActivo] = useState(false);
  const [libreValor, setLibreValor] = useState(''); // string para input

  // ===== Estado para controlar modo activo =====
  const [modoActivo, setModoActivo] = useState('meses'); // 'meses' | 'anual' | 'matricula'

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  // ID tolerante
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

  // Solo 1..12 para la grilla
  const mesesGrid = useMemo(() => meses.filter(m => Number(m.id) >= 1 && Number(m.id) <= 12), [meses]);

  // Externo?
  const esExterno = useMemo(() => {
    const raw =
      nombreCategoria ||
      socio?.categoria_nombre ||
      socio?.nombre_categoria ||
      socio?.categoria ||
      '';
    return normalizar(raw) === 'externo';
  }, [nombreCategoria, socio]);

  // Precio unitario vigente para meses
  const precioUnitarioVigente = useMemo(() => {
    if (condonar) return 0;
    if (libreActivo) {
      const v = Number(libreValor);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    return Number(precioMensual || 0);
  }, [condonar, libreActivo, libreValor, precioMensual]);

  // Periodos meses ordenados
  const periodosMesesOrdenados = useMemo(
    () => [...seleccionados].map(Number).sort((a, b) => a - b),
    [seleccionados]
  );

  // Totales
  const totalMeses = useMemo(
    () => (condonar ? 0 : periodosMesesOrdenados.length * precioUnitarioVigente),
    [condonar, periodosMesesOrdenados.length, precioUnitarioVigente]
  );
  const totalExtras = useMemo(
    () => (anualSeleccionado ? Number(montoAnual || 0) : 0) + (matriculaSeleccionada ? Number(montoMatricula || 0) : 0),
    [anualSeleccionado, montoAnual, matriculaSeleccionada, montoMatricula]
  );
  const total = totalMeses + totalExtras;

  const periodoTextoFinal = useMemo(() => {
    const mapById = new Map(meses.map(m => [Number(m.id), String(m.nombre).trim()]));
    const ids = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado ? [ID_CONTADO_ANUAL] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];
    if (ids.length === 0) return '';
    const nombres = ids.map(id => mapById.get(Number(id)) || String(id));
    return `${nombres.join(' / ')} ${anioTrabajo}`;
  }, [meses, periodosMesesOrdenados, anualSeleccionado, matriculaSeleccionada, anioTrabajo]);

  /* ================= Efectos ================= */

  // Cargar precio mensual / categoría / monto anual (categoria_monto)
  useEffect(() => {
    const cargarMontoCategoria = async () => {
      try {
        if (!idAlumno) {
          setPrecioMensual(0);
          setNombreCategoria('');
          setMontoAnual(0);
          return;
        }
        const url = `${BASE_URL}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(idAlumno)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`obtener_monto_categoria HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (data?.exito) {
          const montoMensual = Number(
            data?.monto_mensual ?? data?.monto ?? data?.precio ?? data?.Precio_Categoria ?? 0
          );
          const nombre = (data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? '').toString();
          const anual = Number(data?.monto_anual ?? 0);

          setPrecioMensual(Number.isFinite(montoMensual) ? montoMensual : 0);
          setNombreCategoria(nombre ? nombre.toUpperCase() : '');
          setMontoAnual(Number.isFinite(anual) ? anual : 0);
        } else {
          setPrecioMensual(0);
          setNombreCategoria('');
          setMontoAnual(0);
          if (data?.mensaje) mostrarToast('advertencia', data.mensaje);
        }
      } catch (e) {
        console.error('Error al obtener monto por categoría del alumno:', e);
        setPrecioMensual(0);
        setNombreCategoria('');
        setMontoAnual(0);
        mostrarToast('error', 'No se pudo obtener el monto de la categoría del alumno.');
      }
    };
    cargarMontoCategoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // ➜ Cargar monto de matrícula desde la DB
  useEffect(() => {
    const cargarMatricula = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=obtener_monto_matricula`);
        if (!res.ok) throw new Error(`obtener_monto_matricula HTTP ${res.status}`);
        const data = await res.json();
        if (data?.exito) {
          const v = Number(data.monto);
          setMontoMatricula(Number.isFinite(v) ? v : 0);
        } else {
          mostrarToast('advertencia', data?.mensaje || 'No se pudo cargar el monto de matrícula.');
        }
      } catch (e) {
        console.error('cargarMatricula()', e);
        mostrarToast('error', 'Error al cargar matrícula.');
      }
    };
    cargarMatricula();
    // BASE_URL es constante; evitar re-fetch innecesario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAlumno]);

  // Limpiar selección al cambiar alumno o año
  useEffect(() => {
    setSeleccionados([]);
    setAnualSeleccionado(false);
    setMatriculaSeleccionada(false);
    setModoActivo('meses'); // Resetear al modo por defecto
  }, [idAlumno, anioTrabajo]);

  // Sincronizar modoActivo con los estados de selección
  useEffect(() => {
    if (anualSeleccionado && modoActivo !== 'anual') {
      setModoActivo('anual');
    } else if (matriculaSeleccionada && modoActivo !== 'matricula') {
      setModoActivo('matricula');
    } else if (!anualSeleccionado && !matriculaSeleccionada && seleccionados.length > 0 && modoActivo !== 'meses') {
      setModoActivo('meses');
    }
  }, [anualSeleccionado, matriculaSeleccionada, seleccionados.length, modoActivo]);

  // Actualizar "Seleccionar todos"
  useEffect(() => {
    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => {
        if (periodosEstado[id]) return false;
        return !periodosPagados.includes(Number(id));
      });

    const all = idsDisponibles.length > 0 && idsDisponibles.every((id) => seleccionados.includes(Number(id)));
    setTodosSeleccionados(all);
  }, [seleccionados, mesesGrid, periodosPagados, periodosEstado]);

  // Cargar meses y estado de pagos
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

  /* ================= Helpers de exclusión de modos ================= */
  const activarSoloMeses = () => {
    setAnualSeleccionado(false);
    setMatriculaSeleccionada(false);
    setModoActivo('meses');
  };

  const activarSoloAnual = () => {
    setSeleccionados([]);
    setMatriculaSeleccionada(false);
    setModoActivo('anual');
  };

  const activarSoloMatricula = () => {
    setSeleccionados([]);
    setAnualSeleccionado(false);
    // Si elegís matrícula, el libre no puede seguir activo
    setLibreActivo(false);
    setLibreValor('');
    setModoActivo('matricula');
  };

  /* ================= Acciones (selección y exclusiones) ================= */

  const togglePeriodo = (id) => {
    const idNum = Number(id);
    if (idNum < 1 || idNum > 12) return; // solo meses comunes
    if (periodosEstado[idNum] || periodosPagados.includes(idNum)) return;

    activarSoloMeses();

    setSeleccionados((prev) =>
      prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [...prev, idNum]
    );
  };

  const toggleSeleccionarTodos = () => {
    activarSoloMeses();

    const idsDisponibles = mesesGrid
      .map((m) => Number(m.id))
      .filter((id) => !periodosEstado[id] && !periodosPagados.includes(id));

    if (todosSeleccionados) setSeleccionados([]);
    else setSeleccionados(idsDisponibles);
  };

  const toggleAnual = (checked) => {
    if (checked) {
      activarSoloAnual();
      setAnualSeleccionado(true);
    } else {
      setAnualSeleccionado(false);
      if (modoActivo === 'anual') setModoActivo('meses');
    }
  };

  const toggleMatricula = (checked) => {
    if (checked) {
      // Activar matrícula ⇒ desactivar anual y libre automáticamente
      activarSoloMatricula();
      setMatriculaSeleccionada(true);
    } else {
      setMatriculaSeleccionada(false);
      if (modoActivo === 'matricula') setModoActivo('meses');
    }
  };

  const onToggleCondonar = (checked) => {
    setCondonar(checked);
    if (checked) {
      setLibreActivo(false);
      setLibreValor('');
    }
  };

  const onToggleLibre = (checked) => {
    // Activar libre ⇒ desactiva matrícula automáticamente
    if (checked) {
      setMatriculaSeleccionada(false);
    } else {
      setLibreValor('');
    }
    setLibreActivo(checked);
    if (checked) setCondonar(false);
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

  // Guardar matrícula (persistente)
  const guardarMatricula = async () => {
    try {
      setGuardandoMatricula(true);
      const monto = Math.max(0, Math.round(Number(montoMatricula) || 0));
      const res = await fetch(`${BASE_URL}/api.php?action=actualizar_monto_matricula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto })
      });
      if (!res.ok) throw new Error(`actualizar_monto_matricula HTTP ${res.status}`);
      const data = await res.json();
      if (data?.exito) {
        setMontoMatricula(monto);
        setMatriculaEditando(false);
        mostrarToast('exito', 'Matrícula actualizada.');
      } else {
        mostrarToast('error', data?.mensaje || 'No se pudo actualizar la matrícula.');
      }
    } catch (e) {
      console.error('guardarMatricula()', e);
      mostrarToast('error', 'Error al guardar matrícula.');
    } finally {
      setGuardandoMatricula(false);
    }
  };

  const confirmarPago = async () => {
    if (!idAlumno) return mostrarToast('error', 'Falta ID del alumno.');

    const periodosSeleccionados = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado ? [ID_CONTADO_ANUAL] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];

    if (periodosSeleccionados.length === 0)
      return mostrarToast('advertencia', 'Seleccioná al menos un período (mes, anual o matrícula).');

    const montosPorPeriodo = {};
    for (const id of periodosMesesOrdenados) {
      montosPorPeriodo[id] = Math.round(condonar ? 0 : Number(precioUnitarioVigente || 0));
    }
    if (anualSeleccionado) montosPorPeriodo[ID_CONTADO_ANUAL] = Math.round(Number(montoAnual || 0));
    if (matriculaSeleccionada) montosPorPeriodo[ID_MATRICULA] = Math.round(Number(montoMatricula || 0));

    setCargando(true);
    try {
      const payload = {
        id_alumno: Number(idAlumno),
        periodos: periodosSeleccionados,
        anio: Number(anioTrabajo),
        condonar: !!condonar,
        monto_unitario: Math.round(condonar ? 0 : Number(precioUnitarioVigente || 0)),
        montos_por_periodo: montosPorPeriodo,
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
          periodosMesesOrdenados.forEach(id => set.add(Number(id)));
          if (anualSeleccionado) set.add(ID_CONTADO_ANUAL);
          if (matriculaSeleccionada) set.add(ID_MATRICULA);
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

  // Acción post-éxito
  const handleComprobante = async () => {
    const periodos = [
      ...periodosMesesOrdenados,
      ...(anualSeleccionado ? [ID_CONTADO_ANUAL] : []),
      ...(matriculaSeleccionada ? [ID_MATRICULA] : []),
    ];
    const periodoCodigo = periodos[0] || 0;

    const alumnoParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodos,
      periodo_texto: periodoTextoFinal,
      precio_unitario: precioUnitarioVigente,
      importe_total: total,
      precio_total: total,
      anio: anioTrabajo,
      categoria_nombre: libreActivo ? 'LIBRE' : (nombreCategoria || ''),
      montos_por_periodo: {
        ...Object.fromEntries(periodosMesesOrdenados.map(id => [id, precioUnitarioVigente])),
        ...(anualSeleccionado ? { [ID_CONTADO_ANUAL]: Number(montoAnual || 0) } : {}),
        ...(matriculaSeleccionada ? { [ID_MATRICULA]: Number(montoMatricula || 0) } : {}),
      }
    };

    if (modoComprobante === 'pdf') {
      try {
        await generarComprobanteAlumnoPDF(alumnoParaImprimir, {
          anio: anioTrabajo,
          periodoId: periodoCodigo,
          periodoTexto: periodoTextoFinal,
          importeTotal: total,
          precioUnitario: precioUnitarioVigente,
          periodos,
        });
      } catch (e) {
        console.error('Error al generar PDF:', e);
        mostrarToast('error', 'No se pudo generar el PDF.');
      }
      return;
    }

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
    const tituloExito = condonar ? '¡Condonación registrada!' : '¡Pago registrado!';
    const subExito = condonar
      ? 'El período seleccionado quedó marcado como Condonado.'
      : 'Generá o imprimí el comprobante cuando quieras.';

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
          <div className="modal-pagos-contenido success-elevated">
            <div className="modal-header success-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle success-icon">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">{tituloExito}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose?.(true)} disabled={cargando} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body success-body">
              <div className="success-panel success-panel--full">
                <div className="success-left success-left--full">
                  <div className="success-check">
                    <span className="checkmark-giant" aria-hidden="true">✓</span>
                  </div>
                  <div className="success-texts">
                    <h3 className="success-title">{socio?.nombre || socio?.apellido_nombre || 'Alumno'}</h3>
                    <p className="success-sub">{subExito}</p>
                    <ul className="summary-list" aria-label="Resumen de pago">
                      <li><span>Valor por mes</span><strong>{formatearARS(precioUnitarioVigente)}</strong></li>
                      <li><span>Meses</span><strong>{periodosMesesOrdenados.length}</strong></li>
                      {anualSeleccionado && <li><span>Contado anual</span><strong>{formatearARS(montoAnual)}</strong></li>}
                      {matriculaSeleccionada && <li><span>Matrícula</span><strong>{formatearARS(montoMatricula)}</strong></li>}
                      <li><span>Total</span><strong>{formatearARS(total)}</strong></li>
                      {periodoTextoFinal && (
                        <li className="full-row"><span>Período</span><strong>{periodoTextoFinal}</strong></li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="success-actions">
                <div className="segmented" role="tablist" aria-label="Modo de comprobante">
                  <button
                    role="tab"
                    aria-selected={modoComprobante === 'imprimir'}
                    className={`segmented-item ${modoComprobante === 'imprimir' ? 'active' : ''}`}
                    onClick={() => setModoComprobante('imprimir')}
                  >
                    Imprimir
                  </button>
                  <button
                    role="tab"
                    aria-selected={modoComprobante === 'pdf'}
                    className={`segmented-item ${modoComprobante === 'pdf' ? 'active' : ''}`}
                    onClick={() => setModoComprobante('pdf')}
                  >
                    PDF
                  </button>
                </div>
                <div className="hint">
                  {modoComprobante === 'pdf'
                    ? 'Descargá un PDF listo para enviar o guardar.'
                    : 'Abrí la vista de impresión con tu diseño de recibo.'}
                </div>
              </div>
            </div>

            <div className="modal-footer success-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  Total: {formatearARS(total)}
                </span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose?.(true)} type="button">
                  Listo
                </button>
                <button className="btn btn-danger" onClick={handleComprobante} type="button">
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
          <div className="modal-header danger-header">
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
            <div className="socio-info-card socio-info-card--danger">
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
                <span className="valor-mes valor-mes--danger">
                  <strong>Valor mensual</strong>{' '}
                  {libreActivo ? '(LIBRE)' : (nombreCategoria ? `(${nombreCategoria})` : '')}: {formatearARS(precioUnitarioVigente)}
                </span>
              </div>
            </div>

            {/* Condonar + Año */}
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
                  disabled={cargando /* ya no se bloquea por matrícula */}
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

            {/* ====== EXTRAS: CONTADO ANUAL y MATRÍCULA ====== */}
            {ventanaAnualActiva && (
              <div className={`condonar-box ${anualSeleccionado ? 'is-active' : ''}`} style={{ marginTop: 10 }}>
                <label className="condonar-check">
                  <input
                    type="checkbox"
                    checked={anualSeleccionado}
                    onChange={(e) => toggleAnual(e.target.checked)}
                    disabled={cargando || matriculaSeleccionada || libreActivo /* opcional: evitar combinaciones raras */}
                  />
                  <span className="switch">
                    <span className="switch-thumb" />
                  </span>
                  <span className="switch-label">
                    <strong>CONTADO ANUAL</strong> {montoAnual > 0 ? `(${formatearARS(montoAnual)})` : '(sin monto anual definido)'}
                  </span>
                </label>
              </div>
            )}

            <div className={`condonar-box ${matriculaSeleccionada ? 'is-active' : ''}`} style={{ marginTop: 10 }}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={matriculaSeleccionada}
                  onChange={(e) => toggleMatricula(e.target.checked)}
                  disabled={cargando || anualSeleccionado /* ya no se bloquea por libreActivo */}
                />
                <span className="switch">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>MATRÍCULA</strong>
                  {!matriculaEditando && (
                    <>
                      <span style={{ marginLeft: 6 }}>{formatearARS(montoMatricula)}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Editar monto"
                        onClick={()=> setMatriculaEditando(true)}
                        style={{ marginLeft: 10 }}
                      >
                        <FaPen />
                      </button>
                    </>
                  )}
                </span>
              </label>

              {/* Bloque de edición */}
              {matriculaEditando && (
                <div
                  className="edit-inline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                    padding: 8,
                    border: '1px dashed #cbd5e1',
                    borderRadius: 10,
                    background: '#fff'
                  }}
                >
                  <input
                    type="number"
                    min="0"
                    step="500"
                    inputMode="numeric"
                    value={montoMatricula}
                    onChange={(e)=> setMontoMatricula(Number(e.target.value || 0))}
                    style={{ padding: 8, width: 180, borderRadius: 8, border: '1px solid #cbd5e1' }}
                    disabled={guardandoMatricula}
                  />

                  {/* Guardar (✓) */}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={guardarMatricula}
                    disabled={guardandoMatricula}
                    title="Guardar matrícula"
                    aria-label="Guardar matrícula"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 36, borderRadius: 8 }}
                  >
                    {guardandoMatricula ? '…' : <FaCheck />}
                  </button>

                  {/* Cancelar (✕) */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMatriculaEditando(false)}
                    disabled={guardandoMatricula}
                    title="Cancelar edición"
                    aria-label="Cancelar edición"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 36, borderRadius: 8 }}
                  >
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>

            {/* Selección de meses (1..12) */}
            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Meses disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || mesesGrid.length === 0 || matriculaSeleccionada || anualSeleccionado}
                    type="button"
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({seleccionados.length})
                  </button>
                </div>
              </div>

              {cargando && mesesGrid.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando meses...</span>
                </div>
              ) : (
                <div className="periodos-grid-container">
                  <div className="periodos-grid">
                    {mesesGrid.map((m) => {
                      const idMes = Number(m.id);
                      const estado = periodosEstado[idMes];
                      const yaOcupado = !!estado || periodosPagados.includes(idMes);
                      const sel = seleccionados.includes(idMes);

                      const disabledPorOtroModo = matriculaSeleccionada || anualSeleccionado;

                      return (
                        <div
                          key={idMes}
                          className={`periodo-card ${yaOcupado ? 'pagado' : ''} ${sel ? 'seleccionado' : ''} ${disabledPorOtroModo ? 'disabled' : ''}`}
                          role="button"
                          tabIndex={disabledPorOtroModo ? -1 : 0}
                          onClick={() => {
                            if (cargando || disabledPorOtroModo) return;
                            togglePeriodo(idMes);
                          }}
                          onKeyDown={(e) => {
                            if (cargando || disabledPorOtroModo) return;
                            if ((e.key === 'Enter' || e.key === ' ')) {
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
                              disabled={cargando || disabledPorOtroModo}
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
                className={`btn ${condonar ? 'btn-warning' : 'btn-danger'}`}
                onClick={confirmarPago}
                disabled={
                  cargando ||
                  (
                    seleccionados.length === 0 &&
                    !anualSeleccionado &&
                    !matriculaSeleccionada
                  )
                }
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
