"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Avatar from "@/components/Avatar";
import Icon, { type IconName } from "@/components/Icon";
import Ornament from "@/components/Ornament";
import ShareButton from "@/components/ShareButton";
import StatusBadge from "@/components/StatusBadge";
import { EXPERTISE_RANK, type FreelancerRecord, type FreelancerSummary } from "@/lib/freelancer";

// 以下で表示している CSV の列。これ以外の列が CSV に追加された場合は「その他」に表示し、全項目を漏れなく見せる
const KNOWN_KEYS = new Set([
  "ID", "氏名", "メイカンプロフィールURL", "アバター画像URL", "現在の対応状況", "職業(AI)", "現在の仕事内容(AI)",
  "経歴(AI)", "過去の実績(AI)", "専門性レベル(AI)", "会社名(AI)", "役職(AI)", "会社リンク(AI)", "会社リンク出典(AI)",
  "電話番号", "メールアドレス", "LINE", "Twitter/X", "Facebook", "YouTube", "TikTok", "ChatWork", "キャッチコピー",
  "職種", "希望時給単価", "スキル", "在住都道府県",
]);

type ContactRow = { key: string; label: string; icon: IconName; kind: "mail" | "tel" | "text" | "url" };
const CONTACT_ROWS: ContactRow[] = [
  { key: "メールアドレス", label: "メール", icon: "mail", kind: "mail" },
  { key: "電話番号", label: "電話", icon: "phone", kind: "tel" },
  { key: "LINE", label: "LINE", icon: "chat", kind: "text" },
  { key: "ChatWork", label: "ChatWork", icon: "chat", kind: "text" },
  { key: "Twitter/X", label: "X (Twitter)", icon: "link", kind: "url" },
  { key: "Facebook", label: "Facebook", icon: "link", kind: "url" },
  { key: "YouTube", label: "YouTube", icon: "link", kind: "url" },
  { key: "TikTok", label: "TikTok", icon: "link", kind: "url" },
];

const URL_SPLIT = /(https?:\/\/[^\s;；、。，,）)」<>"]+)/g;
const recordCache = new Map<string, FreelancerRecord>();

const field = (record: FreelancerRecord, key: string) => (record[key] ?? "").trim();
const splitList = (value: string) =>
  value
    .split(/\s*;\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
const toLines = (value: string) =>
  value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[・•●\-*]\s*/, "").trim())
    .filter(Boolean);

/** "2016年4月：ヤフーに入社" → { period: "2016年4月", text: "ヤフーに入社" } */
function splitPeriod(line: string) {
  const match = line.match(/^([^：:]{1,28})[：:]\s*([\s\S]+)$/);
  if (match && /\d{4}|年|月|現在|時期|以前|以降|頃/.test(match[1])) return { period: match[1], text: match[2] };
  return { period: "", text: line };
}

