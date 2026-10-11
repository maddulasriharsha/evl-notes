/**
 * VJNOTES mark: a "V" drawn as a comet. A four-point star sits at the vertex, one arm is short and
 * the other sweeps out into a long tapered tail. Transparent background. Kept in sync with app/icon.svg.
 */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vj-g" x1="6" y1="62" x2="62" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <g fill="url(#vj-g)">
        <path d="M26 28Q29 43 41 46Q29 49 26 63Q23 49 9 46Q23 43 26 28Z" />
        <path d="M30 42C42 38 51 30 62 12C52 33 41 45 28 52Z" />
        <path d="M5 10C11 24 17 35 25 44L22 48C15 38 8 25 5 10Z" />
      </g>
    </svg>
  )
}
