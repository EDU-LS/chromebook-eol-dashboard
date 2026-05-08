import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import EolBadge, { FlexBadge } from "../components/EolBadge";
import StatCard from "../components/StatCard";
import SyncButton from "../components/SyncButton";

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function SortIcon({ dir }) {
  if (!dir) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

const DEVICE_COLS = [
  { key: "serial_number",          label: "Serial" },
  { key: "model",                  label: "Model" },
  { key: "auto_update_expiration", label: "EOL date" },
  { key: "annotated_user",         label: "User" },
  { key: "annotated_location",     label: "Location" },
  { key: "os_version",             label: "OS version" },
  { key: "org_unit_path",          label: "Org unit" },
];

function exportDeviceCSV(tenantName, devices) {
  const headers = ["Serial", "Model", "EOL date", "User", "Location", "OS version", "Org unit"];
  const rows = devices.map((d) => [
    d.serial_number ?? "",
    d.model ?? "",
    d.auto_update_expiration ? new Date(d.auto_update_expiration).toLocaleDateString("en-GB") : "",
    d.annotated_user ?? "",
    d.annotated_location ?? "",
    d.os_version ?? "",
    d.org_unit_path ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tenantName.replace(/\s+/g, "-").toLowerCase()}-devices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  api.logAudit("csv_export_tenant", `Exported ${devices.length} devices for ${tenantName}`).catch(() => {});
}

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState("auto_update_expiration");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");

  useEffect(() => { api.logAudit("tenant_view", `Viewed customer ID: ${id}`).catch(() => {}); }, [id]);

  const { data: tenant } = useQuery({ queryKey: ["tenant", id], queryFn: () => api.getTenant(id) });
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices", id],
    queryFn: () => api.getDevices(id, { status: "ACTIVE", limit: 1000 }),
  });
  const { data: logs } = useQuery({
    queryKey: ["sync-logs", id],
    queryFn: () => api.getSyncLogs(id),
  });

  const sortedFiltered = useMemo(() => {
    if (!devices) return [];
    const q = search.toLowerCase();
    const filtered = devices.filter(
      (d) =>
        (d.serial_number ?? "").toLowerCase().includes(q) ||
        (d.model ?? "").toLowerCase().includes(q) ||
        (d.annotated_user ?? "").toLowerCase().includes(q) ||
        (d.annotated_location ?? "").toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [devices, search, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (!tenant) return <div className="p-8 text-gray-500">Loading…</div>;

  const now = new Date();
  const flexDevices = devices?.filter((d) => d.is_chromeos_flex) ?? [];
  const expired = devices?.filter((d) => {
    if (d.is_chromeos_flex && d.flex_eol_year) {
      return new Date(d.flex_eol_year, 11, 31) < now;
    }
    return d.auto_update_expiration && new Date(d.auto_update_expiration) < now;
  }) ?? [];
  const expiring12 = devices?.filter((d) => {
    const eolDate = d.is_chromeos_flex && d.flex_eol_year
      ? new Date(d.flex_eol_year, 11, 31)
      : d.auto_update_expiration ? new Date(d.auto_update_expiration) : null;
    if (!eolDate) return false;
    const diff = (eolDate - now) / 86400000;
    return diff >= 0 && diff <= 365;
  }) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Back</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-500 font-mono">{tenant.domain}</p>
        </div>
        <SyncButton tenantId={id} label="Sync customer" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active devices" value={devices?.length ?? "…"} accent="brand" />
        <StatCard label="ChromeOS Flex" value={flexDevices.length} accent="brand" />
        <StatCard label="Expired" value={expired.length} accent="red" />
        <StatCard label="Expiring ≤12mo" value={expiring12.length} accent="amber" />
        <StatCard label="Est. 12mo pipeline" value={fmt(expiring12.length * Number(tenant.device_replacement_cost))} accent="green" />
      </div>

      {/* Device table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 mr-auto">
            Active devices ({devices?.length ?? "…"})
          </h2>
          <input
            type="search"
            placeholder="Search serial, model, user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          />
          {devices && (
            <button
              onClick={() => exportDeviceCSV(tenant.name, sortedFiltered)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading devices…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {DEVICE_COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-brand-600 select-none whitespace-nowrap"
                    >
                      {col.label}
                      <SortIcon dir={sortKey === col.key ? sortDir : null} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedFiltered.map((d) => (
                  <tr key={d.id} className={`hover:bg-brand-50 ${d.is_chromeos_flex ? "bg-blue-50/30" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{d.serial_number ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-800">
                      <div className="flex items-center gap-2">
                        <span>{d.model ?? "—"}</span>
                        {d.is_chromeos_flex && <FlexBadge flexStatus={d.flex_status} />}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <EolBadge
                        date={d.auto_update_expiration}
                        isFlex={d.is_chromeos_flex}
                        flexEolYear={d.flex_eol_year}
                        flexStatus={d.flex_status}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-500 truncate max-w-[140px]">{d.annotated_user ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{d.annotated_location ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">{d.os_version ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-[160px]">{d.org_unit_path ?? "—"}</td>
                  </tr>
                ))}
                {sortedFiltered.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={DEVICE_COLS.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                      {search ? `No devices match "${search}"` : "No devices found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync log */}
      {logs && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Recent syncs</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Started", "Status", "Devices", "Error"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(l.started_at).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      l.status === "success" ? "bg-green-100 text-green-700" :
                      l.status === "failed"  ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-2">{l.devices_synced}</td>
                  <td className="px-4 py-2 text-xs text-red-500 max-w-xs truncate">{l.error_message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
