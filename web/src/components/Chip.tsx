import type { ReactNode } from "react";

type Props = {
  active: boolean;
  onClick: () => void;
  count?: number;
  dot?: string;
  children: ReactNode;
};

export default function Chip({ active, onClick, count, dot, children }: Props) {
  const dim = !active && count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
        active
          ? "gold-fill"
          : "border-gold/30 bg-[#070b18]/60 text-ink/85 hover:border-gold/70 hover:text-gold-light"
      } ${dim ? "opacity-40" : ""}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
      {children}
      {count !== undefined && (
        <span className={`tabular-nums ${active ? "text-[#3b2c0f]/75" : "text-muted"}`}>{count}</span>
      )}
    </button>
  );
}
