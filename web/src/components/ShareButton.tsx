"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

/** 現在の URL (検索条件・開いているフリーランスを含む) をクリップボードにコピーする */
export default function ShareButton({ label, className = "" }: { label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
      title={copied ? "リンクをコピーしました" : label}
      aria-label={copied ? "リンクをコピーしました" : label}
      className={`inline-flex items-center gap-1.5 transition ${className} ${
        copied ? "!border-emerald-400/60 !text-emerald-300" : ""
      }`}
    >
      <Icon name={copied ? "check" : "link"} className="size-4 text-current" />
      <span className="hidden sm:inline">{copied ? "コピーしました" : label}</span>
    </button>
  );
}
