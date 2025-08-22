import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign,
  faCalendarAlt,
  faExclamationTriangle,
  faTimes,
  faListAlt,
  faTable,
  faCreditCard,
  faChartPie,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

import ContableChartsModal from "./modalcontable/ContableChartsModal";

export default function DashboardContable() {
  const navigate = useNavigate();

  // ===== Filtros =====
  const [mesSeleccionado, setMesSeleccionado] = useState("");          // ID de mes (1..12) por FECHA de pago
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(""); // ID de categoría

  // ===== Datos base =====
  const [mesesOpts, setMesesOpts] = useState([]);           // [{id, nombre}]
  const [categoriasOpts, setCategoriasOpts] = useState([]); // [{id, nombre}]
  const [datosMeses, setDatosMeses] = useState([]);         // [{id_mes, nombre, pagos:[...]}]
  const [totalAlumnos, setTotalAlumnos] = useState(0);

  // ===== Derivados =====
  const [totalRecaudado, setTotalRecaudado] = useState(0);
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [categoriasUnicas, setCategoriasUnicas] = useState(0);

  // ===== UI =====
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);

  const fetchJSON = async (url) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const ok = (obj) => obj && (obj.success === true || obj.exito === true);
  const arr = (obj) =>
    Array.isArray(obj?.data) ? obj.data :
    (Array.isArray(obj?.datos) ? obj.datos : []);

  // ==== Carga inicial ====
  useEffect(() => {
    (async () => {
      try {
        setError(null);

        const rawContable = await fetchJSON(`${BASE_URL}/api.php?action=contable`);
        const contable = ok(rawContable) ? arr(rawContable) : (Array.isArray(rawContable) ? rawContable : []);
        if (!Array.isArray(contable)) throw new Error("Formato inválido en datos contables.");
        setDatosMeses(contable);

        const totalAlu =
          Number(
            rawContable?.total_alumnos ??
            rawContable?.total_socios ??
            rawContable?.meta?.total_alumnos ??
            0
          ) || 0;
        setTotalAlumnos(totalAlu);

        // Listas (meses + categorías)
        let mesesSrv = [];
        let categoriasSrv = [];

        const cargarListas = async (endpoint) => {
          const rawListas = await fetchJSON(`${BASE_URL}/api.php?action=${endpoint}`);
          if (ok(rawListas) && rawListas.listas) {
            if (Array.isArray(rawListas.listas.meses)) {
              mesesSrv = rawListas.listas.meses
                .map((m) => ({ id: Number(m.id), nombre: String(m.nombre) }))
                .filter((m) => !Number.isNaN(m.id));
            }
            if (Array.isArray(rawListas.listas.categorias)) {
              categoriasSrv = rawListas.listas.categorias
                .map((c) => ({ id: Number(c.id), nombre: String(c.nombre) }))
                .filter((c) => !Number.isNaN(c.id));
            }
          }
        };

        try { await cargarListas("obtener_listas"); }
        catch { await cargarListas("listas"); }

        // Fallbacks si hiciera falta
        if (mesesSrv.length === 0) {
          const uniq = new Map();
          for (const b of contable) {
            const id = Number(b?.id_mes);
            const nombre = String(b?.nombre || "");
            if (!Number.isNaN(id) && nombre) uniq.set(id, { id, nombre });
          }
          mesesSrv = Array.from(uniq.values()).sort((a, b) => a.id - b.id);
        }

        if (categoriasSrv.length === 0) {
          const catSet = new Set();
          for (const b of contable) {
            if (Array.isArray(b?.pagos)) {
              for (const p of b.pagos) {
                const nom = (p?.Nombre_Categoria || "").toString().trim();
                if (nom) catSet.add(nom);
              }
            }
          }
          categoriasSrv = Array.from(catSet)
            .sort((a, b) => a.localeCompare(b, "es"))
            .map((nombre, i) => ({ id: i + 1, nombre }));
        }

        setMesesOpts(mesesSrv);
        setCategoriasOpts(categoriasSrv);
      } catch (err) {
        console.error("Error en carga inicial:", err);
        setError("Error al cargar datos. Verifique la conexión o intente más tarde.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==== Filtrado por mes de COBRO (fecha) y categoría (nombre) ====
  useEffect(() => {
    if (!mesSeleccionado) {
      setTotalRecaudado(0);
      setRegistrosFiltrados([]);
      setCategoriasUnicas(0);
      return;
    }

    try {
      const bloque = datosMeses.find(
        (b) => Number(b?.id_mes) === Number(mesSeleccionado)
      );

      let pagos = Array.isArray(bloque?.pagos) ? [...bloque.pagos] : [];

      const categoriaNombre =
        categoriasOpts.find((c) => String(c.id) === String(categoriaSeleccionada))?.nombre || "";

      if (categoriaSeleccionada) {
        pagos = pagos.filter(
          (p) => String(p?.Nombre_Categoria ?? "") === String(categoriaNombre)
        );
      }

      pagos.sort((a, b) => {
        const nA = `${(a?.Apellido || "").trim()} ${(a?.Nombre || "").trim()}`.trim();
        const nB = `${(b?.Apellido || "").trim()} ${(b?.Nombre || "").trim()}`.trim();
        const byNombre = nA.localeCompare(nB, "es", { sensitivity: "base" });
        if (byNombre !== 0) return byNombre;

        const tA = Date.parse(a?.fechaPago);
        const tB = Date.parse(b?.fechaPago);
        const rA = Number.isNaN(tA) ? Number.MAX_SAFE_INTEGER : tA;
        const rB = Number.isNaN(tB) ? Number.MAX_SAFE_INTEGER : tB;
        return rA - rB;
      });

      const total = pagos.reduce((acc, p) => acc + (parseFloat(p?.Precio) || 0), 0);
      setTotalRecaudado(total);
      setRegistrosFiltrados(pagos);

      const setCat = new Set(pagos.map((p) => String(p?.Nombre_Categoria || "")).filter(Boolean));
      setCategoriasUnicas(setCat.size);
    } catch (err) {
      console.error("Error al procesar los pagos filtrados:", err);
      setError("Error al procesar los pagos filtrados.");
      setTotalRecaudado(0);
      setRegistrosFiltrados([]);
      setCategoriasUnicas(0);
    }
  }, [mesSeleccionado, categoriaSeleccionada, datosMeses, categoriasOpts]);

  // ==== Handlers ====
  const volver = () => navigate(-1);
  const handleMesChange = (e) => setMesSeleccionado(e.target.value);
  const handleCategoriaChange = (e) => setCategoriaSeleccionada(e.target.value);
  const abrirModalGraficos = () => setMostrarModalGraficos(true);
  const cerrarModalGraficos = () => setMostrarModalGraficos(false);

  const calcularTotalRegistros = () => registrosFiltrados.length;

  const etiquetaMes = () => {
    const m = mesesOpts.find((x) => String(x.id) === String(mesSeleccionado));
    return m ? m.nombre : "Selecciona un mes";
  };

  const etiquetaCategoria = () => {
    if (!categoriaSeleccionada) return "";
    const c = categoriasOpts.find((x) => String(x.id) === String(categoriaSeleccionada));
    return c ? c.nombre : "";
  };

  return (
    <div className="dashboard-contable-fullscreen">
      <div className="contable-fullscreen-container">
        {error && (
          <div className="contable-warning">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="contable-close-error">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}

        <div className="contable-header">
          <h1 className="contable-title">
            <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
          </h1>
          <button className="contable-back-button" onClick={volver}>
            ← Volver
          </button>
        </div>

        {/* ==== Tarjetas resumen ==== */}
        <div className="contable-summary-cards">
          <div className="contable-summary-card total-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="contable-card-content">
              <h3>Total recaudado</h3>
              <p>${totalRecaudado.toLocaleString("es-AR")}</p>
              <small className="contable-card-subtext">
                {mesSeleccionado ? etiquetaMes() : "Selecciona un mes"}
                {categoriaSeleccionada ? ` · ${etiquetaCategoria()}` : ""}
              </small>
            </div>
          </div>

          <div className="contable-summary-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div className="contable-card-content">
              <h3>Categorías (únicas)</h3>
              <p>{categoriasUnicas}</p>
              <small className="contable-card-subtext">
                {mesSeleccionado ? etiquetaMes() : "Selecciona un mes"}
              </small>
            </div>
          </div>

          <div className="contable-summary-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faListAlt} />
            </div>
            <div className="contable-card-content">
              <h3>Total registros</h3>
              <p>{calcularTotalRegistros()}</p>
              <small className="contable-card-subtext">
                {mesSeleccionado ? etiquetaMes() : "Selecciona un mes"}
              </small>
            </div>
          </div>
        </div>

        {/* ==== Tabla ==== */}
        <div className="contable-categories-section">
          <div className="contable-section-header">
            <h2>
              <FontAwesomeIcon icon={faTable} /> Resumen de pagos
              <small className="contable-subtitle">
                {mesSeleccionado ? ` · ${etiquetaMes()}` : ""}
              </small>
            </h2>

            <div className="contable-selectors-container">
              {/* MES de COBRO (por fecha) */}
              <div className="contable-month-selector">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <select
                  value={mesSeleccionado}
                  onChange={handleMesChange}
                  className="contable-month-select"
                  title="Filtrar por mes (según fecha del pago)"
                >
                  <option value="">Selecciona un mes</option>
                  {mesesOpts.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* CATEGORÍA */}
              <div className="contable-payment-selector full-row-mobile">
                <FontAwesomeIcon icon={faCreditCard} />
                <select
                  value={categoriaSeleccionada}
                  onChange={handleCategoriaChange}
                  className="contable-payment-select"
                  title="Filtrar por categoría"
                >
                  <option value="">Todas las categorías</option>
                  {categoriasOpts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="contable-charts-button"
                type="button"
                onClick={abrirModalGraficos}
                title="Ver gráficos"
                disabled={!mesSeleccionado}
              >
                <FontAwesomeIcon icon={faChartPie} />
                Ver Gráficos
              </button>
            </div>
          </div>

          <div className="contable-categories-scroll-container">
            <div className="contable-detail-table-container">
              <table className="contable-detail-table">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Monto</th>
                    <th>Categoría</th>
                    <th>Fecha de Pago</th>
                    <th>Mes pagado</th> {/* <- ahora muestra el mes abonado (p.id_mes) */}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length > 0 ? (
                    registrosFiltrados.map((registro, index) => (
                      <tr key={index}>
                        <td data-label="Alumno">
                          {`${registro.Apellido || ""}${registro.Apellido ? ", " : ""}${registro.Nombre || ""}`}
                        </td>
                        <td data-label="Monto">
                          ${(registro.Precio || 0).toLocaleString("es-AR")}
                        </td>
                        <td data-label="Categoría">{registro.Nombre_Categoria || "-"}</td>
                        <td data-label="Fecha de Pago">{registro.fechaPago || "-"}</td>
                        <td data-label="Mes pagado">{registro.Mes_Pagado || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="contable-no-data">
                        {mesSeleccionado
                          ? "No hay registros para ese mes con los filtros actuales"
                          : "Selecciona un mes para ver los pagos"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ==== MODAL GRÁFICOS ==== */}
      <ContableChartsModal
        open={mostrarModalGraficos}
        onClose={cerrarModalGraficos}
        datosMeses={datosMeses}
        datosEmpresas={[]}
        mesSeleccionado={mesSeleccionado}
        totalSocios={totalAlumnos}                 // prop existente en tu modal
        medioSeleccionado={etiquetaCategoria() || "Todas"}
      />
    </div>
  );
}
