// frontend/src/pages/SuperAdminPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../api";
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

/* ---------- ADMIN ICONS (for sidebar) ---------- */
const ApprovalIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M8 3v3M16 3v3M3 9h18" />
    <path d="M8 14l2 2 4-4" />
  </Icon>
);

const BookingIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M8 3v3M16 3v3M3 9h18" />
    <path d="M12 13v6M9 16h6" />
  </Icon>
);

const RecordsIcon = (p) => (
  <Icon {...p}>
    <path d="M7 3h10v18H7z" />
    <path d="M9 7h6M9 11h6M9 15h6" />
  </Icon>
);

const AdminInfoIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="12" r="2" />
    <path d="M6.5 16c1.6-2 4.4-2 6 0" />
    <path d="M14 10h5M14 14h5" />
  </Icon>
);

const SuperAdminIcon = (p) => (
  <Icon {...p}>
    <path d="M12 2l8 4v6c0 5-3.2 9.6-8 10-4.8-.4-8-5-8-10V6l8-4z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

/* ---------- HELPERS ---------- */
function safeErr(err, fallback) {
  if (err && typeof err === "object" && "message" in err) return err.message || fallback;
  return fallback;
}

export default function SuperAdminPanel() {
  const nav = useNavigate();
  const loc = useLocation();

  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebar = () => setSideOpen((v) => !v);

  // ✅ POPUP MODALS
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // super admin content state
  const [admins, setAdmins] = useState([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin"); // ✅ NEW: admin | superadmin
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { email, role, bsrtAdminId, inviteLink, expiresAt }

  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "admin",
  });
  const [createSaving, setCreateSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "admin",
    isArchived: false,
  });

  // Which backend admin-users API exists
  const [adminApiMode, setAdminApiMode] = useState("patients");

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!token) return nav("/login");

      try {
        setMsg("");
        setLoading(true);

        const me = await apiGet("/api/auth/me", token);
        if (!mounted) return;
        setProfile(me);

        // ✅ Role-based access: only superadmin can access this page
        const roleClean = String(me?.role || "").trim().toLowerCase();
        const canSee = roleClean === "superadmin" || me?.isSuperAdmin === true;
        if (!canSee) return nav("/profile");

        await loadAdmins(mounted, token);
      } catch (err) {
        if (mounted) setMsg(safeErr(err, "Request failed"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nav, token]);

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

  async function loadAdmins(mounted, tkn) {
    try {
      const data = await apiGet("/api/admin/users", tkn);
      if (!mounted) return;
      setAdmins(Array.isArray(data) ? data : []);
      setAdminApiMode("users");
      return;
    } catch {
      const data2 = await apiGet("/api/admin/super/admins", tkn);
      if (!mounted) return;
      setAdmins(Array.isArray(data2) ? data2 : []);
      setAdminApiMode("super");
    }
  }

  function logout() {
    setMenuOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    nav("/login");
  }

  const roleClean = useMemo(() => String(profile?.role || "").trim().toLowerCase(), [profile]);
  const isAdmin = roleClean === "admin" || roleClean === "superadmin" || profile?.isAdmin === true;
  const isSuperAdmin = roleClean === "superadmin" || profile?.isSuperAdmin === true;

  const fullName = useMemo(() => {
    if (!profile) return "";
    const base = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(", ");
    return `${base}${profile.suffix ? `, ${profile.suffix}` : ""}`;
  }, [profile]);

  // ✅ show new BSRT ID format if present (for the superadmin patient account)
  const idShort = useMemo(() => {
    if (profile?.bsrtId) return String(profile.bsrtId).trim();
    if (profile?._id) return String(profile._id).slice(-8).toUpperCase();
    return "—";
  }, [profile]);

  const filteredAdmins = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = Array.isArray(admins) ? admins : [];

    return list
      .filter((a) => (showArchived ? true : !a?.isArchived))
      .filter((a) => {
        if (!q) return true;
        const adminId = a?.bsrtAdminId || a?.bsrtId || "";
        const hay = `${adminId} ${a?.firstName || ""} ${a?.lastName || ""} ${a?.email || ""} ${a?.role || ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [admins, search, showArchived]);

  async function generateInvite() {
    setMsg("");
    setInviteResult(null);

    const email = String(inviteEmail || "").trim().toLowerCase();
    const role = String(inviteRole || "admin").trim().toLowerCase();

    if (!email) return setMsg("Email is required.");
    if (!["admin", "superadmin"].includes(role)) return setMsg("Invalid role.");

    setInviteSending(true);
    try {
      // ✅ include role so backend reserves BSRTAdmin ID + role in the invite
      const data = await apiPost("/api/admin/invites", { email, role, expiresInDays: 5 }, token);

      const inviteLink = data?.inviteLink || data?.link || "";
      const expiresAt = data?.expiresAt || data?.expires || "";
      const bsrtAdminId = data?.bsrtAdminId || "";

      setInviteResult({
        email,
        role: data?.role || role,
        bsrtAdminId,
        inviteLink,
        expiresAt,
      });

      if (inviteLink && navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(inviteLink);
        } catch {}
      }

      setMsg("Invite generated. (Link copied if allowed.)");
    } catch (err) {
      setMsg(safeErr(err, "Failed to generate invite"));
    } finally {
      setInviteSending(false);
    }
  }

  async function createAdmin() {
    setMsg("");

    const payload = {
      firstName: String(createForm.firstName || "").trim(),
      lastName: String(createForm.lastName || "").trim(),
      email: String(createForm.email || "").trim().toLowerCase(),
      password: String(createForm.password || ""),
      role: String(createForm.role || "admin"),
    };

    if (!payload.firstName || !payload.lastName) return setMsg("First name and last name are required.");
    if (!payload.email) return setMsg("Email is required.");
    if (!payload.password || payload.password.length < 8) return setMsg("Password must be at least 8 characters.");

    setCreateSaving(true);
    try {
      const path = adminApiMode === "users" ? "/api/admin/users" : "/api/admin/super/admins";
      await apiPost(path, payload, token);

      setCreateForm({ firstName: "", lastName: "", email: "", password: "", role: "admin" });
      setCreateOpen(false);
      await loadAdmins(true, token);
      setMsg("Admin created.");
    } catch (err) {
      setMsg(safeErr(err, "Failed to create admin"));
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(a) {
    setEditId(String(a?._id || ""));
    setEditForm({
      firstName: a?.firstName || "",
      lastName: a?.lastName || "",
      email: a?.email || "",
      role: a?.role || "admin",
      isArchived: !!a?.isArchived,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setMsg("");
    if (!editId) return;

    const payload = {
      firstName: String(editForm.firstName || "").trim(),
      lastName: String(editForm.lastName || "").trim(),
      email: String(editForm.email || "").trim().toLowerCase(),
      role: String(editForm.role || "admin"),
      isArchived: !!editForm.isArchived,
    };

    if (!payload.firstName || !payload.lastName) return setMsg("First name and last name are required.");
    if (!payload.email) return setMsg("Email is required.");

    setEditSaving(true);
    try {
      const base = adminApiMode === "users" ? "/api/admin/users" : "/api/admin/super/admins";
      await apiPatch(`${base}/${editId}`, token, payload);

      await loadAdmins(true, token);
      setEditOpen(false);
      setMsg("Admin updated.");
    } catch (err) {
      setMsg(safeErr(err, "Failed to update admin"));
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleArchive(a) {
    setMsg("");
    const id = String(a?._id || "");
    if (!id) return;

    try {
      const base = adminApiMode === "users" ? "/api/admin/users" : "/api/admin/super/admins";
      await apiPatch(`${base}/${id}`, token, { isArchived: !a?.isArchived });
      await loadAdmins(true, token);
      setMsg(!a?.isArchived ? "Admin archived." : "Admin restored.");
    } catch (err) {
      setMsg(safeErr(err, "Failed to update archive status"));
    }
  }

  /* ---------- SIDEBAR ITEMS ---------- */
  const PATIENT_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon },
    { label: "My Bills", to: "/bills", IconComp: BillsIcon },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  // ✅ No "Super Admin Panel" button in sidebar (you're already here)
  const ADMIN_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: ApprovalIcon, exact: true },
    { label: "Appointment Booking", to: "/appointments", IconComp: BookingIcon },
    { label: "Data Records", to: "/admin/data-records", IconComp: RecordsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: AdminInfoIcon, exact: true },
  ];

  const SIDE_ITEMS = isAdmin ? ADMIN_SIDE_ITEMS : PATIENT_SIDE_ITEMS;

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  /* ---------- STYLES (copied from Profile.jsx) ---------- */
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

  const sideFooter = {
    padding: "14px 14px 18px",
    color: "rgba(255,255,255,.92)",
    fontWeight: 700,
    fontSize: 12.5,
  };

  const footerRow = { display: "flex", alignItems: "center", gap: 10, marginTop: 10 };

  const main = {
    padding: "0 24px 16px",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const topbar = {
    height: 84,
    borderRadius: "0 0 22px 22px",
    background: "linear-gradient(90deg, #0b3d2e 0%, #1f5f45 100%)",
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

  const avatar = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid rgba(255,255,255,.9)",
    background: "#fff",
    display: "block",
  };

  const sectionTitle = { fontSize: 24, fontWeight: 900, margin: "10px 0 0", color: "#0f172a", lineHeight: 1.05 };
  const sectionSub = { margin: "4px 0 0", color: "#334155", fontSize: 13, fontWeight: 700 };

  const panel = {
    borderRadius: 28,
    border: `3px solid ${DARK}`,
    padding: "14px 16px",
    background: "#fff",
    overflow: "hidden",
  };

  const fieldLabel = { fontSize: 13, color: "#0f172a", fontWeight: 800, marginTop: 10 };
  const input = {
    width: "100%",
    height: 46,
    borderRadius: 12,
    border: `2px solid ${DARK}`,
    padding: "0 12px",
    fontWeight: 800,
    outline: "none",
    marginTop: 6,
  };

  const select = { ...input, background: "#fff" };

  const btnPrimary = {
    borderRadius: 12,
    border: `2px solid ${DARK}`,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    padding: "10px 12px",
    cursor: "pointer",
  };

  const btnOutline = {
    borderRadius: 12,
    border: `2px solid ${DARK}`,
    background: "#fff",
    color: DARK,
    fontWeight: 900,
    padding: "10px 12px",
    cursor: "pointer",
  };

  const table = { width: "100%", borderCollapse: "collapse", marginTop: 12 };
  const th = { textAlign: "left", fontWeight: 900, fontSize: 12, padding: "10px 8px", borderBottom: "2px solid #e2e8f0" };
  const td = { padding: "10px 8px", borderBottom: "1px solid #e2e8f0", fontWeight: 800, fontSize: 13 };

  const modalOverlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 999,
  };

  const modal = {
    width: "min(720px, 100%)",
    background: "#fff",
    borderRadius: 18,
    border: `3px solid ${DARK}`,
    padding: 16,
  };

  const rightTop = { display: "flex", alignItems: "center", gap: 12, position: "relative" };
  const patientIdWrap = { textAlign: "right", lineHeight: 1.1 };

  const idLabelText = "Superadmin ID";
  const patientIdLabel = { fontSize: 14, fontWeight: 800 };
  const patientIdValue = { fontSize: 12, opacity: 0.9 };

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
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Super Admin Panel</div>
              <div style={{ opacity: 0.95, fontSize: 13, fontWeight: 700 }}>
                Manage admin users, send invites, archive accounts
              </div>
            </div>
          </div>

          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>{idLabelText}</div>
              <div style={patientIdValue}>{idShort}</div>
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
                <div style={ddName}>{fullName || "Account"}</div>
                <div style={ddSub}>{idLabelText}</div>
                <div style={{ color: "#fff", fontWeight: 900, marginTop: 2 }}>{idShort}</div>

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

        {msg ? (
          <div style={{ padding: "8px 10px", border: "1px solid #f59e0b", background: "#fffbeb", borderRadius: 12, marginBottom: 10 }}>
            {msg}
          </div>
        ) : null}

        {loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : !profile ? (
          <div style={{ color: "#64748b" }}>No profile found.</div>
        ) : (
          <>
            {/* Buttons */}
            <div style={sectionTitle}>Actions</div>
            <p style={sectionSub}>Open the forms using the buttons below.</p>

            <div style={{ ...panel, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                style={btnPrimary}
                onClick={() => {
                  setInviteOpen(true);
                  setInviteResult(null);
                  setInviteEmail("");
                  setInviteRole("admin");
                }}
              >
                Invite New Admin
              </button>

              <button
                type="button"
                style={btnOutline}
                onClick={() => {
                  setCreateOpen(true);
                  setCreateForm({ firstName: "", lastName: "", email: "", password: "", role: "admin" });
                }}
              >
                Manual Add Admin
              </button>

              <button type="button" style={btnOutline} onClick={() => loadAdmins(true, token)}>
                Refresh Admins
              </button>
            </div>

            {/* ADMIN LIST */}
            <div style={sectionTitle}>Admins</div>
            <p style={sectionSub}>Edit / Archive / Restore admin accounts.</p>

            <div style={panel}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...input, maxWidth: 360 }}
                  placeholder="Search id/name/email/role"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: "#0f172a" }}>
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Show archived
                </label>
              </div>

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Admin ID</th>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Role</th>
                    <th style={th}>Status</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.length ? (
                    filteredAdmins.map((a) => {
                      const adminId = a?.bsrtAdminId || a?.bsrtId || "-";
                      return (
                        <tr key={String(a?._id || a?.email || adminId)}>
                          <td style={td}>{adminId}</td>
                          <td style={td}>{`${a?.firstName || ""} ${a?.lastName || ""}`.trim() || "-"}</td>
                          <td style={{ ...td, wordBreak: "break-all" }}>{a?.email || "-"}</td>
                          <td style={td}>{a?.role || "admin"}</td>
                          <td style={td}>{a?.isArchived ? "Archived" : "Active"}</td>
                          <td style={td}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" style={btnOutline} onClick={() => openEdit(a)}>
                                Edit
                              </button>
                              <button type="button" style={btnPrimary} onClick={() => toggleArchive(a)}>
                                {a?.isArchived ? "Restore" : "Archive"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td style={td} colSpan={6}>
                        No admins found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* INVITE MODAL */}
            {inviteOpen ? (
              <div style={modalOverlay} role="dialog" aria-modal="true">
                <div style={modal}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Invite New Admin</div>
                    <button type="button" style={btnOutline} onClick={() => setInviteOpen(false)} disabled={inviteSending}>
                      Close
                    </button>
                  </div>

                  <div style={fieldLabel}>New Admin Email</div>
                  <input
                    style={input}
                    placeholder="newadmin@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteSending}
                  />

                  {/* ✅ Role selector */}
                  <div style={fieldLabel}>Role</div>
                  <select
                    style={select}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={inviteSending}
                  >
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      style={btnOutline}
                      onClick={() => {
                        setInviteEmail("");
                        setInviteRole("admin");
                        setInviteResult(null);
                      }}
                      disabled={inviteSending}
                    >
                      Clear
                    </button>
                    <button type="button" style={btnPrimary} onClick={generateInvite} disabled={inviteSending}>
                      {inviteSending ? "Sending..." : "Generate & Send Invite"}
                    </button>
                  </div>

                  {inviteResult ? (
                    <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>Invite Details</div>
                      <div style={{ marginTop: 6, fontWeight: 800, color: "#334155" }}>To: {inviteResult.email}</div>
                      <div style={{ marginTop: 4, fontWeight: 800, color: "#334155" }}>Role: {inviteResult.role}</div>
                      {inviteResult.bsrtAdminId ? (
                        <div style={{ marginTop: 4, fontWeight: 800, color: "#334155" }}>
                          Admin ID: {inviteResult.bsrtAdminId}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 4, fontWeight: 800, color: "#334155" }}>
                        Expires: {inviteResult.expiresAt || "5 days"}
                      </div>

                      {inviteResult.inviteLink ? (
                        <>
                          <div style={{ marginTop: 8, fontWeight: 900, wordBreak: "break-all" }}>{inviteResult.inviteLink}</div>
                          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              style={btnOutline}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(inviteResult.inviteLink);
                                  setMsg("Invite link copied.");
                                } catch {
                                  setMsg("Copy failed. Please copy manually.");
                                }
                              }}
                            >
                              Copy Link
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* CREATE MODAL */}
            {createOpen ? (
              <div style={modalOverlay} role="dialog" aria-modal="true">
                <div style={modal}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Manual Add Admin</div>
                    <button type="button" style={btnOutline} onClick={() => setCreateOpen(false)} disabled={createSaving}>
                      Close
                    </button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={fieldLabel}>First Name</div>
                      <input
                        style={input}
                        value={createForm.firstName}
                        onChange={(e) => setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
                        disabled={createSaving}
                      />
                    </div>
                    <div>
                      <div style={fieldLabel}>Last Name</div>
                      <input
                        style={input}
                        value={createForm.lastName}
                        onChange={(e) => setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
                        disabled={createSaving}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 10 }}>
                    <div>
                      <div style={fieldLabel}>Email</div>
                      <input
                        style={input}
                        value={createForm.email}
                        onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                        disabled={createSaving}
                      />
                    </div>
                    <div>
                      <div style={fieldLabel}>Role</div>
                      <select
                        style={select}
                        value={createForm.role}
                        onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                        disabled={createSaving}
                      >
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={fieldLabel}>Temporary Password (min 8 chars)</div>
                    <input
                      style={input}
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      disabled={createSaving}
                    />
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button type="button" style={btnOutline} onClick={() => setCreateOpen(false)} disabled={createSaving}>
                      Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={createAdmin} disabled={createSaving}>
                      {createSaving ? "Saving..." : "Create Admin"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* EDIT MODAL */}
            {editOpen ? (
              <div style={modalOverlay} role="dialog" aria-modal="true">
                <div style={modal}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Edit Admin</div>
                    <button type="button" style={btnOutline} onClick={() => setEditOpen(false)} disabled={editSaving}>
                      Close
                    </button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={fieldLabel}>First Name</div>
                      <input
                        style={input}
                        value={editForm.firstName}
                        onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                        disabled={editSaving}
                      />
                    </div>
                    <div>
                      <div style={fieldLabel}>Last Name</div>
                      <input
                        style={input}
                        value={editForm.lastName}
                        onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                        disabled={editSaving}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 10 }}>
                    <div>
                      <div style={fieldLabel}>Email</div>
                      <input
                        style={input}
                        value={editForm.email}
                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                        disabled={editSaving}
                      />
                    </div>
                    <div>
                      <div style={fieldLabel}>Role</div>
                      <select
                        style={select}
                        value={editForm.role}
                        onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        disabled={editSaving}
                      >
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: "#0f172a" }}>
                      <input
                        type="checkbox"
                        checked={!!editForm.isArchived}
                        onChange={(e) => setEditForm((p) => ({ ...p, isArchived: e.target.checked }))}
                        disabled={editSaving}
                      />
                      Archived
                    </label>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button type="button" style={btnOutline} onClick={() => setEditOpen(false)} disabled={editSaving}>
                      Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={saveEdit} disabled={editSaving}>
                      {editSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}