/** 金の錠前 (ツルは解錠時に持ち上がって回転する) */
export default function Padlock() {
  return (
    <svg viewBox="0 0 120 140" className="lock-padlock" aria-hidden>
      <defs>
        <linearGradient id="padlock-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff5d0" />
          <stop offset="0.32" stopColor="#f2d289" />
          <stop offset="0.7" stopColor="#c9973f" />
          <stop offset="1" stopColor="#7a521e" />
        </linearGradient>
        <linearGradient id="padlock-shackle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2c8" />
          <stop offset="0.5" stopColor="#dcae5c" />
          <stop offset="1" stopColor="#976a28" />
        </linearGradient>
        <linearGradient id="padlock-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="padlock-glow">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ffe3a0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffc861" stopOpacity="0" />
        </radialGradient>
        <clipPath id="padlock-body-clip">
          <rect x="12" y="58" width="96" height="76" rx="16" />
        </clipPath>
      </defs>
      <g className="padlock-shackle">
        <path
          d="M34 64 V42 a26 26 0 0 1 52 0 V64"
          fill="none"
          stroke="url(#padlock-shackle)"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </g>
      <rect x="12" y="58" width="96" height="76" rx="16" fill="url(#padlock-body)" stroke="#fff4cf" strokeOpacity="0.6" />
      <g clipPath="url(#padlock-body-clip)">
        <rect className="padlock-shine" x="-40" y="50" width="30" height="100" fill="url(#padlock-shine)" transform="rotate(20 60 96)" />
      </g>
      <rect x="20" y="66" width="80" height="60" rx="11" fill="none" stroke="#6b4716" strokeOpacity="0.35" />
      {[
        [26, 72],
        [94, 72],
        [26, 120],
        [94, 120],
      ].map(([cx, cy]) => (
        <path key={`${cx}-${cy}`} d={`M${cx} ${cy - 3.5} l3.5 3.5 -3.5 3.5 -3.5 -3.5z`} fill="#7a531c" fillOpacity="0.55" />
      ))}
      <circle className="padlock-glow" cx="60" cy="96" r="32" fill="url(#padlock-glow)" />
      <path d="M60 82 a9 9 0 0 1 5 16.5 l3 14 h-16 l3 -14 A9 9 0 0 1 60 82z" fill="#1a1206" />
    </svg>
  );
}
