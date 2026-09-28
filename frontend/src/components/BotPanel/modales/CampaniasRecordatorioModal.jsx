import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullhorn,
  faCalendarDays,
  faClock,
  faFloppyDisk,
  faPen,
  faPlus,
  faSpinner,
  faTrash,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useModalEscapeStack } from "./useModalEscapeStack";
import "./CampaniasRecordatorioModal.css";

const PANEL_API =
  process.env.REACT_APP_BOT_PANEL_URL ||
  "https://cooperadora.ipet50.edu.ar/api/bot_wp/funciones/Panel/endpoints";

const ENDPOINT = `${PANEL_API}/panel_campanias_recordatorio.php`;
const MAX_MESSAGE = 900;

const emptyForm = () => ({
  id_campania: null,
  id_anio: "",
  id_division: "",
  id_categoria: "",
  mensaje: "",
  programada_para: "",
});

const toLocalInput = (value) => {
  if (!value) return "";
  const raw = String(value).replace(" ", "T");
  return raw.slice(0, 16);
};

const defaultDateTime = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const serverDate = (localValue) => String(localValue || "").replace("T", " ") + ":00";

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const filterLabel = (c) => {
  const parts = [];
  parts.push(c?.anio_nombre ? `${c.anio_nombre} año` : "Todos los cursos");
  parts.push(c?.division_nombre ? `Div. ${c.division_nombre}` : "Todas las divisiones");
  parts.push(c?.categoria_nombre || "Todas las categorías");
  return parts.join(" · ");
};

