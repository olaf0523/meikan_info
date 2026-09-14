"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Drawer from "@/components/Drawer";
import FacetPanel from "@/components/FacetPanel";
import FreelancerCard from "@/components/FreelancerCard";
import FreelancerModal from "@/components/FreelancerModal";
import Hero from "@/components/Hero";
import Icon from "@/components/Icon";
import SearchConsole from "@/components/SearchConsole";
import ShareButton from "@/components/ShareButton";
import { useUrlState } from "@/hooks/useUrlState";
import { STATUS_ORDER, type FreelancerSummary } from "@/lib/freelancer";
import {
  FACET_LABELS,
  INITIAL_STATE,
  SCOPES,
  SORT_OPTIONS,
  activeFilters,
  buildFacetOptions,
  buildHaystack,
  countFacets,
  matchesFacets,
  matchesQuery,
  parseQuery,
  sortFreelancers,
  type FacetKey,
  type ListKey,
  type Scope,
  type SearchState,
  type SortKey,
} from "@/lib/search";
import { toSearchString, type View } from "@/lib/url-state";

const PAGE_SIZE = 48;
/** モーダルを一覧から開いたときに積んだ履歴エントリの目印 (閉じるときは戻るで取り除く) */
const MODAL_HISTORY_KEY = "meikanModal";

const outlineButton =
  "gold-outline rounded-xl text-sm font-medium text-ink transition hover:border-gold hover:text-gold-light";

