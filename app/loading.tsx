/** Shown while a page's data is on its way: the shape of a page, in soft grey. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="skeleton h-4 w-40 rounded-md" />
      <div className="skeleton mt-6 h-10 w-2/3 max-w-xl rounded-xl" />
      <div className="skeleton mt-3 h-4 w-56 rounded-md" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="skeleton aspect-[4/3]" />
            <div className="space-y-2 p-3">
              <div className="skeleton h-3.5 w-11/12 rounded" />
              <div className="skeleton h-3.5 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
