import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  }, [showToast]);

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
    <div className="ing-page">
      {toast.mostrar && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={3000}
          onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
        />
      )}

      <header className="ing-header">
        <div>
          <div className="ing-eyebrow">Alumnos</div>
          <h1>Ingresantes {CICLO_LECTIVO}</h1>
          <p>Registro provisorio de chicos que ingresan a 1° o 2° año.</p>
        </div>

        {!isReadOnly && (
          <button className="ing-btn ing-btn-primary" onClick={openNew}>
            <FaPlus />
            Nuevo ingresante
          </button>
        )}
      </header>

      <main className="ing-main">
        <section className="ing-stats" aria-label="Resumen de ingresantes">
          <div className="ing-stat">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="ing-stat">
            <span>1° año</span>
            <strong>{stats.primero}</strong>
          </div>
          <div className="ing-stat">
            <span>2° año</span>
            <strong>{stats.segundo}</strong>
          </div>
          <div className="ing-stat ing-stat-paid">
            <span>Matrículas pagadas</span>
            <strong>{stats.pagadas}</strong>
            <small>{formatMoney(stats.totalCobrado)}</small>
          </div>
        </section>

        <section className="ing-card">
          <div className="ing-toolbar">
            <div className="ing-search">
              <FaSearch />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por apellido, nombre o DNI"
                aria-label="Buscar ingresante"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <FaTimes />
                </button>
              )}
            </div>

            <div className="ing-filter-group" aria-label="Filtrar por año">
              {[
                ['todos', 'Todos'],
                ['1', '1°'],
                ['2', '2°'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={yearFilter === value ? 'is-active' : ''}
                  onClick={() => setYearFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ing-count">
            <FaUserGraduate />
            {filteredRows.length} ingresante{filteredRows.length === 1 ? '' : 's'} visible{filteredRows.length === 1 ? '' : 's'}
          </div>

          {loading ? (
            <div className="ing-empty">Cargando ingresantes...</div>
          ) : filteredRows.length === 0 ? (
            <div className="ing-empty">
              <FaUserGraduate />
              <strong>No hay ingresantes para mostrar.</strong>
              <span>{rows.length === 0 ? 'Podés cargar el primero con “Nuevo ingresante”.' : 'Probá cambiando la búsqueda o el filtro.'}</span>
            </div>
          ) : (
            <>
              <div className="ing-table-wrap">
                <table className="ing-table">
                  <thead>
                    <tr>
                      <th>Apellido y nombre</th>
                      <th>DNI</th>
                      <th>Ingresa a</th>
                      <th>Matrícula</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      <th className="ing-actions-col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id_ingresante}>
                        <td data-label="Alumno">
                          <strong>{row.apellido} {row.nombre}</strong>
                          {row.observaciones ? <small>{row.observaciones}</small> : null}
                        </td>
                        <td data-label="DNI" className="ing-mono">{row.dni}</td>
                        <td data-label="Ingresa a">
                          <span className="ing-year-badge">{row.anio_ingreso}° año</span>
                        </td>
                        <td data-label="Matrícula">
                          {Number(row.matricula_pagada) === 1 ? (
                            <span className="ing-paid"><FaCheckCircle /> Pagada</span>
                          ) : (
                            <span className="ing-pending">Pendiente</span>
                          )}
                        </td>
                        <td data-label="Monto">{formatMoney(row.monto_matricula)}</td>
                        <td data-label="Fecha">{formatDate(row.fecha_inscripcion)}</td>
                        <td data-label="Acciones" className="ing-actions-col">
                          {!isReadOnly ? (
                            <div className="ing-row-actions">
                              <button className="ing-icon-btn edit" onClick={() => openEdit(row)} title="Editar" aria-label="Editar">
                                <FaEdit />
                              </button>
                              <button className="ing-icon-btn delete" onClick={() => setDeleteTarget(row)} title="Eliminar" aria-label="Eliminar">
                                <FaTrash />
                              </button>
                            </div>
                          ) : (
                            <span className="ing-readonly">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="ing-footer">
        <button className="ing-btn ing-btn-secondary" onClick={() => navigate('/alumnos')}>
          <FaArrowLeft />
          Volver a Alumnos
        </button>
      </footer>

      {modalOpen && (
        <div className="ing-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <div className="ing-modal" role="dialog" aria-modal="true" aria-labelledby="ing-modal-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="ing-modal-head">
              <div>
                <span>{form.id_ingresante ? 'Editar registro' : 'Registro provisorio'}</span>
                <h2 id="ing-modal-title">{form.id_ingresante ? 'Editar ingresante' : 'Nuevo ingresante'}</h2>
              </div>
              <button type="button" className="ing-close" onClick={closeModal} aria-label="Cerrar">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={save} className="ing-form">
              <div className="ing-form-grid">
                <label>
                  <span>Apellido *</span>
                  <input name="apellido" value={form.apellido} onChange={handleChange} maxLength={100} autoFocus required />
                </label>

                <label>
                  <span>Nombre *</span>
                  <input name="nombre" value={form.nombre} onChange={handleChange} maxLength={100} required />
                </label>

                <label>
                  <span>DNI *</span>
                  <input
                    name="dni"
                    value={form.dni}
                    onChange={(e) => setForm((prev) => ({ ...prev, dni: soloDigitos(e.target.value) }))}
                    inputMode="numeric"
                    maxLength={20}
                    required
                  />
                </label>

                <label>
                  <span>Ingresa a *</span>
                  <select name="anio_ingreso" value={form.anio_ingreso} onChange={handleChange}>
                    <option value="1">1° año</option>
                    <option value="2">2° año</option>
                  </select>
                </label>

                <label className="ing-check-card">
                  <input
                    type="checkbox"
                    name="matricula_pagada"
                    checked={form.matricula_pagada}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>Matrícula pagada</strong>
                    <small>Queda marcada por defecto.</small>
                  </span>
                </label>

                <label>
                  <span>Monto matrícula</span>
                  <input
                    name="monto_matricula"
                    value={form.monto_matricula}
                    onChange={(e) => setForm((prev) => ({ ...prev, monto_matricula: soloDigitos(e.target.value) }))}
                    inputMode="numeric"
                    disabled={!form.matricula_pagada}
                  />
                  <small className="ing-help">Actual configurado: {formatMoney(montoActual)}</small>
                </label>
              </div>

              <label className="ing-observations">
                <span>Observaciones</span>
                <textarea name="observaciones" value={form.observaciones} onChange={handleChange} maxLength={255} rows={3} />
              </label>

              <div className="ing-cycle-note">
                Este registro queda guardado como ingresante del ciclo <strong>{CICLO_LECTIVO}</strong> y no crea un alumno definitivo.
              </div>

              <div className="ing-modal-actions">
                <button type="button" className="ing-btn ing-btn-secondary" onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="ing-btn ing-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : form.id_ingresante ? 'Guardar cambios' : 'Registrar ingresante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="ing-modal-backdrop" role="presentation" onMouseDown={() => setDeleteTarget(null)}>
          <div className="ing-confirm" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="ing-confirm-icon"><FaTrash /></div>
            <h2>Eliminar ingresante</h2>
            <p>
              ¿Eliminar a <strong>{deleteTarget.apellido} {deleteTarget.nombre}</strong> del registro provisorio?
            </p>
            <div className="ing-modal-actions">
              <button className="ing-btn ing-btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="ing-btn ing-btn-danger" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
