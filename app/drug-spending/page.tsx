"use client";

import { useState } from "react";
import { Search, DollarSign, ChevronDown, ChevronUp, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mcp } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DrugSpendingRow, AdverseEventReaction, DrugLabelSummary } from "@/lib/cms-direct";
import { cn } from "@/lib/utils";

// ─── Formatters ───────────────────────────────────────────────────────────────

const usd = (v: number | undefined) =>
  v
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v)
    : "—";

const compact = (v: number | undefined) =>
  v
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
    : "—";

// ─── Adverse events panel ─────────────────────────────────────────────────────

function AdverseEventsPanel({ drugName }: { drugName: string }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reactions, setReactions] = useState<AdverseEventReaction[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = (await mcp("get_fda_adverse_events", { drug_name: drugName })) as {
        reactions: AdverseEventReaction[];
        total_reports: number;
      };
      setReactions(res.reactions);
      setTotalReports(res.total_reports);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load adverse event data");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  // Auto-load
  if (!loaded && !loading) load();

  if (loading) return <LoadingSpinner label="Loading FDA adverse events…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!reactions.length) return (
    <p className="text-sm text-[hsl(var(--muted-foreground))] py-4">
      No adverse event data found for {drugName} in the FDA FAERS database.
    </p>
  );

  const maxCount = reactions[0]?.count ?? 1;

  return (
    <div>
      <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
        {totalReports.toLocaleString()} total reports in FDA FAERS · Top reactions shown
      </p>
      <div className="space-y-1.5">
        {reactions.map((r) => (
          <div key={r.term} className="flex items-center gap-3">
            <div className="w-48 shrink-0">
              <div className="h-5 rounded bg-[hsl(var(--muted))] overflow-hidden">
                <div
                  className="h-full rounded bg-amber-400 transition-all"
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium capitalize">{r.term.toLowerCase()}</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))] font-mono">
              {r.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
        Source: FDA FAERS — voluntary adverse event reports. Does not imply causation.
      </p>
    </div>
  );
}

// ─── Drug label panel ─────────────────────────────────────────────────────────

function DrugLabelPanel({ drugName }: { drugName: string }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState<DrugLabelSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = (await mcp("get_fda_drug_label", { drug_name: drugName })) as DrugLabelSummary | null;
      setLabel(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drug label");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  if (!loaded && !loading) load();

  if (loading) return <LoadingSpinner label="Loading FDA drug label…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!label) return (
    <p className="text-sm text-[hsl(var(--muted-foreground))] py-4">
      No FDA label found for {drugName}.
    </p>
  );

  return (
    <div className="space-y-3 text-sm">
      {label.generic_name && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Generic Name</span>
          <p className="mt-0.5">{label.generic_name}</p>
        </div>
      )}
      {label.indications_and_usage && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Indications & Usage</span>
          <p className="mt-0.5 text-[hsl(var(--muted-foreground))] leading-relaxed">{label.indications_and_usage}</p>
        </div>
      )}
      {label.boxed_warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Boxed Warning</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">{label.boxed_warning}</p>
        </div>
      )}
      {label.warnings && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Warnings</span>
          <p className="mt-0.5 text-[hsl(var(--muted-foreground))] leading-relaxed">{label.warnings}</p>
        </div>
      )}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Source: FDA Drug Label (openFDA)</p>
    </div>
  );
}

// ─── Expanded drug row ────────────────────────────────────────────────────────

function DrugDetail({ drug }: { drug: DrugSpendingRow }) {
  return (
    <div className="bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))] px-6 py-4">
      <Tabs defaultValue="adverse">
        <TabsList className="mb-4">
          <TabsTrigger value="adverse">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5 inline" />
            Adverse Events
          </TabsTrigger>
          <TabsTrigger value="label">
            <FileText className="h-3.5 w-3.5 mr-1.5 inline" />
            Drug Label
          </TabsTrigger>
        </TabsList>
        <TabsContent value="adverse">
          <AdverseEventsPanel drugName={drug.brand_name || drug.generic_name} />
        </TabsContent>
        <TabsContent value="label">
          <DrugLabelPanel drugName={drug.brand_name || drug.generic_name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SpendingResult = { rows: DrugSpendingRow[]; total: number; spending_type: string };

export default function DrugSpendingPage() {
  const [drugName, setDrugName] = useState("");
  const [spendingType, setSpendingType] = useState<"part_d" | "part_b">("part_d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpendingResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExpanded(null);
    try {
      const data = (await mcp("drug_spending", {
        ...(drugName.trim() ? { drug_name: drugName.trim() } : {}),
        spending_type: spendingType,
        max_rows: 200,
      })) as SpendingResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        icon={DollarSign}
        title="Drug Spending"
        description="Medicare Part D and Part B spending trends — click any drug to see FDA adverse events and label data."
      />

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Drug Name (optional)</label>
          <Input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="e.g. Eliquis, insulin, Humira" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Part</label>
          <div className="flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
            {(["part_d", "part_b"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSpendingType(t)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  spendingType === t
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]",
                )}
              >
                {t === "part_d" ? "Part D" : "Part B"}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading}>
          <Search className="h-4 w-4 mr-1.5" />
          Search
        </Button>
      </form>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {result && !loading && result.rows.length === 0 && (
        <EmptyState
          icon={DollarSign}
          title="No matching drugs"
          description={
            drugName.trim()
              ? `No Medicare ${spendingType === "part_d" ? "Part D" : "Part B"} drugs matched "${drugName.trim()}". Try a brand name (e.g., "Eliquis") or a generic name (e.g., "morphine sulfate").`
              : "No spending data returned. Try switching between Part D and Part B."
          }
        />
      )}

      {result && !loading && result.rows.length > 0 && (
        <>
          <Alert className="mb-4">
            <AlertDescription className="text-xs">
              {result.total} drugs · Medicare {result.spending_type === "part_d" ? "Part D" : "Part B"} · Click a row for FDA adverse events and label
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Generic Name</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-right">2023 Spending</TableHead>
                  <TableHead className="text-right">2022</TableHead>
                  <TableHead className="text-right">2021</TableHead>
                  <TableHead className="text-right">2023 Claims</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => {
                  const key = row.brand_name || row.generic_name || String(i);
                  const isOpen = expanded === key;
                  return (
                    <>
                      <TableRow
                        key={key}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isOpen
                            ? "bg-[hsl(var(--accent))]"
                            : "hover:bg-[hsl(var(--accent)/0.5)]",
                        )}
                        onClick={() => toggle(key)}
                      >
                        <TableCell className="px-3">
                          {isOpen
                            ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
                        </TableCell>
                        <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.brand_name || "—"}</TableCell>
                        <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">{row.generic_name || "—"}</TableCell>
                        <TableCell className="text-sm">{row.manufacturer || "—"}</TableCell>
                        <TableCell className="text-right text-sm">
                          {row.year_2023_spending ? (
                            <Badge variant="secondary">{usd(row.year_2023_spending)}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-[hsl(var(--muted-foreground))]">{usd(row.year_2022_spending)}</TableCell>
                        <TableCell className="text-right text-sm font-mono text-[hsl(var(--muted-foreground))]">{usd(row.year_2021_spending)}</TableCell>
                        <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">{compact(row.year_2023_claims)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <tr key={`${key}-detail`}>
                          <td colSpan={9} className="p-0">
                            <DrugDetail drug={row} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!result && !loading && (
        <EmptyState
          icon={DollarSign}
          title="Search Medicare drug spending"
          description="Leave the drug name blank to see all top drugs by spending. Click any row to reveal FDA adverse events and drug label data."
        />
      )}
    </div>
  );
}
