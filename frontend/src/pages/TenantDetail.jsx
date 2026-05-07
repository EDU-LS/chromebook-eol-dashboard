import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import EolBadge from "../components/EolBadge";
import StatCard from "../components/StatCard";
import SyncButton from "../components/SyncButton";

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: tenant } = useQuery({ queryKey: ["tenant", id], queryFn: () => api.getTenant(id) });
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices", id],
    queryFn: () => api.getDevices(id, { status: "ACTIVE", limit: 1000 }),
  });
  const { data: logs } = useQuery({
    queryKey: ["sync-logs", id],
    queryFn: () => api.getSyncLogs(id),
  });

  if (!tenant) return <div className="p-8 text-gray-500">Loading…</div>;

  const now = new Date();
  const expired = devices?.filter((d) => d.auto_update_expiration && new Date(d.auto_update_expiration) < now) ?? [];
  const expiring12 = devices?.filter((d) => {
    if (!d.auto_update_expiration) return false;
    const diff = (new Date(d.auto_update_expiration) - now) / 86400000;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active devices" value={devices?.length ?? "…"} accent="indigo" />
        <StatCard label="Expired" value={expired.length} accent="red" />
        <StatCard label="Expiring ≤12mo" value={expiring12.length} accent="amber" />
        <StatCard label="Est. 12mo pipeline" value={fmt(expiring12.length * Number(tenant.device_replacement_cost))} accent="green" />
      </div>

      {/* Device table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Active devices ({devices?.length ?? "…"})</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading devices…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Serial", "Model", "EOL date", "User", "Location", "OS version", "Org unit"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices?.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{d.serial_number ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-800">{d.model ?? "—"}</td>
                    <td className="px-4 py-2">
                      <EolBadge date={d.auto_update_expiration} />
                    </td>
                    <td className="px-4 py-2 text-gray-500 truncate max-w-[140px]">{d.annotated_user ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{d.annotated_location ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">{d.os_version ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-[160px]">{d.org_unit_path ?? "—"}</td>
                  </tr>
                ))}
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
