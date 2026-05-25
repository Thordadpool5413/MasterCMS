"use client";

import { Fragment, useState, useEffect } from "react";
import {
  Search, Building, ChevronDown, ChevronUp, ExternalLink, FileText,
  TrendingUp, TrendingDown, BarChart3, Globe, Phone, MapPin, Calendar,
  DollarSign, Activity, AlertCircle,
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
import type { SECCompany, SECCompanyDetails, SECFinancialYear } from "@/lib/sec-edgar";

// ─── Formatters ───────────────────────────────────────────────────────────────

const usd = (v: number | undefined, compact = true) => {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
};

const pctFmt = (num: number, denom: number) =>
  denom ? ((num / denom) * 100).toFixed(1) + "%" : "—";

const fmt = (v: number | undefined) =>
  v != null ? new Intl.NumberFormat("en-US").format(v) : "—";

// ─── Suggestions ─────────────────────────────────────────────────────────────

const NP_SUGGESTIONS = ["VITAS", "Amedisys", "Enhabit", "Crossroads Hospice", "Agrace", "Seasons", "LHC Group", "Addus"];
const FP_SUGGESTIONS = ["Chemed", "Amedisys", "Enhabit", "Addus HomeCare", "Option Care", "BrightSpring", "Agiliti", "HCA Healthcare"];

// ─── Shared sub-components ───────────────────────────────────────────────────

function Trend({ value, prev }: { value: number | undefined; prev: number | undefined }) {
  if (!value || !prev) return null;
  const pct = ((value - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ml-2 ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MarginBadge({ revenue, income }: { revenue: number | undefined; income: number | undefined }) {
  if (!revenue || income == null) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  const m = (income / revenue) * 100;
  const color = m >= 10 ? "text-green-600" : m >= 0 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`font-semibold ${color}`}>
      {m >= 0 ? "+" : ""}{m.toFixed(1)}%
    </span>
  );
}

function MiniBar({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values.map(Math.abs));
  if (!max) return null;
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => {
        const pct = Math.max(3, (Math.abs(v) / max) * 100);
        const color = v >= 0 ? "bg-[hsl(var(--primary)/0.5)]" : "bg-red-400/50";
        return (
          <div key={i} className={`w-2.5 rounded-t ${color} hover:opacity-80 transition-opacity`}
            style={{ height: `${pct}%` }}
            title={usd(v)}
          />
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
      <p className="text-sm font-semibold font-mono leading-tight">{value}</p>
      {sub && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Nonprofit Detail Panel ───────────────────────────────────────────────────

function NonprofitDetailPanel({ ein }: { ein: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NonprofitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoading(true);
    mcp("get_nonprofit_detail", { ein })
      .then((res) => setData(res as NonprofitDetail))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("404")) setError(msg);
      })
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [ein, loaded]);

  if (loading) return <div className="p-6"><LoadingSpinner label="Loading IRS 990 filings…" /></div>;
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>;
  if (!data) return (
    <div className="p-5 text-sm text-[hsl(var(--muted-foreground))]">
      No structured 990 filing data found for this organization.
    </div>
  );

  const org = data.organization;
  const filings = [...data.filings].sort((a, b) => b.tax_prd_yr.localeCompare(a.tax_prd_yr));
  const latest = filings[0];
  const prev = filings[1];

  const margin = latest && latest.totrevenue > 0
    ? ((latest.totrevenue - latest.totfuncexpns) / latest.totrevenue * 100)
    : null;

  return (
    <div className="bg-[hsl(var(--muted))/0.3] border-t border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">

      {/* Org header */}
      <div className="px-5 py-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {org.strein && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">EIN</p>
            <p className="font-mono font-medium">{org.strein}</p>
          </div>
        )}
        {(org.address || org.city) && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Address</p>
            <p className="font-medium">{[org.address, org.city, org.state, org.zipcode].filter(Boolean).join(", ")}</p>
          </div>
        )}
        {org.ntee_code && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">NTEE Code</p>
            <p className="font-medium">{org.ntee_code}</p>
          </div>
        )}
        {org.subseccd > 0 && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Tax Status</p>
            <Badge variant="secondary">501(c)({org.subseccd})</Badge>
          </div>
        )}
        {org.ruling_date && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Ruling Date</p>
            <p className="font-medium">{org.ruling_date}</p>
          </div>
        )}
        {org.income_amount != null && org.income_amount > 0 && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Reported Income</p>
            <p className="font-mono font-medium">{usd(org.income_amount)}</p>
          </div>
        )}
        {org.asset_amount != null && org.asset_amount > 0 && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Reported Assets</p>
            <p className="font-mono font-medium">{usd(org.asset_amount)}</p>
          </div>
        )}
      </div>

      {/* Key financial metrics — most recent year */}
      {latest && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Most Recent Fiscal Year ({latest.tax_prd_yr})
            </p>
            {filings.length >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Revenue trend</span>
                <MiniBar values={[...filings].reverse().map(f => f.totrevenue)} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard
              label="Total Revenue"
              value={usd(latest.totrevenue)}
              sub={<Trend value={latest.totrevenue} prev={prev?.totrevenue} />}
            />
            <StatCard
              label="Total Expenses"
              value={usd(latest.totfuncexpns)}
              sub={<Trend value={latest.totfuncexpns} prev={prev?.totfuncexpns} />}
            />
            <StatCard
              label="Net Assets"
              value={usd(latest.totnetassetend || (latest.totassetsend - latest.totliabend))}
            />
            <StatCard
              label="Profit Margin"
              value={<MarginBadge revenue={latest.totrevenue} income={latest.totrevenue - latest.totfuncexpns} />}
            />
            <StatCard
              label="Contributions"
              value={usd(latest.totcntrbgfts)}
              sub={latest.totrevenue > 0 ? pctFmt(latest.totcntrbgfts, latest.totrevenue) + " of rev" : undefined}
            />
            <StatCard
              label="Program Revenue"
              value={usd(latest.totprgmrevnue)}
              sub={latest.totrevenue > 0 ? pctFmt(latest.totprgmrevnue, latest.totrevenue) + " of rev" : undefined}
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-2">
            <StatCard label="Exec Compensation" value={usd(latest.compnsatncurrofcr)}
              sub={latest.pct_compnsatncurrofcr > 0 ? `${(latest.pct_compnsatncurrofcr * 100).toFixed(1)}% of rev` : undefined}
            />
            <StatCard label="Other Salaries" value={usd(latest.othrsalwages)} />
            <StatCard label="Payroll Tax" value={usd(latest.payrolltx)} />
            <StatCard label="Prof. Fundraising" value={usd(latest.profndraising)} />
          </div>

          {margin !== null && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm font-medium flex items-center gap-2 ${
              margin >= 10 ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
              : margin >= 0 ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
            }`}>
              {margin >= 0
                ? <TrendingUp className="h-4 w-4" />
                : <TrendingDown className="h-4 w-4" />}
              Operating margin: {margin >= 0 ? "+" : ""}{margin.toFixed(1)}% in {latest.tax_prd_yr}
              {prev && <span className="font-normal ml-2 opacity-70">
                (prev: {((prev.totrevenue - prev.totfuncexpns) / (prev.totrevenue || 1) * 100).toFixed(1)}%)
              </span>}
            </div>
          )}
        </div>
      )}

      {/* Filing history */}
      {filings.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
            Filing History ({filings.length} {filings.length === 1 ? "filing" : "filings"})
          </p>
          <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net Assets</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Exec Comp</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filings.map((f: NonprofitFiling) => {
                  const m = f.totrevenue > 0
                    ? ((f.totrevenue - f.totfuncexpns) / f.totrevenue * 100)
                    : null;
                  return (
                    <TableRow key={`${f.tax_prd_yr}-${f.tax_prd}`}>
                      <TableCell className="font-medium">{f.tax_prd_yr}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-mono">{f.formtype}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{usd(f.totrevenue)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(f.totfuncexpns)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {usd(f.totnetassetend || (f.totassetsend - f.totliabend))}
                      </TableCell>
                      <TableCell className="text-right">
                        {m !== null ? (
                          <span className={`text-xs font-semibold ${m >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {m >= 0 ? "+" : ""}{m.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">
                        {usd(f.compnsatncurrofcr)}
                      </TableCell>
                      <TableCell>
                        {f.pdf_url && f.pdf_url !== "undefined" && f.pdf_url.startsWith("http") && (
                          <a href={f.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                            <FileText className="h-3 w-3" />990
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Source: IRS Form 990 via{" "}
            <a href={`https://projects.propublica.org/nonprofits/organizations/${org.ein}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] hover:underline">
              ProPublica Nonprofit Explorer
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SEC / Public Company Detail Panel ───────────────────────────────────────

function SECDetailPanel({ cik }: { cik: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SECCompanyDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoading(true);
    getSECCompanyDetails(cik)
      .then((res) => setData(res))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load SEC data"))
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [cik, loaded]);

  if (loading) return <div className="p-6"><LoadingSpinner label="Loading SEC EDGAR data…" /></div>;
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>;
  if (!data) return (
    <div className="p-5 text-sm text-[hsl(var(--muted-foreground))]">
      No SEC filing data available for this company.
    </div>
  );

  const latest = data.financials[0];
  const prev = data.financials[1];
  const recentFilings = data.filings.slice(0, 12);

  const annualRevenues = data.financials.map((y) => y.revenues ?? 0).reverse();

  return (
    <div className="bg-[hsl(var(--muted))/0.3] border-t border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">

      {/* Company header */}
      <div className="px-5 py-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {data.ticker && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Ticker</p>
            <Badge variant="secondary" className="font-mono font-bold text-sm">{data.ticker}</Badge>
          </div>
        )}
        {data.exchange && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Exchange</p>
            <p className="font-medium">{data.exchange}</p>
          </div>
        )}
        {data.sic_description && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Industry (SIC)</p>
            <p className="font-medium">{data.sic_description}{data.sic ? ` (${data.sic})` : ""}</p>
          </div>
        )}
        {(data.city || data.state) && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Headquarters</p>
            <p className="font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[data.city, data.state].filter(Boolean).join(", ")}
            </p>
          </div>
        )}
        {data.phone && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
            <p className="font-medium flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {data.phone}
            </p>
          </div>
        )}
        {data.category && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Filer Category</p>
            <p className="font-medium">{data.category}</p>
          </div>
        )}
        {data.fiscal_year_end && (
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Fiscal Year End</p>
            <p className="font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {data.fiscal_year_end}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">CIK</p>
          <a
            href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K&dateb=&owner=include&count=40`}
            target="_blank" rel="noopener noreferrer"
            className="font-mono font-medium text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
          >
            {parseInt(data.cik, 10)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Key financial metrics */}
      {latest ? (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Most Recent Annual Financials (FY{latest.year})
            </p>
            {annualRevenues.length >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Revenue trend</span>
                <MiniBar values={annualRevenues} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              label="Revenue"
              value={usd(latest.revenues)}
              sub={<Trend value={latest.revenues} prev={prev?.revenues} />}
            />
            <StatCard
              label="Net Income"
              value={<MarginBadge revenue={latest.revenues} income={latest.net_income} />}
              sub={usd(latest.net_income)}
            />
            <StatCard
              label="Operating Income"
              value={usd(latest.operating_income)}
              sub={latest.revenues && latest.operating_income != null
                ? pctFmt(latest.operating_income, latest.revenues) + " margin" : undefined}
            />
            <StatCard
              label="Total Assets"
              value={usd(latest.total_assets)}
              sub={<Trend value={latest.total_assets} prev={prev?.total_assets} />}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-2">
            <StatCard label="Total Liabilities" value={usd(latest.total_liabilities)} />
            <StatCard label="Stockholders' Equity" value={usd(latest.stockholders_equity)} />
            {latest.eps_basic != null && (
              <StatCard
                label="EPS (Basic)"
                value={`$${latest.eps_basic.toFixed(2)}`}
                sub={<Trend value={latest.eps_basic} prev={prev?.eps_basic} />}
              />
            )}
            {latest.revenues && latest.total_assets ? (
              <StatCard
                label="Asset Turnover"
                value={(latest.revenues / latest.total_assets).toFixed(2) + "×"}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <AlertCircle className="h-4 w-4" />
            No XBRL financial data available. Check SEC filings directly for financials.
          </div>
        </div>
      )}

      {/* Multi-year financial history */}
      {data.financials.length > 1 && (
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
            Annual Financial History
          </p>
          <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FY</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="text-right">Op. Income</TableHead>
                  <TableHead className="text-right">Total Assets</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.financials.map((y: SECFinancialYear, idx) => {
                  const nextY = data.financials[idx + 1];
                  const revenueGrowth = nextY?.revenues && y.revenues
                    ? ((y.revenues - nextY.revenues) / nextY.revenues * 100) : null;
                  return (
                    <TableRow key={y.year}>
                      <TableCell className="font-semibold">{y.year}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {usd(y.revenues)}
                        {revenueGrowth !== null && (
                          <span className={`ml-1.5 text-xs ${revenueGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {revenueGrowth >= 0 ? "↑" : "↓"}{Math.abs(revenueGrowth).toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={y.net_income != null && y.net_income < 0 ? "text-red-500" : ""}>
                          {usd(y.net_income)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{usd(y.operating_income)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(y.total_assets)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">{usd(y.stockholders_equity)}</TableCell>
                      <TableCell className="text-right">
                        {y.revenues && y.net_income != null ? (
                          <span className={`text-xs font-semibold ${y.net_income >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {(y.net_income / y.revenues * 100).toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Recent SEC filings */}
      {recentFilings.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
            Recent SEC Filings (10-K / 10-Q)
          </p>
          <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto bg-[hsl(var(--card))]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Period Covered</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFilings.map((f) => (
                  <TableRow key={f.accession_number}>
                    <TableCell>
                      <Badge
                        variant={f.form_type === "10-K" ? "default" : "secondary"}
                        className="font-mono text-xs"
                      >
                        {f.form_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{f.filing_date}</TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">{f.report_date || "—"}</TableCell>
                    <TableCell>
                      {f.document_url && (
                        <a href={f.document_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                          <ExternalLink className="h-3 w-3" />
                          View Filing
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Source:{" "}
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K&dateb=&owner=include&count=40`}
              target="_blank" rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] hover:underline"
            >
              SEC EDGAR
            </a>
          </p>
        </div>
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
  const [npResults, setNpResults] = useState<{ organizations: NonprofitOrg[]; total: number } | null>(null);
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
        setNpResults(data);
        setSecResults(null);
      } else {
        const companies = await searchSECCompanies(q.trim());
        setSecResults(companies);
        setNpResults(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function switchTab(t: "nonprofits" | "forprofit") {
    setTab(t);
    setQuery("");
    setNpResults(null);
    setSecResults(null);
    setError(null);
    setExpanded(new Set());
  }

  const suggestions = tab === "nonprofits" ? NP_SUGGESTIONS : FP_SUGGESTIONS;
  const hasResults = tab === "nonprofits" ? !!npResults : !!secResults;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        icon={Building}
        title="Competitor Intelligence"
        description="Analyze nonprofit (IRS 990) and public company (SEC 10-K/10-Q) competitors with full financial histories."
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[hsl(var(--border))]">
        <button
          onClick={() => switchTab("nonprofits")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "nonprofits"
              ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Nonprofit 990s
          </span>
        </button>
        <button
          onClick={() => switchTab("forprofit")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "forprofit"
              ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Public Companies (10-K / 10-Q)
          </span>
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {tab === "nonprofits" ? "Organization Name" : "Company Name or Keyword"}
          </label>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "nonprofits" ? "e.g. VITAS, Amedisys, Crossroads" : "e.g. Chemed, Amedisys, Enhabit"}
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
      <div className="mb-6 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => { setQuery(s); handleSearch(s); }}
            className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <LoadingSpinner label={tab === "nonprofits" ? "Searching ProPublica 990 database…" : "Searching SEC EDGAR company list…"} />
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Nonprofit results ── */}
      {tab === "nonprofits" && npResults && !loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
            <DataSourceBadge source="ProPublica Nonprofit Explorer" verified={true} />
            <DataFreshnessIndicator lastUpdated={new Date()} />
            <TrustBadge level="high" description="IRS Form 990 filing data" />
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              {npResults.total.toLocaleString()} results{state ? ` · ${state}` : ""}
            </span>
          </div>

          {npResults.organizations.length === 0 ? (
            <EmptyState icon={Building} title="No nonprofits found"
              description="Try a broader search or remove the state filter." />
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
                    <TableHead>Tax Status</TableHead>
                    <TableHead>990 Filings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {npResults.organizations.map((org: NonprofitOrg) => (
                    <Fragment key={org.ein}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors"
                        onClick={() => toggleExpand(org.ein)}
                      >
                        <TableCell>
                          {expanded.has(org.ein)
                            ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">{org.name}</span>
                          {org.sub_name && org.sub_name !== org.name && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{org.sub_name}</p>
                          )}
                          {org.city && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />{org.city}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                          {org.strein || org.ein}
                        </TableCell>
                        <TableCell className="text-sm">{org.state || "—"}</TableCell>
                        <TableCell>
                          {org.ntee_code
                            ? <Badge variant="secondary" className="font-mono text-xs">{org.ntee_code}</Badge>
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {org.subseccd > 0
                            ? <Badge variant="secondary" className="text-xs">501(c)({org.subseccd})</Badge>
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {org.have_filings
                            ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><Activity className="h-3 w-3" />Yes</span>
                            : <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>}
                        </TableCell>
                      </TableRow>
                      {expanded.has(org.ein) && (
                        <tr key={`${org.ein}-detail`}>
                          <td colSpan={7} className="p-0">
                            <NonprofitDetailPanel ein={org.ein} />
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

      {/* ── Public company results ── */}
      {tab === "forprofit" && secResults && !loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
            <DataSourceBadge source="SEC EDGAR" verified={true} />
            <DataFreshnessIndicator lastUpdated={new Date()} />
            <TrustBadge level="high" description="SEC public company filings (10-K annual, 10-Q quarterly)" />
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              {secResults.length} companies matched
            </span>
          </div>

          {secResults.length === 0 ? (
            <EmptyState icon={BarChart3} title="No companies found"
              description="Try a different company name or partial name (e.g. 'Chemed' for VITAS parent)." />
          ) : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>CIK</TableHead>
                    <TableHead>EDGAR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secResults.map((company: SECCompany) => (
                    <Fragment key={company.cik}>
                      <TableRow
                        className="cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors"
                        onClick={() => toggleExpand(company.cik)}
                      >
                        <TableCell>
                          {expanded.has(company.cik)
                            ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
                        </TableCell>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>
                          {company.ticker
                            ? <Badge variant="secondary" className="font-mono font-bold">{company.ticker}</Badge>
                            : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                          {parseInt(company.cik, 10)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=10-K&dateb=&owner=include&count=40`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />EDGAR
                          </a>
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

      {/* Empty state */}
      {!hasResults && !loading && !error && (
        <EmptyState
          icon={tab === "nonprofits" ? Building : BarChart3}
          title={tab === "nonprofits" ? "Search nonprofit competitors" : "Search public company competitors"}
          description={
            tab === "nonprofits"
              ? "Revenue, expenses, executive compensation, and operating margin from IRS 990 filings. Data via ProPublica Nonprofit Explorer — click any result to expand full financial history."
              : "Multi-year revenue, net income, total assets, and operating margin from SEC 10-K/10-Q filings. Data via SEC EDGAR — click any company to expand full financial details."
          }
        />
      )}
    </div>
  );
}
