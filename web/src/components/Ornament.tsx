/** 中央にひし形をあしらった金の飾り罫 */
export default function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-1.5 ${className}`}>
      <span className="h-px flex-1 bg-linear-to-r from-transparent via-gold/45 to-gold/75" />
      <svg viewBox="0 0 44 12" className="h-3 w-11 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M1 6h9M34 6h9" />
        <path d="M13 6l2.5-2.5M13 6l2.5 2.5M31 6l-2.5-2.5M31 6l-2.5 2.5" />
        <path d="M22 1.5 26.5 6 22 10.5 17.5 6Z" fill="currentColor" fillOpacity="0.3" />
      </svg>
      <span className="h-px flex-1 bg-linear-to-l from-transparent via-gold/45 to-gold/75" />
    </div>
  );
}
