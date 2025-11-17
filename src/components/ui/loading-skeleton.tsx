import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
    
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-primary/10">
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const KanbanSkeleton = () => (
  <div className="flex gap-4 overflow-x-auto pb-4 px-2 animate-fade-in">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Card key={i} className="min-w-[320px] shadow-lg border-2">
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((j) => (
            <Card key={j} className="border">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    ))}
  </div>
);

export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3 animate-fade-in">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i} className="border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="border-primary/10">
        <CardHeader>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 10 }: { rows?: number }) => (
  <div className="rounded-md border border-primary/10 animate-fade-in">
    <div className="p-4 border-b border-primary/10">
      <div className="flex gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
    <div className="divide-y divide-primary/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  </div>
);
