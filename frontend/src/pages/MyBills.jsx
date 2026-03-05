// frontend/src/pages/MyBills.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

function asNumber(v) {
  if (v == null) return 0;

  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  if (typeof v === "object") {
    if (typeof v.$numberDecimal === "string") return asNumber(v.$numberDecimal);
    if (typeof v.toString === "function") return asNumber(v.toString());
    return 0;
  }

  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function normalizeFileUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return `${API_URL}/${u}`;
}

// ✅ Robust getters to support old + new bill shapes
function getBillDate(b) {
  const raw = b?.issuedAt || b?.createdAt || b?.updatedAt || b?.date || "";
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "-";
}

function getBillProcedure(b) {
  return (
    b?.billingLabel ||
    b?.billing?.label ||
    b?.billing?.itemLabel ||
    b?.procedureDone ||
    b?.items?.[0]?.label ||
    b?.procedure ||
    b?.service ||
    "-"
  );
}

function getBillAmount(b) {
  if (b?.totalAmount != null) return asNumber(b.totalAmount);
  if (b?.billingAmount != null) return asNumber(b.billingAmount);
  if (b?.billing?.amount != null) return asNumber(b.billing.amount);
  if (b?.amount != null) return asNumber(b.amount);

  const items = Array.isArray(b?.items) ? b.items : [];
  if (items.length) return items.reduce((sum, it) => sum + asNumber(it?.amount ?? it?.fee ?? it?.price), 0);

  return 0;
}

function getBillStatus(b) {
  return b?.status || "Pending";
}

function getReceiptRaw(b) {
  return (
    b?.receiptUrl ||
    b?.receiptPath ||
    b?.receipt ||
    b?.fileUrl ||
    b?.url ||
    b?.invoiceUrl ||
    b?.invoicePath ||
    ""
  );
}

// filename helpers
function filenameFromContentDisposition(cd) {
  if (!cd) return "";
  const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd);
  const fn = (m?.[1] || m?.[2] || m?.[3] || "").trim();
  if (!fn) return "";
  try {
    return decodeURIComponent(fn.replace(/^UTF-8''/i, ""));
  } catch {
    return fn;
  }
}

function filenameFromUrl(u, fallback = "receipt") {
  if (!u) return fallback;
  try {
    const url = new URL(u, window.location.href);
    let name = url.pathname.split("/").pop() || fallback;
    name = decodeURIComponent(name);
    return name || fallback;
  } catch {
    const parts = String(u).split("/");
    return parts[parts.length - 1] || fallback;
  }
}

/* ---------- ICONS (SVG) ---------- */
function Icon({ children, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

const HomeIcon = (p) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.8V21h13V9.8" />
  </Icon>
);

const CalendarIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M8 3v3M16 3v3M3 9h18" />
  </Icon>
);

const BillsIcon = (p) => (
  <Icon {...p}>
    <path d="M6 2h12v20l-2-1-2 1-2-1-2 1-2-1-2 1V2z" />
    <path d="M9 7h6M9 11h6M9 15h6" />
  </Icon>
);

const ResultsIcon = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h6" />
  </Icon>
);

const PatientIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="10" cy="11" r="2" />
    <path d="M7 15c1.6-2 4.4-2 6 0" />
    <path d="M14.5 10.5h4M14.5 14h4" />
  </Icon>
);

