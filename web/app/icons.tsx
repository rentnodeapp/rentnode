/* Line engravings rather than 3D renders: hairline strokes on paper, the same
   register as the rules and the mono labels. Drawn here, so nothing is fetched
   and nothing belongs to anybody else. */

const KIND_ART = [
  // GPU - a board with a fan
  <g key="gpu">
    <rect x="5" y="16" width="54" height="32" pathLength={1} />
    <circle cx="22" cy="32" r="10" pathLength={1} />
    <circle cx="22" cy="32" r="3" pathLength={1} />
    <path d="M22 22a10 10 0 018.7 5M22 42a10 10 0 01-8.7-5" pathLength={1} />
    <rect x="40" y="24" width="12" height="16" pathLength={1} />
    <path d="M13 48v6M51 48v6M5 26H1M5 34H1" pathLength={1} />
  </g>,
  // CPU - a die with pins
  <g key="cpu">
    <rect x="16" y="16" width="32" height="32" pathLength={1} />
    <rect x="25" y="25" width="14" height="14" pathLength={1} />
    <path d="M24 10v6M32 10v6M40 10v6M24 48v6M32 48v6M40 48v6M10 24h6M10 32h6M10 40h6M48 24h6M48 32h6M48 40h6" pathLength={1} />
  </g>,
  // Storage - stacked platters
  <g key="storage">
    <rect x="8" y="15" width="48" height="11" rx="5.5" pathLength={1} />
    <rect x="8" y="29" width="48" height="11" rx="5.5" pathLength={1} />
    <rect x="8" y="43" width="48" height="11" rx="5.5" pathLength={1} />
    <circle cx="18" cy="20.5" r="2" pathLength={1} /><circle cx="18" cy="34.5" r="2" pathLength={1} /><circle cx="18" cy="48.5" r="2" pathLength={1} />
  </g>,
  // Database - the cylinder
  <g key="db">
    <ellipse cx="32" cy="15" rx="19" ry="6.5" pathLength={1} />
    <path d="M13 15v34c0 3.6 8.5 6.5 19 6.5s19-2.9 19-6.5V15" pathLength={1} />
    <path d="M13 27c0 3.6 8.5 6.5 19 6.5s19-2.9 19-6.5M13 38c0 3.6 8.5 6.5 19 6.5s19-2.9 19-6.5" pathLength={1} />
  </g>,
];

export function Icon({ kind, size = 40, i = 0, still }: { kind: number; size?: number; i?: number; still?: boolean }) {
  return (
    <svg className={still ? undefined : "ani"} width={size} height={size} viewBox="0 0 64 64" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden
      style={{ display: "block", animationDelay: `${(i % 6) * 0.35}s` }}>
      {KIND_ART[kind] ?? KIND_ART[0]}
    </svg>
  );
}

/** Our own mark: a die with a clock notch, engraved in one weight. */
export function Mark() {
  // eslint-disable-next-line @next/next/no-img-element -- static 256px mark
  return <img src="/logo.png" alt="" width={26} height={26} style={{ display: "block", borderRadius: 6 }} />;
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" pathLength={1} />
    </svg>
  );
}
