/** パネルの四隅の金の飾り */
export default function PanelCorners() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <svg
          key={corner}
          viewBox="0 0 48 48"
          className={`lock-corner lock-corner-${corner}`}
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <path d="M3 32 V12 a9 9 0 0 1 9 -9 H32" strokeWidth="1.6" />
          <path d="M9 40 V17 a8 8 0 0 1 8 -8 H40" strokeOpacity="0.45" />
          <path d="M12 7 l4.5 4.5 -4.5 4.5 -4.5 -4.5z" fill="currentColor" stroke="none" />
        </svg>
      ))}
    </>
  );
}