const MailIcon = (p) => (
  <Icon {...p}>
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

const PhoneIcon = (p) => (
  <Icon {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6.3 6.3l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z" />
  </Icon>
);

const BrandIcon = (p) => (
  <Icon {...p}>
    <path d="M12 2l9 5-9 5-9-5 9-5z" />
    <path d="M3 7v10l9 5 9-5V7" />
    <path d="M12 12v10" />
  </Icon>
);

const PrintIcon = (p) => (
  <Icon {...p}>
    <path d="M7 8V3h10v5" />
    <rect x="6" y="14" width="12" height="7" />
    <path d="M6 12H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1" />
  </Icon>
);

const DownloadIcon = (p) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
);

/* ---------- HELPERS ---------- */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    setMatches(mql.matches);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export default function MyBills() {
  const nav = useNavigate();
  const loc = useLocation();

  const DARK = "#0b3d2e";
  const BG = "#ffffff";

  const isNarrow = useMediaQuery("(max-width: 1024px)");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [bills, setBills] = useState([]);

  const [profile, setProfile] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // desktop sidebar
  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebarDesktop = () => setSideOpen((v) => !v);

  // mobile/tablet drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  async function loadAll() {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setLoading(true);
      setMsg("");

      try {
        const me = await apiGet("/api/auth/me", token);
        setProfile(me);
      } catch {
        // ignore
      }

      const data = await apiGet("/api/bills/mine", token);

      const list =
        Array.isArray(data) ? data :
        Array.isArray(data?.bills) ? data.bills :
        Array.isArray(data?.data) ? data.data :
        Array.isArray(data?.results) ? data.results :
        [];

      setBills(list);
    } catch (err) {
      setMsg(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close drawer on route change (mobile/tablet)
  useEffect(() => {
    if (isNarrow) setDrawerOpen(false);
  }, [loc.pathname, isNarrow]);

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isNarrow) setDrawerOpen(false);
  }, [isNarrow]);

  // Scroll lock when drawer is open
  useEffect(() => {
    if (!isNarrow) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = drawerOpen ? "hidden" : prev || "";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [drawerOpen, isNarrow]);

  // close dropdown on outside click / ESC
  useEffect(() => {
    if (!menuOpen) return;

    const onDown = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // close receipt modal on ESC
  useEffect(() => {
    if (!receiptOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setReceiptOpen(false);
        setSelectedBill(null);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [receiptOpen]);

  // ✅ When the receipt modal is open, mark the body so @media print can print ONLY the receipt.
  useEffect(() => {
    const cls = "receipt-print-open";
    if (receiptOpen) document.body.classList.add(cls);
    else document.body.classList.remove(cls);

    return () => document.body.classList.remove(cls);
  }, [receiptOpen]);

  function logout() {
    setMenuOpen(false);
    setDrawerOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    nav("/login");
  }

  function openReceipt(b) {
    setSelectedBill(b);
    setReceiptOpen(true);
  }

  function closeReceipt() {
    setReceiptOpen(false);
    setSelectedBill(null);
  }

  const patientIdShort = useMemo(() => {
    if (profile?.bsrtId) return String(profile.bsrtId).trim();
    if (profile?._id) return String(profile._id).slice(-8).toUpperCase();
    return "—";
  }, [profile]);

  const fullName = useMemo(() => {
    if (!profile) return "";
    const base = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(", ");
    return `${base}${profile.suffix ? `, ${profile.suffix}` : ""}`;
  }, [profile]);

  const receiptUrl = useMemo(() => {
    if (!selectedBill) return "";
    return normalizeFileUrl(getReceiptRaw(selectedBill));
  }, [selectedBill]);

  const receiptIsPdf = useMemo(() => {
    return !!receiptUrl && receiptUrl.toLowerCase().includes(".pdf");
  }, [receiptUrl]);

  const selectedSummary = useMemo(() => {
    if (!selectedBill) return null;
    return {
      date: getBillDate(selectedBill),
      procedure: getBillProcedure(selectedBill),
      amount: money(getBillAmount(selectedBill)),
      status: getBillStatus(selectedBill),
    };
  }, [selectedBill]);

  function printReceipt() {
    if (!receiptUrl) {
      setMsg("Receipt file is not available for this bill.");
      return;
    }

    if (receiptIsPdf) {
      const w = window.open(receiptUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        setMsg("Popup blocked. Please allow popups then try again.");
        return;
      }

      const kick = () => {
        try {
          w.focus();
          w.print();
        } catch {}
      };

      try {
        w.onload = kick;
      } catch {}
      setTimeout(kick, 900);
      setTimeout(kick, 1600);
      return;
    }

    window.print();
  }

  async function downloadReceipt() {
    if (!receiptUrl) {
      setMsg("Receipt file is not available for this bill.");
      return;
    }

    const fallbackName = `receipt-${selectedBill?._id ? String(selectedBill._id).slice(-8).toUpperCase() : "file"}`;
    const defaultName = filenameFromUrl(receiptUrl, fallbackName);

    try {
      const res = await fetch(receiptUrl, { method: "GET" });
      if (!res.ok) throw new Error("Download failed");

      const cd = res.headers.get("content-disposition");
      const fromCd = filenameFromContentDisposition(cd);
      const filename = fromCd || defaultName;

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      const a = document.createElement("a");
      a.href = receiptUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  /* ---------- SIDEBAR ITEMS (PATIENT ONLY) ---------- */
  const SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon },
    { label: "My Bills", to: "/bills", IconComp: BillsIcon, exact: true },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon, exact: true },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  const PRINT_CSS = `
    @media print {
      body.receipt-print-open * {
        visibility: hidden !important;
      }

      body.receipt-print-open #receipt-print-area,
      body.receipt-print-open #receipt-print-area * {
        visibility: visible !important;
      }

      body.receipt-print-open #receipt-print-area {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: #fff !important;
        overflow: hidden !important;
      }

      body.receipt-print-open #receipt-print-area iframe,
      body.receipt-print-open #receipt-print-area img {
        width: 100% !important;
        height: 100% !important;
        border: 0 !important;
        display: block !important;
      }

      @page { margin: 0; }
    }
  `;

  /* =========================================================
     NEW LAYOUT (Mobile/Tablet) — uses global .profileShell CSS
     ========================================================= */
  if (isNarrow) {
    const rootClass = ["profileShell", "narrow", drawerOpen ? "drawerOpen" : ""].filter(Boolean).join(" ");

    const billCard = {
      border: `2px solid ${DARK}`,
      borderRadius: 16,
      padding: 12,
      background: "#fff",
      display: "grid",
      gap: 10,
    };

    const statusPillMobile = (statusRaw) => {
      const s = String(statusRaw || "").toLowerCase();
      const isPaid = s === "paid";
      const isPending = s === "pending";

      const bg = isPaid ? "#dcfce7" : isPending ? "#fee2e2" : "#fffbeb";
      const color = isPaid ? "#166534" : isPending ? "#991b1b" : "#92400e";

      return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        background: bg,
        color,
        border: "1px solid rgba(0,0,0,.12)",
        whiteSpace: "nowrap",
      };
    };

    // ✅ Mobile-friendly receipt modal styling
    const mOverlay = {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.55)",
      display: "grid",
      placeItems: "center",
      zIndex: 2200,
      padding: 14,
    };

    const mModal = {
      width: "min(560px, 96vw)",
      height: "min(88vh, 900px)",
      background: "linear-gradient(180deg, rgba(11,61,46,.95) 0%, rgba(47,90,69,.95) 100%)",
      borderRadius: 22,
      boxShadow: "0 26px 70px rgba(0,0,0,.45)",
      padding: "14px 14px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    };

    const mHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
    const mTitle = { margin: 0, color: "#fff", fontWeight: 900, fontSize: 22, lineHeight: 1.1 };
    const mClose = {
      width: 38,
      height: 38,
      borderRadius: 12,
      border: "2px solid rgba(255,255,255,.45)",
      background: "transparent",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
    };

    const mMetaCard = {
      background: "#fff",
      borderRadius: 14,
      padding: "10px 12px",
      border: "2px solid rgba(255,255,255,.18)",
      fontWeight: 900,
      color: "#0f172a",
      display: "grid",
      gap: 6,
    };

    const mMetaRow = { display: "flex", justifyContent: "space-between", gap: 12 };
    const mMetaKey = { opacity: 0.75 };
    const mMetaVal = { textAlign: "right" };

    const mPreviewOuter = { flex: 1, display: "flex", flexDirection: "column" };
    const mPreviewInner = {
      flex: 1,
      background: "#fff",
      borderRadius: 14,
      overflow: "hidden",
      border: "2px solid rgba(255,255,255,.18)",
      display: "grid",
      placeItems: "center",
      minHeight: 260,
    };

    const mPreviewImg = { width: "100%", height: "100%", objectFit: "contain" };

    const mFooter = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
    const mActionBtn = (disabled) => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 12,
      background: "#fff",
      color: "#0f172a",
      border: "2px solid rgba(0,0,0,.15)",
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      width: "100%",
    });

    return (
      <div className={rootClass} style={{ "--dark": DARK, "--bg": BG }}>
        <style>{PRINT_CSS}</style>

        <div className="profileBackdrop" onClick={() => setDrawerOpen(false)} aria-hidden={!drawerOpen} />

        <aside className="profileSidebar" aria-label="Sidebar navigation">
          <div className="sideHeader">
            <div className="brandRow">
              <div className="brandIcon">
                <BrandIcon size={22} />
              </div>
              <div className="brandText">AXIS</div>
            </div>

            <button type="button" className="headerBtn" onClick={() => setDrawerOpen(false)} aria-label="Close menu" title="Close">
              ✕
            </button>
          </div>

          <nav className="navWrap">
            {SIDE_ITEMS.map(({ label, to, IconComp, exact }) => {
              const active = isItemActive(to, exact);
              return (
                <Link
                  key={to}
                  to={to}
                  className={["navLink", active ? "active" : "", "expanded"].filter(Boolean).join(" ")}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="navIcon" aria-hidden="true">
                    <IconComp size={20} />
                  </span>
                  <span className="navLabel">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          <div className="sideFooter">
            <div className="footerRow">
              <MailIcon size={18} />
              <span>slsu.radiology@gmail.com</span>
            </div>
            <div className="footerRow">
              <BrandIcon size={18} />
              <span>SLSU Radiology</span>
            </div>
            <div className="footerRow">
              <PhoneIcon size={18} />
              <span>(042)540-6638</span>
            </div>
          </div>
        </aside>

        <main className="profileMain">
          <header className="topbar">
            <div className="topbarInner">
              <div className="topTitleWrap">
                <button
                  type="button"
                  className="burger"
                  title="Menu"
                  onClick={() => setDrawerOpen((v) => !v)}
                  aria-label="Open menu"
                >
                  ☰
                </button>

                <div>
                  <div className="homeTitle">My Bills</div>
                  <div className="homeSub">Review your bill status and history</div>
                </div>
              </div>

              <div className="rightTop" ref={menuRef}>
                <div className="patientIdWrap">
                  <div className="patientIdLabel">Patient ID</div>
                  <div className="patientIdValue">{patientIdShort}</div>
                </div>

                <button
                  type="button"
                  className="profileToggleBtn"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Account menu"
                >
                  <img src={profile?.avatarUrl || "/default-avatar.png"} alt="Avatar" className="avatar" />
                  <div className="chevronBox">{menuOpen ? "▴" : "▾"}</div>
                </button>

                {menuOpen ? (
                  <div className="dropdown" role="menu" aria-label="Account menu">
                    <div className="ddName">{fullName || "Account"}</div>
                    <div className="ddSub">Patient ID</div>
                    <div className="ddId">{patientIdShort}</div>

                    <div className="ddDivider" />

                    <div className="ddActions">
                      <button type="button" className="ddBtn ddBtnGhost" onClick={logout}>
                        <span aria-hidden="true">⎋</span>
                        Sign Out
                      </button>

                      <Link to="/profile/edit" className="ddBtn ddBtnSolid" onClick={() => setMenuOpen(false)}>
                        <span aria-hidden="true">✎</span>
                        Edit Profile
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {/* ✅ content wrapped in .panel so borders/details remain on phone */}
          <div className="content">
            <div className="contentInner">
              {msg ? <div className="msgWarn">{msg}</div> : null}

              <div className="panel" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button
                    type="button"
                    className="btnOutline"
                    onClick={loadAll}
                    disabled={loading}
                    style={{
                      opacity: loading ? 0.6 : 1,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="muted">Loading...</div>
                ) : bills.length === 0 ? (
                  <div className="muted">No bills found yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {bills.map((b) => {
                      const dateText = getBillDate(b);
                      const procedureText = getBillProcedure(b);
                      const billText = money(getBillAmount(b));
                      const statusText = getBillStatus(b);
                      const receiptExists = !!getReceiptRaw(b);

                      return (
                        <div key={b._id} style={billCard}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>{dateText}</div>
                            <span style={statusPillMobile(statusText)}>{statusText}</span>
                          </div>

                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{procedureText}</div>
                          <div style={{ fontWeight: 900, color: DARK }}>{billText}</div>

                          <button type="button" className="btnPrimary" onClick={() => openReceipt(b)} style={{ width: "100%" }}>
                            {receiptExists ? "View Receipt" : "View Details"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ✅ Mobile receipt modal (improved styling) */}
        {receiptOpen ? (
          <div style={mOverlay} onClick={closeReceipt} role="dialog" aria-modal="true" aria-label="Receipt dialog">
            <div style={mModal} onClick={(e) => e.stopPropagation()}>
              <div style={mHeader}>
                <h2 style={mTitle}>{receiptUrl ? "Your Receipt" : "Bill Details"}</h2>
                <button type="button" style={mClose} onClick={closeReceipt} aria-label="Close receipt">
                  ✕
                </button>
              </div>

              {selectedSummary ? (
                <div style={mMetaCard}>
                  <div style={mMetaRow}>
                    <span style={mMetaKey}>Date</span>
                    <span style={mMetaVal}>{selectedSummary.date}</span>
                  </div>
                  <div style={mMetaRow}>
                    <span style={mMetaKey}>Procedure</span>
                    <span style={mMetaVal}>{selectedSummary.procedure}</span>
                  </div>
                  <div style={mMetaRow}>
                    <span style={mMetaKey}>Amount</span>
                    <span style={mMetaVal}>{selectedSummary.amount}</span>
                  </div>
                  <div style={mMetaRow}>
                    <span style={mMetaKey}>Status</span>
                    <span style={mMetaVal}>{selectedSummary.status}</span>
                  </div>
                </div>
              ) : null}

              <div style={mPreviewOuter}>
                {/* print CSS will print ONLY this area */}
                <div style={mPreviewInner} id="receipt-print-area">
                  {receiptUrl ? (
                    receiptIsPdf ? (
                      <iframe title="Receipt PDF" src={receiptUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                    ) : (
                      <img src={receiptUrl} alt="Receipt" style={mPreviewImg} />
                    )
                  ) : (
                    <div style={{ color: "#64748b", fontWeight: 900 }}>Receipt preview unavailable</div>
                  )}
                </div>
              </div>

              <div style={mFooter}>
                <button type="button" style={mActionBtn(!receiptUrl)} onClick={printReceipt} disabled={!receiptUrl}>
                  <PrintIcon size={18} />
                  Print
                </button>

                <button type="button" style={mActionBtn(!receiptUrl)} onClick={downloadReceipt} disabled={!receiptUrl}>
                  <DownloadIcon size={18} />
                  Download
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* =========================================================
     OLD LAYOUT (Desktop/Laptop) — original inline-styled UI
     ========================================================= */

  const SIDEBAR_OPEN_W = 280;
  const SIDEBAR_CLOSED_W = 78;

  const shell = {
    height: "100vh",
    display: "grid",
    gridTemplateColumns: `${sideOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W}px 1fr`,
    background: BG,
    overflow: "hidden",
    transition: "grid-template-columns 180ms ease",
  };

  const sidebar = {
    background: `linear-gradient(180deg, ${DARK} 0%, ${DARK} 65%, #d36b1f 100%)`,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sideHeader = {
    padding: "14px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: sideOpen ? "space-between" : "flex-start",
    gap: 10,
    borderBottom: "2px solid rgba(255,255,255,.18)",
  };

  const headerBadge = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,.35)",
    background: "transparent",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    userSelect: "none",
  };

  const headerBtn = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,.35)",
    background: "transparent",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    userSelect: "none",
    fontSize: 18,
    lineHeight: 1,
  };

  const brandRowOpen = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
  const brandText = {
    color: "#fff",
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const navWrap = { padding: "12px 12px 0" };

  const navItemOpen = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 800,
    marginBottom: 10,
    background: active ? "#fff" : "rgba(255,255,255,.06)",
    color: active ? DARK : "rgba(255,255,255,.95)",
    border: active ? "2px solid rgba(255,255,255,.95)" : "2px solid rgba(255,255,255,.12)",
  });

  const navItemClosedWrap = { display: "flex", justifyContent: "center", marginBottom: 12, textDecoration: "none" };

  const navIconBtn = (active) => ({
    width: 46,
    height: 46,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: active ? "#fff" : "rgba(255,255,255,.06)",
    color: active ? DARK : "#fff",
    border: active ? `2px solid ${DARK}` : "2px solid rgba(255,255,255,.25)",
  });

  const sideFooter = { padding: "14px 14px 18px", color: "rgba(255,255,255,.92)", fontWeight: 700, fontSize: 12.5 };
  const footerRow = { display: "flex", alignItems: "center", gap: 10, marginTop: 10 };

  const main = {
    padding: "0 24px 16px",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  };

  const topbar = {
    height: 84,
    borderRadius: "0 0 22px 22px",
    background: `linear-gradient(90deg, ${DARK}, #1c5a41)`,
    color: "#fff",
    padding: "16px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    flex: "0 0 auto",
  };

  const topTitleWrap = { display: "flex", alignItems: "center", gap: 14 };

  const burger = {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    border: "2px solid rgba(255,255,255,.35)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    userSelect: "none",
  };

  const rightTop = { display: "flex", alignItems: "center", gap: 12, position: "relative" };

  const patientIdWrap = { textAlign: "right", lineHeight: 1.1 };
  const patientIdLabel = { fontSize: 14, fontWeight: 800 };
  const patientIdValue = { fontSize: 12, opacity: 0.9 };

  const avatar = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid rgba(255,255,255,.9)",
    background: "#fff",
    display: "block",
  };

  const profileToggleBtn = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    border: 0,
    padding: 0,
    color: "#fff",
    cursor: "pointer",
  };

  const chevronBox = {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: "2px solid rgba(255,255,255,.45)",
    lineHeight: 1,
    fontWeight: 900,
    userSelect: "none",
  };

  const dropdown = {
    position: "absolute",
    top: 62,
    right: 0,
    width: 320,
    background: `linear-gradient(180deg, ${DARK} 0%, #1c5a41 100%)`,
    borderRadius: 16,
    padding: "12px 14px",
    border: "2px solid rgba(255,255,255,.22)",
    boxShadow: "0 18px 40px rgba(0,0,0,.28)",
    zIndex: 50,
  };

  const ddName = { fontWeight: 900, fontSize: 16, color: "#fff" };
  const ddSub = { fontSize: 12, color: "rgba(255,255,255,.85)", marginTop: 2 };
  const ddDivider = { height: 2, background: "rgba(255,255,255,.6)", borderRadius: 999, margin: "10px 0 10px" };

  const ddActions = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  const ddBtnBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const ddSignOutBtn = { ...ddBtnBase, background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.75)" };
  const ddEditBtn = { ...ddBtnBase, background: "#fff", color: "#0f172a", border: "2px solid rgba(255,255,255,.9)" };

  const content = { flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" };

  const msgBox = {
    padding: "10px 12px",
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    borderRadius: 12,
    marginBottom: 12,
    color: "#0f172a",
    fontWeight: 800,
    flex: "0 0 auto",
  };

  const panel = {
    flex: "1 1 auto",
    borderRadius: 34,
    border: `4px solid ${DARK}`,
    background: "#fff",
    padding: "18px 18px 14px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const panelTop = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    padding: "0 8px 8px",
    flex: "0 0 auto",
  };

  const refreshBtn = (disabled) => ({
    background: "#fff",
    color: DARK,
    border: `2px solid ${DARK}`,
    borderRadius: 2,
    padding: "6px 14px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  const tableHeader = {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.2fr 0.9fr 0.7fr 0.9fr",
    gap: 14,
    padding: "10px 12px",
    fontWeight: 900,
    color: DARK,
    fontSize: 22,
    borderBottom: "2px solid rgba(0,0,0,.45)",
    flex: "0 0 auto",
  };

  const tableBody = { flex: "1 1 auto", overflowY: "auto", padding: "0 0 6px" };

  const row = {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.2fr 0.9fr 0.7fr 0.9fr",
    gap: 14,
    padding: "12px 12px",
    alignItems: "center",
    borderBottom: "2px solid rgba(0,0,0,.35)",
    fontWeight: 800,
    color: "#0f172a",
  };

  const statusPill = (statusRaw) => {
    const s = String(statusRaw || "").toLowerCase();
    const isPaid = s === "paid";
    const isPending = s === "pending";
    const c = isPaid ? "#0b6b2f" : isPending ? "#b91c1c" : DARK;

    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 18px",
      borderRadius: 2,
      background: "#fff",
      border: `2px solid ${c}`,
      color: c,
      fontWeight: 900,
      minWidth: 90,
    };
  };

  const receiptBtn = (disabled) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 0,
    background: disabled ? "#94a3b8" : DARK,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  });

  /* ---------- RECEIPT MODAL (DESKTOP) ---------- */
  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 2000,
    padding: 18,
  };

  const modal = {
    width: "min(720px, 92vw)",
    height: "min(600px, 86vh)",
    background: "#2f5a45",
    borderRadius: 22,
    boxShadow: "0 22px 60px rgba(0,0,0,.35)",
    padding: "18px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const modalTitle = { margin: 0, textAlign: "center", color: "#fff", fontWeight: 900, fontSize: 30, lineHeight: 1.1 };

  const billMetaCard = {
    background: "#fff",
    borderRadius: 2,
    padding: "10px 12px",
    border: "2px solid rgba(255,255,255,.18)",
    fontWeight: 900,
    color: "#0f172a",
    display: "grid",
    gap: 6,
  };

  const metaRow = { display: "flex", justifyContent: "space-between", gap: 12 };
  const metaKey = { opacity: 0.75 };
  const metaVal = { textAlign: "right" };

  const previewOuter = { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "8px 8px 0" };

  const previewInner = {
    width: "86%",
    height: "100%",
    background: "#fff",
    borderRadius: 2,
    overflow: "hidden",
    border: "2px solid rgba(255,255,255,.18)",
    display: "grid",
    placeItems: "center",
  };

  const previewImg = { width: "100%", height: "100%", objectFit: "contain" };

  const modalFooter = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    padding: "0 8px 4px",
  };

  const actionBtnLight = (disabled) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 2,
    background: "#fff",
    color: "#0f172a",
    border: "2px solid rgba(0,0,0,.15)",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div style={shell}>
      <style>{PRINT_CSS}</style>

      {/* LEFT SIDEBAR */}
      <aside style={sidebar}>
        <div style={sideHeader}>
          {sideOpen ? (
            <div style={brandRowOpen}>
              <div style={{ color: "#fff" }}>
                <BrandIcon size={22} />
              </div>
              <div style={brandText}>AXIS</div>
            </div>
          ) : (
            <div style={headerBadge} title="AXIS">
              <BrandIcon size={20} />
            </div>
          )}

          {sideOpen ? (
            <button type="button" style={headerBtn} onClick={toggleSidebarDesktop} aria-label="Collapse sidebar" title="Collapse">
              ☰
            </button>
          ) : null}
        </div>

        <nav style={navWrap}>
          {SIDE_ITEMS.map(({ label, to, IconComp, exact }) => {
            const active = isItemActive(to, exact);

            if (!sideOpen) {
              return (
                <Link key={to} to={to} style={navItemClosedWrap} title={label}>
                  <div style={navIconBtn(active)}>
                    <IconComp size={20} />
                  </div>
                </Link>
              );
            }

            return (
              <Link key={to} to={to} style={navItemOpen(active)}>
                <IconComp size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {sideOpen ? (
          <div style={sideFooter}>
            <div style={footerRow}>
              <MailIcon size={18} />
              <span>slsu.radiology@gmail.com</span>
            </div>
            <div style={footerRow}>
              <BrandIcon size={18} />
              <span>SLSU Radiology</span>
            </div>
            <div style={footerRow}>
              <PhoneIcon size={18} />
              <span>(042)540-6638</span>
            </div>
          </div>
        ) : null}
      </aside>

      {/* MAIN */}
      <main style={main}>
        {/* TOP BAR */}
        <div style={topbar}>
          <div style={topTitleWrap}>
            {!sideOpen ? (
              <div style={burger} title="Menu" onClick={toggleSidebarDesktop}>
                ☰
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>My Bills</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Review your bill status and history</div>
            </div>
          </div>

          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>Patient ID</div>
              <div style={patientIdValue}>{patientIdShort}</div>
            </div>

            <button
              type="button"
              style={profileToggleBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Account menu"
            >
              <img src={profile?.avatarUrl || "/default-avatar.png"} alt="Avatar" style={avatar} />
              <div style={chevronBox}>{menuOpen ? "▴" : "▾"}</div>
            </button>

            {menuOpen ? (
              <div style={dropdown} role="menu" aria-label="Account menu">
                <div style={ddName}>{fullName || "Patient Name"}</div>
                <div style={ddSub}>Patient ID</div>
                <div style={{ color: "#fff", fontWeight: 900, marginTop: 2 }}>{patientIdShort}</div>

                <div style={ddDivider} />

                <div style={ddActions}>
                  <button type="button" style={ddSignOutBtn} onClick={logout}>
                    <span style={{ fontSize: 16 }}>⎋</span>
                    Sign Out
                  </button>

                  <Link to="/profile/edit" style={ddEditBtn} onClick={() => setMenuOpen(false)}>
                    <span style={{ fontSize: 16 }}>✎</span>
                    Edit Profile
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* CONTENT */}
        <div style={content}>
          {msg ? <div style={msgBox}>{msg}</div> : null}

          <div style={panel}>
            <div style={panelTop}>
              <button type="button" style={refreshBtn(loading)} onClick={loadAll} disabled={loading}>
                Refresh
              </button>
            </div>

            <div style={tableHeader}>
              <div>Date</div>
              <div>Procedure</div>
              <div>Amount</div>
              <div>Status</div>
              <div />
            </div>

            <div style={tableBody}>
              {loading ? (
                <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading...</div>
              ) : bills.length === 0 ? (
                <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>No bills found yet.</div>
              ) : (
                bills.map((b) => {
                  const dateText = getBillDate(b);
                  const procedureText = getBillProcedure(b);
                  const billText = money(getBillAmount(b));
                  const statusText = getBillStatus(b);
                  const receiptExists = !!getReceiptRaw(b);

                  return (
                    <div key={b._id} style={row}>
                      <div>{dateText}</div>
                      <div>{procedureText}</div>
                      <div>{billText}</div>
                      <div>
                        <span style={statusPill(statusText)}>{statusText}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" style={receiptBtn(false)} onClick={() => openReceipt(b)}>
                          {receiptExists ? "View Receipt" : "View Details"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* RECEIPT / DETAILS MODAL */}
      {receiptOpen ? (
        <div style={overlay} onClick={closeReceipt} role="dialog" aria-modal="true" aria-label="Receipt dialog">
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{receiptUrl ? "Your Receipt" : "Bill Details"}</h2>

            {selectedSummary ? (
              <div style={billMetaCard}>
                <div style={metaRow}>
                  <span style={metaKey}>Date</span>
                  <span style={metaVal}>{selectedSummary.date}</span>
                </div>
                <div style={metaRow}>
                  <span style={metaKey}>Procedure</span>
                  <span style={metaVal}>{selectedSummary.procedure}</span>
                </div>
                <div style={metaRow}>
                  <span style={metaKey}>Amount</span>
                  <span style={metaVal}>{selectedSummary.amount}</span>
                </div>
                <div style={metaRow}>
                  <span style={metaKey}>Status</span>
                  <span style={metaVal}>{selectedSummary.status}</span>
                </div>
              </div>
            ) : null}

            <div style={previewOuter}>
              <div style={previewInner} id="receipt-print-area">
                {receiptUrl ? (
                  receiptIsPdf ? (
                    <iframe title="Receipt PDF" src={receiptUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                  ) : (
                    <img src={receiptUrl} alt="Receipt" style={previewImg} />
                  )
                ) : (
                  <div style={{ color: "#64748b", fontWeight: 900 }}>Receipt preview unavailable</div>
                )}
              </div>
            </div>

            <div style={modalFooter}>
              <button type="button" style={actionBtnLight(!receiptUrl)} onClick={printReceipt} disabled={!receiptUrl}>
                <PrintIcon size={18} />
                Print
              </button>

              <button type="button" style={actionBtnLight(!receiptUrl)} onClick={downloadReceipt} disabled={!receiptUrl}>
                <DownloadIcon size={18} />
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}