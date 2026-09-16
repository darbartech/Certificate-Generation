export default function Logo({
  size = 32,
  showWordmark = true,
  showTagline = false,
  href,
}: {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  href?: string;
}) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="DarbarTech"
    >
      <defs>
        <linearGradient id="dt-mark-bg" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#0a2463" />
          <stop offset="100%" stopColor="#1e5f9e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#dt-mark-bg)" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" stroke="#3e92cc" strokeOpacity="0.35" strokeWidth="1.5" />
      <text
        x="22"
        y="33"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fontFamily="Georgia, Cambria, serif"
        fill="#ffffff"
      >
        T
      </text>
      <text
        x="26"
        y="33"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fontFamily="Georgia, Cambria, serif"
        fill="#3e92cc"
      >
        D
      </text>
    </svg>
  );

  const wordmark = (
    <span className="flex flex-col leading-none">
      <span className="text-[15px] font-bold tracking-tight">
        <span className="text-brand-navy">Darbar</span>
        <span className="text-brand-blue">Tech</span>
      </span>
      {showTagline && (
        <span className="mt-1 inline-flex items-center gap-1.5 text-[8.5px] font-medium uppercase tracking-[0.22em] text-gray-400">
          <span className="h-px w-4 bg-gray-300" />
          Group of Technology
          <span className="h-px w-4 bg-gray-300" />
        </span>
      )}
    </span>
  );

  if (!showWordmark) return mark;

  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      {wordmark}
    </span>
  );
}