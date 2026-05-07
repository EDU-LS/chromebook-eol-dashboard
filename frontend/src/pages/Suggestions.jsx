import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { getCurrentUser } from "../auth";

const CATEGORIES = ["Feature request", "Bug report", "Integration", "Reporting", "UX / Design", "Other"];

const EMPTY = { title: "", category: "Feature request", description: "", submitted_by: "" };

const STATUS_CONFIG = {
  pending:          { label: "Pending",          style: "bg-gray-100 text-gray-600" },
  to_be_discussed:  { label: "To be Discussed",  style: "bg-amber-100 text-amber-700" },
  complete:         { label: "Complete",          style: "bg-green-100 text-green-700" },
};

const STATUS_BUTTONS = [
  { value: "pending",         label: "Pending",          active: "bg-gray-500 text-white",   idle: "border border-gray-300 text-gray-600 hover:bg-gray-50" },
  { value: "to_be_discussed", label: "To be Discussed",  active: "bg-amber-500 text-white",  idle: "border border-amber-300 text-amber-700 hover:bg-amber-50" },
  { value: "complete",        label: "Complete",         active: "bg-green-600 text-white",  idle: "border border-green-300 text-green-700 hover:bg-green-50" },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function CommentThread({ suggestion }) {
  const qc = useQueryClient();
  const me = getCurrentUser();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const addComment = useMutation({
    mutationFn: (body) => api.addComment(suggestion.id, body),
    onSuccess: () => {
      qc.invalidateQueries(["suggestions"]);
      setText("");
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status) => api.updateSuggestionStatus(suggestion.id, status),
    onSuccess: () => qc.invalidateQueries(["suggestions"]),
  });

  const cfg = STATUS_CONFIG[suggestion.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Suggestion header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(suggestion.submitted_by || "?")[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{suggestion.submitted_by || "Anonymous"}</span>
              <span className="text-gray-400 text-xs">·</span>
              <span className="text-gray-400 text-xs">{timeAgo(suggestion.created_at)}</span>
              <span className="rounded-full bg-gray-100 text-gray-500 text-xs px-2 py-0.5">{suggestion.category}</span>
              <span className={`rounded-full text-xs px-2 py-0.5 font-medium ${cfg.style}`}>
                {cfg.label}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mt-1">{suggestion.title}</h3>
            {suggestion.description && (
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{suggestion.description}</p>
            )}
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3 ml-12">
          {STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => updateStatus.mutate(btn.value)}
              disabled={updateStatus.isPending}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                suggestion.status === btn.value ? btn.active : btn.idle
              }`}
            >
              {btn.label}
            </button>
          ))}
          <button
            onClick={() => setOpen((o) => !o)}
            className="ml-auto text-xs text-brand-600 hover:underline"
          >
            💬 {suggestion.comments.length} {suggestion.comments.length === 1 ? "reply" : "replies"}
            {open ? " ▲" : " ▼"}
          </button>
        </div>
      </div>

      {/* Comments thread */}
      {open && (
        <div className="border-t border-gray-100">
          {suggestion.comments.length > 0 && (
            <div className="divide-y divide-gray-50">
              {suggestion.comments.map((c) => (
                <div key={c.id} className="px-4 py-3 flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
                    {c.author[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">{c.author}</span>
                      <span className="text-gray-400 text-xs">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                {(me || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  rows={2}
                  placeholder="Write a reply…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
                      addComment.mutate({ content: text.trim(), author: me || "Anonymous" });
                    }
                  }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-400">Ctrl + Enter to send</span>
                  <button
                    onClick={() => {
                      if (text.trim()) addComment.mutate({ content: text.trim(), author: me || "Anonymous" });
                    }}
                    disabled={!text.trim() || addComment.isPending}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
                  >
                    {addComment.isPending ? "Posting…" : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Suggestions() {
  const qc = useQueryClient();
  const me = getCurrentUser();
  const [form, setForm] = useState({ ...EMPTY, submitted_by: me || "" });
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.getSuggestions,
  });

  const create = useMutation({
    mutationFn: api.createSuggestion,
    onSuccess: () => {
      qc.invalidateQueries(["suggestions"]);
      setForm({ ...EMPTY, submitted_by: me || "" });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    create.mutate(form);
  }

  const filtered = suggestions?.filter((s) => filter === "all" || s.status === filter) ?? [];

  const field = "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">💡 Ideas &amp; Suggestions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Post ideas, reply to threads, and track what's in progress.
        </p>
      </div>

      {/* Submit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Post a new idea</h2>

        {submitted && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            ✓ Idea posted — the team will review it.
          </div>
        )}
        {create.isError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {create.error?.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Title *</label>
              <input
                required maxLength={200}
                className={field}
                placeholder="Short summary of your idea"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Your name</label>
              <input
                className={field}
                placeholder="e.g. LSpencer"
                value={form.submitted_by}
                onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <textarea
                rows={3}
                className={field}
                placeholder="More context or examples…"
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
            {create.isPending ? "Posting…" : "Post idea"}
          </button>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all",              label: `All (${suggestions?.length ?? 0})` },
          { value: "pending",          label: `Pending (${suggestions?.filter((s) => s.status === "pending").length ?? 0})` },
          { value: "to_be_discussed",  label: `To be Discussed (${suggestions?.filter((s) => s.status === "to_be_discussed").length ?? 0})` },
          { value: "complete",         label: `Complete (${suggestions?.filter((s) => s.status === "complete").length ?? 0})` },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === tab.value
                ? "bg-brand-500 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:border-brand-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="space-y-3">
        {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-gray-400 text-sm">No ideas here yet.</p>
        )}
        {filtered.map((s) => (
          <CommentThread key={s.id} suggestion={s} />
        ))}
      </div>
    </div>
  );
}