const CampaniasRecordatorioModal = ({ open, onClose }) => {
  const [view, setView] = useState("list");
  const [campanias, setCampanias] = useState([]);
  const [opciones, setOpciones] = useState({ anios: [], divisiones: [], categorias: [] });
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [destinatarios, setDestinatarios] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useModalEscapeStack(open, () => {
    if (view === "form" && !saving) {
      setView("list");
      setFormError("");
    } else if (!saving && !deletingId) onClose?.();
  });

  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { cache: "no-store", ...options });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }
    return data;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, opts] = await Promise.all([
        fetchJson(`${ENDPOINT}?accion=listar&_=${Date.now()}`),
        fetchJson(`${ENDPOINT}?accion=opciones&_=${Date.now()}`),
      ]);
      setCampanias(Array.isArray(list.campanias) ? list.campanias : []);
      setTemplate(list.template || null);
      setOpciones(opts.opciones || { anios: [], divisiones: [], categorias: [] });
    } catch (e) {
      setError(e?.message || "No se pudieron cargar las campañas.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setConfirmDelete(null);
    loadAll();
  }, [open, loadAll]);

  const loadRecipients = useCallback(async (targetForm) => {
    setLoadingRecipients(true);
    try {
      const qs = new URLSearchParams({ accion: "destinatarios", _: String(Date.now()) });
      if (targetForm.id_anio) qs.set("id_anio", targetForm.id_anio);
      if (targetForm.id_division) qs.set("id_division", targetForm.id_division);
      if (targetForm.id_categoria) qs.set("id_categoria", targetForm.id_categoria);
      const data = await fetchJson(`${ENDPOINT}?${qs.toString()}`);
      setDestinatarios(data.destinatarios || null);
    } catch {
      setDestinatarios(null);
    } finally {
      setLoadingRecipients(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    if (!open || view !== "form") return undefined;
    const timer = window.setTimeout(() => loadRecipients(form), 250);
    return () => window.clearTimeout(timer);
  }, [open, view, form.id_anio, form.id_division, form.id_categoria, loadRecipients]);

  const openCreate = () => {
    setForm({ ...emptyForm(), programada_para: defaultDateTime() });
    setDestinatarios(null);
    setFormError("");
    setView("form");
  };

  const openEdit = (campania) => {
    setForm({
      id_campania: Number(campania.id_campania),
      id_anio: campania.id_anio || "",
      id_division: campania.id_division || "",
      id_categoria: campania.id_categoria || "",
      mensaje: campania.mensaje || "",
      programada_para: toLocalInput(campania.programada_para),
    });
    setDestinatarios(null);
    setFormError("");
    setView("form");
  };

  const save = async () => {
    setFormError("");
    if (!form.mensaje.trim()) {
      setFormError("Escribí el texto que querés insertar en la plantilla.");
      return;
    }
    if (form.mensaje.trim().length > MAX_MESSAGE) {
      setFormError(`El texto no puede superar ${MAX_MESSAGE} caracteres.`);
      return;
    }
    if (!form.programada_para) {
      setFormError("Seleccioná la fecha y hora de envío.");
      return;
    }
    if (!destinatarios || Number(destinatarios.telefonos_unicos || 0) < 1) {
      setFormError("Los filtros seleccionados no tienen destinatarios con teléfono.");
      return;
    }

    setSaving(true);
    try {
      await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: form.id_campania ? "editar" : "crear",
          id_campania: form.id_campania,
          id_anio: form.id_anio || null,
          id_division: form.id_division || null,
          id_categoria: form.id_categoria || null,
          mensaje: form.mensaje.trim(),
          programada_para: serverDate(form.programada_para),
        }),
      });
      await loadAll();
      setView("list");
    } catch (e) {
      setFormError(e?.message || "No se pudo guardar la campaña.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setDeletingId(id);
    setError("");
    try {
      await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar", id_campania: id }),
      });
      setConfirmDelete(null);
      await loadAll();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la campaña.");
    } finally {
      setDeletingId(null);
    }
  };

  const previewText = useMemo(() => {
    const middle = form.mensaje.trim() || "Acá va el texto libre que escribas para esta campaña.";
    return `Hola 👋\n\nTe enviamos un aviso informativo de la Cooperadora del IPET 50.\n\n${middle}\n\nSi necesitás más información, podés responder este mensaje.`;
  }, [form.mensaje]);

  if (!open) return null;

  return (
    <div className="wp-campaign-backdrop" role="dialog" aria-modal="true" aria-label="Campañas de recordatorio">
      <div className="wp-campaign-modal">
        <header className="wp-campaign-head">
          <div className="wp-campaign-title">
            <span className="wp-campaign-head-icon"><FontAwesomeIcon icon={faBullhorn} /></span>
            <div>
              <span>WhatsApp · Cooperadora</span>
              <h2>Campañas programadas</h2>
              <p>Programá avisos por curso, división y categoría.</p>
            </div>
          </div>
          <button type="button" className="wp-campaign-close" onClick={onClose} disabled={saving || Boolean(deletingId)} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        {view === "list" ? (
          <>
            <div className="wp-campaign-toolbar">
              <div>
                <strong>Mensajes programados</strong>
                <small>El cron de envío se conecta después; acá queda lista la programación.</small>
              </div>
              <button type="button" className="wp-campaign-primary" onClick={openCreate}>
                <FontAwesomeIcon icon={faPlus} /> Agregar campaña
              </button>
            </div>

            <div className="wp-campaign-content">
              {error ? <div className="wp-campaign-error">{error}</div> : null}
              {loading ? (
                <div className="wp-campaign-empty"><FontAwesomeIcon icon={faSpinner} spin /> Cargando campañas…</div>
              ) : campanias.length === 0 ? (
                <div className="wp-campaign-empty">
                  <FontAwesomeIcon icon={faCalendarDays} />
                  <strong>No hay campañas programadas</strong>
                  <span>Creá la primera campaña desde “Agregar campaña”.</span>
                </div>
              ) : (
                <div className="wp-campaign-list">
                  {campanias.map((c) => {
                    const editable = ["programada", "error", "cancelada"].includes(c.estado);
                    return (
                      <article className="wp-campaign-card" key={c.id_campania}>
                        <div className="wp-campaign-card-main">
                          <div className="wp-campaign-card-topline">
                            <span className={`wp-campaign-status is-${c.estado}`}>{c.estado}</span>
                            <span className="wp-campaign-date"><FontAwesomeIcon icon={faClock} /> {formatDateTime(c.programada_para)}</span>
                          </div>
                          <strong>{filterLabel(c)}</strong>
                          <p>{c.mensaje}</p>
                          <div className="wp-campaign-card-meta">
                            <span><FontAwesomeIcon icon={faUsers} /> {Number(c.destinatarios_estimados || 0)} teléfonos estimados</span>
                          </div>
                        </div>
                        {editable ? (
                          <div className="wp-campaign-actions">
                            <button type="button" onClick={() => openEdit(c)} title="Editar campaña"><FontAwesomeIcon icon={faPen} /></button>
                            <button type="button" className="is-danger" onClick={() => setConfirmDelete(Number(c.id_campania))} title="Eliminar campaña"><FontAwesomeIcon icon={faTrash} /></button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="wp-campaign-form-wrap">
            <div className="wp-campaign-form-title">
              <div>
                <strong>{form.id_campania ? "Editar campaña" : "Nueva campaña"}</strong>
                <small>Los campos en “Todos” no limitan ese criterio.</small>
              </div>
              <button type="button" className="wp-campaign-secondary" onClick={() => setView("list")} disabled={saving}>Volver</button>
            </div>

            {formError ? <div className="wp-campaign-error">{formError}</div> : null}

            <div className="wp-campaign-grid">
              <section className="wp-campaign-section">
                <h3>Destinatarios</h3>
                <div className="wp-campaign-filters">
                  <label>
                    <span>Curso / Año</span>
                    <select value={form.id_anio} onChange={(e) => setForm((f) => ({ ...f, id_anio: e.target.value }))}>
                      <option value="">Todos</option>
                      {(opciones.anios || []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>División</span>
                    <select value={form.id_division} onChange={(e) => setForm((f) => ({ ...f, id_division: e.target.value }))}>
                      <option value="">Todas</option>
                      {(opciones.divisiones || []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Categoría</span>
                    <select value={form.id_categoria} onChange={(e) => setForm((f) => ({ ...f, id_categoria: e.target.value }))}>
                      <option value="">Todas</option>
                      {(opciones.categorias || []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  </label>
                </div>

                <div className="wp-campaign-recipients">
                  {loadingRecipients ? (
                    <span><FontAwesomeIcon icon={faSpinner} spin /> Calculando destinatarios…</span>
                  ) : destinatarios ? (
                    <>
                      <strong><FontAwesomeIcon icon={faUsers} /> {Number(destinatarios.telefonos_unicos || 0)} teléfonos únicos</strong>
                      <small>{Number(destinatarios.total_alumnos || 0)} alumnos coinciden · {Number(destinatarios.sin_telefono || 0)} sin teléfono</small>
                      {(destinatarios.preview || []).length ? (
                        <div className="wp-campaign-recipient-preview">
                          {(destinatarios.preview || []).slice(0, 8).map((a) => (
                            <span key={a.id_alumno} className={!a.tiene_telefono ? "is-missing" : ""}>
                              {a.nombre} · {a.anio}{a.division ? ` ${a.division}` : ""}
                            </span>
                          ))}
                          {Number(destinatarios.total_alumnos || 0) > 8 ? <em>y {Number(destinatarios.total_alumnos) - 8} más…</em> : null}
                        </div>
                      ) : null}
                    </>
                  ) : <span>No se pudo calcular la audiencia.</span>}
                </div>
              </section>

              <section className="wp-campaign-section">
                <h3>Mensaje Utility</h3>
                <label className="wp-campaign-message-field">
                  <span>Texto libre de la campaña</span>
                  <textarea
                    rows={7}
                    value={form.mensaje}
                    maxLength={MAX_MESSAGE}
                    onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
                    placeholder="Ej.: Mañana se realizará la reunión informativa para las familias…"
                  />
                  <small>{form.mensaje.length}/{MAX_MESSAGE} caracteres · Este texto ocupa la variable central de la plantilla.</small>
                </label>

                <div className="wp-campaign-template-preview">
                  <div><strong>Vista previa de WhatsApp</strong><small>Plantilla: {template?.name || "aviso_informativo_cooperadora"}</small></div>
                  <pre>{previewText}</pre>
                </div>
              </section>
            </div>

            <section className="wp-campaign-section wp-campaign-schedule">
              <h3>Programación</h3>
              <label>
                <span>Fecha y hora de envío</span>
                <input type="datetime-local" value={form.programada_para} onChange={(e) => setForm((f) => ({ ...f, programada_para: e.target.value }))} />
              </label>
              <p>La campaña queda en estado <b>programada</b>. El cron que armemos después tomará estas campañas cuando llegue su fecha y hora.</p>
            </section>

            <div className="wp-campaign-form-actions">
              <button type="button" className="wp-campaign-secondary" onClick={() => setView("list")} disabled={saving}>Cancelar</button>
              <button type="button" className="wp-campaign-primary" onClick={save} disabled={saving || loadingRecipients}>
                <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} spin={saving} /> {saving ? "Guardando…" : "Guardar campaña"}
              </button>
            </div>
          </div>
        )}

        {confirmDelete ? (
          <div className="wp-campaign-confirm-layer">
            <div className="wp-campaign-confirm">
              <strong>¿Eliminar esta campaña?</strong>
              <p>Se quitará definitivamente de la programación.</p>
              <div>
                <button type="button" className="wp-campaign-secondary" onClick={() => setConfirmDelete(null)} disabled={Boolean(deletingId)}>Cancelar</button>
                <button type="button" className="wp-campaign-danger" onClick={() => remove(confirmDelete)} disabled={Boolean(deletingId)}>
                  <FontAwesomeIcon icon={deletingId ? faSpinner : faTrash} spin={Boolean(deletingId)} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CampaniasRecordatorioModal;
