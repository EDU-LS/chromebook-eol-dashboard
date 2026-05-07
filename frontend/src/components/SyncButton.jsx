import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export default function SyncButton({ tenantId, label = "Sync now" }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const qc = useQueryClient();

  async function handleSync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = tenantId ? await api.syncTenant(tenantId) : await api.syncAll();
      setMsg(res.message);
      setTimeout(() => {
        qc.invalidateQueries();
        setMsg(null);
      }, 3000);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <span>↻</span>
        )}
        {label}
      </button>
      {msg && <span className="text-sm text-gray-500">{msg}</span>}
    </div>
  );
}
