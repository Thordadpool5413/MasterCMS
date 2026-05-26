"use client";

import { Fragment, useState } from "react";
import { Search, CheckCircle2, Building, ChevronDown, ChevronRight, Phone, MapPin, Users, ShieldCheck, ShieldAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { TrustBadge } from "@/components/shared/trust-badge";
import { DataFreshnessIndicator } from "@/components/shared/data-freshness-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { NursingHomeRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ComparisonButton } from "@/components/shared/comparison-button";

function Stars({ rating, size = "sm" }: { rating: unknown; size?: "sm" | "lg" }) {
  const n = Number(rating);
  if (!n || isNaN(n)) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  const starClass = size === "lg" ? "text-xl" : "text-sm";
  return (
    <span title={`${n} / 5 stars`} className="inline-flex">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`${starClass} ${i < n ? "text-amber-400" : "text-[hsl(var(--border))]"}`}>★</span>
      ))}
    </span>
  );
}

function QualityGauge({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-[hsl(var(--border))] overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium">{score.toFixed(0)}</span>
    </div>
  );
}

function StaffingBar({ value, max, benchmark, label }: { value: number; max: number; benchmark?: number; label: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const isGood = benchmark ? value >= benchmark : pct >= 50;
  const barColor = isGood ? "bg-green-500" : pct >= 30 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
        <span className={`text-xs font-semibold ${isGood ? "text-green-600" : "text-amber-600"}`}>{value.toFixed(2)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-[hsl(var(--border))] overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        {benchmark && (
          <div className="absolute top-0 h-full w-px bg-blue-400 opacity-70" style={{ left: `${Math.min((benchmark / max) * 100, 100)}%` }} />
        )}
      </div>
      {benchmark && <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">CMS benchmark: {benchmark}</div>}
    </div>
  );
}

function RatingCard({ label, rating, icon: Icon }: { label: string; rating: unknown; icon?: React.ComponentType<{ className?: string }> }) {
  const n = Number(rating);
  const color = n >= 4 ? "border-green-200 bg-green-50 dark:bg-green-950/20" : n >= 3 ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20" : n >= 1 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30";
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />}
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      </div>
      <Stars rating={rating} size="lg" />
      {n > 0 && <div className="text-xs font-medium mt-0.5">{n} / 5</div>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 200 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

export default function NursingHomePage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: NursingHomeRow[]; total_records: number; interpretation_note: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("nursing_home_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      }) as { rows: NursingHomeRow[]; total_records: number; interpretation_note: string };
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Nursing Home Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          CMS-rated SNFs scored by hospice referral opportunity
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} />
        <Input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} className="w-48" />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching nursing home data…" />}

      {!loading && !result && !error && (
        <EmptyState
          icon={Building}
          title="Search nursing homes"
          description="Select a state to find SNFs ranked by hospice referral opportunity. CMS star ratings, bed counts, and staffing data included."
        />
      )}

      {!loading && result && result.rows.length === 0 && (
        <EmptyState
          icon={Building}
          title="No facilities found"
          description="No nursing homes matched that search. Try a different state or remove the city filter."
        />
      )}

      {!loading && result && result.rows.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
            <DataSourceBadge source="CMS Nursing Home Compare" verified={true} />
            <DataFreshnessIndicator lastUpdated={new Date()} />
            <TrustBadge level="high" description="Data from CMS Care Compare with quality metrics" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              {
                label: "Facilities",
                value: formatNumber(result.rows.length),
                subtext: `of ${formatNumber(result.total_records)} total`
              },
              {
                label: "Total Beds",
                value: formatNumber(
                  result.rows.reduce((s, r) => s + (Number(r.number_of_certified_beds) || 0), 0)
                ),
              },
              {
                label: "Avg Quality Score",
                value: (
                  result.rows.length > 0
                    ? (result.rows.reduce((s, r) => s + r._snf_opportunity_score, 0) /
                        result.rows.length).toFixed(0)
                    : "—"
                ),
              },
              {
                label: "Top Opportunity",
                value: formatNumber(result.rows[0]?._snf_opportunity_score ?? 0),
                badge: true
              },
              {
                label: "Avg Occupancy",
                value: result.rows.length > 0
                  ? `${(
                      result.rows.reduce((s, r) => {
                        const beds = Number(r.number_of_certified_beds) || 0;
                        const residents = Number(r.average_number_of_residents_per_day) || 0;
                        return s + (beds > 0 ? residents / beds : 0);
                      }, 0) / result.rows.length * 100
                    ).toFixed(0)}%`
                  : "—",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
                {s.subtext && <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.subtext}</p>}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility Name</TableHead>
                  <TableHead>City, State</TableHead>
                  <TableHead className="text-right">Beds</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead>Overall Rating</TableHead>
                  <TableHead>Health Inspection</TableHead>
                  <TableHead>RN Staffing</TableHead>
                  <TableHead>Quality Measures</TableHead>
                  <TableHead className="text-right">Opportunity Score</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: NursingHomeRow, i) => {
                  const providerName = String(row.provider_name ?? "");
                  const isExpanded = expanded === providerName;
                  const beds = Number(row.number_of_certified_beds) || 0;
                  const residents = Number(row.average_number_of_residents_per_day) || 0;
                  const occupancy = beds > 0 ? (residents / beds * 100) : 0;
                  return (
                    <Fragment key={i}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                        onClick={() => setExpanded(isExpanded ? null : providerName)}
                      >
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />}
                            <span className="truncate">{providerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{row.citytown}, {row.state}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">{row.zip_code}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(beds)}</TableCell>
                        <TableCell className="text-right">
                          <QualityGauge score={occupancy} max={100} />
                        </TableCell>
                        <TableCell className="text-center"><Stars rating={row.overall_rating} /></TableCell>
                        <TableCell className="text-center"><Stars rating={row.health_inspection_rating} /></TableCell>
                        <TableCell className="text-center">
                          <QualityGauge score={Number((row as Record<string, unknown>)["reported_rn_staffing_hours_per_resident_per_day"]) || 0} max={5} />
                        </TableCell>
                        <TableCell className="text-center"><Stars rating={row.qm_rating} /></TableCell>
                        <TableCell className="text-right"><ScoreBadge score={row._snf_opportunity_score} /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <ComparisonButton item={{
                            id: String(row.provider_name ?? i),
                            name: String(row.provider_name ?? "Unknown"),
                            type: "nursing_home",
                            data: {
                              city: String(row.citytown ?? ""),
                              state: String(row.state ?? ""),
                              beds: Number(row.number_of_certified_beds ?? 0),
                              overall_rating: Number(row.overall_rating ?? 0),
                              staffing_rating: Number(row.staffing_rating ?? 0),
                              qm_rating: Number(row.qm_rating ?? 0),
                              opportunity_score: row._snf_opportunity_score,
                            }
                          }} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (() => {
                        const r = row as Record<string, unknown>;
                        const fines = Number(r["number_of_fines"] || 0);
                        const fineAmount = Number(r["total_amount_of_fines_in_dollars"] || 0);
                        const rnHours = Number(r["reported_rn_staffing_hours_per_resident_per_day"] || 0);
                        const lpnHours = Number(r["reported_lpn_staffing_hours_per_resident_per_day"] || 0);
                        const naHours = Number(r["reported_nurse_aide_staffing_hours_per_resident_per_day"] || 0);
                        const turnover = Number(r["total_nursing_staff_turnover"] || 0);
                        const hasFines = fines > 0;
                        return (
                          <TableRow>
                            <TableCell colSpan={10} className="p-0 border-b-2 border-[hsl(var(--border))]">
                              <div className="bg-[hsl(var(--muted))]/20 px-6 py-5 space-y-5">

                                {/* Header strip */}
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                  <div>
                                    <h3 className="font-semibold text-base">{providerName}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{String(row.provider_address ?? "")} · {row.citytown}, {row.state} {row.zip_code}</span>
                                      {row.telephone_number && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{String(row.telephone_number)}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-[hsl(var(--muted-foreground))]">
                                      <span>CCN: <strong className="text-[hsl(var(--foreground))]">{String(row.cms_certification_number_ccn ?? "—")}</strong></span>
                                      {row.ownership_type && <><span>·</span><span>{String(row.ownership_type)}</span></>}
                                      {!!r["chain_name"] && <><span>·</span><span>{String(r["chain_name"])}</span></>}
                                      {!!r["countyparish"] && <><span>·</span><span>{String(r["countyparish"])} County</span></>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ScoreBadge score={row._snf_opportunity_score} />
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">opportunity score</span>
                                  </div>
                                </div>

                                {/* Compliance alert */}
                                {hasFines && (
                                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3">
                                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">{fines} Regulatory Fine{fines !== 1 ? "s" : ""}</p>
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Total: ${formatNumber(fineAmount)} — Compliance history may affect referral relationships</p>
                                    </div>
                                  </div>
                                )}
                                {!hasFines && (
                                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-4 py-2.5">
                                    <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                                    <p className="text-xs font-medium text-green-700 dark:text-green-400">No recent regulatory fines — clean compliance record</p>
                                  </div>
                                )}

                                {/* Ratings row */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">CMS Quality Ratings</h4>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <RatingCard label="Overall" rating={row.overall_rating} icon={TrendingUp} />
                                    <RatingCard label="Health Inspection" rating={row.health_inspection_rating} icon={ShieldCheck} />
                                    <RatingCard label="Staffing" rating={row.staffing_rating} icon={Users} />
                                    <RatingCard label="Quality Measures" rating={row.qm_rating} icon={CheckCircle2} />
                                  </div>
                                </div>

                                {/* Staffing + occupancy */}
                                <div className="grid gap-5 md:grid-cols-2">
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">Staffing Hours per Resident / Day</h4>
                                    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                                      <StaffingBar value={rnHours} max={3} benchmark={0.4} label="Registered Nurse (RN)" />
                                      <StaffingBar value={lpnHours} max={3} benchmark={0.7} label="Licensed Practical Nurse (LPN)" />
                                      <StaffingBar value={naHours} max={4} benchmark={2.2} label="Certified Nurse Aide (CNA)" />
                                      <div className="pt-2 border-t border-[hsl(var(--border))]">
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Nursing Staff Turnover</span>
                                          <span className={`text-xs font-semibold ${turnover > 50 ? "text-red-500" : turnover > 30 ? "text-yellow-500" : "text-green-600"}`}>{turnover.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">Capacity & Occupancy</h4>
                                      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 grid grid-cols-3 gap-4 text-center">
                                        <div>
                                          <p className="text-lg font-bold">{formatNumber(beds)}</p>
                                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide mt-0.5">Certified Beds</p>
                                        </div>
                                        <div>
                                          <p className="text-lg font-bold">{formatNumber(residents)}</p>
                                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide mt-0.5">Avg Daily Residents</p>
                                        </div>
                                        <div>
                                          <p className={`text-lg font-bold ${occupancy >= 80 ? "text-green-600" : occupancy >= 60 ? "text-yellow-500" : "text-red-500"}`}>{occupancy.toFixed(0)}%</p>
                                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide mt-0.5">Occupancy</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">Opportunity Breakdown</h4>
                                      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Total Opportunity Score</span>
                                          <ScoreBadge score={row._snf_opportunity_score} />
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Quality Pressure Component</span>
                                          <span className="text-xs font-semibold">{row._quality_pressure_component.toFixed(2)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-[hsl(var(--border))] overflow-hidden mt-2">
                                          <div
                                            className={`h-full rounded-full ${row._snf_opportunity_score > 500 ? "bg-green-500" : row._snf_opportunity_score > 200 ? "bg-yellow-500" : "bg-slate-400"}`}
                                            style={{ width: `${Math.min((row._snf_opportunity_score / 1000) * 100, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Alert className="mt-4">
            <AlertDescription>{result.interpretation_note}</AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
