// frontend/src/pages/AdminDataRecords.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../api";
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

const PrinterIcon = (p) => (
  <Icon {...p}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
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

// Prefer BSRT ID when patient object is populated
function getPatientIdValue(patientId) {
  if (!patientId) return "—";

  if (typeof patientId === "object") {
    if (patientId?.bsrtId) return String(patientId.bsrtId).trim();
    if (patientId?.bsrtID) return String(patientId.bsrtID).trim();
    if (patientId?._id) return shortId(patientId._id);
    return "—";
  }

  return shortId(patientId);
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

function isPdfUrl(url) {
  const raw = String(url || "");
  const noQuery = raw.split("?")[0].toLowerCase();
  const lower = raw.toLowerCase();
  return noQuery.endsWith(".pdf") || noQuery.includes(".pdf") || lower.includes("format=pdf");
}

// ✅ NEW: detect DICOM URLs so we don't try to iframe-preview them
function isDicomUrl(url) {
  const raw = String(url || "");
  const noQuery = raw.split("?")[0].toLowerCase();
  return (
    noQuery.endsWith(".dcm") ||
    noQuery.endsWith(".dicom") ||
    noQuery.includes(".dcm") ||
    noQuery.includes(".dicom")
  );
}

function getFirstDiagnosticUrl(item) {
  const list = Array.isArray(item?.diagnosticImages) ? item.diagnosticImages : [];
  for (const img of list) {
    const url = typeof img === "string" ? img : img?.url || img?.secureUrl || img?.path || "";
    if (url) return url;
  }
  return "";
}

function getPatientDobObj(patientId) {
  if (!patientId || typeof patientId === "string") return null;
  const raw = patientId.dob || patientId.birthDate || patientId.dateOfBirth || patientId.birthday;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function getPatientSex(patientId) {
  if (!patientId || typeof patientId === "string") return "";
  return String(patientId.sex || patientId.gender || patientId.mf || patientId.sexAtBirth || "")
    .trim()
    .toUpperCase();
}
function getPatientContact(patientId) {
  if (!patientId || typeof patientId === "string") return "";
  return String(patientId.contactNumber || patientId.phone || patientId.mobile || "").trim();
}
function getPatientEmail(patientId) {
  if (!patientId || typeof patientId === "string") return "";
  return String(patientId.email || patientId.emailAddress || "").trim();
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

  // Patient Records modal
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [selectedPatientKey, setSelectedPatientKey] = useState("");

  // Diagnostic Record modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  // Receipt meta (per appointment)
  const [billMeta, setBillMeta] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);

  // Receipt viewer modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptUrlView, setReceiptUrlView] = useState("");

  function openReceiptModal(url) {
    if (!url) return;
    setReceiptUrlView(url);
    setReceiptOpen(true);
  }

  function closeReceiptModal() {
    setReceiptOpen(false);
    setReceiptUrlView("");
  }

  function openInNewTab(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

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

  function getDateMs(a) {
    const dt = toDateObj(a);
    if (dt) return dt.getTime();
    const c = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    return Number.isFinite(c) ? c : 0;
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

      // Completed + Approved
      const [completedRes, approvedRes] = await Promise.all([
        apiGet("/api/admin/appointments?status=Completed", authToken),
        apiGet("/api/admin/appointments?status=Approved", authToken),
      ]);

      const completed = Array.isArray(completedRes) ? completedRes : [];
      const approved = Array.isArray(approvedRes) ? approvedRes : [];

      const merged = [...completed, ...approved];
      const deduped = Array.from(new Map(merged.map((a) => [a?._id, a])).values()).filter(Boolean);

      setRows(deduped);
      await loadBillMetaFor(deduped);
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

  // close patient modal on ESC
  useEffect(() => {
    if (!patientModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePatientModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientModalOpen]);

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

  // close receipt modal on ESC
  useEffect(() => {
    if (!receiptOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeReceiptModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptOpen]);

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
    if (adminProfile?.bsrtId) return String(adminProfile.bsrtId).trim();
    if (adminProfile?.bsrtID) return String(adminProfile.bsrtID).trim();
    if (adminProfile?._id) return String(adminProfile._id).slice(-8).toUpperCase();
    return "—";
  }, [adminProfile]);

  const roleClean = useMemo(() => getRoleClean(adminProfile), [adminProfile]);
  const isSuperAdmin = roleClean === "superadmin";
  const idLabelText = isSuperAdmin ? "Superadmin ID" : "Admin ID";

  // Group appointments into 1 row per Patient ID
  const patientGroups = useMemo(() => {
    const map = new Map();

    for (const a of rows) {
      const p = a?.patientId || null;

      let pidKey = getPatientIdValue(p);
      if (!pidKey || pidKey === "—") {
        const raw = typeof p === "string" ? p : p?._id;
        pidKey = raw ? shortId(raw) : `UNK_${String(a?._id || Math.random())}`;
      }

      if (!map.has(pidKey)) {
        map.set(pidKey, {
          key: pidKey,
          patient: p,
          name: getPatientNameValue(p),
          records: [],
          newestMs: 0,
          oldestMs: 0,
        });
      }

      map.get(pidKey).records.push(a);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.records.sort((a, b) => getDateMs(b) - getDateMs(a));
      g.newestMs = g.records.length ? getDateMs(g.records[0]) : 0;
      g.oldestMs = g.records.length ? getDateMs(g.records[g.records.length - 1]) : 0;
    }

    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedGroup = useMemo(() => {
    if (!selectedPatientKey) return null;
    return patientGroups.find((g) => g.key === selectedPatientKey) || null;
  }, [patientGroups, selectedPatientKey]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = patientGroups;

    if (q) {
      list = list.filter((g) => {
        const name = String(g.name || "").toLowerCase();
        const pid = String(g.key || "").toLowerCase();
        const procHit = g.records.some((r) => String(r.procedure || "").toLowerCase().includes(q));
        return name.includes(q) || pid.includes(q) || procHit;
      });
    }

    const sorted = [...list];
    if (sort === "Newest") sorted.sort((a, b) => b.newestMs - a.newestMs);
    if (sort === "Oldest") sorted.sort((a, b) => a.oldestMs - b.oldestMs);
    if (sort === "Name A-Z")
      sorted.sort((a, b) => String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase()));
    if (sort === "Name Z-A")
      sorted.sort((a, b) => String(b.name || "").toLowerCase().localeCompare(String(a.name || "").toLowerCase()));
    return sorted;
  }, [patientGroups, search, sort]);

  function openPatientModal(groupKey) {
    setMsg("");
    setSelectedPatientKey(groupKey);
    setPatientModalOpen(true);
  }

  function closePatientModal() {
    setPatientModalOpen(false);
    setSelectedPatientKey("");
  }

  function openView(item) {
    setMsg("");
    setViewItem(item);
    setViewOpen(true);
  }

  function closeView() {
    setViewOpen(false);
    setViewItem(null);
  }

  /* ---------- STYLES ---------- */
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

  // Patient-level Table
  const tableHeader = {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 0.45fr 0.6fr",
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
    gridTemplateColumns: "1.2fr 1fr 0.45fr 0.6fr",
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

  // OVERLAYS
  const overlayBase = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "grid",
    placeItems: "center",
    padding: 18,
  };
  const overlayPatient = { ...overlayBase, zIndex: 1900 };
  const overlayView = { ...overlayBase, zIndex: 2000 };
  const overlayReceipt = { ...overlayBase, zIndex: 2100 };

  /* ---------- PATIENT RECORDS MODAL ---------- */
  const patientBorder = {
    width: "min(1180px, 96vw)",
    height: "min(760px, 88vh)",
    borderRadius: 44,
    background: "rgba(0,0,0,.55)",
    padding: 10,
    boxShadow: "0 28px 80px rgba(0,0,0,.55)",
    overflow: "hidden",
  };

  const patientModal = {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    background: "linear-gradient(180deg, rgba(0,0,0,.62) 0%, rgba(11,61,46,.96) 22%, rgba(11,61,46,.92) 100%)",
    border: "2px solid rgba(255,255,255,.12)",
    boxShadow: "inset 0 0 0 6px rgba(255,255,255,.08)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    color: "#fff",
  };

  const patientTop = {
    padding: "18px 22px 10px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  };

  const patientName = {
    fontWeight: 900,
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: 0.2,
    textShadow: "0 2px 10px rgba(0,0,0,.35)",
  };

  const closeX = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,.35)",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    userSelect: "none",
    flex: "0 0 auto",
  };

  const patientInfoRow = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 28,
    maxWidth: 980,
  };

  const infoCol = { display: "grid", gap: 8 };
  const infoLabel = { fontWeight: 900, fontSize: 14, opacity: 0.9 };
  const infoValue = { fontWeight: 800, fontSize: 13, opacity: 0.95 };

  const apptPill = {
    margin: "10px 22px 14px",
    background: "#fff",
    borderRadius: 999,
    padding: "10px 18px",
    display: "grid",
    placeItems: "center",
    color: DARK,
    fontWeight: 900,
    fontSize: 30,
    letterSpacing: 0.5,
  };

  const apptHead = {
    margin: "0 22px",
    display: "grid",
    gridTemplateColumns: "0.9fr 1.2fr 0.7fr 0.6fr 0.6fr",
    gap: 12,
    padding: "10px 12px",
    fontWeight: 900,
    color: "#fff",
    borderTop: "2px solid rgba(255,255,255,.35)",
    borderBottom: "2px solid rgba(255,255,255,.35)",
  };

  const apptBody = {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: "0 22px 18px",
  };

  const apptRow = {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.2fr 0.7fr 0.6fr 0.6fr",
    gap: 12,
    padding: "12px 12px",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.25)",
    fontWeight: 800,
    color: "#fff",
  };

  const apptBtn = (disabled, variant = "white") => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    background: variant === "white" ? "#fff" : DARK,
    color: variant === "white" ? DARK : "#fff",
    fontWeight: 900,
    border: `2px solid ${variant === "white" ? "rgba(255,255,255,.9)" : DARK}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  });

  const statusPill = (status) => {
    const s = String(status || "").toLowerCase();
    const isDone = s === "completed";
    return {
      width: "fit-content",
      padding: "8px 12px",
      borderRadius: 6,
      background: isDone ? "#fff" : "#caa20a",
      color: isDone ? DARK : "#fff",
      fontWeight: 900,
      border: "2px solid rgba(255,255,255,.25)",
    };
  };

  /* ---------- DIAGNOSTIC RECORD MODAL ---------- */
  const viewBorder = {
    width: "min(1100px, 92vw)",
    height: "min(650px, 82vh)",
    borderRadius: 44,
    background: "rgba(0,0,0,.55)",
    padding: 10,
    boxShadow: "0 28px 80px rgba(0,0,0,.55)",
    overflow: "hidden",
  };

  const viewModal = {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    background: "linear-gradient(180deg, rgba(0,0,0,.62) 0%, rgba(11,61,46,.96) 22%, rgba(11,61,46,.92) 100%)",
    border: "2px solid rgba(255,255,255,.12)",
    boxShadow: "inset 0 0 0 6px rgba(255,255,255,.08)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const viewTop = {
    padding: "18px 22px 12px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    color: "#fff",
  };

  const viewName = {
    fontWeight: 900,
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: 0.2,
    textShadow: "0 2px 10px rgba(0,0,0,.35)",
  };

  const viewMetaRow = {
    marginTop: 10,
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    alignItems: "flex-end",
  };

  const viewMeta = { minWidth: 150, maxWidth: 260 };
  const viewMetaLabel = { fontWeight: 900, fontSize: 14, opacity: 0.9 };
  const viewMetaValue = {
    marginTop: 4,
    fontWeight: 800,
    fontSize: 13,
    opacity: 0.95,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const viewCloseBtn = { ...closeX };

  const viewBody = {
    flex: "1 1 auto",
    minHeight: 0,
    padding: "0 22px 22px",
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 18,
    overflow: "hidden",
  };

  const viewLeft = { minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" };

  const viewSectionTitle = {
    color: "#fff",
    fontWeight: 900,
    fontSize: 32,
    margin: "0 0 10px",
  };

  const viewLinedBox = {
    flex: "1 1 auto",
    borderRadius: 18,
    padding: "14px 14px",
    color: "rgba(255,255,255,.92)",
    fontWeight: 800,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflow: "auto",
    backgroundColor: "rgba(0,0,0,.10)",
    backgroundImage:
      "repeating-linear-gradient(to bottom, rgba(255,255,255,.32), rgba(255,255,255,.32) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 34px)",
  };

  const viewBtnRow = { marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" };

  const viewActionBtn = {
    background: "#fff",
    color: DARK,
    border: "2px solid rgba(255,255,255,.9)",
    borderRadius: 8,
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    userSelect: "none",
  };

  const viewRight = { minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" };

  const viewImageFrame = {
    flex: "1 1 auto",
    borderRadius: 18,
    overflow: "hidden",
    background: "rgba(255,255,255,.08)",
    border: "2px solid rgba(255,255,255,.18)",
    display: "grid",
    placeItems: "center",
  };

  const viewPreviewImg = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#fff",
    display: "block",
  };

  const viewPreviewFrame = { width: "100%", height: "100%", border: 0, background: "#fff" };

  const viewEmpty = { padding: 18, color: "rgba(255,255,255,.85)", fontWeight: 900 };

  /* ---------- RECEIPT MODAL ---------- */
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

  const SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon },
    { label: "Appointment Booking", to: "/admin/appointment-booking", IconComp: CalendarIcon },
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
              <div style={idLabel}>{idLabelText}</div>
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
                <div style={ddSub}>{idLabelText}</div>
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

              {/* Patient-level Table */}
              <div style={tableHeader}>
                <div>Patient Name</div>
                <div>Patient ID</div>
                <div>Records</div>
                <div />
              </div>

              <div style={tableBody}>
                {loading ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading records...</div>
                ) : filteredPatients.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>No patients found.</div>
                ) : (
                  filteredPatients.map((g) => (
                    <div key={g.key} style={row}>
                      <div>{g.name || "—"}</div>
                      <div>{g.key || "—"}</div>
                      <div style={{ fontWeight: 900 }}>{g.records.length}</div>
                      <div>
                        <button type="button" style={actionBtn(false)} onClick={() => openPatientModal(g.key)}>
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", color: "#64748b", fontWeight: 800, marginTop: 10, fontSize: 12 }}>
              RISWebApp • Admin
            </div>
          </div>
        </div>

        {/* PATIENT RECORDS MODAL */}
        {patientModalOpen && selectedGroup ? (
          <div style={overlayPatient} onClick={closePatientModal} role="dialog" aria-modal="true" aria-label="Patient records">
            <div style={patientBorder} onClick={(e) => e.stopPropagation()}>
              <div style={patientModal}>
                <div style={patientTop}>
                  <div style={{ minWidth: 0 }}>
                    <div style={patientName}>{selectedGroup.name || "—"}</div>

                    {(() => {
                      const p = selectedGroup.patient || null;
                      const pid = selectedGroup.key;

                      const dob = getPatientDobObj(p);
                      const age = calcAge(dob);
                      const dobText = dob ? dob.toLocaleDateString() : "—";

                      const sex = getPatientSex(p) || "—";
                      const contact = getPatientContact(p) || "—";
                      const email = getPatientEmail(p) || "—";

                      return (
                        <div style={patientInfoRow}>
                          <div style={infoCol}>
                            <div>
                              <div style={infoLabel}>Patient ID</div>
                              <div style={infoValue}>{pid}</div>
                            </div>

                            <div>
                              <div style={infoLabel}>Birthdate</div>
                              <div style={infoValue}>
                                {dobText}
                                {Number.isFinite(age) ? ` • ${age} years old` : ""}
                              </div>
                            </div>
                          </div>

                          <div style={infoCol}>
                            <div>
                              <div style={infoLabel}>M/F</div>
                              <div style={infoValue}>{sex}</div>
                            </div>

                            <div>
                              <div style={infoLabel}>Contact Number</div>
                              <div style={infoValue}>{contact}</div>
                            </div>

                            <div>
                              <div style={infoLabel}>Email Address</div>
                              <div style={infoValue}>{email}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <button type="button" style={closeX} onClick={closePatientModal} aria-label="Close">
                    ✕
                  </button>
                </div>

                <div style={apptPill}>APPOINTMENTS</div>

                <div style={apptHead}>
                  <div>Date</div>
                  <div>Procedure</div>
                  <div>Status</div>
                  <div>Receipt</div>
                  <div />
                </div>

                <div style={apptBody}>
                  {selectedGroup.records.map((a) => {
                    const apptId = a._id;
                    const dt = toDateObj(a);
                    const dateText = dt ? dt.toLocaleDateString() : "—";
                    const proc = a.procedure || "—";
                    const status = a.status || "Completed";

                    const meta = billMeta?.[apptId];
                    const receiptUrl = meta?.receiptUrl || "";
                    const metaReady = meta !== undefined || !metaLoading;

                    return (
                      <div key={apptId} style={apptRow}>
                        <div>{dateText}</div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proc}</div>
                        <div>
                          <span style={statusPill(status)}>{status}</span>
                        </div>

                        {/* Receipt column (View only, no Upload) */}
                        <div>
                          {!metaReady ? (
                            <span style={{ opacity: 0.85, fontWeight: 900 }}>Loading…</span>
                          ) : receiptUrl ? (
                            <button type="button" style={apptBtn(false, "white")} onClick={() => openReceiptModal(receiptUrl)}>
                              View Receipt
                            </button>
                          ) : (
                            <span style={{ opacity: 0.85, fontWeight: 900 }}>—</span>
                          )}
                        </div>

                        <div>
                          <button type="button" style={apptBtn(false, "white")} onClick={() => openView(a)}>
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* DIAGNOSTIC RECORD MODAL */}
        {viewOpen && viewItem
          ? (() => {
              const patient = viewItem.patientId || null;

              const name = getPatientNameValue(patient);
              const pid = getPatientIdValue(patient);

              const dob = getPatientDobObj(patient);
              const age = calcAge(dob);
              const dobText = dob ? dob.toLocaleDateString() : "";

              const apptDate = toDateObj(viewItem)?.toLocaleDateString() || "—";
              const proc = viewItem.procedure || "—";

              const imgUrl = getFirstDiagnosticUrl(viewItem);
              const fileUrl = viewItem.resultPdfUrl || ""; // PDF or DICOM now

              const canShowImg = !!imgUrl && !isPdfUrl(imgUrl) && !isDicomUrl(imgUrl);
              const canShowPdf = !canShowImg && !!fileUrl && isPdfUrl(fileUrl);
              const isDicom = !canShowImg && !!fileUrl && isDicomUrl(fileUrl);

              const fullTarget = imgUrl || fileUrl;

              const onViewFull = () => {
                if (fullTarget) openInNewTab(fullTarget);
              };

              return (
                <div style={overlayView} onClick={closeView} role="dialog" aria-modal="true" aria-label="View record">
                  <div style={viewBorder} onClick={(e) => e.stopPropagation()}>
                    <div style={viewModal}>
                      <div style={viewTop}>
                        <div style={{ minWidth: 0 }}>
                          <div style={viewName}>{name}</div>

                          <div style={viewMetaRow}>
                            <div style={viewMeta}>
                              <div style={viewMetaLabel}>Patient ID</div>
                              <div style={viewMetaValue}>{pid}</div>
                            </div>

                            {dob ? (
                              <div style={viewMeta}>
                                <div style={viewMetaLabel}>Birthdate</div>
                                <div style={viewMetaValue}>
                                  {dobText}
                                  {Number.isFinite(age) ? ` • ${age} years old` : ""}
                                </div>
                              </div>
                            ) : null}

                            <div style={viewMeta}>
                              <div style={viewMetaLabel}>Date</div>
                              <div style={viewMetaValue}>{apptDate}</div>
                            </div>

                            <div style={viewMeta}>
                              <div style={viewMetaLabel}>Procedure</div>
                              <div style={viewMetaValue}>{proc}</div>
                            </div>
                          </div>
                        </div>

                        <button type="button" style={viewCloseBtn} onClick={closeView} aria-label="Close">
                          ✕
                        </button>
                      </div>

                      <div style={viewBody}>
                        <div style={viewLeft}>
                          <div style={viewSectionTitle}>Interpretation and Diagnosis</div>

                          <div style={viewLinedBox}>{viewItem.resultNotes ? String(viewItem.resultNotes) : "—"}</div>

                          {/* ✅ Open Full Report goes to ADMIN report route */}
                          <div style={viewBtnRow}>
                            {viewItem?._id ? (
                              <button
                                type="button"
                                style={viewActionBtn}
                                onClick={() => {
                                  closeView();
                                  nav(`/admin/report/${viewItem._id}`);
                                }}
                              >
                                <PrinterIcon size={18} />
                                Open Full Report
                              </button>
                            ) : (
                              <button type="button" style={{ ...viewActionBtn, opacity: 0.6, cursor: "not-allowed" }} disabled>
                                <PrinterIcon size={18} />
                                Open Full Report
                              </button>
                            )}

                            <button type="button" style={viewActionBtn} onClick={onViewFull} disabled={!fullTarget}>
                              {isDicom ? "Download DICOM" : "View Full Image"}
                            </button>
                          </div>
                        </div>

                        <div style={viewRight}>
                          <div style={viewImageFrame}>
                            {canShowImg ? (
                              <img src={imgUrl} alt="Diagnostic" style={viewPreviewImg} />
                            ) : canShowPdf ? (
                              <iframe src={fileUrl} title="Result PDF" style={viewPreviewFrame} />
                            ) : isDicom ? (
                              <div style={{ ...viewEmpty, textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>DICOM preview not supported</div>
                                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.95, lineHeight: 1.4 }}>
                                  This file is a DICOM (.dcm). Browsers can’t render it here.
                                  <br />
                                  Click <b>Download DICOM</b> to download/open it in a DICOM viewer.
                                </div>
                              </div>
                            ) : (
                              <div style={viewEmpty}>No image/PDF available</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          : null}

        {/* RECEIPT MODAL */}
        {receiptOpen && receiptUrlView ? (
          <div style={overlayReceipt} onClick={closeReceiptModal} role="dialog" aria-modal="true" aria-label="View receipt">
            <div style={{ ...modal, width: "min(1100px, 96%)" }} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={modalTitle}>Receipt</h2>
                <div style={modalSub}>Preview receipt (PDF/Image)</div>
              </div>

              <div style={modalInner}>
                <div style={card}>
                  {isPdfUrl(receiptUrlView) ? (
                    <iframe
                      src={receiptUrlView}
                      title="Receipt PDF"
                      style={{ width: "100%", height: "70vh", border: 0, borderRadius: 12 }}
                    />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center" }}>
                      <img
                        src={receiptUrlView}
                        alt="Receipt"
                        style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 12 }}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    <button type="button" style={closeBtn} onClick={closeReceiptModal}>
                      Close
                    </button>

                    <button type="button" style={linkBtn} onClick={() => openInNewTab(receiptUrlView)}>
                      Open in new tab
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