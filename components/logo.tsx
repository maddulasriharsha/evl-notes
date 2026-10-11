/**
 * VJNOTES mark: a "V" drawn as a comet. A four-point star sits at the vertex, one arm is short and
 * the other sweeps out into a long tapered tail. Pure white on a pure black tile with a fine rim.
 * Kept in sync with app/icon.svg.
 */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="0.750" y="0.750" width="62.500" height="62.500" rx="16" fill="#000" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.500" />
      <g fill="#fff" transform="translate(4 4) scale(0.875)">
        <path d="M26 28Q29 43 41 46Q29 49 26 63Q23 49 9 46Q23 43 26 28Z" />
        <path d="M30 42C42 38 51 30 62 12C52 33 41 45 28 52Z" />
        <path d="M5 10C11 24 17 35 25 44L22 48C15 38 8 25 5 10Z" />
      </g>
    </svg>
  )
}
