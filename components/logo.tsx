export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="evl-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9c9d1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#evl-g)" />
      <path d="M10 9.5h9.5M10 16h7.5M10 22.5h9.5M10 9.5v13" stroke="#0a0a0c" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="16" r="2.4" fill="#8b5cf6" />
    </svg>
  )
}
