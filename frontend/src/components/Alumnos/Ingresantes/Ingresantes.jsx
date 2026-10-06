import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCheckCircle,
  FaEdit,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUserGraduate,
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import '../../Global/roots.css';
import './Ingresantes.css';

const CICLO_LECTIVO = 2027;
const MAX_CASCADE_ITEMS = 15;

const normalizar = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const soloDigitos = (value = '') => String(value).replace(/\D+/g, '');

const formatMoney = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).replace(' ', 'T');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-AR');
};

const emptyForm = (monto = 0) => ({
  id_ingresante: null,
  apellido: '',
  nombre: '',
  dni: '',
  anio_ingreso: '1',
  matricula_pagada: true,
  monto_matricula: String(monto || 0),
  observaciones: '',
});

export default function Ingresantes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('todos');
  const [montoActual, setMontoActual] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm(0));
  const [toast, setToast] = useState({ mostrar: false, tipo: '', mensaje: '' });
  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [preCascada, setPreCascada] = useState(false);
  const animacionActivaRef = useRef(false);
  const cascadeTimerRef = useRef(null);

  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('usuario')) || null;
    } catch {
      return null;
    }
  }, []);

  const isReadOnly = String(usuario?.rol || '').toLowerCase() === 'vista';

  const showToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const dispararCascadaUnaVez = useCallback(() => {
    const duracionMs = 400 + (MAX_CASCADE_ITEMS - 1) * 30 + 300;
    if (animacionActivaRef.current) return;

    animacionActivaRef.current = true;
    setAnimacionActiva(true);

    if (cascadeTimerRef.current) {
      window.clearTimeout(cascadeTimerRef.current);
    }

    cascadeTimerRef.current = window.setTimeout(() => {
      animacionActivaRef.current = false;
      setAnimacionActiva(false);
      cascadeTimerRef.current = null;
    }, duracionMs);
  }, []);

  const triggerCascadaConPreMask = useCallback(() => {
    setPreCascada(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispararCascadaUnaVez();
        setPreCascada(false);
      });
    });
  }, [dispararCascadaUnaVez]);

  useEffect(() => () => {
    if (cascadeTimerRef.current) {
      window.clearTimeout(cascadeTimerRef.current);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=ingresantes_listar&ciclo=${CICLO_LECTIVO}&_=${Date.now()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();

      if (!res.ok || !data?.exito) {
        throw new Error(data?.mensaje || 'No se pudieron cargar los ingresantes.');
      }

      const monto = Number(data?.monto_matricula_actual || 0);
      setRows(Array.isArray(data?.ingresantes) ? data.ingresantes : []);
      triggerCascadaConPreMask();
      setMontoActual(monto);
      setForm((prev) =>
        prev.id_ingresante === null && (!prev.monto_matricula || Number(prev.monto_matricula) === 0)
          ? { ...prev, monto_matricula: String(monto) }
          : prev
      );
    } catch (error) {
      showToast(error?.message || 'Error al cargar ingresantes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, triggerCascadaConPreMask]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = normalizar(search);
    return rows.filter((row) => {
      if (yearFilter !== 'todos' && String(row.anio_ingreso) !== yearFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = normalizar(`${row.apellido} ${row.nombre} ${row.dni}`);
      return haystack.includes(q);
    });
  }, [rows, search, yearFilter]);

  const stats = useMemo(() => {
    const primero = rows.filter((r) => Number(r.anio_ingreso) === 1).length;
    const segundo = rows.filter((r) => Number(r.anio_ingreso) === 2).length;
    const pagadas = rows.filter((r) => Number(r.matricula_pagada) === 1);
    const totalCobrado = pagadas.reduce((acc, r) => acc + Number(r.monto_matricula || 0), 0);
    return { total: rows.length, primero, segundo, pagadas: pagadas.length, totalCobrado };
  }, [rows]);

  const openNew = () => {
    setForm(emptyForm(montoActual));
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id_ingresante: row.id_ingresante,
      apellido: row.apellido || '',
      nombre: row.nombre || '',
      dni: row.dni || '',
      anio_ingreso: String(row.anio_ingreso || 1),
      matricula_pagada: Number(row.matricula_pagada) === 1,
      monto_matricula: String(row.monto_matricula ?? montoActual ?? 0),
      observaciones: row.observaciones || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setForm(emptyForm(montoActual));
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (isReadOnly || saving) return;

    const apellido = form.apellido.trim();
    const nombre = form.nombre.trim();
    const dni = soloDigitos(form.dni);

    if (!apellido || !nombre || dni.length < 6) {
      showToast('Completá apellido, nombre y un DNI válido.', 'advertencia');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=ingresantes_guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          apellido,
          nombre,
          dni,
          ciclo_lectivo: CICLO_LECTIVO,
          anio_ingreso: Number(form.anio_ingreso),
          matricula_pagada: !!form.matricula_pagada,
          monto_matricula: form.matricula_pagada ? Number(form.monto_matricula || 0) : 0,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.exito) {
        throw new Error(data?.mensaje || 'No se pudo guardar el ingresante.');
      }

      showToast(data?.mensaje || 'Ingresante guardado correctamente.');
      setModalOpen(false);
      setForm(emptyForm(montoActual));
      await loadRows();
    } catch (error) {
      showToast(error?.message || 'Error al guardar el ingresante.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isReadOnly) return;

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=ingresantes_eliminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_ingresante: deleteTarget.id_ingresante }),
      });
      const data = await res.json();

      if (!res.ok || !data?.exito) {
        throw new Error(data?.mensaje || 'No se pudo eliminar el ingresante.');
      }

      showToast(data?.mensaje || 'Ingresante eliminado correctamente.');
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      showToast(error?.message || 'Error al eliminar el ingresante.', 'error');
    }
  };

  return (
    <div className="ingresante-page">
      {toast.mostrar && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={3000}
          onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
        />
      )}

      <div className="ingresante-shell">
        <header className="ingresante-topbar">
          <h1 className="ingresante-title">Ingresantes {CICLO_LECTIVO}</h1>

          <div className="ingresante-search-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                triggerCascadaConPreMask();
              }}
              placeholder="Buscar por apellido, nombre o DNI"
              className="ingresante-search-input"
              aria-label="Buscar ingresante"
            />
            {search ? (
              <button
                type="button"
                className="ingresante-search-clear"
                onClick={() => {
                  setSearch('');
                  triggerCascadaConPreMask();
                }}
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
              >
                <FaTimes />
              </button>
            ) : null}
            <span className="ingresante-search-icon" aria-hidden="true"><FaSearch /></span>
          </div>

          <div className="ingresante-header-actions">
            <div className="ingresante-year-tabs" aria-label="Filtrar por año">
              {[
                ['todos', 'Todos'],
                ['1', '1° año'],
                ['2', '2° año'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={yearFilter === value ? 'is-active' : ''}
                  onClick={() => {
                    setYearFilter(value);
                    triggerCascadaConPreMask();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {!isReadOnly && (
              <button className="ingresante-new-button" type="button" onClick={openNew}>
                <FaPlus />
                <span>Nuevo ingresante</span>
              </button>
            )}
          </div>
        </header>

        <main className="ingresante-content">
          <div className="ingresante-summary-row" aria-label="Resumen de ingresantes">
            <div className="ingresante-indicator is-total">
              <span className="ingresante-indicator-icon"><FaUserGraduate /></span>
              <span className="ingresante-indicator-copy">
                <small>Total ingresantes</small>
                <strong>{stats.total}</strong>
              </span>
            </div>

            <div className="ingresante-indicator is-first">
              <span className="ingresante-indicator-number">1°</span>
              <span className="ingresante-indicator-copy">
                <small>Ingresan a primer año</small>
                <strong>{stats.primero}</strong>
              </span>
            </div>

            <div className="ingresante-indicator is-second">
              <span className="ingresante-indicator-number">2°</span>
              <span className="ingresante-indicator-copy">
                <small>Ingresan a segundo año</small>
                <strong>{stats.segundo}</strong>
              </span>
            </div>

            <div className="ingresante-indicator is-paid">
              <span className="ingresante-indicator-icon"><FaCheckCircle /></span>
              <span className="ingresante-indicator-copy">
                <small>Matrículas pagadas</small>
                <strong>{stats.pagadas}</strong>
                <em>{formatMoney(stats.totalCobrado)}</em>
              </span>
            </div>
          </div>

          <section className="ingresante-table-card" aria-label="Listado de ingresantes">
            {loading ? (
              <div className="ingresante-state">
                <div className="ingresante-spinner" aria-label="Cargando ingresantes" />
              </div>
            ) : (
              <div className="ingresante-table-wrap">
                <div className="ingresante-table" role="table" aria-label="Listado de ingresantes">
                  <div className="ingresante-table-head" role="rowgroup">
                    <div className="ingresante-table-head-row" role="row">
                      <div className="ingresante-table-head-cell" role="columnheader">Apellido y nombre</div>
                      <div className="ingresante-table-head-cell" role="columnheader">DNI</div>
                      <div className="ingresante-table-head-cell" role="columnheader">Ingresa a</div>
                      <div className="ingresante-table-head-cell" role="columnheader">Matrícula</div>
                      <div className="ingresante-table-head-cell" role="columnheader">Monto</div>
                      <div className="ingresante-table-head-cell" role="columnheader">Fecha</div>
                      <div className="ingresante-table-head-cell ingresante-actions-col" role="columnheader">Acciones</div>
                    </div>
                  </div>

                  <div className="ingresante-table-body" role="rowgroup">
                    {filteredRows.length === 0 ? (
                      <div className="ingresante-table-empty ingresante-empty">
                        <FaUserGraduate />
                        <strong>No hay ingresantes para mostrar</strong>
                        <span>
                          {rows.length === 0
                            ? 'Podés cargar el primero con “Nuevo ingresante”.'
                            : 'Probá cambiando la búsqueda o el filtro.'}
                        </span>
                      </div>
                    ) : (
                      filteredRows.map((row, index) => {
                        const willAnimate = animacionActiva && index < MAX_CASCADE_ITEMS;
                        const preMask = preCascada && index < MAX_CASCADE_ITEMS;

                        return (
                          <div
                            className={`ingresante-table-row ${index % 2 === 0 ? 'ingresante-even-row' : 'ingresante-odd-row'} ${willAnimate ? 'ingresante-cascade' : ''}`}
                            role="row"
                            key={row.id_ingresante}
                            style={{
                              animationDelay: willAnimate ? `${index * 0.03}s` : '0s',
                              opacity: preMask ? 0 : undefined,
                              transform: preMask ? 'translateY(8px)' : undefined,
                            }}
                          >
                          <div className="ingresante-table-cell ingresante-name-cell" role="cell" data-label="Alumno">
                            <strong>{row.apellido} {row.nombre}</strong>
                            {row.observaciones ? <small>{row.observaciones}</small> : null}
                          </div>
                          <div className="ingresante-table-cell ingresante-mono" role="cell" data-label="DNI">{row.dni}</div>
                          <div className="ingresante-table-cell" role="cell" data-label="Ingresa a">
                            <span className="ingresante-year-badge">{row.anio_ingreso}° año</span>
                          </div>
                          <div className="ingresante-table-cell" role="cell" data-label="Matrícula">
                            {Number(row.matricula_pagada) === 1 ? (
                              <span className="ingresante-paid"><FaCheckCircle /> Pagada</span>
                            ) : (
                              <span className="ingresante-pending">Pendiente</span>
                            )}
                          </div>
                          <div className="ingresante-table-cell" role="cell" data-label="Monto">{formatMoney(row.monto_matricula)}</div>
                          <div className="ingresante-table-cell" role="cell" data-label="Fecha">{formatDate(row.fecha_inscripcion)}</div>
                          <div className="ingresante-table-cell ingresante-actions-col" role="cell" data-label="Acciones">
                            {!isReadOnly ? (
                              <div className="ingresante-row-actions">
                                <button
                                  className="ingresante-icon-btn edit"
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  title="Editar"
                                  aria-label={`Editar a ${row.apellido} ${row.nombre}`}
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  className="ingresante-icon-btn delete"
                                  type="button"
                                  onClick={() => setDeleteTarget(row)}
                                  title="Eliminar"
                                  aria-label={`Eliminar a ${row.apellido} ${row.nombre}`}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            ) : (
                              <span className="ingresante-readonly">Solo lectura</span>
                            )}
                          </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="ingresante-bottom-bar">
          <button className="ingresante-bottom-button is-back" type="button" onClick={() => navigate('/panel')}>
            <FaArrowLeft />
            <span>Volver al panel</span>
          </button>

          {!isReadOnly && (
            <button className="ingresante-bottom-button is-new" type="button" onClick={openNew}>
              <FaPlus />
              <span>Nuevo ingresante</span>
            </button>
          )}
        </footer>
      </div>

      {modalOpen && (
        <div className="ingresante-modal-backdrop" role="presentation">
          <div className="ingresante-modal" role="dialog" aria-modal="true" aria-labelledby="ingresante-modal-title">
            <div className="ingresante-modal-head">
              <div className="ingresante-modal-title-wrap">
                <FaUserGraduate className="ingresante-modal-title-icon" />
                <div>
                  <span>{form.id_ingresante ? 'Editar registro' : 'Registro provisorio'}</span>
                  <h2 id="ingresante-modal-title">{form.id_ingresante ? 'Editar ingresante' : 'Nuevo ingresante'}</h2>
                </div>
              </div>
              <button type="button" className="ingresante-close" onClick={closeModal} aria-label="Cerrar" title="Cerrar">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={save} className="ingresante-form">
              <div className="ingresante-form-grid">
                <label className="ingresante-floatingresante-field">
                  <input
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    maxLength={100}
                    autoFocus
                    required
                    placeholder="Ej. González"
                  />
                  <span>Apellido *</span>
                </label>

                <label className="ingresante-floatingresante-field">
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    maxLength={100}
                    required
                    placeholder="Ej. Martina"
                  />
                  <span>Nombre *</span>
                </label>

                <label className="ingresante-floatingresante-field">
                  <input
                    name="dni"
                    value={form.dni}
                    onChange={(e) => setForm((prev) => ({ ...prev, dni: soloDigitos(e.target.value) }))}
                    inputMode="numeric"
                    maxLength={20}
                    required
                    placeholder="Ej. 48123456"
                  />
                  <span>DNI *</span>
                </label>

                <label className="ingresante-floatingresante-field ingresante-select-field">
                  <select name="anio_ingreso" value={form.anio_ingreso} onChange={handleChange}>
                    <option value="1">1° año</option>
                    <option value="2">2° año</option>
                  </select>
                  <span>Ingresa a *</span>
                </label>

                <label className="ingresante-check-card">
                  <input
                    type="checkbox"
                    name="matricula_pagada"
                    checked={form.matricula_pagada}
                    onChange={handleChange}
                  />
                  <span className="ingresante-check-copy">
                    <strong>Matrícula pagada</strong>
                    <small>Desmarcá esta opción si queda pendiente.</small>
                  </span>
                </label>

                <label className={`ingresante-floatingresante-field ${!form.matricula_pagada ? 'is-disabled' : ''}`}>
                  <input
                    name="monto_matricula"
                    value={form.monto_matricula}
                    onChange={(e) => setForm((prev) => ({ ...prev, monto_matricula: soloDigitos(e.target.value) }))}
                    inputMode="numeric"
                    disabled={!form.matricula_pagada}
                    placeholder="Ej. 25000"
                  />
                  <span>Monto matrícula</span>
                  <small className="ingresante-help">Valor configurado: {formatMoney(montoActual)}</small>
                </label>
              </div>

              <label className="ingresante-floatingresante-field ingresante-observations">
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  maxLength={255}
                  rows={3}
                  placeholder="Ej. Documentación pendiente o aclaraciones del ingreso"
                />
                <span>Observaciones</span>
              </label>

              <div className="ingresante-cycle-note">
                <FaUserGraduate />
                <span>
                  Se guarda como ingresante del ciclo <strong>{CICLO_LECTIVO}</strong> y todavía no crea un alumno definitivo.
                </span>
              </div>

              <div className="ingresante-modal-actions">
                <button type="button" className="ingresante-btn ingresante-btn-secondary" onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="ingresante-btn ingresante-btn-primary" disabled={saving}>
                  {form.id_ingresante ? 'Guardar cambios' : 'Registrar ingresante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="ingresante-modal-backdrop" role="presentation">
          <div className="ingresante-confirm" role="dialog" aria-modal="true" aria-labelledby="ingresante-delete-title">
            <div className="ingresante-confirm-icon"><FaTrash /></div>
            <h2 id="ingresante-delete-title">Eliminar ingresante</h2>
            <p>
              ¿Querés eliminar a <strong>{deleteTarget.apellido} {deleteTarget.nombre}</strong> del registro provisorio?
            </p>
            <div className="ingresante-modal-actions">
              <button type="button" className="ingresante-btn ingresante-btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="ingresante-btn ingresante-btn-danger" onClick={confirmDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
