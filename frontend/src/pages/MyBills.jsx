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

  // number
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  // Mongo Decimal128 sometimes becomes object-like
  if (typeof v === "object") {
    if (typeof v.$numberDecimal === "string") return asNumber(v.$numberDecimal);
    if (typeof v.toString === "function") return asNumber(v.toString());
    return 0;
  }

  // string (handles "200.00", "₱200.00", "Php 200.00", "200,000.00")
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.-]/g, ""); // strip currency, commas, spaces
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
  // Prefer the procedure actually billed (label), fall back to old fields
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
  // Prefer explicit totals, else billing amount, else sum items
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

export default function MyBills() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [bills, setBills] = useState([]);

  // profile (topbar)
  const [profile, setProfile] = useState(null);

  // top-right dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // sidebar
  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebar = () => setSideOpen((v) => !v);

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

      // ✅ DEBUG (temporary): see what the API really returns
      console.log("✅ /api/bills/mine response:", data);

      // ✅ Support common response shapes: [] OR { bills: [] } OR { data: [] } OR { results: [] }
      const list =
        Array.isArray(data) ? data :
        Array.isArray(data?.bills) ? data.bills :
        Array.isArray(data?.data) ? data.data :
        Array.isArray(data?.results) ? data.results :
        [];

      setBills(list);

      // Optional: show message if empty but API returned something unexpected
      if (!list.length && data && typeof data === "object" && !Array.isArray(data)) {
        console.warn("⚠️ Unexpected bills response shape:", data);
      }
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

  function logout() {
    setMenuOpen(false);
    localStorage.removeItem("token");
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
    if (!profile?._id) return "—";
    return String(profile._id).slice(-8).toUpperCase();
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
      window.print();
      return;
    }

    const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
    if (!w) return;

    const safeUrl = receiptUrl.replace(/"/g, "&quot;");
    const html = `<!doctype html>
<html>
<head>
  <title>Receipt</title>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; background: #fff; }
    img { max-width: 100%; max-height: 100%; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  ${receiptIsPdf ? `<iframe src="${safeUrl}"></iframe>` : `<img src="${safeUrl}" />`}
  <script>
    const kick = () => { try { window.focus(); window.print(); } catch(e) {} };
    setTimeout(kick, 700);
  </script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* ---------- STYLES ---------- */
  const DARK = "#0b3d2e";
  const BG = "#ffffff";

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
    padding: "16px 24px 16px",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const topbar = {
    height: 84,
    borderRadius: 22,
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

  const panelTop = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 8px 8px", flex: "0 0 auto" };

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

  /* ---------- RECEIPT MODAL STYLES ---------- */
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

  const modalFooter = { display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 8px 4px" };

  const printBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 2,
    background: "#fff",
    color: "#0f172a",
    border: "2px solid rgba(0,0,0,.15)",
    fontWeight: 900,
    cursor: "pointer",
  };

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

  return (
    <div style={shell}>
      {/* LEFT SIDEBAR */}
      <aside style={sidebar}>
        <div style={sideHeader}>
          {sideOpen ? (
            <div style={brandRowOpen}>
              <div style={{ color: "#fff" }}>
                <BrandIcon size={22} />
              </div>
              <div style={brandText}>Synapse</div>
            </div>
          ) : (
            <div style={headerBadge} title="Synapse">
              <BrandIcon size={20} />
            </div>
          )}

          {sideOpen ? (
            <button type="button" style={headerBtn} onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse">
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
              <div style={burger} title="Menu" onClick={toggleSidebar}>
                ☰
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>My Bills</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Review your bill status and history</div>
            </div>
          </div>

          {/* Patient dropdown */}
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
                  const billAmount = getBillAmount(b);
                  const billText = money(billAmount);
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
              <div style={previewInner}>
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
              <button type="button" style={printBtn} onClick={printReceipt}>
                <PrintIcon size={18} />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}