"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Avatar from "@/components/Avatar";
import StatusBadge from "@/components/StatusBadge";
import { fieldLabel, isUnknown, type FreelancerRecord, type FreelancerSummary } from "@/lib/freelancer";

type FieldType = "text" | "long" | "links" | "tags" | "list" | "email" | "tel";
type Field = { key: string; type?: FieldType; copy?: boolean };
type Section = { title: string; ai?: boolean; fields: Field[] };

const SECTIONS: Section[] = [
  {
    title: "職業・現在の仕事",
    ai: true,
    fields: [
      { key: "職業(AI)" },
      { key: "現在の仕事内容(AI)", type: "long" },
      { key: "専門性レベル(AI)" },
    ],
  },
  {
    title: "経歴・過去の実績",
    ai: true,
    fields: [
      { key: "経歴(AI)", type: "long" },
      { key: "過去の実績(AI)", type: "long" },
    ],
  },
  {
    title: "会社（代表・役員）",
    ai: true,
    fields: [
      { key: "会社名(AI)", type: "list" },
      { key: "役職(AI)", type: "list" },
      { key: "会社リンク(AI)", type: "links" },
      { key: "会社リンク出典(AI)", type: "list" },
    ],
  },
  {
    title: "連絡先",
    fields: [
      { key: "メールアドレス", type: "email", copy: true },
      { key: "電話番号", type: "tel", copy: true },
      { key: "LINE", copy: true },
      { key: "ChatWork", copy: true },
      { key: "Twitter/X", type: "links" },
      { key: "Facebook", type: "links" },
      { key: "YouTube", type: "links" },
      { key: "TikTok", type: "links" },
    ],
  },
  {
    title: "メイカン掲載情報",
    fields: [
      { key: "メイカンプロフィールURL", type: "links" },
      { key: "職種", type: "tags" },
      { key: "希望時給単価" },
      { key: "スキル", type: "tags" },
      { key: "在住都道府県" },
    ],
  },
];

// ヘッダーに表示する列。これと SECTIONS に含まれない列は「その他」に表示し、全項目を漏れなく見せる
const HEADER_KEYS = ["ID", "氏名", "アバター画像URL", "現在の対応状況", "キャッチコピー"];
const CONFIGURED_KEYS = new Set([...HEADER_KEYS, ...SECTIONS.flatMap((s) => s.fields.map((f) => f.key))]);

