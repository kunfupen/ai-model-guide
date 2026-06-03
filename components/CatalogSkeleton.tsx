export function CatalogSkeleton() {
  return (
    <section aria-hidden>
      <div className="skeleton mb-6 h-11 w-full rounded-xl" />
      <div className="space-y-3">
        {[24, 16, 32].map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <div className="skeleton h-4 w-20 rounded" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 + i }).map((_, j) => (
                <div key={j} className="skeleton h-7 w-16 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="skeleton h-4 w-16 rounded" />
        <div className="skeleton h-6 w-28 rounded-full" />
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li key={i} className="surface-card p-6">
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
            <div className="skeleton mt-4 h-6 w-2/3 rounded" />
            <div className="skeleton mt-3 h-4 w-full rounded" />
            <div className="skeleton mt-5 h-1.5 w-full rounded-full" />
            <div className="mt-8 flex items-center justify-between">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-4 w-4 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
