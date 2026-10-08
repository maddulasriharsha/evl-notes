export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="M10 9.5h9.5M10 16h7.5M10 22.5h9.5M10 9.5v13" stroke="var(--bg)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="16" r="2.4" fill="var(--gold)" />
    </svg>
  )
}
