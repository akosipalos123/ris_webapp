// frontend/src/pages/ResetPassword.jsx
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import "../assets/styles/login.css";

export default function ResetPassword() {
  const nav = useNavigate();
  const { search } = useLocation();

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const token = params.get("token") || "";
  const email = (params.get("email") || "").trim().toLowerCase();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!token || !email) {
      setMsg("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiPost("/api/auth/reset-password", {
        email,
        token,
        password,
        confirmPassword,
      });

      setMsg(data?.message || "Password updated.");
      setTimeout(() => nav("/login"), 800);
    } catch (err) {
      setMsg(err?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="synapse-auth">
      <div className="synapse-card synapse-card--login">
        <h1 className="synapse-title">Set new password</h1>
        <div className="synapse-subtitle">
          Resetting for <b>{email || "unknown email"}</b>
        </div>

        {msg ? <div className="synapse-alert">{msg}</div> : null}

        <form onSubmit={onSubmit} className="synapse-form">
          <label className="synapse-label" htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            className="synapse-input"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setMsg("");
            }}
            required
            disabled={loading}
            autoComplete="new-password"
          />

          <label className="synapse-label mt-3" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="synapse-input"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setMsg("");
            }}
            required
            disabled={loading}
            autoComplete="new-password"
          />

          <button className="synapse-btn" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>

          <div className="synapse-bottom">
            <Link className="synapse-link" to="/forgot-password">Request new link</Link>
          </div>
        </form>
      </div>
    </div>
  );
}