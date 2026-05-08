import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import EolBadge, { FlexBadge } from "../components/EolBadge";

function SortIcon({ dir }) {
  if (!dir) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

const EOL_FILTERS = [
  { value: "",           label: "All devices" },
  { value: "expired",    label: "Expired" },
  { value: "expiring_6m",  label: "Expiring ≤6mo" },
  { value: "expiring_12m", label: "Expiring ≤12mo" },
  { value: "expiring_24m", label: "Expiring ≤24mo" },
  { value: "flex",       label: "ChromeOS Flex only" },
  { value: "not_flex",   label: "Non-Flex only" },
];

const COLS = [
  { key: "tenant_name",           label: "Customer" },
  { key: "serial_number",         label: "Serial" },
  { key: "model",                 label: "Model" },
  { key: "auto_update_expiration",label: "EOL date" },
  { key: "annotated_user",        label: "User" },
  { key: "annotated_location",    label: "Location" },
  { key: "os_version",            label: "OS version" },
  { key: "org_unit_path",         label: "Org unit" },
];

function exportCSV(devices) {
  const headers = ["Customer", "Serial", "Model", "EOL date", "Flex?", "Flex EOL", "User", "Location", "OS version", "Org unit"];
  const rows = devices.map((d) => [
    d.tenant_name ?? "",
    d.serial_number ?? "",
    d.model ?? "",
    d.auto_update_expiration ? new Date(d.auto_update_expiration).toLocaleDateString("en-GB") : "",
    d.is_chromeos_flex ? "Yes" : "No",
    d.flex_eol_year ?? "",
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
  a.download = `all-devices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Devices() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch]         = useState("");
  const [eolFilter, setEolFilter]   = useState(searchParams.get("eol") ?? "");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sortKey, setSortKey]       = useState("auto_update_expiration");
  const [sortDir, setSortDir]       = useState("asc");

  const { data: devices, isLoading } = useQuery({
    queryKey: ["all-devices"],
    queryFn: () => api.getAllDevices({ limit: 10000 }),
    staleTime: 60_000,
  });

  const customers = useMemo(() => {
    if (!devices) return [];
    return ["", ...Array.from(new Set(devices.map((d) => d.tenant_name).filter(Boolean))).sort()];
  }, [devices]);

  const now = new Date();

  const filtered = useMemo(() => {
    if (!devices) return [];
    return devices.filter((d) => {
      if (customerFilter && d.tenant_name !== customerFilter) return false;

      if (eolFilter) {
        const eolDate = d.is_chromeos_flex && d.flex_eol_year
          ? new Date(d.flex_eol_year, 11, 31)
          : d.auto_update_expiration ? new Date(d.auto_update_expiration) : null;
        const days = eolDate ? (eolDate - now) / 86400000 : null;
        if (eolFilter === "expired"      && (days === null || days >= 0))          return false;
        if (eolFilter === "expiring_6m"  && (days === null || days < 0 || days > 180)) return false;
        if (eolFilter === "expiring_12m" && (days === null || days < 0 || days > 365)) return false;
        if (eolFilter === "expiring_24m" && (days === null || days < 0 || days > 730)) return false;
        if (eolFilter === "flex"         && !d.is_chromeos_flex)                   return false;
        if (eolFilter === "not_flex"     && d.is_chromeos_flex)                    return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          (d.serial_number ?? "").toLowerCase().includes(q) ||
          (d.model ?? "").toLowerCase().includes(q) ||
          (d.annotated_user ?? "").toLowerCase().includes(q) ||
          (d.annotated_location ?? "").toLowerCase().includes(q) ||
          (d.tenant_name ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [devices, search, eolFilter, customerFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const flexCount    = devices?.filter((d) => d.is_chromeos_flex).length ?? 0;
  const expiredCount = devices?.filter((d) => {
    const eolDate = d.is_chromeos_flex && d.flex_eol_year
      ? new Date(d.flex_eol_year, 11, 31)
      : d.auto_update_expiration ? new Date(d.auto_update_expiration) : null;
    return eolDate && eolDate < now;
  }).length ?? 0;
  const exp12Count = devices?.filter((d) => {
    const eolDate = d.is_chromeos_flex && d.flex_eol_year
      ? new Date(d.flex_eol_year, 11, 31)
      : d.auto_update_expiration ? new Date(d.auto_update_expiration) : null;
    if (!eolDate) return false;
    const days = (eolDate - now) / 86400000;
    return days >= 0 && days <= 365;
  }).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">💻 All Devices</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every active device across all customers</p>
      </div>

      {/* Summary tiles */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Total devices", value: devices?.length ?? "—", filter: "",            accent: "brand" },
          { label: "Expired",       value: expiredCount,           filter: "expired",      accent: "red"   },
          { label: "Expiring ≤12mo",value: exp12Count,             filter: "expiring_12m", accent: "amber" },
          { label: "ChromeOS Flex", value: flexCount,              filter: "flex",         accent: "brand" },
        ].map(({ label, value, filter, accent }) => {
          const active = eolFilter === filter;
          const colors = {
            brand: "bg-brand-50 text-brand-700 border-brand-200",
            red:   "bg-red-50 text-red-700 border-red-200",
            amber: "bg-amber-50 text-amber-700 border-amber-200",
          };
          const rings = {
            brand: "ring-2 ring-brand-500",
            red:   "ring-2 ring-red-500",
            amber: "ring-2 ring-amber-500",
          };
          return (
            <div
              key={label}
              onClick={() => setEolFilter(active ? "" : filter)}
              className={`rounded-xl border p-4 text-center w-40 shrink-0 grow cursor-pointer hover:opacity-80 transition-opacity select-none
                ${colors[accent]} ${active ? rings[accent] : ""}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
              <p className="text-xs mt-1 opacity-50">{active ? "✕ clear" : "click to filter"}</p>
            </div>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search serial, model, user, customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All customers</option>
          {customers.filter(Boolean).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={eolFilter}
          onChange={(e) => setEolFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {EOL_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {(search || eolFilter || customerFilter) && (
          <button
            onClick={() => { setSearch(""); setEolFilter(""); setCustomerFilter(""); }}
            className="text-xs text-brand-600 hover:underline"
          >✕ Clear all</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{sorted.length.toLocaleString()} devices</span>
        <button
          onClick={() => exportCSV(sorted)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
        >⬇ Export CSV</button>
      </div>

      {/* Device table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading devices…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-brand-600 select-none whitespace-nowrap"
                    >
                      {col.label}<SortIcon dir={sortKey === col.key ? sortDir : null} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/tenant/${d.tenant_id}`)}
                    className={`cursor-pointer hover:bg-brand-50 transition-colors ${d.is_chromeos_flex ? "bg-blue-50/30" : ""}`}
                  >
                    <td className="px-4 py-2 font-medium text-brand-600 hover:underline">{d.tenant_name ?? "—"}</td>
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
                {sorted.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No devices match the current filters
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
