export default function LogoMark({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polygon
        points="32,4 58,18 58,46 32,60 6,46 6,18"
        stroke="oklch(0.72 0.16 192)"
        strokeWidth="1.5"
        fill="none"
      />
      <polygon
        points="32,14 48,23 48,41 32,50 16,41 16,23"
        stroke="oklch(0.72 0.16 192)"
        strokeWidth="0.75"
        fill="oklch(0.72 0.16 192)"
        fillOpacity="0.06"
      />
      <circle cx="32" cy="32" r="5" fill="oklch(0.72 0.16 192)" />
      <line x1="32" y1="4" x2="32" y2="14" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
      <line x1="32" y1="50" x2="32" y2="60" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
      <line x1="6" y1="18" x2="16" y2="23" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
      <line x1="48" y1="23" x2="58" y2="18" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
      <line x1="6" y1="46" x2="16" y2="41" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
      <line x1="48" y1="41" x2="58" y2="46" stroke="oklch(0.72 0.16 192)" strokeWidth="0.75" opacity="0.4" />
    </svg>
  );
}
