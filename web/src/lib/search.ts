import {
  CONTACT_LABELS,
  EXPERTISE_LEVELS,
  EXPERTISE_RANK,
  STATUS_META,
  STATUS_ORDER,
  rateFloor,
  type ContactKey,
  type FreelancerSummary,
} from "@/lib/freelancer";

export type Scope = "all" | "name" | "occupation" | "company" | "skills" | "career";
export type MatchMode = "and" | "or";
export type SortKey = "default" | "expertise" | "rateHigh" | "rateLow" | "name";
export type CompanyFilter = "" | "any" | "url";

export const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "name", label: "氏名" },
  { key: "occupation", label: "職業・肩書き" },
  { key: "company", label: "会社名" },
  { key: "skills", label: "スキル" },
  { key: "career", label: "経歴・実績" },
];

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "掲載順" },
  { key: "expertise", label: "専門性が高い順" },
  { key: "rateHigh", label: "時給が高い順" },
  { key: "rateLow", label: "時給が低い順" },
  { key: "name", label: "名前順" },
];

export type SearchState = {
  query: string;
  scope: Scope;
  mode: MatchMode;
  statuses: string[];
  categories: string[];
  jobs: string[];
  expertise: string[];
  prefectures: string[];
  rates: string[];
  skills: string[];
  skillMode: MatchMode;
  contacts: string[];
  company: CompanyFilter;
  sort: SortKey;
};

export const INITIAL_STATE: SearchState = {
  query: "",
  scope: "all",
  mode: "and",
  statuses: [],
  categories: [],
  jobs: [],
  expertise: [],
  prefectures: [],
  rates: [],
  skills: [],
  skillMode: "or",
  contacts: [],
  company: "",
  sort: "default",
};

/** 複数選択できる絞り込み */
export type ListKey = "statuses" | "categories" | "jobs" | "expertise" | "prefectures" | "rates" | "skills" | "contacts";
export type FacetKey = ListKey | "company";

export const LIST_KEYS: ListKey[] = [
  "statuses",
  "categories",
  "jobs",
  "expertise",
  "prefectures",
  "rates",
  "skills",
  "contacts",
];

export const FACET_LABELS: Record<FacetKey, string> = {
  statuses: "対応状況",
  categories: "職種カテゴリ",
  jobs: "職種",
  expertise: "専門性",
  prefectures: "都道府県",
  rates: "時給",
  skills: "スキル",
  contacts: "連絡先",
  company: "会社",
};

export const COMPANY_LABELS: Record<Exclude<CompanyFilter, "">, string> = {
  any: "代表・役員の会社あり",
  url: "会社リンクあり",
};

export const UNREGISTERED_RATE = "未登録";

// ------------------------------------------------------------ キーワード検索

export const normalize = (text: string) => text.normalize("NFKC").toLowerCase();

export type ParsedQuery = { include: string[]; exclude: string[]; mode: MatchMode };

/**
 * 検索クエリを解析する。
 *   SEO 広告        … 複数キーワード (mode に従い AND / OR)
 *   React OR Vue    … OR を含むといずれか一致
 *   -副業           … 除外
 *   "Web 広告"      … フレーズ
 */
