const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 検索キーワードに一致した部分を <mark> で強調する */
export default function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!text || !terms.length) return <>{text}</>;
  const pattern = new RegExp(
    `(${[...terms].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})`,
    "gi",
  );
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          // 金のグラデーション文字の中でも読めるよう、文字色を明示する
          <mark key={i} className="rounded-sm bg-amber-300/30 px-0.5 text-[#fff6dc] [-webkit-text-fill-color:#fff6dc]">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
