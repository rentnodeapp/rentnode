/* The reference leans on chunky 3D renders of hardware. These are the same
   objects drawn flat: a solid black body with one lime face, so they read at
   40px in a card and at 120px on a detail page without a single image request. */

const KIND_ART = [
  // GPU - a fan disc on a card body
  <g key="gpu">
    <rect x="6" y="14" width="52" height="36" rx="7" fill="#101212" />
    <rect x="6" y="14" width="52" height="36" rx="7" fill="none" stroke="#101212" strokeWidth="2" />
    <circle cx="24" cy="32" r="12" fill="#dcf94f" />
    <circle cx="24" cy="32" r="4" fill="#101212" />
    <path d="M24 20a12 12 0 0110.4 6M24 44a12 12 0 01-10.4-6" stroke="#101212" strokeWidth="2" fill="none" strokeLinecap="round" />
    <rect x="42" y="24" width="10" height="16" rx="2" fill="#3a3f3d" />
    <path d="M14 50v6M50 50v6" stroke="#101212" strokeWidth="3" strokeLinecap="round" />
  </g>,
  // CPU - a chip with pins
  <g key="cpu">
    <rect x="14" y="14" width="36" height="36" rx="6" fill="#101212" />
    <rect x="22" y="22" width="20" height="20" rx="3" fill="#dcf94f" />
    <path d="M22 8v6M32 8v6M42 8v6M22 50v6M32 50v6M42 50v6M8 22h6M8 32h6M8 42h6M50 22h6M50 32h6M50 42h6"
      stroke="#101212" strokeWidth="3" strokeLinecap="round" />
  </g>,
  // Storage - a stack of platters
  <g key="storage">
    <rect x="8" y="16" width="48" height="12" rx="6" fill="#101212" />
    <rect x="8" y="30" width="48" height="12" rx="6" fill="#3a3f3d" />
    <rect x="8" y="44" width="48" height="12" rx="6" fill="#101212" />
    <circle cx="18" cy="22" r="3" fill="#dcf94f" />
    <circle cx="18" cy="36" r="3" fill="#dcf94f" />
    <circle cx="18" cy="50" r="3" fill="#dcf94f" />
  </g>,
  // Database - the classic cylinder
  <g key="db">
    <ellipse cx="32" cy="16" rx="20" ry="7" fill="#dcf94f" />
    <path d="M12 16v32c0 3.9 9 7 20 7s20-3.1 20-7V16" fill="#101212" />
    <ellipse cx="32" cy="16" rx="20" ry="7" fill="none" stroke="#101212" strokeWidth="2" />
    <path d="M12 30c0 3.9 9 7 20 7s20-3.1 20-7M12 41c0 3.9 9 7 20 7s20-3.1 20-7"
      stroke="#dcf94f" strokeWidth="2" fill="none" />
  </g>,
];

export function Icon({ kind, size = 40 }: { kind: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden style={{ display: "block" }}>
      {KIND_ART[kind] ?? KIND_ART[0]}
    </svg>
  );
}

/** The wordmark: an upward chevron in a rounded square. */
export function Mark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="#101212" />
      <path d="M7 14.5 12 9l5 5.5" stroke="#dcf94f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" />
    </svg>
  );
}