const URL_SPLIT = /(https?:\/\/[^\s;；、。，,）)」<>"]+)/g;
const recordCache = new Map<string, FreelancerRecord>();

type Props = {
  freelancer: FreelancerSummary;
  position: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

type LoadState = { id: string; record?: FreelancerRecord; failed?: boolean };

export default function FreelancerModal({ freelancer, position, onClose, onPrev, onNext }: Props) {
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

  const extraKeys = record ? Object.keys(record).filter((key) => !CONFIGURED_KEYS.has(key)) : [];

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
      className="m-auto h-[min(92vh,960px)] w-[min(960px,calc(100vw-1.5rem))] max-w-none flex-col overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl open:flex"
    >
      <header className="flex gap-4 border-b border-line p-5 sm:p-6">
        <Avatar key={id} src={freelancer.avatar} name={freelancer.name} size={88} className="hidden sm:grid" />
        <Avatar key={`${id}-sm`} src={freelancer.avatar} name={freelancer.name} size={56} className="sm:hidden" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="freelancer-modal-title" className="text-xl font-bold leading-tight sm:text-2xl">
              {freelancer.name}
            </h2>
            <StatusBadge status={freelancer.status} />
          </div>
          {freelancer.catchphrase && <p className="mt-1.5 text-sm leading-relaxed">{freelancer.catchphrase}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {freelancer.occupation && <span className="font-medium text-ink">{freelancer.occupation}</span>}
            {freelancer.prefecture && <span>{freelancer.prefecture}</span>}
            {freelancer.hourlyRate && <span>時給 {freelancer.hourlyRate}</span>}
          </div>
          <a
            href={`https://freelance-meikan.com/freelance/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:text-black"
          >
            メイカンでプロフィールを見る ↗
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="-mr-2 -mt-2 grid size-9 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-accent-soft hover:text-ink"
        >
          ×
        </button>
      </header>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-2 sm:px-6">
        {failed ? (
          <div className="py-16 text-center text-sm text-muted">
            <p>詳細データを読み込めませんでした。</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-3 text-accent hover:underline">
              再読み込み
            </button>
          </div>
        ) : !record ? (
          <div className="space-y-3 py-6" aria-busy="true" aria-label="読み込み中">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-line/70" style={{ width: `${90 - i * 7}%` }} />
            ))}
          </div>
        ) : (
          <>
            {SECTIONS.map((section) => (
              <SectionBlock key={section.title} section={section} record={record} />
            ))}
            {extraKeys.length > 0 && (
              <SectionBlock
                section={{ title: "その他", fields: extraKeys.map((key) => ({ key, type: "long" })) }}
                record={record}
              />
            )}
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          className="rounded-lg px-3 py-1.5 hover:bg-accent-soft disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ← 前へ
        </button>
        <span className="text-xs text-muted">
          {position}
          <span className="ml-2 hidden sm:inline">（← → キーで移動 / Esc で閉じる）</span>
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className="rounded-lg px-3 py-1.5 hover:bg-accent-soft disabled:opacity-30 disabled:hover:bg-transparent"
        >
          次へ →
        </button>
      </footer>
    </dialog>
  );
}

function SectionBlock({ section, record }: { section: Section; record: FreelancerRecord }) {
  const singleLong = section.fields.length === 1 && section.fields[0].type === "long";
  return (
    <section className="border-b border-line py-5 last:border-b-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        {section.title}
        {section.ai && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
            AI分析
          </span>
        )}
      </h3>
      {singleLong ? (
        <FieldValue field={section.fields[0]} value={record[section.fields[0].key] ?? ""} />
      ) : (
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9.5rem_1fr]">
          {section.fields.map((field) => (
            <div key={field.key} className="contents">
              <dt className="text-muted">{fieldLabel(field.key)}</dt>
              <dd className="min-w-0 break-words">
                <FieldValue field={field} value={record[field.key] ?? ""} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function FieldValue({ field, value }: { field: Field; value: string }) {
  const v = value.trim();
  if (!v) return <span className="text-muted/60">—</span>;
  if (isUnknown(v) && field.type !== "long") return <span className="text-muted">{v}</span>;

  const content = (() => {
    switch (field.type) {
      case "email":
        return (
          <a href={`mailto:${v}`} className="text-accent hover:underline">
            {v}
          </a>
        );
      case "tel":
        return (
          <a href={`tel:${v.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">
            {v}
          </a>
        );
      case "list":
        return (
          <ul className="space-y-0.5">
            {v.split("; ").map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      case "tags":
        return (
          <div className="flex flex-wrap gap-1.5">
            {v.split(" / ").map((tag) => (
              <span key={tag} className="rounded-md bg-bg px-2 py-0.5 text-xs ring-1 ring-line">
                {tag}
              </span>
            ))}
          </div>
        );
      case "links": {
        const urls = v.match(URL_SPLIT);
        if (!urls) return <Linkified text={v} />;
        return (
          <ul className="space-y-0.5">
            {[...new Set(urls)].map((url) => (
              <li key={url}>
                <ExternalLink href={url} />
              </li>
            ))}
          </ul>
        );
      }
      case "long":
        return (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            <Linkified text={v} />
          </p>
        );
      default:
        return (
          <span className="whitespace-pre-wrap">
            <Linkified text={v} />
          </span>
        );
    }
  })();

  if (!field.copy) return content;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {content}
      <CopyButton value={v} />
    </span>
  );
}

function Linkified({ text }: { text: string }) {
  return text.split(URL_SPLIT).map((part, i) => (i % 2 === 1 ? <ExternalLink key={i} href={part} /> : part));
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
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
      className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-accent hover:text-accent"
    >
      {copied ? "コピー済み" : "コピー"}
    </button>
  );
}
