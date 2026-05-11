import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// ── iOS version badge ──────────────────────────────────────────────────────────

const IPAD_MODELS = {
  "iPad7,1": "iPad Pro 12.9\" (2nd gen)",
  "iPad7,2": "iPad Pro 12.9\" (2nd gen)",
  "iPad7,3": "iPad Pro 10.5\"",
  "iPad7,4": "iPad Pro 10.5\"",
  "iPad7,5": "iPad (6th gen)",
  "iPad7,6": "iPad (6th gen)",
  "iPad7,11": "iPad (7th gen)",
  "iPad7,12": "iPad (7th gen)",
  "iPad11,3": "iPad Air (3rd gen)",
  "iPad11,4": "iPad Air (3rd gen)",
  "iPad11,6": "iPad (8th gen)",
  "iPad11,7": "iPad (8th gen)",
  "iPad12,1": "iPad (9th gen)",
  "iPad12,2": "iPad (9th gen)",
  "iPad13,1": "iPad Air (4th gen)",
  "iPad13,2": "iPad Air (4th gen)",
  "iPad13,4": "iPad Pro 11\" (3rd gen)",
  "iPad13,8": "iPad Pro 12.9\" (5th gen)",
  "iPad13,16": "iPad Air (5th gen)",
  "iPad13,18": "iPad (10th gen)",
  "iPad13,19": "iPad (10th gen)",
  "iPad14,1": "iPad mini (6th gen)",
  "iPad14,2": "iPad mini (6th gen)",
  "iPad14,3": "iPad Pro 11\" (4th gen)",
  "iPad14,8": "iPad Air 11\" M2",
  "iPad14,9": "iPad Air 11\" M2",
  "iPad14,10": "iPad Air 13\" M2",
  "iPad15,3": "iPad Air 11\" M3",
  "iPad15,4": "iPad Air 11\" M3",
  "iPad15,7": "iPad (11th gen)",
  "iPad15,8": "iPad (11th gen)",
  "iPad16,1": "iPad mini (7th gen)",
};

function friendlyModel(productName) {
  return IPAD_MODELS[productName] ?? productName ?? "iPad";
}

function IosVersionBadge({ version }) {
  if (!version) return <span className="text-gray-400 text-xs">—</span>;
  const major = parseInt(version.split(".")[0], 10);
  if (isNaN(major)) return <span className="font-mono text-xs text-gray-500">{version}</span>;
  if (major < 16) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
        ⚠ iOS {version}
      </span>
    );
  }
  if (major < 18) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
        iOS {version}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
      iOS {version}
    </span>
  );
}

