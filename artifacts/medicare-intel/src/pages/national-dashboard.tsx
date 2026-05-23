import { useEffect, useState } from "react";
import { LayoutDashboard, Building2, HeartPulse, TrendingUp, RefreshCw, Users, DollarSign, Info } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateSelect } from "@/components/shared/state-select";
import { mcp } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StateDemographics } from "@/lib/cms-direct";

type HospitalRow = {
  Rndrng_Prvdr_CCN?: string;
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  _opportunity_score: number;
  _matched_hospice_terms: string[];
  _opportunity_reason: string;
  [key: string]: unknown;
};

type HospiceRow = {
  _provider_name: string;
  _market: string;
  _market_share_pct: number;
  _rank: number;
  [key: string]: unknown;
};

type HospiceResult = { rows: HospiceRow[]; total_volume: number; interpretation_note: string };
type HospitalResult = { rows: HospitalRow[]; total_records: number; interpretation_note: string };

function DemographicsStrip({ state }: { state: string }) {
  const [data, setData] = useState<StateDemographics | null>(null);
  const [loading, setLoading] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!state) return;
    setData(null);
    setLoading(true);
    setNoKey(false);
    mcp("get_census_demographics", { state })
      .then((d) => {
        if (d === null) setNoKey(true);
        else setData(d as StateDemographics);
      })
      .catch(() => setNoKey(true))
      .finally(() => setLoading(false));
  }, [state]);

  if (!state) return null;

  if (loading) return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading demographics…</p>
    </div>
  );

  if (noKey || !data) return (
    <div className="mb-6 rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-3 flex items-center gap-2">
      <Info className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Add <code className="font-mono">CENSUS_API_KEY</code> to show state demographics (free at census.gov/developers).
      </p>
    </div>
  );

  return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {data.state_name} Demographics · 2022 ACS 5-Year
      </p>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Population</span>
          <span className="text-sm font-semibold">
            {new Intl.NumberFormat("en-US", { notation: "compact" }).format(data.total_population)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Age 65+</span>
          <span className="text-sm font-semibold">
            {new Intl.NumberFormat("en-US", { notation: "compact" }).format(data.population_65_plus)}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">({data.pct_65_plus.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Median Income</span>
          <span className="text-sm font-semibold">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.median_household_income)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function NationalDashboardPage() {
  const [state, setState] = useState("");
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingHospice, setLoadingHospice] = useState(false);
  const [hospitals, setHospitals] = useState<HospitalResult | null>(null);
  const [hospice, setHospice] = useState<HospiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData(stateFilter: string) {
    setError(null);
    setLoadingHospitals(true);
    setLoadingHospice(true);

    const hospitalPromise = mcp("hospital_hospice_opportunity", {
      ...(stateFilter ? { state: stateFilter } : {}),
      max_rows: 100,
    })
      .then((d) => setHospitals(d as HospitalResult))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load hospital data"))
      .finally(() => setLoadingHospitals(false));

    const hospicePromise = mcp("hospice_market_share_proxy", {
      ...(stateFilter ? { state: stateFilter } : {}),
      max_rows: 50,
    })
      .then((d) => setHospice(d as HospiceResult))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load hospice data"))
      .finally(() => setLoadingHospice(false));

    await Promise.allSettled([hospitalPromise, hospicePromise]);
  }

  useEffect(() => {
    loadData("");
  }, []);

  const highPriorityHospitals = hospitals?.rows.filter((h) => h._opportunity_score > 500).length ?? 0;
  const topHospitals = hospitals?.rows.slice(0, 20) ?? [];
  const topHospice = hospice?.rows.slice(0, 20) ?? [];
  const isLoading = loadingHospitals || loadingHospice;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-[hsl(var(--primary))]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">National Dashboard</h1>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Hospital opportunity + hospice market overview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StateSelect value={state} onChange={setState} />
          <Button onClick={() => loadData(state)} disabled={isLoading} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      <DemographicsStrip state={state} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hospitals" value={isLoading ? "…" : (hospitals?.total_records ?? "—")} icon={Building2} />
        <StatCard label="High Priority Hospitals" value={isLoading ? "…" : highPriorityHospitals} icon={TrendingUp} />
        <StatCard label="Hospice Providers" value={isLoading ? "…" : (hospice?.rows.length ?? "—")} icon={HeartPulse} />
        <StatCard
          label="Total Hospice Volume"
          value={isLoading ? "…" : (hospice?.total_volume ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(hospice.total_volume) : "—")}
          icon={HeartPulse}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            Top Hospital Opportunities
          </h2>
          {loadingHospitals ? <LoadingSpinner /> : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topHospitals.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium max-w-40 truncate">{String(h.Rndrng_Prvdr_Org_Name ?? "—")}</TableCell>
                      <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                        {[h.Rndrng_Prvdr_City, h.Rndrng_Prvdr_State_Abrvtn].filter(Boolean).join(", ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={h._opportunity_score > 500 ? "default" : "secondary"}>
                          {Math.round(h._opportunity_score)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!topHospitals.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-8">
                        No data — click Refresh to load
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-[hsl(var(--primary))]" />
            Top Hospice Providers by Market Share
          </h2>
          {loadingHospice ? <LoadingSpinner /> : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topHospice.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium max-w-40 truncate">{h._provider_name}</TableCell>
                      <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">{h._market}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-[hsl(var(--border))]">
                            <div className="h-1.5 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(h._market_share_pct * 3, 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium">{h._market_share_pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!topHospice.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-8">
                        No data — click Refresh to load
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
