export default function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
      {/* Image area shimmer */}
      <div className="h-[88px] bg-border animate-pulse" />

      {/* Content shimmer */}
      <div className="p-3 space-y-2">
        <div className="h-3 bg-border rounded animate-pulse w-3/5" />
        <div className="h-2.5 bg-border rounded animate-pulse w-4/5" />
        <div className="border-t border-border pt-2.5 mt-2.5">
          <div className="h-3.5 bg-border rounded animate-pulse w-2/5" />
        </div>
      </div>
    </div>
  )
}
