// frontend/src/pages/AdminDataRecords.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiUpload } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";

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

const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
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

function fullName(p) {
  if (!p) return "—";
  const f = p.firstName || "";
  const l = p.lastName || "";
  const name = `${f} ${l}`.trim();
  return name || "—";
}

function shortId(id) {
  if (!id) return "—";
  return String(id).slice(-8).toUpperCase();
}

function getPatientIdValue(patientId) {
  if (!patientId) return "—";
  if (typeof patientId === "string") return shortId(patientId);
  return shortId(patientId._id);
}

function getPatientNameValue(patientId) {
  if (!patientId) return "—";
  if (typeof patientId === "string") return "—";
  return fullName(patientId);
}

function getRoleClean(me) {
  return String(me?.role || me?.userType || "").trim().toLowerCase();
}
function isAdminUser(me) {
  const r = getRoleClean(me);
  return me?.isAdmin === true || r === "admin" || r === "superadmin";
}
function getAuthTokenAny() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

export default function AdminDataRecords() {
  const nav = useNavigate();
  const loc = useLocation();

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [adminProfile, setAdminProfile] = useState(null);

  const [rows, setRows] = useState([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebar = () => setSideOpen((v) => !v);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Newest");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  // ✅ Receipt meta (per appointment)
  // { [appointmentId]: { billId: string|null, receiptUrl: string } }
  const [billMeta, setBillMeta] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);

  // ✅ uploading state per appointmentId
  const [uploading, setUploading] = useState({});

  async function ensureAdmin() {
    const adminToken = localStorage.getItem("adminToken");
    const token = localStorage.getItem("token");

    if (!adminToken && !token) {
      nav("/login");
      return false;
    }

    if (adminToken) {
      try {
        const me = await apiGet("/api/admin/auth/me", adminToken);
        setAdminProfile(me || null);
        return true;
      } catch {
        localStorage.removeItem("adminToken");
      }
    }

    if (!token) {
      nav("/login");
      return false;
    }

    try {
      const me = await apiGet("/api/auth/me", token);
      setAdminProfile(me || null);

      if (!isAdminUser(me)) {
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

  async function loadBillMetaFor(list) {
    const authToken = getAuthTokenAny();
    if (!authToken) return;

    setMetaLoading(true);
    const next = {};

    await Promise.allSettled(
      (list || []).map(async (a) => {
        const apptId = a?._id;
        if (!apptId) return;

        try {
          const b = await apiGet(`/api/admin/appointments/${apptId}/bill`, authToken);
          next[apptId] = {
            billId: b?._id || null,
            receiptUrl: b?.receiptUrl || "",
          };
        } catch {
          // bill might be missing for legacy records
          next[apptId] = { billId: null, receiptUrl: "" };
        }
      })
    );

    setBillMeta(next);
    setMetaLoading(false);
  }

  async function loadRecords() {
    const authToken = getAuthTokenAny();
    if (!authToken) return nav("/login");

    try {
      setLoading(true);
      setMsg("");

      const data = await apiGet("/api/admin/appointments?status=Completed", authToken);
      const list = Array.isArray(data) ? data : [];
      setRows(list);

      // Load receipt status for each row (bill receiptUrl)
      await loadBillMetaFor(list);
    } catch (err) {
      setMsg(err.message || "Failed to load data records");
      setRows([]);
      setBillMeta({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setCheckingAdmin(true);
      const ok = await ensureAdmin();
      setCheckingAdmin(false);
      if (ok) loadRecords();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

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

  // close view modal on ESC
  useEffect(() => {
    if (!viewOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeView();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOpen]);

  function logout() {
    setMenuOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    nav("/login");
  }

  const adminFullName = useMemo(() => {
    if (!adminProfile) return "";
    const base = [adminProfile.lastName, adminProfile.firstName, adminProfile.middleName].filter(Boolean).join(", ");
    return `${base}${adminProfile.suffix ? `, ${adminProfile.suffix}` : ""}`;
  }, [adminProfile]);

  const adminIdShort = useMemo(() => {
    if (!adminProfile?._id) return "—";
    return String(adminProfile._id).slice(-8).toUpperCase();
  }, [adminProfile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;

    if (q) {
      list = list.filter((a) => {
        const p = a.patientId || null;
        const name = getPatientNameValue(p).toLowerCase();
        const pid = getPatientIdValue(p).toLowerCase();
        const proc = String(a.procedure || "").toLowerCase();
        return name.includes(q) || pid.includes(q) || proc.includes(q);
      });
    }

    const getDate = (a) => {
      const dt = toDateObj(a);
      if (dt) return dt.getTime();
      const c = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return Number.isFinite(c) ? c : 0;
    };

    const getName = (a) => getPatientNameValue(a.patientId || null).toLowerCase();

    const sorted = [...list];
    if (sort === "Newest") sorted.sort((a, b) => getDate(b) - getDate(a));
    if (sort === "Oldest") sorted.sort((a, b) => getDate(a) - getDate(b));
    if (sort === "Name A-Z") sorted.sort((a, b) => getName(a).localeCompare(getName(b)));
    if (sort === "Name Z-A") sorted.sort((a, b) => getName(b).localeCompare(getName(a)));

    return sorted;
  }, [rows, search, sort]);

  function openView(item) {
    setMsg("");
    setViewItem(item);
    setViewOpen(true);
  }

  function closeView() {
    setViewOpen(false);
    setViewItem(null);
  }

  async function uploadReceiptForAppointment(apptId, file) {
    const authToken = getAuthTokenAny();
    if (!authToken) return nav("/login");
    if (!apptId || !file) return;

    setMsg("");

    // need billId for receipt upload endpoint
    let billId = billMeta?.[apptId]?.billId || null;

    // fallback: fetch bill if missing
    if (!billId) {
      try {
        const b = await apiGet(`/api/admin/appointments/${apptId}/bill`, authToken);
        billId = b?._id || null;
        setBillMeta((prev) => ({
          ...prev,
          [apptId]: { billId, receiptUrl: b?.receiptUrl || "" },
        }));
      } catch {
        billId = null;
      }
    }

    if (!billId) {
      setMsg("Billing record not found for this appointment.");
      return;
    }

    try {
      setUploading((p) => ({ ...p, [apptId]: true }));

      const fd = new FormData();
      fd.append("receipt", file);

      const updated = await apiUpload(`/api/admin/bills/${billId}/receipt`, authToken, fd);

      setBillMeta((prev) => ({
        ...prev,
        [apptId]: {
          billId: updated?._id || billId,
          receiptUrl: updated?.receiptUrl || "",
        },
      }));
    } catch (err) {
      setMsg(err.message || "Upload receipt failed");
    } finally {
      setUploading((p) => ({ ...p, [apptId]: false }));
    }
  }

  function openReceipt(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /* ---------- STYLES (match screenshot) ---------- */
  const DARK = "#0b3d2e";
  const BG = "#ffffff";

  const SIDEBAR_OPEN_W = 280;
  const SIDEBAR_CLOSED_W = 78;

  const shell = {
    height: "100vh",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: `${sideOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W}px 1fr`,
    background: BG,
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
  const idWrap = { textAlign: "right", lineHeight: 1.1 };
  const idLabel = { fontSize: 14, fontWeight: 800 };
  const idValue = { fontSize: 12, opacity: 0.9 };

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

  const panel = {
    borderRadius: 34,
    border: `4px solid ${DARK}`,
    background: "#fff",
    padding: "16px 18px 14px",
    overflow: "hidden",
  };

  const recordsPanel = { ...panel, minHeight: 640, display: "flex", flexDirection: "column", marginTop: 10 };

  const topRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "6px 6px 12px",
    flexWrap: "wrap",
  };

  const searchPill = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: `3px solid ${DARK}`,
    borderRadius: 999,
    padding: "10px 14px",
    minWidth: 320,
    maxWidth: 560,
    flex: "1 1 520px",
    background: "#fff",
  };

  const searchInput = {
    flex: 1,
    border: 0,
    outline: "none",
    fontWeight: 900,
    fontSize: 16,
    color: "#0f172a",
    background: "transparent",
  };

  const sortSelect = {
    width: 140,
    padding: "10px 12px",
    borderRadius: 2,
    border: `2px solid ${DARK}`,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    outline: "none",
    cursor: "pointer",
  };

  // ✅ now with Receipt column
  const tableHeader = {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 0.55fr 0.75fr",
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
    gridTemplateColumns: "1.2fr 1fr 0.55fr 0.75fr",
    gap: 14,
    padding: "12px 12px",
    alignItems: "center",
    borderBottom: "2px solid rgba(0,0,0,.35)",
    fontWeight: 800,
    color: "#0f172a",
  };

  const actionBtn = (disabled) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 2,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap",
  });

  const receiptBtn = (disabled, isView) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 2,
    background: isView ? "#fff" : DARK,
    color: isView ? DARK : "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  });

  // View Modal
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

  const label = { fontWeight: 900, color: "#0f172a", marginTop: 10 };
  const value = { fontWeight: 800, color: "#0f172a", marginTop: 4 };

  const linkBtn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    textDecoration: "none",
    border: `2px solid ${DARK}`,
  };

  const closeBtn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "transparent",
    color: DARK,
    fontWeight: 900,
    textDecoration: "none",
    border: `2px solid ${DARK}`,
    cursor: "pointer",
  };

  const imgGrid = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  };

  const imgCard = {
    border: "1px solid rgba(0,0,0,.15)",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
  };

  const imgEl = {
    width: "100%",
    height: 120,
    objectFit: "cover",
    display: "block",
  };

  // Admin sidebar items
  const SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon },
    { label: "Appointment Booking", to: "/appointments", IconComp: CalendarIcon },
    { label: "Data Records", to: "/admin/data-records", IconComp: ResultsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: PatientIcon },
  ];

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
              <div style={brandText}>AXIS</div>
            </div>
          ) : (
            <div style={headerBadge} title="AXIS">
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
          {SIDE_ITEMS.map(({ label: lbl, to, IconComp }) => {
            const active = loc.pathname === to || loc.pathname.startsWith(`${to}/`);

            if (!sideOpen) {
              return (
                <Link key={to} to={to} style={navItemClosedWrap} title={lbl}>
                  <div style={navIconBtn(active)}>
                    <IconComp size={20} />
                  </div>
                </Link>
              );
            }

            return (
              <Link key={to} to={to} style={navItemOpen(active)}>
                <IconComp size={20} />
                <span>{lbl}</span>
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
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Data Records</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Manage and view all diagnostic results</div>
            </div>
          </div>

          {/* Admin dropdown */}
          <div style={rightTop} ref={menuRef}>
            <div style={idWrap}>
              <div style={idLabel}>Admin ID</div>
              <div style={idValue}>{adminIdShort}</div>
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
                <div style={ddName}>{adminFullName || "Admin"}</div>
                <div style={ddSub}>Admin ID</div>
                <div style={{ color: "#fff", fontWeight: 900, marginTop: 2 }}>{adminIdShort}</div>

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

            <div style={recordsPanel}>
              {/* Search + Sort row */}
              <div style={topRow}>
                <div style={searchPill}>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={searchInput} />
                  <div style={{ color: DARK }}>
                    <SearchIcon size={20} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} style={sortSelect}>
                    <option value="Newest">Sort: Newest</option>
                    <option value="Oldest">Sort: Oldest</option>
                    <option value="Name A-Z">Sort: Name A-Z</option>
                    <option value="Name Z-A">Sort: Name Z-A</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={tableHeader}>
                <div>Patient Name</div>
                <div>Patient ID</div>
                <div />
                <div>Receipt</div>
              </div>

              <div style={tableBody}>
                {loading ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading records...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>No records found.</div>
                ) : (
                  filtered.map((a) => {
                    const name = getPatientNameValue(a.patientId || null);
                    const pid = getPatientIdValue(a.patientId || null);

                    const apptId = a._id;
                    const meta = billMeta?.[apptId]; // undefined = still loading this row
                    const receiptUrl = meta?.receiptUrl || "";
                    const isUploading = !!uploading?.[apptId];

                    const metaReady = meta !== undefined || !metaLoading;
                    const canUpload = metaReady && !receiptUrl;

                    const inputId = `receipt_${apptId}`;

                    return (
                      <div key={a._id} style={row}>
                        <div>{name}</div>
                        <div>{pid}</div>

                        <div>
                          <button type="button" style={actionBtn(false)} onClick={() => openView(a)}>
                            View
                          </button>
                        </div>

                        <div>
                          {/* hidden input */}
                          <input
                            id={inputId}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              // allow choosing same file again later
                              e.target.value = "";
                              if (!f) return;
                              uploadReceiptForAppointment(apptId, f);
                            }}
                          />

                          {receiptUrl ? (
                            <button
                              type="button"
                              style={receiptBtn(false, true)}
                              onClick={() => openReceipt(receiptUrl)}
                            >
                              View Receipt
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={receiptBtn(isUploading || !metaReady, false)}
                              disabled={isUploading || !metaReady}
                              onClick={() => {
                                const el = document.getElementById(inputId);
                                if (el) el.click();
                              }}
                            >
                              {isUploading ? "Uploading..." : metaReady ? "Upload Receipt" : "Loading..."}
                            </button>
                          )}
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

        {/* VIEW MODAL */}
        {viewOpen && viewItem ? (
          <div style={overlay} onClick={closeView} role="dialog" aria-modal="true" aria-label="View record">
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={modalTitle}>Diagnostic Record</h2>
                <div style={modalSub}>
                  {getPatientNameValue(viewItem.patientId || null)} • {getPatientIdValue(viewItem.patientId || null)}
                </div>
              </div>

              <div style={modalInner}>
                <div style={card}>
                  <div style={label}>Procedure</div>
                  <div style={value}>{viewItem.procedure || "—"}</div>

                  <div style={label}>Date</div>
                  <div style={value}>{toDateObj(viewItem)?.toLocaleDateString() || "—"}</div>

                  <div style={label}>Result PDF</div>
                  <div style={value}>
                    {viewItem.resultPdfUrl ? (
                      <a href={viewItem.resultPdfUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                        Open PDF
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div style={label}>Notes</div>
                  <div style={value}>{viewItem.resultNotes ? String(viewItem.resultNotes) : "—"}</div>

                  <div style={label}>Diagnostic Images</div>
                  {Array.isArray(viewItem.diagnosticImages) && viewItem.diagnosticImages.length ? (
                    <div style={imgGrid}>
                      {viewItem.diagnosticImages.slice(0, 9).map((img, idx) => {
                        const url = typeof img === "string" ? img : img?.url || img?.secureUrl || img?.path || "";
                        return (
                          <div key={idx} style={imgCard}>
                            {url ? <img src={url} alt={`Diagnostic ${idx + 1}`} style={imgEl} /> : <div style={{ padding: 10 }}>No URL</div>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={value}>—</div>
                  )}

                  <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                    <button type="button" style={closeBtn} onClick={closeView}>
                      Close
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