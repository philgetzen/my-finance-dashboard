import React from 'react';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex space-x-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center">
              <Skeleton className="w-10 h-10 rounded-lg mr-4" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SkeletonCard>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-6" />
          <Skeleton className="h-80 w-full" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-40 mb-6" />
          <Skeleton className="h-80 w-full" />
        </SkeletonCard>
      </div>

      {/* Table */}
      <SkeletonCard>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex space-x-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Net Worth */}
      <SkeletonCard className="text-center">
        <Skeleton className="h-6 w-40 mx-auto mb-2" />
        <Skeleton className="h-10 w-48 mx-auto" />
      </SkeletonCard>

      {/* Account Groups */}
      {[...Array(3)].map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Skeleton className="w-10 h-10 rounded-lg mr-3" />
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Skeleton className="w-8 h-8 rounded-lg mr-3" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function HoldingsSkeleton() {
  return (
    <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg mr-3" />
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i}>
            <div className="text-center">
              <Skeleton className="h-4 w-20 mx-auto mb-2" />
              <Skeleton className="h-8 w-24 mx-auto" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Holdings Table */}
      <SkeletonCard>
        <div className="mb-6">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-full">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SkeletonCard>

      {/* Performance Chart */}
      <SkeletonCard>
        <div className="mb-6">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-48 sm:h-64 w-full rounded-lg" />
      </SkeletonCard>
    </div>
  );
}