"use client";

import { Fragment, useState, useEffect } from "react";
import {
  Search, Building, ChevronDown, ChevronUp, ExternalLink, FileText, TrendingUp, TrendingDown, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { TrustBadge } from "@/components/shared/trust-badge";
import { DataFreshnessIndicator } from "@/components/shared/data-freshness-indicator";
import { StateSelect } from "@/components/shared/state-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mcp } from "@/lib/api";
import type { NonprofitOrg, NonprofitFiling, NonprofitDetail } from "@/lib/cms-direct";
import { searchSECCompanies, getSECCompanyDetails } from "@/lib/sec-edgar";
import type { SECCompany, SECCompanyDetails } from "@/lib/sec-edgar";

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
  const latest = filings[0];

  return (
    <div className="bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))] px-4 py-5 space-y-5">
      {/* Org meta */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">EIN</span>
          <p className="font-mono font-medium">{org.strein || org.ein}</p>
        </div>
        {org.address && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Address</span>
            <p className="font-medium">{[org.address, org.city, org.state, org.zipcode].filter(Boolean).join(", ")}</p>
          </div>
        )}
        {!org.address && (org.city || org.state) && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Location</span>
            <p className="font-medium">{[org.city, org.state].filter(Boolean).join(", ")}</p>
          </div>
        )}
        {org.ntee_code && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">NTEE</span>
            <p className="font-medium">{org.ntee_code}</p>
          </div>
        )}
        {org.subseccd > 0 && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Status</span>
            <p className="font-medium">501(c)({org.subseccd})</p>
          </div>
        )}
        {org.ruling_date && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Ruling Date</span>
            <p className="font-medium">{org.ruling_date}</p>
          </div>
        )}
        {org.tax_period && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Tax Period</span>
            <p className="font-medium">{org.tax_period}</p>
          </div>
        )}
      </div>

      {/* Most-recent-year financial snapshot */}
      {latest && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Revenue", value: usd(latest.totrevenue) },
            { label: "Expenses", value: usd(latest.totfuncexpns) },
            { label: "Net Assets", value: usd(latest.totnetassetend || latest.totassetsend - latest.totliabend) },
            { label: "Margin", value: <Margin revenue={latest.totrevenue} expenses={latest.totfuncexpns} /> },
            { label: "Contributions", value: usd(latest.totcntrbgfts) },
            { label: "Program Revenue", value: usd(latest.totprgmrevnue) },
            { label: "Investment Inc.", value: usd(latest.invstmntinc) },
            { label: "Fundraising Inc.", value: usd(latest.netincfndrsng) },
            { label: "Exec Comp", value: usd(latest.compnsatncurrofcr) },
            { label: "Other Salaries", value: usd(latest.othrsalwages) },
            { label: "Payroll Tax", value: usd(latest.payrolltx) },
            { label: "Prof. Fundraising", value: usd(latest.profndraising) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="mt-0.5 text-sm font-mono font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue sparkline */}
      {filings.length >= 2 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Revenue trend</span>
          <RevSparkline filings={filings} />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{filings[filings.length - 1]?.tax_prd_yr} → {filings[0]?.tax_prd_yr}</span>
        </div>
      )}

      {/* Full filing history */}
      {filings.length > 0 ? (
        <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Form</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net Assets</TableHead>
                <TableHead className="text-right">Liabilities</TableHead>
                <TableHead className="text-right">Exec Comp</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((f) => (
                <TableRow key={`${f.tax_prd_yr}-${f.tax_prd}`}>
                  <TableCell className="font-medium">{f.tax_prd_yr}</TableCell>
                  <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">{f.formtype}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{usd(f.totrevenue)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totfuncexpns)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totnetassetend || f.totassetsend - f.totliabend)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totliabend)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">
                    {usd(f.compnsatncurrofcr)}
                    {f.pct_compnsatncurrofcr > 0 && (
                      <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">({(f.pct_compnsatncurrofcr * 100).toFixed(1)}%)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Margin revenue={f.totrevenue} expenses={f.totfuncexpns} />
                  </TableCell>
                  <TableCell>
                    {f.pdf_url && f.pdf_url !== "undefined" && (
                      <a href={f.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                        <FileText className="h-3 w-3" />990
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

// ─── SEC Company Detail Panel ─────────────────────────────────────────────────

function SECDetailPanel({ cik }: { cik: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SECCompanyDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSECCompanyDetails(cik);
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load SEC filings";
      setError(msg);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, [loaded]);

  if (loading) return <div className="py-6 px-4"><LoadingSpinner label="Loading SEC filings…" /></div>;
  if (error) return <div className="py-4 px-4"><ErrorBanner message={error} /></div>;
  if (!data) return <div className="py-4 px-4"><p className="text-sm text-[hsl(var(--muted-foreground))]">No SEC filing data available.</p></div>;

  const filings = data.filings.sort((a, b) => b.filing_date.localeCompare(a.filing_date));

  return (
    <div className="bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))] px-4 py-4">
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Company</span>
          <p className="font-medium">{data.name}</p>
        </div>
        {data.ticker && (
          <div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Ticker</span>
            <p className="font-mono font-medium">{data.ticker}</p>
          </div>
        )}
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">CIK</span>
          <p className="font-mono font-medium">{data.cik}</p>
        </div>
      </div>

      {filings.length > 0 ? (
        <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Filing Date</TableHead>
                <TableHead>Report Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((f) => (
                <TableRow key={f.accession_number}>
                  <TableCell className="font-medium text-sm">{f.form_type}</TableCell>
                  <TableCell className="text-sm">{f.filing_date}</TableCell>
                  <TableCell className="text-sm">{f.report_date}</TableCell>
                  <TableCell>
                    {f.document_url && (
                      <a
                        href={f.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        SEC Filing
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No recent SEC filings available.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorIntelPage() {
  const [tab, setTab] = useState<"nonprofits" | "forprofit">("nonprofits");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ organizations: NonprofitOrg[]; total: number } | null>(null);
  const [secResults, setSecResults] = useState<SECCompany[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function handleSearch(q = query) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    try {
      if (tab === "nonprofits") {
        const data = (await mcp("search_nonprofits", {
          query: q.trim(),
          ...(state ? { state } : {}),
        })) as { organizations: NonprofitOrg[]; total: number };
        setResults(data);
        setSecResults(null);
      } else {
        const companies = await searchSECCompanies(q.trim());
        setSecResults(companies);
        setResults(null);
      }
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
        description="Compare nonprofit (IRS 990) and for-profit (SEC filings) healthcare competitors."
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[hsl(var(--border))]">
        <button
          onClick={() => { setTab("nonprofits"); setQuery(""); setResults(null); setSecResults(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "nonprofits"
              ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          Nonprofit 990s
        </button>
        <button
          onClick={() => { setTab("forprofit"); setQuery(""); setResults(null); setSecResults(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "forprofit"
              ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          Public Companies (10-K/10-Q)
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {tab === "nonprofits" ? "Organization Name" : "Company Name"}
          </label>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "nonprofits"
                  ? "e.g. VITAS, Amedisys, Crossroads"
                  : "e.g. CVS Health, UnitedHealth, LHC Group"
              }
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
          </form>
        </div>
        {tab === "nonprofits" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">State</label>
            <StateSelect value={state} onChange={setState} />
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      {tab === "nonprofits" && (
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
      )}

      {loading && <LoadingSpinner label="Searching IRS 990 database…" />}
      {error && <ErrorBanner message={error} />}

      {results && !loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
            <DataSourceBadge source={tab === "nonprofits" ? "ProPublica 990" : "SEC EDGAR"} verified={true} />
            <DataFreshnessIndicator lastUpdated={new Date()} />
            <TrustBadge level="high" description={tab === "nonprofits" ? "IRS Form 990 filing data" : "SEC public company filings"} />
          </div>

          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {results.total.toLocaleString()} organizations found
            {state ? ` in ${state}` : ""} · Source: {tab === "nonprofits" ? "ProPublica Nonprofit Explorer" : "SEC EDGAR"}
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
                    <TableHead>EIN</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>NTEE</TableHead>
                    <TableHead>Type</TableHead>
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
                            {org.sub_name && org.sub_name !== org.name && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{org.sub_name}</p>
                            )}
                            {org.city && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{org.city}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                          {org.strein || org.ein}
                        </TableCell>
                        <TableCell className="text-sm">{org.state || "—"}</TableCell>
                        <TableCell>
                          {org.ntee_code ? (
                            <Badge variant="secondary" className="font-mono text-xs">{org.ntee_code}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {org.subseccd > 0 ? (
                            <Badge variant="secondary" className="text-xs">501(c)({org.subseccd})</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {org.have_filings ? (
                            <ExternalLink className="h-3 w-3 text-[hsl(var(--primary))] inline" />
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                      {expanded.has(org.ein) && (
                        <tr key={`${org.ein}-detail`}>
                          <td colSpan={7} className="p-0">
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

      {tab === "forprofit" && secResults && !loading && (
        <>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {secResults.length} companies found · Source: SEC EDGAR
          </p>

          {secResults.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No results"
              description="Try a broader company name or ticker symbol."
            />
          ) : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>CIK</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secResults.map((company) => (
                    <Fragment key={company.cik}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors"
                        onClick={() => toggleExpand(company.cik)}
                      >
                        <TableCell>
                          {expanded.has(company.cik) ? (
                            <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-sm">{company.ticker || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{company.cik}</TableCell>
                        <TableCell>
                          <ExternalLink className="h-3 w-3 text-[hsl(var(--primary))]" />
                        </TableCell>
                      </TableRow>
                      {expanded.has(company.cik) && (
                        <tr key={`${company.cik}-detail`}>
                          <td colSpan={5} className="p-0">
                            <SECDetailPanel cik={company.cik} />
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

      {!results && !secResults && !loading && (
        <EmptyState
          icon={tab === "nonprofits" ? Building : BarChart3}
          title={tab === "nonprofits" ? "Search competitor 990s" : "Search public companies"}
          description={
            tab === "nonprofits"
              ? "Revenue, expenses, executive compensation, and margin for any nonprofit hospice or home health agency. Data from IRS filings via ProPublica."
              : "Financial data and SEC filings (10-K annual, 10-Q quarterly) for publicly traded healthcare companies."
          }
        />
      )}
    </div>
  );
}
