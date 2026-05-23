import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatPercent, formatNumber } from "@/lib/utils";
import type { HospiceResult, HospiceRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[hsl(var(--border))]">
        <div
          className="h-2 rounded-full bg-[hsl(var(--primary))]"
          style={{ width: `${Math.min(pct * 3, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium">{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function HospiceMarketPage() {
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospiceResult | null>(null);

  // No auto-load — user must select a state and click Search for fast results

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("hospice_market_share_proxy", {
        ...(state ? { state } : {}),
        max_rows: 200,
      })) as HospiceResult;
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
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization — beneficiary volume ranked by market share
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} placeholder="All states" />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching hospice market data…" />}

      {!loading && !result && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-16 text-center">
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Select a state and click Search to view hospice market share data</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Data from Medicare PAC Utilization Hospice · CMS public API</p>
        </div>
      )}

      {!loading && result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Providers", value: formatNumber(result.rows.length) },
              { label: "Total Beneficiaries", value: formatNumber(result.total_volume) },
              { label: "Markets", value: formatNumber(Object.keys(result.market_totals).length) },
              { label: "State Filter", value: state || "All States" },
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
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead className="text-right">Market Total</TableHead>
                  <TableHead>Market Share</TableHead>
                  <TableHead className="text-right">Medicare Payments</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: HospiceRow, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{row._rank}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={row._provider_name}>
                      {row._provider_name || "—"}
                    </TableCell>
                    <TableCell>{row._city || "—"}</TableCell>
                    <TableCell>{row._state || "—"}</TableCell>
                    <TableCell className="text-xs">{row._zip || "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs" title={row._market}>{row._market}</TableCell>
                    <TableCell className="text-right">{formatNumber(row._market_volume)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row._market_total_volume)}</TableCell>
                    <TableCell><ShareBar pct={row._market_share_pct} /></TableCell>
                    <TableCell className="text-right">{row._payment ? currency(row._payment) : "—"}</TableCell>
                    <TableCell className="text-right">{row._avg_age ? row._avg_age.toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right">{row._risk_score ? row._risk_score.toFixed(2) : "—"}</TableCell>
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
    </div>
  );
}
