export type FreelancerSummary = {
  id: string;
  name: string;
  avatar: string | null;
  status: string;
  jobCategory: string;
  jobTypes: string;
  occupation: string;
  expertise: string;
  company: string;
  hasCompanyUrl: boolean;
  prefecture: string;
  catchphrase: string;
  hourlyRate: string;
  hasEmail: boolean;
  hasPhone: boolean;
  searchText: string;
};

/** CSV の1行 (列名 → 値) */
export type FreelancerRecord = Record<string, string>;

export const STATUS_ORDER = ["◎現在対応可能", "〇副業で対応可能", "△仕事内容による", "×現在忙しい"];

export const STATUS_STYLE: Record<string, string> = {
  "◎現在対応可能":
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25",
  "〇副業で対応可能":
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",
  "△仕事内容による":
    "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
  "×現在忙しい":
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25",
};

export const EXPERTISE_LEVELS = ["エキスパート", "上級", "中級", "初級", "判定不能"];

export const isUnknown = (value: string) => /^(不明|なし)/.test(value.trim());

/** "会社名(AI)" → "会社名" */
export const fieldLabel = (key: string) => key.replace(/\(AI(抽出)?\)$/, "");
