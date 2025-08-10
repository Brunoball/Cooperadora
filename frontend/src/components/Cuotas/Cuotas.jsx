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

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');
  const [estadoSocioSeleccionado, setEstadoSocioSeleccionado] = useState('');
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [mediosPago, setMediosPago] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [estados, setEstados] = useState([]);
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [socioParaPagar, setSocioParaPagar] = useState(null);
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(true);
  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');
  const navigate = useNavigate();

  const obtenerCuotasYListas = async () => {
    try {
      setLoading(true);
      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?action=cuotas${estadoPagoSeleccionado === 'pagado' ? '&pagados=1' : ''}`),
        fetch(`${BASE_URL}/api.php?action=listas`),
      ]);

      const dataCuotas = await resCuotas.json();
      const dataListas = await resListas.json();

      if (dataCuotas.exito) {
        setCuotas(dataCuotas.cuotas);
      }
      if (dataListas.exito) {
        setMediosPago(dataListas.listas.cobradores.map(c => c.nombre));
        setPeriodos(dataListas.listas.periodos.map(p => ({
          id: p.id,
          nombre: p.nombre
        })));
        setEstados(dataListas.listas.estados.map(e => e.descripcion));
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerCuotasYListas();
  }, [estadoPagoSeleccionado]);

  const cuotasFiltradas = useMemo(() => {
    if (!periodoSeleccionado) return [];

    const cuotasFiltradas = cuotas
      .filter((c) => String(c.id_periodo) === String(periodoSeleccionado))
      .filter((c) => {
        const coincideBusqueda = busqueda === '' || 
          c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.domicilio?.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.documento?.toLowerCase().includes(busqueda.toLowerCase());
        const coincideEstadoSocio = estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado;
        const coincideMedio = medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado;
        const coincideEstadoPago = estadoPagoSeleccionado === '' || c.estado_pago === estadoPagoSeleccionado;

        return coincideBusqueda && coincideEstadoSocio && coincideMedio && coincideEstadoPago;
      });

    return cuotasFiltradas.sort((a, b) => {
      const campoA = orden.campo === 'nombre' ? a.nombre : a.domicilio || '';
      const campoB = orden.campo === 'nombre' ? b.nombre : b.domicilio || '';
      
      if (orden.ascendente) {
        return campoA.localeCompare(campoB);
      } else {
        return campoB.localeCompare(campoA);
      }
    });
  }, [cuotas, busqueda, estadoSocioSeleccionado, medioPagoSeleccionado, periodoSeleccionado, estadoPagoSeleccionado, orden]);

  const cantidadFiltradaDeudores = useMemo(() => {
    return cuotas.filter(c => 
      String(c.id_periodo) === String(periodoSeleccionado) &&
      (busqueda === '' || 
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.domicilio?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.documento?.toLowerCase().includes(busqueda.toLowerCase())) &&
      (estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado) &&
      (medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado) &&
      c.estado_pago === 'deudor'
    ).length;
  }, [cuotas, busqueda, estadoSocioSeleccionado, medioPagoSeleccionado, periodoSeleccionado]);

  const cantidadFiltradaPagados = useMemo(() => {
    return cuotas.filter(c => 
      String(c.id_periodo) === String(periodoSeleccionado) &&
      (busqueda === '' || 
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.domicilio?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.documento?.toLowerCase().includes(busqueda.toLowerCase())) &&
      (estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado) &&
      (medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado) &&
      c.estado_pago === 'pagado'
    ).length;
  }, [cuotas, busqueda, estadoSocioSeleccionado, medioPagoSeleccionado, periodoSeleccionado]);

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
      await imprimirRecibos(cuotasFiltradas, periodoSeleccionado, ventanaImpresion);
    } catch (error) {
      console.error('Error al imprimir:', error);
      ventanaImpresion.close();
    } finally {
      setLoadingPrint(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setEstadoSocioSeleccionado('');
    setMedioPagoSeleccionado('');

    setToastTipo('exito');
    setToastMensaje('Filtros limpiados correctamente');
    setToastVisible(true);
  };

  const toggleFiltros = () => {
    setFiltrosExpandidos(!filtrosExpandidos);
  };

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    
    const claseEstado = {
      activo: 'cuo_estado-activo',
      pasivo: 'cuo_estado-pasivo'
    }[cuota.estado?.toLowerCase()] || 'cuo_badge-warning';

    const claseMedioPago = {
      cobrador: 'cuo_pago-cobrador',
      oficina: 'cuo_pago-oficina',
      transferencia: 'cuo_pago-transferencia'
    }[cuota.medio_pago?.toLowerCase()] || 'cuo_badge-warning';

    return (
      <div 
        style={style} 
        className={`cuo_tabla-fila cuo_grid-container ${index % 2 === 0 ? 'cuo_fila-par' : 'cuo_fila-impar'}`}
      >
        <div className="cuo_col-nombre">
          <div className="cuo_nombre-socio">{cuota.nombre}</div>
          {cuota.documento && <div className="cuo_documento">Doc: {cuota.documento}</div>}
        </div>
        <div className="cuo_col-domicilio">{cuota.domicilio || '-'}</div>
        <div className="cuo_col-estado">
          <span className={`cuo_badge ${claseEstado}`}>
            {cuota.estado}
          </span>
        </div>
        <div className="cuo_col-medio-pago">
          <span className={`cuo_badge ${claseMedioPago}`}>
            {cuota.medio_pago || 'Sin especificar'}
          </span>
        </div>
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
                  imprimirRecibos([cuota], periodoSeleccionado, ventanaImpresion);
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

  const getNombrePeriodo = (id) => {
    const periodo = periodos.find(p => String(p.id) === String(id));
    return periodo ? periodo.nombre : id;
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
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaCalendarAlt className="cuo_filtro-icono" />
                Período
              </label>
              <select 
                value={periodoSeleccionado} 
                onChange={(e) => setPeriodoSeleccionado(e.target.value)} 
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Seleccionar período</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

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
                  Deudores <span style={{ display: 'inline-block',  textAlign: 'right' }}>({cantidadFiltradaDeudores})</span>
                </button>
                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'pagado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                >
                  Pagados <span style={{ display: 'inline-block',  textAlign: 'right' }}>({cantidadFiltradaPagados})</span>
                </button>
              </div>
            </div>

            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Estado del Socio
              </label>
              <select 
                value={estadoSocioSeleccionado} 
                onChange={(e) => setEstadoSocioSeleccionado(e.target.value)} 
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todos los estados</option>
                {estados.map((estado, i) => (
                  <option key={i} value={estado}>{estado}</option>
                ))}
              </select>
            </div>

            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Medio de Pago
              </label>
              <select 
                value={medioPagoSeleccionado} 
                onChange={(e) => setMedioPagoSeleccionado(e.target.value)} 
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todos los medios</option>
                {mediosPago.map((m, i) => (
                  <option key={i} value={m}>{m}</option>
                ))}
              </select>
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
              {periodoSeleccionado && (
                <span className="cuo_periodo-seleccionado"> - {getNombrePeriodo(periodoSeleccionado)}</span>
              )}
            </h2>
            
            <div className="cuo_contador-socios">
              <div className="cuo_contador-icono">
                <FaUsers />
              </div>
              <div className="cuo_contador-texto">
                {cuotasFiltradas.length} {cuotasFiltradas.length === 1 ? 'socio' : 'socios'}
              </div>
            </div>
          </div>

          <div className="cuo_header-bottom">
            <div className="cuo_buscador-container">
              <FaSearch className="cuo_buscador-icono" />
              <input
                type="text"
                placeholder="Buscar socio por nombre, documento o dirección..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="cuo_buscador-input"
                disabled={loading}
              />
            </div>

            <div className="cuo_content-actions">
              <button
                className="cuo_boton cuo_boton-success"
                onClick={() => setMostrarModalCodigoBarras(true)}
                disabled={loading}
              >
                <FaBarcode /> Código de Barras
              </button>

              <button
                className={`cuo_boton cuo_boton-primary ${loadingPrint ? 'cuo_boton-loading' : ''}`}
                onClick={handleImprimirTodos}
                disabled={loadingPrint || !periodoSeleccionado || cuotasFiltradas.length === 0 || loading}
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
            <div className="cuo_tabla-header cuo_grid-container">
              <div 
                className="cuo_col-nombre" 
                onClick={() => toggleOrden('nombre')}
              >
                Socio 
                <FaSort className={`cuo_icono-orden ${orden.campo === 'nombre' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'nombre' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>
              <div 
                className="cuo_col-domicilio"
                onClick={() => toggleOrden('domicilio')}
              >
                Dirección
                <FaSort className={`cuo_icono-orden ${orden.campo === 'domicilio' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'domicilio' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>
              <div className="cuo_col-estado">Estado</div>
              <div className="cuo_col-medio-pago">Medio de Pago</div>
              <div className="cuo_col-acciones">Acciones</div>
            </div>

            <div className="cuo_list-container">
              {loading && periodoSeleccionado ? (
                <div className="cuo_estado-container">
                  <FaSpinner className="cuo_spinner" size={24} />
                  <p className="cuo_estado-mensaje">Cargando cuotas...</p>
                </div>
              ) : !loading && cuotasFiltradas.length === 0 ? (
                <div className="cuo_estado-container">
                  <p className="cuo_estado-mensaje">
                    {periodoSeleccionado 
                      ? 'No se encontraron resultados con los filtros actuales' 
                      : 'Seleccione un período para mostrar las cuotas'}
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
          periodo={getNombrePeriodo(periodoSeleccionado)}
          periodoId={periodoSeleccionado}
          onPagoRealizado={obtenerCuotasYListas}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
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