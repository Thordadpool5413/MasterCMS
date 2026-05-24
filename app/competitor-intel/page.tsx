"use client";

import { Fragment, useState, useEffect } from "react";
import {
  Search, Building, ChevronDown, ChevronUp, ExternalLink, FileText, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { StateSelect } from "@/components/shared/state-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mcp } from "@/lib/api";
import type { NonprofitOrg, NonprofitFiling, NonprofitDetail } from "@/lib/cms-direct";

// ─── Formatters ───────────────────────────────────────────────────────────────

const usd = (v: number) =>
  v
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v)
    : "—";

const pct = (num: number, denom: number) =>
  denom ? ((num / denom) * 100).toFixed(1) + "%" : "—";

// ─── Suggested searches ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  "VITAS",
  "Amedisys",
  "Enhabit",
  "Crossroads Hospice",
  "Agrace",
  "Seasons Hospice",
  "LHC Group",
  "Addus Homecare",
];

// ─── Margin indicator ─────────────────────────────────────────────────────────

function Margin({ revenue, expenses }: { revenue: number; expenses: number }) {
  if (!revenue || !expenses) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  const m = ((revenue - expenses) / revenue) * 100;
  const positive = m >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(m).toFixed(1)}%
    </span>
  );
}

// ─── Revenue sparkline (CSS only) ────────────────────────────────────────────

function RevSparkline({ filings }: { filings: NonprofitFiling[] }) {
  const sorted = [...filings].sort((a, b) => a.tax_prd_yr.localeCompare(b.tax_prd_yr)).slice(-5);
  if (sorted.length < 2) return null;
  const max = Math.max(...sorted.map((f) => f.totrevenue));
  if (!max) return null;
  return (
    <div className="flex items-end gap-0.5 h-6">
      {sorted.map((f) => (
        <div
          key={f.tax_prd_yr}
          className="w-2 rounded-t bg-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--primary))] transition-colors"
          style={{ height: `${Math.max(4, (f.totrevenue / max) * 24)}px` }}
          title={`${f.tax_prd_yr}: ${usd(f.totrevenue)}`}
        />
      ))}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ ein }: { ein: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NonprofitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await mcp("get_nonprofit_detail", { ein })) as NonprofitDetail;
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load filing data";
      if (!msg.includes("404") && !msg.includes("not found")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  // Auto-load on mount
  useEffect(() => { load(); }, [loaded]);

  if (loading) return <div className="py-6 px-4"><LoadingSpinner label="Loading 990 filings…" /></div>;
  if (error) return <div className="py-4 px-4"><ErrorBanner message={error} /></div>;
  if (!data) return <div className="py-4 px-4"><p className="text-sm text-[hsl(var(--muted-foreground))]">No structured filing data available for this organization.</p></div>;

  const org = data.organization;
  const filings = data.filings.sort((a, b) => b.tax_prd_yr.localeCompare(a.tax_prd_yr));

  return (
    <div className="bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))] px-4 py-4">
      {/* Org meta */}
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">EIN</span>
          <p className="font-mono font-medium">{org.ein}</p>
        </div>
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Location</span>
          <p className="font-medium">{[org.address, org.city, org.state, org.zipcode].filter(Boolean).join(", ") || [org.city, org.state].filter(Boolean).join(", ")}</p>
        </div>
        {org.ntee_code && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">NTEE Code</span>
            <p className="font-medium">{org.ntee_code}</p>
          </div>
        )}
        {org.num_employees != null && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Employees</span>
            <p className="font-medium">{org.num_employees.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Revenue sparkline */}
      {filings.length >= 2 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Revenue trend</span>
          <RevSparkline filings={filings} />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{filings[filings.length - 1]?.tax_prd_yr} → {filings[0]?.tax_prd_yr}</span>
        </div>
      )}

      {/* Filing history table */}
      {filings.length > 0 ? (
        <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Form</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Exec Comp</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((f) => (
                <TableRow key={f.tax_prd_yr}>
                  <TableCell className="font-medium">{f.tax_prd_yr}</TableCell>
                  <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">{f.formtype}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{usd(f.totrevenue)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totfuncexpns)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totassetsend)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.compnsatncurrofcr)}</TableCell>
                  <TableCell className="text-right">
                    <Margin revenue={f.totrevenue} expenses={f.totfuncexpns} />
                  </TableCell>
                  <TableCell>
                    {f.pdf_url && (
                      <a
                        href={f.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        990
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No structured filing data available for this organization.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorIntelPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ organizations: NonprofitOrg[]; total: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function handleSearch(q = query) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    try {
      const data = (await mcp("search_nonprofits", {
        query: q.trim(),
        ...(state ? { state } : {}),
      })) as { organizations: NonprofitOrg[]; total: number };
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(ein: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ein)) next.delete(ein);
      else next.add(ein);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        icon={Building}
        title="Competitor Intelligence"
        description="Search IRS Form 990 filings for any nonprofit hospice, home health, or palliative care organization."
      />

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Organization Name</label>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. VITAS, Amedisys, Crossroads"
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
          </form>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">State</label>
          <StateSelect value={state} onChange={setState} />
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setQuery(s); handleSearch(s); }}
            className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Searching IRS 990 database…" />}
      {error && <ErrorBanner message={error} />}

      {results && !loading && (
        <>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {results.total.toLocaleString()} organizations found
            {state ? ` in ${state}` : ""} · Source: ProPublica Nonprofit Explorer
          </p>

          {results.organizations.length === 0 ? (
            <EmptyState
              icon={Building}
              title="No results"
              description="Try a broader search term or remove the state filter."
            />
          ) : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>NTEE</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                    <TableHead className="text-right">990s</TableHead>
                    <TableHead className="text-right">Filings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.organizations.map((org) => (
                    <Fragment key={org.ein}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors"
                        onClick={() => toggleExpand(org.ein)}
                      >
                        <TableCell>
                          {expanded.has(org.ein) ? (
                            <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium text-sm">{org.name}</span>
                            {org.city && (
                              <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{org.city}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{org.state || "—"}</TableCell>
                        <TableCell>
                          {org.ntee_code ? (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {org.ntee_code}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {usd(org.income_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">
                          {usd(org.asset_amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">
                          {org.form_990_count || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {org.have_pdfs && (
                            <ExternalLink className="h-3 w-3 text-[hsl(var(--primary))] inline" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded.has(org.ein) && (
                        <tr key={`${org.ein}-detail`}>
                          <td colSpan={8} className="p-0">
                            <DetailPanel ein={org.ein} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!results && !loading && (
        <EmptyState
          icon={Building}
          title="Search competitor 990s"
          description="Revenue, expenses, executive compensation, and margin for any nonprofit hospice or home health agency. Data from IRS filings via ProPublica."
        />
      )}
    </div>
  );
}
