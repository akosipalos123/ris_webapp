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
  // Prefer backend standard { message } if available
  if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

export async function apiPut(path, token, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

export async function apiPatch(path, token, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Request failed"));
  return data;
}

/**
 * Upload helper (multipart/form-data)
 * IMPORTANT: do NOT set Content-Type manually; browser will set boundary.
 */
export async function apiUpload(path, token, formData) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(buildErrorMessage(data, "Upload failed"));
  return data;
}
