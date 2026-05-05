/**
 * Generic card placeholder for Suspense fallbacks (e.g. drill list).
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse ${className}`}
    >
      <div className="h-4 bg-muted rounded w-3/4 mb-3" />
      <div className="h-3 bg-muted rounded w-1/2 mb-2" />
      <div className="h-3 bg-muted rounded w-5/6 mb-4" />
      <div className="h-9 bg-muted rounded-lg w-full" />
    </div>
  );
}
