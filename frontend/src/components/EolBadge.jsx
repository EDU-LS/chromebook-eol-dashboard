import { differenceInDays, formatDistanceToNow } from "date-fns";

export default function EolBadge({ date }) {
  if (!date) return <span className="text-gray-400 text-xs">Unknown</span>;

  const d = new Date(date);
  const days = differenceInDays(d, new Date());
  const label = formatDistanceToNow(d, { addSuffix: true });

  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Expired {label}
      </span>
    );
  if (days <= 180)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        {label}
      </span>
    );
  if (days <= 365)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      {label}
    </span>
  );
}
