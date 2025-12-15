import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RecepcionesPage from "./pages/RecepcionesPage";
import AdminCuentasPage from "./pages/AdminCuentasPage";
import ExperienciaPage from "./pages/ExperienciaPage";

export default function App() {
  return (
    <Routes>
      {/* ✅ Inicio público */}
      <Route path="/" element={<HomePage />} />

      {/* Público */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/experiencia/:key" element={<ExperienciaPage />} />

      {/* ✅ Recepciones: staff */}
      <Route
        path="/recepciones"
        element={
          <ProtectedRoute require="staff">
            <RecepcionesPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ Admin cuentas: solo admin */}
      <Route
        path="/admin-cuentas"
        element={
          <ProtectedRoute require="admin">
            <AdminCuentasPage />
          </ProtectedRoute>
        }
      />

      {/* ✅ fallback → Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
