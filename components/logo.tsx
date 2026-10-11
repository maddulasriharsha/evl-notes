/**
 * VJNOTES mark: a layered "VJ" monogram on a transparent background (no tile), with a magenta V
 * and a violet J that each throw a darker offset shadow. Kept in sync with app/icon.svg.
 */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  const j = 'M48 14V37a9.500 9.500 0 0 1-9.500 9.500'
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vj-vl" x1="3" y1="12" x2="19" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9d3d73" />
          <stop offset="1" stopColor="#5e1b46" />
        </linearGradient>
        <linearGradient id="vj-vr" x1="35" y1="12" x2="19" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e07bb0" />
          <stop offset="1" stopColor="#a8447c" />
        </linearGradient>
        <linearGradient id="vj-j" x1="40" y1="10" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d4fc4" />
        </linearGradient>
      </defs>
      {/* offset shadows */}
      <g transform="translate(-1.500 2.500)" fill="#3a1030" opacity="0.9">
        <path d="M3 12h12l4 26v14z" />
        <path d="M35 12H23l-4 26v14z" />
      </g>
      <g transform="translate(2.500 2.500)" fill="none" stroke="#33236b" strokeWidth="8.500">
        <path d={j} />
        <path d="M41 14h17" strokeWidth="6" />
      </g>
      {/* V */}
      <path d="M3 12h12l4 26v14z" fill="url(#vj-vl)" />
      <path d="M35 12H23l-4 26v14z" fill="url(#vj-vr)" />
      <path d="M19 38v14" stroke="#fff" strokeOpacity="0.3" />
      <path d="M5.500 14.500h7" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.200" strokeLinecap="round" />
      {/* J: cream rim, then violet body */}
      <path d={j} fill="none" stroke="#efe6d0" strokeWidth="10" />
      <path d="M40 14h20" stroke="#efe6d0" strokeWidth="8" />
      <path d={j} fill="none" stroke="url(#vj-j)" strokeWidth="7.500" />
      <path d="M41.500 14h17" stroke="url(#vj-j)" strokeWidth="5.500" />
    </svg>
  )
}
