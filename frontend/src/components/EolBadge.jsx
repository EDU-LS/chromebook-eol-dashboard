import { differenceInDays, formatDistanceToNow } from "date-fns";

export function FlexBadge({ flexStatus }) {
  const decertified = flexStatus === "Decertified";
  const minor = flexStatus === "Minor issues expected";
  const style = decertified
    ? "bg-red-100 text-red-700"
    : minor
    ? "bg-amber-100 text-amber-700"
    : "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      🔵 Flex
    </span>
  );
}

export default function EolBadge({ date, isFlex, flexEolYear, flexStatus }) {
  // For Flex devices, show the Flex EOL year instead of the Google Admin AUE date
  // (they may differ — the Flex certified list is authoritative for Flex hardware)
  if (isFlex && flexEolYear) {
    const now = new Date();
    const eolDate = new Date(flexEolYear, 11, 31); // Dec 31 of EOL year
    const days = differenceInDays(eolDate, now);
    const decertified = flexStatus === "Decertified";
    const label = decertified ? `Decertified (${flexEolYear})` : `Flex EOL: ${flexEolYear}`;
    const style = decertified || days < 0
      ? "bg-red-100 text-red-700"
      : days <= 180
      ? "bg-orange-100 text-orange-700"
      : days <= 365
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
        🔵 {label}
      </span>
    );
  }

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
