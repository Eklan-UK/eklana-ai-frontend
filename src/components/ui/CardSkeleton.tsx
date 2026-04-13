/**
 * Generic card placeholder for Suspense fallbacks (e.g. drill list).
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse ${className}`}
    >
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-5/6 mb-4" />
      <div className="h-9 bg-gray-100 rounded-lg w-full" />
    </div>
  );
}
