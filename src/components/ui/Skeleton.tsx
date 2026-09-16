import { ReactNode } from "react";

export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlocks({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card card-body space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label, className = "" }: { label?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <span className="spinner w-6 h-6 border-brand-navy border-t-transparent text-brand-navy" />
      {label && <p className="mt-3 text-sm text-gray-500">{label}</p>}
    </div>
  );
}