export function parseQuery(query: string, mode: MatchMode): ParsedQuery {
  const tokens = query.normalize("NFKC").match(/-?"[^"]*"?|\S+/g) ?? [];
  const include: string[] = [];
  const exclude: string[] = [];
  let effectiveMode = mode;
  for (const token of tokens) {
    if (token === "OR" || token === "|") {
      effectiveMode = "or";
      continue;
    }
    const negative = token.length > 1 && token.startsWith("-");
    const term = (negative ? token.slice(1) : token).replace(/"/g, "").trim().toLowerCase();
    if (term) (negative ? exclude : include).push(term);
  }
  return { include, exclude, mode: effectiveMode };
}

export type Haystack = Record<Scope, string>;

export function buildHaystack(f: FreelancerSummary, fulltext = ""): Haystack {
  const name = normalize(f.name);
  const occupation = normalize([f.occupation, f.jobTypes.join(" "), f.catchphrase].join(" "));
  const company = normalize(f.companies.join(" "));
  const skills = normalize(f.skills.join(" "));
  const career = normalize(fulltext);
  return {
    name,
    occupation,
    company,
    skills,
    career,
    all: [name, occupation, company, skills, career, normalize(f.prefecture)].join("\n"),
  };
}

export function matchesQuery(haystack: Haystack, query: ParsedQuery, scope: Scope) {
  const text = haystack[scope];
  if (query.exclude.some((term) => text.includes(term))) return false;
  if (!query.include.length) return true;
  return query.mode === "and"
    ? query.include.every((term) => text.includes(term))
    : query.include.some((term) => text.includes(term));
}

// ------------------------------------------------------------------ 絞り込み

const facetValues: Record<FacetKey, (f: FreelancerSummary) => string[]> = {
  statuses: (f) => [f.status],
  categories: (f) => (f.jobTypes[0] ? [f.jobTypes[0]] : []),
  jobs: (f) => f.jobTypes,
  expertise: (f) => [f.expertise],
  prefectures: (f) => (f.prefecture ? [f.prefecture] : []),
  rates: (f) => [f.rate || UNREGISTERED_RATE],
  skills: (f) => f.skills,
  contacts: (f) => f.contacts,
  company: (f) => [...(f.companies.length ? ["any"] : []), ...(f.hasCompanyUrl ? ["url"] : [])],
};

const FACET_KEYS = Object.keys(facetValues) as FacetKey[];

/** except を指定すると、その絞り込みだけ無視する (件数表示用) */
export function matchesFacets(f: FreelancerSummary, state: SearchState, except?: FacetKey) {
  for (const key of LIST_KEYS) {
    const selected = state[key];
    if (key === except || !selected.length) continue;
    const values = facetValues[key](f);
    const requireAll = key === "contacts" || (key === "skills" && state.skillMode === "and");
    const ok = requireAll ? selected.every((v) => values.includes(v)) : selected.some((v) => values.includes(v));
    if (!ok) return false;
  }
  if (except !== "company" && state.company && !facetValues.company(f).includes(state.company)) return false;
  return true;
}

export type FacetCounts = Record<FacetKey, Map<string, number>>;

/** 各選択肢を選んだ場合に該当する人数 (その項目以外の条件を適用した上で数える) */
export function countFacets(list: FreelancerSummary[], state: SearchState): FacetCounts {
  const counts = Object.fromEntries(FACET_KEYS.map((key) => [key, new Map<string, number>()])) as FacetCounts;
  for (const f of list) {
    for (const key of FACET_KEYS) {
      if (!matchesFacets(f, state, key)) continue;
      for (const value of facetValues[key](f)) counts[key].set(value, (counts[key].get(value) ?? 0) + 1);
    }
  }
  return counts;
}

export type FacetOptions = Record<FacetKey, string[]>;

export function buildFacetOptions(list: FreelancerSummary[]): FacetOptions {
  const byFrequency = (key: FacetKey) => {
    const tally = new Map<string, number>();
    for (const f of list) for (const v of facetValues[key](f)) tally.set(v, (tally.get(v) ?? 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  };
  const rates = byFrequency("rates")
    .filter((r) => r !== UNREGISTERED_RATE)
    .sort((a, b) => rateFloor(a) - rateFloor(b));
  return {
    statuses: STATUS_ORDER,
    categories: byFrequency("categories"),
    jobs: byFrequency("jobs"),
    expertise: EXPERTISE_LEVELS,
    prefectures: byFrequency("prefectures"),
    rates: [...rates, UNREGISTERED_RATE],
    skills: byFrequency("skills"),
    contacts: Object.keys(CONTACT_LABELS),
    company: ["any", "url"],
  };
}

export function valueLabel(key: FacetKey, value: string) {
  if (key === "statuses") return STATUS_META[value]?.label ?? value;
  if (key === "contacts") return CONTACT_LABELS[value as ContactKey] ?? value;
  if (key === "company") return COMPANY_LABELS[value as Exclude<CompanyFilter, "">] ?? value;
  return value;
}

export function activeFilters(state: SearchState) {
  const list: { key: FacetKey; value: string; label: string }[] = LIST_KEYS.flatMap((key) =>
    state[key].map((value) => ({ key, value, label: valueLabel(key, value) })),
  );
  if (state.company) list.push({ key: "company", value: state.company, label: valueLabel("company", state.company) });
  return list;
}

// -------------------------------------------------------------------- 並び替え

export function sortFreelancers(list: FreelancerSummary[], sort: SortKey) {
  const sorted = [...list];
  const noRateLast = (a: FreelancerSummary, b: FreelancerSummary) => Number(!a.rate) - Number(!b.rate);
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      break;
    case "expertise":
      sorted.sort((a, b) => (EXPERTISE_RANK[b.expertise] ?? 0) - (EXPERTISE_RANK[a.expertise] ?? 0));
      break;
    case "rateHigh":
      sorted.sort((a, b) => noRateLast(a, b) || rateFloor(b.rate) - rateFloor(a.rate));
      break;
    case "rateLow":
      sorted.sort((a, b) => noRateLast(a, b) || rateFloor(a.rate) - rateFloor(b.rate));
      break;
  }
  return sorted;
}
