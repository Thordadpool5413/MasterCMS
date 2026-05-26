"use client";

import { Fragment, useState, useEffect } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { TrustBadge } from "@/components/shared/trust-badge";
import { DataFreshnessIndicator } from "@/components/shared/data-freshness-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HospitalRow, HospiceRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── Formatters ───────────────────────────────────────────────────────────────

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

// ─── Grouped hospital type ────────────────────────────────────────────────────

interface HospitalGroup {
  name: string;
  city: string;
  state: string;
  zip: string;
  ccn: string;
  totalDischarges: number;
  totalOpportunityScore: number;
  weightedPayment: number;
  allMatches: string[];
  drgs: HospitalRow[];
}

function groupHospitals(rows: HospitalRow[]): HospitalGroup[] {
  const map = new Map<string, HospitalGroup>();
  for (const row of rows) {
    const key = `${row.Rndrng_Prvdr_Org_Name ?? ""}|${row.Rndrng_Prvdr_City ?? ""}|${row.Rndrng_Prvdr_State_Abrvtn ?? ""}`;
    if (!map.has(key)) {
      map.set(key, {
        name: row.Rndrng_Prvdr_Org_Name ?? "—",
        city: row.Rndrng_Prvdr_City ?? "",
        state: row.Rndrng_Prvdr_State_Abrvtn ?? "",
        zip: row.Rndrng_Prvdr_Zip_Cd ?? "",
        ccn: row.Rndrng_Prvdr_CCN ?? "",
        totalDischarges: 0,
        totalOpportunityScore: 0,
        weightedPayment: 0,
        allMatches: [],
        drgs: [],
      });
    }
    const g = map.get(key)!;
    const discharges = Number(row.Tot_Dschrgs ?? 0);
    const payment = parseFloat(String(row.Avg_Mdcr_Pymt_Amt ?? "0").replace(/,/g, "")) || 0;
    g.totalDischarges += discharges;
    g.totalOpportunityScore += row._opportunity_score;
    g.weightedPayment += payment * discharges;
    for (const t of row._matched_hospice_terms) {
      if (!g.allMatches.includes(t)) g.allMatches.push(t);
    }
    g.drgs.push(row);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, weightedPayment: g.totalDischarges > 0 ? g.weightedPayment / g.totalDischarges : 0 }))
    .sort((a, b) => b.totalOpportunityScore - a.totalOpportunityScore);
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function HospitalDetail({ group, onClose }: { group: HospitalGroup; onClose: () => void }) {
  const [hospices, setHospices] = useState<HospiceRow[]>([]);
  const [loadingHospices, setLoadingHospices] = useState(true);

  useEffect(() => {
    if (!group.state) { setLoadingHospices(false); return; }
    (async () => {
      try {
        const data = (await mcp("hospice_market_share_proxy", { state: group.state, max_rows: 100 })) as { rows: HospiceRow[] };
        setHospices(data.rows);
      } catch { setHospices([]); }
      finally { setLoadingHospices(false); }
    })();
  }, [group.state]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-[hsl(var(--background))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Hospital detail"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Hospital</p>
            <h2 className="text-xl font-semibold">{group.name}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {[group.city, group.state, group.zip].filter(Boolean).join(", ")}
              {group.ccn && <span className="ml-2 font-mono text-xs">CCN {group.ccn}</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Discharges</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(group.totalDischarges)}</p>
          </div>
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Opportunity Score</p>
            <p className="mt-1 text-lg font-semibold"><ScoreBadge score={group.totalOpportunityScore} /></p>
          </div>
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Medicare Payment</p>
            <p className="mt-1 text-lg font-semibold">{currency(group.weightedPayment)}</p>
          </div>
        </div>

        {/* Hospice matches */}
        {group.allMatches.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Hospice-Relevant DRGs</p>
            <div className="flex flex-wrap gap-1.5">
              {group.allMatches.map((m) => (
                <Badge key={m} variant="success" className="text-xs">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* DRG breakdown */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            DRG Breakdown ({group.drgs.length} codes)
          </p>
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DRG</TableHead>
                  <TableHead className="text-right">Discharges</TableHead>
                  <TableHead className="text-right">Avg Medicare $</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.drgs
                  .sort((a, b) => b._opportunity_score - a._opportunity_score)
                  .map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{row.DRG_Cd}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] max-w-[220px] leading-tight">{row.DRG_Desc}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(Number(row.Tot_Dschrgs))}</TableCell>
                      <TableCell className="text-right">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                      <TableCell className="text-right"><ScoreBadge score={row._opportunity_score} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Related hospice providers */}
        {group.state && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Top Hospice Providers in {group.state}
            </p>
            {loadingHospices ? (
              <LoadingSpinner label="Loading hospice providers…" />
            ) : hospices.length > 0 ? (
              <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hospice Provider</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">CAHPS</TableHead>
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HospitalOpportunityPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: HospitalRow[]; total_records: number; interpretation_note: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<HospitalGroup | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExpanded(new Set());
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

  const groups = result ? groupHospitals(result.rows) : [];

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
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
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
            <DataSourceBadge source="CMS Hospital Claims" verified={true} />
            <DataFreshnessIndicator lastUpdated={new Date()} />
            <TrustBadge level="high" description="Medicare inpatient discharge data from CMS" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Hospitals", value: formatNumber(groups.length), context: `${formatNumber(result.rows.length)} DRG rows` },
              { label: "Total Discharges", value: formatNumber(groups.reduce((s, g) => s + g.totalDischarges, 0)) },
              { label: "Avg Opportunity Score", value: groups.length > 0 ? formatNumber(Math.round(groups.reduce((s, g) => s + g.totalOpportunityScore, 0) / groups.length)) : "—" },
              { label: "Top Score", value: formatNumber(groups[0]?.totalOpportunityScore ?? 0) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
                {s.context && <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.context}</p>}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Discharges</TableHead>
                  <TableHead className="text-right">DRGs</TableHead>
                  <TableHead className="text-right">Avg Medicare $</TableHead>
                  <TableHead>Top Hospice Matches</TableHead>
                  <TableHead className="text-right">Opportunity Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const key = `${group.name}|${group.city}|${group.state}`;
                  const isOpen = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                        onClick={() => toggleExpand(key)}
                      >
                        <TableCell className="px-3">
                          {isOpen
                            ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
                        </TableCell>
                        <TableCell
                          className="font-medium max-w-[200px] truncate"
                          title={group.name}
                          onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                        >
                          <span className="hover:text-[hsl(var(--primary))] hover:underline cursor-pointer">
                            {group.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{group.city}, {group.state}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">{group.zip}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(group.totalDischarges)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-xs font-mono">{group.drgs.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{currency(group.weightedPayment)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {group.allMatches.slice(0, 2).map((m) => (
                              <Badge key={m} variant="success" className="text-xs">{m}</Badge>
                            ))}
                            {group.allMatches.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{group.allMatches.length - 2}</Badge>
                            )}
                            {group.allMatches.length === 0 && (
                              <Badge variant="secondary" className="text-xs">None</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right"><ScoreBadge score={group.totalOpportunityScore} /></TableCell>
                      </TableRow>

                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-[hsl(var(--muted))]/20">
                            <div className="px-4 py-3">
                              <p className="mb-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                                DRG Breakdown
                              </p>
                              <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--background))]">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>DRG Code</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="text-right">Discharges</TableHead>
                                      <TableHead className="text-right">Avg Medicare $</TableHead>
                                      <TableHead className="text-right">Score</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.drgs
                                      .sort((a, b) => b._opportunity_score - a._opportunity_score)
                                      .map((row, i) => (
                                        <TableRow key={i} className="text-sm">
                                          <TableCell className="font-mono font-medium">{row.DRG_Cd}</TableCell>
                                          <TableCell className="text-xs text-[hsl(var(--muted-foreground))] max-w-[240px]">{row.DRG_Desc}</TableCell>
                                          <TableCell className="text-right">{formatNumber(Number(row.Tot_Dschrgs))}</TableCell>
                                          <TableCell className="text-right">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                                          <TableCell className="text-right"><ScoreBadge score={row._opportunity_score} /></TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </td>
                        </tr>
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

      {selectedGroup && <HospitalDetail group={selectedGroup} onClose={() => setSelectedGroup(null)} />}
    </div>
  );
}
