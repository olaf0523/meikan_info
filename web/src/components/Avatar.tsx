"use client";

import Image from "next/image";
import { useState } from "react";

type Props = { src: string | null; name: string; size: number; className?: string };

export default function Avatar({ src, name, size, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    const initial = Array.from(name.replace(/[（(].*$/, "").trim())[0] ?? "?";
    return (
      <div
        aria-hidden
        style={{ ...style, fontSize: size * 0.42 }}
        className={`grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#2a3560,#0a0f22)] font-serif font-bold text-gold-light ${className}`}
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
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
