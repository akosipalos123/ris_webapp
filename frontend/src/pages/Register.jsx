import { useEffect, useMemo, useState } from "react";
import { apiPost } from "../api";
import { Link, useNavigate } from "react-router-dom";
import "../assets/styles/login.css"; // reuse synapse styles

export default function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState("");

  const emailClean = useMemo(() => form.email.trim().toLowerCase(), [form.email]);

  // ✅ local fallback bg (Vite public)
  // Put file at: frontend/public/images/background.png
  const FALLBACK_BG = `${import.meta.env.BASE_URL}images/background.png`;

  // ✅ default role for any registration coming from this page
  const DEFAULT_ROLE = "patient";

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

  function resetOtpFlow() {
    setOtp("");
    setOtpToken("");
    setOtpSent(false);
    setMsg("");
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  async function sendOtp() {
    setMsg("");
    setLoading(true);

    try {
      if (!emailClean) {
        setMsg("Email is required.");
        return;
      }

      const data = await apiPost("/api/auth/register-otp", { email: emailClean });

      if (!data?.otpToken) {
        throw new Error("OTP session missing. Please try again.");
      }

      setOtpToken(data.otpToken);
      setOtpSent(true);
      setOtp("");
      setMsg(data.message || "OTP sent. Please check your email.");
    } catch (err) {
      setMsg(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setMsg("First name and last name are required.");
        return;
      }
      if (!emailClean) {
        setMsg("Email is required.");
        return;
      }
      if (!form.password) {
        setMsg("Password is required.");
        return;
      }
      if (form.password.length < 8) {
        setMsg("Password must be at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setMsg("Passwords do not match.");
        return;
      }
      if (!otpSent || !otpToken) {
        setMsg("Please click Send to get your OTP first.");
        return;
      }

      const otpClean = String(otp || "").replace(/\D/g, "").slice(0, 6);
      if (otpClean.length !== 6) {
        setMsg("Please enter the 6-digit OTP.");
        return;
      }

      const data = await apiPost("/api/auth/register", {
        otpToken,
        otp: otpClean,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: emailClean,
        password: form.password,

        // ✅ ensure new registrations from this page are patients by default
        role: DEFAULT_ROLE,
      });

      if (!data?.token) throw new Error("Register token missing. Please try again.");

      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (err) {
      setMsg(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="synapse-auth" style={{ backgroundImage: `url("${bgUrl || FALLBACK_BG}")` }}>
      {/* Brand at top */}
      <div className="synapse-brand top">
        <div className="synapse-brand-mark" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="synapse-brand-name">AXIS</div>
      </div>

      <div className="synapse-card">
        <h1 className="synapse-title" style={{ fontSize: 46 }}>
          Register
        </h1>
        <div className="synapse-subtitle">Fill out the information to sign up.</div>

        {msg ? <div className="synapse-alert">{msg}</div> : null}

        <form onSubmit={onSubmit} className="synapse-form" style={{ width: "100%" }}>
          {/* Row: First / Last */}
          <div className="synapse-grid-2">
            <div className="synapse-col">
              <label className="synapse-label" htmlFor="firstName">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                className="synapse-input"
                placeholder="Enter your first name"
                value={form.firstName}
                onChange={onChange}
                disabled={loading}
                required
                autoComplete="given-name"
              />
            </div>

            <div className="synapse-col">
              <label className="synapse-label" htmlFor="lastName">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                className="synapse-input"
                placeholder="Enter your last name"
                value={form.lastName}
                onChange={onChange}
                disabled={loading}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          {/* Row: Email + OTP */}
          <div className="synapse-grid-2" style={{ marginTop: 12 }}>
            {/* Email + Send */}
            <div className="synapse-col">
              <label className="synapse-label" htmlFor="email">
                Email Address
              </label>

              <div className="synapse-otp-row">
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="synapse-input"
                  placeholder="Enter your email address"
                  value={form.email}
                  onChange={onChange}
                  disabled={loading || otpSent}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    borderRight: "none",
                    borderRadius: "12px 0 0 12px",
                  }}
                />

                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={loading || !emailClean}
                  className="synapse-btn synapse-btn-mini"
                  style={{
                    width: "100%",
                    height: 46,
                    marginTop: 0,
                    borderRadius: "0 12px 12px 0",
                  }}
                >
                  {otpSent ? "Resend" : "Send"}
                </button>
              </div>

              {otpSent ? (
                <button
                  type="button"
                  className="synapse-btn synapse-btn-mini"
                  onClick={resetOtpFlow}
                  disabled={loading}
                  style={{ marginTop: 10, width: "fit-content" }}
                >
                  Change email
                </button>
              ) : null}
            </div>

            {/* OTP */}
            <div className="synapse-col">
              <label className="synapse-label" htmlFor="otp">
                One-Time Password (OTP)
              </label>
              <input
                id="otp"
                name="otp"
                className="synapse-input"
                placeholder="Enter the OTP"
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(v);
                  setMsg("");
                }}
                disabled={loading || !otpSent}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <div className="synapse-help">
                {otpSent ? `Enter the code sent to ${emailClean}.` : "Click Send to receive your OTP."}
              </div>
            </div>
          </div>

          {/* Password */}
          <label className="synapse-label" htmlFor="password" style={{ marginTop: 12 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="synapse-input"
            placeholder="Enter your password"
            value={form.password}
            onChange={onChange}
            disabled={loading}
            required
            autoComplete="new-password"
          />
          <div className="synapse-help">Must be at least eight (8) characters.</div>

          {/* Confirm */}
          <label className="synapse-label" htmlFor="confirmPassword" style={{ marginTop: 6 }}>
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="synapse-input"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={onChange}
            disabled={loading}
            required
            autoComplete="new-password"
          />

          <button className="synapse-btn" style={{ marginTop: 18 }} disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>

          <div className="synapse-bottom" style={{ marginTop: 14 }}>
            <span>Already have an account?</span>{" "}
            <Link className="synapse-link" to="/login">
              Sign In
            </Link>
          </div>
        </form>
      </div>

      <div className="synapse-footer">
        <div>© 2026 All Rights Reserved</div>
        <div className="synapse-footer-link">Contact Us</div>
        <div className="synapse-footer-icons">
          <span className="item">✉ slsu.radiology@gmail.com</span>
          <span className="sep">•</span>
          <span className="item">ⓕ SLSU Radiology</span>
          <span className="sep">•</span>
          <span className="item">☎ (042)540-6638</span>
        </div>
      </div>
    </div>
  );
}