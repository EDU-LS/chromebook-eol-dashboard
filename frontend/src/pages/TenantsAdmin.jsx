import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

const EMPTY = {
  name: "", domain: "", admin_email: "",
  customer_id: "my_customer", device_replacement_cost: "299.00", notes: "",
};

export default function TenantsAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);

  const { data: tenants } = useQuery({
    queryKey: ["tenants-all"],
    queryFn: () => api.getTenants(),
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
      device_replacement_cost: parseFloat(form.device_replacement_cost),
    });
  }

  const field = "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>

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
            <label className={label}>Google Workspace domain *</label>
            <input required className={field} placeholder="school.org.uk" value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          </div>
          <div>
            <label className={label}>Admin email for DWD *</label>
            <input required type="email" className={field} placeholder="admin@school.org.uk" value={form.admin_email}
              onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          </div>
          <div>
            <label className={label}>Google customer ID</label>
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
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
              {["Name", "Domain", "Admin email", "Cost/device", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tenants?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.domain}</td>
                <td className="px-4 py-3 text-gray-500">{t.admin_email}</td>
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
                      className="text-xs text-indigo-600 hover:underline">Edit</button>
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