function checkinAge(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function CheckinBadge({ dateStr }) {
  const days = checkinAge(dateStr);
  if (days === null) return <span className="text-gray-400 text-xs">Never</span>;
  const label = days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
  if (days > 30) return <span className="text-xs text-red-500 font-medium">{label}</span>;
  if (days > 7)  return <span className="text-xs text-amber-600">{label}</span>;
  return <span className="text-xs text-gray-500">{label}</span>;
}

// ── Chromebook table helpers ───────────────────────────────────────────────────

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

// ── Main component ─────────────────────────────────────────────────────────────

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("chromebooks"); // 'chromebooks' | 'ipads'
  const [sortKey, setSortKey] = useState("auto_update_expiration");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const [eolFilter, setEolFilter] = useState(null);
  const [iosSearch, setIosSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { api.logAudit("tenant_view", `Viewed customer ID: ${id}`).catch(() => {}); }, [id]);

  const { data: tenant } = useQuery({ queryKey: ["tenant", id], queryFn: () => api.getTenant(id) });
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices", id],
    queryFn: () => api.getDevices(id, { status: "ACTIVE", limit: 1000 }),
  });
  const { data: iosDevices, isLoading: iosLoading } = useQuery({
    queryKey: ["ios-devices", id],
    queryFn: () => api.getIosDevices(id),
  });
  const { data: logs } = useQuery({
    queryKey: ["sync-logs", id],
    queryFn: () => api.getSyncLogs(id),
  });

  const now = new Date();

  // ── Chromebook derived stats ──
  const flexDevices = devices?.filter((d) => d.is_chromeos_flex) ?? [];
  const expired = devices?.filter((d) => {
    if (d.is_chromeos_flex && d.flex_eol_year) return new Date(d.flex_eol_year, 11, 31) < now;
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

  const sortedFiltered = useMemo(() => {
    if (!devices) return [];
    const q = search.toLowerCase();
    const filtered = devices.filter((d) => {
      if (q && !(
        (d.serial_number ?? "").toLowerCase().includes(q) ||
        (d.model ?? "").toLowerCase().includes(q) ||
        (d.annotated_user ?? "").toLowerCase().includes(q) ||
        (d.annotated_location ?? "").toLowerCase().includes(q)
      )) return false;
      if (eolFilter) {
        const eolDate = d.is_chromeos_flex && d.flex_eol_year
          ? new Date(d.flex_eol_year, 11, 31)
          : d.auto_update_expiration ? new Date(d.auto_update_expiration) : null;
        const daysLeft = eolDate ? (eolDate - now) / 86400000 : null;
        if (eolFilter === "expired"      && (daysLeft === null || daysLeft >= 0)) return false;
        if (eolFilter === "expiring_12m" && (daysLeft === null || daysLeft < 0 || daysLeft > 365)) return false;
        if (eolFilter === "flex"         && !d.is_chromeos_flex) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [devices, search, sortKey, sortDir, eolFilter]);

  // ── iOS derived stats ──
  const iosFiltered = useMemo(() => {
    if (!iosDevices) return [];
    if (!iosSearch) return iosDevices;
    const q = iosSearch.toLowerCase();
    return iosDevices.filter((d) =>
      (d.device_name ?? "").toLowerCase().includes(q) ||
      (d.serial_number ?? "").toLowerCase().includes(q) ||
      (d.product_name ?? "").toLowerCase().includes(q) ||
      (d.assigned_user ?? "").toLowerCase().includes(q) ||
      (d.group_name ?? "").toLowerCase().includes(q)
    );
  }, [iosDevices, iosSearch]);

  const iosOutdated = iosDevices?.filter((d) => {
    const major = parseInt((d.os_version ?? "").split(".")[0], 10);
    return !isNaN(major) && major < 17;
  }).length ?? 0;
  const iosStale = iosDevices?.filter((d) => checkinAge(d.last_checkin) > 30).length ?? 0;

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function handleIosImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await api.importIosDevices(id, file);
      setImportMsg({ ok: true, text: `Imported ${result.imported} devices` });
      queryClient.invalidateQueries({ queryKey: ["ios-devices", id] });
    } catch (err) {
      setImportMsg({ ok: false, text: `Import failed: ${err.message}` });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  if (!tenant) return <div className="p-8 text-gray-500">Loading…</div>;

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

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: "chromebooks", label: `💻 Chromebooks${devices ? ` (${devices.length})` : ""}` },
          { key: "ipads",       label: `📱 iPads${iosDevices ? ` (${iosDevices.length})` : ""}` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CHROMEBOOKS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "chromebooks" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Active devices" value={devices?.length ?? "…"} accent="brand"
              onClick={() => setEolFilter(null)} active={eolFilter === null} />
            <StatCard label="ChromeOS Flex" value={flexDevices.length} accent="brand"
              onClick={() => setEolFilter(f => f === "flex" ? null : "flex")} active={eolFilter === "flex"} />
            <StatCard label="Expired" value={expired.length} accent="red"
              onClick={() => setEolFilter(f => f === "expired" ? null : "expired")} active={eolFilter === "expired"} />
            <StatCard label="Expiring ≤12mo" value={expiring12.length} accent="amber"
              onClick={() => setEolFilter(f => f === "expiring_12m" ? null : "expiring_12m")} active={eolFilter === "expiring_12m"} />
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
                      <td className="px-4 py-2 text-xs text-gray-500">{new Date(l.started_at).toLocaleString("en-GB")}</td>
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
        </>
      )}

      {/* ── iPADS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === "ipads" && (
        <>
          {/* Import bar */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-800">Import from LightSpeed MDM</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Export via <span className="font-mono">Reports → Device Management → Devices → Export Active Devices</span>, then upload the CSV here.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleIosImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : "📥 Upload CSV"}
            </button>
            {importMsg && (
              <span className={`text-sm font-medium ${importMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {importMsg.ok ? "✓" : "✗"} {importMsg.text}
              </span>
            )}
          </div>

          {/* iOS stats */}
          {iosDevices && iosDevices.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Total iPads" value={iosDevices.length} accent="brand" />
              <StatCard label="Outdated iOS (<17)" value={iosOutdated} accent="amber" />
              <StatCard label="Stale check-in (>30d)" value={iosStale} accent="red" />
            </div>
          )}

          {/* iOS table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {iosDevices && iosDevices.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-700 mr-auto">
                  iPads ({iosDevices.length})
                  {iosDevices[0]?.imported_at && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      Last import: {new Date(iosDevices[0].imported_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </h2>
                <input
                  type="search"
                  placeholder="Search name, serial, user, group…"
                  value={iosSearch}
                  onChange={(e) => setIosSearch(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
                />
              </div>
            )}

            {iosLoading ? (
              <div className="p-8 text-center text-gray-400">Loading iPads…</div>
            ) : !iosDevices || iosDevices.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-4xl mb-3">📱</p>
                <p className="text-gray-500 text-sm">No iPad data yet.</p>
                <p className="text-gray-400 text-xs mt-1">Upload a LightSpeed CSV export above to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Device name", "Model", "Serial", "iOS version", "Group", "Last check-in", "User"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {iosFiltered.map((d) => (
                      <tr key={d.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-2 font-medium text-gray-800">{d.device_name ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-600 text-xs">
                          <div>{friendlyModel(d.product_name)}</div>
                          <div className="text-gray-400 font-mono">{d.product_name}</div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">{d.serial_number ?? "—"}</td>
                        <td className="px-4 py-2"><IosVersionBadge version={d.os_version} /></td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{d.group_name ?? "—"}</td>
                        <td className="px-4 py-2"><CheckinBadge dateStr={d.last_checkin} /></td>
                        <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-[120px]">{d.assigned_user ?? "—"}</td>
                      </tr>
                    ))}
                    {iosFiltered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                          No iPads match "{iosSearch}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
