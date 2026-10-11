/** VJNOTES mark: a bold "V" cut from a glowing violet-to-cyan tile, with a spark for the "aha" moment. */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vj-g" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="vj-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4e0ff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#vj-g)" />
      <path d="M8 9.5 16 23.5 24 9.5" fill="none" stroke="url(#vj-v)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.5 3.5v5M23 6h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.18" />
    </svg>
  )
}
