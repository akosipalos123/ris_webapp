import { useEffect, useMemo, useState } from "react";
import { apiPost } from "../api";
import { Link, useNavigate } from "react-router-dom";
import "../assets/styles/login.css";

export default function Login() {
  const nav = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });

  // ✅ OTP states
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  // ✅ Local background served by Vite from /frontend/public/images/background.png
  const LOCAL_BG = `${import.meta.env.BASE_URL}images/background.png`;

  const sanitizedEmail = useMemo(
    () => form.email.trim().toLowerCase(),
    [form.email]
  );

  // if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) nav("/profile");
  }, [nav]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  function resetOtpFlow() {
    setOtp("");
    setOtpToken("");
    setOtpSent(false);
    setMsg("");
  }

  async function requestOtp() {
    setMsg("");
    setLoading(true);

    try {
      if (!sanitizedEmail) {
        setMsg("Please enter your email.");
        return;
      }
      if (!form.password) {
        setMsg("Please enter your password.");
        return;
      }

      const data = await apiPost("/api/auth/login-otp", {
        email: sanitizedEmail,
        password: form.password,
        keepSignedIn,
      });

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

  async function verifyOtpAndLogin() {
    setMsg("");
    setLoading(true);

    try {
      if (!otpSent || !otpToken) {
        setMsg("Please click Send OTP first.");
        return;
      }

      const otpClean = String(otp || "").replace(/\D/g, "").slice(0, 6);
      if (otpClean.length !== 6) {
        setMsg("Please enter the 6-digit OTP.");
        return;
      }

      const data = await apiPost("/api/auth/login", {
        otpToken,
        otp: otpClean,
        keepSignedIn,
      });

      if (!data?.token) {
        throw new Error("Login token missing. Please try again.");
      }

      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (err) {
      setMsg(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!otpSent) return requestOtp();
    return verifyOtpAndLogin();
  }

  return (
    <div
      className="synapse-auth synapse-auth--narrow"
      style={{ backgroundImage: `url(${LOCAL_BG})` }}
    >
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
        <h1 className="synapse-title">Welcome!</h1>
        <div className="synapse-subtitle">Sign in to your account</div>

        {msg ? <div className="synapse-alert">{msg}</div> : null}

        <form onSubmit={onSubmit} className="synapse-form">
          <label className="synapse-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            className="synapse-input"
            placeholder="Enter your email address"
            value={form.email}
            onChange={onChange}
            required
            disabled={loading || otpSent}
          />

          <label className="synapse-label mt-3" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            className="synapse-input"
            placeholder="Enter your password"
            value={form.password}
            onChange={onChange}
            required
            disabled={loading || otpSent}
          />

          {otpSent ? (
            <>
              <label className="synapse-label mt-3" htmlFor="otp">
                One-Time Password (OTP)
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 92px",
                  gap: 0,
                }}
              >
                <input
                  id="otp"
                  name="otp"
                  className="synapse-input"
                  placeholder="Enter the 6-digit OTP"
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(v);
                    setMsg("");
                  }}
                  disabled={loading}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{ borderRight: "none" }}
                />

                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={loading}
                  style={{
                    height: 46,
                    border: "2px solid #0b3d2e",
                    background: "#0b3d2e",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Resend
                </button>
              </div>

              <div className="synapse-help">
                Enter the code sent to {sanitizedEmail || "your email"}.
              </div>

              <button
                type="button"
                className="synapse-btn synapse-btn-mini"
                onClick={resetOtpFlow}
                disabled={loading}
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                Change email/password
              </button>
            </>
          ) : null}

          <div className="synapse-row">
            <label className="synapse-check">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                disabled={loading}
              />
              <span>Keep me signed in</span>
            </label>

            <Link className="synapse-link" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button className="synapse-btn" disabled={loading}>
            {loading
              ? otpSent
                ? "Verifying..."
                : "Sending OTP..."
              : otpSent
              ? "Verify & Sign In"
              : "Send OTP"}
          </button>

          <div className="synapse-divider">
            <span>or</span>
          </div>

          <div className="synapse-social">
            <button
              type="button"
              className="synapse-social-btn"
              aria-label="Continue with Google"
              disabled={loading}
              onClick={() => setMsg("Google login not wired yet.")}
            >
              <span className="g">G</span>
            </button>
            <button
              type="button"
              className="synapse-social-btn"
              aria-label="Continue with Facebook"
              disabled={loading}
              onClick={() => setMsg("Facebook login not wired yet.")}
            >
              <span className="f">f</span>
            </button>
          </div>

          <div className="synapse-bottom">
            <span>Don't have an account?</span>{" "}
            <Link className="synapse-link" to="/register">
              Register
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