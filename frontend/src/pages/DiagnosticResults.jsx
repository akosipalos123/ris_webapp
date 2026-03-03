// frontend/src/pages/DiagnosticResults.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function normalizeFileUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return `${API_URL}/${u}`;
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

/* ---------- HELPERS ---------- */
function apptToYMD(a) {
  // preferred (no timezone ambiguity)
  if (a?.year && a?.month && a?.day) {
    return `${String(a.year)}-${String(a.month).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`;
  }

  // fallback: ISO string date => slice first 10 chars (stable)
  if (a?.date) {
    const s = String(a.date);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    const d = new Date(a.date);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return "";
}

function formatMDY(a) {
  const ymd = apptToYMD(a);
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

export default function DiagnosticResults() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [appointments, setAppointments] = useState([]);

  // header profile dropdown
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // sidebar
  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebar = () => setSideOpen((v) => !v);

  // filters
  const [filters, setFilters] = useState({
    status: "All",
    procedure: "All",
    date: "",
  });

  // modal
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  async function loadAll() {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setLoading(true);
      setMsg("");

      // profile for header + role checks
      try {
        const me = await apiGet("/api/auth/me", token);
        setProfile(me);
      } catch {
        // ignore
      }

      // completed appointments only
      const data = await apiGet("/api/appointments/mine-filtered?status=Completed", token);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg(err.message || "Failed to load results");
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

  // close modal on ESC
  useEffect(() => {
    if (!viewOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setViewOpen(false);
        setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewOpen]);

  function logout() {
    setMenuOpen(false);
    localStorage.removeItem("token");
    nav("/login");
  }

  function onFilterChange(e) {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  }

  function resetFilters() {
    setFilters({ status: "All", procedure: "All", date: "" });
  }

  function openViewModal(a) {
    setSelected(a);
    setViewOpen(true);
  }

  function closeViewModal() {
    setViewOpen(false);
    setSelected(null);
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

  const statusOptions = useMemo(() => {
    const s = new Set();
    for (const a of appointments) if (a?.status) s.add(a.status);
    return ["All", ...Array.from(s)];
  }, [appointments]);

  const procedureOptions = useMemo(() => {
    const s = new Set();
    for (const a of appointments) if (a?.procedure) s.add(a.procedure);
    return ["All", ...Array.from(s)];
  }, [appointments]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (filters.status !== "All" && String(a?.status || "") !== filters.status) return false;
      if (filters.procedure !== "All" && String(a?.procedure || "") !== filters.procedure) return false;

      if (filters.date) {
        const ymd = apptToYMD(a);
        if (!ymd) return false;
        if (ymd !== filters.date) return false;
      }
      return true;
    });
  }, [appointments, filters]);

  // modal file url
  const pdfUrl = useMemo(() => {
    if (!selected) return "";
    const raw = selected.resultPdfUrl || selected.resultPdfPath || selected.pdfUrl || selected.pdf || "";
    return normalizeFileUrl(raw);
  }, [selected]);

  const pdfIsPdf = useMemo(() => {
    return !!pdfUrl && pdfUrl.toLowerCase().includes(".pdf");
  }, [pdfUrl]);

  /* ---------- ROLE (PATIENT vs ADMIN) ---------- */
  const isAdmin = profile?.role === "admin" || profile?.userType === "admin" || profile?.isAdmin === true;
  const idLabel = isAdmin ? "Admin ID" : "Patient ID";

  /* ---------- SIDEBAR ITEMS ---------- */
  const PATIENT_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon },
    { label: "My Bills", to: "/bills", IconComp: BillsIcon },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  // ✅ aligned with your current App.jsx routes
  // (Icons can be reused; only labels change is OK)
  const ADMIN_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon, exact: true },
    { label: "Appointment Booking", to: "/appointments", IconComp: CalendarIcon }, // admin can book here
    { label: "Data Records", to: "/admin/data-records", IconComp: ResultsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  const SIDE_ITEMS = isAdmin ? ADMIN_SIDE_ITEMS : PATIENT_SIDE_ITEMS;

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  /* ---------- STYLES (patterned to screenshot) ---------- */
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
    padding: "0 24px 16px", // ✅ no top white space
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  };

  const topbar = {
    height: 84,
    borderRadius: "0 0 22px 22px", // ✅ flush to top
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

  const content = { flex: "1 1 auto", overflow: "auto", paddingRight: 4 };
  const contentWrap = { maxWidth: 1180 };

  const msgBox = {
    padding: "10px 12px",
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    borderRadius: 12,
    marginBottom: 12,
    color: "#0f172a",
    fontWeight: 800,
  };

  // Filters row
  const filterRow = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    marginTop: 6,
  };

  const filtersGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 36,
    flex: 1,
    minWidth: 0,
  };

  const filterLabel = { fontSize: 22, fontWeight: 900, color: DARK, marginBottom: 8 };

  const filterControl = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 2,
    border: `2px solid ${DARK}`,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    fontSize: 18,
    outline: "none",
  };

  const dateWrap = { position: "relative" };
  const dateIcon = {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#fff",
    opacity: 0.9,
    pointerEvents: "none",
  };

  const topBtns = { display: "flex", gap: 12, paddingTop: 26, flex: "0 0 auto" };

  const topBtn = (disabled) => ({
    background: "#fff",
    color: DARK,
    border: `2px solid ${DARK}`,
    borderRadius: 2,
    padding: "8px 14px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  });

  // Big panel/table
  const panel = {
    marginTop: 16,
    borderRadius: 34,
    border: `4px solid ${DARK}`,
    background: "#fff",
    padding: "16px 18px 14px",
    minHeight: 560,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const panelTop = {
    display: "flex",
    justifyContent: "flex-end",
    padding: "2px 6px 8px",
    flex: "0 0 auto",
  };

  const panelRefreshBtn = (disabled) => ({
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
    gridTemplateColumns: "1.1fr 2fr 0.9fr",
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
    gridTemplateColumns: "1.1fr 2fr 0.9fr",
    gap: 14,
    padding: "12px 12px",
    alignItems: "center",
    borderBottom: "2px solid rgba(0,0,0,.35)",
    fontWeight: 800,
    color: "#0f172a",
  };

  const viewBtn = {
    width: 200,
    justifySelf: "end",
    padding: "10px 14px",
    borderRadius: 0,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    cursor: "pointer",
  };

  /* ---------- MODAL ---------- */
  const overlay = {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    zIndex: 3000,
    display: "grid",
    placeItems: "center",
    padding: 18,
  };

  const modal = {
    width: "min(980px, 96%)",
    height: "min(680px, 92vh)",
    background: `linear-gradient(180deg, ${DARK} 0%, #1c5a41 100%)`,
    borderRadius: 22,
    boxShadow: "0 22px 60px rgba(0,0,0,.35)",
    padding: "18px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    color: "#fff",
  };

  const modalTitle = { margin: 0, textAlign: "center", fontWeight: 900, fontSize: 32, lineHeight: 1.1 };
  const modalSub = { textAlign: "center", marginTop: -6, opacity: 0.9, fontWeight: 800, fontSize: 13 };

  const modalBody = { flex: 1, overflow: "auto", padding: "6px 6px 0" };

  const infoGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  };

  const infoCard = {
    border: "2px solid rgba(255,255,255,.22)",
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(255,255,255,.06)",
  };

  const infoLabel = { fontWeight: 900, fontSize: 12, opacity: 0.9 };
  const infoValue = { fontWeight: 900, fontSize: 16, marginTop: 2 };

  const notesBox = {
    border: "2px solid rgba(255,255,255,.22)",
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(255,255,255,.06)",
    lineHeight: 1.5,
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  };

  const previewOuter = {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    border: "2px solid rgba(255,255,255,.22)",
    background: "#fff",
    height: 340,
  };

  const modalFooter = {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    paddingTop: 6,
    flexWrap: "wrap",
  };

  const footerBtn = {
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };

  const closeBtn = {
    ...footerBtn,
    background: "transparent",
    border: "2px solid rgba(255,255,255,.75)",
    color: "#fff",
  };

  const primaryLinkBtn = {
    ...footerBtn,
    background: "#fff",
    border: "2px solid rgba(255,255,255,.9)",
    color: "#0f172a",
  };

  const darkLinkBtn = {
    ...footerBtn,
    background: DARK,
    border: `2px solid ${DARK}`,
    color: "#fff",
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
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Diagnostic Results</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>View your diagnostic results</div>
            </div>
          </div>

          {/* Dropdown */}
          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>{idLabel}</div>
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
                <div style={ddName}>{fullName || (isAdmin ? "Admin" : "Patient")}</div>
                <div style={ddSub}>{idLabel}</div>
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

        <div style={content}>
          <div style={contentWrap}>
            {msg ? <div style={msgBox}>{msg}</div> : null}

            {/* FILTERS */}
            <div style={filterRow}>
              <div style={filtersGrid}>
                <div>
                  <div style={filterLabel}>Status</div>
                  <select name="status" value={filters.status} onChange={onFilterChange} style={filterControl}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={filterLabel}>Procedure</div>
                  <select name="procedure" value={filters.procedure} onChange={onFilterChange} style={filterControl}>
                    {procedureOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={filterLabel}>Date</div>
                  <div style={dateWrap}>
                    <input
                      type="date"
                      name="date"
                      value={filters.date}
                      onChange={onFilterChange}
                      style={{ ...filterControl, paddingRight: 44 }}
                    />
                    <div style={dateIcon}>📅</div>
                  </div>
                </div>
              </div>

              <div style={topBtns}>
                <button type="button" style={topBtn(loading)} onClick={loadAll} disabled={loading}>
                  Refresh
                </button>
                <button type="button" style={topBtn(false)} onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
            </div>

            {/* RESULTS PANEL */}
            <div style={panel}>
              <div style={panelTop}>
                <button type="button" style={panelRefreshBtn(loading)} onClick={loadAll} disabled={loading}>
                  Refresh
                </button>
              </div>

              <div style={tableHeader}>
                <div>Date</div>
                <div>Procedure</div>
                <div />
              </div>

              <div style={tableBody}>
                {loading ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>No results found.</div>
                ) : (
                  filtered.map((a) => (
                    <div key={a._id} style={row}>
                      <div>{formatMDY(a)}</div>
                      <div>{a.procedure || "-"}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" style={viewBtn} onClick={() => openViewModal(a)}>
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", color: "#94a3b8", fontWeight: 800, marginTop: 14, fontSize: 12 }}>
              RISWebApp • Local Dev
            </div>
          </div>
        </div>

        {/* VIEW MODAL */}
        {viewOpen ? (
          <div style={overlay} onClick={closeViewModal} role="dialog" aria-modal="true" aria-label="Result preview">
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={modalTitle}>Diagnostic Result</h2>
              <div style={modalSub}>Preview your report and attachments</div>

              <div style={modalBody}>
                <div style={infoGrid}>
                  <div style={infoCard}>
                    <div style={infoLabel}>DATE</div>
                    <div style={infoValue}>{selected ? formatMDY(selected) : "-"}</div>
                  </div>
                  <div style={infoCard}>
                    <div style={infoLabel}>PROCEDURE</div>
                    <div style={infoValue}>{selected?.procedure || "-"}</div>
                  </div>
                </div>

                <div style={notesBox}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Notes</div>
                  <div style={{ opacity: 0.95 }}>{selected?.resultNotes ? selected.resultNotes : "—"}</div>
                </div>

                <div style={{ marginTop: 12, fontWeight: 900 }}>Attachment Preview</div>
                <div style={previewOuter}>
                  {pdfUrl ? (
                    pdfIsPdf ? (
                      <iframe title="Result PDF" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                    ) : (
                      <img src={pdfUrl} alt="Result file" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    )
                  ) : (
                    <div style={{ padding: 18, color: "#0f172a", fontWeight: 900 }}>No PDF/attachment available.</div>
                  )}
                </div>
              </div>

              <div style={modalFooter}>
                {selected?._id ? (
                  <Link to={`/report/${selected._id}`} style={darkLinkBtn} onClick={closeViewModal}>
                    Open Full Report
                  </Link>
                ) : null}

                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" style={primaryLinkBtn}>
                    Open PDF
                  </a>
                ) : null}

                <button type="button" style={closeBtn} onClick={closeViewModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}