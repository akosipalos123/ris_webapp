// frontend/src/pages/AdminRegister.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../assets/styles/login.css";

export default function AdminRegister() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const token = sp.get("token") || "";

  const [bgUrl, setBgUrl] = useState("");
  const FALLBACK_BG = `${import.meta.env.BASE_URL}images/background.png`;

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // expected invite shape from backend:
  // { email, expiresAt, role, bsrtId }
  const [invite, setInvite] = useState(null);

  const invitedEmail = useMemo(() => String(invite?.email || ""), [invite]);
  const invitedRole = useMemo(() => String(invite?.role || "admin"), [invite]);

  // ✅ support both keys (old: bsrtAdminId, new: bsrtId)
  const invitedBsrtId = useMemo(
    () => String(invite?.bsrtId || invite?.bsrtAdminId || ""),
    [invite]
  );

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });

  // background config
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/config/public");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.loginBgUrl) setBgUrl(data.loginBgUrl);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // verify invite token on load
  useEffect(() => {
    let mounted = true;

    (async () => {
      setMsg("");

      // ✅ only auto-redirect if there's NO invite token in the URL
      const adminToken = localStorage.getItem("adminToken");
      if (adminToken && !token) return nav("/admin");

      if (!token) {
        setMsg("Missing invite token.");
        return;
      }

      setLoading(true);
      try {
        const data = await apiGet(`/api/admin/invites/verify?token=${encodeURIComponent(token)}`);
        if (!mounted) return;
        setInvite(data);
      } catch (err) {
        if (mounted) setMsg(err.message || "Invite is invalid or expired.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, nav]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (!token) throw new Error("Missing invite token.");
      if (!invitedEmail) throw new Error("Invite not verified. Please refresh the page.");

      if (!form.firstName.trim() || !form.lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      if (!form.password || form.password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      // ✅ backend enforces role + bsrtId from invite
      const data = await apiPost("/api/admin/auth/register", {
        token,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
      });

      if (data?.token) {
        // ✅ Option A: keep one-session approach for the app
        localStorage.setItem("token", data.token);

        // optional legacy keys (won't hurt)
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminRole", data.user?.role || invitedRole || "admin");
        localStorage.setItem("adminEmail", data.user?.email || invitedEmail);

        return nav("/admin");
      }

      nav("/login");
    } catch (err) {
      setMsg(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="synapse-auth" style={{ backgroundImage: `url("${bgUrl || FALLBACK_BG}")` }}>
      <div className="synapse-brand top">
        <div className="synapse-brand-mark" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="synapse-brand-name">AXIS</div>
      </div>

      <div className="synapse-card">
        <h1 className="synapse-title" style={{ fontSize: 40 }}>
          Admin Registration
        </h1>
        <div className="synapse-subtitle">Create your admin account using the invitation link.</div>

        {msg ? <div className="synapse-alert">{msg}</div> : null}

        {loading ? (
          <div className="synapse-help" style={{ marginTop: 10 }}>
            Loading...
          </div>
        ) : !invite ? (
          <div className="synapse-help" style={{ marginTop: 10 }}>
            If this link is valid, the registration form will load here.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="synapse-form" style={{ width: "100%" }}>
            <label className="synapse-label">Invited Email</label>
            <input className="synapse-input" value={invitedEmail} disabled style={{ background: "#f8fafc" }} />

            <label className="synapse-label" style={{ marginTop: 10 }}>
              Invited Role
            </label>
            <input className="synapse-input" value={invitedRole} disabled style={{ background: "#f8fafc" }} />

            <label className="synapse-label" style={{ marginTop: 10 }}>
              Admin ID
            </label>
            <input className="synapse-input" value={invitedBsrtId || "-"} disabled style={{ background: "#f8fafc" }} />

            <div className="synapse-help">
              Expires: {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleString() : "5 days"}
            </div>

            <div className="synapse-grid-2" style={{ marginTop: 12 }}>
              <div className="synapse-col">
                <label className="synapse-label" htmlFor="firstName">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  className="synapse-input"
                  value={form.firstName}
                  onChange={onChange}
                  disabled={loading}
                  required
                />
              </div>

              <div className="synapse-col">
                <label className="synapse-label" htmlFor="lastName">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  className="synapse-input"
                  value={form.lastName}
                  onChange={onChange}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <label className="synapse-label" htmlFor="password" style={{ marginTop: 12 }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="synapse-input"
              value={form.password}
              onChange={onChange}
              disabled={loading}
              required
            />
            <div className="synapse-help">Must be at least eight (8) characters.</div>

            <label className="synapse-label" htmlFor="confirmPassword" style={{ marginTop: 6 }}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="synapse-input"
              value={form.confirmPassword}
              onChange={onChange}
              disabled={loading}
              required
            />

            <button className="synapse-btn" style={{ marginTop: 18 }} disabled={loading}>
              {loading ? "Creating..." : "Create Admin Account"}
            </button>

            <div className="synapse-bottom" style={{ marginTop: 14 }}>
              <span>Already have an account?</span>{" "}
              <Link className="synapse-link" to="/login">
                Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}