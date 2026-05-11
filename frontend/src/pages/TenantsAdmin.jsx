import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function TenantTypeBadge({ tenant }) {
  const hasChromebooks = !!tenant.admin_email;
  const hasIpads = (tenant.ios_device_count ?? 0) > 0;
  if (hasChromebooks && hasIpads) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 text-xs px-2 py-0.5 font-medium">💻 + 📱 Both</span>;
  }
  if (hasChromebooks) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-xs px-2 py-0.5 font-medium">💻 Chromebooks</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5 font-medium">📱 iPad only</span>;
}

const CSV_TEMPLATE = [
  ["Name", "Domain", "Admin Email", "Customer ID", "Replacement Cost", "Notes"],
  ["Example School (Chromebooks)", "example.org.uk", "admin@example.org.uk", "my_customer", "299.00", ""],
  ["iPad Only School", "ipadschool.org.uk", "", "", "299.00", "iPad only"],
].map((r) => r.join(",")).join("\n");

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY = {
  name: "", domain: "", admin_email: "",
  customer_id: "my_customer", device_replacement_cost: "299.00", notes: "",
};

export default function TenantsAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const { data: tenants } = useQuery({
    queryKey: ["tenants-all"],
    queryFn: () => api.getTenants(),
  });

  const importCsv = useMutation({
    mutationFn: (file) => api.importTenantsCsv(file),
    onSuccess: (data) => {
      qc.invalidateQueries();
      setImportResult(data);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => setImportResult({ error: e.message }),
  });

  const save = useMutation({
    mutationFn: (body) =>
      editId ? api.updateTenant(editId, body) : api.createTenant(body),
    onSuccess: () => {
      qc.invalidateQueries();
      setForm(EMPTY);
      setEditId(null);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: api.deleteTenant,
    onSuccess: () => qc.invalidateQueries(),
  });

  function startEdit(t) {
    setEditId(t.id);
    setForm({
      name: t.name, domain: t.domain, admin_email: t.admin_email,
      customer_id: t.customer_id,
      device_replacement_cost: String(t.device_replacement_cost),
      notes: t.notes ?? "",
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    save.mutate({
      ...form,
      admin_email: form.admin_email.trim() || null,
      customer_id: form.customer_id.trim() || null,
      device_replacement_cost: parseFloat(form.device_replacement_cost),
    });
  }

  const field = "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
        <button
          onClick={() => { setImportOpen((o) => !o); setImportResult(null); }}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
        >
          📥 {importOpen ? "Close import" : "Import CSV"}
        </button>
      </div>

      {/* CSV Import panel */}
      {importOpen && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Bulk import from CSV</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Required: <span className="font-mono">Name, Domain</span> — optional: Admin Email, Customer ID, Replacement Cost, Notes.
                Leave Admin Email blank for iPad-only schools.
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="text-xs text-brand-600 hover:underline"
            >
              ⬇ Download template
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setImportResult(null); importCsv.mutate(f); }
              }}
              className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 cursor-pointer"
            />
            {importCsv.isPending && <span className="text-sm text-gray-400">Importing…</span>}
          </div>

          {importResult && !importResult.error && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 font-semibold">✅ {importResult.added} added</span>
                <span className="text-amber-600 font-semibold">⏭ {importResult.skipped} skipped (already exist)</span>
                {importResult.errors.length > 0 && (
                  <span className="text-red-600 font-semibold">❌ {importResult.errors.length} errors</span>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <ul className="text-xs text-red-600 space-y-0.5 mt-1">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>Row {e.row} ({e.domain}): {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importResult?.error && (
            <p className="text-sm text-red-600">{importResult.error}</p>
          )}
        </div>
      )}

      {/* Add / Edit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          {editId ? "Edit customer" : "Add customer"}
        </h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Customer name *</label>
            <input required className={field} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={label}>Domain *</label>
            <input required className={field} placeholder="school.org.uk" value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          </div>
          <div>
            <label className={label}>
              Admin email for Google DWD
              <span className="ml-1 text-gray-400 font-normal">(leave blank for iPad-only)</span>
            </label>
            <input type="email" className={field} placeholder="admin@school.org.uk" value={form.admin_email}
              onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          </div>
          <div>
            <label className={label}>
              Google customer ID
              <span className="ml-1 text-gray-400 font-normal">(leave blank for iPad-only)</span>
            </label>
            <input className={field} placeholder="my_customer" value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })} />
          </div>
          <div>
            <label className={label}>Replacement cost per device (£)</label>
            <input type="number" step="0.01" className={field} value={form.device_replacement_cost}
              onChange={(e) => setForm({ ...form, device_replacement_cost: e.target.value })} />
          </div>
          <div>
            <label className={label}>Notes</label>
            <input className={field} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={save.isPending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {save.isPending ? "Saving…" : editId ? "Update" : "Add customer"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm(EMPTY); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Domain", "Type", "Admin email", "Cost/device", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tenants?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.domain}</td>
                <td className="px-4 py-3">
                  <TenantTypeBadge tenant={t} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{t.admin_email ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">£{t.device_replacement_cost}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(t)}
                      className="text-xs text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => {
                      if (confirm(`Remove ${t.name}?`)) remove.mutate(t.id);
                    }} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
