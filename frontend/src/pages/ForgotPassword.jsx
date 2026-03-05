// frontend/src/pages/ForgotPassword.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";
import "../assets/styles/login.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const sanitizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const data = await apiPost("/api/auth/forgot-password", { email: sanitizedEmail });
      setMsg(data?.message || "If an account exists, a reset link has been sent.");
    } catch (err) {
      setMsg(err?.message || "Failed to request reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="synapse-auth">
      <div className="synapse-card synapse-card--login">
        <h1 className="synapse-title">Forgot password</h1>
        <div className="synapse-subtitle">We’ll email you a reset link.</div>

        {msg ? <div className="synapse-alert">{msg}</div> : null}

        <form onSubmit={onSubmit} className="synapse-form">
          <label className="synapse-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            className="synapse-input"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setMsg("");
            }}
            required
            disabled={loading}
            autoComplete="email"
          />

          <button className="synapse-btn" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <div className="synapse-bottom">
            <Link className="synapse-link" to="/login">Back to login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}