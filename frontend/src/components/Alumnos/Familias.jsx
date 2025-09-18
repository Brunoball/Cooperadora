// src/components/Alumnos/Familias.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BASE_URL from "../../config/config";
import {
  FaArrowLeft,
  FaPlus,
  FaTrash,
  FaEdit,
  FaUsers,
  FaLink,
  FaSearch,
  FaFileExcel,
} from "react-icons/fa";
import Toast from "../Global/Toast";
import "./Familias.css";
import ModalFamilia from "./modales/ModalFamilia";
import ModalMiembros from "./modales/ModalMiembros";

/** Util: mayúsculas seguras */
const toUpperSafe = (x) => (x ?? "").toString().toUpperCase();

/** Util: solo fecha dd/mm/yyyy a partir de yyyy-mm-dd hh:mm:ss o Date */
const fmtFechaSolo = (val) => {
  if (!val) return "—";
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  try {
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch {
    return s;
  }
};

/** Avatar por inicial (decorativo) */
function Avatar({ name }) {
  const i = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return <div className="fam-avatar" aria-hidden>{i}</div>;
}

export default function Familias() {
  const navigate = useNavigate();

  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState({ mostrar: false, tipo: "", mensaje: "" });

  const [modalFamiliaOpen, setModalFamiliaOpen] = useState(false);
  const [editFamilia, setEditFamilia] = useState(null);

  const [modalMiembrosOpen, setModalMiembrosOpen] = useState(false);
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);

  const showToast = useCallback((mensaje, tipo = "exito") => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const cargarFamilias = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=familias_listar&ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        setFamilias(j.familias || []);
      } else {
        showToast(j?.mensaje || "No se pudieron obtener familias", "error");
        setFamilias([]);
      }
    } catch {
      showToast("Error de red al obtener familias", "error");
      setFamilias([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    cargarFamilias();
  }, [cargarFamilias]);

  const filtradas = useMemo(() => {
    if (!q.trim()) return familias;
    const t = q.trim().toLowerCase();
    return familias.filter(
      (f) =>
        (f.nombre_familia || "").toLowerCase().includes(t) ||
        (f.observaciones || "").toLowerCase().includes(t)
    );
  }, [familias, q]);

  const onGuardarFamilia = async (payload) => {
    try {
      const payloadUC = {
        ...payload,
        nombre_familia: toUpperSafe(payload?.nombre_familia),
        observaciones: toUpperSafe(payload?.observaciones),
      };

      const r = await fetch(`${BASE_URL}/api.php?action=familia_guardar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadUC),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || "Guardado", "exito");
        setModalFamiliaOpen(false);
        setEditFamilia(null);
        cargarFamilias();
      } else {
        showToast(j?.mensaje || "No se pudo guardar", "error");
      }
    } catch {
      showToast("Error al guardar familia", "error");
    }
  };

  const onEliminarFamilia = async (f) => {
    const confirmar = window.confirm(
      `¿Eliminar la familia "${f.nombre_familia}"?\nSi tiene alumnos vinculados, se bloqueará a menos que fuerces.`
    );
    if (!confirmar) return;

    const forzar = window.confirm(
      "¿Forzar borrado? (Desvincula alumnos y elimina la familia)"
    );
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_eliminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_familia: f.id_familia,
          forzar: forzar ? 1 : 0,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || "Eliminada", "exito");
        setFamilias((prev) =>
          prev.filter((x) => String(x.id_familia) !== String(f.id_familia))
        );
        if (familiaSeleccionada?.id_familia === f.id_familia) {
          setModalMiembrosOpen(false);
          setFamiliaSeleccionada(null);
        }
      } else {
        showToast(j?.mensaje || "No se pudo eliminar", "error");
      }
    } catch {
      showToast("Error al eliminar familia", "error");
    }
  };

  const abrirMiembros = (f) => {
    setFamiliaSeleccionada(f);
    setModalMiembrosOpen(true);
  };

  const onDeltaCounts = useCallback(
    ({ id_familia, deltaActivos = 0, deltaTotales = 0 }) => {
      setFamilias((prev) =>
        prev.map((f) => {
          if (String(f.id_familia) !== String(id_familia)) return f;
          return {
            ...f,
            miembros_activos: (Number(f.miembros_activos) || 0) + deltaActivos,
            miembros_totales: (Number(f.miembros_totales) || 0) + deltaTotales,
          };
        })
      );
      setFamiliaSeleccionada((prev) => {
        if (!prev || String(prev.id_familia) !== String(id_familia)) return prev;
        return {
          ...prev,
          miembros_activos:
            (Number(prev.miembros_activos) || 0) + deltaActivos,
          miembros_totales:
            (Number(prev.miembros_totales) || 0) + deltaTotales,
        };
      });
    },
    []
  );

  /** Exportar Excel (si tu backend lo soporta) */
  const exportarExcel = async () => {
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=familias_exportar_excel&ts=${Date.now()}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "familias.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("No se pudo exportar el Excel", "error");
    }
  };

  return (
    <div className="fam-page">
      {toast.mostrar && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          onClose={() => setToast({ mostrar: false, tipo: "", mensaje: "" })}
          duracion={2400}
        />
      )}

      {/* Topbar azul */}
      <header className="fam-topbar">
        <div className="fam-topbar-title">Gestión de familia</div>
        <div className="fam-topbar-search">
          <FaSearch />
          <input
            placeholder="Buscar familia..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="fam-topbar-back" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Volver
        </button>
      </header>

      {/* Tarjeta principal */}
      <section className="fam-card">
        {/* Subheader con pestaña activa y acciones */}
        <div className="fam-subheader">
          <div className="fam-tabs">
            <button className="fam-tab active">
              <FaUsers />
              <span>Familias</span>
            </button>
          </div>

          <div className="fam-actions-right">
            <button
              className="btn primary"
              onClick={() => {
                setEditFamilia(null);
                setModalFamiliaOpen(true);
              }}
            >
              <FaPlus />
              <span>Añadir Familia</span>
            </button>
            <button className="btn success outline" onClick={exportarExcel}>
              <FaFileExcel />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Título de sección */}
        <h2 className="fam-section-title">Grupos Familiares</h2>

        {/* Tabla */}
        <div className="fam-table">
          <div className="fam-thead">
            <div>Familia</div>
            <div>Observaciones</div>
            <div>Fecha alta</div>
            <div>Estado</div>
            <div>Operación</div>
          </div>

          <div className="fam-tbody">
            {loading ? (
              <div className="fam-empty">Cargando...</div>
            ) : filtradas.length === 0 ? (
              <div className="fam-empty">Sin resultados</div>
            ) : (
              filtradas.map((f) => {
                const apellido = toUpperSafe(f.nombre_familia);
                const obs = toUpperSafe(f.observaciones);
                const fecha = f.fecha_alta
                  ? f.fecha_alta
                  : fmtFechaSolo(f.creado_en);

                // Estado: usa f.estado ("Activo"/"Inactivo"), o f.activo 1/0, o por defecto Inactivo
                const estado =
                  f.estado ??
                  ((String(f.activo) === "1" || f.activo === 1) ? "Activo" : "Inactivo");
                const isActivo = String(estado).toLowerCase() === "activo";

                return (
                  <div key={f.id_familia} className="fam-row">
                    <div className="fam-col fam-col-name" title={apellido}>
                      <Avatar name={apellido} />
                      <span>{apellido}</span>
                    </div>

                    <div className="fam-col fam-obs" title={obs}>
                      {obs ? (obs.length > 64 ? `${obs.slice(0, 64)}…` : obs) : "—"}
                    </div>

                    <div className="fam-col">{fecha || "—"}</div>

                    <div className="fam-col">
                      <span
                        className={`pill ${isActivo ? "ok" : "off"}`}
                        title={estado}
                      >
                        {isActivo ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="fam-col fam-actions">
                      <button
                        className="icon outline"
                        title="Gestionar miembros"
                        onClick={() => abrirMiembros(f)}
                      >
                        <FaLink />
                      </button>
                      <button
                        className="icon outline"
                        title="Editar"
                        onClick={() => {
                          setEditFamilia(f);
                          setModalFamiliaOpen(true);
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="icon danger"
                        title="Eliminar"
                        onClick={() => onEliminarFamilia(f)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Modales */}
      <ModalFamilia
        open={modalFamiliaOpen}
        familia={editFamilia}
        onClose={() => {
          setModalFamiliaOpen(false);
          setEditFamilia(null);
        }}
        onSave={onGuardarFamilia}
      />

      <ModalMiembros
        open={modalMiembrosOpen}
        familia={familiaSeleccionada}
        onClose={() => {
          setModalMiembrosOpen(false);
          setFamiliaSeleccionada(null);
        }}
        notify={showToast}
        onDeltaCounts={onDeltaCounts}
      />
    </div>
  );
}
