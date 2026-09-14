import { STATUS_META } from "@/lib/freelancer";

type Props = { status: string; compact?: boolean; size?: "sm" | "md" };

export default function StatusBadge({ status, compact = false, size = "sm" }: Props) {
  if (!status) return null;
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "gap-2 px-3.5 py-1.5 text-sm" : "gap-1.5 px-2.5 py-0.5 text-xs"
      } ${meta?.badge ?? "bg-gold/10 text-gold-light ring-gold/40"}`}
    >
      <span className={`rounded-full ${size === "md" ? "size-2" : "size-1.5"} ${meta?.dot ?? "bg-gold"}`} />
      {meta ? (compact ? meta.short : meta.label) : status}
    </span>
  );
}
