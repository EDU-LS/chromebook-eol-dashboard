import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

const ACTION_CONFIG = {
  // Auth
  login_success:            { label: "Sign in",              style: "bg-green-100 text-green-700",   icon: "✅" },
  login_failed:             { label: "Failed sign in",        style: "bg-red-100 text-red-700",       icon: "❌" },
  // Customers
  tenant_created:           { label: "Customer added",        style: "bg-brand-100 text-brand-700",   icon: "➕" },
  tenant_updated:           { label: "Customer updated",      style: "bg-amber-100 text-amber-700",   icon: "✏️" },
  tenant_deleted:           { label: "Customer removed",      style: "bg-red-100 text-red-700",       icon: "🗑️" },
  tenant_csv_import:        { label: "CSV import",            style: "bg-brand-100 text-brand-700",   icon: "📥" },
  // Syncs
  sync_triggered:           { label: "Sync triggered",        style: "bg-purple-100 text-purple-700", icon: "🔄" },
  sync_all:                 { label: "Sync all",              style: "bg-purple-100 text-purple-700", icon: "🔄" },
  sync_nightly:             { label: "Nightly sync",          style: "bg-purple-100 text-purple-700", icon: "🌙" },
  // Page views
  dashboard_view:           { label: "Viewed dashboard",      style: "bg-gray-100 text-gray-500",     icon: "👁️" },
  tenant_view:              { label: "Viewed customer",        style: "bg-gray-100 text-gray-500",     icon: "👁️" },
  // Exports
  csv_export_all:           { label: "CSV export (all)",      style: "bg-green-100 text-green-700",   icon: "⬇️" },
  csv_export_tenant:        { label: "CSV export (customer)", style: "bg-green-100 text-green-700",   icon: "⬇️" },
  // Ideas
  suggestion_created:       { label: "Idea posted",           style: "bg-amber-100 text-amber-700",   icon: "💡" },
  suggestion_status_changed:{ label: "Idea status changed",   style: "bg-amber-100 text-amber-700",   icon: "🏷️" },
  comment_added:            { label: "Reply posted",          style: "bg-amber-100 text-amber-700",   icon: "💬" },
};

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// Users derived dynamically from log data — see below
const ACTIONS = [
  "All actions",
  "login_success", "login_failed",
  "tenant_created", "tenant_updated", "tenant_deleted", "tenant_csv_import",
  "sync_triggered", "sync_all", "sync_nightly",
  "dashboard_view", "tenant_view",
  "csv_export_all", "csv_export_tenant",
  "suggestion_created", "suggestion_status_changed", "comment_added",
];

export default function Audit() {
  const [userFilter,   setUserFilter]   = useState("All users");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [search,       setSearch]       = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: api.getAuditLogs,
    refetchInterval: 30_000,
  });

  const users = ["All users", ...Array.from(new Set(logs?.map((l) => l.username) ?? [])).sort()];

  const filtered = logs?.filter((l) => {
    if (userFilter   !== "All users"   && l.username !== userFilter)    return false;
    if (actionFilter !== "All actions" && l.action   !== actionFilter)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.username.toLowerCase().includes(q) &&
          !(l.detail ?? "").toLowerCase().includes(q) &&
          !(l.ip_address ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }) ?? [];

  // Summary counts
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayLogs  = logs?.filter((l) => new Date(l.created_at) >= todayStart) ?? [];
  const signIns    = logs?.filter((l) => l.action === "login_success").length ?? 0;
  const failures   = logs?.filter((l) => l.action === "login_failed").length  ?? 0;
  const changes    = logs?.filter((l) => ["tenant_created","tenant_updated","tenant_deleted"].includes(l.action)).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔍 Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">All user activity — refreshes every 30 seconds</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total events</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{logs?.length ?? "—"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Today</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{todayLogs.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Successful sign ins</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{signIns}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Failed attempts</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{failures}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search user, detail, IP…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {users.map((u) => <option key={u}>{u}</option>)}
        </select>
        {userFilter !== "All users" && (
          <button
            onClick={() => setUserFilter("All users")}
            className="text-xs text-brand-600 hover:underline"
          >
            ✕ Clear filter
          </button>
        )}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === "All actions" ? a : (ACTION_CONFIG[a]?.label ?? a)}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} events</span>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Timestamp", "User", "Action", "Detail", "IP address"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((l) => {
                  const cfg = ACTION_CONFIG[l.action] ?? { label: l.action, style: "bg-gray-100 text-gray-600", icon: "•" };
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                        {fmt(l.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setUserFilter(l.username)}
                          className="flex items-center gap-2 group"
                          title={`Filter by ${l.username}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {l.username[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 group-hover:text-brand-600 group-hover:underline">
                            {l.username}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.style}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">
                        {l.detail ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {l.ip_address ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No events found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
