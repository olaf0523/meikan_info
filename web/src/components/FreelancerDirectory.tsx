"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import FreelancerModal from "@/components/FreelancerModal";
import StatusBadge from "@/components/StatusBadge";
import { EXPERTISE_LEVELS, STATUS_ORDER, type FreelancerSummary } from "@/lib/freelancer";

const PAGE_SIZE = 60;

type SortKey = "default" | "name";
const SORT_LABELS: Record<SortKey, string> = {
  default: "掲載順",
  name: "名前順",
};

type Filters = {
  query: string;
  status: string;
  job: string;
  expertise: string;
  company: "" | "any" | "url";
  contact: "" | "email" | "phone";
  sort: SortKey;
};

const INITIAL_FILTERS: Filters = {
  query: "",
  status: "",
  job: "",
  expertise: "",
  company: "",
  contact: "",
  sort: "default",
};

const controlClass =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function countBy(list: FreelancerSummary[], key: (f: FreelancerSummary) => string) {
  const counts = new Map<string, number>();
  for (const f of list) counts.set(key(f), (counts.get(key(f)) ?? 0) + 1);
  return counts;
}

export default function FreelancerDirectory({ freelancers }: { freelancers: FreelancerSummary[] }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(filters.query);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setVisible(PAGE_SIZE);
  };

  const statusCounts = useMemo(() => countBy(freelancers, (f) => f.status), [freelancers]);
  const expertiseCounts = useMemo(() => countBy(freelancers, (f) => f.expertise), [freelancers]);
  const jobCategories = useMemo(
    () => [...countBy(freelancers, (f) => f.jobCategory)].sort((a, b) => b[1] - a[1]),
    [freelancers],
  );
  const companyCount = useMemo(() => freelancers.filter((f) => f.company).length, [freelancers]);
  const companyUrlCount = useMemo(() => freelancers.filter((f) => f.hasCompanyUrl).length, [freelancers]);

  const filtered = useMemo(() => {
    const terms = deferredQuery.toLowerCase().split(/[\s　]+/).filter(Boolean);
    const list = freelancers.filter(
      (f) =>
        (!filters.status || f.status === filters.status) &&
        (!filters.job || f.jobCategory === filters.job) &&
        (!filters.expertise || f.expertise === filters.expertise) &&
        (filters.company !== "any" || Boolean(f.company)) &&
        (filters.company !== "url" || f.hasCompanyUrl) &&
        (filters.contact !== "email" || f.hasEmail) &&
        (filters.contact !== "phone" || f.hasPhone) &&
        terms.every((t) => f.searchText.includes(t)),
    );
    if (filters.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return list;
  }, [freelancers, filters, deferredQuery]);

  const selectedIndex = selectedId ? filtered.findIndex((f) => f.id === selectedId) : -1;
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <header className="pb-6 pt-10">
        <p className="text-sm font-medium text-accent">freelance-meikan.com</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">フリーランス名鑑 データベース</h1>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <div className="flex gap-1.5">
            <dt>掲載人数</dt>
            <dd className="font-semibold text-ink">{freelancers.length.toLocaleString()}人</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>現在対応可能</dt>
            <dd className="font-semibold text-ink">{(statusCounts.get(STATUS_ORDER[0]) ?? 0).toLocaleString()}人</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>会社の代表・役員</dt>
            <dd className="font-semibold text-ink">{companyCount.toLocaleString()}人</dd>
          </div>
        </dl>
      </header>

      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
            placeholder="氏名・職業・経歴・会社名・スキルで検索"
            aria-label="キーワード検索"
            className={`${controlClass} w-full min-w-0 sm:w-80`}
          />
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            aria-label="対応状況"
            className={controlClass}
          >
            <option value="">対応状況：すべて</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}（{statusCounts.get(s) ?? 0}）
              </option>
            ))}
          </select>
          <select
            value={filters.job}
            onChange={(e) => update("job", e.target.value)}
            aria-label="職種"
            className={controlClass}
          >
            <option value="">職種：すべて</option>
            {jobCategories.map(([job, count]) => (
              <option key={job} value={job}>
                {job}（{count}）
              </option>
            ))}
          </select>
          <select
            value={filters.expertise}
            onChange={(e) => update("expertise", e.target.value)}
            aria-label="専門性レベル"
            className={controlClass}
          >
            <option value="">専門性：すべて</option>
            {EXPERTISE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}（{expertiseCounts.get(level) ?? 0}）
              </option>
            ))}
          </select>
          <select
            value={filters.company}
            onChange={(e) => update("company", e.target.value as Filters["company"])}
            aria-label="会社"
            className={controlClass}
          >
            <option value="">会社：すべて</option>
            <option value="any">代表・役員の会社あり（{companyCount}）</option>
            <option value="url">会社リンクあり（{companyUrlCount}）</option>
          </select>
          <select
            value={filters.contact}
            onChange={(e) => update("contact", e.target.value as Filters["contact"])}
            aria-label="連絡先"
            className={controlClass}
          >
            <option value="">連絡先：すべて</option>
            <option value="email">メールあり</option>
            <option value="phone">電話番号あり</option>
          </select>
          <select
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value as SortKey)}
            aria-label="並び順"
            className={controlClass}
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted">
          <span>
            <span className="font-semibold text-ink">{filtered.length.toLocaleString()}</span>人が該当
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setFilters(INITIAL_FILTERS);
                setVisible(PAGE_SIZE);
              }}
              className="text-accent hover:underline"
            >
              条件をリセット
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-24 text-center text-muted">条件に一致するフリーランスが見つかりませんでした。</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.slice(0, visible).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setSelectedId(f.id)}
                className="group flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={f.avatar} name={f.name} size={56} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold group-hover:text-accent">{f.name}</p>
                    <p className="line-clamp-2 text-xs text-muted">{f.occupation || f.jobTypes || "職種未登録"}</p>
                  </div>
                </div>
                {f.catchphrase && <p className="mt-3 line-clamp-2 text-sm leading-relaxed">{f.catchphrase}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <StatusBadge status={f.status} />
                  {f.expertise && f.expertise !== "判定不能" && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{f.expertise}</span>
                  )}
                  {f.company && (
                    <span className="truncate text-xs text-muted" title={f.company}>
                      🏢 {f.company.split("; ")[0]}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {visible < filtered.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            さらに表示（残り {(filtered.length - visible).toLocaleString()}人）
          </button>
        </div>
      )}

      {selectedIndex >= 0 && (
        <FreelancerModal
          freelancer={filtered[selectedIndex]}
          position={`${selectedIndex + 1} / ${filtered.length}`}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedId(filtered[selectedIndex - 1].id) : undefined}
          onNext={
            selectedIndex < filtered.length - 1 ? () => setSelectedId(filtered[selectedIndex + 1].id) : undefined
          }
        />
      )}
    </div>
  );
}
