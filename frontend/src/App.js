// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Inicio from './components/Login/Inicio';
import Principal from './components/Principal/Principal';
import Registro from './components/Login/Registro';

// 🧑‍🎓 Alumnos
import Alumnos from './components/Alumnos/Alumno';
import AgregarAlumno from './components/Alumnos/AgregarAlumno';
import EditarAlumno from './components/Alumnos/EditarAlumno';
import AlumnoBaja from './components/Alumnos/AlumnoBaja';

// 💵 Cuotas
import Cuotas from './components/Cuotas/Cuotas';

// 📊 Contable (Dashboard)
import DashboardContable from './components/Contable/DashboardContable';

// 🪪 Tipos de Documento
import TiposDocumentos from './components/TiposDocumentos/TiposDocumentos';

// 🧩 Categorías
import Categorias from './components/Categorias/Categorias';
import CategoriaNueva from './components/Categorias/CategoriaNueva';
import CategoriaEditar from './components/Categorias/CategoriaEditar';

/* =========================================================
   🔒 Cierre de sesión por inactividad (global)
   - Ajustá INACTIVITY_MINUTES a lo que necesites.
   - Escucha mouse/teclado/scroll/toques/visibilidad.
   - Considera sesión si hay token O usuario en localStorage.
========================================================= */
const INACTIVITY_MINUTES = 60; // ⬅️ 1 minuto
const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

function InactivityLogout() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    const hasSession = () => {
      try {
        return !!localStorage.getItem('token') || !!localStorage.getItem('usuario');
      } catch {
        return false;
      }
    };

    const doLogout = () => {
      try { sessionStorage.clear(); } catch {}
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      } catch {}
      navigate('/', { replace: true });
    };

    const resetTimer = () => {
      // No correr timer si no hay sesión o estás en el login
      if (!hasSession()) return;
      if (location.pathname === '/') return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, INACTIVITY_MS);
    };

    const onActivity = () => resetTimer();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetTimer();
    };
    // Soporte multi-pestaña: si en otra pestaña se borra la sesión, cerramos acá también
    const onStorage = (e) => {
      if (e.key === 'token' || e.key === 'usuario') {
        const hasAny = !!localStorage.getItem('token') || !!localStorage.getItem('usuario');
        if (!hasAny) doLogout();
      }
    };

    const events = ['pointermove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Instalar listeners
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    // Arrancar timer al montar / cambiar de ruta
    resetTimer();

    // Limpiar
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [location.pathname, navigate]);

  return null; // no renderiza UI
}

function App() {
  return (
    <Router>
      {/* ⬇️ Activa el cierre por inactividad en toda la app */}
      <InactivityLogout />

      <Routes>
        {/* Login */}
        <Route path="/" element={<Inicio />} />

        {/* Panel y registro */}
        <Route path="/panel" element={<RutaProtegida componente={<Principal />} />} />
        <Route path="/registro" element={<RutaProtegida componente={<Registro />} />} />

        {/* Rutas de Alumnos */}
        <Route path="/alumnos" element={<RutaProtegida componente={<Alumnos />} />} />
        <Route path="/alumnos/agregar" element={<RutaProtegida componente={<AgregarAlumno />} />} />
        <Route path="/alumnos/editar/:id" element={<RutaProtegida componente={<EditarAlumno />} />} />
        <Route path="/alumnos/baja" element={<RutaProtegida componente={<AlumnoBaja />} />} />

        {/* Rutas de Cuotas */}
        <Route path="/cuotas" element={<RutaProtegida componente={<Cuotas />} />} />

        {/* Dashboard Contable */}
        <Route path="/contable" element={<RutaProtegida componente={<DashboardContable />} />} />

        {/* Tipos de Documento */}
        <Route path="/tipos-documentos" element={<RutaProtegida componente={<TiposDocumentos />} />} />

        {/* Categorías */}
        <Route path="/categorias" element={<RutaProtegida componente={<Categorias />} />} />
        <Route path="/categorias/nueva" element={<RutaProtegida componente={<CategoriaNueva />} />} />
        <Route path="/categorias/editar/:id" element={<RutaProtegida componente={<CategoriaEditar />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function RutaProtegida({ componente }) {
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    return usuario ? componente : <Navigate to="/" replace />;
  } catch {
    return <Navigate to="/" replace />;
  }
}

export default App;
