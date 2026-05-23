"use client";

import { useState } from "react";
import { Search, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SpendingRow = {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  latest_spending: number;
  latest_year: string;
  year_2023_spending?: number;
  year_2022_spending?: number;
  year_2021_spending?: number;
  year_2023_claims?: number;
};

type SpendingResult = { rows: SpendingRow[]; total: number; spending_type: string };

function dollars(v: number | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function num(v: number | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export default function DrugSpendingPage() {
  const [drugName, setDrugName] = useState("");
  const [spendingType, setSpendingType] = useState<"part_d" | "part_b">("part_d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpendingResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("drug_spending", {
        ...(drugName.trim() ? { drug_name: drugName.trim() } : {}),
        spending_type: spendingType,
        max_rows: 200,
      })) as SpendingResult;
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
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h1 className="text-2xl font-bold tracking-tight">Drug Spending</h1>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Medicare Part D and Part B drug spending trends from CMS
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Drug Name (optional)</label>
          <Input
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder="e.g. Eliquis, insulin"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Part</label>
          <div className="flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
            {(["part_d", "part_b"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSpendingType(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  spendingType === t
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                }`}
              >
                {t === "part_d" ? "Part D" : "Part B"}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {result && !loading && (
        <>
          <Alert className="mb-4">
            <AlertDescription className="text-xs">
              {result.total} drugs • Medicare {result.spending_type === "part_d" ? "Part D" : "Part B"} spending data from CMS
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Generic Name</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-right">2023 Spending</TableHead>
                  <TableHead className="text-right">2022 Spending</TableHead>
                  <TableHead className="text-right">2021 Spending</TableHead>
                  <TableHead className="text-right">2023 Claims</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.brand_name || "—"}</TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">{row.generic_name || "—"}</TableCell>
                    <TableCell className="text-sm">{row.manufacturer || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.year_2023_spending ? (
                        <Badge variant="secondary">{dollars(row.year_2023_spending)}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">
                      {dollars(row.year_2022_spending)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[hsl(var(--muted-foreground))]">
                      {dollars(row.year_2021_spending)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">
                      {num(row.year_2023_claims)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-16 text-center">
          <DollarSign className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Search for a drug or click Search to see top Medicare spending</p>
        </div>
      )}
    </div>
  );
}
