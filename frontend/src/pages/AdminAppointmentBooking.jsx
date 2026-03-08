// frontend/src/pages/AdminAppointmentBooking.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPatch, apiUpload } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { XRAY_BILLING_ITEMS, formatPhp, findXrayBillingByLabel } from "../constants/procedures";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PAYMENT_STATUSES = [
  "Unpaid",
  "For Confirmation",
  "Paid",
  "University Guarantee - Research",
  "University Guarantee - Medical",
];

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

function shortId(id) {
  if (!id) return "—";
  return String(id).slice(-8).toUpperCase();
}

function fullNameProfileStyle(p) {
  if (!p || typeof p !== "object") return "—";
  const base = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(", ");
  const out = `${base}${p.suffix ? `, ${p.suffix}` : ""}`.trim();
  return out || "—";
}

function getPatientIdValue(patient) {
  if (!patient) return "—";
  if (typeof patient === "object") {
    if (patient?.bsrtId) return String(patient.bsrtId).trim();
    if (patient?.bsrtID) return String(patient.bsrtID).trim();
    if (patient?._id) return shortId(patient._id);
    return "—";
  }
  return shortId(patient);
}

function getAuthTokenAny() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function getRoleClean(me) {
  return String(me?.role || me?.userType || "").trim().toLowerCase();
}

function isAdminUser(me) {
  const r = getRoleClean(me);
  return me?.isAdmin === true || r === "admin" || r === "superadmin";
}

function isPdfUrl(url) {
  const raw = String(url || "");
  const noQuery = raw.split("?")[0].toLowerCase();
  const lower = raw.toLowerCase();
  return noQuery.endsWith(".pdf") || noQuery.includes(".pdf") || lower.includes("format=pdf");
}

function normalizeFileUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return `${API_URL}/${u}`;
}

function normalizePaymentStatus(rawStatus, hasReceipt) {
  const raw = String(rawStatus || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return hasReceipt ? "For Confirmation" : "Unpaid";
  if (lower === "pending" || lower === "unpaid") return hasReceipt ? "For Confirmation" : "Unpaid";

  for (const s of PAYMENT_STATUSES) {
    if (s.toLowerCase() === lower) return s;
  }

  if (lower.includes("university guarantee") && lower.includes("research")) return "University Guarantee - Research";
  if (lower.includes("university guarantee") && lower.includes("medical")) return "University Guarantee - Medical";

  return hasReceipt ? "For Confirmation" : "Unpaid";
}

function getReceiptRawFromBill(b) {
  return b?.receiptUrl || b?.receiptPath || b?.receipt || b?.fileUrl || b?.url || b?.invoiceUrl || b?.invoicePath || "";
}

/* ---------- FILE TYPE HELPERS (PDF / DICOM) ---------- */
function getFileExt(name) {
  const n = String(name || "");
  const dot = n.lastIndexOf(".");
  return dot >= 0 ? n.slice(dot + 1).toLowerCase() : "";
}

function isPdfFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const ext = getFileExt(file.name);
  return type === "application/pdf" || ext === "pdf";
}

function isDicomFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const ext = getFileExt(file.name);
  // Many browsers report .dcm as application/octet-stream, so extension matters.
  return type.includes("dicom") || ext === "dcm" || ext === "dicom";
}

function isAllowedResultFile(file) {
  return isPdfFile(file) || isDicomFile(file);
}

