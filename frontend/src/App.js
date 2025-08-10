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
import AlumnoBaja from './components/Alumnos/AlumnoBaja'; // <- coincide con el archivo

// 💵 Cuotas
import Cuotas from './components/Cuotas/Cuotas';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Inicio />} />

        <Route path="/panel" element={<RutaProtegida componente={<Principal />} />} />
        <Route path="/registro" element={<RutaProtegida componente={<Registro />} />} />

        {/* Rutas de Alumnos */}
        <Route path="/alumnos" element={<RutaProtegida componente={<Alumnos />} />} />
        <Route path="/alumnos/agregar" element={<RutaProtegida componente={<AgregarAlumno />} />} />
        <Route path="/alumnos/editar/:id" element={<RutaProtegida componente={<EditarAlumno />} />} />
        <Route path="/alumnos/baja" element={<RutaProtegida componente={<AlumnoBaja />} />} />

        {/* Rutas de Cuotas */}
        <Route path="/cuotas" element={<RutaProtegida componente={<Cuotas />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function RutaProtegida({ componente }) {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  return usuario ? componente : <Navigate to="/" replace />;
}

export default App;
