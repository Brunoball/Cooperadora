// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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

function App() {
  return (
    <Router>
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
