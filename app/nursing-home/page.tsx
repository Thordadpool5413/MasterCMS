"use client";

import { Fragment, useState } from "react";
import { Search } from "lucide-react";
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
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Records", value: formatNumber(result.rows.length) },
              { label: "Total Matched", value: formatNumber(result.total_records) },
              { label: "Top Score", value: formatNumber(result.rows[0]?._snf_opportunity_score ?? 0) },
              { label: "Total Beds", value: formatNumber(result.rows.reduce((s, r) => s + (Number(r["number_of_certified_beds"]) || 0), 0)) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead className="text-right">Beds</TableHead>
                  <TableHead className="text-right">Residents</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Health Insp.</TableHead>
                  <TableHead>Staffing</TableHead>
                  <TableHead>RN Staff</TableHead>
                  <TableHead>QM</TableHead>
                  <TableHead>Quality Pressure</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => {
                  const isExpanded = expanded === String(row["provider_name"]);
                  return (
                    <Fragment key={i}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                        onClick={() => setExpanded(isExpanded ? null : String(row["provider_name"]))}
                      >
                        <TableCell className="font-medium max-w-[160px] truncate" title={row["provider_name"]}>{row["provider_name"] ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate" title={row["provider_address"] as string}>{row["provider_address"] ?? "—"}</TableCell>
                        <TableCell>{row["citytown"] ?? "—"}</TableCell>
                        <TableCell>{row["state"] ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row["zip_code"] ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row["telephone_number"] ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{row["ownership_type"] ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatNumber(Number(row["number_of_certified_beds"]))}</TableCell>
                        <TableCell className="text-right">{formatNumber(Number(row["average_number_of_residents_per_day"]))}</TableCell>
                        <TableCell><Stars rating={row["overall_rating"]} /></TableCell>
                        <TableCell><Stars rating={row["health_inspection_rating"]} /></TableCell>
                        <TableCell><Stars rating={row["staffing_rating"]} /></TableCell>
                        <TableCell><Stars rating={row["reported_rn_staffing_hours_per_resident_per_day"]} /></TableCell>
                        <TableCell><Stars rating={row["qm_rating"]} /></TableCell>
                        <TableCell className="text-right text-xs">{row._quality_pressure_component.toFixed(2)}</TableCell>
                        <TableCell><ScoreBadge score={row._snf_opportunity_score} /></TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={16} className="bg-[hsl(var(--muted)/0.3)] p-4">
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">CCN</p>
                                <p className="text-sm font-medium">{row["cms_certification_number_ccn"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">County</p>
                                <p className="text-sm font-medium">{row["countyparish"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Chain Name</p>
                                <p className="text-sm font-medium">{row["chain_name"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Legal Business Name</p>
                                <p className="text-sm font-medium">{row["legal_business_name"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Provider Type</p>
                                <p className="text-sm font-medium">{row["provider_type"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Certification Date</p>
                                <p className="text-sm font-medium">{row["date_first_approved_to_provide_medicare_and_medicaid_services"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Registered RN Staffing Hours/Resident/Day</p>
                                <p className="text-sm font-medium">{row["reported_rn_staffing_hours_per_resident_per_day"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">LPN Staffing Hours/Resident/Day</p>
                                <p className="text-sm font-medium">{row["reported_lpn_staffing_hours_per_resident_per_day"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Nurse Aide Staffing Hours/Resident/Day</p>
                                <p className="text-sm font-medium">{row["reported_nurse_aide_staffing_hours_per_resident_per_day"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Nursing Staff Turnover</p>
                                <p className="text-sm font-medium">{row["total_nursing_staff_turnover"] || "—"}%</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Number of Fines</p>
                                <p className="text-sm font-medium">{row["number_of_fines"] || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Total Fines</p>
                                <p className="text-sm font-medium">${row["total_amount_of_fines_in_dollars"] || "0"}</p>
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
