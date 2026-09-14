"use client";

import { useState, type ReactNode } from "react";
import Chip from "@/components/Chip";
import Icon from "@/components/Icon";
import ModeToggle from "@/components/ModeToggle";
import { STATUS_META } from "@/lib/freelancer";
import {
  COMPANY_LABELS,
  normalize,
  valueLabel,
  type CompanyFilter,
  type FacetCounts,
  type FacetOptions,
  type ListKey,
  type SearchState,
} from "@/lib/search";

type Props = {
  state: SearchState;
  options: FacetOptions;
  counts: FacetCounts;
  onToggle: (key: ListKey, value: string) => void;
  onPatch: (changes: Partial<SearchState>) => void;
};

export default function FacetPanel({ state, options, counts, onToggle, onPatch }: Props) {
  const chips = (key: ListKey) => (
    <div className="flex flex-wrap gap-1.5">
      {options[key].map((value) => (
        <Chip
          key={value}
          active={state[key].includes(value)}
          count={counts[key].get(value) ?? 0}
          dot={key === "statuses" ? STATUS_META[value]?.dot : undefined}
          onClick={() => onToggle(key, value)}
        >
          {valueLabel(key, value)}
        </Chip>
      ))}
    </div>
  );

  const checkList = (key: ListKey, placeholder: string) => (
    <CheckList
      values={options[key]}
      selected={state[key]}
      counts={counts[key]}
      placeholder={placeholder}
      onToggle={(value) => onToggle(key, value)}
    />
  );

  return (
    <div className="divide-y divide-gold/15">
      <Section title="対応状況" selected={state.statuses.length}>
        {chips("statuses")}
      </Section>
      <Section title="職種カテゴリ" selected={state.categories.length}>
        {chips("categories")}
      </Section>
      <Section title="職種（詳細）" selected={state.jobs.length} defaultOpen={false}>
        {checkList("jobs", "職種を検索")}
      </Section>
      <Section title="スキル" selected={state.skills.length}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">複数選択時</span>
          <ModeToggle
            value={state.skillMode}
            onChange={(skillMode) => onPatch({ skillMode })}
            labels={{ and: "すべて持つ", or: "いずれか" }}
            ariaLabel="スキルの一致条件"
          />
        </div>
        {checkList("skills", "スキルを検索（例: React）")}
      </Section>
      <Section title="専門性レベル（AI）" selected={state.expertise.length}>
        {chips("expertise")}
      </Section>
      <Section title="希望時給" selected={state.rates.length}>
        {chips("rates")}
      </Section>
      <Section title="在住都道府県" selected={state.prefectures.length} defaultOpen={false}>
        {checkList("prefectures", "都道府県を検索")}
      </Section>
      <Section title="会社" selected={state.company ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(COMPANY_LABELS) as Exclude<CompanyFilter, "">[]).map((value) => (
            <Chip
              key={value}
              active={state.company === value}
              count={counts.company.get(value) ?? 0}
              onClick={() => onPatch({ company: state.company === value ? "" : value })}
            >
              {COMPANY_LABELS[value]}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title="連絡先" selected={state.contacts.length}>
        <p className="mb-2 text-[11px] text-muted">選択したすべての連絡先を掲載している人に絞り込みます</p>
        {chips("contacts")}
      </Section>
    </div>
  );
}

function Section({
  title,
  selected,
  defaultOpen = true,
  children,
}: {
  title: string;
  selected: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group py-3.5 first:pt-1 last:pb-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-serif text-sm font-bold text-gold-light [&::-webkit-details-marker]:hidden">
        {title}
        {selected > 0 && (
          <span className="gold-fill grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold">
            {selected}
          </span>
        )}
        <Icon name="chevronDown" className="ml-auto size-4 text-gold transition group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function CheckList({
  values,
  selected,
  counts,
  placeholder,
  onToggle,
  initial = 8,
}: {
  values: string[];
  selected: string[];
  counts: Map<string, number>;
  placeholder: string;
  onToggle: (value: string) => void;
  initial?: number;
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);

  const needle = normalize(filter.trim());
  const matched = needle ? values.filter((v) => normalize(v).includes(needle)) : values;
  // 選択中の項目を先頭に固定する
  const ordered = [...matched.filter((v) => selected.includes(v)), ...matched.filter((v) => !selected.includes(v))];
  const limit = expanded || needle ? ordered.length : Math.max(initial, selected.length);

  return (
    <div>
      <div className="relative mb-2">
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gold" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-8 w-full rounded-lg border border-gold/30 bg-[#050811]/70 pl-8 pr-2 text-xs text-ink outline-none transition placeholder:text-muted/80 focus:border-gold focus:shadow-[0_0_0_3px_rgba(220,182,108,0.15)]"
        />
      </div>
      <ul className="space-y-0.5">
        {ordered.slice(0, limit).map((value) => {
          const count = counts.get(value) ?? 0;
          const checked = selected.includes(value);
          return (
            <li key={value}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-gold/10 ${
                  !checked && count === 0 ? "opacity-40" : ""
                } ${checked ? "bg-gold/10 font-medium text-gold-light" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(value)}
                  className="size-4 shrink-0 accent-gold"
                />
                <span className="min-w-0 flex-1 truncate">{value}</span>
                <span className="text-xs tabular-nums text-muted">{count}</span>
              </label>
            </li>
          );
        })}
        {ordered.length === 0 && <li className="px-2 py-1.5 text-xs text-muted">該当なし</li>}
      </ul>
      {!needle && ordered.length > initial && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 px-2 text-xs font-medium text-gold hover:text-gold-light hover:underline"
        >
          {expanded ? "折りたたむ" : `すべて表示（${ordered.length}）`}
        </button>
      )}
    </div>
  );
}
