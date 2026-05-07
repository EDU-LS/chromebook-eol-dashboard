import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

const CATEGORIES = ["Feature request", "Bug report", "Integration", "Reporting", "UX / Design", "Other"];

const EMPTY = { title: "", category: "Feature request", description: "", submitted_by: "" };

const STATUS_STYLES = {
  new:         "bg-brand-100 text-brand-700",
  reviewing:   "bg-amber-100 text-amber-700",
  planned:     "bg-purple-100 text-purple-700",
  done:        "bg-green-100 text-green-700",
  declined:    "bg-gray-100 text-gray-500",
};

export default function Suggestions() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.getSuggestions,
  });

  const create = useMutation({
    mutationFn: api.createSuggestion,
    onSuccess: () => {
      qc.invalidateQueries(["suggestions"]);
      setForm(EMPTY);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    create.mutate(form);
  }

  const field = "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">💡 Ideas &amp; Suggestions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Got an idea to improve this tool? Drop it here — the team will review it.
        </p>
      </div>

      {/* Submit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Submit an idea</h2>

        {submitted && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            ✓ Idea submitted — thanks! The team will take a look.
          </div>
        )}

        {create.isError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {create.error?.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={label}>Title *</label>
              <input
                required
                maxLength={200}
                className={field}
                placeholder="Short summary of your idea"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Category</label>
              <select
                className={field}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Your name (optional)</label>
              <input
                className={field}
                placeholder="e.g. Lewis"
                value={form.submitted_by}
                onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className={label}>Description</label>
              <textarea
                rows={4}
                className={field}
                placeholder="More detail, context, or examples…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {create.isPending ? "Submitting…" : "Submit idea"}
          </button>
        </form>
      </div>

      {/* Ideas list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">All ideas ({suggestions?.length ?? 0})</h2>

        {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

        {suggestions?.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{s.title}</h3>
                  <span className="rounded-full bg-gray-100 text-gray-500 text-xs px-2 py-0.5">{s.category}</span>
                  <span className={`rounded-full text-xs px-2 py-0.5 font-medium ${STATUS_STYLES[s.status] ?? STATUS_STYLES.new}`}>
                    {s.status}
                  </span>
                </div>
                {s.description && (
                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{s.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {s.submitted_by ? `${s.submitted_by} · ` : ""}
                  {new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && suggestions?.length === 0 && (
          <p className="text-gray-400 text-sm">No ideas yet — be the first!</p>
        )}
      </div>
    </div>
  );
}
