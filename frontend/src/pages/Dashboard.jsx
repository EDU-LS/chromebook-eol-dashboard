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

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 120_000,
  });

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
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard label="Active devices" value={data.total_active_devices.toLocaleString()} accent="indigo" />
        <StatCard label="Expired" value={data.total_expired.toLocaleString()} accent="red" />
        <StatCard label="Expiring ≤12mo" value={data.total_expiring_12m.toLocaleString()} accent="amber" />
        <StatCard label="Expiring ≤24mo" value={data.total_expiring_24m.toLocaleString()} accent="amber" />
        <StatCard label="Pipeline 12mo" value={fmt(data.total_pipeline_12m)} sub="estimated replacement" accent="green" />
        <StatCard label="Pipeline 24mo" value={fmt(data.total_pipeline_24m)} sub="estimated replacement" accent="purple" />
        <StatCard label="Customers" value={data.total_tenants} accent="indigo" />
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
            <Bar dataKey="12m" fill="#4f46e5" name="12-month" radius={[3, 3, 0, 0]} />
            <Bar dataKey="24m" fill="#a5b4fc" name="24-month" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Customer", "Domain", "Active", "Expired", "≤6mo", "≤12mo", "≤24mo", "Pipeline 24mo", "Last sync"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.tenants.map((t) => (
              <tr
                key={t.id}
                onClick={() => navigate(`/tenant/${t.id}`)}
                className="hover:bg-indigo-50 cursor-pointer transition-colors"
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
                <td className="px-4 py-3 font-semibold text-indigo-700">{fmt(t.pipeline_24m)}</td>
                <td className="px-4 py-3">
                  <SyncStatus status={t.last_sync_status} at={t.last_synced_at} />
                </td>
              </tr>
            ))}
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
