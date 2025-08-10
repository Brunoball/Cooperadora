// src/components/Cuotas/Cuotas.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import BASE_URL from '../../config/config';
import {
  FaDollarSign,
  FaPrint,
  FaSpinner,
  FaBarcode,
  FaSearch,
  FaCalendarAlt,
  FaFilter,
  FaUndo,
  FaSort,
  FaUsers,
  FaTimes
} from 'react-icons/fa';
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown
} from 'react-icons/fi';
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

  // 🔎 búsqueda libre
  const [busqueda, setBusqueda] = useState('');

  // 🧭 tabs: deudor/pagado
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');

  // 🧰 filtros (listas de obtener_listas.php)
  const [anioSeleccionado, setAnioSeleccionado] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [divisionSeleccionada, setDivisionSeleccionada] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('');

  // listas para selects
  const [anios, setAnios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [divisiones, setDivisiones] = useState([]);
  const [meses, setMeses] = useState([]);

  // UI
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(true);
  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');

  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [socioParaPagar, setSocioParaPagar] = useState(null);

  const navigate = useNavigate();

  // Helpers para tolerar distintos nombres de campos del backend
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

  // Mapear IDs a nombres para globos
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

      // Si está en “Pagados”, pedimos con ?pagados=1
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
    if (!mesSeleccionado) return []; // hasta que elijan mes

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
    // mes NO se limpia para no vaciar la lista
    setToastTipo('exito');
    setToastMensaje('Filtros limpiados correctamente');
    setToastVisible(true);
  };

  const toggleFiltros = () => setFiltrosExpandidos(!filtrosExpandidos);

  const Row = ({ index, style, data }) => {
    const cuota = data[index];

    const idAnio = getIdAnioFromCuota(cuota);
    const idDiv  = getIdDivisionFromCuota(cuota);
    const idCat  = getIdCategoriaFromCuota(cuota);

    const nombreAnio = getNombreAnio(idAnio);
    const nombreDiv  = getNombreDivision(idDiv);
    const nombreCat  = getNombreCategoria(idCat);

    return (
      <div
        style={style}
        className={`cuo_tabla-fila cuo_grid-container ${index % 2 === 0 ? 'cuo_fila-par' : 'cuo_fila-impar'}`}
      >
        {/* Alumno */}
        <div className="cuo_col-nombre">
          <div className="cuo_nombre-socio">{getNombreCuota(cuota)}</div>
        </div>

        {/* DNI */}
        <div className="cuo_col-dni">
          {getDocumentoCuota(cuota) || '—'}
        </div>

        {/* Domicilio */}
        <div className="cuo_col-domicilio">
          {getDomicilioCuota(cuota) || '—'}
        </div>

        {/* Curso (Año) */}
        <div className="cuo_col-curso">
          <span className="cuo_badge cuo_badge-info">
            {nombreAnio || '—'}
          </span>
        </div>

        {/* División */}
        <div className="cuo_col-division">
          <span className="cuo_badge cuo_badge-primary">
            {nombreDiv || '—'}
          </span>
        </div>

        {/* Categoría */}
        <div className="cuo_col-categoria">
          <span className="cuo_badge cuo_badge-success">
            {nombreCat || '—'}
          </span>
        </div>

        {/* Acciones */}
        <div className="cuo_col-acciones">
          <div className="cuo_acciones-cell">
            {estadoPagoSeleccionado === 'deudor' ? (
              <button
                className="cuo_boton-accion cuo_boton-accion-success"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalPagos(true);
                }}
                title="Registrar pago"
              >
                <FaDollarSign />
              </button>
            ) : (
              <button
                className="cuo_boton-accion cuo_boton-accion-danger"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalEliminarPago(true);
                }}
                title="Eliminar pago"
              >
                <FaTimes />
              </button>
            )}
            <button
              className="cuo_boton-accion cuo_boton-accion-primary"
              onClick={() => {
                const ventanaImpresion = window.open('', '_blank');
                if (ventanaImpresion) {
                  imprimirRecibos([cuota], mesSeleccionado, ventanaImpresion);
                } else {
                  alert('Por favor deshabilita el bloqueador de ventanas emergentes para imprimir');
                }
              }}
              title="Imprimir recibo"
            >
              <FaPrint />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getNombreMes = (id) => {
    const m = meses.find(p => String(p.id) === String(id));
    return m ? m.nombre : id;
  };

  return (
    <div className="cuo_app-container">
      <div className={`cuo_filtros-panel ${!filtrosExpandidos ? 'cuo_filtros-colapsado' : ''}`}>
        <div className="cuo_filtros-header">
          <h3 className="cuo_filtros-titulo">
            <FaFilter className="cuo_filtro-icono" />
            Filtros Avanzados
          </h3>
          <div className="cuo_filtros-controles">
            <button
              className="cuo_boton cuo_boton-icono cuo_boton-toggle-horizontal"
              onClick={toggleFiltros}
              title={filtrosExpandidos ? 'Ocultar filtros' : 'Mostrar filtros'}
            >
              {filtrosExpandidos ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
          </div>
        </div>

        {filtrosExpandidos && (
          <>
            {/* MES (obligatorio para listar) */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaCalendarAlt className="cuo_filtro-icono" />
                Mes
              </label>
              <select
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Seleccionar mes</option>
                {meses.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {/* AÑO / CURSO */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Año (curso)
              </label>
              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todos</option>
                {anios.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>

            {/* CATEGORÍA */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Categoría
              </label>
              <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* DIVISIÓN */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                División
              </label>
              <select
                value={divisionSeleccionada}
                onChange={(e) => setDivisionSeleccionada(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todas</option>
                {divisiones.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>

            {/* TABS de ESTADO DE PAGO */}
            <div className="cuo_tabs-container">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Estado de Pago
              </label>
              <div className="cuo_tabs-estado-pago">
                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'deudor' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('deudor')}
                  disabled={loading}
                >
                  Deudores <span style={{ display: 'inline-block', textAlign: 'right' }}>({cantidadFiltradaDeudores})</span>
                </button>
                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'pagado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                >
                  Pagados <span style={{ display: 'inline-block', textAlign: 'right' }}>({cantidadFiltradaPagados})</span>
                </button>
              </div>
            </div>

            {/* BÚSQUEDA + ACCIONES DE FILTRO */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaSearch className="cuo_filtro-icono" />
                Buscar
              </label>
              <input
                type="text"
                placeholder="Nombre, documento o dirección..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="cuo_buscador-input"
                disabled={loading}
              />
            </div>

            <div className="cuo_filtro-acciones" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="cuo_boton cuo_boton-light cuo_boton-limpiar"
                onClick={limpiarFiltros}
                disabled={loading}
              >
                Limpiar Filtros
              </button>
              <button
                className="cuo_boton cuo_boton-secondary"
                onClick={() => navigate('/panel')}
                disabled={loading}
              >
                <FaUndo style={{ marginRight: '5px' }} /> Volver
              </button>
            </div>
          </>
        )}
      </div>

      {!filtrosExpandidos && (
        <button
          className="cuo_boton-flotante-abrir cuo_flotante-fuera"
          onClick={toggleFiltros}
          title="Mostrar filtros"
        >
          <FiChevronRight size={20} />
        </button>
      )}

      <div className="cuo_main-content">
        <div className="cuo_content-header">
          <div className="cuo_header-top">
            <h2 className="cuo_content-title">
              Gestión de Cuotas
              {mesSeleccionado && (
                <span className="cuo_periodo-seleccionado"> - {getNombreMes(mesSeleccionado)}</span>
              )}
            </h2>

            <div className="cuo_contador-socios">
              <div className="cuo_contador-icono">
                <FaUsers />
              </div>
              <div className="cuo_contador-texto">
                {cuotasFiltradas.length} {cuotasFiltradas.length === 1 ? 'alumno' : 'alumnos'}
              </div>
            </div>
          </div>

          <div className="cuo_header-bottom">
            <div className="cuo_content-actions">
              <button
                className="cuo_boton cuo_boton-success"
                onClick={() => setMostrarModalCodigoBarras(true)}
                disabled={loading || !mesSeleccionado}
              >
                <FaBarcode /> Código de Barras
              </button>

              <button
                className={`cuo_boton cuo_boton-primary ${loadingPrint ? 'cuo_boton-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={loadingPrint || !mesSeleccionado || cuotasFiltradas.length === 0 || loading}
              >
                {loadingPrint ? (
                  <>
                    <FaSpinner className="cuo_boton-spinner" /> Generando cupones...
                  </>
                ) : (
                  <>
                    <FaPrint /> Imprimir todos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="cuo_tabla-container">
          <div className="cuo_tabla-wrapper">
            {/* Encabezado de la nueva tabla */}
            <div className="cuo_tabla-header cuo_grid-container">
              <div
                className="cuo_col-nombre"
                onClick={() => toggleOrden('nombre')}
              >
                Alumno
                <FaSort className={`cuo_icono-orden ${orden.campo === 'nombre' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'nombre' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div
                className="cuo_col-dni"
                onClick={() => toggleOrden('dni')}
              >
                DNI
                <FaSort className={`cuo_icono-orden ${orden.campo === 'dni' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'dni' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div
                className="cuo_col-domicilio"
                onClick={() => toggleOrden('domicilio')}
              >
                Domicilio
                <FaSort className={`cuo_icono-orden ${orden.campo === 'domicilio' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'domicilio' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div className="cuo_col-curso">Curso</div>
              <div className="cuo_col-division">División</div>
              <div className="cuo_col-categoria">Categoría</div>
              <div className="cuo_col-acciones">Acciones</div>
            </div>

            <div className="cuo_list-container">
              {loading && mesSeleccionado ? (
                <div className="cuo_estado-container">
                  <FaSpinner className="cuo_spinner" size={24} />
                  <p className="cuo_estado-mensaje">Cargando cuotas...</p>
                </div>
              ) : !loading && cuotasFiltradas.length === 0 ? (
                <div className="cuo_estado-container">
                  <p className="cuo_estado-mensaje">
                    {mesSeleccionado
                      ? 'No se encontraron resultados con los filtros actuales'
                      : 'Seleccioná un mes para mostrar las cuotas'}
                  </p>
                </div>
              ) : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
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
              )}
            </div>
          </div>
        </div>
      </div>

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

      {toastVisible && (
        <Toast
          tipo={toastTipo}
          mensaje={toastMensaje}
          duracion={3000}
          onClose={() => setToastVisible(false)}
        />
      )}
    </div>
  );
};

export default Cuotas;
