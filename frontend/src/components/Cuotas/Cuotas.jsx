// src/components/Cuotas/Cuotas.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDollarSign,
  faPrint,
  faBarcode,
  faSearch,
  faCalendarAlt,
  faFilter,
  faSort,
  faUsers,
  faTimes,
  faArrowLeft,
  faFileExcel,
  faCheckCircle,
  faExclamationTriangle,
  faCog,
  faMoneyCheckAlt,
  faList
} from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import ModalPagos from './modales/ModalPagos';
import ModalCodigoBarras from './modales/ModalCodigoBarras';
import ModalEliminarPago from './modales/ModalEliminarPago';
import ModalEliminarCondonacion from './modales/ModalEliminarCondonacion';
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import Toast from '../Global/Toast';
import './Cuotas.css';

const normalizar = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const CURRENT_YEAR = new Date().getFullYear();

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const [busqueda, setBusqueda] = useState('');

  // Estado de pestaña (deudor | pagado | condonado)
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');

  // Año **de pago** (viene de pagos.fecha_pago). Lo fijamos luego de fetchAnios.
  const [anioSeleccionado, setAnioSeleccionado] = useState('');

  // Otros filtros
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [divisionSeleccionada, setDivisionSeleccionada] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');

  // Listas
  const [anios, setAnios] = useState([]);         // se llena con listar_anios
  const [categorias, setCategorias] = useState([]);
  const [divisiones, setDivisiones] = useState([]);
  const [meses, setMeses] = useState([]);

  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });

  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');

  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [mostrarModalEliminarCond, setMostrarModalEliminarCond] = useState(false);

  const [socioParaPagar, setSocioParaPagar] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedRow, setSelectedRow] = useState(null);

  // Animación cascada
  const [cascadeActive, setCascadeActive] = useState(false);
  const [cascadeRunId, setCascadeRunId] = useState(0);
  const cascadeTimerRef = useRef(null);
  const triggerCascade = useCallback(() => {
    setCascadeActive(true);
    setCascadeRunId(prev => prev + 1);
    if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    cascadeTimerRef.current = setTimeout(() => setCascadeActive(false), 1200);
  }, []);
  useEffect(() => () => { if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current); }, []);

  const navigate = useNavigate();
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helpers de lectura
  const getIdMesFromCuota = (c) => c?.id_mes ?? c?.id_periodo ?? '';
  const getNombreCuota = (c) => c?.nombre ?? '';
  const getDomicilioCuota = (c) => c?.domicilio ?? '';
  const getDocumentoCuota = (c) => c?.documento ?? c?.dni ?? c?.num_documento ?? '';
  const getIdAlumnoFromCuota = (c) => c?.id_alumno ?? c?.id_socio ?? c?.id ?? '';

  const getNombreDivision = (id) => (divisiones.find(d => String(d.id) === String(id))?.nombre) || '';
  const getNombreCategoria = (id) => (categorias.find(c => String(c.id) === String(id))?.nombre) || '';
  const getNombreMes = (id) => (meses.find(m => String(m.id) === String(id))?.nombre) || id;

  // === Traer años que tienen pagos (listar_anios) ===
  const fetchAnios = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=cuotas&listar_anios=1`);
      const data = await res.json().catch(() => ({}));
      const lista = (data?.anios && Array.isArray(data.anios)) ? data.anios : [];
      setAnios(lista);

      // Lógica de selección por defecto
      const hasCurrent = lista.some(a => String(a.id) === String(CURRENT_YEAR));
      if (hasCurrent) {
        setAnioSeleccionado(String(CURRENT_YEAR));
      } else if (lista.length > 0) {
        setAnioSeleccionado(String(lista[0].id));
      } else {
        setAnioSeleccionado('');
      }
    } catch (e) {
      console.error('Error al obtener años:', e);
      setAnios([]);
      setAnioSeleccionado('');
    }
  }, []);

  // === Obtener cuotas + listas (meses/categorías/divisiones) ===
  const obtenerCuotasYListas = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('action', 'cuotas');
      if (mesSeleccionado) params.set('id_mes', String(mesSeleccionado));
      if (anioSeleccionado) params.set('anio', String(anioSeleccionado)); // AÑO DE PAGO (BACKEND)

      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?${params.toString()}`),
        fetch(`${BASE_URL}/api.php?action=obtener_listas`)
      ]);

      const dataCuotas = await resCuotas.json().catch(() => ({}));
      const dataListas = await resListas.json().catch(() => ({}));

      setCuotas(dataCuotas?.exito && Array.isArray(dataCuotas.cuotas) ? dataCuotas.cuotas : []);

      if (dataListas?.exito) {
        const L = dataListas.listas || {};
        setCategorias(Array.isArray(L.categorias) ? L.categorias : []);
        setDivisiones(Array.isArray(L.divisiones) ? L.divisiones : []);
        setMeses(Array.isArray(L.meses) ? L.meses : []);
      } else {
        setCategorias([]); setDivisiones([]); setMeses([]);
      }
    } catch (e) {
      console.error('Error al conectar con el servidor:', e);
      setCuotas([]); setCategorias([]); setDivisiones([]); setMeses([]);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado, anioSeleccionado]);

  // Cargar años y luego datos
  useEffect(() => {
    fetchAnios();
  }, [fetchAnios]);

  useEffect(() => {
    obtenerCuotasYListas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado, anioSeleccionado]);

  // ===== Patch optimista tras pagar/condonar =====
  const patchCuotasAfterPago = useCallback(({ idAlumno, periodos, estado }) => {
    if (!idAlumno || !Array.isArray(periodos) || periodos.length === 0) return;

    setCuotas(prev =>
      prev.map((c) => {
        const sameAlumno = String(getIdAlumnoFromCuota(c)) === String(idAlumno);
        const mes = Number(getIdMesFromCuota(c));
        if (sameAlumno && periodos.includes(mes)) {
          return { ...c, estado_pago: estado };
        }
        return c;
      })
    );
  }, []);

  // Filtros locales (NO filtramos por año en el cliente: el año lo aplica el backend)
  const coincideBusquedaLibre = (c) => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(getNombreCuota(c)).includes(q) ||
      normalizar(getDomicilioCuota(c)).includes(q) ||
      normalizar(getDocumentoCuota(c)).includes(q)
    );
  };
  const coincideCategoria = (c) =>
    !categoriaSeleccionada || String(c?.id_categoria ?? '') === String(categoriaSeleccionada);
  const coincideDivision = (c) =>
    !divisionSeleccionada || String(c?.id_division ?? '') === String(divisionSeleccionada);
  const coincideMes = (c) =>
    !mesSeleccionado || String(getIdMesFromCuota(c)) === String(mesSeleccionado);
  const coincideEstadoPago = (c) =>
    !estadoPagoSeleccionado || String(c?.estado_pago ?? '').toLowerCase() === estadoPagoSeleccionado;

  const ordenarPor = (a, b, campo, asc) => {
    let va = '', vb = '';
    switch (campo) {
      case 'nombre': va = getNombreCuota(a); vb = getNombreCuota(b); break;
      case 'domicilio': va = getDomicilioCuota(a); vb = getDomicilioCuota(b); break;
      case 'dni': va = String(getDocumentoCuota(a)); vb = String(getDocumentoCuota(b)); break;
      default: va = getNombreCuota(a); vb = getNombreCuota(b);
    }
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  };

  // Lista para la pestaña seleccionada
  const cuotasFiltradas = useMemo(() => {
    if (!mesSeleccionado) return [];
    return cuotas
      .filter(coincideEstadoPago)
      .filter(coincideBusquedaLibre)
      .filter(coincideCategoria)
      .filter(coincideDivision)
      .filter(coincideMes)
      .sort((a, b) => ordenarPor(a, b, orden.campo, orden.ascendente));
  }, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado, estadoPagoSeleccionado, orden]);

  // Contadores SIEMPRE sobre el dataset completo del mes
  const contarConFiltros = (estadoPago) =>
    cuotas.filter((c) =>
      String(getIdMesFromCuota(c)) === String(mesSeleccionado || '') &&
      (!busqueda || coincideBusquedaLibre(c)) &&
      coincideCategoria(c) &&
      coincideDivision(c) &&
      (String(c?.estado_pago ?? '').toLowerCase() === estadoPago)
    ).length;

  const cantidadFiltradaDeudores   = useMemo(() => mesSeleccionado ? contarConFiltros('deudor')    : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado]);
  const cantidadFiltradaPagados    = useMemo(() => mesSeleccionado ? contarConFiltros('pagado')    : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado]);
  const cantidadFiltradaCondonados = useMemo(() => mesSeleccionado ? contarConFiltros('condonado') : 0, [cuotas, busqueda, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado]);

  const toggleOrden = useCallback((campo) => {
    setOrden(prev => ({ campo, ascendente: prev.campo === campo ? !prev.ascendente : true }));
    triggerCascade();
  }, [triggerCascade]);

  const handleImprimirTodos = async () => {
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) { alert('Deshabilite el bloqueador de popups para imprimir'); return; }
    setLoadingPrint(true);
    try { await imprimirRecibos(cuotasFiltradas, mesSeleccionado, ventanaImpresion); }
    catch (e) { console.error('Error al imprimir:', e); ventanaImpresion.close(); }
    finally { setLoadingPrint(false); }
  };

  const handleRowClick = useCallback((index) => { if (typeof index === 'number' && index >= 0) setSelectedRow(prev => prev === index ? null : index); }, []);
  const handlePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalPagos(true); }, []);
  const handleDeletePaymentClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarPago(true); }, []);
  const handleDeleteCondClick = useCallback((item) => { setSocioParaPagar(item); setMostrarModalEliminarCond(true); }, []);
  const handlePrintClick = useCallback((item) => {
    const w = window.open('', '_blank'); if (w) imprimirRecibos([item], mesSeleccionado, w); else alert('Deshabilite el bloqueador de popups para imprimir');
  }, [mesSeleccionado]);

  const handleExportExcel = useCallback(() => {
    if (!mesSeleccionado) { setToastTipo('advertencia'); setToastMensaje('Seleccione un mes'); setToastVisible(true); return; }
    if (loading) { setToastTipo('advertencia'); setToastMensaje('Esperando datos...'); setToastVisible(true); return; }
    if (cuotasFiltradas.length === 0) { setToastTipo('advertencia'); setToastMensaje('No hay datos'); setToastVisible(true); return; }
    setToastTipo('exito'); setToastMensaje('Exportación a Excel iniciada'); setToastVisible(true);
  }, [mesSeleccionado, loading, cuotasFiltradas.length]);

  const onChangeMes       = (e) => { setMesSeleccionado(e.target.value); triggerCascade(); };
  const onChangeAnio      = (e) => { setAnioSeleccionado(e.target.value); triggerCascade(); }; // AÑO de pago (backend)
  const onChangeCategoria = (e) => { setCategoriaSeleccionada(e.target.value); triggerCascade(); };
  const onChangeDivision  = (e) => { setDivisionSeleccionada(e.target.value); triggerCascade(); };
  const onChangeBusqueda  = (e) => { setBusqueda(e.target.value); triggerCascade(); };

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    const isSelected = selectedRow === index;

    const nombreDiv  = getNombreDivision(cuota?.id_division);
    const nombreCat  = getNombreCategoria(cuota?.id_categoria);
    const tipoCat    = normalizar(nombreCat);
    const isInterno  = tipoCat === 'interno';
    const isExterno  = tipoCat === 'externo';

    const cascadeClass = cascadeActive && index < 15 ? `gcuotas-cascade gcuotas-cascade-${index}` : '';
    const zebraClass   = index % 2 === 0 ? 'gcuotas-row-even' : 'gcuotas-row-odd';

    const actionButtons = isSelected ? (
      <div className="gcuotas-actions-inline">
        <button
          className="gcuotas-action-button gcuotas-print-button"
          onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
          title="Imprimir recibo"
        >
          <FontAwesomeIcon icon={faPrint} />
        </button>
        {estadoPagoSeleccionado === 'deudor' ? (
          <button
            className="gcuotas-action-button gcuotas-payment-button"
            onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
            title="Registrar pago / Condonar"
          >
            <FontAwesomeIcon icon={faDollarSign} />
          </button>
        ) : estadoPagoSeleccionado === 'pagado' ? (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
            title="Eliminar pago"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        ) : (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
            title="Eliminar condonación"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>
    ) : null;

    if (isMobile) {
      return (
        <div
          style={style}
          className={`gcuotas-mobile-card ${cascadeClass} ${isSelected ? "gcuotas-selected-card" : ""}`}
          onClick={() => handleRowClick(index)}
        >
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Alumno:</span>
            <span>{getNombreCuota(cuota)}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">DNI:</span>
            <span>{getDocumentoCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Domicilio:</span>
            <span>{getDomicilioCuota(cuota) || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">División:</span>
            <span>{nombreDiv || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Categoría:</span>
            <span>
              <span
                className={`gcuotas-chip ${
                  isInterno ? 'gcuotas-chip--interno'
                  : isExterno ? 'gcuotas-chip--externo'
                  : 'gcuotas-chip--default'
                }`}
              >
                {nombreCat || '—'}
              </span>
            </span>
          </div>
          {isSelected && (
            <div className="gcuotas-mobile-actions">
              <button
                className="gcuotas-mobile-print-button"
                onClick={(e) => { e.stopPropagation(); handlePrintClick(cuota); }}
              >
                <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
              </button>
              {estadoPagoSeleccionado === 'deudor' ? (
                <button
                  className="gcuotas-mobile-payment-button"
                  onClick={(e) => { e.stopPropagation(); handlePaymentClick(cuota); }}
                >
                  <FontAwesomeIcon icon={faDollarSign} /><span>Registrar Pago</span>
                </button>
              ) : estadoPagoSeleccionado === 'pagado' ? (
                <button
                  className="gcuotas-mobile-deletepay-button"
                  onClick={(e) => { e.stopPropagation(); handleDeletePaymentClick(cuota); }}
                >
                  <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
                </button>
              ) : (
                <button
                  className="gcuotas-mobile-deletepay-button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCondClick(cuota); }}
                >
                  <FontAwesomeIcon icon={faTimes} /><span>Eliminar</span>
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        style={style}
        className={`gcuotas-virtual-row ${zebraClass} ${cascadeClass} ${isSelected ? "gcuotas-selected-row" : ""}`}
        onClick={() => handleRowClick(index)}
      >
        <div className="gcuotas-virtual-cell">{getNombreCuota(cuota)}</div>
        <div className="gcuotas-virtual-cell">{getDocumentoCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getDomicilioCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getNombreDivision(cuota?.id_division) || '—'}</div>
        <div className="gcuotas-virtual-cell">
          <span
            className={`gcuotas-chip ${
              isInterno ? 'gcuotas-chip--interno'
              : isExterno ? 'gcuotas-chip--externo'
              : 'gcuotas-chip--default'
            }`}
          >
            {getNombreCategoria(cuota?.id_categoria) || '—'}
          </span>
        </div>
        <div className="gcuotas-virtual-cell gcuotas-virtual-actions">{actionButtons}</div>
      </div>
    );
  };

  const LoadingIndicator = () => (
    <div className="gcuotas-loading-container">
      <div className="gcuotas-loading-spinner"></div>
      <p>Cargando datos...</p>
    </div>
  );
  const NoMonthSelected  = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faCalendarAlt} size="3x" />
      <p>Por favor seleccione un mes para ver los datos</p>
    </div>
  );
  const NoDataFound      = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
      <p>No se encontraron datos para los filtros seleccionados</p>
    </div>
  );

  // Tras cerrar modales, refrescamos **años** y **datos**
  const resyncAll = useCallback(() => { fetchAnios(); obtenerCuotasYListas(); }, [fetchAnios, obtenerCuotasYListas]);

  return (
    <div className="gcuotas-container">
      {toastVisible && (
        <Toast
          tipo={toastTipo}
          mensaje={toastMensaje}
          onClose={() => setToastVisible(false)}
          duracion={3000}
        />
      )}

      {mostrarModalPagos && (
        <ModalPagos
          socio={socioParaPagar}
          onClose={(ok, payload) => {
            setMostrarModalPagos(false);
            if (ok && payload) {
              patchCuotasAfterPago(payload);
            }
            resyncAll();
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={() => setMostrarModalCodigoBarras(false)}
          periodo={getNombreMes(mesSeleccionado)}
          periodoId={mesSeleccionado}
          onPagoRealizado={resyncAll}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodoId={Number(mesSeleccionado)}
          periodoNombre={getNombreMes(mesSeleccionado)}
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={resyncAll}
        />
      )}

      {mostrarModalEliminarCond && (
        <ModalEliminarCondonacion
          socio={socioParaPagar}
          periodo={Number(mesSeleccionado)}
          periodoTexto={getNombreMes(mesSeleccionado)}
          onClose={() => setMostrarModalEliminarCond(false)}
          onEliminado={resyncAll}
        />
      )}

      <div className="gcuotas-left-section gcuotas-box">
        <div className="gcuotas-header-section">
          <h2 className="gcuotas-title">
            <FontAwesomeIcon icon={faMoneyCheckAlt} className="gcuotas-title-icon" />
            Gestión de Cuotas
          </h2>
          <div className="gcuotas-divider"></div>
        </div>

        <div className="gcuotas-scrollable-content">
          <div className="gcuotas-top-section">
            <div className="gcuotas-filter-card">
              <div className="gcuotas-filter-header">
                <div className="gcuotas-filter-header-left">
                  <FontAwesomeIcon icon={faFilter} className="gcuotas-filter-icon" />
                  <span>Filtros</span>
                </div>
              </div>

              <div className="gcuotas-select-container">
                {/* AÑO DE PAGO (arriba del Mes) */}
                <div className="gcuotas-input-group">
                  <label htmlFor="anio" className="gcuotas-input-label">
                    <FontAwesomeIcon icon={faFilter} /> Año de pago
                  </label>
                  <select
                    id="anio"
                    value={anioSeleccionado}
                    onChange={onChangeAnio}
                    className="gcuotas-dropdown"
                    disabled={loading || anios.length === 0}
                  >
                    {anios.length === 0 ? (
                      <option value="">Sin pagos</option>
                    ) : (
                      anios.map((a, idx) => (
                        <option key={idx} value={a.id}>{a.nombre}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="gcuotas-input-group">
                  <label htmlFor="meses" className="gcuotas-input-label">
                    <FontAwesomeIcon icon={faCalendarAlt} /> Mes
                  </label>
                  <select
                    id="meses"
                    value={mesSeleccionado}
                    onChange={onChangeMes}
                    className="gcuotas-dropdown"
                    disabled={loading}
                  >
                    <option value="">Seleccione un Mes</option>
                    {meses.map((mes, idx) => (
                      <option key={idx} value={mes.id}>{mes.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="gcuotas-input-group">
                  <label htmlFor="categoria" className="gcuotas-input-label">
                    <FontAwesomeIcon icon={faFilter} /> Categoría
                  </label>
                  <select
                    id="categoria"
                    value={categoriaSeleccionada}
                    onChange={onChangeCategoria}
                    className="gcuotas-dropdown"
                    disabled={loading}
                  >
                    <option value="">Todas</option>
                    {categorias.map((c, idx) => (
                      <option key={idx} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="gcuotas-input-group">
                  <label htmlFor="division" className="gcuotas-input-label">
                    <FontAwesomeIcon icon={faFilter} /> División
                  </label>
                  <select
                    id="division"
                    value={divisionSeleccionada}
                    onChange={onChangeDivision}
                    className="gcuotas-dropdown"
                    disabled={loading}
                  >
                    <option value="">Todas</option>
                    {divisiones.map((d, idx) => (
                      <option key={idx} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="gcuotas-tabs-card">
              <div className="gcuotas-tabs-header">
                <FontAwesomeIcon icon={faList} className="gcuotas-tabs-icon" />
                <span>Estado de cuotas</span>
              </div>
              <div className="gcuotas-tab-container">
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'deudor' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('deudor')}
                  disabled={loading}
                  title="Deudores"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaDeudores}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'pagado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                  title="Pagados"
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaPagados}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'condonado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('condonado')}
                  disabled={loading}
                  title="Condonados"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className="gcuotas-tab-badge">{cantidadFiltradaCondonados}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="gcuotas-actions-card">
            <div className="gcuotas-actions-header">
              <FontAwesomeIcon icon={faCog} className="gcuotas-actions-icon" />
              <span>Acciones</span>
            </div>
            <div className="gcuotas-buttons-container">
              <button
                className="gcuotas-button gcuotas-button-back"
                onClick={() => navigate('/panel')}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
              </button>
              <button
                className="gcuotas-button gcuotas-button-export"
                onClick={handleExportExcel}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
              </button>
              <button
                className={`gcuotas-button gcuotas-button-print-all ${loadingPrint ? 'gcuotas-button-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={loadingPrint || !mesSeleccionado || cuotasFiltradas.length === 0 || loading}
              >
                <FontAwesomeIcon icon={faPrint} /><span>{loadingPrint ? 'Generando...' : 'Imprimir'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`gcuotas-right-section gcuotas-box ${isMobile ? 'gcuotas-has-bottombar' : ''}`}>
        <div className="gcuotas-table-header">
          <h3>
            <FontAwesomeIcon icon={estadoPagoSeleccionado === 'pagado' ? faCheckCircle : faExclamationTriangle} />
            {estadoPagoSeleccionado === 'pagado'
              ? 'Cuotas Pagadas'
              : estadoPagoSeleccionado === 'condonado'
                ? 'Cuotas Condonadas'
                : 'Cuotas Pendientes'}
            {mesSeleccionado && (<span className="gcuotas-periodo-seleccionado"> - {getNombreMes(mesSeleccionado)}</span>)}
          </h3>
          <div className="gcuotas-input-group gcuotas-search-group">
            <div className="gcuotas-search-integrated">
              <FontAwesomeIcon icon={faSearch} className="gcuotas-search-icon" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={busqueda}
                onChange={onChangeBusqueda}
                disabled={loading || !mesSeleccionado}
              />
            </div>
          </div>
          <div className="gcuotas-summary-info">
            <span className="gcuotas-summary-item">
              <FontAwesomeIcon icon={faUsers} /> Total: {mesSeleccionado ? cuotasFiltradas.length : 0}
            </span>
          </div>
        </div>

        <div className="gcuotas-table-container">
          {loading ? <LoadingIndicator /> :
            !mesSeleccionado ? <NoMonthSelected /> :
              cuotasFiltradas.length === 0 ? <NoDataFound /> :
                isMobile ? (
                  <div className="gcuotas-mobile-list">
                    {cuotasFiltradas.map((item, index) => (
                      <Row key={`${cascadeRunId}-${index}`} index={index} style={{}} data={cuotasFiltradas} />
                    ))}
                  </div>
                ) : (
                  <div className="gcuotas-virtual-tables" style={{ height: "75vh" }}>
                    <div className="gcuotas-virtual-header">
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('nombre')}>
                        Alumno <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'nombre' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'nombre' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('dni')}>
                        DNI <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'dni' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'dni' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell" onClick={() => toggleOrden('domicilio')}>
                        Domicilio <FontAwesomeIcon icon={faSort} className={`gcuotas-sort-icon ${orden.campo === 'domicilio' ? 'gcuotas-sort-active' : ''}`} />
                        {orden.campo === 'domicilio' && (orden.ascendente ? ' ↑' : ' ↓')}
                      </div>
                      <div className="gcuotas-virtual-cell">División</div>
                      <div className="gcuotas-virtual-cell">Categoría</div>
                      <div className="gcuotas-virtual-cell">Acciones</div>
                    </div>

                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          key={`list-${cascadeRunId}`}
                          height={height}
                          itemCount={cuotasFiltradas.length}
                          itemSize={60}
                          width={width}
                          itemData={cuotasFiltradas}
                          className="gcuotas-listoverflow"
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                )}
        </div>
      </div>

      {isMobile && (
        <div className="gcuotas-mobile-bottombar">
          <button
            className="gcuotas-mbar-btn mbar-back"
            onClick={() => navigate('/panel')}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowLeft} /><span>Volver</span>
          </button>
          <button
            className="gcuotas-mbar-btn mbar-excel"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faFileExcel} /><span>Excel</span>
          </button>
          <button
            className="gcuotas-mbar-btn mbar-barcode"
            onClick={() => setMostrarModalCodigoBarras(true)}
            disabled={loading || !mesSeleccionado}
          >
            <FontAwesomeIcon icon={faBarcode} /><span>Barras</span>
          </button>
          <button
            className="gcuotas-mbar-btn mbar-imprimir"
            onClick={handleImprimirTodos}
            disabled={loadingPrint || !mesSeleccionado || cuotasFiltradas.length === 0 || loading}
          >
            <FontAwesomeIcon icon={faPrint} /><span>Imprimir</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Cuotas;
