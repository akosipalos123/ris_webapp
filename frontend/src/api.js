// frontend/src/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function buildErrorMessage(data, fallback) {
  // Prefer backend { error } then { message }
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

function normalizeToken(token) {
  // Prevent "Bearer Bearer <jwt>" / "Token <jwt>" / etc.
  return String(token || "")
    .trim()
    .replace(/^(?:(?:Bearer|Token|JWT)\s+)+/i, "");
}

function getStoredTokenForPath(path) {
  if (typeof window === "undefined" || !window.localStorage) return undefined;

  // ✅ Admin endpoints: prefer adminToken, fallback to patient token
  if (String(path || "").startsWith("/api/admin")) {
    return (
      localStorage.getItem("adminToken") ||
      localStorage.getItem("token") ||
      undefined
    );
  }

  // ✅ Everything else uses patient token (unchanged)
  return localStorage.getItem("token") || undefined;
}

function authHeader(path, tokenOverride) {
  // If caller explicitly provided tokenOverride (even null), respect it.
  const token =
    tokenOverride === undefined ? getStoredTokenForPath(path) : tokenOverride;

  const jwt = token ? normalizeToken(token) : "";
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(path, token),
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

export async function apiGet(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      ...authHeader(path, token),
    },
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

// Backward-compatible:
// - apiPut(path, token, body)  ✅ old usage
// - apiPut(path, body)        ✅ new optional usage
export async function apiPut(path, tokenOrBody, body) {
  const usingShiftedArgs =
    body === undefined && tokenOrBody && typeof tokenOrBody === "object";

  const token = usingShiftedArgs ? undefined : tokenOrBody;
  const payload = usingShiftedArgs ? tokenOrBody : body;

  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(path, token),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

// Backward-compatible:
// - apiPatch(path, token, body) ✅ old usage
// - apiPatch(path, body)       ✅ new optional usage
export async function apiPatch(path, tokenOrBody, body) {
  const usingShiftedArgs =
    body === undefined && tokenOrBody && typeof tokenOrBody === "object";

  const token = usingShiftedArgs ? undefined : tokenOrBody;
  const payload = usingShiftedArgs ? tokenOrBody : body;

  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(path, token),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

/**
 * Upload helper (multipart/form-data)
 * IMPORTANT: do NOT set Content-Type manually; browser will set boundary.
 *
 * Backward-compatible:
 * - apiUpload(path, token, formData) ✅ old usage
 * - apiUpload(path, formData)        ✅ new optional usage
 */
export async function apiUpload(path, tokenOrFormData, formData) {
  const usingShiftedArgs =
    formData === undefined &&
    tokenOrFormData &&
    typeof FormData !== "undefined" &&
    tokenOrFormData instanceof FormData;

  const token = usingShiftedArgs ? undefined : tokenOrFormData;
  const fd = usingShiftedArgs ? tokenOrFormData : formData;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...authHeader(path, token),
    },
    body: fd,
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Upload failed"));
  return data;
}