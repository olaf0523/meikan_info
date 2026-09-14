"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import ModeToggle from "@/components/ModeToggle";
import { SCOPES, type ParsedQuery, type Scope, type SearchState } from "@/lib/search";

const PRESETS: { label: string; query: string; scope: Scope }[] = [
  { label: "代表取締役", query: "代表取締役", scope: "occupation" },
  { label: "SEO × コンテンツ", query: "SEO コンテンツ", scope: "all" },
  { label: "AI活用", query: "AI", scope: "all" },
  { label: "React OR Next.js", query: "React OR Next.js", scope: "skills" },
  { label: "英語対応", query: "英語", scope: "all" },
  { label: "大手広告代理店出身", query: "電通 OR 博報堂 OR サイバーエージェント", scope: "career" },
];

type Props = {
  state: SearchState;
  parsed: ParsedQuery;
  scopeCounts: Record<Scope, number> | null;
  fulltextReady: boolean;
  onPatch: (changes: Partial<SearchState>) => void;
};

export default function SearchConsole({ state, parsed, scopeCounts, fulltextReady, onPatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" キーで検索欄にフォーカス
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasTerms = parsed.include.length + parsed.exclude.length > 0;
  const needsFulltext = state.scope === "all" || state.scope === "career";

  return (
    <div className="glass relative animate-rise rounded-3xl p-3 [animation-delay:300ms] sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-[6px] rounded-[20px] border border-gold/10" />

      <div className="relative flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gold" />
          <input
            ref={inputRef}
            type="search"
            value={state.query}
            onChange={(e) => onPatch({ query: e.target.value })}
            placeholder="キーワードで検索（例: SEO 広告 -副業）"
            aria-label="キーワード検索"
            enterKeyHint="search"
            className="h-14 w-full rounded-2xl border border-gold/35 bg-[#050811]/70 pl-12 pr-14 text-base text-ink outline-none transition placeholder:text-muted/80 focus:border-gold focus:bg-[#050811]/90 focus:shadow-[0_0_0_4px_rgba(220,182,108,0.15),0_0_30px_-6px_rgba(232,190,108,0.45)]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {state.query ? (
              <button
                type="button"
                onClick={() => {
                  onPatch({ query: "" });
                  inputRef.current?.focus();
                }}
                aria-label="キーワードをクリア"
                className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-gold/10 hover:text-gold-light"
              >
                <Icon name="close" />
              </button>
            ) : (
              <kbd className="gold-outline hidden rounded-md px-2 py-0.5 font-sans text-xs text-gold sm:inline">/</kbd>
            )}
          </div>
        </div>
        <ModeToggle
          value={state.mode}
          onChange={(mode) => onPatch({ mode })}
          labels={{ and: "すべて含む", or: "いずれか含む" }}
          ariaLabel="複数キーワードの一致条件"
          size="lg"
        />
      </div>

      <div className="no-scrollbar relative mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="検索対象">
        <span className="shrink-0 pr-1 font-serif text-xs font-bold text-gold">検索対象</span>
        {SCOPES.map(({ key, label }) => {
          const active = state.scope === key;
          const count = scopeCounts?.[key];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPatch({ scope: key })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active ? "gold-fill" : "gold-outline text-ink/80 hover:border-gold hover:text-gold-light"
              }`}
            >
              {label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    active ? "bg-[#1c1508]/15" : "bg-gold/15 text-gold-light"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {hasTerms ? (
          <>
            <span className="text-muted">{parsed.mode === "and" ? "すべて含む:" : "いずれか含む:"}</span>
            {parsed.include.map((term) => (
              <span key={`in-${term}`} className="rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold-light ring-1 ring-gold/35">
                {term}
              </span>
            ))}
            {parsed.exclude.map((term) => (
              <span
                key={`ex-${term}`}
                className="rounded-full bg-rose-400/10 px-2 py-0.5 font-semibold text-rose-300 line-through ring-1 ring-rose-400/30"
              >
                {term}
              </span>
            ))}
            {needsFulltext && !fulltextReady && <span className="text-muted">（経歴データを読み込み中…）</span>}
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 pr-0.5 text-gold">
              <Icon name="sparkles" className="size-3.5" />
              おすすめ
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onPatch({ query: preset.query, scope: preset.scope, mode: "and" })}
                className="gold-outline rounded-full px-2.5 py-1 font-medium text-ink/85 transition hover:-translate-y-px hover:border-gold hover:text-gold-light"
              >
                {preset.label}
              </button>
            ))}
          </>
        )}
        <details className="relative ml-auto">
          <summary className="cursor-pointer list-none rounded-full px-2 py-1 font-medium text-muted transition hover:text-gold-light [&::-webkit-details-marker]:hidden">
            検索のコツ
          </summary>
          <div className="glass absolute right-0 z-30 mt-2 w-72 rounded-2xl p-4 leading-relaxed">
            <ul className="space-y-2 text-ink/90">
              <li>
                <code className="rounded bg-gold/15 px-1 text-gold-light">SEO 広告</code> スペース区切りで複数キーワード
              </li>
              <li>
                <code className="rounded bg-gold/15 px-1 text-gold-light">React OR Vue</code> いずれかを含む
              </li>
              <li>
                <code className="rounded bg-gold/15 px-1 text-gold-light">-副業</code> 先頭に - でその語を除外
              </li>
              <li>
                <code className="rounded bg-gold/15 px-1 text-gold-light">&quot;Web広告&quot;</code> フレーズで一致
              </li>
              <li className="text-muted">「検索対象」で氏名・会社名・経歴などに範囲を絞れます。</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
