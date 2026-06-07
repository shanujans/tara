export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col bg-slate-800 rounded-xl overflow-hidden border border-slate-700 animate-pulse">
          <div className="aspect-square bg-slate-700" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-700 rounded w-3/4" />
            <div className="h-4 bg-slate-600 rounded w-1/2" />
            <div className="h-8 bg-slate-700 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}