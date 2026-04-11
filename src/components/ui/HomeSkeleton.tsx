import { CardSkeleton } from "@/components/ui/CardSkeleton";

/** Compact header row while user session loads */
export function HomeHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-6 animate-pulse">
      <div className="flex-1 min-w-0 pr-4">
        <div className="h-8 md:h-9 bg-gray-200 rounded-lg w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-full max-w-xs" />
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-lg" />
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-lg" />
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

/** Assigned drills column while drills fetch */
export function AssignedDrillsSkeleton() {
  return (
    <div className="mb-6 md:mb-8 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-16 animate-pulse" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

/**
 * Full-route loading UI for /account (and /home rewrite). Shown immediately on navigation.
 */
export default function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6" />
      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <HomeHeaderSkeleton />

        <div className="h-24 rounded-xl bg-gray-200 animate-pulse mb-4 md:mb-6" />

        <div className="h-12 rounded-lg bg-gray-200 animate-pulse mb-4 md:mb-6" />

        <div className="mb-4 md:mb-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 rounded-xl bg-gray-200 animate-pulse" />
            <div className="h-32 rounded-xl bg-gray-200 animate-pulse" />
          </div>
          <div className="h-14 rounded-full bg-gray-100 animate-pulse mt-3" />
        </div>

        <AssignedDrillsSkeleton />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 rounded w-36 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-14 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
