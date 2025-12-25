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
  faSpinner,
  faTriangleExclamation,
  faXmark,
  faFaceSmile,
  faFilePdf,
} from "@fortawesome/free-solid-svg-icons";
import "./BotPanel.css";

// ✅ emoji-mart (v5)
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

// ✅ Menu ahora se usa SOLO en barra superior (no en lista)
import ChatOptionsMenu from "./ChatOptionsMenu";

// ✅ OJO: tu carpeta real es "modales"
import EditNombreModal from "./modales/EditNombreModal";
import EditEtiquetaModal from "./modales/EditEtiquetaModal";
import ConfirmActionModal from "./modales/ConfirmActionModal";

// ✅ NUEVO: modal galería
import GaleriaModal from "./modales/GaleriaModal";

const PANEL_API =
  process.env.REACT_APP_BOT_PANEL_URL ||
  "https://cooperadora.ipet50.edu.ar/api/bot_wp/funciones/Panel/endpoints";

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
  if (!value) return null;
  const s = String(value).trim();

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);

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
  return "right"; // Admin/Panel
};

const MS_24H = 24 * 60 * 60 * 1000;

function calcWindow(ventana24hTs, nowTs) {
  if (!ventana24hTs || !Number.isFinite(ventana24hTs)) {
    return { valid: false, remainingMs: 0, remainingHours: 0, expireAt: null };
  }
  const expireAt = ventana24hTs + MS_24H;
  const remainingMs = expireAt - nowTs;
  const valid = remainingMs > 0;
  const remainingHours = valid ? Math.max(0, Math.ceil(remainingMs / 3600000)) : 0;

  return { valid, remainingMs: Math.max(0, remainingMs), remainingHours, expireAt };
}

const isImageMime = (mime) => /^image\//i.test(String(mime || ""));
const isPdfMime = (mime) => String(mime || "").toLowerCase() === "application/pdf";