type Props = {
  freelancer: FreelancerSummary;
  position: string;
  selectedSkills: string[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

type LoadState = { id: string; record?: FreelancerRecord; failed?: boolean };

export default function FreelancerModal({ freelancer, position, selectedSkills, onClose, onPrev, onNext }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [retry, setRetry] = useState(0);
  const { id } = freelancer;

  const record = recordCache.get(id) ?? (load?.id === id ? load.record : undefined);
  const failed = !record && load?.id === id && load.failed;

  useEffect(() => {
    const dialog = dialogRef.current;
    const root = document.documentElement;
    dialog?.showModal();
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
      dialog?.close();
    };
  }, []);

  // ブックマークや履歴で誰のページか分かるようにタイトルを変える
  useEffect(() => {
    const previous = document.title;
    document.title = `${freelancer.name} | フリーランス名鑑 データベース`;
    return () => {
      document.title = previous;
    };
  }, [freelancer.name]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (recordCache.has(id)) return;
    let cancelled = false;
    fetch(`/data/freelancers/${id}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FreelancerRecord>;
      })
      .then((data) => {
        recordCache.set(id, data);
        if (!cancelled) setLoad({ id, record: data });
      })
      .catch(() => {
        if (!cancelled) setLoad({ id, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, retry]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "ArrowLeft" && onPrev) {
      e.preventDefault();
      onPrev();
    } else if (e.key === "ArrowRight" && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  const email = record ? field(record, "メールアドレス") : "";
  const phone = record ? field(record, "電話番号") : "";
  const companyUrl = record ? (field(record, "会社リンク(AI)").match(URL_SPLIT)?.[0] ?? "") : "";
  const extraKeys = record ? Object.keys(record).filter((key) => !KNOWN_KEYS.has(key) && field(record, key)) : [];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="freelancer-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
      className="scene-bg m-auto h-[min(94dvh,1040px)] w-[min(1100px,calc(100vw-1rem))] max-w-none flex-col overflow-hidden rounded-3xl border border-gold/55 p-0 text-ink shadow-[0_0_90px_-16px_rgba(226,184,104,0.45)] open:flex open:animate-pop"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="gold-outline absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full text-gold-light backdrop-blur transition hover:border-gold"
      >
        <Icon name="close" className="size-5" />
      </button>

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">
        {/* 上部は背景の景色を見せる */}
        <div aria-hidden className="h-32 sm:h-44" />

        <div className="px-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <Avatar key={id} src={freelancer.avatar} name={freelancer.name} size={120} className="gold-ring relative z-10 -mt-12" />
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  id="freelancer-modal-title"
                  className="gold-text font-serif text-3xl font-extrabold leading-tight tracking-wide drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)] sm:text-4xl"
                >
                  {freelancer.name}
                </h2>
                <StatusBadge status={freelancer.status} size="md" />
              </div>
              {freelancer.occupation && (
                <p className="mt-2 font-serif text-base font-semibold text-[#ead6a6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-lg">
                  {freelancer.occupation}
                </p>
              )}
            </div>
          </div>

          {freelancer.catchphrase && (
            <p className="mt-5 font-serif text-lg font-medium leading-relaxed tracking-wide text-[#f4e8cb] sm:text-xl">
              {freelancer.catchphrase}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/85">
            {freelancer.prefecture && (
              <span className="flex items-center gap-1.5">
                <Icon name="pin" className="size-4 text-gold" />
                {freelancer.prefecture}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-serif">
              <Icon name="wallet" className="size-4 text-gold" />
              {freelancer.rate ? `時給 ${freelancer.rate}` : "時給未登録"}
            </span>
            {freelancer.companies[0] && (
              <span className="flex items-center gap-1.5">
                <Icon name="building" className="size-4 text-gold" />
                {freelancer.companies.join(" / ")}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ActionLink href={`https://freelance-meikan.com/freelance/${id}`} icon="external" primary>
              メイカンで見る
            </ActionLink>
            {email && (
              <ActionLink href={`mailto:${email}`} icon="mail">
                メールを送る
              </ActionLink>
            )}
            {phone && (
              <ActionLink href={`tel:${phone.replace(/[^\d+]/g, "")}`} icon="phone">
                電話する
              </ActionLink>
            )}
            {companyUrl && (
              <ActionLink href={companyUrl} icon="globe">
                会社サイト
              </ActionLink>
            )}
            <ShareButton
              label="この人のリンクをコピー"
              className="gold-outline rounded-xl px-4 py-2 text-sm font-semibold text-ink hover:border-gold hover:text-gold-light"
            />
          </div>

          <Ornament className="mt-7" />
        </div>

        {failed ? (
          <div className="px-8 py-16 text-center text-sm text-muted">
            <p>詳細データを読み込めませんでした。</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-3 font-medium text-gold hover:text-gold-light hover:underline">
              再読み込み
            </button>
          </div>
        ) : !record ? (
          <div className="grid gap-5 px-5 pb-8 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true" aria-label="読み込み中">
            {[0, 1].map((col) => (
              <div key={col} className="glass space-y-3 rounded-2xl p-5">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-gold/10" style={{ width: `${92 - i * 9}%` }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 px-5 pb-8 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-5">
              <Card icon="briefcase" title="現在の仕事" ai>
                <Paragraph text={field(record, "現在の仕事内容(AI)")} />
              </Card>
              <Card icon="timeline" title="経歴" ai>
                <Timeline text={field(record, "経歴(AI)")} />
              </Card>
              <Card icon="trophy" title="過去の実績" ai>
                <Achievements text={field(record, "過去の実績(AI)")} />
              </Card>
              <Card icon="building" title="会社（代表・役員）" ai>
                <Companies record={record} />
              </Card>
              {extraKeys.length > 0 && (
                <Card icon="sparkles" title="その他">
                  <dl className="divide-y divide-gold/15">
                    {extraKeys.map((key) => (
                      <InfoRow key={key} label={key}>
                        <Linkified text={field(record, key)} />
                      </InfoRow>
                    ))}
                  </dl>
                </Card>
              )}
            </div>

            <aside className="min-w-0 space-y-5">
              <Card icon="mail" title="連絡先">
                <Contacts record={record} />
              </Card>
              <Card icon="user" title="プロフィール">
                <dl className="divide-y divide-gold/15">
                  <InfoRow label="職業">{field(record, "職業(AI)") || <Muted />}</InfoRow>
                  <InfoRow label="職種">
                    <Tags values={field(record, "職種").split(" / ").filter(Boolean)} />
                  </InfoRow>
                  <InfoRow label="専門性">
                    <ExpertiseMeter level={field(record, "専門性レベル(AI)")} />
                  </InfoRow>
                  <InfoRow label="希望時給">
                    <span className="font-serif">{field(record, "希望時給単価") || <Muted />}</span>
                  </InfoRow>
                  <InfoRow label="在住">{field(record, "在住都道府県") || <Muted />}</InfoRow>
                  <InfoRow label="対応状況">{field(record, "現在の対応状況") || <Muted />}</InfoRow>
                  <InfoRow label="キャッチ">
                    <span className="font-serif">{field(record, "キャッチコピー") || <Muted />}</span>
                  </InfoRow>
                  <InfoRow label="メイカン">
                    <ExternalLink href={field(record, "メイカンプロフィールURL")} />
                  </InfoRow>
                  <InfoRow label="ID">
                    <span className="tabular-nums">{field(record, "ID")}</span>
                  </InfoRow>
                </dl>
              </Card>
              <Card icon="check" title="スキル">
                <Tags values={field(record, "スキル").split(" / ").filter(Boolean)} highlight={selectedSkills} />
              </Card>
            </aside>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-gold/30 bg-[#060913]/85 px-3 py-2.5 text-sm backdrop-blur sm:px-6">
        <NavButton onClick={onPrev} icon="chevronLeft">
          前へ
        </NavButton>
        <span className="text-xs tabular-nums text-muted">
          <span className="font-serif text-gold-light">{position}</span>
          <span className="ml-2 hidden sm:inline">← → で移動 ・ Esc で閉じる</span>
        </span>
        <NavButton onClick={onNext} icon="chevronRight" iconRight>
          次へ
        </NavButton>
      </footer>
    </dialog>
  );
}

// ---------------------------------------------------------------- パーツ

function Card({ icon, title, ai, children }: { icon: IconName; title: string; ai?: boolean; children: ReactNode }) {
  return (
    <section className="glass relative rounded-2xl p-5">
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[12px] border border-gold/10" />
      <h3 className="relative mb-4 flex items-center gap-2.5 font-serif text-base font-bold tracking-wide text-gold-light">
        <span className="gold-outline grid size-8 place-items-center rounded-full text-gold">
          <Icon name={icon} className="size-4" />
        </span>
        {title}
        {ai && (
          <span className="ml-auto rounded-full border border-gold/40 px-2 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-gold">
            AI分析
          </span>
        )}
      </h3>
      <div className="relative">{children}</div>
    </section>
  );
}

function Muted({ text = "—" }: { text?: string }) {
  return <span className="text-sm text-muted">{text}</span>;
}

function Paragraph({ text }: { text: string }) {
  if (!text) return <Muted text="記載なし" />;
  const lines = toLines(text);
  if (lines.length > 1) return <Achievements text={text} bullet="diamond" />;
  return (
    <p className="text-sm leading-relaxed">
      <Linkified text={text} />
    </p>
  );
}

function Timeline({ text }: { text: string }) {
  const items = toLines(text).map(splitPeriod);
  if (!items.length) return <Muted text="記載なし" />;
  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-gold/35 pl-5">
      {items.map((item, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden
            className="absolute -left-[26px] top-1.5 size-2.5 rotate-45 bg-gold shadow-[0_0_10px_rgba(232,190,108,0.9)] ring-2 ring-[#0a0f1f]"
          />
          {item.period && <p className="font-serif text-xs font-bold tracking-wide text-gold">{item.period}</p>}
          <p className="text-sm leading-relaxed">
            <Linkified text={item.text} />
          </p>
        </li>
      ))}
    </ol>
  );
}

function Achievements({ text, bullet = "check" }: { text: string; bullet?: "check" | "diamond" }) {
  const items = toLines(text);
  if (!items.length) return <Muted text="記載なし" />;
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          {bullet === "check" ? (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-emerald-400/50 bg-emerald-400/10 text-emerald-300">
              <Icon name="check" className="size-3.5" />
            </span>
          ) : (
            <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />
          )}
          <span className="min-w-0">
            <Linkified text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Companies({ record }: { record: FreelancerRecord }) {
  const names = splitList(field(record, "会社名(AI)"));
  if (!names.length) return <Muted text="本人が代表・役員を務める会社の記載はありません" />;
  const roles = splitList(field(record, "役職(AI)"));
  const urls = splitList(field(record, "会社リンク(AI)"));
  const sources = splitList(field(record, "会社リンク出典(AI)"));
  // リンクが全社分そろっている場合のみ会社とリンクを対応付けられる
  const aligned = urls.length === names.length;

  return (
    <div className="space-y-3">
      {names.map((name, i) => (
        <div key={`${name}-${i}`} className="gold-outline rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-serif text-base font-bold text-gold-light">{name}</p>
              {roles[i] && <p className="mt-0.5 text-xs text-muted">{roles[i]}</p>}
            </div>
            {aligned && sources[i] && <SourceBadge source={sources[i]} />}
          </div>
          {aligned && urls[i] && (
            <a
              href={urls[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all text-sm text-gold-light hover:underline"
            >
              <Icon name="globe" className="size-4 shrink-0 text-gold" />
              {urls[i]}
            </a>
          )}
        </div>
      ))}
      {!aligned && urls.length > 0 && (
        <div className="rounded-xl border border-dashed border-gold/35 p-4">
          <p className="mb-2 text-xs font-medium text-muted">会社リンク</p>
          <ul className="space-y-1.5">
            {urls.map((url, i) => (
              <li key={url} className="flex flex-wrap items-center gap-2">
                <ExternalLink href={url} />
                {sources[i] && <SourceBadge source={sources[i]} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const style = source.includes("high")
    ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/45"
    : source.includes("medium")
      ? "bg-amber-400/10 text-amber-200 ring-amber-400/45"
      : "bg-gold/10 text-gold-light ring-gold/40";
  const label = source.replace("(確度: high)", "・確度 高").replace("(確度: medium)", "・確度 中").replace(/\s+/g, "");
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style}`}>{label}</span>
  );
}

function Contacts({ record }: { record: FreelancerRecord }) {
  const available = CONTACT_ROWS.filter((row) => field(record, row.key));
  const missing = CONTACT_ROWS.filter((row) => !field(record, row.key));
  return (
    <>
      {available.length ? (
        <ul className="space-y-2">
          {available.map((row) => {
            const value = field(record, row.key);
            const url = row.kind === "url" ? (value.match(URL_SPLIT)?.[0] ?? "") : "";
            return (
              <li key={row.key} className="gold-outline flex items-center gap-3 rounded-xl px-3 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                  <Icon name={row.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">{row.label}</p>
                  {row.kind === "mail" ? (
                    <a href={`mailto:${value}`} className="block truncate text-sm font-medium text-gold-light hover:underline">
                      {value}
                    </a>
                  ) : row.kind === "tel" ? (
                    <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className="block truncate text-sm font-medium text-gold-light hover:underline">
                      {value}
                    </a>
                  ) : url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gold-light hover:underline">
                      {value.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium">{value}</p>
                  )}
                </div>
                {row.kind !== "url" && <CopyButton value={value} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <Muted text="連絡先の掲載はありません" />
      )}
      {missing.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">未登録: {missing.map((row) => row.label).join("・")}</p>
      )}
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Tags({ values, highlight = [] }: { values: string[]; highlight?: string[] }) {
  if (!values.length) return <Muted />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            highlight.includes(value) ? "gold-fill font-semibold" : "gold-outline text-ink"
          }`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function ExpertiseMeter({ level }: { level: string }) {
  if (!level) return <Muted />;
  const rank = EXPERTISE_RANK[level] ?? 0;
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${
              n <= rank ? "bg-linear-to-r from-[#f5d990] to-[#b8893e] shadow-[0_0_8px_rgba(232,190,108,0.6)]" : "bg-gold/15"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 font-serif text-xs text-gold-light">{level}</p>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  primary,
  children,
}: {
  href: string;
  icon: IconName;
  primary?: boolean;
  children: ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition active:scale-[0.98] ${
        primary ? "gold-fill hover:brightness-110" : "gold-outline text-ink hover:border-gold hover:text-gold-light"
      }`}
    >
      <Icon name={icon} />
      {children}
    </a>
  );
}

function NavButton({
  onClick,
  icon,
  iconRight,
  children,
}: {
  onClick?: () => void;
  icon: IconName;
  iconRight?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-medium text-ink transition hover:bg-gold/10 hover:text-gold-light disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      {!iconRight && <Icon name={icon} className="size-4 text-gold" />}
      {children}
      {iconRight && <Icon name={icon} className="size-4 text-gold" />}
    </button>
  );
}

function Linkified({ text }: { text: string }) {
  return text
    .split(URL_SPLIT)
    .map((part, i) => (i % 2 === 1 ? <ExternalLink key={i} href={part} /> : part));
}

function ExternalLink({ href }: { href: string }) {
  if (!href) return <Muted />;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-gold-light hover:underline">
      {href}
    </a>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      aria-label={copied ? "コピーしました" : "コピー"}
      title={copied ? "コピーしました" : "コピー"}
      className={`grid size-8 shrink-0 place-items-center rounded-full transition ${
        copied ? "bg-emerald-400/15 text-emerald-300" : "text-gold/80 hover:bg-gold/10 hover:text-gold-light"
      }`}
    >
      <Icon name={copied ? "check" : "copy"} />
    </button>
  );
}