export default function AdminAppointmentBooking() {
  const nav = useNavigate();
  const loc = useLocation();

  const [msg, setMsg] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);

  const [adminProfile, setAdminProfile] = useState(null);

  // Approved appointments
  const [rows, setRows] = useState([]);

  // { [appointmentId]: bill }
  const [billsMap, setBillsMap] = useState({});

  // Filters (status locked to Approved)
  const [filters, setFilters] = useState({ paymentStatus: "All", date: "" });

  // UI: dropdown / sidebar
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [sideOpen, setSideOpen] = useState(true);

  // Payment saving per row
  const [paySavingId, setPaySavingId] = useState(null);

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptUrlView, setReceiptUrlView] = useState("");

  // Upload Result modal (Complete flow)
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeAppt, setCompleteAppt] = useState(null);
  const [completePdf, setCompletePdf] = useState(null); // PDF or DICOM
  const [completeNotes, setCompleteNotes] = useState(""); // Description
  const [completeImpression, setCompleteImpression] = useState(""); // NEW
  const [completeSaving, setCompleteSaving] = useState(false);
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
    params.set("status", "Approved");
    if (filters.date) params.set("date", filters.date);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [filters.date]);

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
    } catch {
      nav("/login");
      return false;
    }
  }

  async function loadBillsForAppointments(appointments) {
    const authToken = getAuthTokenAny();
    if (!authToken) return;

    const ids = (appointments || [])
      .map((a) => String(a?._id || "").trim())
      .filter(Boolean);

    if (!ids.length) {
      setBillsMap({});
      return;
    }

    try {
      const qs = `?appointmentIds=${encodeURIComponent(ids.join(","))}`;
      const bills = await apiGet(`/api/admin/bills${qs}`, authToken);

      const map = {};
      for (const b of Array.isArray(bills) ? bills : []) {
        const apptField = b?.appointmentId;
        const apptId =
          apptField && typeof apptField === "object" && apptField._id ? String(apptField._id) : String(apptField || "");

        if (apptId && !map[apptId]) map[apptId] = b;
      }

      setBillsMap(map);
    } catch (err) {
      setBillsMap({});
      setMsg(err.message || "Failed to load bills for appointments");
    }
  }

  async function load() {
    const authToken = getAuthTokenAny();
    if (!authToken) return nav("/login");

    try {
      setLoading(true);
      setMsg("");

      const data = await apiGet(`/api/admin/appointments${queryString}`, authToken);
      const list = Array.isArray(data) ? data : [];
      const approved = list.filter((a) => String(a?.status || "") === "Approved");

      setRows(approved);
      await loadBillsForAppointments(approved);
    } catch (err) {
      setMsg(err.message || "Request failed");
      setRows([]);
      setBillsMap({});
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

  function openReceiptModal(url) {
    const normalized = normalizeFileUrl(url);
    if (!normalized) return;
    setReceiptUrlView(normalized);
    setReceiptOpen(true);
  }
  function closeReceiptModal() {
    setReceiptOpen(false);
    setReceiptUrlView("");
  }

  function openReceiptInNewTab(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // allow editing even if no bill exists yet (backend should upsert/create by appointmentId)
  async function updateBillStatusForAppointment(apptId, billId, nextStatus) {
    const authToken = getAuthTokenAny();
    if (!authToken) return nav("/login");

    try {
      setMsg("");
      setPaySavingId(apptId);

      let updated = null;

      if (billId) {
        updated = await apiPatch(`/api/admin/bills/${billId}/status`, authToken, { status: nextStatus });
      } else {
        updated = await apiPatch(`/api/admin/bills/by-appointment/${apptId}/status`, authToken, { status: nextStatus });
      }

      setBillsMap((prev) => ({
        ...prev,
        [apptId]: { ...(prev[apptId] || {}), ...(updated || {}), status: nextStatus },
      }));
    } catch (err) {
      setMsg(err.message || "Failed to update payment status");
    } finally {
      setPaySavingId(null);
    }
  }

  // Upload Result modal (Complete flow)
  function openCompleteModal(appt) {
    setMsg("");
    setCompleteAppt(appt);
    setCompletePdf(null);
    setCompleteNotes("");
    setCompleteImpression("");

    const match = findXrayBillingByLabel(appt?.procedure);
    setCompleteBillingCode(match ? match.code : "");

    setShowCompleteModal(true);
  }

  function closeCompleteModal() {
    if (completeSaving) return;
    setShowCompleteModal(false);
    setCompleteAppt(null);
    setCompletePdf(null);
    setCompleteNotes("");
    setCompleteImpression("");
    setCompleteBillingCode("");
  }

  async function submitComplete() {
    const authToken = getAuthTokenAny();
    if (!authToken) return nav("/login");
    if (!completeAppt?._id) return;

    if (!completeBillingCode) return setMsg("Billing item (procedure done) is required.");
    if (!selectedBilling) return setMsg("Invalid billing selection.");

    if (!completeNotes.trim()) return setMsg("Description is required.");
    if (!completeImpression.trim()) return setMsg("Impression is required.");

    if (!completePdf) return setMsg("Result file is required.");
    if (!isAllowedResultFile(completePdf)) return setMsg("File must be a PDF or DICOM (.dcm).");

    const maxBytes = 10 * 1024 * 1024;
    if (completePdf.size > maxBytes) return setMsg("Result file is too large (max 10MB).");

    try {
      setCompleteSaving(true);
      setMsg("");

      const fd = new FormData();
      fd.append("resultPdf", completePdf); // keep backend field name
      fd.append("notes", completeNotes.trim()); // Description
      fd.append("impression", completeImpression.trim()); // NEW

      fd.append("billingCode", selectedBilling.code);
      fd.append("billingLabel", selectedBilling.label);
      fd.append("billingAmount", selectedBilling.fee.toFixed(2));
      fd.append("billingCurrency", "PHP");

      await apiUpload(`/api/admin/appointments/${completeAppt._id}/complete`, authToken, fd);

      closeCompleteModal();
      await load(); // Completed appt will disappear from Approved list
      setMsg("Result uploaded and appointment marked as Completed.");
    } catch (err) {
      setMsg(err.message || "Upload/Complete failed");
    } finally {
      setCompleteSaving(false);
    }
  }

  const adminIdShort = useMemo(() => {
    if (adminProfile?.bsrtId) return String(adminProfile.bsrtId).trim();
    if (adminProfile?.bsrtID) return String(adminProfile.bsrtID).trim();
    return shortId(adminProfile?._id);
  }, [adminProfile]);

  const roleClean = useMemo(() => getRoleClean(adminProfile), [adminProfile]);
  const isSuperAdmin = roleClean === "superadmin";
  const idLabelText =
    roleClean === "admin" || isSuperAdmin || adminProfile?.isAdmin === true
      ? isSuperAdmin
        ? "Superadmin ID"
        : "Admin ID"
      : "Patient ID";

  const paymentStatusOptions = useMemo(() => ["All", ...PAYMENT_STATUSES], []);

  const filteredRows = useMemo(() => {
    const wanted = filters.paymentStatus;
    if (!wanted || wanted === "All") return rows;

    return (rows || []).filter((a) => {
      const bill = billsMap?.[String(a._id)] || null;

      const receiptRaw = getReceiptRawFromBill(bill);
      const receiptUrl = normalizeFileUrl(receiptRaw);
      const hasReceipt = Boolean(receiptUrl);

      const statusRaw = bill?.status || "";
      const payValue = normalizePaymentStatus(statusRaw, hasReceipt);

      return payValue === wanted;
    });
  }, [rows, billsMap, filters.paymentStatus]);

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
  const contentWrap = { maxWidth: 1440 };

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
    gridTemplateColumns: "1.2fr 1fr auto",
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

  const gridCols = "1.8fr 0.9fr 1.1fr 1.1fr 1.2fr 0.75fr 0.85fr";

  const tableHeader = {
    display: "grid",
    gridTemplateColumns: gridCols,
    gap: 14,
    padding: "12px 12px",
    fontWeight: 900,
    color: DARK,
    fontSize: 18,
    borderBottom: "2px solid rgba(0,0,0,.45)",
    flex: "0 0 auto",
  };

  const tableBody = { flex: "1 1 auto", overflowY: "auto", padding: "0 0 6px" };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: gridCols,
    gap: 14,
    padding: "14px 12px",
    alignItems: "center",
    borderBottom: "2px solid rgba(0,0,0,.35)",
    fontWeight: 800,
    color: "#0f172a",
  };

  const btnDark = (disabled) => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    background: DARK,
    color: "#fff",
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  });

  const btnOutline = (disabled) => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    background: "#fff",
    color: DARK,
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    whiteSpace: "nowrap",
  });

  const paymentSelectStyle = (disabled) => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    border: `2px solid ${DARK}`,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    appearance: "none",
  });

  // modal styles
  const overlay = {
    position: "fixed",
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

  const bigBtnDark = (disabled) => ({
    padding: "12px 16px",
    borderRadius: 999,
    background: DARK,
    color: "#fff",
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    minWidth: 200,
  });

  const bigBtnOutline = (disabled) => ({
    padding: "12px 16px",
    borderRadius: 999,
    background: "#fff",
    color: DARK,
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    minWidth: 200,
  });

  const SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon, exact: true },
    { label: "Appointment Booking", to: "/admin/appointment-booking", IconComp: CalendarIcon, exact: true },
    { label: "Data Records", to: "/admin/data-records", IconComp: ResultsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
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
              <div style={brandText}>AXIS</div>
            </div>
          ) : (
            <div style={headerBadge} title="AXIS">
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
              <div style={burger} title="Menu" onClick={() => setSideOpen(true)}>
                ☰
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Appointment Booking</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Approved appointments only</div>
            </div>
          </div>

          {/* Admin dropdown */}
          <div style={rightTop} ref={menuRef}>
            <div style={adminIdWrap}>
              <div style={adminIdLabel}>{idLabelText}</div>
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
                <div style={ddName}>{adminProfile?.email || "Admin"}</div>
                <div style={ddSub}>{idLabelText}</div>
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
                <div style={filterLabel}>Payment Status</div>
                <select
                  name="paymentStatus"
                  value={filters.paymentStatus}
                  onChange={onFilterChange}
                  style={filterControl}
                  disabled={loading || completeSaving}
                >
                  {paymentStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  disabled={loading || completeSaving}
                />
              </div>

              <div style={filterBtns}>
                <button type="button" style={filterBtn(loading)} onClick={load} disabled={loading}>
                  Refresh
                </button>
                <button type="button" style={filterBtn(false)} onClick={() => setFilters({ paymentStatus: "All", date: "" })}>
                  Reset
                </button>
              </div>
            </div>

            {/* TABLE PANEL */}
            <div style={tablePanel}>
              <div style={tableHeader}>
                <div>Full Name of Patient</div>
                <div>Patient ID</div>
                <div>Date of Appointment</div>
                <div>Procedure</div>
                <div>Payment Status</div>
                <div>View Receipt</div>
                <div>Upload Result</div>
              </div>

              <div style={tableBody}>
                {loading ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading appointments...</div>
                ) : filteredRows.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>
                    No Approved appointments found.
                  </div>
                ) : (
                  filteredRows.map((a) => {
                    const apptId = String(a._id || "");

                    const patient = a.patientId || null;
                    const patientName = typeof patient === "object" ? fullNameProfileStyle(patient) : "—";
                    const patientId = getPatientIdValue(patient);

                    const dt = toDateObj(a);
                    const dateText = dt ? dt.toLocaleDateString() : "—";

                    const bill = billsMap?.[apptId] || null;
                    const billId = bill?._id ? String(bill._id) : "";

                    const receiptRaw = getReceiptRawFromBill(bill);
                    const receiptUrl = normalizeFileUrl(receiptRaw);
                    const hasReceipt = Boolean(receiptUrl);

                    const statusRaw = bill?.status || "";
                    const payValue = normalizePaymentStatus(statusRaw, hasReceipt);

                    const rowBusy = completeSaving || paySavingId === apptId;

                    return (
                      <div key={apptId} style={rowStyle}>
                        <div style={{ fontWeight: 900 }}>{patientName}</div>
                        <div>{patientId}</div>
                        <div>{dateText}</div>
                        <div>{a?.procedure || "—"}</div>

                        <div>
                          <select
                            value={payValue}
                            disabled={rowBusy}
                            style={paymentSelectStyle(rowBusy)}
                            title={!billId ? "No bill yet — changing this will create one." : "Edit payment status"}
                            onChange={(e) => updateBillStatusForAppointment(apptId, billId, e.target.value)}
                          >
                            {PAYMENT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          {hasReceipt ? (
                            <button type="button" style={btnDark(false)} onClick={() => openReceiptModal(receiptUrl)}>
                              View
                            </button>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            style={btnOutline(false)}
                            onClick={() => openCompleteModal(a)}
                            disabled={completeSaving}
                          >
                            Upload
                          </button>
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

        {/* RECEIPT MODAL */}
        {receiptOpen && receiptUrlView ? (
          <div style={overlay} onClick={closeReceiptModal} role="dialog" aria-modal="true" aria-label="View receipt">
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
                    <button type="button" style={bigBtnOutline(false)} onClick={closeReceiptModal}>
                      Close
                    </button>

                    <button type="button" style={bigBtnDark(false)} onClick={() => openReceiptInNewTab(receiptUrlView)}>
                      Open in new tab
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* UPLOAD RESULT MODAL */}
        {showCompleteModal ? (
          <div style={overlay} onClick={closeCompleteModal} role="dialog" aria-modal="true" aria-label="Upload result">
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={modalTitle}>Upload Result</h2>
                <div style={modalSub}>
                  {completeAppt?.procedure || "-"} • {completeAppt ? toDateObj(completeAppt)?.toLocaleDateString() : "-"}
                </div>
              </div>

              <div style={modalInner}>
                <div style={card}>
                  <div style={{ display: "grid", gap: 12 }}>
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
                    </div>

                    <div>
                      <div style={cardLabel}>Upload Result File (PDF/DICOM) *</div>
                      <input
                        type="file"
                        accept=".pdf,.dcm,.dicom,application/pdf,application/dicom"
                        style={inputLight}
                        disabled={completeSaving}
                        onChange={(e) => setCompletePdf(e.target.files?.[0] || null)}
                      />
                      <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                        PDF or DICOM (.dcm). Max 10MB.
                      </div>
                    </div>

                    <div>
                      <div style={cardLabel}>Description *</div>
                      <textarea
                        style={textareaLight}
                        rows={4}
                        value={completeNotes}
                        disabled={completeSaving}
                        onChange={(e) => setCompleteNotes(e.target.value)}
                        placeholder="Enter findings, remarks, or summary..."
                      />
                    </div>

                    <div>
                      <div style={cardLabel}>Impression *</div>
                      <textarea
                        style={textareaLight}
                        rows={4}
                        value={completeImpression}
                        disabled={completeSaving}
                        onChange={(e) => setCompleteImpression(e.target.value)}
                        placeholder="Enter impression..."
                      />
                    </div>
                  </div>

                  <div style={modalBtns}>
                    <button type="button" style={bigBtnOutline(completeSaving)} disabled={completeSaving} onClick={closeCompleteModal}>
                      Cancel
                    </button>

                    <button
                      type="button"
                      style={bigBtnDark(
                        completeSaving ||
                          !completePdf ||
                          !completeNotes.trim() ||
                          !completeImpression.trim() ||
                          !completeBillingCode
                      )}
                      disabled={
                        completeSaving ||
                        !completePdf ||
                        !completeNotes.trim() ||
                        !completeImpression.trim() ||
                        !completeBillingCode
                      }
                      onClick={submitComplete}
                    >
                      {completeSaving ? "Saving..." : "Submit"}
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