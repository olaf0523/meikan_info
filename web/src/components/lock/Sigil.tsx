import type { StyleWithVars } from "@/components/lock/types";

const SHARD_ANGLES = Array.from({ length: 8 }, (_, i) => i * 45);

/** 錠前を囲む金の紋章。外周の 8 片は解錠時に砕けて飛び散る */
export default function Sigil() {
  return (
    <svg viewBox="0 0 240 240" className="lock-sigil" fill="none" stroke="currentColor" aria-hidden>
      <defs>
        <path id="sigil-text-path" d="M120 120 m-99 0 a99 99 0 1 1 198 0 a99 99 0 1 1 -198 0" />
      </defs>

      <g className="sigil-shards">
        {SHARD_ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 120 120)`}>
            <g className="sigil-shard" style={{ "--i": i } as StyleWithVars}>
              <path d="M81.9 9.4 A117 117 0 0 1 158.1 9.4" strokeWidth="2.4" strokeOpacity="0.9" />
              <path d="M120 3 l4 5 -4 5 -4 -5z" fill="currentColor" stroke="none" />
            </g>
          </g>
        ))}
      </g>

      <g className="sigil-outer">
        <circle cx="120" cy="120" r="111" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="1 5" />
        <text fill="currentColor" stroke="none" fillOpacity="0.8" fontSize="8.5" fontWeight="700" letterSpacing="2">
          <textPath href="#sigil-text-path" textLength="618" lengthAdjust="spacing">
            FREELANCE MEIKAN ✦ PRIVATE ARCHIVE ✦ FREELANCE MEIKAN ✦ PRIVATE ARCHIVE ✦
          </textPath>
        </text>
        <circle cx="120" cy="120" r="90" strokeOpacity="0.45" />
      </g>

      <g className="sigil-inner">
        {Array.from({ length: 24 }, (_, i) => (
          <path
            key={i}
            d={i % 2 ? "M120 36 v5" : "M120 34 v10"}
            strokeOpacity={i % 2 ? 0.4 : 0.85}
            transform={`rotate(${i * 15} 120 120)`}
          />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <path
            key={i}
            d="M120 24 l5 7 -5 7 -5 -7z"
            fill="currentColor"
            fillOpacity="0.9"
            stroke="none"
            transform={`rotate(${i * 90 + 45} 120 120)`}
          />
        ))}
        <rect x="66" y="66" width="108" height="108" strokeOpacity="0.3" transform="rotate(45 120 120)" />
        <rect x="66" y="66" width="108" height="108" strokeOpacity="0.3" />
        <circle cx="120" cy="120" r="70" strokeOpacity="0.35" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}
