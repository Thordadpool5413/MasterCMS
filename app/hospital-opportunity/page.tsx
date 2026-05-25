"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HospitalRow, HospiceRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

function QualityMetric({ label, value, context }: { label: string; value: number | string; context?: string }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {context && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{context}</p>}
    </div>
  );
}

function HospitalDetail({ row, onClose }: { row: HospitalRow; onClose: () => void }) {
  const [hospices, setHospices] = useState<HospiceRow[]>([]);
  const [loadingHospices, setLoadingHospices] = useState(true);

  useEffect(() => {
    if (!row.Rndrng_Prvdr_State_Abrvtn) {
      setLoadingHospices(false);
      return;
    }
    (async () => {
      try {
        const data = (await mcp("hospice_market_share_proxy", {
          state: row.Rndrng_Prvdr_State_Abrvtn,
          max_rows: 100,
        })) as { rows: HospiceRow[] };
        setHospices(data.rows);
      } catch {
        setHospices([]);
      } finally {
        setLoadingHospices(false);
      }
    })();
  }, [row.Rndrng_Prvdr_State_Abrvtn]);

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Hospital Name", value: row.Rndrng_Prvdr_Org_Name || "—" },
    { label: "CCN", value: row.Rndrng_Prvdr_CCN || "—" },
    { label: "Address", value: [row.Rndrng_Prvdr_City, row.Rndrng_Prvdr_State_Abrvtn, row.Rndrng_Prvdr_Zip_Cd].filter(Boolean).join(", ") || "—" },
    { label: "DRG Code", value: row.DRG_Cd || "—" },
    { label: "DRG Description", value: row.DRG_Desc || "—" },
    { label: "Total Discharges", value: formatNumber(Number(row.Tot_Dschrgs)) },
    { label: "Avg Submitted Charge", value: currency(row.Avg_Submtd_Cvrd_Chrg) },
    { label: "Avg Total Payment", value: currency(row.Avg_Tot_Pymt_Amt) },
    { label: "Avg Medicare Payment", value: currency(row.Avg_Mdcr_Pymt_Amt) },
    { label: "Hospice Match", value: row._matched_hospice_terms.length > 0 ? row._matched_hospice_terms.join(", ") : "None" },
    { label: "Opportunity Score", value: <ScoreBadge score={row._opportunity_score} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-[hsl(var(--background))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Hospital detail"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Hospital</p>
            <h2 className="text-xl font-semibold">{row.Rndrng_Prvdr_Org_Name || "—"}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Hospital Details</h3>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {details.map((d) => (
                <div key={d.label} className="rounded-md border border-[hsl(var(--border))] p-3">
                  <dt className="text-xs text-[hsl(var(--muted-foreground))]">{d.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {row.Rndrng_Prvdr_State_Abrvtn && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Related Hospice Providers in {row.Rndrng_Prvdr_State_Abrvtn}</h3>
              {loadingHospices ? (
                <LoadingSpinner label="Loading hospice providers…" />
              ) : hospices.length > 0 ? (
                <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hospice Provider</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">CAHPS Stars</TableHead>
                        <TableHead className="text-right">Market Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hospices.slice(0, 10).map((h) => (
                        <TableRow key={h._provider_id}>
                          <TableCell className="font-medium max-w-[180px] truncate">{h._provider_name}</TableCell>
                          <TableCell>{h._city}</TableCell>
                          <TableCell className="text-right">{h.star_rating ? `${h.star_rating}/5` : "—"}</TableCell>
                          <TableCell className="text-right">{h._market_share_pct.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hospice providers found in this state.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HospitalOpportunityPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: HospitalRow[]; total_records: number; interpretation_note: string } | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRow | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("hospital_hospice_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      }) as { rows: HospitalRow[]; total_records: number; interpretation_note: string };
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
        <h1 className="text-2xl font-bold tracking-tight">Hospital Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare inpatient discharges scored by hospice referral opportunity
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
      {loading && <LoadingSpinner label="Fetching hospital data…" />}

      {!loading && result && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Hospitals",
                value: formatNumber(result.rows.length),
                context: `of ${formatNumber(result.total_records)} total`
              },
              {
                label: "Total Discharges",
                value: formatNumber(
                  result.rows.reduce((sum, r) => sum + Number(r.Tot_Dschrgs || 0), 0)
                ),
              },
              {
                label: "Avg Opportunity Score",
                value: result.rows.length > 0
                  ? formatNumber(
                      result.rows.reduce((sum, r) => sum + r._opportunity_score, 0) /
                        result.rows.length
                    )
                  : "—",
              },
              {
                label: "Top Score",
                value: formatNumber(result.rows[0]?._opportunity_score ?? 0),
              },
            ].map((s) => (
              <QualityMetric key={s.label} label={s.label} value={s.value} context={s.context} />
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Discharges</TableHead>
                  <TableHead>DRG</TableHead>
                  <TableHead className="text-right">Avg Medicare Payment</TableHead>
                  <TableHead>Hospice Match</TableHead>
                  <TableHead className="text-right">Opportunity Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                    onClick={() => setSelectedHospital(row)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate" title={row.Rndrng_Prvdr_Org_Name}>
                      {row.Rndrng_Prvdr_Org_Name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{row.Rndrng_Prvdr_City}, {row.Rndrng_Prvdr_State_Abrvtn}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{row.Rndrng_Prvdr_Zip_Cd}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row.Tot_Dschrgs))}</TableCell>
                    <TableCell className="text-sm">
                      <div>{row.DRG_Cd}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] max-w-[180px]">{row.DRG_Desc}</div>
                    </TableCell>
                    <TableCell className="text-right">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell>
                      {row._matched_hospice_terms.length > 0 ? (
                        <Badge variant="success" className="text-xs">{row._matched_hospice_terms[0]}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">None</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right"><ScoreBadge score={row._opportunity_score} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Alert className="mt-4">
            <AlertDescription>{result.interpretation_note}</AlertDescription>
          </Alert>
        </>
      )}

      {selectedHospital && <HospitalDetail row={selectedHospital} onClose={() => setSelectedHospital(null)} />}
    </div>
  );
}
