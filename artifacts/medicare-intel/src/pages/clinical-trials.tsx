import { useState } from "react";
import { Search, FlaskConical, ExternalLink, MapPin, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { StateSelect } from "@/components/shared/state-select";
import { mcp } from "@/lib/api";
import type { ClinicalTrial } from "@/lib/cms-direct";
import { cn } from "@/lib/utils";

const CONDITION_PRESETS = ["Cancer", "COPD", "Heart Failure", "Dementia", "ALS", "Parkinson's Disease", "Kidney Disease", "Stroke", "Liver Disease", "Hospice"];

const STATUS_OPTIONS = [
  { value: "RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING", label: "Active" },
  { value: "RECRUITING", label: "Recruiting Only" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_COLORS: Record<string, string> = {
  RECRUITING: "success",
  "ACTIVE NOT RECRUITING": "warning",
  "NOT YET RECRUITING": "secondary",
  COMPLETED: "secondary",
};

function TrialCard({ trial }: { trial: ClinicalTrial }) {
  const statusVariant = (STATUS_COLORS[trial.status] ?? "secondary") as "success" | "warning" | "secondary" | "default";
  const primaryLocation = trial.locations[0];

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary)/0.3)] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant}>{trial.status}</Badge>
          {trial.phase !== "N/A" && <Badge variant="secondary">{trial.phase}</Badge>}
        </div>
        <a
          href={trial.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
        >
          {trial.nct_id}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <h3 className="text-sm font-medium leading-snug mb-2 line-clamp-2">{trial.title}</h3>

      {trial.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {trial.conditions.slice(0, 4).map((c) => (
            <span key={c} className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">{c}</span>
          ))}
          {trial.conditions.length > 4 && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">+{trial.conditions.length - 4} more</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
        {trial.sponsor && (
          <div className="col-span-2 truncate" title={trial.sponsor}>
            <span className="font-medium text-[hsl(var(--foreground))]">Sponsor: </span>{trial.sponsor}
          </div>
        )}
        {primaryLocation && (
          <div className="flex items-center gap-1 col-span-2 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span title={primaryLocation.facility}>
              {[primaryLocation.facility, primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")}
            </span>
            {trial.locations.length > 1 && <span>+{trial.locations.length - 1} sites</span>}
          </div>
        )}
        {trial.enrollment != null && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" />
            {trial.enrollment.toLocaleString()} enrolled
          </div>
        )}
        {trial.start_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            Started {trial.start_date}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClinicalTrialsPage() {
  const [condition, setCondition] = useState("");
  const [state, setState] = useState("");
  const [status, setStatus] = useState(STATUS_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ trials: ClinicalTrial[]; total: number } | null>(null);

  async function handleSearch(cond = condition) {
    if (!cond.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("search_clinical_trials", {
        condition: cond.trim(),
        ...(state ? { state } : {}),
        status,
        max_results: 50,
      })) as { trials: ClinicalTrial[]; total: number };
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        icon={FlaskConical}
        title="Clinical Trials"
        description="Active Medicare-relevant trials from ClinicalTrials.gov — identify hospitals with high-acuity patient populations."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Condition</label>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Heart Failure, Cancer, COPD" className="flex-1" />
            <Button type="submit" disabled={loading || !condition.trim()}>
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
          </form>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">State</label>
          <StateSelect value={state} onChange={setState} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Status</label>
          <div className="flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  status === opt.value ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CONDITION_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => { setCondition(c); handleSearch(c); }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              condition === c
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.4)] hover:text-[hsl(var(--primary))]",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Querying ClinicalTrials.gov…" />}
      {error && <ErrorBanner message={error} />}

      {results && !loading && (
        <>
          <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
            {results.total.toLocaleString()} trials found · Source: ClinicalTrials.gov
          </p>
          {results.trials.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No trials found" description="Try a different condition, remove the state filter, or change the status filter." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.trials.map((trial) => (
                <TrialCard key={trial.nct_id} trial={trial} />
              ))}
            </div>
          )}
        </>
      )}

      {!results && !loading && (
        <EmptyState
          icon={FlaskConical}
          title="Find high-acuity referral hospitals"
          description="Hospitals running trials for cancer, heart failure, COPD, or dementia have complex patients with high hospice eligibility. Select a condition above to start."
        />
      )}
    </div>
  );
}
