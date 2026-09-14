"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseSearchString, toSearchString, type UrlState } from "@/lib/url-state";

// pushState / replaceState は popstate を発火しないため、自前のイベントで購読者に知らせる
const URL_CHANGE_EVENT = "meikan:urlchange";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
  };
}

const getSnapshot = () => window.location.search;
// 静的に事前レンダリングされる HTML は条件なしの状態。ハイドレーション後に URL の状態へ切り替わる
const getServerSnapshot = () => "";

export type NavigateOptions = {
  /** true なら履歴を積まずに現在のエントリを置き換える */
  replace?: boolean;
  /** history.state に保存する値 (Next.js が内部状態を自動で追加する) */
  historyState?: Record<string, unknown>;
};

/**
 * 画面の状態を URL (クエリ文字列) で管理する。
 * URL を唯一の状態として扱うので、リンク共有・ブックマーク・ブラウザの戻る/進むがそのまま機能する。
 * Next.js の App Router は window.history.pushState / replaceState と統合されている。
 */
export function useUrlState() {
  const searchString = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = useMemo(() => parseSearchString(searchString), [searchString]);

  const navigate = useCallback((next: UrlState, { replace = false, historyState }: NavigateOptions = {}) => {
    const query = toSearchString(next);
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (replace) window.history.replaceState(historyState ?? null, "", url);
    else window.history.pushState(historyState ?? null, "", url);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }, []);

  return [state, navigate] as const;
}
