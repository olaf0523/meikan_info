import Icon from "@/components/Icon";
import Ornament from "@/components/Ornament";

type Stat = { label: string; value: number };

export default function Hero({ stats }: { stats: Stat[] }) {
  return (
    <header className="relative isolate overflow-hidden">
      {/* 右上の陽光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-[radial-gradient(circle,rgba(255,214,140,0.28),transparent_65%)] blur-2xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-6 sm:px-6">
        <nav className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="gold-fill grid size-10 place-items-center rounded-xl font-serif text-lg font-extrabold">名</span>
            <span className="font-serif text-base font-bold tracking-wider text-gold-light sm:text-lg">
              フリーランス名鑑 <span className="font-medium text-ink/70">データベース</span>
            </span>
          </div>
          <a
            href="https://freelance-meikan.com/freelance"
            target="_blank"
            rel="noopener noreferrer"
            className="gold-outline hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-ink/85 backdrop-blur transition hover:border-gold hover:text-gold-light sm:inline-flex"
          >
            freelance-meikan.com
            <Icon name="external" className="size-3.5" />
          </a>
        </nav>

        <p className="gold-outline mt-12 inline-flex animate-rise items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium text-ink/90 backdrop-blur sm:mt-16">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          全掲載者の職業・経歴・会社情報を AI で分析済み
        </p>
        <h1 className="mt-6 animate-rise font-serif text-[1.8rem] font-extrabold leading-[1.2] tracking-wide text-[#f8eed6] [animation-delay:60ms] [text-shadow:0_4px_30px_rgba(0,0,0,0.6)] min-[400px]:text-3xl sm:text-6xl">
          最適なフリーランスを、
          <br />
          <span className="gold-text [text-shadow:none]">一瞬で見つける。</span>
        </h1>
        <Ornament className="mt-6 max-w-md animate-rise [animation-delay:100ms]" />
        <p className="mt-5 max-w-2xl animate-rise font-serif text-sm leading-relaxed text-[#eadcbc] [animation-delay:140ms] [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-lg">
          キーワード検索と複数条件の絞り込みを自由に組み合わせて、職業・スキル・経歴・代表を務める会社まで横断的に探せます。
        </p>

        <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              style={{ animationDelay: `${180 + i * 70}ms` }}
              className="glass animate-rise rounded-2xl px-4 py-3"
            >
              <dt className="text-[11px] font-medium text-muted sm:text-xs">{stat.label}</dt>
              <dd className="mt-1 font-serif text-2xl font-extrabold tabular-nums sm:text-3xl">
                <span className="gold-text">{stat.value.toLocaleString()}</span>
                <span className="ml-1 text-sm font-semibold text-ink/60">人</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
