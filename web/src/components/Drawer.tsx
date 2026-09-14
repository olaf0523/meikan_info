"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "@/components/Icon";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
};

/** 画面右からスライドインするパネル (モバイルの絞り込み用) */
export default function Drawer({ open, title, onClose, footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const root = document.documentElement;
    dialog.showModal();
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
      dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="scene-bg m-0 ml-auto h-dvh max-h-none w-[min(24rem,100vw)] max-w-none flex-col border-l border-gold/45 p-0 text-ink shadow-[0_0_60px_-10px_rgba(220,180,100,0.35)] open:flex open:animate-slide-in"
    >
      <header className="flex items-center justify-between border-b border-gold/25 bg-[#060913]/60 px-5 py-4 backdrop-blur">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-gold-light">
          <Icon name="filter" className="size-4 text-gold" />
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="gold-outline grid size-9 place-items-center rounded-full text-gold transition hover:border-gold hover:text-gold-light"
        >
          <Icon name="close" className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain bg-[#060913]/55 px-5 py-2 backdrop-blur-sm">{children}</div>
      {footer && <footer className="border-t border-gold/25 bg-[#060913]/80 px-5 py-3 backdrop-blur">{footer}</footer>}
    </dialog>
  );
}
