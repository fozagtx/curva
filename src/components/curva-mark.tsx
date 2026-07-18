// The Curva mark: a rising probability curve ending in a live dot.

export default function CurvaMark({ size = 22 }: { size?: number }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 32 32" width={size}>
      <path
        d="M3 24 C 9 24, 10 14, 14 12 S 20 16, 23 12 S 27 6, 29 7"
        stroke="#22C55E"
        strokeLinecap="round"
        strokeWidth={3.4}
      />
      <circle cx="29" cy="7" fill="#38BDF8" r="2.8" />
    </svg>
  );
}
