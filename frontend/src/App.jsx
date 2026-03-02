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

// ✅ NEW: Admin invite registration page
import AdminRegister from "./pages/AdminRegister.jsx";

// NEW PAGES (make sure these files exist)
import MyBills from "./pages/MyBills.jsx";
import DiagnosticImages from "./pages/DiagnosticImages.jsx";
import DiagnosticResults from "./pages/DiagnosticResults.jsx";
import Radiographs from "./pages/Radiographs.jsx";
import ReportView from "./pages/ReportView.jsx";

// ✅ NEW: Super Admin Panel page
import SuperAdminPanel from "./pages/SuperAdminPanel.jsx";

// ✅ ONLY THESE EMAILS CAN ACCESS superadmin panel
const SUPER_ADMIN_EMAILS = new Set(
  ["rondelserrano1@gmail.com", "cambsrt.slsu@gmail.com"].map((e) => e.toLowerCase())
);

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setState({ loading: false, ok: false });
        return;
      }
      try {
        const me = await apiGet("/api/auth/me", token);
        if (mounted) setState({ loading: false, ok: !!me?.isAdmin });
      } catch {
        if (mounted) setState({ loading: false, ok: false });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">
        Checking access...
      </div>
    );
  }

  if (!state.ok) return <Navigate to="/profile" replace />;

  return children;
}

/** ✅ Superadmin-only route (ONLY 2 emails) */
function SuperAdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false, error: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setState({ loading: false, ok: false, error: true });
        return;
      }

      try {
        const me = await apiGet("/api/auth/me", token);
        const email = String(me?.email || "").trim().toLowerCase();

        const ok = !!me?.isAdmin && SUPER_ADMIN_EMAILS.has(email);
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
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">
        Checking access...
      </div>
    );
  }

  if (state.error) return <Navigate to="/login" replace />;
  if (!state.ok) return <Navigate to="/profile" replace />;

  return children;
}

/** ✅ Patient-only route (blocks admins) */
function PatientRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false, error: false });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setState({ loading: false, ok: false, error: true });
        return;
      }
      try {
        const me = await apiGet("/api/auth/me", token);
        // patient-only means NOT admin
        if (mounted) setState({ loading: false, ok: !me?.isAdmin, error: false });
      } catch {
        if (mounted) setState({ loading: false, ok: false, error: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">
        Checking access...
      </div>
    );
  }

  if (state.error) return <Navigate to="/login" replace />;

  // if admin tries to access patient-only pages, send them to admin area
  if (!state.ok) return <Navigate to="/admin/appointments" replace />;

  return children;
}

// ✅ smart landing route (root decides where to go)
function RootRedirect() {
  const [dest, setDest] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setDest("/login");
        return;
      }
      try {
        await apiGet("/api/auth/me", token);
        if (!mounted) return;
        setDest("/profile");
      } catch {
        if (mounted) setDest("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!dest) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">
        Loading...
      </div>
    );
  }

  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root smart redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* ✅ Public invite-based admin registration */}
        <Route path="/admin/register" element={<AdminRegister />} />

        {/* Shared protected routes */}
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

        {/* both patient and admin can book appointments */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute>
              <BookAppointment />
            </ProtectedRoute>
          }
        />
        <Route path="/appointments/book" element={<Navigate to="/appointments" replace />} />

        {/* ✅ SUPERADMIN PANEL (real route) */}
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

        {/* ✅ alias for old direct link */}
        <Route path="/superadmin" element={<Navigate to="/admin/super" replace />} />

        {/* ✅ PATIENT-ONLY PAGES */}
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

        {/* ✅ Admin landing route */}
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
          path="/admin/data-records"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminDataRecords />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* OPTIONAL: aliases so your sidebar buttons won't 404 */}
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
          path="/admin/appointment-booking"
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
                <Navigate to="/admin/appointments" replace />
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