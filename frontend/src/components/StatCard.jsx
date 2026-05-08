export default function StatCard({ label, value, sub, accent = "brand", onClick, active = false }) {
  const colors = {
    brand:  "bg-brand-50 text-brand-700 border-brand-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    green:  "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const activeRing = {
    brand:  "ring-2 ring-brand-500",
    red:    "ring-2 ring-red-500",
    amber:  "ring-2 ring-amber-500",
    green:  "ring-2 ring-green-500",
    purple: "ring-2 ring-purple-500",
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 text-center w-40 shrink-0 grow
        ${colors[accent] ?? colors.brand}
        ${active ? (activeRing[accent] ?? activeRing.brand) : ""}
        ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity select-none" : ""}
      `}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      {onClick && (
        <p className="text-xs mt-1 opacity-50">{active ? "✕ clear filter" : "click to filter"}</p>
      )}
    </div>
  );
}
