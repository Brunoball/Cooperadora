// src/components/BotPanel/BotPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faMagnifyingGlass,
  faRobot,
  faHand,
  faCircle,
  faPaperPlane,
  faPaperclip,
  faUser,
  faEllipsisVertical,
  faSpinner,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import "./BotPanel.css";

// ✅ Menu ahora se usa SOLO en barra superior (no en lista)
import ChatOptionsMenu from "./ChatOptionsMenu";

// ✅ OJO: tu carpeta real es "modales"
import EditNombreModal from "./modales/EditNombreModal";
import EditEtiquetaModal from "./modales/EditEtiquetaModal";
import ConfirmActionModal from "./modales/ConfirmActionModal";

const PANEL_API =
  process.env.REACT_APP_BOT_PANEL_URL ||
  "https://cooperadora.ipet50.edu.ar/api/bot_wp/funciones/Panel/endpoints";

// ✅ carpeta nueva (acciones)
const PANEL_PUNTOS =
  process.env.REACT_APP_BOT_PANEL_PUNTOS_URL ||
  "https://cooperadora.ipet50.edu.ar/api/bot_wp/funciones/Panel/puntos";

/** Hora HH:MM desde timestamp (ms) */
const fmtHora = (ts) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const toTs = (value) => {
  if (!value) return null; // 👈 importante: null si no hay
  const s = String(value).trim();

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!m) {
    const d = new Date(s);
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  }

  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6] ?? 0);

  return new Date(year, month, day, hour, min, sec).getTime();
};

const normStr = (v) => String(v ?? "").trim();

const pickNombre = (c) => {
  const candidates = [
    c?.nombre,
    c?.nombre_contacto,
    c?.contacto_nombre,
    c?.nombre_db,
    c?.name,
    c?.full_name,
    c?.display_name,
    c?.perfil_nombre,
  ];
  for (const v of candidates) {
    const s = normStr(v);
    if (s) return s;
  }
  return "";
};

const pickModo = (c) => {
  const m = normStr(c?.modo);
  return m === "manual" ? "manual" : "bot";
};

const mapEmisorToSide = (emisor) => {
  const e = normStr(emisor).toLowerCase();
  if (e === "usuario" || e === "user") return "left";
  if (e === "bot") return "rightbot";
  return "right";
};

/** ==========================
 *  ✅ Ventana 24h helpers
 *  columna bot_contactos.ventana_24h = inicio (ej: último msg usuario)
 *  ventana válida hasta ventana_24h + 24hs
 *  ========================== */
const MS_24H = 24 * 60 * 60 * 1000;

function calcWindow(ventana24hTs, nowTs) {
  // si no hay timestamp, lo tratamos como expirada (o desconocida)
  if (!ventana24hTs || !Number.isFinite(ventana24hTs)) {
    return {
      valid: false,
      remainingMs: 0,
      remainingHours: 0,
      expireAt: null,
    };
  }
  const expireAt = ventana24hTs + MS_24H;
  const remainingMs = expireAt - nowTs;
  const valid = remainingMs > 0;

  // horas enteras hacia arriba (ej: 1.2h => 2h)
  const remainingHours = valid ? Math.max(0, Math.ceil(remainingMs / 3600000)) : 0;

  return { valid, remainingMs: Math.max(0, remainingMs), remainingHours, expireAt };
}

