import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api";
import EolBadge from "../components/EolBadge";
import StatCard from "../components/StatCard";
import SyncButton from "../components/SyncButton";

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function SortIcon({ dir }) {
  if (!dir) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

const COLUMNS = [
  { key: "name",          label: "Customer" },
  { key: "domain",        label: "Domain" },
  { key: "total_active",  label: "Active" },
  { key: "expired",       label: "Expired" },
  { key: "expiring_6m",   label: "≤6mo" },
  { key: "expiring_12m",  label: "≤12mo" },
  { key: "expiring_24m",  label: "≤24mo" },
  { key: "pipeline_24m",  label: "Pipeline 24mo" },
  { key: "last_synced_at",label: "Last sync" },
];

function exportCSV(tenants) {
  const headers = ["Customer", "Domain", "Active", "Expired", "≤6mo", "≤12mo", "≤24mo", "Pipeline 12mo", "Pipeline 24mo", "Last sync"];
  const rows = tenants.map((t) => [
    t.name,
    t.domain,
    t.total_active,
    t.expired,
    t.expiring_6m ?? 0,
    t.expiring_12m ?? 0,
    t.expiring_24m ?? 0,
    Number(t.pipeline_12m).toFixed(2),
    Number(t.pipeline_24m).toFixed(2),
    t.last_synced_at ? new Date(t.last_synced_at).toLocaleString("en-GB") : "Never",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chromebook-eol-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  api.logAudit("csv_export_all", `Exported ${tenants.length} customers`).catch(() => {});
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => { api.logAudit("dashboard_view").catch(() => {}); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 120_000,
  });

  const sortedFiltered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    const filtered = data.tenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, search, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error.message}</div>;

  const chartData = data.tenants
    .slice(0, 15)
    .map((t) => ({ name: t.name.split(" ")[0], "12m": Number(t.pipeline_12m), "24m": Number(t.pipeline_24m) }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EOL Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.total_tenants} customers · live data</p>
        </div>
        <SyncButton label="Sync all customers" />
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap justify-center gap-4">
        <StatCard label="Active devices" value={data.total_active_devices.toLocaleString()} accent="brand" />
        <StatCard label="Expired" value={data.total_expired.toLocaleString()} accent="red" />
        <StatCard label="Expiring ≤12mo" value={data.total_expiring_12m.toLocaleString()} accent="amber" />
        <StatCard label="Expiring ≤24mo" value={data.total_expiring_24m.toLocaleString()} accent="amber" />
        <StatCard label="Pipeline 12mo" value={fmt(data.total_pipeline_12m)} sub="estimated replacement" accent="green" />
        <StatCard label="Pipeline 24mo" value={fmt(data.total_pipeline_24m)} sub="estimated replacement" accent="purple" />
        <StatCard label="Customers" value={data.total_tenants} accent="brand" />
      </div>

      {/* Pipeline chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 15 customers by pipeline value</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="12m" fill="#007aff" name="12-month" radius={[3, 3, 0, 0]} />
            <Bar dataKey="24m" fill="#66b7ff" name="24-month" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search customers or domains…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => exportCSV(sortedFiltered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
          >
            ⬇ Export CSV
          </button>
        </div>

        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-brand-600 select-none whitespace-nowrap"
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedFiltered.map((t) => (
              <tr
                key={t.id}
                onClick={() => navigate(`/tenant/${t.id}`)}
                className="hover:bg-brand-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.domain}</td>
                <td className="px-4 py-3">{t.total_active}</td>
                <td className="px-4 py-3">
                  {t.expired > 0 ? <span className="font-semibold text-red-600">{t.expired}</span> : "—"}
                </td>
                <td className="px-4 py-3 text-orange-600 font-medium">{t.expiring_6m || "—"}</td>
                <td className="px-4 py-3 text-amber-600 font-medium">{t.expiring_12m || "—"}</td>
                <td className="px-4 py-3 text-gray-700">{t.expiring_24m || "—"}</td>
                <td className="px-4 py-3 font-semibold text-brand-600">{fmt(t.pipeline_24m)}</td>
                <td className="px-4 py-3">
                  <SyncStatus status={t.last_sync_status} at={t.last_synced_at} />
                </td>
              </tr>
            ))}
            {sortedFiltered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No customers match "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncStatus({ status, at }) {
  const dot = {
    success: "bg-green-400",
    failed: "bg-red-400",
    running: "bg-amber-400 animate-pulse",
    never: "bg-gray-300",
  }[status] ?? "bg-gray-300";

  const label = at
    ? new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Never";

  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
