// frontend/src/pages/AdminAppointments.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiUpload, apiPatch } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";

const PROCEDURES = ["X-Ray"];
const STATUSES = ["Pending", "Approved", "Rejected", "Cancelled", "Completed"];

// ✅ Billing catalog (X-Ray)
const XRAY_BILLING_ITEMS = [
  { code: "CHEST_ADULT", label: "Chest — Adult (above 12 y.o.)", fee: 200.0 },
  { code: "CHEST_PEDIA", label: "Chest — Pedia (0 to 12 y.o.)", fee: 240.0 },
  { code: "EXTREMITIES", label: "Extremities (Upper and Lower)", fee: 260.0 },
  { code: "JOINTS", label: "Joints", fee: 260.0 },
  { code: "SKULL", label: "Skull", fee: 300.0 },
  { code: "VERTEBRAL_COLUMN", label: "Vertebral Column", fee: 380.0 },
  { code: "FOREIGN_BODY_LOCALIZATION", label: "Localization of Foreign Body", fee: 260.0 },
  { code: "PELVIS", label: "Pelvis", fee: 300.0 },
  { code: "SHOULDER_GIRDLE", label: "Shoulder Girdle", fee: 240.0 },
  { code: "THORACIC_CAGE", label: "Thoracic Cage", fee: 200.0 },
  { code: "ABDOMEN", label: "Abdomen", fee: 380.0 },
];

