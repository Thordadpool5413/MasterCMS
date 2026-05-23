import { useState } from "react";
import { Search, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StateSelect } from "@/components/shared/state-select";
import { mcp } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PrescriberRow = {
  npi: string;
  prescriber_name: string;
  prescriber_type: string;
  city: string;
  state: string;
  zip: string;
  total_claims: number;
  total_drug_cost: number;
  total_beneficiaries: number;
  brand_claims?: number;
  generic_claims?: number;
};

type PrescriberResult = { rows: PrescriberRow[]; total: number };

function dollars(v: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function fmt(v: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export default function PrescribersPage() {
  const [drugName, setDrugName] = useState("");
  const [state, setState] = useState("");
  const [prescriberType, setPrescriberType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriberResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("prescriber_search", {
        ...(drugName.trim() ? { drug_name: drugName.trim() } : {}),
        ...(state ? { state } : {}),
        ...(prescriberType.trim() ? { prescriber_type: prescriberType.trim() } : {}),
        max_rows: 200,
      })) as PrescriberResult;
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
          <Pill className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h1 className="text-2xl font-bold tracking-tight">Prescriber Data</h1>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Medicare Part D prescribers by drug, state, or specialty</p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Drug Name (optional)</label>
          <Input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="e.g. Eliquis, Ozempic" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">State</label>
          <StateSelect value={state} onChange={setState} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Specialty (optional)</label>
          <Input value={prescriberType} onChange={(e) => setPrescriberType(e.target.value)} placeholder="e.g. Internal Medicine" />
        </div>
        <Button type="submit" disabled={loading}>
          <Search className="h-4 w-4 mr-1.5" />
          Search
        </Button>
      </form>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {result && !loading && (
        <>
          <Alert className="mb-4">
            <AlertDescription className="text-xs">
              {result.total} prescribers · Medicare Part D by Provider dataset from CMS
            </AlertDescription>
          </Alert>
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total Claims</TableHead>
                  <TableHead className="text-right">Brand Claims</TableHead>
                  <TableHead className="text-right">Generic Claims</TableHead>
                  <TableHead className="text-right">Drug Cost</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{row.prescriber_name || "—"}</TableCell>
                    <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">{row.prescriber_type || "—"}</TableCell>
                    <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt(row.total_claims)}</TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">{fmt(row.brand_claims ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">{fmt(row.generic_claims ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{dollars(row.total_drug_cost)}</TableCell>
                    <TableCell className="text-right text-sm text-[hsl(var(--muted-foreground))]">{fmt(row.total_beneficiaries)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-16 text-center">
          <Pill className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Enter filters above and click Search to view prescriber data</p>
        </div>
      )}
    </div>
  );
}
