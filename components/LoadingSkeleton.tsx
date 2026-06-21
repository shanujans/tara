export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden product-card"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* 4:3 image skeleton */}
          <div className="skeleton" style={{ paddingTop: '75%' }} />

          {/* Body skeleton */}
          <div className="p-3 space-y-2">
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-3/4" />
            <div className="skeleton h-4 rounded w-2/5 mt-1" />
            <div className="skeleton h-8 rounded w-full mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
