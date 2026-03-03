// frontend/src/pages/Profile.jsx
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
function ageFromBirthdate(birthdate) {
  if (!birthdate) return "-";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default function Profile() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebar = () => setSideOpen((v) => !v);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem("token");

      // If no patient token, redirect appropriately
      if (!token) {
        const adminToken = localStorage.getItem("adminToken");
        if (adminToken) return nav("/admin");
        return nav("/login");
      }

      try {
        setMsg("");
        setLoading(true);

        const me = await apiGet("/api/auth/me", token);
        if (!mounted) return;
        setProfile(me);

        const mine = await apiGet("/api/appointments/mine", token);
        if (!mounted) return;
        setAppointments(Array.isArray(mine) ? mine : []);
      } catch (err) {
        if (mounted) setMsg(err.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

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
    // Clear both (prevents mixed sessions)
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    nav("/login");
  }

  const counts = useMemo(() => {
    const c = { Pending: 0, Approved: 0, Completed: 0, Cancelled: 0, Rejected: 0, total: 0 };
    for (const a of appointments) {
      c.total++;
      if (c[a.status] !== undefined) c[a.status]++;
    }
    return c;
  }, [appointments]);

  const fullName = useMemo(() => {
    if (!profile) return "";
    const base = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(", ");
    return `${base}${profile.suffix ? `, ${profile.suffix}` : ""}`;
  }, [profile]);


  const patientIdShort = useMemo(() => {
  if (profile?.bsrtId) return String(profile.bsrtId).trim();
  if (profile?._id) return String(profile._id).slice(-8).toUpperCase();
  return "—";
  }, [profile]);

  const birthdateText = useMemo(() => {
    if (!profile?.birthdate) return "-";
    const d = new Date(profile.birthdate);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  }, [profile]);

  /* ---------- ROLE (PATIENT vs ADMIN) ---------- */
  // Source of truth: role in MongoDB
  const roleClean = useMemo(() => String(profile?.role || profile?.userType || "").trim().toLowerCase(), [profile]);

  // Admin UI if role is admin OR superadmin (fallback: legacy boolean if backend returns it)
  const isAdmin = roleClean === "admin" || roleClean === "superadmin" || profile?.isAdmin === true;

  // Super admin ONLY when role is exactly superadmin
  const isSuperAdmin = roleClean === "superadmin";

  // ✅ Super Admin Panel button only for superadmin
  const canSeeSuperAdminPanel = isSuperAdmin;

  /* ---------- SIDEBAR ITEMS ---------- */
  const PATIENT_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon },
    { label: "My Bills", to: "/bills", IconComp: BillsIcon },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  // ✅ No Super Admin Panel in sidebar
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

  /* ---------- STYLES (COMPACT) ---------- */
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

  const pillsRow = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 8 };

  const pill = {
    borderRadius: 999,
    border: `3px solid ${DARK}`,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fff",
    minHeight: 52,
  };

  const pillLabel = { fontSize: 12, color: "#0f172a", fontWeight: 800 };
  const pillValue = { fontSize: 18, fontWeight: 900, color: DARK, letterSpacing: 0.5 };

  const panels = {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
    marginTop: 12,
    flex: "1 1 auto",
    overflow: "hidden",
  };

  const panel = {
    borderRadius: 28,
    border: `3px solid ${DARK}`,
    padding: "14px 16px",
    minHeight: 300,
    background: "#fff",
    overflow: "hidden",
  };

  const infoLabel = { fontSize: 13, color: "#0f172a", marginTop: 10, fontWeight: 800 };
  const infoValue = { fontSize: 20, fontWeight: 900, color: DARK, marginTop: 2, lineHeight: 1.1 };

  const updatesList = {
    marginTop: 10,
    paddingLeft: 18,
    color: "#0f172a",
    fontWeight: 800,
    lineHeight: 1.55,
  };

  const rightTop = { display: "flex", alignItems: "center", gap: 12, position: "relative" };
  const patientIdWrap = { textAlign: "right", lineHeight: 1.1 };

  const idLabelText = isAdmin ? (isSuperAdmin ? "Superadmin ID" : "Admin ID") : "Patient ID";
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
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Home</div>
              <div style={{ opacity: 0.95, fontSize: 13, fontWeight: 700 }}>Manage your profile and appointments</div>
            </div>
          </div>

          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>{idLabelText}</div>
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
                <div style={ddName}>{fullName || "Account"}</div>
                <div style={ddSub}>{idLabelText}</div>
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

                {/* ✅ Super Admin Panel link only for role=superadmin */}
                {canSeeSuperAdminPanel ? (
                  <>
                    <div style={ddDivider} />
                    <Link
                      to="/admin/super"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        ...ddBtnBase,
                        background: "#fff",
                        color: DARK,
                        border: "2px solid rgba(255,255,255,.9)",
                        width: "100%",
                      }}
                    >
                      <SuperAdminIcon size={18} />
                      Super Admin Panel
                    </Link>
                  </>
                ) : null}
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
          <div style={{ color: "#64748b" }}>Loading profile...</div>
        ) : !profile ? (
          <div style={{ color: "#64748b" }}>No profile found.</div>
        ) : (
          <>
            <div style={sectionTitle}>Appointments</div>
            <p style={sectionSub}>Review the status of your appointments</p>

            <div style={pillsRow}>
              <div style={pill}>
                <div style={pillLabel}>Total</div>
                <div style={pillValue}>{counts.total || 0}</div>
              </div>
              <div style={pill}>
                <div style={pillLabel}>Pending</div>
                <div style={pillValue}>{counts.Pending || 0}</div>
              </div>
              <div style={pill}>
                <div style={pillLabel}>Approved</div>
                <div style={pillValue}>{counts.Approved || 0}</div>
              </div>
              <div style={pill}>
                <div style={pillLabel}>Completed</div>
                <div style={pillValue}>{counts.Completed || 0}</div>
              </div>
            </div>

            <div style={panels}>
              <div style={{ overflow: "hidden" }}>
                <div style={sectionTitle}>{isAdmin ? "Admin Information" : "Patient Information"}</div>
                <p style={sectionSub}>Details from your account profile</p>

                <div style={panel}>
                  <div style={infoLabel}>Full Name</div>
                  <div style={infoValue}>{fullName || "-"}</div>

                  <div style={infoLabel}>Contact Number</div>
                  <div style={infoValue}>{profile.contactNumber || "-"}</div>

                  <div style={infoLabel}>Birthdate</div>
                  <div style={infoValue}>{birthdateText}</div>

                  <div style={infoLabel}>Age</div>
                  <div style={infoValue}>{ageFromBirthdate(profile.birthdate)}</div>

                  <div style={infoLabel}>Sex</div>
                  <div style={infoValue}>{profile.gender || "-"}</div>

                  <div style={infoLabel}>Email Address</div>
                  <div style={{ ...infoValue, fontSize: 18, wordBreak: "break-word" }}>{profile.email || "-"}</div>

                  <div style={infoLabel}>Home Address</div>
                  <div style={{ ...infoValue, fontSize: 18, wordBreak: "break-word" }}>{profile.address || "-"}</div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      to="/appointments"
                      style={{
                        textDecoration: "none",
                        background: DARK,
                        color: "#fff",
                        padding: "8px 12px",
                        borderRadius: 12,
                        fontWeight: 900,
                      }}
                    >
                      Book Appointment
                    </Link>

                    <Link
                      to="/profile/edit"
                      style={{
                        textDecoration: "none",
                        border: `2px solid ${DARK}`,
                        color: DARK,
                        padding: "8px 12px",
                        borderRadius: 12,
                        fontWeight: 900,
                      }}
                    >
                      Edit Profile
                    </Link>
                  </div>
                </div>
              </div>

              <div style={{ overflow: "hidden" }}>
                <div style={sectionTitle}>Updates</div>
                <p style={sectionSub}>Shows your most recent account changes</p>

                <div style={panel}>
                  <ul style={updatesList}>
                    <li>xx</li>
                    <li>xx</li>
                    <li>xx</li>
                    <li>xx</li>
                    <li>xx</li>
                    <li>xx</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}