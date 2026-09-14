import type { MatchMode } from "@/lib/search";

type Props = {
  value: MatchMode;
  onChange: (mode: MatchMode) => void;
  labels: Record<MatchMode, string>;
  ariaLabel: string;
  size?: "sm" | "lg";
};

export default function ModeToggle({ value, onChange, labels, ariaLabel, size = "sm" }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`gold-outline inline-flex shrink-0 rounded-xl p-1 ${size === "lg" ? "h-14" : ""}`}
    >
      {(["and", "or"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={`flex-1 whitespace-nowrap rounded-lg font-semibold transition ${
            size === "lg" ? "px-4 text-sm" : "px-2.5 py-1 text-[11px]"
          } ${value === mode ? "gold-fill" : "text-muted hover:text-gold-light"}`}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  );
}
