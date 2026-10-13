/** Re-mounted on every navigation, so each page arrives with a soft fade instead of a hard cut. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>
}
