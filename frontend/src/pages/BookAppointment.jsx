// frontend/src/pages/BookAppointment.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPost, apiGet, apiPatch } from "../api";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  XRAY_BILLING_ITEMS as XRAY_PROCEDURE_ITEMS,
  XRAY_PROCEDURE_LABELS,
  formatPhp,
} from "../constants/procedures";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

const ImageIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 13l2-2 3 3 2-2 3 3" />
    <circle cx="9" cy="10" r="1" />
  </Icon>
);

const RadiographIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
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
  if (!birthdate) return "";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return String(age);
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

// ✅ local-safe YYYY-MM-DD helpers (avoids timezone off-by-one vs toISOString)
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function parseISODateLocal(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ✅ normalize procedure string for "same procedure" checks (frontend)
function normalizeProcedureKeyFront(input) {
  return String(input || "")
    .normalize("NFKC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ---------- ACTIVE MINI CALENDAR (click to select dates) ---------- */
function ActiveCalendar({ valueIso, onChangeIso, minIso, accent = "#0b3d2e" }) {
  const min = minIso || "1900-01-01";
  const selected = valueIso ? parseISODateLocal(valueIso) : null;

  const [view, setView] = useState(() => {
    const base = selected || parseISODateLocal(min) || new Date();
    return monthStart(base);
  });

  // jump calendar to selected month when date changes via input
  useEffect(() => {
    if (!selected) return;
    const m = monthStart(selected);
    if (m.getFullYear() !== view.getFullYear() || m.getMonth() !== view.getMonth()) {
      setView(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIso]);

  const label = useMemo(() => view.toLocaleString(undefined, { month: "long", year: "numeric" }), [view]);

  const prevDisabled = useMemo(() => {
    const prevMonthEnd = new Date(view.getFullYear(), view.getMonth(), 0);
    return toLocalISODate(prevMonthEnd) < min;
  }, [view, min]);

  const week = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDow = first.getDay();
    const gridStart = new Date(view.getFullYear(), view.getMonth(), 1 - startDow);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toLocalISODate(d);
      return {
        d,
        iso,
        inMonth: d.getMonth() === view.getMonth(),
        disabled: iso < min,
        selected: iso === valueIso,
      };
    });
  }, [view, min, valueIso]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button
          type="button"
          onClick={() => setView((v) => monthStart(new Date(v.getFullYear(), v.getMonth() - 1, 1)))}
          disabled={prevDisabled}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.25)",
            background: "#fff",
            cursor: prevDisabled ? "not-allowed" : "pointer",
            opacity: prevDisabled ? 0.4 : 1,
            fontWeight: 900,
          }}
          aria-label="Previous month"
        >
          ‹
        </button>

        <div style={{ fontWeight: 900, color: "#0f172a" }}>{label}</div>

        <button
          type="button"
          onClick={() => setView((v) => monthStart(new Date(v.getFullYear(), v.getMonth() + 1, 1)))}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.25)",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 8 }}>
        {week.map((w) => (
          <div
            key={w}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: 900,
              color: "#334155",
              padding: "4px 0",
              border: "1px solid rgba(0,0,0,.18)",
              borderRadius: 8,
              background: "#f8fafc",
              userSelect: "none",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 4 }}>
        {days.map(({ d, iso, inMonth, disabled, selected: isSelected }) => {
          const canClick = !disabled;
          return (
            <button
              key={iso}
              type="button"
              disabled={!canClick}
              onClick={() => {
                if (!canClick) return;
                onChangeIso(iso);
                if (!inMonth) setView(monthStart(d));
              }}
              style={{
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.22)",
                background: isSelected ? accent : "#fff",
                color: isSelected ? "#fff" : inMonth ? "#0f172a" : "#94a3b8",
                fontWeight: 900,
                cursor: canClick ? "pointer" : "not-allowed",
                opacity: disabled ? 0.35 : 1,
              }}
              aria-label={`Select ${d.toLocaleDateString()}`}
              aria-pressed={isSelected}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- COMING SOON MODAL (Ultrasound block) ---------- */
function ComingSoonModal({ open, onClose, message = "Coming Soon...", accent = "#0b3d2e" }) {
  if (!open) return null;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    zIndex: 5000,
    display: "grid",
    placeItems: "center",
    padding: 16,
  };

  const modal = {
    width: "min(420px, 92vw)",
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    border: `2px solid ${accent}`,
    boxShadow: "0 26px 70px rgba(0,0,0,.45)",
    textAlign: "center",
  };

  const title = { fontWeight: 900, fontSize: 18, color: "#0f172a" };
  const text = { marginTop: 10, fontWeight: 800, color: "#334155" };

  const btn = {
    marginTop: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: accent,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${accent}`,
    cursor: "pointer",
    width: "100%",
  };

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Notice">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={title}>Notice</div>
        <div style={text}>{message}</div>
        <button type="button" style={btn} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

export default function BookAppointment() {
  const nav = useNavigate();
  const loc = useLocation();

  const DARK = "#0b3d2e";
  const BG = "#ffffff";

  // Mobile/Tablet uses the NEW layout (drawer + responsive); Desktop uses the OLD layout
  const isNarrow = useMediaQuery("(max-width: 1024px)");

  const [msg, setMsg] = useState("");

  // profile (header + prefill for modal)
  const [profile, setProfile] = useState(null);

  // top-right dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // OLD desktop layout sidebar
  const [sideOpen, setSideOpen] = useState(true);
  const toggleSidebarDesktop = () => setSideOpen((v) => !v);

  // NEW mobile/tablet drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // appointments list
  const [loadingList, setLoadingList] = useState(true);
  const [appointments, setAppointments] = useState([]);

  // filters
  const [filters, setFilters] = useState({ status: "All", procedure: "All", date: "" });

  // booking modal
  const [bookOpen, setBookOpen] = useState(false);

  // booking form fields actually used by backend
  const [saving, setSaving] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availability, setAvailability] = useState(null);

  const [form, setForm] = useState({ procedure: "", date: "" }); // YYYY-MM-DD

  // request slip file (optional)
  const [slipFile, setSlipFile] = useState(null);
  const slipInputRef = useRef(null);

  // ✅ Ultrasound "Coming Soon" modal state + last procedure memory
  const [soonOpen, setSoonOpen] = useState(false);
  const lastProcedureRef = useRef("");

  // ✅ Detect admin/superadmin session (so they don't use the patient booking page)
  const adminSession = useMemo(() => {
    if (typeof window === "undefined") return false;
    const adminToken = localStorage.getItem("adminToken");
    const adminRole = String(localStorage.getItem("adminRole") || "").trim().toLowerCase();
    return !!adminToken && (adminRole === "admin" || adminRole === "superadmin");
  }, []);

  // ✅ If user uploaded a slip and didn't select a procedure, use a safe fallback.
  const procedureForBooking = useMemo(() => {
    const p = String(form.procedure || "").trim();
    if (p) return p;
    return slipFile ? "X-Ray" : "";
  }, [form.procedure, slipFile]);

  // ✅ local-safe today ISO (avoid off-by-one in some timezones)
  const todayIso = toLocalISODate(new Date());

  async function loadAll() {
    // ✅ If admin somehow lands here, push them to admin booking
    if (adminSession) return nav("/admin/appointment-booking");

    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setLoadingList(true);

      try {
        const me = await apiGet("/api/auth/me", token);
        setProfile(me);
      } catch {
        // ignore
      }

      const data = await apiGet("/api/appointments/mine", token);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg(err.message || "Failed to load appointments");
    } finally {
      setLoadingList(false);
    }
  }

  // ✅ On mount: patients load; admins redirect to admin booking page
  useEffect(() => {
    if (adminSession) {
      nav("/admin/appointment-booking");
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSession]);

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

  // close booking modal on ESC
  useEffect(() => {
    if (!bookOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeBookModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOpen]);

  function logout() {
    setMenuOpen(false);
    setDrawerOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    nav("/login");
  }

  function onFilterChange(e) {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  }

  function resetFilters() {
    setFilters({ status: "All", procedure: "All", date: "" });
  }

  function openBookModal() {
    setMsg("");
    setForm({ procedure: "", date: "" });
    setSlipFile(null);
    setAvailability(null);
    lastProcedureRef.current = ""; // ✅ reset previous selection
    setSoonOpen(false);
    setBookOpen(true);
  }

  function closeBookModal() {
    setBookOpen(false);
    setSaving(false);
    setUploadingSlip(false);
    setCheckingAvail(false);
    setAvailability(null);
    setSoonOpen(false);
  }

  function onBookChange(e) {
    const { name, value } = e.target;

    if (name === "procedure") {
      // ✅ ignore our internal heading options if they ever get focused somehow
      if (String(value || "") === "__HDR__") return;

      if (value === "Ultrasound") {
        setSoonOpen(true);
        // revert to the last selected (non-ultrasound) value
        setForm((p) => ({ ...p, procedure: lastProcedureRef.current || "" }));
        setMsg("");
        return;
      }
      lastProcedureRef.current = value;
    }

    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  // availability (only while modal is open)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !bookOpen) return;

    if (!procedureForBooking || !form.date) {
      setAvailability(null);
      return;
    }

    const q = `?procedure=${encodeURIComponent(procedureForBooking)}&date=${encodeURIComponent(form.date)}`;
    setCheckingAvail(true);

    apiGet(`/api/appointments/availability${q}`, token)
      .then((data) => setAvailability(data))
      .catch(() => setAvailability(null))
      .finally(() => setCheckingAvail(false));
  }, [bookOpen, procedureForBooking, form.date]);

  // ✅ booking constraint: max 3 active (Pending/Approved), all must be different procedures
  const activeStatuses = useMemo(() => new Set(["Pending", "Approved"]), []);

  const activeAppointments = useMemo(() => {
    return appointments.filter((a) => activeStatuses.has(String(a?.status || "")));
  }, [appointments, activeStatuses]);

  const maxActiveReached = activeAppointments.length >= 3;

  const activeProcedureKeys = useMemo(() => {
    const s = new Set();
    for (const a of activeAppointments) {
      s.add(normalizeProcedureKeyFront(a?.procedure));
    }
    return s;
  }, [activeAppointments]);

  const hasActiveSameProcedure =
    !!procedureForBooking && activeProcedureKeys.has(normalizeProcedureKeyFront(procedureForBooking));

  const hasActiveAppointment = maxActiveReached || hasActiveSameProcedure;

  // ✅ UNLIMITED SLOTS SUPPORT
  const unlimitedSlots =
    !!availability &&
    (availability.unlimited === true ||
      availability.limit == null ||
      Number(availability.limit) <= 0 ||
      availability.remaining == null);

  const noSlots =
    !unlimitedSlots &&
    availability &&
    typeof availability.remaining === "number" &&
    availability.remaining <= 0;

  const submitDisabled = saving || uploadingSlip || checkingAvail || noSlots || hasActiveAppointment;

  async function uploadRequestSlip(token, appointmentId, file) {
    const fd = new FormData();
    fd.append("appointmentId", appointmentId);
    fd.append("referral", file); // backend expects "referral"

    const resp = await fetch(`${API_URL}/api/upload/referral`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message || "Request slip upload failed");
    return data;
  }

  async function onSubmitBook(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setSaving(true);
      setMsg("");

      if (!procedureForBooking) return setMsg("Please select a procedure or upload a request slip.");
      if (!form.date) return setMsg("Please select a date.");

      if (maxActiveReached) {
        return setMsg(
          "You already have 3 active appointments (Pending/Approved). " +
            "You can submit again only after one becomes Cancelled, Rejected, or Completed."
        );
      }

      if (hasActiveSameProcedure) {
        return setMsg(
          `You already have an active ${procedureForBooking} appointment (Pending/Approved). ` +
            "Please choose a different procedure or wait until it is Cancelled, Rejected, or Completed."
        );
      }

      if (noSlots) {
        return setMsg("No available slots left for the selected date. Please choose another date.");
      }

      // optional slip validation
      if (slipFile) {
        const isPdf = slipFile.type === "application/pdf";
        const isImage = slipFile.type && slipFile.type.startsWith("image/");
        if (!isPdf && !isImage) return setMsg("Request slip must be a PDF or an image (JPG/PNG).");
        const maxBytes = 10 * 1024 * 1024;
        if (slipFile.size > maxBytes) return setMsg("Request slip file is too large (max 10MB).");
      }

      const [y, m, d] = form.date.split("-").map(Number);
      const payload = { procedure: procedureForBooking, year: y, month: m, day: d };

      const created = await apiPost("/api/appointments", payload, token);

      if (slipFile && created && created._id) {
        setUploadingSlip(true);
        await uploadRequestSlip(token, created._id, slipFile);
      }

      await loadAll();
      setMsg("Appointment submitted successfully.");
      closeBookModal();
    } catch (err) {
      setMsg(err.message || "Failed to book appointment");
    } finally {
      setUploadingSlip(false);
      setSaving(false);
    }
  }

  // ✅ Cancel appointment
  async function cancelAppointment(appointmentId) {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setMsg("");
      await apiPatch(`/api/appointments/${appointmentId}/cancel`, token, {});
      await loadAll();
      setMsg("Appointment cancelled.");
    } catch (err) {
      setMsg(err.message || "Cancel failed.");
    }
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
    const s = new Set(["Pending", "Approved", "Completed", "Cancelled", "Rejected"]);
    for (const a of appointments) if (a?.status) s.add(a.status);
    return ["All", ...Array.from(s)];
  }, [appointments]);

  const procedureOptions = useMemo(() => {
    const s = new Set(XRAY_PROCEDURE_LABELS);
    for (const a of appointments) if (a?.procedure) s.add(a.procedure);
    return ["All", ...Array.from(s)];
  }, [appointments]);

  // ✅ Grouping for booking dropdown
  const procedureGroups = useMemo(() => {
    const items = Array.isArray(XRAY_PROCEDURE_ITEMS) ? XRAY_PROCEDURE_ITEMS : [];

    const ultrasound = items.filter((x) => String(x.code) === "ULTRASOUND" || String(x.label) === "Ultrasound");
    const chest = items.filter((x) => String(x.code).startsWith("CHEST_"));
    const others = items.filter((x) => !String(x.code).startsWith("CHEST_") && String(x.code) !== "ULTRASOUND");

    return { chest, others, ultrasound };
  }, [XRAY_PROCEDURE_ITEMS]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (filters.status !== "All" && String(a?.status || "") !== filters.status) return false;
      if (filters.procedure !== "All" && String(a?.procedure || "") !== filters.procedure) return false;

      if (filters.date) {
        const [fy, fm, fd] = filters.date.split("-").map(Number);
        if (Number(a?.year) !== fy || Number(a?.month) !== fm || Number(a?.day) !== fd) return false;
      }
      return true;
    });
  }, [appointments, filters]);

  const canCancel = (statusRaw) => {
    const s = String(statusRaw || "");
    return s === "Pending" || s === "Approved";
  };

  const canViewResults = (statusRaw) => {
    const s = String(statusRaw || "");
    return s === "Completed";
  };

  /* ---------- ROLE + LABEL (match Profile.jsx behavior) ---------- */
  const roleClean = useMemo(() => String(profile?.role || profile?.userType || "").trim().toLowerCase(), [profile]);
  const isAdmin = roleClean === "admin" || roleClean === "superadmin" || profile?.isAdmin === true;
  const isSuperAdmin = roleClean === "superadmin";
  const idLabelText = isAdmin ? (isSuperAdmin ? "Superadmin ID" : "Admin ID") : "Patient ID";

  /* ---------- SIDEBAR ITEMS ---------- */
  const PATIENT_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "My Appointments", to: "/appointments", IconComp: CalendarIcon }, // ✅ patient-only booking page
    { label: "My Bills", to: "/bills", IconComp: BillsIcon },
    { label: "Diagnostic Results", to: "/diagnostic-results", IconComp: ResultsIcon },
    { label: "Patient Information", to: "/profile/edit", IconComp: PatientIcon, exact: true },
  ];

  const ADMIN_SIDE_ITEMS = [
    { label: "Home", to: "/profile", IconComp: HomeIcon, exact: true },
    { label: "Appointment Approval", to: "/admin/appointments", IconComp: ApprovalIcon, exact: true },
    // ✅ admin-only booking page (new route)
    { label: "Appointment Booking", to: "/admin/appointment-booking", IconComp: BookingIcon },
    { label: "Data Records", to: "/admin/data-records", IconComp: RecordsIcon },
    { label: "Admin Information", to: "/profile/edit", IconComp: AdminInfoIcon, exact: true },
  ];

  const SIDE_ITEMS = isAdmin ? ADMIN_SIDE_ITEMS : PATIENT_SIDE_ITEMS;

  const isItemActive = (to, exact) => {
    if (exact) return loc.pathname === to;
    return loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  };

  /* =========================================================
     NEW LAYOUT (Mobile/Tablet) — uses global CSS (profileShell)
     ========================================================= */
  if (isNarrow) {
    const rootClass = ["profileShell", "narrow", drawerOpen ? "drawerOpen" : ""].filter(Boolean).join(" ");

    // mobile-friendly control styles
    const mLabel = { fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 6 };
    const mControl = {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 12,
      border: `2px solid ${DARK}`,
      background: "#fff",
      color: "#0f172a",
      fontWeight: 900,
      outline: "none",
    };
    const mFilters = { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 10 };
    const mBtnRow = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 };
    const mBtn = (variant = "outline", disabled = false) => ({
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.65 : 1,
      border: `2px solid ${DARK}`,
      background: variant === "solid" ? DARK : "#fff",
      color: variant === "solid" ? "#fff" : DARK,
      flex: 1,
      minWidth: 140,
    });

    const addBtn = {
      width: "100%",
      marginTop: 12,
      padding: "12px 14px",
      borderRadius: 12,
      background: DARK,
      color: "#fff",
      fontWeight: 900,
      border: `2px solid ${DARK}`,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    };

    const card = {
      border: `2px solid ${DARK}`,
      borderRadius: 16,
      padding: 12,
      background: "#fff",
      display: "grid",
      gap: 10,
      marginTop: 12,
    };

    const statusPill = (status) => {
      const s = String(status || "");
      const bg =
        s === "Completed"
          ? "#dcfce7"
          : s === "Approved"
          ? "#dbeafe"
          : s === "Cancelled" || s === "Rejected"
          ? "#fee2e2"
          : "#fffbeb";
      const color =
        s === "Completed"
          ? "#166534"
          : s === "Approved"
          ? "#1e40af"
          : s === "Cancelled" || s === "Rejected"
          ? "#991b1b"
          : "#92400e";

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
        border: "1px solid rgba(0,0,0,.1)",
        whiteSpace: "nowrap",
      };
    };

    const actionRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

    const cancelBtn = (disabled) => ({
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      background: "#fff",
      border: `2px solid ${disabled ? "rgba(185,28,28,.35)" : "#b91c1c"}`,
      color: disabled ? "rgba(185,28,28,.55)" : "#b91c1c",
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
    });

    const viewBtn = (disabled) => ({
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      background: DARK,
      color: "#fff",
      fontWeight: 900,
      border: `2px solid ${DARK}`,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: disabled ? "none" : "auto",
    });

    // Modal (mobile sizes)
    const overlay = {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      zIndex: 2000,
      display: "grid",
      placeItems: "center",
      padding: 14,
    };

    const modal = {
      width: "min(560px, 96%)",
      height: "min(92vh, 860px)",
      background: "linear-gradient(180deg, rgba(11,61,46,.92) 0%, rgba(47,90,69,.92) 100%)",
      borderRadius: 22,
      boxShadow: "0 26px 70px rgba(0,0,0,.45)",
      padding: "18px 16px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    };

    const modalHeader = { textAlign: "center", color: "#fff", lineHeight: 1.05, marginTop: 2 };
    const modalTitle = { fontSize: 34, fontWeight: 900, margin: 0 };
    const modalSub = { margin: "6px 0 0", fontSize: 13, opacity: 0.9, fontWeight: 700 };
    const modalInner = { flex: 1, overflow: "auto", paddingRight: 6 };

    const modalGrid = { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start", marginTop: 10 };

    const field = { marginBottom: 12 };
    const fieldLabel = { color: "#fff", fontWeight: 900, fontSize: 16, marginBottom: 8 };

    const input = {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "2px solid rgba(255,255,255,.9)",
      background: "rgba(0,0,0,.08)",
      color: "#fff",
      fontWeight: 800,
      outline: "none",
      fontSize: 14,
    };

    const select = { ...input, appearance: "none" };

    const calendarBox = {
      width: "100%",
      background: "#fff",
      borderRadius: 12,
      border: "2px solid rgba(255,255,255,.9)",
      padding: 10,
    };

    const procWrap = { display: "grid", gap: 10, marginTop: 6 };
    const orText = { color: "#fff", fontWeight: 900, opacity: 0.85, textAlign: "center" };

    const uploadBtn = {
      padding: "12px 14px",
      borderRadius: 12,
      background: "#fff",
      border: "2px solid rgba(255,255,255,.9)",
      color: DARK,
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
      width: "100%",
    };

    const bigBookBtn = (disabled) => ({
      marginTop: 14,
      width: "100%",
      padding: "14px 16px",
      borderRadius: 999,
      background: DARK,
      color: "#fff",
      border: `2px solid ${DARK}`,
      fontWeight: 900,
      fontSize: 16,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
    });

    const hintLine = (tone) => ({
      color: tone === "bad" ? "#fecaca" : tone === "good" ? "#bbf7d0" : "rgba(255,255,255,.85)",
      fontWeight: 900,
      fontSize: 13,
      marginTop: 8,
    });

    return (
      <div className={rootClass} style={{ "--dark": DARK, "--bg": BG }}>
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
                  <div className="homeTitle">My Appointments</div>
                  <div className="homeSub">Filter and review your booking history</div>
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
                    <div className="ddName">{fullName || "Patient Name"}</div>
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
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="content">
            <div className="contentInner">
              {msg ? <div className="msgWarn">{msg}</div> : null}

              {/* Filters (stacked) */}
              <div style={mFilters}>
                <div>
                  <div style={mLabel}>Status</div>
                  <select name="status" value={filters.status} onChange={onFilterChange} style={mControl}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={mLabel}>Procedure</div>
                  <select name="procedure" value={filters.procedure} onChange={onFilterChange} style={mControl}>
                    {procedureOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={mLabel}>Date</div>
                  <input type="date" name="date" value={filters.date} onChange={onFilterChange} style={mControl} />
                </div>

                <div style={mBtnRow}>
                  <button type="button" style={mBtn("outline", loadingList)} onClick={loadAll} disabled={loadingList}>
                    Refresh
                  </button>
                  <button type="button" style={mBtn("outline", false)} onClick={resetFilters}>
                    Reset
                  </button>
                </div>
              </div>

              <button type="button" style={addBtn} onClick={openBookModal}>
                + Add Appointment
              </button>

              {/* Appointment Cards */}
              {loadingList ? (
                <div style={{ marginTop: 12, color: "#64748b", fontWeight: 800 }}>Loading...</div>
              ) : filteredAppointments.length === 0 ? (
                <div style={{ marginTop: 12, color: "#64748b", fontWeight: 800 }}>No appointments found.</div>
              ) : (
                filteredAppointments.map((a) => {
                  const dt = toDateObj(a);
                  const dateText = dt ? dt.toLocaleDateString() : "-";
                  const procedureText = a?.procedure || "-";
                  const statusText = a?.status || "-";

                  const allowCancel = canCancel(statusText);
                  const allowResults = canViewResults(statusText);

                  return (
                    <div key={a._id} style={card}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{dateText}</div>
                        <span style={statusPill(statusText)}>{statusText}</span>
                      </div>

                      <div style={{ fontWeight: 900, color: "#0f172a" }}>{procedureText}</div>

                      <div style={actionRow}>
                        <button type="button" style={cancelBtn(!allowCancel)} disabled={!allowCancel} onClick={() => cancelAppointment(a._id)}>
                          Cancel
                        </button>

                        <Link
                          to={`/diagnostic-results?appointmentId=${encodeURIComponent(a._id)}`}
                          style={viewBtn(!allowResults)}
                          aria-disabled={!allowResults}
                          title={!allowResults ? "Results available when Completed" : "View Results"}
                        >
                          View Results
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* BOOK APPOINTMENT MODAL (mobile) */}
          {bookOpen ? (
            <div style={overlay} onClick={closeBookModal} role="dialog" aria-modal="true" aria-label="Book appointment">
              <div style={modal} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeader}>
                  <h2 style={modalTitle}>Book Appointment</h2>
                  <div style={modalSub}>Fill out the information to book an appointment</div>
                </div>

                <div style={modalInner}>
                  <form onSubmit={onSubmitBook}>
                    <div style={modalGrid}>
                      {/* BASIC INFO (display-only) */}
                      <div>
                        <div style={field}>
                          <div style={fieldLabel}>First Name</div>
                          <input style={input} placeholder="Enter your first name" defaultValue={profile?.firstName || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Middle Name</div>
                          <input style={input} placeholder="Enter your middle name" defaultValue={profile?.middleName || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Last Name</div>
                          <input style={input} placeholder="Enter your last name" defaultValue={profile?.lastName || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Suffix</div>
                          <input style={input} placeholder="Enter your suffix" defaultValue={profile?.suffix || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Sex</div>
                          <input style={input} placeholder="Male/Female" defaultValue={profile?.gender || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Birthdate</div>
                          <input
                            style={input}
                            placeholder="mm/dd/yyyy"
                            defaultValue={profile?.birthdate ? new Date(profile.birthdate).toLocaleDateString() : ""}
                          />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Age</div>
                          <input style={input} placeholder="Enter your age" defaultValue={ageFromBirthdate(profile?.birthdate)} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Contact No.</div>
                          <input style={input} placeholder="Enter your contact no." defaultValue={profile?.contactNumber || ""} />
                        </div>

                        <div style={field}>
                          <div style={fieldLabel}>Email Address</div>
                          <input style={input} placeholder="Enter your email address" defaultValue={profile?.email || ""} />
                        </div>
                      </div>

                      {/* PROCEDURE + SLIP */}
                      <div>
                        <div style={fieldLabel}>Procedure</div>

                        <div style={procWrap}>
                          <select name="procedure" value={form.procedure} onChange={onBookChange} style={select} required={!slipFile}>
                            <option value="">Type of Procedure</option>

                            <optgroup label="XRAY Procedures:">
                              <option value="__HDR__" disabled>
                                — Chest —
                              </option>
                              {procedureGroups.chest.map((x) => (
                                <option key={x.code} value={x.label}>
                                  {x.label} — {formatPhp(x.fee)}
                                </option>
                              ))}

                              <option value="__HDR__" disabled>
                                — Others —
                              </option>
                              {procedureGroups.others.map((x) => (
                                <option key={x.code} value={x.label}>
                                  {x.label} — {formatPhp(x.fee)}
                                </option>
                              ))}
                            </optgroup>

                            <optgroup label="Ultrasound Procedures:">
                              {procedureGroups.ultrasound.map((x) => (
                                <option key={x.code} value={x.label}>
                                  {x.label} — {formatPhp(x.fee)}
                                </option>
                              ))}
                            </optgroup>
                          </select>

                          <div style={orText}>or</div>

                          <button type="button" style={uploadBtn} onClick={() => slipInputRef.current?.click()} title="Upload request slip (optional)">
                            Upload Request Slip
                          </button>

                          <input
                            ref={slipInputRef}
                            type="file"
                            accept="application/pdf,image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setSlipFile(f);
                              setMsg("");
                            }}
                          />
                        </div>

                        {slipFile ? <div style={hintLine("muted")}>Selected slip: {slipFile.name}</div> : null}
                      </div>

                      {/* DATE + CALENDAR */}
                      <div>
                        <div style={fieldLabel}>Date of Appointment</div>

                        <div style={calendarBox}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                            <input
                              type="date"
                              name="date"
                              value={form.date}
                              onChange={onBookChange}
                              min={todayIso}
                              required
                              style={{
                                width: "100%",
                                padding: "10px 10px",
                                borderRadius: 12,
                                border: `2px solid ${DARK}`,
                                fontWeight: 900,
                                color: "#0f172a",
                                outline: "none",
                              }}
                            />

                            <ActiveCalendar
                              valueIso={form.date}
                              minIso={todayIso}
                              accent={DARK}
                              onChangeIso={(iso) => {
                                setForm((p) => ({ ...p, date: iso }));
                                setMsg("");
                              }}
                            />
                          </div>
                        </div>

                        {!procedureForBooking || !form.date ? (
                          <div style={hintLine("muted")}>Select a procedure and date to see availability.</div>
                        ) : checkingAvail ? (
                          <div style={hintLine("muted")}>Checking availability...</div>
                        ) : availability ? (
                          <div style={hintLine(noSlots ? "bad" : "good")}>
                            {unlimitedSlots
                              ? `Remaining slots: Unlimited (used: ${typeof availability.used === "number" ? availability.used : 0})`
                              : `Remaining slots: ${availability.remaining} (${availability.used}/${availability.limit} used)`}
                          </div>
                        ) : (
                          <div style={hintLine("muted")}>Availability unavailable.</div>
                        )}

                        {maxActiveReached ? (
                          <div style={hintLine("bad")}>You already have 3 active appointments (Pending/Approved).</div>
                        ) : hasActiveSameProcedure ? (
                          <div style={hintLine("bad")}>You already have an active appointment for this procedure.</div>
                        ) : null}
                      </div>
                    </div>

                    <button type="submit" disabled={submitDisabled} style={bigBookBtn(submitDisabled)}>
                      {uploadingSlip ? "Uploading..." : saving ? "Booking..." : "Book Appointment"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : null}

          <style>{`
            .syn-input::placeholder { color: rgba(255,255,255,.65); }
            .syn-procedure-select option { color: #0f172a; background: #ffffff; }
          `}</style>
        </main>

        {/* ✅ Coming Soon modal */}
        <ComingSoonModal open={soonOpen} onClose={() => setSoonOpen(false)} accent={DARK} message="Coming Soon..." />
      </div>
    );
  }

  /* =========================================================
     OLD LAYOUT (Desktop/Laptop) — original inline-styled UI
     ========================================================= */

  /* ---------- STYLES (DESKTOP) ---------- */
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

  /* ---- Filters + Table styles ---- */
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

  const apptPanel = { ...panel, minHeight: 520, display: "flex", flexDirection: "column", marginTop: 14 };

  const apptPanelTop = { display: "flex", justifyContent: "flex-end", padding: "4px 8px 10px", flex: "0 0 auto" };

  const addApptBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 2,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

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

  const cancelBtn = (disabled) => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    background: "#fff",
    border: `2px solid ${disabled ? "rgba(185,28,28,.35)" : "#b91c1c"}`,
    color: disabled ? "rgba(185,28,28,.55)" : "#b91c1c",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const viewBtn = (disabled) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 2,
    background: DARK,
    color: "#fff",
    fontWeight: 900,
    border: `2px solid ${DARK}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: disabled ? "none" : "auto",
  });

  /* ---------- MODAL (DESKTOP) ---------- */
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
    width: "min(1180px, 96%)",
    height: "min(700px, 90vh)",
    background: "linear-gradient(180deg, rgba(11,61,46,.92) 0%, rgba(47,90,69,.92) 100%)",
    borderRadius: 26,
    boxShadow: "0 26px 70px rgba(0,0,0,.45)",
    padding: "22px 26px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const modalHeader = { textAlign: "center", color: "#fff", lineHeight: 1.05, marginTop: 2 };
  const modalTitle = { fontSize: 46, fontWeight: 900, margin: 0 };
  const modalSub = { margin: "6px 0 0", fontSize: 14, opacity: 0.9, fontWeight: 700 };

  const modalInner = { flex: 1, overflow: "auto", paddingRight: 6 };

  const modalGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.95fr",
    gap: 22,
    alignItems: "start",
    marginTop: 8,
  };

  const field = { marginBottom: 14 };
  const fieldLabel = { color: "#fff", fontWeight: 900, fontSize: 20, marginBottom: 8 };

  const input = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 2,
    border: "3px solid rgba(255,255,255,.9)",
    background: "rgba(0,0,0,.08)",
    color: "#fff",
    fontWeight: 800,
    outline: "none",
    fontSize: 14,
  };

  const select = { ...input, appearance: "none" };

  const rightCard = { borderRadius: 2, background: "rgba(255,255,255,.0)" };

  const calendarBox = {
    width: "100%",
    background: "#fff",
    borderRadius: 2,
    border: "3px solid rgba(255,255,255,.9)",
    padding: 10,
  };

  const bottomRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 8,
    flexWrap: "wrap",
  };

  const procWrap = { display: "flex", alignItems: "center", gap: 12 };
  const orText = { color: "#fff", fontWeight: 900, opacity: 0.85 };

  const uploadBtn = {
    padding: "12px 14px",
    borderRadius: 2,
    background: "#fff",
    border: "3px solid rgba(255,255,255,.9)",
    color: DARK,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const bigBookBtn = (disabled) => ({
    marginTop: 18,
    width: "min(760px, 92%)",
    alignSelf: "center",
    padding: "16px 18px",
    borderRadius: 999,
    background: DARK,
    color: "#fff",
    border: `2px solid ${DARK}`,
    fontWeight: 900,
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  const hintLine = (tone) => ({
    color: tone === "bad" ? "#fecaca" : tone === "good" ? "#bbf7d0" : "rgba(255,255,255,.85)",
    fontWeight: 900,
    fontSize: 13,
    marginTop: 6,
  });

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
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>My Appointments</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Filter and review your booking history</div>
            </div>
          </div>

          {/* Dropdown */}
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
                <input type="date" name="date" value={filters.date} onChange={onFilterChange} style={filterControl} />
              </div>

              <div style={filterBtns}>
                <button type="button" style={filterBtn(loadingList)} onClick={loadAll} disabled={loadingList}>
                  Refresh
                </button>
                <button type="button" style={filterBtn(false)} onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
            </div>

            {/* TABLE PANEL */}
            <div style={apptPanel}>
              <div style={apptPanelTop}>
                <button type="button" style={addApptBtn} onClick={openBookModal}>
                  + Add Appointment
                </button>
              </div>

              <div style={tableHeader}>
                <div>Date</div>
                <div>Procedure</div>
                <div>Status</div>
                <div>Actions</div>
                <div />
              </div>

              <div style={tableBody}>
                {loadingList ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>Loading...</div>
                ) : filteredAppointments.length === 0 ? (
                  <div style={{ padding: "16px 12px", color: "#64748b", fontWeight: 800 }}>No appointments found.</div>
                ) : (
                  filteredAppointments.map((a) => {
                    const dt = toDateObj(a);
                    const dateText = dt ? dt.toLocaleDateString() : "-";
                    const procedureText = a?.procedure || "-";
                    const statusText = a?.status || "-";

                    const allowCancel = canCancel(statusText);
                    const allowResults = canViewResults(statusText);

                    return (
                      <div key={a._id} style={row}>
                        <div>{dateText}</div>
                        <div>{procedureText}</div>
                        <div>{statusText}</div>

                        <div>
                          <button type="button" style={cancelBtn(!allowCancel)} disabled={!allowCancel} onClick={() => cancelAppointment(a._id)}>
                            Cancel
                          </button>
                        </div>

                        <div>
                          <Link
                            to={`/diagnostic-results?appointmentId=${encodeURIComponent(a._id)}`}
                            style={viewBtn(!allowResults)}
                            aria-disabled={!allowResults}
                            title={!allowResults ? "Results available when Completed" : "View Results"}
                          >
                            View Results
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOOK APPOINTMENT MODAL */}
        {bookOpen ? (
          <div style={overlay} onClick={closeBookModal} role="dialog" aria-modal="true" aria-label="Book appointment">
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={modalTitle}>Book Appointment</h2>
                <div style={modalSub}>Fill out the information to book an appointment</div>
              </div>

              <div style={modalInner}>
                <form onSubmit={onSubmitBook}>
                  <div style={modalGrid}>
                    {/* LEFT COLUMN */}
                    <div>
                      <div style={field}>
                        <div style={fieldLabel}>First Name</div>
                        <input style={input} placeholder="Enter your first name" defaultValue={profile?.firstName || ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Middle Name</div>
                        <input style={input} placeholder="Enter your middle name" defaultValue={profile?.middleName || ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Last Name</div>
                        <input style={input} placeholder="Enter your last name" defaultValue={profile?.lastName || ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Suffix</div>
                        <input style={input} placeholder="Enter your suffix" defaultValue={profile?.suffix || ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Sex</div>
                        <input style={input} placeholder="Male/Female" defaultValue={profile?.gender || ""} />
                      </div>
                    </div>

                    {/* MIDDLE COLUMN */}
                    <div>
                      <div style={field}>
                        <div style={fieldLabel}>Birthdate</div>
                        <input style={input} placeholder="mm/dd/yyyy" defaultValue={profile?.birthdate ? new Date(profile.birthdate).toLocaleDateString() : ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Age</div>
                        <input style={input} placeholder="Enter your age" defaultValue={ageFromBirthdate(profile?.birthdate)} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Contact No.</div>
                        <input style={input} placeholder="Enter your contact no." defaultValue={profile?.contactNumber || ""} />
                      </div>

                      <div style={field}>
                        <div style={fieldLabel}>Email Address</div>
                        <input style={input} placeholder="Enter your email address" defaultValue={profile?.email || ""} />
                      </div>

                      {/* Procedure + Upload row */}
                      <div style={{ marginTop: 8 }}>
                        <div style={procWrap}>
                          <div style={{ minWidth: 240 }}>
                            <select className="syn-procedure-select" name="procedure" value={form.procedure} onChange={onBookChange} style={select} required={!slipFile}>
                              <option value="">Type of Procedure</option>

                              <optgroup label="XRAY Procedures:">
                                <option value="__HDR__" disabled>
                                  — Chest —
                                </option>
                                {procedureGroups.chest.map((x) => (
                                  <option key={x.code} value={x.label}>
                                    {x.label} — {formatPhp(x.fee)}
                                  </option>
                                ))}

                                <option value="__HDR__" disabled>
                                  — Others —
                                </option>
                                {procedureGroups.others.map((x) => (
                                  <option key={x.code} value={x.label}>
                                    {x.label} — {formatPhp(x.fee)}
                                  </option>
                                ))}
                              </optgroup>

                              <optgroup label="Ultrasound Procedures:">
                                {procedureGroups.ultrasound.map((x) => (
                                  <option key={x.code} value={x.label}>
                                    {x.label} — {formatPhp(x.fee)}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          <div style={orText}>or</div>

                          <button type="button" style={uploadBtn} onClick={() => slipInputRef.current?.click()} title="Upload request slip (optional)">
                            Upload Request Slip
                          </button>

                          <input
                            ref={slipInputRef}
                            type="file"
                            accept="application/pdf,image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setSlipFile(f);
                              setMsg("");
                            }}
                          />
                        </div>

                        {slipFile ? <div style={hintLine("muted")}>Selected slip: {slipFile.name}</div> : null}
                      </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div style={rightCard}>
                      <div style={fieldLabel}>Date and Time of Appointment</div>

                      <div style={calendarBox}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                          <input
                            type="date"
                            name="date"
                            value={form.date}
                            onChange={onBookChange}
                            min={todayIso}
                            required
                            style={{
                              width: "100%",
                              padding: "10px 10px",
                              borderRadius: 2,
                              border: `2px solid ${DARK}`,
                              fontWeight: 900,
                              color: "#0f172a",
                              outline: "none",
                            }}
                          />

                          <ActiveCalendar
                            valueIso={form.date}
                            minIso={todayIso}
                            accent={DARK}
                            onChangeIso={(iso) => {
                              setForm((p) => ({ ...p, date: iso }));
                              setMsg("");
                            }}
                          />
                        </div>
                      </div>

                      {!procedureForBooking || !form.date ? (
                        <div style={hintLine("muted")}>Select a procedure and date to see availability.</div>
                      ) : checkingAvail ? (
                        <div style={hintLine("muted")}>Checking availability...</div>
                      ) : availability ? (
                        <div style={hintLine(noSlots ? "bad" : "good")}>
                          {unlimitedSlots
                            ? `Remaining slots: Unlimited (used: ${typeof availability.used === "number" ? availability.used : 0})`
                            : `Remaining slots: ${availability.remaining} (${availability.used}/${availability.limit} used)`}
                        </div>
                      ) : (
                        <div style={hintLine("muted")}>Availability unavailable.</div>
                      )}

                      {maxActiveReached ? (
                        <div style={hintLine("bad")}>You already have 3 active appointments (Pending/Approved).</div>
                      ) : hasActiveSameProcedure ? (
                        <div style={hintLine("bad")}>You already have an active appointment for this procedure.</div>
                      ) : null}
                    </div>
                  </div>

                  <div style={bottomRow}>
                    <button type="submit" disabled={submitDisabled} style={bigBookBtn(submitDisabled)}>
                      {uploadingSlip ? "Uploading..." : saving ? "Booking..." : "Book Appointment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <style>{`
          .syn-input::placeholder { color: rgba(255,255,255,.65); }

          /* regular options */
          .syn-procedure-select option {
            color: #0f172a;
            background: #ffffff;
            font-weight: 800;
          }

          /* optgroup labels: "XRAY Procedures:" / "Ultrasound Procedures:" */
          .syn-procedure-select optgroup {
            color: #0f172a;
            font-weight: 900;
          }

          /* disabled headings: "— Chest —" / "— Others —" */
          .syn-procedure-select option[disabled] {
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a; /* helps Chrome */
            font-weight: 900;
            opacity: 1;
          }
        `}</style>
      </main>

      {/* ✅ Coming Soon modal */}
      <ComingSoonModal open={soonOpen} onClose={() => setSoonOpen(false)} accent={DARK} message="Coming Soon..." />
    </div>
  );
}