const BotPanel = () => {
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [chats, setChats] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mensajes, setMensajes] = useState([]);

  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [refreshingChats, setRefreshingChats] = useState(false);

  const [errorChats, setErrorChats] = useState("");
  const [errorMsgs, setErrorMsgs] = useState("");

  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("bot");

  const msgEndRef = useRef(null);

  const lastHashRef = useRef("");
  const globalHashRef = useRef("");

  const selectedIdRef = useRef(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ✅ botón ⋮ del header (ancla para posicionar menú)
  const headerMenuBtnRef = useRef(null);

  // ✅ “ahora” para refrescar el contador de ventana sin recargar
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 15000); // cada 15s
    return () => clearInterval(t);
  }, []);

  const fetchJSON = useCallback(async (url) => {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    return { res, data };
  }, []);

  const postJSON = useCallback(async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }, []);

  const markSeen = useCallback(
    async (waId) => {
      if (!waId) return;
      try {
        await fetchJSON(
          `${PANEL_API}/panel_mark_seen.php?wa_id=${encodeURIComponent(
            waId
          )}&_=${Date.now()}`
        );
      } catch {}
    },
    [fetchJSON]
  );

  // ==========================
  // ✅ ETIQUETAS (DB)
  // ==========================
  const [etiquetas, setEtiquetas] = useState([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [errorEtiquetas, setErrorEtiquetas] = useState("");

  const fetchEtiquetas = useCallback(async () => {
    setLoadingEtiquetas(true);
    setErrorEtiquetas("");
    try {
      const { res, data } = await fetchJSON(
        `${PANEL_PUNTOS}/etiquetas_list.php?_=${Date.now()}`
      );
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }
      setEtiquetas(Array.isArray(data.etiquetas) ? data.etiquetas : []);
    } catch (e) {
      setErrorEtiquetas(e?.message || "No se pudieron cargar etiquetas");
      setEtiquetas([]);
    } finally {
      setLoadingEtiquetas(false);
    }
  }, [fetchJSON]);

  const fetchChats = useCallback(
    async (silent = false) => {
      if (silent) setRefreshingChats(true);
      else setLoadingChats(true);

      setErrorChats("");

      try {
        const { res, data } = await fetchJSON(
          `${PANEL_API}/panel_chats.php?_=${Date.now()}`
        );

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Error HTTP ${res.status}`);
        }

        const rows = Array.isArray(data.chats) ? data.chats : [];

        const mapped = rows.map((c) => ({
          id: normStr(c.wa_id),
          nombre: pickNombre(c),

          // ✅ etiqueta nombre + id (para el modal)
          etiqueta: normStr(c.etiqueta || ""),
          etiqueta_id: c?.etiqueta_id ?? c?.etiquetaId ?? null,

          // ✅ ventana 24h (datetime) => timestamp
          ventana24hTs: toTs(c?.ventana_24h),

          online: !!c.online,
          ultimo: normStr(c.ultimo_mensaje || ""),
          updatedAt: toTs(c.ultima_fecha) ?? Date.now(),
          total: Number(c.total || 0),
          prioridad: normStr(c.prioridad || "normal"),
          unread: Number(c.unread || 0),
          modo: pickModo(c),
        }));

        setChats(mapped);
      } catch (err) {
        setErrorChats(err?.message || "Error cargando chats");
      } finally {
        if (silent) setRefreshingChats(false);
        else setLoadingChats(false);
      }
    },
    [fetchJSON]
  );

  const fetchMensajes = useCallback(
    async (waId, { silent = false } = {}) => {
      if (!waId) return;

      if (!silent) setLoadingMsgs(true);
      setErrorMsgs("");

      try {
        const { res, data } = await fetchJSON(
          `${PANEL_API}/panel_mensajes.php?wa_id=${encodeURIComponent(
            waId
          )}&limit=600&_=${Date.now()}`
        );

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Error HTTP ${res.status}`);
        }

        const rows = Array.isArray(data.mensajes) ? data.mensajes : [];

        const mapped = rows.map((m) => ({
          id: Number(m.id) || m.id || `${m.fecha}-${Math.random()}`,
          wa_id: normStr(m.wa_id),
          text: normStr(m.mensaje),
          emisor: normStr(m.emisor),
          prioridad: normStr(m.prioridad || "normal"),
          ts: toTs(m.fecha) ?? Date.now(),
        }));

        if (selectedIdRef.current !== waId) return;

        setMensajes(mapped);

        setTimeout(
          () => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          30
        );

        await markSeen(waId);
        await fetchChats(true);
      } catch (err) {
        setErrorMsgs(err?.message || "Error cargando mensajes");
        setMensajes([]);
      } finally {
        if (!silent) setLoadingMsgs(false);
      }
    },
    [fetchJSON, markSeen, fetchChats]
  );

  const getHash = useCallback(
    async (waId) => {
      const { res, data } = await fetchJSON(
        `${PANEL_API}/panel_hash.php?wa_id=${encodeURIComponent(
          waId
        )}&_=${Date.now()}`
      );
      if (!res.ok || !data?.success) return "";
      return String(data.hash ?? "");
    },
    [fetchJSON]
  );

  const getGlobalHash = useCallback(async () => {
    const { res, data } = await fetchJSON(
      `${PANEL_API}/panel_global_hash.php?_=${Date.now()}`
    );
    if (!res.ok || !data?.success) return "";
    return String(data.hash ?? "");
  }, [fetchJSON]);

  const pollSelectedChat = useCallback(async () => {
    const waId = selectedIdRef.current;
    if (!waId) return;

    try {
      const newHash = await getHash(waId);

      if (!lastHashRef.current) {
        lastHashRef.current = newHash;
        return;
      }

      if (newHash && newHash !== lastHashRef.current) {
        lastHashRef.current = newHash;
        await fetchMensajes(waId, { silent: true });
      }
    } catch {}
  }, [fetchMensajes, getHash]);

  const pollGlobal = useCallback(async () => {
    try {
      const newHash = await getGlobalHash();

      if (!globalHashRef.current) {
        globalHashRef.current = newHash;
        return;
      }

      if (newHash && newHash !== globalHashRef.current) {
        globalHashRef.current = newHash;

        if (!refreshingChats && !loadingChats) {
          fetchChats(true);
        }
      }
    } catch {}
  }, [fetchChats, getGlobalHash, refreshingChats, loadingChats]);

  const setModeDB = useCallback(
    async (nextMode) => {
      const waId = selectedIdRef.current;

      setMode(nextMode);

      if (!waId) return;

      try {
        const { res, data } = await postJSON(`${PANEL_API}/panel_set_modo.php`, {
          wa_id: waId,
          modo: nextMode,
        });

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Error HTTP ${res.status}`);
        }

        await fetchChats(true);
      } catch (err) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `err-mode-${Date.now()}`,
            wa_id: waId,
            text: `ERROR MODO: ${
              err?.message || "No se pudo actualizar el modo en la DB"
            }`,
            emisor: "Panel",
            prioridad: "alta",
            ts: Date.now(),
          },
        ]);
      }
    },
    [postJSON, fetchChats]
  );

  useEffect(() => {
    fetchChats(false);
    fetchEtiquetas();

    (async () => {
      const h = await getGlobalHash();
      globalHashRef.current = h || "";
    })();
  }, [fetchChats, fetchEtiquetas, getGlobalHash]);

  useEffect(() => {
    if (!selectedId) return;

    lastHashRef.current = "";

    (async () => {
      await fetchMensajes(selectedId, { silent: false });
      const h = await getHash(selectedId);
      lastHashRef.current = h || "";
    })();
  }, [selectedId, fetchMensajes, getHash]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => pollSelectedChat(), 900);
    return () => clearInterval(t);
  }, [selectedId, pollSelectedChat]);

  useEffect(() => {
    const t = setInterval(() => pollGlobal(), 900);
    return () => clearInterval(t);
  }, [pollGlobal]);

  useEffect(() => {
    const t = setInterval(() => fetchChats(true), 30000);
    return () => clearInterval(t);
  }, [fetchChats]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const arr = [...chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!qq) return arr;

    return arr.filter((c) => {
      return (
        String(c.nombre || "").toLowerCase().includes(qq) ||
        String(c.id || "").toLowerCase().includes(qq) ||
        String(c.etiqueta || "").toLowerCase().includes(qq)
      );
    });
  }, [chats, q]);

  const selected = useMemo(
    () => chats.find((c) => c.id === selectedId) || null,
    [chats, selectedId]
  );

  // ✅ Estado de ventana para el chat seleccionado
  const selectedWindow = useMemo(() => {
    return calcWindow(selected?.ventana24hTs, nowTs);
  }, [selected?.ventana24hTs, nowTs]);

  const isWindowExpired = selectedId ? !selectedWindow.valid : false;

  const openChat = (id) => {
    const c = chats.find((x) => x.id === id) || null;
    setSelectedId(id);
    setMode(c?.modo === "manual" ? "manual" : "bot");
  };

  const sendManual = async () => {
    const text = draft.trim();
    if (!text || !selectedId) return;

    // ✅ si ventana expirada => NO enviar desde panel
    if (isWindowExpired) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `win-exp-${Date.now()}`,
          wa_id: selectedId,
          text: "⛔ Ventana de 24hs expirada. No se pueden enviar mensajes desde el panel.",
          emisor: "Panel",
          prioridad: "alta",
          ts: Date.now(),
        },
      ]);
      setDraft("");
      return;
    }

    const tempId = `local-${Date.now()}`;
    setMensajes((prev) => [
      ...prev,
      {
        id: tempId,
        wa_id: selectedId,
        text,
        emisor: "Admin",
        prioridad: "normal",
        ts: Date.now(),
      },
    ]);
    setDraft("");
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

    try {
      const { res, data } = await postJSON(`${PANEL_API}/panel_send.php`, {
        wa_id: selectedId,
        texto: text,
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      lastHashRef.current = "";
      await fetchMensajes(selectedId, { silent: true });

      const h = await getHash(selectedId);
      lastHashRef.current = h || "";

      await fetchChats(true);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          wa_id: selectedId,
          text: `ERROR ENVIO: ${err?.message || "No se pudo enviar"}`,
          emisor: "Panel",
          prioridad: "alta",
          ts: Date.now(),
        },
      ]);
    }
  };

  const onKeyDownDraft = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendManual();
    }
  };

  // ==========================
  // ✅ MENU ⋮ EN HEADER + MODALES
  // ==========================
  const [openMenu, setOpenMenu] = useState(false);

  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [modalEditWa, setModalEditWa] = useState("");
  const [modalEditLoading, setModalEditLoading] = useState(false);
  const [modalEditError, setModalEditError] = useState("");

  const [modalVaciarOpen, setModalVaciarOpen] = useState(false);
  const [modalVaciarWa, setModalVaciarWa] = useState("");
  const [modalVaciarLoading, setModalVaciarLoading] = useState(false);
  const [modalVaciarError, setModalVaciarError] = useState("");

  const [modalEliminarOpen, setModalEliminarOpen] = useState(false);
  const [modalEliminarWa, setModalEliminarWa] = useState("");
  const [modalEliminarLoading, setModalEliminarLoading] = useState(false);
  const [modalEliminarError, setModalEliminarError] = useState("");

  // ✅ MODAL ETIQUETA
  const [modalTagOpen, setModalTagOpen] = useState(false);
  const [modalTagWa, setModalTagWa] = useState("");
  const [modalTagLoading, setModalTagLoading] = useState(false);
  const [modalTagError, setModalTagError] = useState("");

  const openEditarNombre = (waId) => {
    setModalEditError("");
    setModalEditWa(waId);
    setModalEditOpen(true);
  };

  const openVaciarChat = (waId) => {
    setModalVaciarError("");
    setModalVaciarWa(waId);
    setModalVaciarOpen(true);
  };

  const openEliminarContacto = (waId) => {
    setModalEliminarError("");
    setModalEliminarWa(waId);
    setModalEliminarOpen(true);
  };

  const openCambiarEtiqueta = (waId) => {
    setModalTagError("");
    setModalTagWa(waId);
    setModalTagOpen(true);
  };

  const saveNombre = async (waId, nombre) => {
    setModalEditLoading(true);
    setModalEditError("");
    try {
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/editar_nombre.php`, {
        wa_id: waId,
        nombre,
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      setModalEditOpen(false);
      await fetchChats(true);
    } catch (e) {
      setModalEditError(e?.message || "No se pudo guardar el nombre");
    } finally {
      setModalEditLoading(false);
    }
  };

  const saveEtiqueta = async (waId, etiquetaId) => {
    setModalTagLoading(true);
    setModalTagError("");
    try {
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/etiquetas_set.php`, {
        wa_id: waId,
        etiqueta_id: etiquetaId, // null => sin etiqueta
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      setModalTagOpen(false);
      await fetchChats(true);
    } catch (e) {
      setModalTagError(e?.message || "No se pudo guardar la etiqueta");
    } finally {
      setModalTagLoading(false);
    }
  };

  const doVaciarChat = async () => {
    const waId = modalVaciarWa;
    if (!waId) return;

    setModalVaciarLoading(true);
    setModalVaciarError("");
    try {
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/vaciar_chat.php`, {
        wa_id: waId,
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      setModalVaciarOpen(false);

      if (selectedIdRef.current === waId) {
        setSelectedId(null);
        setMensajes([]);
      }

      await fetchChats(true);
    } catch (e) {
      setModalVaciarError(e?.message || "No se pudo vaciar el chat");
    } finally {
      setModalVaciarLoading(false);
    }
  };

  const doEliminarContacto = async () => {
    const waId = modalEliminarWa;
    if (!waId) return;

    setModalEliminarLoading(true);
    setModalEliminarError("");
    try {
      const { res, data } = await postJSON(
        `${PANEL_PUNTOS}/eliminar_contacto.php`,
        { wa_id: waId }
      );

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }

      setModalEliminarOpen(false);

      if (selectedIdRef.current === waId) {
        setSelectedId(null);
        setMensajes([]);
      }

      await fetchChats(true);
    } catch (e) {
      setModalEliminarError(e?.message || "No se pudo eliminar el contacto");
    } finally {
      setModalEliminarLoading(false);
    }
  };

  return (
    <div className="wp-shell">
      <aside className="wp-sidebar">
        <div className="wp-side-top">
          <button
            className="wp-back"
            onClick={() => navigate("/panel", { replace: true })}
            type="button"
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>

          <div className="wp-brand">
            <span className="wp-brand-ico" aria-hidden="true">
              <FontAwesomeIcon icon={faRobot} />
            </span>
            <div className="wp-brand-txt">
              <div className="wp-brand-title">Panel Bot WhatsApp</div>
              <div className="wp-brand-sub">
                {loadingChats ? "Cargando…" : refreshingChats ? "Actualizando…" : ""}
              </div>
            </div>
          </div>

          <button
            className="wp-opts"
            type="button"
            aria-label="Opciones"
            title="Opciones"
          >
            <FontAwesomeIcon icon={faEllipsisVertical} />
          </button>
        </div>

        <div className="wp-search">
          <span className="wp-search-ico" aria-hidden="true">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="wp-search-input"
            placeholder="Buscar por nombre, número, mensaje…"
          />
        </div>

        {errorChats ? (
          <div className="wp-error">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <span>{errorChats}</span>
          </div>
        ) : null}

        <div className="wp-chatlist">
          {loadingChats && chats.length === 0 ? (
            <div className="wp-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Cargando chats…</span>
            </div>
          ) : null}

          {list.map((c) => {
            const active = c.id === selectedId;
            const nombreOk = c.nombre || "Sin nombre";
            const hora = fmtHora(c.updatedAt || Date.now());
            const totalTxt = `${Number(c.total || 0)} msgs`;

            return (
              <button
                key={c.id}
                type="button"
                className={`wp-chatitem ${active ? "is-active" : ""}`}
                onClick={() => openChat(c.id)}
              >
                <div className="wp-avatar" aria-hidden="true">
                  <FontAwesomeIcon icon={faUser} />
                </div>

                <div className="wp-chatmeta">
                  <div className="wp-chatrow" style={{ alignItems: "center" }}>
                    <div className="wp-chatname">
                      {nombreOk}
                      {c.online ? (
                        <span className="wp-online" title="En línea" aria-hidden="true">
                          <FontAwesomeIcon icon={faCircle} />
                        </span>
                      ) : null}
                    </div>

                    <div className="wp-chattime">{hora}</div>
                  </div>

                  <div className="wp-chatrow">
                    <div className="wp-chatlast">
                      {c.id} • {totalTxt}
                      {c.prioridad === "alta" ? " • ⚠️" : ""}
                      {c.modo === "manual" ? " • ✋" : ""}
                    </div>

                    {c.unread > 0 && !active ? (
                      <span className="wp-unread" title="Mensajes sin ver">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    ) : (
                      <span
                        className={`wp-tag wp-tag--${(c.etiqueta || "sin").replace(
                          /\s/g,
                          ""
                        )}`}
                      >
                        {c.etiqueta || "sin etiqueta"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loadingChats && list.length === 0 ? (
            <div className="wp-empty">No hay chats con ese filtro.</div>
          ) : null}
        </div>
      </aside>

      <main className="wp-main">
        {!selectedId ? (
          <div className="wp-main-empty">
            <div className="wp-main-empty-card">
              <div className="wp-main-empty-ico" aria-hidden="true">
                <FontAwesomeIcon icon={faRobot} />
              </div>
              <h2>Seleccioná un chat</h2>
              <p>Elegí una conversación para ver los mensajes.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="wp-chat-top">
              <div className="wp-chat-top-left">
                <div className="wp-avatar wp-avatar--sm" aria-hidden="true">
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <div className="wp-chat-top-meta">
                  <div className="wp-chat-top-name">
                    {selected?.nombre || "Sin nombre"}
                    {selected?.online ? (
                      <span className="wp-status">• en línea</span>
                    ) : (
                      <span className="wp-status">• offline</span>
                    )}
                  </div>
                  <div className="wp-chat-top-id">{selectedId}</div>
                </div>
              </div>

              <div className="wp-chat-top-right">
                <div className="wp-mode">
                  {/* ✅ NUEVO: contador ventana 24hs a la izquierda */}
                  <div
                    className={`wp-window ${isWindowExpired ? "is-expired" : ""}`}
                    title={
                      isWindowExpired
                        ? "Ventana de 24hs expirada"
                        : `Quedan ${selectedWindow.remainingHours}h`
                    }
                    aria-label="Ventana 24 horas"
                  >
                    {isWindowExpired ? (
                      <span className="wp-window-x" aria-hidden="true">
                        <FontAwesomeIcon icon={faXmark} />
                      </span>
                    ) : (
                      <span className="wp-window-h">{selectedWindow.remainingHours}hs</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`wp-modebtn ${mode === "bot" ? "is-active" : ""}`}
                    onClick={() => setModeDB("bot")}
                    title="Modo Bot (oculta barra de escribir)"
                    aria-label="Modo Bot"
                  >
                    <FontAwesomeIcon icon={faRobot} />
                  </button>

                  <button
                    type="button"
                    className={`wp-modebtn ${mode === "manual" ? "is-active" : ""}`}
                    onClick={() => setModeDB("manual")}
                    title={
                      isWindowExpired
                        ? "Modo Manual (pero ventana expirada: no se puede enviar)"
                        : "Modo Manual (muestra barra de escribir)"
                    }
                    aria-label="Modo Manual"
                  >
                    <FontAwesomeIcon icon={faHand} />
                  </button>

                  {/* ✅ 3 puntitos al lado de mano/robot */}
                  <ChatOptionsMenu
                    anchorRef={headerMenuBtnRef}
                    open={openMenu}
                    onOpen={() => setOpenMenu(true)}
                    onClose={() => setOpenMenu(false)}
                    onEditarNombre={() => openEditarNombre(selectedId)}
                    onCambiarEtiqueta={() => openCambiarEtiqueta(selectedId)}
                    onVaciarChat={() => openVaciarChat(selectedId)}
                    onEliminarContacto={() => openEliminarContacto(selectedId)}
                  />
                </div>

                <span className="wp-chip wp-chip--tag">
                  {selected?.etiqueta || "sin etiqueta"}
                </span>

                {loadingMsgs ? (
                  <span className="wp-chip">
                    <FontAwesomeIcon icon={faSpinner} spin /> Cargando…
                  </span>
                ) : null}
              </div>
            </div>

            {/* ✅ texto “expirada” visible en header si querés */}
            {isWindowExpired ? (
              <div className="wp-window-expiredline">
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <span>Ventana de 24hs expirada</span>
              </div>
            ) : null}

            <div className="wp-messages">
              <div className="wp-day">
                <span>Mensajes</span>
              </div>

              {errorMsgs ? (
                <div className="wp-error wp-error--inchat">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  <span>{errorMsgs}</span>
                </div>
              ) : null}

              {(mensajes || []).map((m) => {
                const side = mapEmisorToSide(m.emisor);
                const danger =
                  String(m.text || "").startsWith("ERROR") || m.prioridad === "alta";

                return (
                  <div key={m.id} className={`wp-msg wp-msg--${side}`}>
                    <div className={`wp-bubble ${danger ? "wp-bubble--danger" : ""}`}>
                      <div className="wp-bubble-text">{m.text}</div>
                      <div className="wp-bubble-time">
                        {fmtHora(m.ts)} • {m.emisor}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={msgEndRef} />
            </div>

            {mode === "manual" ? (
              <div className={`wp-composer ${isWindowExpired ? "is-disabled" : ""}`}>
                <button
                  type="button"
                  className="wp-attach"
                  title={isWindowExpired ? "Ventana expirada" : "Adjuntar (demo)"}
                  aria-label="Adjuntar (demo)"
                  disabled={isWindowExpired}
                >
                  <FontAwesomeIcon icon={faPaperclip} />
                </button>

                <textarea
                  className="wp-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDownDraft}
                  placeholder={
                    isWindowExpired
                      ? "Ventana expirada: no podés mandar mensajes desde el panel."
                      : "Modo manual: escribir mensaje…"
                  }
                  rows={1}
                  disabled={isWindowExpired}
                />

                <button
                  type="button"
                  className="wp-send"
                  onClick={sendManual}
                  aria-label="Enviar"
                  title={isWindowExpired ? "Ventana expirada" : "Enviar"}
                  disabled={isWindowExpired}
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      {/* =======================
          ✅ MODALES
      ======================= */}
      <EditNombreModal
        open={modalEditOpen}
        waId={modalEditWa}
        currentName={chats.find((x) => x.id === modalEditWa)?.nombre || ""}
        loading={modalEditLoading}
        error={modalEditError}
        onClose={() => setModalEditOpen(false)}
        onSave={saveNombre}
      />

      <EditEtiquetaModal
        open={modalTagOpen}
        waId={modalTagWa}
        currentEtiquetaId={chats.find((x) => x.id === modalTagWa)?.etiqueta_id || null}
        currentEtiquetaNombre={chats.find((x) => x.id === modalTagWa)?.etiqueta || ""}
        etiquetas={etiquetas}
        loading={modalTagLoading || loadingEtiquetas}
        error={modalTagError || errorEtiquetas}
        onClose={() => setModalTagOpen(false)}
        onSave={saveEtiqueta}
        puntosBaseUrl={PANEL_PUNTOS}
        onRefreshEtiquetas={fetchEtiquetas}
      />

      <ConfirmActionModal
        open={modalVaciarOpen}
        title="Vaciar chat"
        description={`Esto va a borrar TODOS los mensajes del chat (${modalVaciarWa}).`}
        confirmText="Vaciar"
        danger
        loading={modalVaciarLoading}
        error={modalVaciarError}
        onClose={() => setModalVaciarOpen(false)}
        onConfirm={doVaciarChat}
      />

      <ConfirmActionModal
        open={modalEliminarOpen}
        title="Eliminar contacto"
        description={`Esto va a borrar el contacto + chat + vistos (${modalEliminarWa}).`}
        confirmText="Eliminar"
        danger
        loading={modalEliminarLoading}
        error={modalEliminarError}
        onClose={() => setModalEliminarOpen(false)}
        onConfirm={doEliminarContacto}
      />
    </div>
  );
};

export default BotPanel;
