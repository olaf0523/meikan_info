export type ContactKey = "email" | "phone" | "line" | "chatwork" | "x" | "facebook" | "youtube" | "tiktok";

export type FreelancerSummary = {
  id: string;
  name: string;
  avatar: string | null;
  status: string;
  jobTypes: string[];
  occupation: string;
  expertise: string;
  companies: string[];
  hasCompanyUrl: boolean;
  prefecture: string;
  catchphrase: string;
  /** 例: "3,000円～5,000円"。未登録は空文字 */
  rate: string;
  skills: string[];
  contacts: string[];
};

/** CSV の1行 (列名 → 値) */
export type FreelancerRecord = Record<string, string>;

export const STATUS_ORDER = ["◎現在対応可能", "〇副業で対応可能", "△仕事内容による", "×現在忙しい"];

export const STATUS_META: Record<string, { label: string; short: string; badge: string; dot: string }> = {
  "◎現在対応可能": {
    label: "現在対応可能",
    short: "対応可能",
    badge: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/55 shadow-[0_0_18px_rgba(52,211,153,0.28)]",
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.95)]",
  },
  "〇副業で対応可能": {
    label: "副業で対応可能",
    short: "副業可",
    badge: "bg-sky-400/10 text-sky-200 ring-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.22)]",
    dot: "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]",
  },
  "△仕事内容による": {
    label: "仕事内容による",
    short: "内容次第",
    badge: "bg-amber-400/10 text-amber-200 ring-amber-400/50 shadow-[0_0_18px_rgba(251,191,36,0.22)]",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]",
  },
  "×現在忙しい": {
    label: "現在忙しい",
    short: "多忙",
    badge: "bg-rose-400/10 text-rose-200 ring-rose-400/50 shadow-[0_0_18px_rgba(251,113,133,0.22)]",
    dot: "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.9)]",
  },
};

export const EXPERTISE_LEVELS = ["エキスパート", "上級", "中級", "初級", "判定不能"];
export const EXPERTISE_RANK: Record<string, number> = { エキスパート: 4, 上級: 3, 中級: 2, 初級: 1 };

export const CONTACT_LABELS: Record<ContactKey, string> = {
  email: "メール",
  phone: "電話",
  line: "LINE",
  chatwork: "ChatWork",
  x: "X (Twitter)",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};

/** "3,000円～5,000円" → 3000 (未登録は 0) */
export const rateFloor = (rate: string) => Number((rate.match(/[\d,]+/)?.[0] ?? "").replace(/,/g, "")) || 0;
