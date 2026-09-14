import { STATUS_STYLE } from "@/lib/freelancer";

export default function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const style = STATUS_STYLE[status] ?? "bg-accent-soft text-accent ring-accent/20";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}
