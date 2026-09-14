"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

/** 解錠 Cookie を削除して、ロック画面に戻す */
export default function LockButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/lock", { method: "POST" });
        } finally {
          window.location.reload();
        }
      }}
      className="gold-outline inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-ink/85 backdrop-blur transition hover:border-gold hover:text-gold-light disabled:opacity-60"
    >
      <Icon name="lock" className="size-3.5 text-gold" />
      ロック
    </button>
  );
}