export default function FreelancerDirectory({ freelancers }: { freelancers: FreelancerSummary[] }) {
  // 検索条件・表示形式・開いているフリーランスは URL が唯一の状態
  const [{ search: state, view, id: selectedId }, navigate] = useUrlState();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fulltext, setFulltext] = useState<Record<string, string> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 経歴・実績などの長文はページ表示後に読み込む (初期 HTML を軽くするため)
  useEffect(() => {
    let cancelled = false;
    fetch("/data/fulltext.json")
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, string>>) : null))
      .then((data) => {
        if (!cancelled && data) setFulltext(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------- 画面遷移

  /** 検索条件を変更する。条件の変更は履歴に積み、入力中のキーワード変更は置き換える */
  const patch = useCallback(
    (changes: Partial<SearchState>) => {
      const typing = Object.keys(changes).length === 1 && Boolean(changes.query) && Boolean(state.query);
      navigate({ search: { ...state, ...changes }, view, id: null }, { replace: typing });
    },
    [navigate, state, view],
  );

  const toggle = useCallback(
    (key: ListKey, value: string) => {
      const current = state[key];
      patch({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
    },
    [patch, state],
  );

  const removeFilter = (key: FacetKey, value: string) => (key === "company" ? patch({ company: "" }) : toggle(key, value));

  const clearAll = useCallback(
    () => navigate({ search: { ...INITIAL_STATE, sort: state.sort }, view, id: null }),
    [navigate, state.sort, view],
  );

  const setView = (next: View) => navigate({ search: state, view: next, id: null }, { replace: true });

  const openFreelancer = useCallback(
    (id: string) => navigate({ search: state, view, id }, { historyState: { [MODAL_HISTORY_KEY]: true } }),
    [navigate, state, view],
  );

  // モーダル内の前へ/次へは履歴を積まない (戻るで一覧に戻れるように)
  const moveToFreelancer = useCallback(
    (id: string) =>
      navigate(
        { search: state, view, id },
        { replace: true, historyState: { [MODAL_HISTORY_KEY]: window.history.state?.[MODAL_HISTORY_KEY] === true } },
      ),
    [navigate, state, view],
  );

  const closeFreelancer = useCallback(() => {
    // 一覧から開いた場合は履歴を1つ戻る。共有リンクから直接開いた場合は URL から id だけ外す
    if (window.history.state?.[MODAL_HISTORY_KEY]) window.history.back();
    else navigate({ search: state, view, id: null }, { replace: true });
  }, [navigate, state, view]);

  // ------------------------------------------------------------------ 検索

  const items = useMemo(
    () => freelancers.map((f) => ({ f, haystack: buildHaystack(f, fulltext?.[f.id]) })),
    [freelancers, fulltext],
  );
  const byId = useMemo(() => new Map(freelancers.map((f) => [f.id, f])), [freelancers]);
  const options = useMemo(() => buildFacetOptions(freelancers), [freelancers]);

  const deferredQuery = useDeferredValue(state.query);
  const parsed = useMemo(() => parseQuery(deferredQuery, state.mode), [deferredQuery, state.mode]);
  const hasQuery = parsed.include.length + parsed.exclude.length > 0;

  const scopeCounts = useMemo(() => {
    if (!hasQuery) return null;
    return Object.fromEntries(
      SCOPES.map(({ key }) => [key, items.filter((item) => matchesQuery(item.haystack, parsed, key)).length]),
    ) as Record<Scope, number>;
  }, [items, parsed, hasQuery]);

  const queryMatched = useMemo(
    () => items.filter((item) => matchesQuery(item.haystack, parsed, state.scope)).map((item) => item.f),
    [items, parsed, state.scope],
  );
  const results = useMemo(
    () => sortFreelancers(queryMatched.filter((f) => matchesFacets(f, state)), state.sort),
    [queryMatched, state],
  );
  const counts = useMemo(() => countFacets(queryMatched, state), [queryMatched, state]);
  const active = activeFilters(state);

  const stats = useMemo(
    () => [
      { label: "掲載フリーランス", value: freelancers.length },
      { label: "現在対応可能", value: freelancers.filter((f) => f.status === STATUS_ORDER[0]).length },
      { label: "会社の代表・役員", value: freelancers.filter((f) => f.companies.length).length },
      { label: "会社リンク取得済み", value: freelancers.filter((f) => f.hasCompanyUrl).length },
    ],
    [freelancers],
  );

  // -------------------------------------------------------------- 段階表示

  // 検索条件が変わったら表示件数を最初に戻す (条件ごとに件数を覚える)
  const filterKey = useMemo(() => toSearchString({ search: state, view: "grid", id: null }), [state]);
  const [paging, setPaging] = useState({ key: "", count: PAGE_SIZE });
  const visible = paging.key === filterKey ? paging.count : PAGE_SIZE;
  const canLoadMore = visible < results.length;
  const showMore = useCallback(
    () => setPaging((p) => ({ key: filterKey, count: (p.key === filterKey ? p.count : PAGE_SIZE) + PAGE_SIZE })),
    [filterKey],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) showMore();
      },
      { rootMargin: "800px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, visible, showMore]);

  // ------------------------------------------------------ 選択中のフリーランス

  const selectedIndex = selectedId ? results.findIndex((f) => f.id === selectedId) : -1;
  // 共有リンクの人物が現在の条件に含まれない場合も開けるようにする
  const selected = selectedIndex >= 0 ? results[selectedIndex] : selectedId ? byId.get(selectedId) : undefined;

  const facetPanel = (
    <FacetPanel state={state} options={options} counts={counts} onToggle={toggle} onPatch={patch} />
  );

  return (
    <div className="min-h-dvh">
      <Hero stats={stats} />

      <main className="relative z-10 mx-auto -mt-24 max-w-7xl px-4 pb-20 sm:px-6">
        <SearchConsole
          state={state}
          parsed={parsed}
          scopeCounts={scopeCounts}
          fulltextReady={fulltext !== null}
          onPatch={patch}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="glass sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between border-b border-gold/20 pb-3">
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-gold-light">
                  <Icon name="filter" className="size-4 text-gold" />
                  絞り込み
                </h2>
                {active.length > 0 && (
                  <button type="button" onClick={clearAll} className="text-xs font-medium text-gold hover:text-gold-light hover:underline">
                    すべて解除
                  </button>
                )}
              </div>
              {facetPanel}
            </div>
          </aside>

          <section className="min-w-0" aria-label="検索結果">
            <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-gold/25 bg-[#060913]/85 px-4 py-3 backdrop-blur-xl sm:top-2 sm:mx-0 sm:rounded-2xl sm:border sm:border-gold/45 sm:bg-[#0a0f20]/85 sm:shadow-[0_0_26px_-8px_rgba(226,184,104,0.3)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="flex items-baseline gap-1.5" aria-live="polite">
                  <span className="gold-text font-serif text-3xl font-extrabold tabular-nums">
                    {results.length.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted">/ {freelancers.length.toLocaleString()}人</span>
                </p>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className={`${outlineButton} inline-flex items-center gap-1.5 px-3 py-2 lg:hidden`}
                >
                  <Icon name="filter" className="size-4 text-gold" />
                  絞り込み
                  {active.length > 0 && (
                    <span className="gold-fill grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold">
                      {active.length}
                    </span>
                  )}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <ShareButton label="検索リンクをコピー" className={`${outlineButton} h-9 px-2.5`} />
                  <label htmlFor="sort" className="sr-only">
                    並び順
                  </label>
                  <select
                    id="sort"
                    value={state.sort}
                    onChange={(e) => patch({ sort: e.target.value as SortKey })}
                    className="gold-outline h-9 rounded-xl px-3 text-sm text-ink outline-none transition focus:border-gold"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div role="radiogroup" aria-label="表示形式" className="gold-outline hidden rounded-xl p-0.5 sm:inline-flex">
                    {(["grid", "list"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={view === v}
                        aria-label={v === "grid" ? "カード表示" : "リスト表示"}
                        onClick={() => setView(v)}
                        className={`grid size-8 place-items-center rounded-lg transition ${
                          view === v ? "gold-fill" : "text-muted hover:text-gold-light"
                        }`}
                      >
                        <Icon name={v} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(active.length > 0 || hasQuery) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {active.map(({ key, value, label }) => (
                    <button
                      key={`${key}:${value}`}
                      type="button"
                      onClick={() => removeFilter(key, value)}
                      className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-gold-light transition hover:border-gold hover:bg-gold/20"
                    >
                      <span className="text-gold/70">{FACET_LABELS[key]}:</span>
                      {label}
                      <Icon name="close" className="size-3.5" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted transition hover:text-gold-light"
                  >
                    <Icon name="reset" className="size-3.5" />
                    すべてクリア
                  </button>
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div className="glass flex flex-col items-center rounded-3xl px-6 py-20 text-center">
                <div className="gold-fill grid size-16 place-items-center rounded-full">
                  <Icon name="search" className="size-7" />
                </div>
                <p className="mt-5 font-serif text-xl font-bold text-gold-light">条件に一致するフリーランスが見つかりません</p>
                <p className="mt-2 max-w-md text-sm text-muted">キーワードを減らすか、絞り込み条件を解除してみてください。</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {parsed.mode === "and" && parsed.include.length > 1 && (
                    <button type="button" onClick={() => patch({ mode: "or" })} className={`${outlineButton} px-4 py-2`}>
                      「いずれか含む」で検索
                    </button>
                  )}
                  {state.scope !== "all" && (
                    <button type="button" onClick={() => patch({ scope: "all" })} className={`${outlineButton} px-4 py-2`}>
                      検索対象を「すべて」にする
                    </button>
                  )}
                  <button type="button" onClick={clearAll} className="gold-fill rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-110">
                    条件をすべてクリア
                  </button>
                </div>
              </div>
            ) : (
              <ul className={view === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2.5"}>
                {results.slice(0, visible).map((f, i) => (
                  <li key={f.id}>
                    <FreelancerCard
                      freelancer={f}
                      terms={parsed.include}
                      selectedSkills={state.skills}
                      view={view}
                      index={i % PAGE_SIZE}
                      onSelect={openFreelancer}
                    />
                  </li>
                ))}
              </ul>
            )}

            {canLoadMore && (
              <div ref={sentinelRef} className="mt-8 flex justify-center">
                <button type="button" onClick={showMore} className={`${outlineButton} px-5 py-2.5`}>
                  さらに表示（残り {(results.length - visible).toLocaleString()}人）
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-gold/20 bg-[#060913]/75 px-4 py-8 text-center text-xs text-muted backdrop-blur">
        データ出典:{" "}
        <a href="https://freelance-meikan.com/freelance" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light hover:underline">
          freelance-meikan.com
        </a>{" "}
        ・ 職業・経歴・会社情報は AI による分析結果です
      </footer>

      <Drawer
        open={filtersOpen}
        title="絞り込み"
        onClose={() => setFiltersOpen(false)}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" onClick={clearAll} className={`${outlineButton} px-4 py-2.5`}>
              クリア
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="gold-fill flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              {results.length.toLocaleString()}人を表示
            </button>
          </div>
        }
      >
        {facetPanel}
      </Drawer>

      {selected && (
        <FreelancerModal
          freelancer={selected}
          position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${results.length}` : "検索条件外"}
          selectedSkills={state.skills}
          onClose={closeFreelancer}
          onPrev={selectedIndex > 0 ? () => moveToFreelancer(results[selectedIndex - 1].id) : undefined}
          onNext={
            selectedIndex >= 0 && selectedIndex < results.length - 1
              ? () => moveToFreelancer(results[selectedIndex + 1].id)
              : undefined
          }
        />
      )}
    </div>
  );
}
