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

function safeTime(v) {
  const d = v instanceof Date ? v : new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function fmtShort(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString();
}

export default function Profile() {
  const nav = useNavigate();
  const loc = useLocation();

  // Mobile/Tablet uses the NEW layout; Desktop/Laptop uses the OLD layout
  const isNarrow = useMediaQuery("(max-width: 1024px)");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // OLD desktop layout sidebar
  const [sideOpen, setSideOpen] = useState(true);

  // NEW mobile/tablet drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Close drawer on route change (mobile/tablet)
  useEffect(() => {
    if (isNarrow) setDrawerOpen(false);
  }, [loc.pathname, isNarrow]);

  // Also close drawer when switching to desktop
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

  // Close account menu when clicking outside / Esc
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
    setDrawerOpen(false);
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
  const roleClean = useMemo(() => String(profile?.role || profile?.userType || "").trim().toLowerCase(), [profile]);
  const isAdmin = roleClean === "admin" || roleClean === "superadmin" || profile?.isAdmin === true;
  const isSuperAdmin = roleClean === "superadmin";
  const canSeeSuperAdminPanel = isSuperAdmin;

  // ✅ Route split: patient uses /appointments, admin/superadmin uses /admin/appointment-booking
  const appointmentsRoute = useMemo(
    () => (isAdmin ? "/admin/appointment-booking" : "/appointments"),
    [isAdmin]
  );

  /* ---------- UPDATES ---------- */
  const updates = useMemo(() => {
    const list = [];

    if (profile?.updatedAt) {
      const at = new Date(profile.updatedAt);
      list.push({
        at,
        key: `profile-${safeTime(at)}`,
        type: "profile",
        title: "Account updated",
        detail: "Your profile information was updated.",
        cta: { to: "/profile/edit", label: "Review" },
      });
    }

    for (const a of Array.isArray(appointments) ? appointments : []) {
      const status = String(a?.status || "Pending").trim();
      const proc = String(a?.procedure || "Appointment").trim() || "Appointment";
      const sched = toDateObj(a);
      const schedText = sched ? fmtShort(sched) : "-";
      const at = new Date(a?.updatedAt || a?.createdAt || Date.now());

      if (status === "Completed") {
        list.push({
          at,
          key: `appt-${String(a?._id || proc)}-${safeTime(at)}-completed`,
          type: "appt",
          title: "Result ready",
          detail: `${proc} (${schedText}) has been completed. Your results are available in Diagnostic Results.`,
          cta: { to: "/diagnostic-results", label: "View results" },
        });
        continue;
      }

      if (status === "Approved") {
        list.push({
          at,
          key: `appt-${String(a?._id || proc)}-${safeTime(at)}-approved`,
          type: "appt",
          title: "Appointment approved",
          detail: `${proc} (${schedText}) has been approved.`,
          cta: { to: appointmentsRoute, label: "View appointments" },
        });
        continue;
      }

      if (status === "Rejected") {
        list.push({
          at,
          key: `appt-${String(a?._id || proc)}-${safeTime(at)}-rejected`,
          type: "appt",
          title: "Appointment rejected",
          detail: `${proc} (${schedText}) was rejected.`,
          cta: { to: appointmentsRoute, label: "View" },
        });
        continue;
      }

      if (status === "Cancelled") {
        list.push({
          at,
          key: `appt-${String(a?._id || proc)}-${safeTime(at)}-cancelled`,
          type: "appt",
          title: "Appointment cancelled",
          detail: `${proc} (${schedText}) was cancelled.`,
          cta: { to: appointmentsRoute, label: "View" },
        });
        continue;
      }

      list.push({
        at,
        key: `appt-${String(a?._id || proc)}-${safeTime(at)}-pending`,
        type: "appt",
        title: "Appointment requested",
        detail: `${proc} (${schedText}) is pending approval.`,
        cta: { to: appointmentsRoute, label: "View" },
      });
    }

    list.sort((x, y) => safeTime(y.at) - safeTime(x.at));
    return list;
  }, [profile, appointments, appointmentsRoute]);

  const updatesTop = useMemo(() => updates.slice(0, 6), [updates]);

  /* ---------- SIDEBAR ITEMS ---------- */
  const PATIENT_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon },
    { label: "My Bills", to: "/bills", IconComp: BillsIcon },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  const ADMIN_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: CalendarIcon, exact: true },
    { label: "Appointment Booking", to: "/admin/appointment-booking", IconComp: CalendarIcon, exact: true },
    { label: "Data Records", to: "/admin/data-records", IconComp: ResultsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  const SIDE_ITEMS = isAdmin ? ADMIN_SIDE_ITEMS : PATIENT_SIDE_ITEMS;

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  const idLabelText = isAdmin ? (isSuperAdmin ? "Superadmin ID" : "Admin ID") : "Patient ID";

  /* =========================================================
     NEW LAYOUT (Mobile/Tablet) — uses global CSS in index.css
     ========================================================= */
  if (isNarrow) {
    const rootClass = ["profileShell", "narrow", drawerOpen ? "drawerOpen" : ""].filter(Boolean).join(" ");

    return (
      <div className={rootClass} style={{ "--dark": "#0b3d2e", "--bg": "#ffffff" }}>
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
                <button type="button" className="burger" title="Menu" onClick={() => setDrawerOpen((v) => !v)} aria-label="Open menu">
                  ☰
                </button>

                <div>
                  <div className="homeTitle">Home</div>
                  <div className="homeSub">Manage your profile and appointments</div>
                </div>
              </div>

              <div className="rightTop" ref={menuRef}>
                <div className="patientIdWrap">
                  <div className="patientIdLabel">{idLabelText}</div>
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
                    <div className="ddSub">{idLabelText}</div>
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

                    {canSeeSuperAdminPanel ? (
                      <>
                        <div className="ddDivider" />
                        <Link to="/admin/super" onClick={() => setMenuOpen(false)} className="ddBtn ddBtnFull">
                          <SuperAdminIcon size={18} />
                          Super Admin Panel
                        </Link>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="content">
            <div className="contentInner">
              {msg ? <div className="msgWarn">{msg}</div> : null}

              {loading ? (
                <div className="muted">Loading profile...</div>
              ) : !profile ? (
                <div className="muted">No profile found.</div>
              ) : (
                <>
                  <div className="sectionTitle">Appointments</div>
                  <p className="sectionSub">Review the status of your appointments</p>

                  <div className="pillsRow">
                    <div className="pill">
                      <div className="pillLabel">Total</div>
                      <div className="pillValue">{counts.total || 0}</div>
                    </div>
                    <div className="pill">
                      <div className="pillLabel">Pending</div>
                      <div className="pillValue">{counts.Pending || 0}</div>
                    </div>
                    <div className="pill">
                      <div className="pillLabel">Approved</div>
                      <div className="pillValue">{counts.Approved || 0}</div>
                    </div>
                    <div className="pill">
                      <div className="pillLabel">Completed</div>
                      <div className="pillValue">{counts.Completed || 0}</div>
                    </div>
                  </div>

                  <div className="panels">
                    <section>
                      <div className="sectionTitle">{isAdmin ? "Admin Information" : "Patient Information"}</div>
                      <p className="sectionSub">Details from your account profile</p>

                      <div className="panel">
                        <div className="infoLabel">Full Name</div>
                        <div className="infoValue">{fullName || "-"}</div>

                        <div className="infoLabel">Contact Number</div>
                        <div className="infoValue">{profile.contactNumber || "-"}</div>

                        <div className="infoLabel">Birthdate</div>
                        <div className="infoValue">{birthdateText}</div>

                        <div className="infoLabel">Age</div>
                        <div className="infoValue">{ageFromBirthdate(profile.birthdate)}</div>

                        <div className="infoLabel">Sex</div>
                        <div className="infoValue">{profile.gender || "-"}</div>

                        <div className="infoLabel">Email Address</div>
                        <div className="infoValue infoValueWrap">{profile.email || "-"}</div>

                        <div className="infoLabel">Home Address</div>
                        <div className="infoValue infoValueWrap">{profile.address || "-"}</div>

                        <div className="actionsRow">
                          {/* ✅ patient -> /appointments, admin/superadmin -> /admin/appointment-booking */}
                          <Link to={appointmentsRoute} className="btnPrimary">
                            Book Appointment
                          </Link>

                          <Link to="/profile/edit" className="btnOutline">
                            Edit Profile
                          </Link>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="sectionTitle">Updates</div>
                      <p className="sectionSub">Shows your most recent account changes</p>

                      <div className="panel">
                        <ul className="updatesList">
                          {updatesTop.length ? (
                            updatesTop.map((u) => (
                              <li key={u.key} className="updateItem">
                                <span className="updateMeta">{fmtShort(u.at)}</span>
                                <span className="updateTitle">{u.title}:</span>{" "}
                                <span className="updateText">{u.detail}</span>
                                {u?.cta?.to ? (
                                  <Link to={u.cta.to} className="updateLink">
                                    {u.cta.label || "Open"}
                                  </Link>
                                ) : null}
                              </li>
                            ))
                          ) : (
                            <li>No updates yet.</li>
                          )}
                        </ul>
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* =========================================================
     OLD LAYOUT (Desktop/Laptop) — original inline-styled UI
     ========================================================= */

  const toggleSidebarDesktop = () => setSideOpen((v) => !v);

  /* ---------- STYLES (OLD / DESKTOP) ---------- */
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

  const updateItemTitle = { fontWeight: 900, color: "#0f172a" };
  const updateItemMeta = { fontSize: 12, fontWeight: 900, color: "#334155", marginRight: 6 };
  const updateItemLink = { marginLeft: 8, fontSize: 12, fontWeight: 900, color: DARK, textDecoration: "underline" };

  const rightTop = { display: "flex", alignItems: "center", gap: 12, position: "relative" };
  const patientIdWrap = { textAlign: "right", lineHeight: 1.1 };

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
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Home</div>
              <div style={{ opacity: 0.95, fontSize: 13, fontWeight: 700 }}>Manage your profile and appointments</div>
            </div>
          </div>

          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>{idLabelText}</div>
              <div style={patientIdValue}>{patientIdShort}</div>
            </div>

            <button type="button" style={profileToggleBtn} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} title="Account menu">
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
                    {/* ✅ patient -> /appointments, admin/superadmin -> /admin/appointment-booking */}
                    <Link
                      to={appointmentsRoute}
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
                    {updatesTop.length ? (
                      updatesTop.map((u) => (
                        <li key={u.key} style={{ marginBottom: 10 }}>
                          <span style={updateItemMeta}>{fmtShort(u.at)}</span>
                          <span style={updateItemTitle}>{u.title}:</span> <span>{u.detail}</span>
                          {u?.cta?.to ? (
                            <Link to={u.cta.to} style={updateItemLink}>
                              {u.cta.label || "Open"}
                            </Link>
                          ) : null}
                        </li>
                      ))
                    ) : (
                      <li>No updates yet.</li>
                    )}
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