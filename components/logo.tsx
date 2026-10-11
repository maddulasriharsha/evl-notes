/**
 * VJNOTES mark: a folded-paper "V" (two ribbons meeting at a crease) on a dark glass tile with a
 * neon rim and a spark. Kept in sync with app/icon.svg.
 */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vj-rim" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="vj-l" x1="12" y1="14" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="vj-r" x1="52" y1="14" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="0.55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <radialGradient id="vj-bg" cx="0.5" cy="0.15" r="0.9">
          <stop offset="0" stopColor="#2a1b57" />
          <stop offset="1" stopColor="#09090f" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="url(#vj-bg)" stroke="url(#vj-rim)" strokeWidth="2.5" />
      {/* two folded ribbons forming the V */}
      <path d="M12 14h12l8 24v12z" fill="url(#vj-l)" />
      <path d="M52 14H40l-8 24v12z" fill="url(#vj-r)" />
      {/* crease + highlight */}
      <path d="M32 38v12" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M14.5 16.5h7l7.2 21.5" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
      {/* spark */}
      <path d="M50 5.5c.5 3.6 1.6 4.7 5.2 5.2-3.6.5-4.7 1.6-5.2 5.2-.5-3.6-1.6-4.7-5.2-5.2 3.600-.5 4.700-1.600 5.200-5.200z" fill="#fff" />
    </svg>
  )
}
