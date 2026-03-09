import { useEffect, useMemo, useState } from "react";
import { apiPost } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import "../assets/styles/login.css";

export default function Login() {
  const nav = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });

  // ✅ OTP states (patient flow)
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  // background url from backend (same pattern as Register.jsx)
  const [bgUrl, setBgUrl] = useState("");

  const sanitizedEmail = useMemo(
    () => form.email.trim().toLowerCase(),
    [form.email]
  );

  // ✅ local fallback bg (Vite public)
  const FALLBACK_BG = `${import.meta.env.BASE_URL}images/background.png`;

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  // If already logged in:
  // - prefer patient session (token) -> /profile
  // - else admin session (adminToken) -> /admin
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) return nav("/profile");

    const adminToken = localStorage.getItem("adminToken");
    if (adminToken) return nav("/admin");
  }, [nav]);

  // fetch public config (login background) — same as Register.jsx
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

  // ✅ Try admin login first (no OTP for now)
  async function tryAdminLogin() {
    const data = await apiPost("/api/admin/auth/login", {
      email: sanitizedEmail,
      password: form.password,
      keepSignedIn,
    });

    if (!data?.token) throw new Error("Admin login token missing. Please try again.");

    // ✅ prevent mixed sessions
    localStorage.removeItem("token");

    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("adminRole", data.user?.role || "");

    nav("/admin");
  }

  // Patient OTP step 1
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

      // ✅ Patient flow: verify credentials + send OTP
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

  // Patient OTP step 2
  async function verifyOtpAndLogin() {
    setMsg("");
    setLoading(true);

    try {
      if (!otpSent || !otpToken) {
        setMsg("Please click Continue first.");
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

      // ✅ prevent mixed sessions
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");

      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (err) {
      setMsg(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Google login handler
  async function loginWithGoogleCredential(credential) {
    if (!credential) {
      setMsg("Google login failed (missing credential).");
      return;
    }

    // If user was in OTP flow, reset it to avoid UI confusion
    if (otpSent) resetOtpFlow();

    setMsg("");
    setLoading(true);

    try {
      // tokenOverride = null -> ensures NO Authorization header is attached
      const data = await apiPost(
        "/api/auth/google",
        { credential, keepSignedIn },
        null
      );

      if (!data?.token) throw new Error("Login token missing. Please try again.");

      // ✅ If backend supports admin via Google, handle it
      if (data?.isAdmin) {
        localStorage.removeItem("token");
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminRole", data.role || data.user?.role || "");
        nav("/admin");
        return;
      }

      // ✅ Normal patient flow
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (err) {
      setMsg(err.message || "Google login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();

    // If OTP already sent, we're in patient step 2
    if (otpSent) return verifyOtpAndLogin();

    setMsg("");

    if (!sanitizedEmail) {
      setMsg("Please enter your email.");
      return;
    }
    if (!form.password) {
      setMsg("Please enter your password.");
      return;
    }

    // ✅ Step 1: Try admin login first
    setLoading(true);
    let adminLoggedIn = false;

    try {
      await tryAdminLogin();
      adminLoggedIn = true;
      return;
    } catch {
      // Ignore admin failure and fall back to patient OTP
    } finally {
      // Important: only stop loading if we're about to switch to patient OTP request
      if (!adminLoggedIn) setLoading(false);
    }

    // ✅ Step 2: Patient OTP request
    return requestOtp();
  }

  return (
    <div
      className="synapse-auth"
      style={{ backgroundImage: `url("${bgUrl || FALLBACK_BG}")` }}
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

      <div className="synapse-card synapse-card--login">
        <h1 className="synapse-title">Welcome!</h1>
        <div className="synapse-subtitle">Sign in to your account.</div>

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
            autoComplete="email"
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
            autoComplete="current-password"
          />

          {/* ✅ OTP Field (only after OTP is sent) */}
          {otpSent ? (
            <>
              <label className="synapse-label mt-3" htmlFor="otp">
                One-Time Password (OTP)
              </label>

              <div className="synapse-otp-row">
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
                    width: "100%",
                    height: 46,
                    border: "2px solid #0b3d2e",
                    background: "#0b3d2e",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                    borderRadius: 0,
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
                : "Continuing..."
              : otpSent
              ? "Verify & Sign In"
              : "Continue"}
          </button>

          <div className="synapse-divider">
            <span>or</span>
          </div>

          <div className="synapse-social">
            {/* ✅ Google Sign-in */}
            <div
              style={{
                opacity: loading || otpSent ? 0.6 : 1,
                pointerEvents: loading || otpSent ? "none" : "auto",
              }}
              title={!hasGoogleClientId ? "Missing VITE_GOOGLE_CLIENT_ID" : undefined}
            >
              {hasGoogleClientId ? (
                <GoogleLogin
                  onSuccess={(cred) => loginWithGoogleCredential(cred?.credential)}
                  onError={() => setMsg("Google login failed.")}
                  type="icon"
                  shape="circle"
                  theme="outline"
                  size="large"
                />
              ) : (
                <button
                  type="button"
                  className="synapse-social-btn"
                  disabled
                  aria-label="Continue with Google"
                >
                  <span className="g">G</span>
                </button>
              )}
            </div>


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