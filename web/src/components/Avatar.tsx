"use client";

import Image from "next/image";
import { useState } from "react";

const PALETTE = ["#5b6ee1", "#d9774b", "#3f9d7a", "#b45fa8", "#c29a2f", "#4f93c4", "#cc5f6d"];

type Props = { src: string | null; name: string; size: number; className?: string };

export default function Avatar({ src, name, size, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    const initial = Array.from(name.replace(/[（(].*$/, "").trim())[0] ?? "?";
    const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return (
      <div
        aria-hidden
        style={{ ...style, background: PALETTE[hash % PALETTE.length], fontSize: size * 0.4 }}
        className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      style={style}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`}
    />
  );
}
