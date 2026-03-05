// frontend/src/pages/EditProfile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut, apiUpload } from "../api";
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

/* ---------- DATE HELPERS (local-safe) ---------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalISODate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function parseBirthdate(birthdate) {
  if (!birthdate) return null;

  if (typeof birthdate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    const [y, m, d] = birthdate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(birthdate);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/* ---------- HELPERS ---------- */
function ageFromBirthdate(birthdate) {
  const b = parseBirthdate(birthdate);
  if (!b) return "-";

  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function formatBirthdate(birthdate) {
  const d = parseBirthdate(birthdate);
  if (!d) return "-";
  return d.toLocaleDateString();
}

function isImageFile(file) {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function uploadAvatarFile(file, token) {
  const fd = new FormData();
  fd.append("avatar", file); // must match multer fieldname

  const data = await apiUpload("/api/upload/avatar", token, fd);

  const url =
    data?.avatarUrl ||
    data?.url ||
    data?.secure_url ||
    data?.imageUrl ||
    data?.fileUrl ||
    data?.path ||
    data?.location ||
    "";

  if (!url) throw new Error("Upload succeeded but server did not return an image URL.");
  return url;
}

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

/* ---------- MODAL: EDIT PROFILE (POPUP) ---------- */
function EditProfileModal({ open, onClose, initialProfile, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // avatar
  const fileRef = useRef(null);
  const [avatarMode, setAvatarMode] = useState("keep"); // keep | new | remove
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    gender: "",
    birthdate: "",
    contactNumber: "",
    email: "",
    address: "",
  });

  const computedAge = useMemo(() => {
    if (!form.birthdate) return "";
    return String(ageFromBirthdate(form.birthdate));
  }, [form.birthdate]);

  // cleanup object URLs
  useEffect(() => {
    return () => {
      if (avatarPreview && String(avatarPreview).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(avatarPreview);
        } catch {}
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (!open) return;

    const p = initialProfile || {};
    setMsg("");
    setSaving(false);

    // reset avatar
    setAvatarMode("keep");
    setAvatarFile(null);

    const existing = p.avatarUrl || "/default-avatar.png";
    setAvatarPreview((prev) => {
      if (prev && String(prev).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return existing;
    });

    setForm({
      firstName: p.firstName || "",
      middleName: p.middleName || "",
      lastName: p.lastName || "",
      suffix: p.suffix || "",
      gender: p.gender || "",
      birthdate: p.birthdate ? toLocalISODate(new Date(p.birthdate)) : "",
      contactNumber: p.contactNumber || "",
      email: p.email || "",
      address: p.address || "",
    });
  }, [open, initialProfile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  function onPickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      setMsg("Please select a valid image file.");
      return;
    }

    const MAX = 2 * 1024 * 1024;
    if (file.size > MAX) {
      setMsg(`Image too large (${formatBytes(file.size)}). Max is ${formatBytes(MAX)}.`);
      return;
    }

    const objUrl = URL.createObjectURL(file);

    setAvatarPreview((prev) => {
      if (prev && String(prev).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return objUrl;
    });

    setAvatarFile(file);
    setAvatarMode("new");
    setMsg("");
  }

  function removeAvatar() {
    setAvatarFile(null);
    setAvatarMode("remove");

    setAvatarPreview((prev) => {
      if (prev && String(prev).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return "/default-avatar.png";
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaving(true);
      setMsg("");

      let avatarUrlToSave = null;
      if (avatarMode === "remove") {
        avatarUrlToSave = "";
      } else if (avatarMode === "new") {
        if (!avatarFile) throw new Error("Please select an image file.");
        const uploadedUrl = await uploadAvatarFile(avatarFile, token);
        avatarUrlToSave = uploadedUrl;
      }

      const payload = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        suffix: form.suffix.trim(),
        gender: form.gender,
        birthdate: form.birthdate ? form.birthdate : null,
        contactNumber: form.contactNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };

      if (avatarUrlToSave !== null) payload.avatarUrl = avatarUrlToSave;

      await apiPut("/api/auth/me", token, payload);

      onSaved?.();
      onClose?.();
    } catch (err) {
      setMsg(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 4000,
    padding: 18,
  };

  const modal = {
    width: "min(980px, 94vw)",
    height: "min(680px, 90vh)",
    background: "rgba(0,0,0,.55)",
    borderRadius: 22,
    padding: 18,
    overflow: "auto",
  };

  const title = {
    textAlign: "center",
    color: "#fff",
    fontSize: 34,
    fontWeight: 900,
    margin: "4px 0 2px",
  };

  const sub = {
    textAlign: "center",
    color: "rgba(255,255,255,.85)",
    fontSize: 12.5,
    fontWeight: 800,
    margin: "0 0 14px",
  };

  const msgBox = {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,.45)",
    background: "rgba(255,255,255,.08)",
    borderRadius: 12,
    marginBottom: 12,
    color: "#fff",
    fontWeight: 800,
  };

  const avatarRow = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 14,
    padding: "10px 12px",
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,.35)",
    background: "rgba(255,255,255,.06)",
  };

  const avatarBox = {
    width: 86,
    height: 86,
    borderRadius: 999,
    border: "3px solid rgba(255,255,255,.9)",
    overflow: "hidden",
    background: "rgba(255,255,255,.12)",
  };

  const avatarImg = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

  const avatarBtns = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

  const smallBtn = (disabled) => ({
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "#fff",
    color: "#0f172a",
    border: "2px solid rgba(255,255,255,.9)",
    opacity: disabled ? 0.7 : 1,
  });

  const smallBtnOutline = (disabled) => ({
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "transparent",
    color: "#fff",
    border: "2px solid rgba(255,255,255,.75)",
    opacity: disabled ? 0.7 : 1,
  });

  const avatarHint = { color: "rgba(255,255,255,.75)", fontWeight: 800, fontSize: 12 };

  const grid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  };

  const fieldLabel = { color: "#fff", fontWeight: 900, fontSize: 14, marginBottom: 6 };

  const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 2,
    border: "2px solid rgba(255,255,255,.75)",
    background: "rgba(11,61,46,.35)",
    color: "#fff",
    fontWeight: 800,
    outline: "none",
  };

  const updateBtn = (disabled) => ({
    width: "100%",
    marginTop: 16,
    background: "#fff",
    color: "#0f172a",
    border: 0,
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  });

  const hint = {
    color: "rgba(255,255,255,.75)",
    fontWeight: 800,
    fontSize: 12,
    marginTop: 6,
  };

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit Profile dialog">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={title}>Edit Profile</div>
        <div style={sub}>Update your information to edit profile</div>

        {msg ? <div style={msgBox}>{msg}</div> : null}

        <div style={avatarRow}>
          <div style={avatarBox}>
            <img src={avatarPreview || "/default-avatar.png"} alt="Avatar preview" style={avatarImg} />
          </div>

          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>Profile Picture</div>
            <div style={avatarHint}>PNG/JPG recommended • Max 2MB</div>
            <div style={{ height: 10 }} />
            <div style={avatarBtns}>
              <button type="button" style={smallBtn(saving)} disabled={saving} onClick={() => fileRef.current?.click()}>
                Choose Photo
              </button>

              <button type="button" style={smallBtnOutline(saving)} disabled={saving} onClick={removeAvatar}>
                Remove
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickAvatar}
                disabled={saving}
                style={{ display: "none" }}
              />

              <div style={{ color: "rgba(255,255,255,.85)", fontWeight: 900, fontSize: 12 }}>
                {avatarMode === "new" ? "New photo selected" : avatarMode === "remove" ? "Photo will be removed" : "No changes"}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div style={grid}>
            <div>
              <div style={fieldLabel}>First Name</div>
              <input
                name="firstName"
                value={form.firstName}
                onChange={onChange}
                placeholder="Enter your first name"
                style={input}
                required
                disabled={saving}
              />
            </div>

            <div>
              <div style={fieldLabel}>Birthday</div>
              <input type="date" name="birthdate" value={form.birthdate} onChange={onChange} style={input} disabled={saving} />
            </div>

            <div>
              <div style={fieldLabel}>Middle Name</div>
              <input
                name="middleName"
                value={form.middleName}
                onChange={onChange}
                placeholder="Enter your middle name"
                style={input}
                disabled={saving}
              />
            </div>

            <div>
              <div style={fieldLabel}>Age</div>
              <input value={computedAge} placeholder="Enter your age" style={input} disabled />
              <div style={hint}>Auto-calculated from birthday</div>
            </div>

            <div>
              <div style={fieldLabel}>Last Name</div>
              <input
                name="lastName"
                value={form.lastName}
                onChange={onChange}
                placeholder="Enter your last name"
                style={input}
                required
                disabled={saving}
              />
            </div>

            <div>
              <div style={fieldLabel}>Contact Number</div>
              <input
                name="contactNumber"
                value={form.contactNumber}
                onChange={onChange}
                placeholder="Enter your contact number"
                style={input}
                disabled={saving}
              />
            </div>

            <div>
              <div style={fieldLabel}>Suffix</div>
              <input name="suffix" value={form.suffix} onChange={onChange} placeholder="Enter your suffix" style={input} disabled={saving} />
            </div>

            <div>
              <div style={fieldLabel}>Email Address</div>
              <input name="email" value={form.email} onChange={onChange} placeholder="Enter your email address" style={input} disabled={saving} />
            </div>

            <div>
              <div style={fieldLabel}>Sex</div>
              <select name="gender" value={form.gender} onChange={onChange} style={input} disabled={saving}>
                <option value="">Male/Female</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <div style={fieldLabel}>Home Address</div>
              <input name="address" value={form.address} onChange={onChange} placeholder="Enter your home address" style={input} disabled={saving} />
            </div>
          </div>

          <button type="submit" style={updateBtn(saving)} disabled={saving}>
            {saving ? "Updating..." : "Update Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- MODAL: CHANGE PASSWORD (POPUP) ---------- */
function ChangePasswordModal({ open, onClose, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setMsg("");
    setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaving(true);
      setMsg("");

      if (!form.oldPassword) return setMsg("Please enter your old password.");
      if (!form.newPassword) return setMsg("Please enter your new password.");
      if (form.newPassword.length < 6) return setMsg("New password must be at least 6 characters.");
      if (form.newPassword !== form.confirmPassword) return setMsg("New password and confirmation do not match.");

      const payload = { oldPassword: form.oldPassword, newPassword: form.newPassword };
      await apiPut("/api/auth/change-password", token, payload);

      onChanged?.("Password updated successfully.");
      onClose?.();
    } catch (err) {
      setMsg(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // ✅ fixed overlay (better on mobile)
  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 5000,
    padding: 18,
  };

  const modal = {
    width: "min(720px, 92vw)",
    height: "min(520px, 86vh)",
    background: "linear-gradient(180deg, rgba(11,61,46,.92) 0%, rgba(47,90,69,.92) 100%)",
    borderRadius: 22,
    boxShadow: "0 22px 60px rgba(0,0,0,.35)",
    padding: "18px 18px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const title = { textAlign: "center", color: "#fff", fontSize: 40, fontWeight: 900, margin: "6px 0 0" };
  const sub = { textAlign: "center", color: "rgba(255,255,255,.9)", fontWeight: 800, fontSize: 13, marginTop: -4 };

  const msgBox = {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,.45)",
    background: "rgba(255,255,255,.08)",
    borderRadius: 12,
    color: "#fff",
    fontWeight: 800,
  };

  const fieldLabel = { color: "#fff", fontWeight: 900, fontSize: 16, margin: "10px 0 6px" };

  const input = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 2,
    border: "3px solid rgba(255,255,255,.9)",
    background: "rgba(0,0,0,.12)",
    color: "#fff",
    fontWeight: 800,
    outline: "none",
  };

  const actions = { marginTop: "auto", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" };

  const closeBtn = (disabled) => ({
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "transparent",
    color: "#fff",
    border: "2px solid rgba(255,255,255,.75)",
    opacity: disabled ? 0.7 : 1,
  });

  const updateBtn = (disabled) => ({
    padding: "12px 16px",
    borderRadius: 999,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "#fff",
    color: "#0f172a",
    border: "2px solid rgba(255,255,255,.9)",
    opacity: disabled ? 0.7 : 1,
    minWidth: 220,
  });

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Change password dialog">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={title}>Change Password</div>
        <div style={sub}>Update your password to change it</div>

        {msg ? <div style={msgBox}>{msg}</div> : null}

        <form onSubmit={onSubmit}>
          <div style={fieldLabel}>Old Password</div>
          <input
            type="password"
            name="oldPassword"
            value={form.oldPassword}
            onChange={onChange}
            placeholder="Enter your old password"
            style={input}
            disabled={saving}
            autoComplete="current-password"
            required
          />

          <div style={fieldLabel}>New Password</div>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={onChange}
            placeholder="Enter your new password"
            style={input}
            disabled={saving}
            autoComplete="new-password"
            required
          />

          <div style={fieldLabel}>Confirm New Password</div>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={onChange}
            placeholder="Confirm your new password"
            style={input}
            disabled={saving}
            autoComplete="new-password"
            required
          />

          <div style={actions}>
            <button type="button" style={closeBtn(saving)} onClick={onClose} disabled={saving}>
              Close
            </button>
            <button type="submit" style={updateBtn(saving)} disabled={saving}>
              {saving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- PAGE: EDIT PROFILE ---------- */
export default function EditProfile() {
  const nav = useNavigate();
  const loc = useLocation();

  const DARK = "#0b3d2e";
  const BG = "#ffffff";

  // ✅ Mobile/Tablet uses NEW layout; Desktop/Laptop uses OLD layout
  const isNarrow = useMediaQuery("(max-width: 1024px)");
  const isPhone = useMediaQuery("(max-width: 520px)");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);

  // desktop sidebar
  const [sideOpen, setSideOpen] = useState(true);

  // mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // top-right dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // popups
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const toggleSidebarDesktop = () => setSideOpen((v) => !v);

  async function loadProfile() {
    const token = localStorage.getItem("token");
    if (!token) return nav("/login");

    try {
      setLoading(true);
      setMsg("");
      const me = await apiGet("/api/auth/me", token);
      setProfile(me);
    } catch (e) {
      setMsg(e.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    nav("/login");
  }

  const userIdShort = useMemo(() => {
    if (!profile?._id) return "—";
    return String(profile._id).slice(-8).toUpperCase();
  }, [profile]);

  const displayId = useMemo(() => {
    const bsrt = String(profile?.bsrtId || profile?.bsrtAdminId || "").trim();
    return bsrt || userIdShort;
  }, [profile, userIdShort]);

  const fullName = useMemo(() => {
    if (!profile) return "-";
    const base = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(", ");
    return `${base}${profile.suffix ? `, ${profile.suffix}` : ""}` || "-";
  }, [profile]);

  const birthdateText = useMemo(() => formatBirthdate(profile?.birthdate), [profile]);
  const ageText = useMemo(() => {
    if (!profile?.birthdate) return "-";
    const a = ageFromBirthdate(profile.birthdate);
    return a === "-" ? "-" : `${a} years old`;
  }, [profile]);

  const roleClean = useMemo(() => String(profile?.role || profile?.userType || "").trim().toLowerCase(), [profile]);
  const isSuperAdmin = roleClean === "superadmin";
  const isAdmin = roleClean === "admin" || roleClean === "superadmin" || profile?.isAdmin === true;

  const pageTitle = isAdmin ? (isSuperAdmin ? "Superadmin Information" : "Admin Information") : "Patient Information";
  const idLabel = isAdmin ? (isSuperAdmin ? "Superadmin ID" : "Admin ID") : "Patient ID";

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

  /* =========================================================
     NEW LAYOUT (Mobile/Tablet) — uses global .profileShell CSS
     ========================================================= */
  if (isNarrow) {
    const rootClass = ["profileShell", "narrow", drawerOpen ? "drawerOpen" : ""].filter(Boolean).join(" ");
    const gridCols = isPhone ? "1fr" : "1fr 1fr";

    const cardTop = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
    const avatarWrap = {
      width: 86,
      height: 86,
      borderRadius: 999,
      overflow: "hidden",
      border: `3px solid ${DARK}`,
      background: "#fff",
      flex: "0 0 auto",
    };
    const avatarImg = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

    const nameText = { fontSize: 18, fontWeight: 900, color: DARK, lineHeight: 1.1 };
    const idText = { fontSize: 12, fontWeight: 900, color: "#334155", marginTop: 4 };

    const infoGrid = { display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 14 };
    const infoItem = {
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 12,
      padding: "10px 10px",
      background: "#fff",
      display: "grid",
      gap: 4,
      minWidth: 0,
    };
    const infoLabel = { fontSize: 12, fontWeight: 900, color: "#0f172a", opacity: 0.8 };
    const infoValue = { fontSize: 14, fontWeight: 900, color: DARK, wordBreak: "break-word" };

    const btnStack = { display: "grid", gap: 10, marginTop: 14 };

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
                  <div className="homeTitle">{pageTitle}</div>
                  <div className="homeSub">Manage and edit your profile</div>
                </div>
              </div>

              <div className="rightTop" ref={menuRef}>
                <div className="patientIdWrap">
                  <div className="patientIdLabel">{idLabel}</div>
                  <div className="patientIdValue">{displayId}</div>
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
                    <div className="ddName">{fullName}</div>
                    <div className="ddSub">{idLabel}</div>
                    <div className="ddId">{displayId}</div>

                    <div className="ddDivider" />

                    <div className="ddActions">
                      <button type="button" className="ddBtn ddBtnGhost" onClick={logout}>
                        <span aria-hidden="true">⎋</span>
                        Sign Out
                      </button>

                      <button
                        type="button"
                        className="ddBtn ddBtnSolid"
                        onClick={() => {
                          setMenuOpen(false);
                          setEditOpen(true);
                        }}
                      >
                        <span aria-hidden="true">✎</span>
                        Edit Profile
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="content">
            <div className="contentInner">
              {msg ? <div className="msgWarn">{msg}</div> : null}

              {/* ✅ keep borders/details on phone */}
              <div className="panel" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="btnOutline"
                    onClick={loadProfile}
                    disabled={loading}
                    style={{ opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="muted" style={{ marginTop: 10 }}>
                    Loading...
                  </div>
                ) : !profile ? (
                  <div className="muted" style={{ marginTop: 10 }}>
                    No profile found.
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 12, ...cardTop }}>
                      <div style={avatarWrap}>
                        <img src={profile?.avatarUrl || "/default-avatar.png"} alt="Profile" style={avatarImg} />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={nameText}>{fullName}</div>
                        <div style={idText}>
                          {idLabel}: {displayId}
                        </div>
                      </div>
                    </div>

                    <div style={infoGrid}>
                      <div style={infoItem}>
                        <div style={infoLabel}>Sex</div>
                        <div style={infoValue}>{profile?.gender || "-"}</div>
                      </div>

                      <div style={infoItem}>
                        <div style={infoLabel}>Birthdate</div>
                        <div style={infoValue}>{birthdateText}</div>
                      </div>

                      <div style={infoItem}>
                        <div style={infoLabel}>Age</div>
                        <div style={infoValue}>{ageText}</div>
                      </div>

                      <div style={infoItem}>
                        <div style={infoLabel}>Contact Number</div>
                        <div style={infoValue}>{profile?.contactNumber || "-"}</div>
                      </div>

                      <div style={{ ...infoItem, gridColumn: "1 / -1" }}>
                        <div style={infoLabel}>Email Address</div>
                        <div style={infoValue}>{profile?.email || "-"}</div>
                      </div>

                      <div style={{ ...infoItem, gridColumn: "1 / -1" }}>
                        <div style={infoLabel}>Home Address</div>
                        <div style={infoValue}>{profile?.address || "-"}</div>
                      </div>
                    </div>

                    <div style={btnStack}>
                      <button type="button" className="btnPrimary" onClick={() => setEditOpen(true)} style={{ width: "100%" }}>
                        Edit Profile
                      </button>

                      <button type="button" className="btnOutline" onClick={() => setPwOpen(true)} style={{ width: "100%" }}>
                        Change Password
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* POPUPS */}
        <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} initialProfile={profile} onSaved={loadProfile} />
        <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} onChanged={(text) => setMsg(text)} />
      </div>
    );
  }

  /* =========================================================
     OLD LAYOUT (Desktop/Laptop) — original inline-styled UI
     ========================================================= */

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
  const brandTextStyle = {
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

  const content = { flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" };

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
    flex: "1 1 auto",
    borderRadius: 34,
    border: `4px solid ${DARK}`,
    background: "#fff",
    padding: 22,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  };

  const panelBody = { display: "grid", gridTemplateColumns: "320px 1fr", gap: 26, alignItems: "start" };

  const photoCard = {
    width: "100%",
    height: 360,
    borderRadius: 28,
    border: `4px solid ${DARK}`,
    overflow: "hidden",
    background: "linear-gradient(180deg, #c7e7ff 0%, #e6f6ff 60%, #b9d96f 100%)",
  };

  const photoImg = { width: "100%", height: "100%", objectFit: "cover" };

  const label = { fontSize: 16, fontWeight: 900, color: "#0f172a" };
  const value = { marginTop: 4, fontSize: 26, fontWeight: 900, color: DARK };

  const rightGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" };
  const fullNameWrap = { gridColumn: "1 / -1" };
  const bigName = { marginTop: 4, fontSize: 24, fontWeight: 900, color: DARK };
  const smallValue = { marginTop: 4, fontSize: 22, fontWeight: 900, color: DARK };
  const leftInfo = { marginTop: 10 };

  const actions = { marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };

  const actionBtn = {
    minWidth: 200,
    padding: "12px 18px",
    borderRadius: 2,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    background: DARK,
    color: "#fff",
    border: `2px solid ${DARK}`,
  };

  return (
    <div style={shell}>
      <aside style={sidebar}>
        <div style={sideHeader}>
          {sideOpen ? (
            <div style={brandRowOpen}>
              <div style={{ color: "#fff" }}>
                <BrandIcon size={22} />
              </div>
              <div style={brandTextStyle}>AXIS</div>
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
          {SIDE_ITEMS.map(({ label: text, to, IconComp, exact }) => {
            const active = isItemActive(to, exact);

            if (!sideOpen) {
              return (
                <Link key={to} to={to} style={navItemClosedWrap} title={text}>
                  <div style={navIconBtn(active)}>
                    <IconComp size={20} />
                  </div>
                </Link>
              );
            }

            return (
              <Link key={to} to={to} style={navItemOpen(active)}>
                <IconComp size={20} />
                <span>{text}</span>
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

      <main style={main}>
        <div style={topbar}>
          <div style={topTitleWrap}>
            {!sideOpen ? (
              <div style={burger} title="Menu" onClick={toggleSidebarDesktop}>
                ☰
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{pageTitle}</div>
              <div style={{ opacity: 0.95, fontSize: 14 }}>Manage and edit your profile</div>
            </div>
          </div>

          <div style={rightTop} ref={menuRef}>
            <div style={patientIdWrap}>
              <div style={patientIdLabel}>{idLabel}</div>
              <div style={patientIdValue}>{displayId}</div>
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
                <div style={ddName}>{fullName}</div>
                <div style={ddSub}>{idLabel}</div>
                <div style={{ color: "#fff", fontWeight: 900, marginTop: 2 }}>{displayId}</div>

                <div style={ddDivider} />

                <div style={ddActions}>
                  <button type="button" style={ddSignOutBtn} onClick={logout}>
                    <span style={{ fontSize: 16 }}>⎋</span>
                    Sign Out
                  </button>

                  <button
                    type="button"
                    style={ddEditBtn}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    <span style={{ fontSize: 16 }}>✎</span>
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={content}>
          {msg ? <div style={msgBox}>{msg}</div> : null}

          <div style={panel}>
            {loading ? (
              <div style={{ color: "#64748b", fontWeight: 900 }}>Loading...</div>
            ) : (
              <>
                <div style={panelBody}>
                  <div>
                    <div style={photoCard}>
                      <img src={profile?.avatarUrl || "/default-avatar.png"} alt="Profile" style={photoImg} />
                    </div>

                    <div style={leftInfo}>
                      <div style={label}>Contact Number</div>
                      <div style={value}>{profile?.contactNumber || "-"}</div>
                    </div>

                    <div style={leftInfo}>
                      <div style={label}>Email Address</div>
                      <div style={{ ...value, fontSize: 20, wordBreak: "break-word" }}>{profile?.email || "-"}</div>
                    </div>

                    <div style={leftInfo}>
                      <div style={label}>Home Address</div>
                      <div style={{ ...value, fontSize: 20, lineHeight: 1.2, wordBreak: "break-word" }}>{profile?.address || "-"}</div>
                    </div>
                  </div>

                  <div style={rightGrid}>
                    <div style={fullNameWrap}>
                      <div style={label}>Full Name</div>
                      <div style={bigName}>{fullName}</div>
                    </div>

                    <div>
                      <div style={label}>{idLabel}</div>
                      <div style={smallValue}>{displayId}</div>
                    </div>

                    <div>
                      <div style={label}>Sex</div>
                      <div style={smallValue}>{profile?.gender || "-"}</div>
                    </div>

                    <div>
                      <div style={label}>Birthdate</div>
                      <div style={smallValue}>{birthdateText}</div>
                    </div>

                    <div>
                      <div style={label}>Age</div>
                      <div style={smallValue}>{ageText}</div>
                    </div>
                  </div>
                </div>

                <div style={actions}>
                  <button type="button" style={actionBtn} onClick={() => setPwOpen(true)}>
                    Change Password
                  </button>

                  <button type="button" style={actionBtn} onClick={() => setEditOpen(true)}>
                    Edit Profile
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} initialProfile={profile} onSaved={loadProfile} />
        <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} onChanged={(text) => setMsg(text)} />
      </main>
    </div>
  );
}