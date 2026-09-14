// 扉の中央に飾る金のロゼット (16 枚の花弁と八芒星)
const STAR_POINTS = Array.from({ length: 16 }, (_, k) => {
  const radius = k % 2 ? 26 : 56;
  const angle = ((k * 22.5 - 90) * Math.PI) / 180;
  return `${(100 + radius * Math.cos(angle)).toFixed(1)},${(100 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(" ");

/** 左右の扉の片側 */
export default function DoorLeaf({ side }: { side: "left" | "right" }) {
  return (
    <div className={`lock-door lock-door-${side}`}>
      <span className="lock-door-frame" />
      <span className="lock-door-frame lock-door-frame-inner" />
      <svg viewBox="0 0 200 200" className="lock-door-medallion" fill="none" stroke="currentColor" aria-hidden>
        <circle cx="100" cy="100" r="96" strokeOpacity="0.55" />
        <circle cx="100" cy="100" r="88" strokeOpacity="0.6" strokeDasharray="2 5" />
        {Array.from({ length: 16 }, (_, i) => (
          <ellipse key={i} cx="100" cy="56" rx="9" ry="30" strokeOpacity="0.4" transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="62" strokeOpacity="0.45" />
        <polygon points={STAR_POINTS} strokeOpacity="0.7" />
        <rect x="80" y="80" width="40" height="40" strokeOpacity="0.6" transform="rotate(45 100 100)" />
        <circle cx="100" cy="100" r="7" fill="currentColor" fillOpacity="0.6" stroke="none" />
      </svg>
      <span className="lock-door-studs" />
      <span className="lock-door-handle" />
    </div>
  );
}
