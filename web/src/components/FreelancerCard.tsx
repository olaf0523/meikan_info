import Avatar from "@/components/Avatar";
import Highlight from "@/components/Highlight";
import Icon from "@/components/Icon";
import Ornament from "@/components/Ornament";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_META, type FreelancerSummary } from "@/lib/freelancer";

type Props = {
  freelancer: FreelancerSummary;
  terms: string[];
  selectedSkills: string[];
  view: "grid" | "list";
  /** 表示アニメーションの遅延用 */
  index: number;
  onSelect: (id: string) => void;
};

function StatusAvatar({ freelancer, size }: { freelancer: FreelancerSummary; size: number }) {
  return (
    <div className="relative shrink-0">
      <Avatar src={freelancer.avatar} name={freelancer.name} size={size} className="gold-ring" />
      <span
        aria-hidden
        className={`absolute bottom-0 right-0 rounded-full border-2 border-[#e6fff3] ${size > 56 ? "size-4" : "size-3.5"} ${
          STATUS_META[freelancer.status]?.dot ?? "bg-muted"
        }`}
      />
    </div>
  );
}

export default function FreelancerCard({ freelancer: f, terms, selectedSkills, view, index, onSelect }: Props) {
  const style = { animationDelay: `${Math.min(index, 20) * 25}ms` };
  const subtitle = f.occupation || f.jobTypes.join(" / ") || "職種未登録";
  const skills = [...f.skills.filter((s) => selectedSkills.includes(s)), ...f.skills.filter((s) => !selectedSkills.includes(s))];

  if (view === "list") {
    return (
      <button
        type="button"
        onClick={() => onSelect(f.id)}
        style={style}
        className="glass group flex w-full animate-rise items-center gap-4 rounded-2xl px-4 py-3 text-left transition duration-300 hover:border-gold/90 focus-visible:outline-2 focus-visible:outline-gold"
      >
        <StatusAvatar freelancer={f} size={48} />
        <div className="min-w-0 flex-1">
          <p className="gold-text truncate font-serif text-lg font-bold leading-tight">
            <Highlight text={f.name} terms={terms} />
          </p>
          <p className="truncate font-serif text-xs text-[#e6d3a3]">
            <Highlight text={subtitle} terms={terms} />
          </p>
        </div>
        <p className="hidden w-52 min-w-0 items-center gap-1.5 text-xs md:flex">
          {f.companies[0] ? (
            <>
              <Icon name="building" className="size-3.5 shrink-0 text-gold" />
              <span className="truncate">
                <Highlight text={f.companies.join(" / ")} terms={terms} />
              </span>
            </>
          ) : (
            <span className="text-muted/60">—</span>
          )}
        </p>
        <p className="hidden w-24 text-xs text-muted lg:block">{f.prefecture || "—"}</p>
        <p className="hidden w-32 text-right font-serif text-sm tabular-nums text-[#efe1bf] sm:block">
          {f.rate || "時給未登録"}
        </p>
        <StatusBadge status={f.status} compact />
        <Icon name="chevronRight" className="size-4 shrink-0 text-gold/70 transition group-hover:translate-x-0.5 group-hover:text-gold-light" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(f.id)}
      style={style}
      className="group block h-full w-full animate-rise rounded-[22px] text-left focus-visible:outline-none"
    >
      <div className="relative h-full transition duration-500 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5">
        {/* ホバー時の金の光 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[30px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(232,190,108,0.4),transparent_72%)] opacity-0 blur-xl transition duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <div className="glass relative flex h-full flex-col overflow-hidden rounded-[22px] p-5 transition duration-500 group-hover:border-gold/90 group-focus-visible:border-gold">
          {/* 内側の細い金線と上部の艶 */}
          <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[17px] border border-gold/15" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-gold-light/[0.07] to-transparent" />

          <div className="relative flex items-center gap-4">
            <StatusAvatar freelancer={f} size={64} />
            <div className="min-w-0 flex-1">
              <p className="gold-text truncate font-serif text-[22px] font-bold leading-tight tracking-wide">
                <Highlight text={f.name} terms={terms} />
              </p>
              <p className="mt-1.5 line-clamp-2 font-serif text-[13px] leading-snug text-[#e8d5a6]">
                <Highlight text={subtitle} terms={terms} />
              </p>
            </div>
          </div>

          {f.companies[0] && (
            <p className="gold-outline relative mt-4 flex min-w-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] text-ink">
              <Icon name="building" className="size-4 shrink-0 text-gold" />
              <span className="truncate">
                <Highlight text={f.companies.join(" / ")} terms={terms} />
              </span>
              {f.hasCompanyUrl && <Icon name="link" className="ml-auto size-4 shrink-0 text-gold" />}
            </p>
          )}

          {f.catchphrase && (
            <p className="relative mt-4 line-clamp-2 font-serif text-[15px] font-medium leading-relaxed tracking-wide text-[#f4e8cb]">
              <Highlight text={f.catchphrase} terms={terms} />
            </p>
          )}

          <Ornament className="relative mt-4" />

          {skills.length > 0 && (
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              {skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedSkills.includes(skill) ? "gold-fill font-semibold" : "gold-outline text-ink"
                  }`}
                >
                  {skill}
                </span>
              ))}
              {skills.length > 3 && <span className="font-serif text-sm text-[#efe1bf]">+{skills.length - 3}</span>}
            </div>
          )}

          <div className="flex-1" />
          <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-gold/20 pt-4">
            <StatusBadge status={f.status} compact size="md" />
            <span className="flex items-center gap-1.5 font-serif text-sm tabular-nums text-[#efe1bf]">
              <Icon name="wallet" className="size-4 text-gold" />
              {f.rate || "未登録"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
