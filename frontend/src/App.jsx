// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "./api";

import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import BookAppointment from "./pages/BookAppointment.jsx";
import AdminAppointments from "./pages/AdminAppointments.jsx";
import AdminDataRecords from "./pages/AdminDataRecords.jsx";
import AdminAppointmentBooking from "./pages/AdminAppointmentBooking.jsx";

import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AdminRegister from "./pages/AdminRegister.jsx";

import MyBills from "./pages/MyBills.jsx";
import DiagnosticImages from "./pages/DiagnosticImages.jsx";
import DiagnosticResults from "./pages/DiagnosticResults.jsx";
import Radiographs from "./pages/Radiographs.jsx";
import ReportView from "./pages/ReportView.jsx";

import SuperAdminPanel from "./pages/SuperAdminPanel.jsx";

// ✅ NEW: Admin report page
import AdminReportView from "./pages/AdminReportView.jsx";

/* ---------------- Helpers ---------------- */
function getRoleClean(me) {
  return String(me?.role || me?.userType || "").trim().toLowerCase();
}
function isAdminRole(me) {
  const r = getRoleClean(me);
  return r === "admin" || r === "superadmin";
}
function isSuperAdminRole(me) {
  const r = getRoleClean(me);
  return r === "superadmin";
}
function getAnyToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

/* ---------------- Guards ---------------- */
function ProtectedRoute({ children }) {
  const any = getAnyToken();
  if (!any) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const adminToken = localStorage.getItem("adminToken");
      const token = localStorage.getItem("token");

      // ✅ Prefer adminToken validation
      if (adminToken) {
        try {
          await apiGet("/api/admin/auth/me", adminToken);
          if (mounted) setState({ loading: false, ok: true });
          return;
        } catch {
          localStorage.removeItem("adminToken");
        }
      }

      // Fallback to normal token role check
      if (!token) {
        if (mounted) setState({ loading: false, ok: false });
        return;
      }

      try {
        const me = await apiGet("/api/auth/me", token);
        if (mounted) setState({ loading: false, ok: isAdminRole(me) });
      } catch {
        if (mounted) setState({ loading: false, ok: false });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Checking access...</div>;
  }

  if (!state.ok) return <Navigate to="/profile" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false, error: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const adminToken = localStorage.getItem("adminToken");
      const token = localStorage.getItem("token");

      if (adminToken) {
        try {
          const me = await apiGet("/api/admin/auth/me", adminToken);
          if (mounted) setState({ loading: false, ok: isSuperAdminRole(me), error: false });
          return;
        } catch {
          localStorage.removeItem("adminToken");
        }
      }

      if (!token) {
        if (mounted) setState({ loading: false, ok: false, error: true });
        return;
      }

      try {
        const me = await apiGet("/api/auth/me", token);
        if (mounted) setState({ loading: false, ok: isSuperAdminRole(me), error: false });
      } catch {
        if (mounted) setState({ loading: false, ok: false, error: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Checking access...</div>;
  }

  if (state.error) return <Navigate to="/login" replace />;
  if (!state.ok) return <Navigate to="/profile" replace />;
  return children;
}

function PatientRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false, error: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const adminToken = localStorage.getItem("adminToken");
      const token = localStorage.getItem("token");

      // If adminToken is valid -> not a patient
      if (adminToken) {
        try {
          await apiGet("/api/admin/auth/me", adminToken);
          if (mounted) setState({ loading: false, ok: false, error: false });
          return;
        } catch {
          localStorage.removeItem("adminToken");
        }
      }

      if (!token) {
        if (mounted) setState({ loading: false, ok: false, error: true });
        return;
      }

      try {
        const me = await apiGet("/api/auth/me", token);
        const ok = !isAdminRole(me);
        if (mounted) setState({ loading: false, ok, error: false });
      } catch {
        if (mounted) setState({ loading: false, ok: false, error: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Checking access...</div>;
  }

  if (state.error) return <Navigate to="/login" replace />;
  if (!state.ok) return <Navigate to="/admin/appointments" replace />;
  return children;
}

/* ---------------- Root Redirect ---------------- */
function RootRedirect() {
  const [dest, setDest] = useState(null);

  useEffect(() => {
    const any = getAnyToken();
    setDest(any ? "/profile" : "/login");
  }, []);

  if (!dest) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Loading...</div>;
  }

  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/admin/register" element={<Navigate to="/admin-register" replace />} />

        {/* Shared protected */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />

        {/* Patient booking/history */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute>
              <BookAppointment />
            </ProtectedRoute>
          }
        />
        <Route path="/appointments/book" element={<Navigate to="/appointments" replace />} />

        {/* Superadmin */}
        <Route
          path="/admin/super"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <SuperAdminRoute>
                  <SuperAdminPanel />
                </SuperAdminRoute>
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/superadmin" element={<Navigate to="/admin/super" replace />} />

        {/* Patient-only */}
        <Route
          path="/bills"
          element={
            <ProtectedRoute>
              <PatientRoute>
                <MyBills />
              </PatientRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnostic-images"
          element={
            <ProtectedRoute>
              <PatientRoute>
                <DiagnosticImages />
              </PatientRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnostic-results"
          element={
            <ProtectedRoute>
              <PatientRoute>
                <DiagnosticResults />
              </PatientRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/radiographs"
          element={
            <ProtectedRoute>
              <PatientRoute>
                <Radiographs />
              </PatientRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/report/:appointmentId"
          element={
            <ProtectedRoute>
              <PatientRoute>
                <ReportView />
              </PatientRoute>
            </ProtectedRoute>
          }
        />

        {/* Admin landing */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Navigate to="/admin/appointments" replace />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* Admin-only */}
        <Route
          path="/admin/appointments"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminAppointments />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/appointment-booking"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminAppointmentBooking />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/data-records"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminDataRecords />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* ✅ THIS is the missing piece that stops redirect-to-profile */}
        <Route
          path="/admin/report/:appointmentId"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminReportView />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* Aliases */}
        <Route
          path="/admin/appointment-approval"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Navigate to="/admin/appointments" replace />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/admin-information"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Navigate to="/profile/edit" replace />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}