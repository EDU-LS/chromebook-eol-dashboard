import { getToken, clearToken } from "./auth";

const BASE = "/api";

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function login(username, password) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Incorrect username or password");
  return res.json();
}

export const api = {
  getDashboard: () => request("/dashboard"),
  getTenants: () => request("/tenants"),
  getTenant: (id) => request(`/tenants/${id}`),
  createTenant: (body) => request("/tenants", { method: "POST", body: JSON.stringify(body) }),
  updateTenant: (id, body) => request(`/tenants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTenant: (id) => request(`/tenants/${id}`, { method: "DELETE" }),
  syncTenant: (id) => request(`/tenants/${id}/sync`, { method: "POST" }),
  syncAll: () => request("/tenants/sync/all", { method: "POST" }),
  getSyncLogs: (id) => request(`/tenants/${id}/sync-logs`),
  getDevices: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tenants/${id}/devices${qs ? `?${qs}` : ""}`);
  },
  getAllDevices: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""))
    ).toString();
    return request(`/devices${qs ? `?${qs}` : ""}`, {}, 60000);
  },
  getAuditLogs: () => request("/audit"),
  logAudit: (action, detail) => request("/audit/log", { method: "POST", body: JSON.stringify({ action, detail }) }),
  importTenantsCsv: (file) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/tenants/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then((r) => {
      if (r.status === 401) { clearToken(); window.location.href = "/login"; }
      if (!r.ok) return r.text().then((t) => { throw new Error(t); });
      return r.json();
    });
  },
  getSuggestions: () => request("/suggestions"),
  createSuggestion: (body) => request("/suggestions", { method: "POST", body: JSON.stringify(body) }),
  updateSuggestionStatus: (id, status) => request(`/suggestions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  addComment: (id, body) => request(`/suggestions/${id}/comments`, { method: "POST", body: JSON.stringify(body) }),
};
