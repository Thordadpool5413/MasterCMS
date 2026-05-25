"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp } from "lucide-react";
import type { DrugSafetyData } from "@/lib/openfda";

export function DrugSafetyCard({ data }: { data: DrugSafetyData | null }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No safety data available</p>
      </div>
    );
  }

  const seriousRate = data.totalReports > 0 ? (data.seriousReports / data.totalReports * 100) : 0;
  const deathRate = data.totalReports > 0 ? (data.deathReports / data.totalReports * 100) : 0;

  return (
    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            FDA Safety Profile
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {data.totalReports.toLocaleString()} reports
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          {seriousRate.toFixed(0)}% serious
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[hsl(var(--muted-foreground))]">Serious events</span>
          <span className="font-medium">{data.seriousReports.toLocaleString()}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[hsl(var(--border))]">
          <div
            className="h-full rounded-full bg-yellow-500"
            style={{ width: `${Math.min(seriousRate, 100)}%` }}
          />
        </div>
      </div>

      {data.deathReports > 0 && (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/20">
          <div className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertCircle className="h-3 w-3" />
            Death reports: {data.deathReports.toLocaleString()}
          </div>
        </div>
      )}

      {data.topReactions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Top adverse events</p>
          <div className="mt-2 space-y-1">
            {data.topReactions.map((reaction, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate text-[hsl(var(--muted-foreground))]">{reaction.reaction}</span>
                <Badge variant="secondary" className="text-xs">
                  {reaction.count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Source: FDA FAERS • Updated {new Date(data.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}
