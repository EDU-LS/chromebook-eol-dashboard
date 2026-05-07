const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
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
};
