"use client";

import { Fragment, useState } from "react";
import { Search, Pill, FileQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StateSelect } from "@/components/shared/state-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DrugSafetyCard } from "@/components/shared/drug-safety-card";
import { ClinicalTrialsCard } from "@/components/shared/clinical-trials-card";
import { searchDrugSafety } from "@/lib/openfda";
import { searchClinicalTrials } from "@/lib/clinical-trials";
import { mcp } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DrugSafetyData } from "@/lib/openfda";
import type { ClinicalTrialsSearchResult } from "@/lib/clinical-trials";

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

function SafetyPanel({ drugName }: { drugName: string }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<DrugSafetyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const result = await searchDrugSafety(drugName);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load safety data");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  if (!loaded && !loading) load();

  if (loading) return <LoadingSpinner label="Loading FDA safety profile…" />;
  if (error) return <ErrorBanner message={error} />;

  return <DrugSafetyCard data={data} />;
}

function TrialsPanel({ drugName }: { drugName: string }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<ClinicalTrialsSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const result = await searchClinicalTrials(drugName);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinical trials");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  if (!loaded && !loading) load();

  if (loading) return <LoadingSpinner label="Loading clinical trials…" />;
  if (error) return <ErrorBanner message={error} />;

  return <ClinicalTrialsCard data={data} />;
}

function PrescriberDetail({ row, onClose }: { row: PrescriberRow; onClose: () => void }) {
  const [searchDrug, setSearchDrug] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-[hsl(var(--background))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Prescriber detail"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Prescriber</p>
            <h2 className="text-xl font-semibold">{row.prescriber_name || "—"}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">NPI: {row.npi}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drug-safety">Safety</TabsTrigger>
            <TabsTrigger value="drug-trials">Trials</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Specialty</dt>
                <dd className="mt-0.5 text-sm font-medium">{row.prescriber_type || "—"}</dd>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Location</dt>
                <dd className="mt-0.5 text-sm font-medium">{[row.city, row.state, row.zip].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Total Claims</dt>
                <dd className="mt-0.5 text-sm font-mono font-medium">{fmt(row.total_claims)}</dd>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Total Drug Cost</dt>
                <dd className="mt-0.5 text-sm font-mono font-medium">{dollars(row.total_drug_cost)}</dd>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Total Beneficiaries</dt>
                <dd className="mt-0.5 text-sm font-mono font-medium">{fmt(row.total_beneficiaries)}</dd>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] p-3">
                <dt className="text-xs text-[hsl(var(--muted-foreground))]">Brand/Generic Mix</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {row.brand_claims ? `${fmt(row.brand_claims)} / ${fmt(row.generic_claims ?? 0)}` : "—"}
                </dd>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="drug-safety" className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                Enter a drug name to view FDA safety data
              </label>
              <Input
                value={searchDrug}
                onChange={(e) => setSearchDrug(e.target.value)}
                placeholder="e.g. Eliquis, Ozempic, Metformin"
                className="mb-4"
              />
            </div>
            {searchDrug.trim() ? (
              <SafetyPanel drugName={searchDrug.trim()} />
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Enter a drug name above to view FDA FAERS safety profile, adverse events, and top reactions.
              </p>
            )}
          </TabsContent>

          <TabsContent value="drug-trials" className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                Enter a drug name to view clinical trials
              </label>
              <Input
                value={searchDrug}
                onChange={(e) => setSearchDrug(e.target.value)}
                placeholder="e.g. Eliquis, Ozempic, Metformin"
                className="mb-4"
              />
            </div>
            {searchDrug.trim() ? (
              <TrialsPanel drugName={searchDrug.trim()} />
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Enter a drug name above to view active and completed clinical trials on ClinicalTrials.gov.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function PrescribersPage() {
  const [drugName, setDrugName] = useState("");
  const [state, setState] = useState("");
  const [prescriberType, setPrescriberType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriberResult | null>(null);
  const [selectedPrescriber, setSelectedPrescriber] = useState<PrescriberRow | null>(null);

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
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Medicare Part D prescribers by drug, state, or specialty
        </p>
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
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {result && !loading && result.rows.length === 0 && (
        <EmptyState
          icon={FileQuestion}
          title="No matching prescribers"
          description={
            drugName || state || prescriberType
              ? "No Medicare Part D prescribers matched these filters. Try broadening the search — drop a filter, or use a more general specialty (e.g., 'Internal Medicine')."
              : "Choose at least a state or a drug name to search."
          }
        />
      )}

      {result && !loading && result.rows.length > 0 && (
        <>
          <Alert className="mb-4">
            <AlertDescription className="text-xs">
              Top {result.rows.length} of {result.total.toLocaleString()} prescribers by claim volume · Medicare Part D · Source: CMS
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
                  <TableRow
                    key={i}
                    className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                    onClick={() => setSelectedPrescriber(row)}
                  >
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

      {selectedPrescriber && <PrescriberDetail row={selectedPrescriber} onClose={() => setSelectedPrescriber(null)} />}
    </div>
  );
}