const inferMimeFromUrl = (url) => {
  const u = String(url || "").toLowerCase();
  if (!u) return "";
  if (u.includes(".pdf")) return "application/pdf";
  if (u.includes(".png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  if (u.includes(".gif")) return "image/gif";
  if (u.includes(".jpg") || u.includes(".jpeg")) return "image/jpeg";
  return "";
};

const inferNameFromUrl = (url) => {
  try {
    const u = String(url || "");
    const clean = u.split("?")[0];
    const parts = clean.split("/");
    return parts[parts.length - 1] || "archivo";
  } catch {
    return "archivo";
  }
};

const fmtBytes = (n) => {
  const v = Number(n || 0);
  if (!v) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

/* =========================
   ✅ MODAL VISOR (IMG / PDF) - CORREGIDO Z-INDEX
========================= */
const MediaViewerModal = ({ open, onClose, item }) => {
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    const onDown = (e) => {
      const box = boxRef.current;
      if (!box) return;
      if (!box.contains(e.target)) onClose?.();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open || !item?.url) return null;

  const mime = item.mime || inferMimeFromUrl(item.url);
  const isImg = isImageMime(mime);
  const isPdf = isPdfMime(mime);

  return (
    <div className="wp-media-backdrop" role="dialog" aria-label="Visor de archivo">
      <div className="wp-media-modal" ref={boxRef}>
        <div className="wp-media-top">
          <div className="wp-media-title">
            {isPdf ? (
              <>
                <FontAwesomeIcon icon={faFilePdf} />{" "}
                <span>{item.name || "Documento PDF"}</span>
              </>
            ) : (
              <span>{item.name || "Imagen"}</span>
            )}
          </div>

          <div className="wp-media-actions">
            <a className="wp-media-open" href={item.url} target="_blank" rel="noreferrer">
              Abrir
            </a>
            <button className="wp-media-close" type="button" onClick={onClose} aria-label="Cerrar">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="wp-media-body">
          {isImg ? (
            <img className="wp-media-img" src={item.url} alt={item.name || "imagen"} />
          ) : isPdf ? (
            <iframe className="wp-media-iframe" src={item.url} title="PDF" />
          ) : (
            <div className="wp-media-unknown">
              <p>📎 {item.name || "Archivo"}</p>
              <a href={item.url} target="_blank" rel="noreferrer">
                Abrir archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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

  const headerMenuBtnRef = useRef(null);

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 15000);
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

  const postFormData = useCallback(async (url, formData) => {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }, []);

  const markSeen = useCallback(
    async (waId) => {
      if (!waId) return;
      try {
        await fetchJSON(
          `${PANEL_API}/panel_mark_seen.php?wa_id=${encodeURIComponent(waId)}&_=${Date.now()}`
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
      const { res, data } = await fetchJSON(`${PANEL_PUNTOS}/etiquetas_list.php?_=${Date.now()}`);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);
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
        const { res, data } = await fetchJSON(`${PANEL_API}/panel_chats.php?_=${Date.now()}`);
        if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

        const rows = Array.isArray(data.chats) ? data.chats : [];
        const mapped = rows.map((c) => ({
          id: normStr(c.wa_id),
          nombre: pickNombre(c),

          etiqueta: normStr(c.etiqueta || ""),
          etiqueta_id: c?.etiqueta_id ?? c?.etiquetaId ?? null,

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

  // ==========================
  // ✅ MEDIA VISOR STATE
  // ==========================
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItem, setViewerItem] = useState(null);

  // CORRECCIÓN: Cerrar galería antes de abrir el visor
  const openViewer = (item) => {
    if (!item?.url) return;
    // Cerrar galería primero para que no quede encima
    setGaleriaOpen(false);
    setViewerItem(item);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerItem(null);
  };

  const fetchMensajes = useCallback(
    async (waId, { silent = false } = {}) => {
      if (!waId) return;

      if (!silent) setLoadingMsgs(true);
      setErrorMsgs("");

      try {
        const { res, data } = await fetchJSON(
          `${PANEL_API}/panel_mensajes.php?wa_id=${encodeURIComponent(waId)}&limit=600&_=${Date.now()}`
        );
        if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

        const rows = Array.isArray(data.mensajes) ? data.mensajes : [];

        const mapped = rows.map((m) => {
          // ✅ compat: nuevo (archivo_url) o viejo (media_url)
          const url = normStr(m.archivo_url || m.media_url || "");
          const mime = normStr(m.media_mime || "") || (url ? inferMimeFromUrl(url) : "");
          const name = normStr(m.media_name || "") || (url ? inferNameFromUrl(url) : "");
          const size = Number(m.media_size || 0);

          // tipo para UI (si no viene)
          const tipo =
            normStr(m.tipo || "") ||
            (url ? (isPdfMime(mime) ? "document" : isImageMime(mime) ? "image" : "file") : "text");

          return {
            id: Number(m.id) || m.id || `${m.fecha}-${Math.random()}`,
            wa_id: normStr(m.wa_id),
            text: normStr(m.mensaje),
            emisor: normStr(m.emisor),
            prioridad: normStr(m.prioridad || "normal"),
            ts: toTs(m.fecha) ?? Date.now(),

            tipo,
            media_url: url,
            media_mime: mime,
            media_name: name,
            media_size: size,
          };
        });

        if (selectedIdRef.current !== waId) return;

        setMensajes(mapped);
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

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
        `${PANEL_API}/panel_hash.php?wa_id=${encodeURIComponent(waId)}&_=${Date.now()}`
      );
      if (!res.ok || !data?.success) return "";
      return String(data.hash ?? "");
    },
    [fetchJSON]
  );

  const getGlobalHash = useCallback(async () => {
    const { res, data } = await fetchJSON(`${PANEL_API}/panel_global_hash.php?_=${Date.now()}`);
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
        if (!refreshingChats && !loadingChats) fetchChats(true);
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

        if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);
        await fetchChats(true);
      } catch (err) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `err-mode-${Date.now()}`,
            wa_id: waId,
            text: `ERROR MODO: ${err?.message || "No se pudo actualizar el modo en la DB"}`,
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

  const selected = useMemo(() => chats.find((c) => c.id === selectedId) || null, [chats, selectedId]);

  const selectedWindow = useMemo(
    () => calcWindow(selected?.ventana24hTs, nowTs),
    [selected?.ventana24hTs, nowTs]
  );

  const isWindowExpired = selectedId ? !selectedWindow.valid : false;

  const openChat = (id) => {
    const c = chats.find((x) => x.id === id) || null;
    setSelectedId(id);
    setMode(c?.modo === "manual" ? "manual" : "bot");
  };

  // ==========================
  // ✅ EMOJIS
  // ==========================
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiBtnRef = useRef(null);
  const emojiPopRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    setEmojiOpen(false);
  }, [selectedId, mode, isWindowExpired]);

  useEffect(() => {
    if (!emojiOpen) return;

    const onDown = (e) => {
      const btn = emojiBtnRef.current;
      const pop = emojiPopRef.current;
      if (!btn || !pop) return;

      if (btn.contains(e.target)) return;
      if (pop.contains(e.target)) return;

      setEmojiOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  const insertAtCursor = useCallback(
    (emoji) => {
      const ta = composerRef.current;
      if (!ta) {
        setDraft((prev) => prev + emoji);
        return;
      }

      const start = ta.selectionStart ?? draft.length;
      const end = ta.selectionEnd ?? draft.length;

      setDraft((prev) => {
        const a = prev.slice(0, start);
        const b = prev.slice(end);
        return a + emoji + b;
      });

      setTimeout(() => {
        try {
          ta.focus();
          const next = start + emoji.length;
          ta.setSelectionRange(next, next);
        } catch {}
      }, 0);
    },
    [draft]
  );

  // ==========================
  // ✅ adjuntos (imagen/pdf)
  // ==========================
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [sendingMedia, setSendingMedia] = useState(false);

  const onAttachClick = () => {
    if (isWindowExpired) return;
    if (mode !== "manual") return;
    fileInputRef.current?.click();
  };

  const onFilePicked = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;

    const mime = String(f.type || "");
    const ok = isImageMime(mime) || isPdfMime(mime);

    if (!ok) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `bad-file-${Date.now()}`,
          wa_id: selectedIdRef.current || "",
          text: "⚠️ Solo se permiten imágenes (JPG/PNG/WEBP) o PDF.",
          emisor: "Panel",
          prioridad: "alta",
          ts: Date.now(),
        },
      ]);
      e.target.value = "";
      return;
    }

    if (f.size > 12 * 1024 * 1024) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `big-file-${Date.now()}`,
          wa_id: selectedIdRef.current || "",
          text: "⚠️ Archivo demasiado grande (máx sugerido 12MB).",
          emisor: "Panel",
          prioridad: "alta",
          ts: Date.now(),
        },
      ]);
      e.target.value = "";
      return;
    }

    setAttachedFile(f);
  };

  const clearAttached = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendManual = async () => {
    const waId = selectedIdRef.current;
    if (!waId) return;

    const text = draft.trim();

    if (isWindowExpired) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `win-exp-${Date.now()}`,
          wa_id: waId,
          text: "⛔ Ventana de 24hs expirada. No se pueden enviar mensajes desde el panel.",
          emisor: "Panel",
          prioridad: "alta",
          ts: Date.now(),
        },
      ]);
      setDraft("");
      setEmojiOpen(false);
      clearAttached();
      return;
    }

    // ✅ si hay archivo => enviar media
    if (attachedFile) {
      setSendingMedia(true);

      const tempId = `local-media-${Date.now()}`;
      setMensajes((prev) => [
        ...prev,
        {
          id: tempId,
          wa_id: waId,
          text: text || "",
          emisor: "Admin",
          prioridad: "normal",
          ts: Date.now(),
          tipo: isPdfMime(attachedFile.type) ? "document" : "image",
          media_url: "",
          media_mime: attachedFile.type,
          media_name: attachedFile.name,
          media_size: attachedFile.size,
        },
      ]);

      setDraft("");
      setEmojiOpen(false);

      try {
        const fd = new FormData();
        fd.append("wa_id", waId);
        fd.append("caption", text);
        fd.append("file", attachedFile);

        const { res, data } = await postFormData(`${PANEL_API}/panel_send_media.php`, fd);
        if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

        clearAttached();

        lastHashRef.current = "";
        await fetchMensajes(waId, { silent: true });

        const h = await getHash(waId);
        lastHashRef.current = h || "";

        await fetchChats(true);
      } catch (err) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `err-media-${Date.now()}`,
            wa_id: waId,
            text: `ERROR ENVIO ARCHIVO: ${err?.message || "No se pudo enviar"}`,
            emisor: "Panel",
            prioridad: "alta",
            ts: Date.now(),
          },
        ]);
      } finally {
        setSendingMedia(false);
      }

      return;
    }

    // ✅ texto normal
    if (!text) return;

    const tempId = `local-${Date.now()}`;
    setMensajes((prev) => [
      ...prev,
      {
        id: tempId,
        wa_id: waId,
        text,
        emisor: "Admin",
        prioridad: "normal",
        ts: Date.now(),
        tipo: "text",
      },
    ]);
    setDraft("");
    setEmojiOpen(false);
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

    try {
      const { res, data } = await postJSON(`${PANEL_API}/panel_send.php`, {
        wa_id: waId,
        texto: text,
      });

      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

      lastHashRef.current = "";
      await fetchMensajes(waId, { silent: true });

      const h = await getHash(waId);
      lastHashRef.current = h || "";

      await fetchChats(true);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          wa_id: waId,
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

  const [modalTagOpen, setModalTagOpen] = useState(false);
  const [modalTagWa, setModalTagWa] = useState("");
  const [modalTagLoading, setModalTagLoading] = useState(false);
  const [modalTagError, setModalTagError] = useState("");

  // ✅ NUEVO: Galería
  const [galeriaOpen, setGaleriaOpen] = useState(false);

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
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/editar_nombre.php`, { wa_id: waId, nombre });
      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);
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
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/etiquetas_set.php`, { wa_id: waId, etiqueta_id: etiquetaId });
      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);
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
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/vaciar_chat.php`, { wa_id: waId });
      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

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
      const { res, data } = await postJSON(`${PANEL_PUNTOS}/eliminar_contacto.php`, { wa_id: waId });
      if (!res.ok || !data?.success) throw new Error(data?.error || `Error HTTP ${res.status}`);

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

  // ✅ NUEVO: construir items de galería desde mensajes
  const galleryItems = useMemo(() => {
    const arr = Array.isArray(mensajes) ? mensajes : [];
    const files = arr
      .filter((m) => !!m?.media_url)
      .map((m) => {
        const url = m.media_url;
        const mime = m.media_mime || inferMimeFromUrl(url);
        const kind = isPdfMime(mime) ? "pdf" : isImageMime(mime) ? "image" : "file";
        return {
          url,
          mime,
          kind,
          name: m.media_name || inferNameFromUrl(url),
          size: m.media_size || 0,
          ts: m.ts || 0,
        };
      });

    // orden: más nuevo primero
    files.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return files;
  }, [mensajes]);

  const openGaleria = () => {
    setGaleriaOpen(true);
  };

  const closeGaleria = () => setGaleriaOpen(false);

  // CORRECCIÓN: Modificado para cerrar galería antes de abrir el visor
  const onOpenGalleryItem = (it) => {
    // Cierra la galería primero
    setGaleriaOpen(false);
    // Luego abre el visor
    setTimeout(() => {
      openViewer({ url: it.url, mime: it.mime, name: it.name });
    }, 50);
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
              <div className="wp-brand-sub">{loadingChats ? "Cargando…" : refreshingChats ? "Actualizando…" : ""}</div>
            </div>
          </div>
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
                      <span className={`wp-tag wp-tag--${(c.etiqueta || "sin").replace(/\s/g, "")}`}>
                        {c.etiqueta || "sin etiqueta"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loadingChats && list.length === 0 ? <div className="wp-empty">No hay chats con ese filtro.</div> : null}
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
                    {selected?.online ? <span className="wp-status">• en línea</span> : <span className="wp-status">• offline</span>}
                  </div>
                  <div className="wp-chat-top-id">{selectedId}</div>
                </div>
              </div>

              <div className="wp-chat-top-right">
                <div className="wp-mode">
                  <div
                    className={`wp-window ${isWindowExpired ? "is-expired" : ""}`}
                    title={isWindowExpired ? "Ventana de 24hs expirada" : `Quedan ${selectedWindow.remainingHours}h`}
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
                    title={isWindowExpired ? "Modo Manual (pero ventana expirada: no se puede enviar)" : "Modo Manual (muestra barra de escribir)"}
                    aria-label="Modo Manual"
                  >
                    <FontAwesomeIcon icon={faHand} />
                  </button>

                  <ChatOptionsMenu
                    anchorRef={headerMenuBtnRef}
                    open={openMenu}
                    onOpen={() => setOpenMenu(true)}
                    onClose={() => setOpenMenu(false)}
                    onEditarNombre={() => openEditarNombre(selectedId)}
                    onCambiarEtiqueta={() => openCambiarEtiqueta(selectedId)}
                    onVerGaleria={() => openGaleria()}   // ✅ NUEVO
                    onVaciarChat={() => openVaciarChat(selectedId)}
                    onEliminarContacto={() => openEliminarContacto(selectedId)}
                  />
                </div>

                <span className="wp-chip wp-chip--tag">{selected?.etiqueta || "sin etiqueta"}</span>

                {loadingMsgs ? (
                  <span className="wp-chip">
                    <FontAwesomeIcon icon={faSpinner} spin /> Cargando…
                  </span>
                ) : null}
              </div>
            </div>

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
                const danger = String(m.text || "").startsWith("ERROR") || m.prioridad === "alta";

                const hasMedia = !!m.media_url;
                const mime = m.media_mime || (m.media_url ? inferMimeFromUrl(m.media_url) : "");
                const showImg = hasMedia && isImageMime(mime);
                const showPdf = hasMedia && isPdfMime(mime);

                return (
                  <div key={m.id} className={`wp-msg wp-msg--${side}`}>
                    <div className={`wp-bubble ${danger ? "wp-bubble--danger" : ""}`}>
                      {hasMedia ? (
                        <div className="wp-media-inbubble">
                          {showImg ? (
                            <button
                              type="button"
                              className="wp-media-thumbbtn"
                              onClick={() =>
                                openViewer({
                                  url: m.media_url,
                                  mime,
                                  name: m.media_name || "imagen",
                                })
                              }
                              title="Ver imagen"
                            >
                              <img className="wp-media-thumb" src={m.media_url} alt={m.media_name || "imagen"} />
                            </button>
                          ) : showPdf ? (
                            <button
                              type="button"
                              className="wp-doc-card"
                              onClick={() =>
                                openViewer({
                                  url: m.media_url,
                                  mime,
                                  name: m.media_name || "documento.pdf",
                                })
                              }
                              title="Ver PDF"
                            >
                              <div className="wp-doc-ico">
                                <FontAwesomeIcon icon={faFilePdf} />
                              </div>
                              <div className="wp-doc-meta">
                                <div className="wp-doc-name">{m.media_name || "Documento PDF"}</div>
                                <div className="wp-doc-sub">
                                  PDF {m.media_size ? `• ${fmtBytes(m.media_size)}` : ""}
                                </div>
                              </div>
                            </button>
                          ) : (
                            <a href={m.media_url} target="_blank" rel="noreferrer">
                              📎 {m.media_name || "Archivo"} {m.media_size ? `(${fmtBytes(m.media_size)})` : ""}
                            </a>
                          )}
                        </div>
                      ) : null}

                      {m.text ? <div className="wp-bubble-text">{m.text}</div> : null}

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
                <div className="wp-composer-inner">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: "none" }}
                    onChange={onFilePicked}
                  />

                  <button
                    type="button"
                    className="wp-attach"
                    title={isWindowExpired ? "Ventana expirada" : "Adjuntar imagen/PDF"}
                    aria-label="Adjuntar imagen/PDF"
                    disabled={isWindowExpired || sendingMedia}
                    onClick={onAttachClick}
                  >
                    <FontAwesomeIcon icon={faPaperclip} />
                  </button>

                  <button
                    ref={emojiBtnRef}
                    type="button"
                    className={`wp-emoji-btn ${emojiOpen ? "is-open" : ""}`}
                    title={isWindowExpired ? "Ventana expirada" : "Emojis"}
                    aria-label="Emojis"
                    disabled={isWindowExpired}
                    onClick={() => setEmojiOpen((v) => !v)}
                  >
                    <FontAwesomeIcon icon={faFaceSmile} />
                  </button>

                  {emojiOpen && !isWindowExpired ? (
                    <div ref={emojiPopRef} className="wp-emoji-pop" role="dialog" aria-label="Selector de emojis">
                      <Picker
                        data={data}
                        previewPosition="none"
                        navPosition="bottom"
                        theme="dark"
                        onEmojiSelect={(e) => {
                          const emoji = e?.native || "";
                          if (!emoji) return;
                          insertAtCursor(emoji);
                        }}
                      />
                    </div>
                  ) : null}

                  <textarea
                    ref={composerRef}
                    className="wp-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDownDraft}
                    placeholder={
                      attachedFile
                        ? `Adjunto: ${attachedFile.name} — escribí un texto opcional…`
                        : isWindowExpired
                        ? "Ventana expirada: no podés mandar mensajes desde el panel."
                        : "Modo manual: escribir mensaje…"
                    }
                    rows={1}
                    disabled={isWindowExpired || sendingMedia}
                  />

                  <button
                    type="button"
                    className="wp-send"
                    onClick={sendManual}
                    aria-label="Enviar"
                    title={isWindowExpired ? "Ventana expirada" : attachedFile ? "Enviar archivo" : "Enviar"}
                    disabled={isWindowExpired || sendingMedia}
                  >
                    {sendingMedia ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                  </button>
                </div>

                {attachedFile ? (
                  <div style={{ padding: "6px 10px", fontSize: 12, opacity: 0.9, display: "flex", gap: 10, alignItems: "center" }}>
                    <span>
                      📎 <b>{attachedFile.name}</b> ({fmtBytes(attachedFile.size)})
                    </span>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "inherit",
                        textDecoration: "underline",
                      }}
                      onClick={clearAttached}
                    >
                      quitar
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>

      {/* ✅ VISOR - CORREGIDO: Mayor z-index que la galería */}
      <MediaViewerModal open={viewerOpen} onClose={closeViewer} item={viewerItem} />

      {/* ✅ NUEVO: GALERÍA - Menor z-index que el visor */}
      <GaleriaModal
        open={galeriaOpen}
        onClose={closeGaleria}
        items={galleryItems}
        title={`Galería • ${selected?.nombre || "Sin nombre"}`}
        onOpenItem={(it) => onOpenGalleryItem(it)}
      />

      {/* ✅ MODALES */}
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