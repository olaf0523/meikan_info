import { STATUS_ORDER } from "@/lib/freelancer";
import {
  INITIAL_STATE,
  LIST_KEYS,
  SCOPES,
  SORT_OPTIONS,
  type CompanyFilter,
  type ListKey,
  type MatchMode,
  type SearchState,
  type SortKey,
} from "@/lib/search";

export type View = "grid" | "list";

/** URL に保存する画面の状態 (検索条件・表示形式・開いているフリーランス) */
export type UrlState = { search: SearchState; view: View; id: string | null };

// 例: /?q=SEO&in=career&status=available&skill=React&skill=Vue&sort=rateHigh&id=3581
const PARAM_OF: Record<ListKey, string> = {
  statuses: "status",
  categories: "cat",
  jobs: "job",
  expertise: "level",
  prefectures: "pref",
  rates: "rate",
  skills: "skill",
  contacts: "contact",
};

// 対応状況は記号を含むため、URL では読みやすい英語のコードにする
const STATUS_CODES: Record<string, string> = {
  "◎現在対応可能": "available",
  "〇副業で対応可能": "side",
  "△仕事内容による": "depends",
  "×現在忙しい": "busy",
};
const STATUS_FROM_CODE = Object.fromEntries(Object.entries(STATUS_CODES).map(([status, code]) => [code, status]));

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

export function toSearchString({ search, view, id }: UrlState): string {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.scope !== INITIAL_STATE.scope) params.set("in", search.scope);
  if (search.mode !== INITIAL_STATE.mode) params.set("mode", search.mode);
  for (const key of LIST_KEYS) {
    for (const value of search[key]) {
      params.append(PARAM_OF[key], key === "statuses" ? (STATUS_CODES[value] ?? value) : value);
    }
  }
  if (search.skillMode !== INITIAL_STATE.skillMode) params.set("skillmode", search.skillMode);
  if (search.company) params.set("company", search.company);
  if (search.sort !== INITIAL_STATE.sort) params.set("sort", search.sort);
  if (view !== "grid") params.set("view", view);
  if (id) params.set("id", id);
  return params.toString();
}

export function parseSearchString(searchString: string): UrlState {
  const params = new URLSearchParams(searchString);
  const search: SearchState = { ...INITIAL_STATE };

  search.query = params.get("q") ?? "";
  search.scope = oneOf(params.get("in"), SCOPES.map((s) => s.key), INITIAL_STATE.scope);
  search.mode = oneOf<MatchMode>(params.get("mode"), ["and", "or"], INITIAL_STATE.mode);
  for (const key of LIST_KEYS) {
    const values = params.getAll(PARAM_OF[key]).map((v) => (key === "statuses" ? (STATUS_FROM_CODE[v] ?? v) : v));
    search[key] = [...new Set(values.filter((v) => v && (key !== "statuses" || STATUS_ORDER.includes(v))))];
  }
  search.skillMode = oneOf<MatchMode>(params.get("skillmode"), ["and", "or"], INITIAL_STATE.skillMode);
  search.company = oneOf<CompanyFilter>(params.get("company"), ["any", "url"], "");
  search.sort = oneOf<SortKey>(params.get("sort"), SORT_OPTIONS.map((o) => o.key), INITIAL_STATE.sort);

  return {
    search,
    view: oneOf<View>(params.get("view"), ["grid", "list"], "grid"),
    id: params.get("id")?.replace(/\D/g, "") || null,
  };
}
