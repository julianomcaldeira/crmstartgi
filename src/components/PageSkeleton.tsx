import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  className?: string;
  rows?: number;
}

export function PageSkeleton({ className, rows = 8 }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-72 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full bg-muted rounded" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-24 bg-muted rounded-lg animate-pulse", className)} />
  );
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      <div className="h-10 w-full bg-muted rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 w-full bg-muted rounded" />
      ))}
    </div>
  );
}
