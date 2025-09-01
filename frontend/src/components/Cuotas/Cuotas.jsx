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
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import Toast from '../Global/Toast';
import './Cuotas.css';

const normalizar = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');
  const [anioSeleccionado, setAnioSeleccionado] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [divisionSeleccionada, setDivisionSeleccionada] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [anios, setAnios] = useState([]);
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
  const [socioParaPagar, setSocioParaPagar] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedRow, setSelectedRow] = useState(null);

  // ---- Control de animación en cascada ----
  const [cascadeActive, setCascadeActive] = useState(false);
  const [cascadeRunId, setCascadeRunId] = useState(0);
  const cascadeTimerRef = useRef(null);

  const triggerCascade = useCallback(() => {
    // Activa solo cuando filtrás o buscás; evita que se repita al scrollear
    setCascadeActive(true);
    setCascadeRunId(prev => prev + 1); // fuerza remount del List
    if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    // Duración_total_aprox = último delay (0.70s) + anim (0.40s) ≈ 1.1s
    cascadeTimerRef.current = setTimeout(() => setCascadeActive(false), 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    };
  }, []);

  const navigate = useNavigate();

  // Detectar cambios en el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getIdMesFromCuota = (c) =>
    c?.id_mes ?? c?.id_periodo ?? c?.mes_id ?? c?.periodo_id ?? '';

  const getIdAnioFromCuota = (c) =>
    c?.id_anio ?? c?.id_año ?? c?.anio_id ?? '';

  const getIdCategoriaFromCuota = (c) =>
    c?.id_categoria ?? c?.categoria_id ?? '';

  const getIdDivisionFromCuota = (c) =>
    c?.id_division ?? c?.division_id ?? '';

  const getNombreCuota = (c) => c?.nombre ?? c?.socio ?? '';
  const getDomicilioCuota = (c) => c?.domicilio ?? '';
  const getDocumentoCuota = (c) => c?.documento ?? c?.dni ?? '';

  const getNombreAnio = (id) => {
    const a = anios.find(x => String(x.id) === String(id));
    return a ? a.nombre : '';
  };
  const getNombreDivision = (id) => {
    const d = divisiones.find(x => String(x.id) === String(id));
    return d ? d.nombre : '';
  };
  const getNombreCategoria = (id) => {
    const c = categorias.find(x => String(x.id) === String(id));
    return c ? c.nombre : '';
  };

  const obtenerCuotasYListas = async () => {
    try {
      setLoading(true);

      const cuotasUrl = `${BASE_URL}/api.php?action=cuotas${
        estadoPagoSeleccionado === 'pagado' ? '&pagados=1' : ''
      }`;

      const [resCuotas, resListas] = await Promise.all([
        fetch(cuotasUrl),
        fetch(`${BASE_URL}/api.php?action=obtener_listas`),
      ]);

      const dataCuotas = await resCuotas.json().catch(() => ({}));
      const dataListas = await resListas.json().catch(() => ({}));

      if (dataCuotas?.exito) {
        setCuotas(Array.isArray(dataCuotas.cuotas) ? dataCuotas.cuotas : []);
      } else {
        setCuotas([]);
      }

      if (dataListas?.exito) {
        const L = dataListas.listas || {};
        setAnios(Array.isArray(L.anios) ? L.anios : []);
        setCategorias(Array.isArray(L.categorias) ? L.categorias : []);
        setDivisiones(Array.isArray(L.divisiones) ? L.divisiones : []);
        setMeses(Array.isArray(L.meses) ? L.meses : []);
      } else {
        setAnios([]); setCategorias([]); setDivisiones([]); setMeses([]);
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
      setCuotas([]);
      setAnios([]); setCategorias([]); setDivisiones([]); setMeses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerCuotasYListas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoPagoSeleccionado]);

  const coincideBusquedaLibre = (c) => {
    if (!busqueda) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(getNombreCuota(c)).includes(q) ||
      normalizar(getDomicilioCuota(c)).includes(q) ||
      normalizar(getDocumentoCuota(c)).includes(q)
    );
  };

  const coincideAnio = (c) =>
    !anioSeleccionado ||
    String(getIdAnioFromCuota(c)) === String(anioSeleccionado) ||
    normalizar(c?.anio ?? c?.año ?? '').includes(
      normalizar(
        anios.find(a => String(a.id) === String(anioSeleccionado))?.nombre || ''
      )
    );

  const coincideCategoria = (c) =>
    !categoriaSeleccionada ||
    String(getIdCategoriaFromCuota(c)) === String(categoriaSeleccionada) ||
    normalizar(c?.categoria ?? '').includes(
      normalizar(
        categorias.find(a => String(a.id) === String(categoriaSeleccionada))?.nombre || ''
      )
    );

  const coincideDivision = (c) =>
    !divisionSeleccionada ||
    String(getIdDivisionFromCuota(c)) === String(divisionSeleccionada) ||
    normalizar(c?.division ?? '').includes(
      normalizar(
        divisiones.find(a => String(a.id) === String(divisionSeleccionada))?.nombre || ''
      )
    );

  const coincideMes = (c) =>
    !mesSeleccionado ||
    String(getIdMesFromCuota(c)) === String(mesSeleccionado) ||
    normalizar(c?.mes ?? c?.periodo ?? '').includes(
      normalizar(
        meses.find(m => String(m.id) === String(mesSeleccionado))?.nombre || ''
      )
    );

  const coincideEstadoPago = (c) => {
    if (!estadoPagoSeleccionado) return true;
    return String(c?.estado_pago ?? '').toLowerCase() === estadoPagoSeleccionado;
  };

  const ordenarPor = (a, b, campo, asc) => {
    let va = '';
    let vb = '';
    switch (campo) {
      case 'nombre':
        va = getNombreCuota(a); vb = getNombreCuota(b); break;
      case 'domicilio':
        va = getDomicilioCuota(a); vb = getDomicilioCuota(b); break;
      case 'dni':
        va = String(getDocumentoCuota(a)); vb = String(getDocumentoCuota(b)); break;
      default:
        va = getNombreCuota(a); vb = getNombreCuota(b);
    }
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  };

  const cuotasFiltradas = useMemo(() => {
    if (!mesSeleccionado) return [];

    const data = cuotas
      .filter(coincideEstadoPago)
      .filter(coincideBusquedaLibre)
      .filter(coincideAnio)
      .filter(coincideCategoria)
      .filter(coincideDivision)
      .filter(coincideMes);

    return data.sort((a, b) => ordenarPor(a, b, orden.campo, orden.ascendente));
  }, [
    cuotas,
    busqueda,
    anioSeleccionado,
    categoriaSeleccionada,
    divisionSeleccionada,
    mesSeleccionado,
    estadoPagoSeleccionado,
    orden
  ]);

  const contarConFiltros = (estadoPago) =>
    cuotas.filter((c) =>
      String((getIdMesFromCuota(c))) === String(mesSeleccionado || '') &&
      coincideBusquedaLibre(c) &&
      coincideAnio(c) &&
      coincideCategoria(c) &&
      coincideDivision(c) &&
      (String(c?.estado_pago ?? '').toLowerCase() === estadoPago)
    ).length;

  const cantidadFiltradaDeudores = useMemo(
    () => contarConFiltros('deudor'),
    [cuotas, busqueda, anioSeleccionado, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado]
  );

  const cantidadFiltradaPagados = useMemo(
    () => contarConFiltros('pagado'),
    [cuotas, busqueda, anioSeleccionado, categoriaSeleccionada, divisionSeleccionada, mesSeleccionado]
  );

  const toggleOrden = (campo) => {
    setOrden(prev => ({
      campo,
      ascendente: prev.campo === campo ? !prev.ascendente : true
    }));
  };

  const handleImprimirTodos = async () => {
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
      alert('Por favor deshabilita el bloqueador de ventanas emergentes para esta página');
      return;
    }
    setLoadingPrint(true);
    try {
      await imprimirRecibos(cuotasFiltradas, mesSeleccionado, ventanaImpresion);
    } catch (error) {
      console.error('Error al imprimir:', error);
      ventanaImpresion.close();
    } finally {
      setLoadingPrint(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setAnioSeleccionado('');
    setCategoriaSeleccionada('');
    setDivisionSeleccionada('');
    setToastTipo('exito');
    setToastMensaje('Filtros limpiados correctamente');
    setToastVisible(true);
    triggerCascade(); // es un cambio de filtros, activamos cascada
  };

  const handleRowClick = useCallback((index) => {
    if (typeof index !== "number" || index < 0) return;
    setSelectedRow(prev => (prev === index ? null : index));
  }, []);

  const handlePaymentClick = useCallback((item) => {
    setSocioParaPagar(item);
    setMostrarModalPagos(true);
  }, []);

  const handleDeletePaymentClick = useCallback((item) => {
    setSocioParaPagar(item);
    setMostrarModalEliminarPago(true);
  }, []);

  const handlePrintClick = useCallback((item) => {
    const ventanaImpresion = window.open('', '_blank');
    if (ventanaImpresion) {
      imprimirRecibos([item], mesSeleccionado, ventanaImpresion);
    } else {
      alert('Por favor deshabilita el bloqueador de ventanas emergentes para imprimir');
    }
  }, [mesSeleccionado]);

  const getNombreMes = (id) => {
    const m = meses.find(p => String(p.id) === String(id));
    return m ? m.nombre : id;
  };

  const handleExportExcel = useCallback(() => {
    if (!mesSeleccionado) {
      setToastTipo('advertencia');
      setToastMensaje('Por favor seleccione un mes primero');
      setToastVisible(true);
      return;
    }
    if (loading) {
      setToastTipo('advertencia');
      setToastMensaje('Espere a que terminen de cargarse los datos');
      setToastVisible(true);
      return;
    }
    if (cuotasFiltradas.length === 0) {
      setToastTipo('advertencia');
      setToastMensaje('No hay datos para exportar');
      setToastVisible(true);
      return;
    }

    // Aquí iría la lógica para exportar a Excel
    setToastTipo('exito');
    setToastMensaje('Exportación a Excel iniciada');
    setToastVisible(true);
  }, [mesSeleccionado, loading, cuotasFiltradas.length]);

  // Handlers que ACTIVAN la cascada SOLO en filtros y búsqueda
  const onChangeMes = (e) => { setMesSeleccionado(e.target.value); triggerCascade(); };
  const onChangeAnio = (e) => { setAnioSeleccionado(e.target.value); triggerCascade(); };
  const onChangeCategoria = (e) => { setCategoriaSeleccionada(e.target.value); triggerCascade(); };
  const onChangeDivision = (e) => { setDivisionSeleccionada(e.target.value); triggerCascade(); };
  const onChangeBusqueda = (e) => { setBusqueda(e.target.value); triggerCascade(); };

  // Componente Row para la lista virtual (aplica clases de cascada SOLO si cascadeActive)
  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    const isSelected = selectedRow === index;

    const idAnio = getIdAnioFromCuota(cuota);
    const idDiv = getIdDivisionFromCuota(cuota);
    const idCat = getIdCategoriaFromCuota(cuota);

    const nombreAnio = getNombreAnio(idAnio);
    const nombreDiv = getNombreDivision(idDiv);
    const nombreCat = getNombreCategoria(idCat);

    const cascadeClass =
      cascadeActive && index < 15 ? `gcuotas-cascade gcuotas-cascade-${index}` : '';

    const actionButtons = isSelected ? (
      <div className="gcuotas-actions-inline">
        <button
          className="gcuotas-action-button gcuotas-print-button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrintClick(cuota);
          }}
          title="Imprimir recibo"
        >
          <FontAwesomeIcon icon={faPrint} />
        </button>

        {estadoPagoSeleccionado === 'deudor' ? (
          <button
            className="gcuotas-action-button gcuotas-payment-button"
            onClick={(e) => {
              e.stopPropagation();
              handlePaymentClick(cuota);
            }}
            title="Registrar pago"
          >
            <FontAwesomeIcon icon={faDollarSign} />
          </button>
        ) : (
          <button
            className="gcuotas-action-button gcuotas-deletepay-button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePaymentClick(cuota);
            }}
            title="Eliminar pago"
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
            <span className="gcuotas-mobile-label">Curso:</span>
            <span>{nombreAnio || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">División:</span>
            <span>{nombreDiv || '—'}</span>
          </div>
          <div className="gcuotas-mobile-row">
            <span className="gcuotas-mobile-label">Categoría:</span>
            <span>{nombreCat || '—'}</span>
          </div>

          {isSelected && (
            <div className="gcuotas-mobile-actions">
              <button
                className="gcuotas-mobile-print-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintClick(cuota);
                }}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>Imprimir</span>
              </button>

              {estadoPagoSeleccionado === 'deudor' ? (
                <button
                  className="gcuotas-mobile-payment-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePaymentClick(cuota);
                  }}
                >
                  <FontAwesomeIcon icon={faDollarSign} />
                  <span>Registrar Pago</span>
                </button>
              ) : (
                <button
                  className="gcuotas-mobile-deletepay-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePaymentClick(cuota);
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                  <span>Eliminar</span>
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
        className={`gcuotas-virtual-row ${cascadeClass} ${isSelected ? "gcuotas-selected-row" : ""}`}
        onClick={() => handleRowClick(index)}
      >
        <div className="gcuotas-virtual-cell">{getNombreCuota(cuota)}</div>
        <div className="gcuotas-virtual-cell">{getDocumentoCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{getDomicilioCuota(cuota) || '—'}</div>
        <div className="gcuotas-virtual-cell">{nombreAnio || '—'}</div>
        <div className="gcuotas-virtual-cell">{nombreDiv || '—'}</div>
        <div className="gcuotas-virtual-cell">{nombreCat || '—'}</div>
        <div className="gcuotas-virtual-cell gcuotas-virtual-actions">{actionButtons}</div>
      </div>
    );
  };

  // Componentes de estado
  const LoadingIndicator = () => (
    <div className="gcuotas-loading-container">
      <div className="gcuotas-loading-spinner"></div>
      <p>Cargando datos...</p>
    </div>
  );

  const NoMonthSelected = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faCalendarAlt} size="3x" />
      <p>Por favor seleccione un mes para ver los datos</p>
    </div>
  );

  const NoDataFound = () => (
    <div className="gcuotas-info-message">
      <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
      <p>No se encontraron datos para los filtros seleccionados</p>
    </div>
  );

  // Render principal
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
          onClose={() => {
            setMostrarModalPagos(false);
            obtenerCuotasYListas();
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={() => setMostrarModalCodigoBarras(false)}
          periodo={getNombreMes(mesSeleccionado)}
          periodoId={mesSeleccionado}
          onPagoRealizado={obtenerCuotasYListas}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodo={mesSeleccionado}
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={obtenerCuotasYListas}
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
                    {meses.map((mes, index) => (
                      <option key={index} value={mes.id}>{mes.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="gcuotas-input-group">
                  <label htmlFor="anio" className="gcuotas-input-label">
                    <FontAwesomeIcon icon={faFilter} /> Año (curso)
                  </label>
                  <select
                    id="anio"
                    value={anioSeleccionado}
                    onChange={onChangeAnio}
                    className="gcuotas-dropdown"
                    disabled={loading}
                  >
                    <option value="">Todos</option>
                    {anios.map((anio, index) => (
                      <option key={index} value={anio.id}>{anio.nombre}</option>
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
                    {categorias.map((categoria, index) => (
                      <option key={index} value={categoria.id}>{categoria.nombre}</option>
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
                    {divisiones.map((division, index) => (
                      <option key={index} value={division.id}>{division.nombre}</option>
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
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  Deudores
                  <span className="gcuotas-tab-badge">{cantidadFiltradaDeudores}</span>
                </button>
                <button
                  className={`gcuotas-tab-button ${estadoPagoSeleccionado === 'pagado' ? "gcuotas-active-tab" : ""}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Pagados
                  <span className="gcuotas-tab-badge">{cantidadFiltradaPagados}</span>
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
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Volver</span>
              </button>
              <button
                className="gcuotas-button gcuotas-button-export"
                onClick={handleExportExcel}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faFileExcel} />
                <span>Excel</span>
              </button>

              <button
                className={`gcuotas-button gcuotas-button-print-all ${loadingPrint ? 'gcuotas-button-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={loadingPrint || !mesSeleccionado || cuotasFiltradas.length === 0 || loading}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>{loadingPrint ? 'Generando...' : 'Imprimir'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`gcuotas-right-section gcuotas-box ${isMobile ? 'gcuotas-has-bottombar' : ''}`}>
        <div className="gcuotas-table-header">
          <h3>
            <FontAwesomeIcon icon={estadoPagoSeleccionado === 'pagado' ? faCheckCircle : faExclamationTriangle} />
            {estadoPagoSeleccionado === 'pagado' ? "Cuotas Pagadas" : "Cuotas Pendientes"}
            {mesSeleccionado && (
              <span className="gcuotas-periodo-seleccionado"> - {getNombreMes(mesSeleccionado)}</span>
            )}
          </h3>
          <div className="gcuotas-input-group gcuotas-search-group">
            <div className="gcuotas-search-integrated">
              <FontAwesomeIcon icon={faSearch} className="gcuotas-search-icon" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={busqueda}
                onChange={onChangeBusqueda} // <-- activa cascada solo al buscar
                disabled={loading || !mesSeleccionado}
              />
            </div>
          </div>
          <div className="gcuotas-summary-info">
            <span className="gcuotas-summary-item">
              <FontAwesomeIcon icon={faUsers} />
              Total: {mesSeleccionado ? cuotasFiltradas.length : 0}
            </span>
          </div>
        </div>

        <div className="gcuotas-table-container">
          {loading ? (
            <LoadingIndicator />
          ) : !mesSeleccionado ? (
            <NoMonthSelected />
          ) : cuotasFiltradas.length === 0 ? (
            <NoDataFound />
          ) : isMobile ? (
            <div className="gcuotas-mobile-list">
              {cuotasFiltradas.map((item, index) => (
                <Row
                  key={`${cascadeRunId}-${index}`} // asegura re-render cuando hay cascada
                  index={index}
                  style={{}}
                  data={cuotasFiltradas}
                />
              ))}
            </div>
          ) : (
            <div className="gcuotas-virtual-tables" style={{ height: "75vh" }}>
              <div className="gcuotas-virtual-header">
                <div
                  className="gcuotas-virtual-cell"
                  onClick={() => toggleOrden('nombre')}
                >
                  Alumno
                  <FontAwesomeIcon
                    icon={faSort}
                    className={`gcuotas-sort-icon ${orden.campo === 'nombre' ? 'gcuotas-sort-active' : ''}`}
                  />
                  {orden.campo === 'nombre' && (orden.ascendente ? ' ↑' : ' ↓')}
                </div>
                <div
                  className="gcuotas-virtual-cell"
                  onClick={() => toggleOrden('dni')}
                >
                  DNI
                  <FontAwesomeIcon
                    icon={faSort}
                    className={`gcuotas-sort-icon ${orden.campo === 'dni' ? 'gcuotas-sort-active' : ''}`}
                  />
                  {orden.campo === 'dni' && (orden.ascendente ? ' ↑' : ' ↓')}
                </div>
                <div
                  className="gcuotas-virtual-cell"
                  onClick={() => toggleOrden('domicilio')}
                >
                  Domicilio
                  <FontAwesomeIcon
                    icon={faSort}
                    className={`gcuotas-sort-icon ${orden.campo === 'domicilio' ? 'gcuotas-sort-active' : ''}`}
                  />
                  {orden.campo === 'domicilio' && (orden.ascendente ? ' ↑' : ' ↓')}
                </div>
                <div className="gcuotas-virtual-cell">Curso</div>
                <div className="gcuotas-virtual-cell">División</div>
                <div className="gcuotas-virtual-cell">Categoría</div>
                <div className="gcuotas-virtual-cell">Acciones</div>
              </div>

              <AutoSizer>
                {({ height, width }) => (
                  <List
                    key={`list-${cascadeRunId}`} // remonta la lista SOLO cuando hay cascada
                    height={height}
                    itemCount={cuotasFiltradas.length}
                    itemSize={60}
                    width={width}
                    itemData={cuotasFiltradas}
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
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Volver</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-excel"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faFileExcel} />
            <span>Excel</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-barcode"
            onClick={() => setMostrarModalCodigoBarras(true)}
            disabled={loading || !mesSeleccionado}
          >
            <FontAwesomeIcon icon={faBarcode} />
            <span>Barras</span>
          </button>

          <button
            className="gcuotas-mbar-btn mbar-imprimir"
            onClick={handleImprimirTodos}
            disabled={loadingPrint || !mesSeleccionado || cuotasFiltradas.length === 0 || loading}
          >
            <FontAwesomeIcon icon={faPrint} />
            <span>Imprimir</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Cuotas;