function formatPhp(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "Php 0.00";
  return `Php ${num.toFixed(2)}`;
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

const BrandIcon = (p) => (
  <Icon {...p}>
    <path d="M12 2l9 5-9 5-9-5 9-5z" />
    <path d="M3 7v10l9 5 9-5V7" />
    <path d="M12 12v10" />
  </Icon>
);

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

/* ---------- HELPERS ---------- */
function toDateObj(a) {
  if (a?.date) {
    const d = new Date(a.date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (a?.year && a?.month && a?.day) {
    const dt = new Date(Number(a.year), Number(a.month) - 1, Number(a.day));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function safeName(p) {
  if (!p) return "—";
  const first = p.firstName || "";
  const last = p.lastName || "";
  const full = `${first} ${last}`.trim();
  return full || "—";
}

function shortId(id) {
  if (!id) return "—";
  return String(id).slice(-8).toUpperCase();
}

export default function AdminAppointments() {
  const nav = useNavigate();
  const loc = useLocation();

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [adminProfile, setAdminProfile] = useState(null);

  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const [filters, setFilters] = useState({
    status: "All",
    procedure: "All",
    date: "",
  });

  // dropdown / sidebar
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [sideOpen, setSideOpen] = useState(true);

  // ===== Complete modal state (kept) =====
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeAppt, setCompleteAppt] = useState(null);
  const [completePdf, setCompletePdf] = useState(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeSaving, setCompleteSaving] = useState(false);

  // ✅ NEW: Billing state
  const [completeBillingCode, setCompleteBillingCode] = useState("");

  const selectedBilling = useMemo(() => {
    return XRAY_BILLING_ITEMS.find((x) => x.code === completeBillingCode) || null;
  }, [completeBillingCode]);

  function onFilterChange(e) {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "All") params.set("status", filters.status);
    if (filters.procedure && filters.procedure !== "All") params.set("procedure", filters.procedure);
    if (filters.date) params.set("date", filters.date);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [filters]);

  async function ensureAdmin() {
    const token = localStorage.getItem("token");
    if (!token) {
      nav("/login");
      return false;
    }
    try {
      const me = await apiGet("/api/auth/me", token);
      setAdminProfile(me || null);

      if (!me?.isAdmin) {
        nav("/profile");
        return false;
      }
      return true;
    } catch (err) {
      setMsg(err.message || "Failed to validate admin session");
      nav("/login");
      return false;
    }
  }

  async function load() {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setLoading(true);
      setMsg("");
      const data = await apiGet(`/api/admin/appointments${queryString}`, token);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg(err.message || "Request failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setCheckingAdmin(true);
      const ok = await ensureAdmin();
      setCheckingAdmin(false);
      if (ok) load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  useEffect(() => {
    if (checkingAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString, checkingAdmin]);

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

  function logout() {
    setMenuOpen(false);
    localStorage.removeItem("token");
    nav("/login");
  }

  async function setStatus(apptId, status) {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    if (status === "Cancelled") {
      const ok = window.confirm("Cancel this appointment?");
      if (!ok) return;
    }
    if (status === "Rejected") {
      const ok = window.confirm("Reject this appointment?");
      if (!ok) return;
    }

    try {
      setSavingId(apptId);
      setMsg("");
      await apiPatch(`/api/admin/appointments/${apptId}/status`, token, { status });
      await load();
    } catch (err) {
      setMsg(err.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  // ===== Complete =====
  function openCompleteModal(appt) {
    setMsg("");
    setCompleteAppt(appt);
    setCompletePdf(null);
    setCompleteNotes("");
    setCompleteBillingCode(""); // ✅ reset billing selection
    setShowCompleteModal(true);
  }

  function closeCompleteModal() {
    if (completeSaving) return;
    setShowCompleteModal(false);
    setCompleteAppt(null);
    setCompletePdf(null);
    setCompleteNotes("");
    setCompleteBillingCode(""); // ✅ reset billing selection
  }

  async function submitComplete() {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");
    if (!completeAppt?._id) return;

    if (!completeBillingCode) return setMsg("Billing item (procedure done) is required.");
    if (!selectedBilling) return setMsg("Invalid billing selection.");

    if (!completeNotes.trim()) return setMsg("Notes are required.");
    if (!completePdf) return setMsg("Result PDF is required.");
    if (completePdf.type !== "application/pdf") return setMsg("File must be a PDF.");

    const maxBytes = 10 * 1024 * 1024;
    if (completePdf.size > maxBytes) return setMsg("Result PDF is too large (max 10MB).");

    try {
      setCompleteSaving(true);
      setMsg("");

      const fd = new FormData();
      fd.append("resultPdf", completePdf);
      fd.append("notes", completeNotes.trim());

      // ✅ NEW: billing fields (sent with completion)
      fd.append("billingCode", selectedBilling.code);
      fd.append("billingLabel", selectedBilling.label);
      fd.append("billingAmount", selectedBilling.fee.toFixed(2));
      fd.append("billingCurrency", "PHP");

      await apiUpload(`/api/admin/appointments/${completeAppt._id}/complete`, token, fd);

      closeCompleteModal();
      await load();
    } catch (err) {
      setMsg(err.message || "Complete failed");
    } finally {
      setCompleteSaving(false);
    }
  }

  const adminIdShort = useMemo(() => shortId(adminProfile?._id), [adminProfile]);

  const statusOptions = useMemo(() => ["All", ...STATUSES], []);
  const procedureOptions = useMemo(() => ["All", ...PROCEDURES], []);

  const busy = loading || checkingAdmin || completeSaving;

  /* ---------- STYLES (match screenshot / Synapse theme) ---------- */
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
    fontWeight: 900,
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
    position: "relative",
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
  const adminIdWrap = { textAlign: "right", lineHeight: 1.1 };
  const adminIdLabel = { fontSize: 14, fontWeight: 900 };
  const adminIdValue = { fontSize: 12, opacity: 0.9 };

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
  const ddProfileBtn = { ...ddBtnBase, background: "#fff", color: "#0f172a", border: "2px solid rgba(255,255,255,.9)" };

  const content = { flex: "1 1 auto", overflow: "auto", paddingRight: 4 };
  const contentWrap = { maxWidth: 1280 };

  const msgBox = {
    padding: "10px 12px",
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    borderRadius: 12,
    marginBottom: 12,
    color: "#0f172a",
    fontWeight: 800,
  };

  const filtersBar = {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.1fr 1fr auto",
    gap: 18,
    alignItems: "end",
    marginTop: 6,
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

  const filterBtns = { display: "flex", gap: 12, justifyContent: "flex-end", paddingBottom: 2 };

  const filterBtn = (disabled) => ({
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

  const panel = {
    borderRadius: 34,
    border: `4px solid ${DARK}`,
    background: "#fff",
    padding: "18px 18px 14px",
    overflow: "hidden",
  };

  const tablePanel = { ...panel, minHeight: 620, display: "flex", flexDirection: "column", marginTop: 14 };

  const tableHeader = {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.9fr 0.8fr",
    gap: 14,
    padding: "12px 12px",
    fontWeight: 900,
    color: DARK,
    fontSize: 22,
    borderBottom: "2px solid rgba(0,0,0,.45)",
    flex: "0 0 auto",
  };

  const tableBody = { flex: "1 1 auto", overflowY: "auto", padding: "0 0 6px" };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.9fr 0.8fr",
    gap: 14,
    padding: "14px 12px",
    alignItems: "center",
    borderBottom: "2px solid rgba(0,0,0,.35)",
    fontWeight: 800,
    color: "#0f172a",
  };

  const statusSelectStyle = (status, disabled) => {
    let bg = "#fff";
    let color = DARK;
    let border = `2px solid ${DARK}`;

    if (status === "Approved") {
      bg = DARK;
      color = "#fff";
      border = `2px solid ${DARK}`;
    } else if (status === "Pending") {
      bg = "#d5a200";
      color = "#fff";
      border = "2px solid #b88400";
    } else if (status === "Cancelled") {
      bg = "#b91c1c";
      color = "#fff";
      border = "2px solid #991b1b";
    } else if (status === "Rejected") {
      bg = "#dc2626";
      color = "#fff";
      border = "2px solid #b91c1c";
    } else if (status === "Completed") {
      bg = "#fff";
      color = "#0f172a";
      border = `2px solid ${DARK}`;
    }

    return {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 2,
      border,
      background: bg,
      color,
      fontWeight: 900,
      outline: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.7 : 1,
      appearance: "none",
    };
  };

  // Modal styles (Complete)
  const overlay = {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    zIndex: 2000,
    display: "grid",
    placeItems: "center",
    padding: 18,
  };

  const modal = {
    width: "min(980px, 96%)",
    maxHeight: "90vh",
    background: "linear-gradient(180deg, rgba(11,61,46,.92) 0%, rgba(47,90,69,.92) 100%)",
    borderRadius: 26,
    boxShadow: "0 26px 70px rgba(0,0,0,.45)",
    padding: "22px 26px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflow: "hidden",
  };

  const modalHeader = { textAlign: "center", color: "#fff", lineHeight: 1.05, marginTop: 2 };
  const modalTitle = { fontSize: 40, fontWeight: 900, margin: 0 };
  const modalSub = { margin: "6px 0 0", fontSize: 14, opacity: 0.9, fontWeight: 700 };

  const modalInner = { flex: 1, overflow: "auto", paddingRight: 6 };

  const card = {
    background: "#fff",
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,.85)",
    padding: 16,
  };

  const cardLabel = { fontWeight: 900, color: "#0f172a", marginBottom: 8 };

  const inputLight = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    border: `2px solid ${DARK}`,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    outline: "none",
  };

  const textareaLight = { ...inputLight, minHeight: 110, resize: "vertical" };

  const modalBtns = { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 12 };

  const btnDark = (disabled) => ({
    padding: "12px 16px",
    borderRadius: 999,
    background: DARK,
    color: "#fff",
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    minWidth: 180,
  });

  const btnOutline = (disabled) => ({
    padding: "12px 16px",
    borderRadius: 999,
    background: "transparent",
    color: "#fff",
    border: "2px solid rgba(255,255,255,.8)",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    minWidth: 180,
  });

  /* ---------- SIDEBAR ITEMS (UPDATED to match App.jsx routes) ---------- */
  const SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon, exact: true },
    { label: "Appointment Booking", to: "/appointments", IconComp: CalendarIcon }, // admin can book here
    { label: "Data Records", to: "/admin/data-records", IconComp: ResultsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: PatientIcon, exact: true }, // shared EditProfile page
  ];

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  if (checkingAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64748b", fontWeight: 900 }}>
        Checking admin access...
      </div>
    );
  }

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
            <button
              type="button"
              style={headerBtn}
              onClick={() => setSideOpen((v) => !v)}
              aria-label="Collapse sidebar"
              title="Collapse"
            >
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
              <span>✉</span>
              <span>slsu.radiology@gmail.com</span>
            </div>
            <div style={footerRow}>
              <BrandIcon size={18} />
              <span>SLSU Radiology</span>
            </div>
            <div style={footerRow}>
              <span>☎</span>
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
              <div style={burger} title="Menu" onClick={() => setSideOpen(true)}>
                ☰
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Appointment Approval</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Manage and review booking history</div>
            </div>
          </div>

          {/* Admin dropdown */}
          <div style={rightTop} ref={menuRef}>
            <div style={adminIdWrap}>
              <div style={adminIdLabel}>Admin ID</div>
              <div style={adminIdValue}>{adminIdShort}</div>
            </div>

            <button
              type="button"
              style={profileToggleBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Account menu"
            >
              <img src={adminProfile?.avatarUrl || "/default-avatar.png"} alt="Avatar" style={avatar} />
              <div style={chevronBox}>{menuOpen ? "▴" : "▾"}</div>
            </button>

            {menuOpen ? (
              <div style={dropdown} role="menu" aria-label="Account menu">
                <div style={ddName}>{adminProfile?.name || adminProfile?.email || "Admin"}</div>
                <div style={ddSub}>Admin ID</div>
                <div style={{ color: "#fff", fontWeight: 900, marginTop: 2 }}>{adminIdShort}</div>

                <div style={ddDivider} />

                <div style={ddActions}>
                  <button type="button" style={ddSignOutBtn} onClick={logout}>
                    ⎋ Sign Out
                  </button>

                  <Link to="/profile" style={ddProfileBtn} onClick={() => setMenuOpen(false)}>
                    ↩ Profile
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={content}>
          <div style={contentWrap}>
            {msg ? <div style={msgBox}>{msg}</div> : null}

            {/* FILTERS ROW */}
            <div style={filtersBar}>
              <div>
                <div style={filterLabel}>Status</div>
                <select name="status" value={filters.status} onChange={onFilterChange} style={filterControl} disabled={busy}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={filterLabel}>Procedure</div>
                <select
                  name="procedure"
                  value={filters.procedure}
                  onChange={onFilterChange}
                  style={filterControl}
                  disabled={busy}
                >
                  {procedureOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={filterLabel}>Date</div>
                <input
                  type="date"
                  name="date"
                  value={filters.date}
                  onChange={onFilterChange}
                  style={filterControl}
                  disabled={busy}
                />
              </div>

              <div style={filterBtns}>
                <button type="button" style={filterBtn(busy)} onClick={load} disabled={busy}>
                  Refresh
                </button>
                <button
                  type="button"
                  style={filterBtn(false)}
                  onClick={() => setFilters({ status: "All", procedure: "All", date: "" })}
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* TABLE PANEL */}
            <div style={tablePanel}>
              <div style={tableHeader}>
                <div>Patient Name</div>
                <div>Patient ID</div>
                <div>Procedure</div>
                <div>Date</div>
                <div>Actions</div>
              </div>

              <div style={tableBody}>
                {loading ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading appointments...</div>
                ) : rows.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>
                    No appointments found for the selected filters.
                  </div>
                ) : (
                  rows.map((a) => {
                    const patient = a.patientId || {};
                    const patientName = safeName(patient);
                    const patientId = shortId(patient._id);

                    const dt = toDateObj(a);
                    const dateText = dt ? dt.toLocaleDateString() : "-";

                    const isRowBusy = savingId === a._id || completeSaving;

                    return (
                      <div key={a._id} style={rowStyle}>
                        <div>{patientName}</div>
                        <div>{patientId}</div>
                        <div>{a.procedure || "—"}</div>
                        <div>{dateText}</div>

                        <div>
                          <select
                            value={a.status || "Pending"}
                            disabled={isRowBusy}
                            style={statusSelectStyle(a.status || "Pending", isRowBusy)}
                            onChange={(e) => {
                              const next = e.target.value;

                              // "Completed" requires PDF + notes + billing
                              if (next === "Completed") {
                                openCompleteModal(a);
                                return;
                              }

                              if (next !== (a.status || "Pending")) setStatus(a._id, next);
                            }}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", color: "#64748b", fontWeight: 800, marginTop: 10, fontSize: 12 }}>
              RISWebApp • Admin
            </div>
          </div>
        </div>

        {/* ===== COMPLETE MODAL ===== */}
        {showCompleteModal ? (
          <div style={overlay} onClick={closeCompleteModal} role="dialog" aria-modal="true" aria-label="Complete appointment">
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={modalTitle}>Complete Appointment</h2>
                <div style={modalSub}>
                  {completeAppt?.procedure || "-"} • {completeAppt ? toDateObj(completeAppt)?.toLocaleDateString() : "-"}
                </div>
              </div>

              <div style={modalInner}>
                <div style={card}>
                  <div style={{ display: "grid", gap: 12 }}>
                    {/* ✅ NEW: Billing selection */}
                    <div>
                      <div style={cardLabel}>Procedure Done / Billing *</div>
                      <select
                        style={inputLight}
                        value={completeBillingCode}
                        disabled={completeSaving}
                        onChange={(e) => setCompleteBillingCode(e.target.value)}
                      >
                        <option value="">Select X-Ray procedure...</option>
                        {XRAY_BILLING_ITEMS.map((x) => (
                          <option key={x.code} value={x.code}>
                            {x.label} — {formatPhp(x.fee)}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                        Fee is based on the standard rate list.
                      </div>
                    </div>

                    <div>
                      <div style={cardLabel}>Fee</div>
                      <input type="text" style={inputLight} readOnly value={selectedBilling ? formatPhp(selectedBilling.fee) : "—"} />
                    </div>

                    <div>
                      <div style={cardLabel}>Upload Result PDF *</div>
                      <input
                        type="file"
                        accept="application/pdf"
                        style={inputLight}
                        disabled={completeSaving}
                        onChange={(e) => setCompletePdf(e.target.files?.[0] || null)}
                      />
                      <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 800 }}>PDF only. Max 10MB.</div>
                    </div>

                    <div>
                      <div style={cardLabel}>Notes *</div>
                      <textarea
                        style={textareaLight}
                        rows={4}
                        value={completeNotes}
                        disabled={completeSaving}
                        onChange={(e) => setCompleteNotes(e.target.value)}
                        placeholder="Enter findings, remarks, or summary..."
                      />
                    </div>
                  </div>

                  <div style={modalBtns}>
                    <button type="button" style={btnOutline(completeSaving)} disabled={completeSaving} onClick={closeCompleteModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={btnDark(completeSaving || !completePdf || !completeNotes.trim() || !completeBillingCode)}
                      disabled={completeSaving || !completePdf || !completeNotes.trim() || !completeBillingCode}
                      onClick={submitComplete}
                    >
                      {completeSaving ? "Saving..." : "Submit & Complete"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}