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

const normalizeIds = (value) => {
  const raw = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return [...new Set(raw.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))];
};

const emptyForm = () => ({
  id_campania: null,
  anios: [],
  divisiones: [],
  categorias: [],
  mensaje: "",
  programada_para: "",
});

const toLocalInput = (value) => {
  if (!value) return "";
  const raw = String(value).replace(" ", "T");
  return raw.slice(0, 16);
};

const padDatePart = (n) => String(n).padStart(2, "0");

const dateTimeInputValue = (date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const campaignDateError = (value, { requireFuture = true } = {}) => {
  if (!value) return "Seleccioná la fecha y hora de envío.";

  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "La fecha y hora seleccionadas no son válidas.";

  const month = d.getMonth() + 1;
  if (month === 1 || month === 2) {
    return "No se pueden programar campañas durante enero ni febrero.";
  }

  const day = d.getDay();
  if (day === 0 || day === 6) {
    return "No se pueden programar campañas los fines de semana. Elegí un día de lunes a viernes.";
  }

  if (requireFuture && d.getTime() <= Date.now()) {
    return "La campaña debe programarse para una fecha y hora futura.";
  }

  return "";
};

const defaultDateTime = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);

  // Si la fecha sugerida cae en enero/febrero o fin de semana, avanza
  // hasta el siguiente día permitido y propone las 09:00.
  while ([1, 2].includes(d.getMonth() + 1) || d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }

  return dateTimeInputValue(d);
};

