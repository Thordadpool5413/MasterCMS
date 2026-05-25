"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink, Microscope, CheckCircle2, AlertCircle } from "lucide-react";
import type { ClinicalTrialsSearchResult } from "@/lib/clinical-trials";

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  RECRUITING: { bg: "bg-green-50 dark:bg-green-950/20", text: "text-green-700 dark:text-green-400", label: "Recruiting" },
  NOT_YET_RECRUITING: { bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-400", label: "Not Yet Recruiting" },
  ENROLLING_BY_INVITATION: { bg: "bg-yellow-50 dark:bg-yellow-950/20", text: "text-yellow-700 dark:text-yellow-400", label: "Enrolling by Invitation" },
  ACTIVE_NOT_RECRUITING: { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-700 dark:text-purple-400", label: "Active (Not Recruiting)" },
  COMPLETED: { bg: "bg-gray-50 dark:bg-gray-950/20", text: "text-gray-700 dark:text-gray-400", label: "Completed" },
  TERMINATED: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-400", label: "Terminated" },
  WITHDRAWN: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-400", label: "Withdrawn" },
};

function getStatusColor(status: string) {
  return statusColors[status] || { bg: "bg-gray-50 dark:bg-gray-950/20", text: "text-gray-700 dark:text-gray-400", label: status };
}

export function ClinicalTrialsCard({ data }: { data: ClinicalTrialsSearchResult | null }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No clinical trials data available</p>
      </div>
    );
  }

  const recruitingCount = data.studies.filter(s => s.status === "RECRUITING").length;
  const completedCount = data.studies.filter(s => s.status === "COMPLETED").length;

  return (
    <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Clinical Trials
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {data.totalStudies} studies found
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Microscope className="h-3 w-3" />
          {recruitingCount} recruiting
        </Badge>
      </div>

      {recruitingCount > 0 && (
        <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20">
          <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            {recruitingCount} actively recruiting
          </div>
        </div>
      )}

      {data.studies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Latest Studies</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.studies.slice(0, 5).map((trial) => {
              const statusInfo = getStatusColor(trial.status);
              return (
                <div
                  key={trial.id}
                  className={`rounded-md border p-2.5 text-xs ${statusInfo.bg} border-[hsl(var(--border))]`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-[hsl(var(--foreground))] line-clamp-2">{trial.title}</p>
                    <a
                      href={trial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[hsl(var(--primary))] hover:underline"
                      aria-label="View on ClinicalTrials.gov"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={`text-xs h-5 ${statusInfo.text}`} variant="secondary">
                      {statusInfo.label}
                    </Badge>
                    {trial.phase && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {trial.phase}
                      </Badge>
                    )}
                    {trial.enrollment && (
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {trial.enrollment.toLocaleString()} enrolled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completedCount > 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {completedCount} completed studies available for results review
        </p>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Source: ClinicalTrials.gov • Updated {new Date(data.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}
