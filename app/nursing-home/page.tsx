"use client";

import { Fragment, useState } from "react";
import { Search, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { NursingHomeRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Stars({ rating }: { rating: unknown }) {
  const n = Number(rating);
  if (!n || isNaN(n)) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  return (
    <span title={`${n} / 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? "text-amber-400" : "text-[hsl(var(--border))]"}>★</span>
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

      {!loading && result && (
        <>
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
                  result.rows.reduce((s, r) => s + (Number(r["Number of Certified Beds"]) || 0), 0)
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
                        const beds = Number(r["Number of Certified Beds"]) || 0;
                        const residents = Number(r["Number of Residents in Certified Beds"]) || 0;
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: NursingHomeRow, i) => {
                  const providerName = String(row["Provider Name"] ?? "");
                  const isExpanded = expanded === providerName;
                  const beds = Number(row["Number of Certified Beds"]) || 0;
                  const residents = Number(row["Number of Residents in Certified Beds"]) || 0;
                  const occupancy = beds > 0 ? (residents / beds * 100) : 0;
                  return (
                    <Fragment key={i}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                        onClick={() => setExpanded(isExpanded ? null : providerName)}
                      >
                        <TableCell className="font-medium max-w-[180px] truncate">{providerName}</TableCell>
                        <TableCell className="text-sm">
                          <div>{row["City/Town"]}, {row["State"]}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">{row["ZIP Code"]}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(beds)}</TableCell>
                        <TableCell className="text-right">
                          <QualityGauge score={occupancy} max={100} />
                        </TableCell>
                        <TableCell className="text-center"><Stars rating={row["Overall Rating"]} /></TableCell>
                        <TableCell className="text-center"><Stars rating={row["Health Inspection Rating"]} /></TableCell>
                        <TableCell className="text-center">
                          <QualityGauge score={Number((row as any)["reported_rn_staffing_hours_per_resident_per_day"]) || 0} max={5} />
                        </TableCell>
                        <TableCell className="text-center"><Stars rating={row["QM Rating"]} /></TableCell>
                        <TableCell className="text-right"><ScoreBadge score={row._snf_opportunity_score} /></TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-[hsl(var(--muted)/0.3)] p-6">
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-semibold mb-4">Facility Information</h4>
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Provider ID (CCN)</p>
                                    <p className="text-sm font-medium">{String((row as any)["cms_certification_number_ccn"] ?? "—")}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                                    <p className="text-sm font-medium">{String(row["Phone Number"] ?? "—")}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Address</p>
                                    <p className="text-sm font-medium">{String(row["Provider Address"] ?? "—")}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Ownership Type</p>
                                    <p className="text-sm font-medium">{String(row["Ownership Type"] ?? "—")}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Chain Name</p>
                                    <p className="text-sm font-medium">{String((row as any)["chain_name"] ?? "—")}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">County</p>
                                    <p className="text-sm font-medium">{String((row as any)["countyparish"] ?? "—")}</p>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold mb-4">Staffing Levels</h4>
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">RN Hours/Resident/Day</p>
                                    <p className="text-sm font-medium">{Number((row as any)["reported_rn_staffing_hours_per_resident_per_day"] || 0).toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">LPN Hours/Resident/Day</p>
                                    <p className="text-sm font-medium">{Number((row as any)["reported_lpn_staffing_hours_per_resident_per_day"] || 0).toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Nurse Aide Hours/Resident/Day</p>
                                    <p className="text-sm font-medium">{Number((row as any)["reported_nurse_aide_staffing_hours_per_resident_per_day"] || 0).toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Nursing Turnover Rate</p>
                                    <p className="text-sm font-medium">{Number((row as any)["total_nursing_staff_turnover"] || 0).toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold mb-4">Compliance & Regulatory</h4>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Number of Fines</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {Number((row as any)["number_of_fines"] || 0) > 0 ? (
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                      ) : (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      )}
                                      <p className="text-sm font-medium">{String((row as any)["number_of_fines"] ?? "0")}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Fines ($)</p>
                                    <p className="text-sm font-medium">${formatNumber(Number((row as any)["total_amount_of_fines_in_dollars"] || 0))}</p>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold mb-2">Opportunity Score: <ScoreBadge score={row._snf_opportunity_score} /></h4>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                                  <p>Quality Pressure: {row._quality_pressure_component.toFixed(2)}</p>
                                  <p>This facility is ranked in the {Math.min(100, Math.round((row._snf_opportunity_score / 1000) * 100))}th percentile for hospice referral opportunity among facilities in your search.</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
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