const minDateTime = () => {
  const d = new Date(Date.now() + 60 * 1000);
  d.setSeconds(0, 0);
  return dateTimeInputValue(d);
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

const namesFor = (options, ids) => {
  const set = new Set(normalizeIds(ids));
  return (options || [])
    .filter((x) => set.has(Number(x.id)))
    .map((x) => String(x.nombre || "").trim())
    .filter(Boolean);
};

const joinNames = (names, allLabel, prefix = "") => {
  if (!Array.isArray(names) || names.length === 0) return allLabel;
  return names.map((name) => `${prefix}${name}`).join(", ");
};

const filterLabel = (campaign) => {
  const anios = Array.isArray(campaign?.anios_nombres) ? campaign.anios_nombres : [];
  const divisiones = Array.isArray(campaign?.divisiones_nombres) ? campaign.divisiones_nombres : [];
  const categorias = Array.isArray(campaign?.categorias_nombres) ? campaign.categorias_nombres : [];

  return [
    joinNames(anios, "Todos los cursos", ""),
    joinNames(divisiones, "Todas las divisiones", "Div. "),
    joinNames(categorias, "Todas las categorías", ""),
  ].join(" · ");
};

const MultiChoice = ({ label, allLabel, options, selected, onChange }) => {
  const selectedIds = normalizeIds(selected);
  const selectedSet = new Set(selectedIds);

  const toggle = (id) => {
    const numericId = Number(id);
    if (selectedSet.has(numericId)) {
      onChange(selectedIds.filter((x) => x !== numericId));
    } else {
      onChange([...selectedIds, numericId]);
    }
  };

  return (
    <div className="wp-campaign-choice">
      <div className="wp-campaign-choice-head">
        <div>
          <strong>{label}</strong>
          <small>{selectedIds.length ? `${selectedIds.length} seleccionado${selectedIds.length === 1 ? "" : "s"}` : allLabel}</small>
        </div>
        {selectedIds.length ? (
          <button type="button" onClick={() => onChange([])}>Todos</button>
        ) : null}
      </div>
      <div className="wp-campaign-choice-list">
        {(options || []).map((option) => {
          const id = Number(option.id);
          const checked = selectedSet.has(id);
          return (
            <label key={id} className={checked ? "is-checked" : ""}>
              <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
              <span>{option.nombre}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

const CampaniasRecordatorioModal = ({ open, onClose }) => {
  const [view, setView] = useState("list");
  const [activeTab, setActiveTab] = useState("mensaje");
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
  const [recipientsError, setRecipientsError] = useState("");
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
    setActiveTab("mensaje");
    setConfirmDelete(null);
    loadAll();
  }, [open, loadAll]);

  const loadRecipients = useCallback(async (targetForm) => {
    setLoadingRecipients(true);
    setRecipientsError("");
    try {
      const qs = new URLSearchParams({ accion: "destinatarios", _: String(Date.now()) });
      if (targetForm.anios?.length) qs.set("id_anios", targetForm.anios.join(","));
      if (targetForm.divisiones?.length) qs.set("id_divisiones", targetForm.divisiones.join(","));
      if (targetForm.categorias?.length) qs.set("id_categorias", targetForm.categorias.join(","));
      const data = await fetchJson(`${ENDPOINT}?${qs.toString()}`);
      setDestinatarios(data.destinatarios || null);
    } catch (e) {
      setDestinatarios(null);
      setRecipientsError(e?.message || "No se pudieron calcular los destinatarios.");
    } finally {
      setLoadingRecipients(false);
    }
  }, [fetchJson]);

  const filtersKey = useMemo(
    () => `${form.anios.join(",")}|${form.divisiones.join(",")}|${form.categorias.join(",")}`,
    [form.anios, form.divisiones, form.categorias]
  );

  useEffect(() => {
    if (!open || view !== "form") return undefined;
    const timer = window.setTimeout(() => loadRecipients(form), 250);
    return () => window.clearTimeout(timer);
    // filtersKey representa exactamente los tres filtros y evita recargar por cambios de mensaje/fecha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, filtersKey, loadRecipients]);

  const openCreate = () => {
    setForm({ ...emptyForm(), programada_para: defaultDateTime() });
    setDestinatarios(null);
    setFormError("");
    setRecipientsError("");
    setActiveTab("mensaje");
    setView("form");
  };

  const openEdit = (campaign) => {
    setForm({
      id_campania: Number(campaign.id_campania),
      anios: normalizeIds(campaign.anios_ids?.length ? campaign.anios_ids : campaign.id_anio),
      divisiones: normalizeIds(campaign.divisiones_ids?.length ? campaign.divisiones_ids : campaign.id_division),
      categorias: normalizeIds(campaign.categorias_ids?.length ? campaign.categorias_ids : campaign.id_categoria),
      mensaje: campaign.mensaje || "",
      programada_para: toLocalInput(campaign.programada_para),
    });
    setDestinatarios(null);
    setFormError("");
    setRecipientsError("");
    setActiveTab("mensaje");
    setView("form");
  };

  const save = async () => {
    setFormError("");
    if (!form.mensaje.trim()) {
      setFormError("Escribí el texto que querés insertar en la plantilla.");
      setActiveTab("mensaje");
      return;
    }
    if (form.mensaje.trim().length > MAX_MESSAGE) {
      setFormError(`El texto no puede superar ${MAX_MESSAGE} caracteres.`);
      setActiveTab("mensaje");
      return;
    }
    const dateError = campaignDateError(form.programada_para);
    if (dateError) {
      setFormError(dateError);
      setActiveTab("mensaje");
      return;
    }
    if (!destinatarios || Number(destinatarios.telefonos_unicos || 0) < 1) {
      setFormError("Los filtros seleccionados no tienen destinatarios con teléfono.");
      setActiveTab("destinatarios");
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
          id_anios: form.anios,
          id_divisiones: form.divisiones,
          id_categorias: form.categorias,
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

  const currentFilterSummary = useMemo(() => {
    const anios = namesFor(opciones.anios, form.anios);
    const divisiones = namesFor(opciones.divisiones, form.divisiones);
    const categorias = namesFor(opciones.categorias, form.categorias);
    return [
      joinNames(anios, "Todos los cursos"),
      joinNames(divisiones, "Todas las divisiones", "Div. "),
      joinNames(categorias, "Todas las categorías"),
    ].join(" · ");
  }, [opciones, form.anios, form.divisiones, form.categorias]);

  if (!open) return null;

  return (
    <div className="wp-campaign-backdrop" role="dialog" aria-modal="true" aria-label="Campañas de mensajes">
      <div className="wp-campaign-modal">
        <header className="wp-campaign-head">
          <div className="wp-campaign-title">
            <span className="wp-campaign-head-icon"><FontAwesomeIcon icon={faBullhorn} /></span>
            <div>
              <span>WhatsApp · Cooperadora</span>
              <h2>Campañas programadas</h2>
              <p>Programá avisos y elegí libremente cursos, divisiones y categorías.</p>
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
                <small>Creá, editá o eliminá campañas antes de que sean procesadas.</small>
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
                  {campanias.map((campaign) => {
                    const editable = ["programada", "error", "cancelada"].includes(campaign.estado);
                    return (
                      <article className="wp-campaign-card" key={campaign.id_campania}>
                        <div className="wp-campaign-card-main">
                          <div className="wp-campaign-card-topline">
                            <span className={`wp-campaign-status is-${campaign.estado}`}>{campaign.estado}</span>
                            <span className="wp-campaign-date"><FontAwesomeIcon icon={faClock} /> {formatDateTime(campaign.programada_para)}</span>
                          </div>
                          <strong>{filterLabel(campaign)}</strong>
                          <p>{campaign.mensaje}</p>
                          <div className="wp-campaign-card-meta">
                            <span><FontAwesomeIcon icon={faUsers} /> {Number(campaign.destinatarios_estimados || 0)} teléfonos estimados</span>
                          </div>
                        </div>
                        {editable ? (
                          <div className="wp-campaign-actions">
                            <button type="button" onClick={() => openEdit(campaign)} title="Editar campaña"><FontAwesomeIcon icon={faPen} /></button>
                            <button type="button" className="is-danger" onClick={() => setConfirmDelete(Number(campaign.id_campania))} title="Eliminar campaña"><FontAwesomeIcon icon={faTrash} /></button>
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
                <small>{currentFilterSummary}</small>
              </div>
              <button type="button" className="wp-campaign-secondary" onClick={() => setView("list")} disabled={saving}>Volver</button>
            </div>

            <div className="wp-campaign-tabs" role="tablist" aria-label="Configuración de campaña">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "mensaje"}
                className={activeTab === "mensaje" ? "is-active" : ""}
                onClick={() => setActiveTab("mensaje")}
              >
                Mensaje y programación
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "destinatarios"}
                className={activeTab === "destinatarios" ? "is-active" : ""}
                onClick={() => setActiveTab("destinatarios")}
              >
                Destinatarios
                <span>{loadingRecipients ? "…" : Number(destinatarios?.total_alumnos || 0)}</span>
              </button>
            </div>

            {formError ? <div className="wp-campaign-error">{formError}</div> : null}

            {activeTab === "mensaje" ? (
              <div className="wp-campaign-tab-content">
                <div className="wp-campaign-message-grid">
                  <section className="wp-campaign-section">
                    <h3>Mensaje de campaña</h3>
                    <label className="wp-campaign-message-field">
                      <span>Texto libre de la campaña</span>
                      <textarea
                        rows={8}
                        value={form.mensaje}
                        maxLength={MAX_MESSAGE}
                        onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
                        placeholder="Ej.: Mañana se realizará la reunión informativa para las familias…"
                      />
                      <small>{form.mensaje.length}/{MAX_MESSAGE} caracteres · Este texto ocupa la variable {"{{1}}"} de la plantilla.</small>
                    </label>

                    <div className="wp-campaign-template-note">
                      <strong>Plantilla de WhatsApp</strong>
                      <span>{template?.name || "aviso_informativo_cooperadora"} · Marketing · {template?.language_code || "es_AR"}</span>
                    </div>
                  </section>

                  <section className="wp-campaign-section">
                    <h3>Vista previa de WhatsApp</h3>
                    <div className="wp-campaign-template-preview is-message-only">
                      <pre>{previewText}</pre>
                    </div>
                  </section>
                </div>

                <section className="wp-campaign-section wp-campaign-schedule">
                  <h3>Programación</h3>
                  <label>
                    <span>Fecha y hora de envío</span>
                    <input
                      type="datetime-local"
                      value={form.programada_para}
                      min={minDateTime()}
                      step="300"
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        if (!nextValue) {
                          setForm((f) => ({ ...f, programada_para: "" }));
                          return;
                        }

                        const restriction = campaignDateError(nextValue);
                        if (restriction) {
                          setFormError(restriction);
                          return;
                        }

                        setFormError("");
                        setForm((f) => ({ ...f, programada_para: nextValue }));
                      }}
                    />
                    <small className="wp-campaign-date-help">Solo se permiten días de lunes a viernes entre marzo y diciembre.</small>
                  </label>
                  <div className="wp-campaign-audience-summary">
                    {loadingRecipients ? (
                      <span><FontAwesomeIcon icon={faSpinner} spin /> Calculando audiencia…</span>
                    ) : destinatarios ? (
                      <>
                        <strong><FontAwesomeIcon icon={faUsers} /> {Number(destinatarios.telefonos_unicos || 0)} teléfonos únicos</strong>
                        <span>{Number(destinatarios.total_alumnos || 0)} alumnos · {Number(destinatarios.sin_telefono || 0)} sin teléfono</span>
                        <button type="button" onClick={() => setActiveTab("destinatarios")}>Ver y editar destinatarios</button>
                      </>
                    ) : (
                      <span>No se pudo calcular la audiencia.</span>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="wp-campaign-tab-content">
                <section className="wp-campaign-section">
                  <div className="wp-campaign-section-heading">
                    <div>
                      <h3>Filtros de destinatarios</h3>
                      <p>Podés seleccionar varios valores en cada grupo. Si no marcás ninguno, se incluyen todos los valores de ese grupo.</p>
                    </div>
                  </div>

                  <div className="wp-campaign-multi-grid">
                    <MultiChoice
                      label="Curso / Año"
                      allLabel="Todos los cursos"
                      options={opciones.anios}
                      selected={form.anios}
                      onChange={(value) => setForm((f) => ({ ...f, anios: value }))}
                    />
                    <MultiChoice
                      label="División"
                      allLabel="Todas las divisiones"
                      options={opciones.divisiones}
                      selected={form.divisiones}
                      onChange={(value) => setForm((f) => ({ ...f, divisiones: value }))}
                    />
                    <MultiChoice
                      label="Categoría"
                      allLabel="Todas las categorías"
                      options={opciones.categorias}
                      selected={form.categorias}
                      onChange={(value) => setForm((f) => ({ ...f, categorias: value }))}
                    />
                  </div>
                </section>

                <section className="wp-campaign-section wp-campaign-recipients-section">
                  <div className="wp-campaign-recipients-heading">
                    <div>
                      <h3>Alumnos incluidos</h3>
                      {loadingRecipients ? (
                        <span><FontAwesomeIcon icon={faSpinner} spin /> Actualizando lista…</span>
                      ) : destinatarios ? (
                        <span>
                          <b>{Number(destinatarios.total_alumnos || 0)}</b> alumnos · <b>{Number(destinatarios.telefonos_unicos || 0)}</b> teléfonos únicos · <b>{Number(destinatarios.sin_telefono || 0)}</b> sin teléfono
                        </span>
                      ) : null}
                    </div>
                    <small>{currentFilterSummary}</small>
                  </div>

                  {recipientsError ? <div className="wp-campaign-error">{recipientsError}</div> : null}

                  {!loadingRecipients && destinatarios && (destinatarios.alumnos || []).length === 0 ? (
                    <div className="wp-campaign-no-recipients">No hay alumnos activos que coincidan con estos filtros.</div>
                  ) : null}

                  {(destinatarios?.alumnos || []).length ? (
                    <div className="wp-campaign-table-wrap">
                      <table className="wp-campaign-table">
                        <thead>
                          <tr>
                            <th>Nombre y apellido</th>
                            <th>Teléfono</th>
                            <th>Curso</th>
                            <th>División</th>
                            <th>Categoría</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(destinatarios.alumnos || []).map((alumno) => (
                            <tr key={alumno.id_alumno} className={!alumno.tiene_telefono ? "is-missing-phone" : ""}>
                              <td>{alumno.nombre_completo || `${alumno.apellido || ""} ${alumno.nombre || ""}`.trim() || "—"}</td>
                              <td>{alumno.telefono || <span className="wp-campaign-missing-phone">Sin teléfono</span>}</td>
                              <td>{alumno.anio || "—"}</td>
                              <td>{alumno.division || "—"}</td>
                              <td>{alumno.categoria || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              </div>
            )}

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
