"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Download, X, ArrowUp, ArrowDown, ArrowUpDown, FileQuestion, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HospiceResult, HospiceRow, HospiceGroupBy, HospiceProviderDetail, HospiceMeasureScore } from "@/lib/cms-direct";
import { HOSPICE_DX_LABELS } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function ShareBar({ pct }: { pct: number }) {
  const width = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[hsl(var(--border))]">
        <div className="h-2 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Score formatting ────────────────────────────────────────────────────────
//
// CMS measure values arrive as bare strings; the unit varies by measure_code.
// Most HIS, HCI sub-OBSERVED, CAHPS, profile fields are percentages; a handful
// are dollars (per-bene spending), minutes (nurse-care time), counts (census),
// or a 0-10 score (HCI overall). Render appropriately.

const MEASURE_DOLLAR_CODES = new Set(["H_012_07_OBSERVED"]);
const MEASURE_MINUTE_CODES = new Set(["H_012_08_OBSERVED"]);
const MEASURE_COUNT_CODES = new Set(["Average_Daily_Census"]);
const MEASURE_OUT_OF_10_CODES = new Set(["H_012_00_OBSERVED"]);

function isPercentileCode(code: string): boolean {
  return /^H_012_\d{2}_PERCENTILE$/.test(code);
}
function isDenominatorCode(code: string): boolean {
  return /_DENOMINATOR$/.test(code);
}
function defaultsToPct(code: string): boolean {
  // Treat anything HIS-OBSERVED (H_001..H_011), HCI sub-OBSERVED (excl. dollar/minute/score above),
  // case-mix percentages, care-location percentages, and CAHPS box variants as %.
  if (/^H_0(0[1-8]|11)_01_OBSERVED$/.test(code)) return true;
  if (/^H_012_\d{2}_OBSERVED$/.test(code)) return true;
  if (/^Pct_/.test(code)) return true;
  if (/^Care_Provided_/.test(code)) return true;
  if (/^Provided_Home_Care/.test(code)) return true;
  if (/^Bene_.+_Pct$/.test(code)) return true;
  if (/_(TBV|MBV|BBV)$/.test(code)) return true;
  return false;
}

function formatScore(code: string, score: string | undefined, starRating?: string): string {
  const s = (score ?? "").trim();
  if (code === "SUMMARY_STAR_RATING") {
    const star = (starRating ?? "").trim();
    if (!star || star === "Not Available" || star === "Not Applicable") return "—";
    return `${star} / 5 stars`;
  }
  if (!s || s === "Not Applicable" || s === "Not Available") return "—";
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  if (MEASURE_DOLLAR_CODES.has(code)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  if (MEASURE_MINUTE_CODES.has(code)) return `${n.toLocaleString()} min`;
  if (MEASURE_COUNT_CODES.has(code)) return n.toLocaleString();
  if (MEASURE_OUT_OF_10_CODES.has(code)) return `${n} / 10`;
  if (isPercentileCode(code)) return `${n}${getOrdinal(n)} %ile`;
  if (defaultsToPct(code)) return `${n}%`;
  return n.toLocaleString();
}

function getOrdinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
}

// CAHPS topic grouping. Each topic has TBV (top box), MBV (middle), BBV (bottom).
const CAHPS_TOPICS: { key: string; label: string; tbv_label: string; mbv_label: string; bbv_label: string }[] = [
  { key: "RATING", label: "Overall rating", tbv_label: "9-10 (best)", mbv_label: "7-8", bbv_label: "0-6" },
  { key: "RECOMMEND", label: "Would recommend", tbv_label: "Definitely yes", mbv_label: "Probably yes", bbv_label: "Probably/definitely no" },
  { key: "RESPECT", label: "Treated with respect", tbv_label: "Always", mbv_label: "Usually", bbv_label: "Sometimes/Never" },
  { key: "SYMPTOMS", label: "Help with pain & symptoms", tbv_label: "Always", mbv_label: "Usually", bbv_label: "Sometimes/Never" },
  { key: "TEAM_COMM", label: "Team communication", tbv_label: "Always", mbv_label: "Usually", bbv_label: "Sometimes/Never" },
  { key: "TIMELY_CARE", label: "Timely help", tbv_label: "Always", mbv_label: "Usually", bbv_label: "Sometimes/Never" },
  { key: "EMO_REL", label: "Emotional/spiritual support", tbv_label: "Right amount", mbv_label: "Middle", bbv_label: "Not enough" },
];

function StarRating({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
  return (
    <div className="flex items-center gap-0.5" title={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-[hsl(var(--muted-foreground))]/30"}`}
        />
      ))}
    </div>
  );
}

function OwnershipBadge({ kind }: { kind: string | null | undefined }) {
  if (!kind) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
  const k = kind.toLowerCase();
  const variant: "success" | "warning" | "secondary" =
    k.includes("non-profit") || k.includes("nonprofit") ? "success" :
    k.includes("for-profit") || k.includes("for profit") ? "warning" : "secondary";
  return <Badge variant={variant}>{kind}</Badge>;
}

function HciCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
  const tone =
    value >= 7 ? "bg-green-100 text-green-800" :
    value >= 4 ? "bg-amber-100 text-amber-800" :
    "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {value} / 10
    </span>
  );
}

function SpecialtyBadge({ row }: { row: HospiceRow }) {
  const label = row._dominant_dx_label;
  const pct = row._dominant_dx_pct ?? 0;
  if (!label || pct < 35) return <span className="text-xs text-[hsl(var(--muted-foreground))]">Diversified</span>;
  let short = label, tone: "secondary" | "success" | "warning" = "secondary";
  if (label.includes("Cancer")) { short = "Cancer-heavy"; tone = "warning"; }
  else if (label.includes("Nervous")) { short = "Dementia-heavy"; tone = "secondary"; }
  else if (label.includes("Circulatory")) { short = "Heart-heavy"; tone = "warning"; }
  else if (label.includes("Respiratory")) { short = "Respiratory"; tone = "secondary"; }
  return <Badge variant={tone} title={`${label}: ${pct}%`}>{short}</Badge>;
}

function HhiLabel({ hhi }: { hhi: number }) {
  // DOJ guidelines: <1500 unconcentrated, 1500-2500 moderate, >2500 high.
  const [tone, label] =
    hhi < 1500 ? ["text-green-700", "Unconcentrated"] :
    hhi < 2500 ? ["text-amber-700", "Moderately concentrated"] :
    ["text-red-700", "Highly concentrated"];
  return (
    <span className={`text-xs font-medium ${tone}`}>{label} ({formatNumber(hhi)})</span>
  );
}

type SortKey =
  | "_rank" | "_provider_name" | "_city" | "_state"
  | "_market_volume" | "_market_share_pct"
  | "_payment" | "_payment_per_bene" | "_avg_los"
  | "_avg_age" | "_risk_score"
  | "star_rating" | "ownership_type" | "hci_overall";
type SortDir = "asc" | "desc";

const SORTABLE_COLS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "_rank", label: "#" },
  { key: "_provider_name", label: "Provider" },
  { key: "_city", label: "City" },
  { key: "_state", label: "State" },
  { key: "_market_volume", label: "Benes", align: "right" },
  { key: "_market_share_pct", label: "Share" },
  { key: "star_rating", label: "CAHPS" },
  { key: "hci_overall", label: "HCI" },
  { key: "ownership_type", label: "Ownership" },
  { key: "_payment_per_bene", label: "$/Bene", align: "right" },
  { key: "_avg_los", label: "LOS", align: "right" },
  { key: "_avg_age", label: "Avg Age", align: "right" },
  { key: "_risk_score", label: "Risk", align: "right" },
];

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: HospiceRow[], filename: string) {
  const headers = [
    "Rank","CCN","Provider","DBA","City","State","ZIP","County","Phone","Ownership",
    "Beneficiaries","Market","Market Total","Market Share %","CAHPS Stars","HCI Overall","HIS Composite",
    "Medicare $","Standardized $","$/Bene","$/Day","Avg LOS","Episodes/Bene",
    "Nrsng Visits","Aide Visits","MSW Visits","Visit Mix Nrsng %","Visit Mix Aide %","Visit Mix MSW %",
    "Avg Age","Risk Score","Dual %","Rural %","RHC Days %",
    "Dominant DX","Dominant DX %","DX Concentration HHI",
    "Year",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r._rank, r._provider_id, r._provider_name, "", r._city, r._state, r._zip, r.county ?? "", r.phone ?? "", r.ownership_type ?? "",
      r._market_volume, r._market, r._market_total_volume, r._market_share_pct, r.star_rating ?? "", r.hci_overall ?? "", r.his_composite ?? "",
      r._payment, r._standardized_payment, r._payment_per_bene, r._payment_per_day, r._avg_los, r._episodes_per_bene,
      r.NRSNG_VISITS_CNT ?? "", r.AIDE_VISITS_CNT ?? "", r.MSW_VISITS_CNT ?? "", r._visit_mix_nrsng_pct, r._visit_mix_aide_pct, r._visit_mix_msw_pct,
      r._avg_age, r._risk_score, r.BENE_DUAL_PCT ?? "", r.BENE_RRL_PCT ?? "", r._routine_home_care_pct,
      r._dominant_dx_label, r._dominant_dx_pct, r._dx_concentration,
      r._year,
    ].map(escapeCsv).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Provider detail drawer ─────────────────────────────────────────────────

function FactGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((f) => (
        <div key={f.label} className="rounded-md border border-[hsl(var(--border))] p-3">
          <dt className="text-xs text-[hsl(var(--muted-foreground))]">{f.label}</dt>
          <dd className="mt-0.5 text-sm font-medium">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Renders a measure table where each visible row is a single OBSERVED/PERCENTILE
// measure, with its DENOMINATOR (sample size) shown inline as "n = X". Denominator
// rows are not rendered separately.
function MeasureTable({ measures }: { measures: HospiceMeasureScore[] }) {
  if (!measures.length) return <p className="text-sm text-[hsl(var(--muted-foreground))]">No measures reported.</p>;

  // Index denominators by their measure family (everything before _DENOMINATOR).
  const denomByFamily = new Map<string, string>();
  for (const m of measures) {
    if (isDenominatorCode(m.measure_code)) {
      const family = m.measure_code.replace(/_DENOMINATOR$/, "");
      denomByFamily.set(family, m.score);
    }
  }

  // Pair OBSERVED/PERCENTILE rows with their denominator and hide bare denominators.
  const visible = measures.filter((m) => !isDenominatorCode(m.measure_code));
  if (!visible.length) return <p className="text-sm text-[hsl(var(--muted-foreground))]">No measures reported.</p>;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Measure</TableHead>
            <TableHead className="w-32 text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((m) => {
            const family = m.measure_code.replace(/_(OBSERVED|PERCENTILE)$/, "");
            const denom = denomByFamily.get(family);
            const denomNum = denom ? parseFloat(denom) : NaN;
            return (
              <TableRow key={m.measure_code}>
                <TableCell className="text-sm">
                  <div className="font-medium">{m.measure_name || m.measure_code}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {m.measure_code}
                    {!isNaN(denomNum) && denomNum > 0 ? ` · n=${denomNum.toLocaleString()}` : ""}
                    {m.date_range ? ` · ${m.date_range}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatScore(m.measure_code, m.score, m.star_rating)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// CAHPS view groups the 22 measures into 7 topics × 3 boxes (top/middle/bottom)
// and overlays national benchmarks for each top-box score.
function CahpsTable({
  measures, nationalBenchmark,
}: { measures: HospiceMeasureScore[]; nationalBenchmark: Record<string, string> }) {
  const byCode = new Map<string, HospiceMeasureScore>();
  for (const m of measures) byCode.set(m.measure_code, m);
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead className="text-right">Top box</TableHead>
            <TableHead className="text-right">Middle</TableHead>
            <TableHead className="text-right">Bottom</TableHead>
            <TableHead className="text-right text-xs">National top-box</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CAHPS_TOPICS.map((t) => {
            const top = byCode.get(`${t.key}_TBV`);
            const mid = byCode.get(`${t.key}_MBV`);
            const bot = byCode.get(`${t.key}_BBV`);
            const natTopRaw = nationalBenchmark[`${t.key}_TBV`];
            const natTop = formatScore(`${t.key}_TBV`, natTopRaw);
            return (
              <TableRow key={t.key}>
                <TableCell className="text-sm">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t.tbv_label} / {t.mbv_label} / {t.bbv_label}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatScore(top?.measure_code ?? `${t.key}_TBV`, top?.score)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatScore(mid?.measure_code ?? `${t.key}_MBV`, mid?.score)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatScore(bot?.measure_code ?? `${t.key}_BBV`, bot?.score)}</TableCell>
                <TableCell className="text-right tabular-nums text-xs text-[hsl(var(--muted-foreground))]">{natTop}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DxMixBar({ row }: { row: HospiceRow }) {
  // Build a horizontal stacked bar of DX percentages.
  const segs = Object.keys(HOSPICE_DX_LABELS)
    .map((f) => ({ field: f, label: HOSPICE_DX_LABELS[f], pct: parseFloat(String(row[f] ?? "0")) || 0 }))
    .filter((s) => s.pct > 0)
    .sort((a, b) => b.pct - a.pct);
  if (!segs.length) return <p className="text-sm text-[hsl(var(--muted-foreground))]">No diagnosis data reported.</p>;
  const palette = ["#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7","#eab308","#64748b","#71717a","#525252"];
  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-md border border-[hsl(var(--border))]">
        {segs.map((s, i) => (
          <div key={s.field} title={`${s.label}: ${s.pct}%`} style={{ width: `${s.pct}%`, background: palette[i % palette.length] }} />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {segs.map((s, i) => (
          <li key={s.field} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 truncate">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: palette[i % palette.length] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-medium tabular-nums">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProviderDetail({ row, onClose }: { row: HospiceRow; onClose: () => void }) {
  const [detail, setDetail] = useState<HospiceProviderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!row._provider_id) return;
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    (async () => {
      try {
        const d = (await mcp("hospice_provider_detail", { ccn: row._provider_id })) as HospiceProviderDetail;
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : "Failed to load detail");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row._provider_id]);

  const overview: { label: string; value: React.ReactNode }[] = [
    { label: "CCN", value: row._provider_id || "—" },
    { label: "NPI", value: detail?.enrollment?.npi || "—" },
    { label: "Doing Business As", value: detail?.enrollment?.doing_business_as || "—" },
    { label: "Address", value: detail?.general_info ? `${detail.general_info.address}, ${detail.general_info.city}, ${detail.general_info.state} ${detail.general_info.zip}` : `${row._city}, ${row._state} ${row._zip}` },
    { label: "County", value: detail?.general_info?.county || row.county || "—" },
    { label: "Phone", value: detail?.general_info?.phone || row.phone || "—" },
    { label: "Ownership", value: <OwnershipBadge kind={detail?.general_info?.ownership_type || row.ownership_type || ""} /> },
    { label: "Org structure", value: detail?.enrollment?.org_type_structure || "—" },
    { label: "Certification Date", value: detail?.general_info?.certification_date || row.certification_date || "—" },
    { label: "CMS Region", value: detail?.general_info?.cms_region || row.cms_region || "—" },
    { label: "Year (claims)", value: row._year || "—" },
    { label: "Market Share", value: `${row._market_share_pct.toFixed(1)}% of ${row._market}` },
  ];

  const clinical: { label: string; value: React.ReactNode }[] = [
    { label: "Distinct Beneficiaries", value: formatNumber(row._market_volume) },
    { label: "Episodes of Care", value: formatNumber(Number(row.TOT_EPSD_STAY_CNT ?? 0)) },
    { label: "Total Service Days", value: formatNumber(Number(row.TOT_SRVC_DAYS ?? 0)) },
    { label: "Avg Length of Stay", value: row._avg_los ? `${row._avg_los} days` : "—" },
    { label: "Episodes / Beneficiary", value: row._episodes_per_bene || "—" },
    { label: "Routine Home Care Days", value: fmtPct(row._routine_home_care_pct) },
    { label: "Nursing Visits", value: formatNumber(Number(row.NRSNG_VISITS_CNT ?? 0)) },
    { label: "Aide Visits", value: formatNumber(Number(row.AIDE_VISITS_CNT ?? 0)) },
    { label: "MSW Visits", value: formatNumber(Number(row.MSW_VISITS_CNT ?? 0)) },
    { label: "Visits / Beneficiary", value: row._visits_per_bene || "—" },
    { label: "Nursing Minutes / Bene", value: formatNumber(row._nursing_minutes_per_bene) },
    { label: "Visit Mix (Nrsng/Aide/MSW)", value: `${row._visit_mix_nrsng_pct}% / ${row._visit_mix_aide_pct}% / ${row._visit_mix_msw_pct}%` },
    { label: "Avg Risk Score", value: row._risk_score ? row._risk_score.toFixed(2) : "—" },
    { label: "Avg Age", value: row._avg_age ? row._avg_age.toFixed(1) : "—" },
    { label: "Dual-Eligible %", value: row.BENE_DUAL_PCT != null ? `${row.BENE_DUAL_PCT}%` : "—" },
    { label: "Rural %", value: row.BENE_RRL_PCT != null ? `${row.BENE_RRL_PCT}%` : "—" },
    { label: "Female %", value: row.BENE_FEML_PCT != null ? `${row.BENE_FEML_PCT}%` : "—" },
    { label: "Dominant Diagnosis", value: row._dominant_dx_label ? `${row._dominant_dx_label} — ${row._dominant_dx_pct}%` : "—" },
  ];

  const financial: { label: string; value: React.ReactNode }[] = [
    { label: "Total Medicare Payment", value: currency(row._payment) },
    { label: "Standardized Payment", value: row._standardized_payment ? currency(row._standardized_payment) : "—" },
    { label: "Total Allowed Amount", value: row._allowed_amount ? currency(row._allowed_amount) : "—" },
    { label: "Total Charges", value: row._total_charges ? currency(row._total_charges) : "—" },
    { label: "Payment / Beneficiary", value: currency(row._payment_per_bene) },
    { label: "Payment / Day", value: currency(row._payment_per_day) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-[hsl(var(--background))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Provider detail"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Hospice provider</p>
            <h2 className="text-xl font-semibold">{row._provider_name || "—"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
              <span>CCN {row._provider_id}</span>
              <span>·</span>
              <span>{row._city}, {row._state}</span>
              {row.star_rating != null && (<><span>·</span><StarRating value={row.star_rating} /></>)}
              {row.ownership_type && (<><span>·</span><OwnershipBadge kind={row.ownership_type} /></>)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {detailError && <ErrorBanner message={detailError} onDismiss={() => setDetailError(null)} className="mb-4" />}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clinical">Clinical</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="cahps">CAHPS</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="area">Service Area</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <FactGrid items={overview} />
          </TabsContent>

          <TabsContent value="clinical" className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Primary diagnosis mix</p>
              <DxMixBar row={row} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Clinical operations</p>
              <FactGrid items={clinical} />
            </div>
          </TabsContent>

          <TabsContent value="financial">
            <FactGrid items={financial} />
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            {loadingDetail ? <LoadingSpinner label="Loading quality measures…" /> : (
              <>
                <div>
                  <p className="mb-1 text-sm font-medium">Hospice Care Index — overall</p>
                  <p className="text-2xl font-bold tabular-nums">{row.hci_overall != null ? `${row.hci_overall} / 10` : "—"}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">HCI rolls up 10 indicators of care quality from Medicare claims.</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">HIS process measures (Hospice Item Set)</p>
                  <MeasureTable measures={detail?.his_measures ?? []} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">HCI sub-indicators</p>
                  <MeasureTable measures={detail?.hci_measures ?? []} />
                </div>
                {detail?.profile && detail.profile.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Profile fields</p>
                    <MeasureTable measures={detail.profile} />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="cahps" className="space-y-4">
            {loadingDetail ? <LoadingSpinner label="Loading CAHPS data…" /> : (
              <>
                <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Family caregiver star rating</p>
                  <div className="mt-1 flex items-center gap-3">
                    <StarRating value={row.star_rating ?? null} />
                    <span className="text-sm font-medium">{row.star_rating != null ? `${row.star_rating} of 5` : "Not available"}</span>
                  </div>
                </div>
                <CahpsTable
                  measures={(detail?.cahps ?? []).filter((m) => m.measure_code !== "SUMMARY_STAR_RATING")}
                  nationalBenchmark={detail?.cahps_national ?? {}}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Source: CMS CAHPS Hospice Survey. Top-box scores reflect the best response category for each question.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="ownership" className="space-y-4">
            {loadingDetail ? <LoadingSpinner label="Loading ownership data…" /> : (
              <>
                {detail?.enrollment && (
                  <FactGrid items={[
                    { label: "NPI", value: detail.enrollment.npi || "—" },
                    { label: "Org Structure", value: detail.enrollment.org_type_structure || "—" },
                    { label: "Incorporation", value: `${detail.enrollment.incorporation_date || "—"} (${detail.enrollment.incorporation_state || "—"})` },
                    { label: "Proprietary / Non-Profit", value: detail.enrollment.proprietary_nonprofit || "—" },
                  ]} />
                )}
                {detail?.owners && detail.owners.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Owners ({detail.owners.length})</p>
                    <div className="space-y-3">
                      {detail.owners.map((o, i) => (
                        <div key={i} className="rounded-md border border-[hsl(var(--border))] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{o.owner_name || "—"}</p>
                              {o.owner_dba && <p className="text-xs text-[hsl(var(--muted-foreground))]">DBA: {o.owner_dba}</p>}
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{o.owner_address}{o.owner_city ? `, ${o.owner_city}, ${o.owner_state} ${o.owner_zip}` : ""}</p>
                              {o.role_text && <p className="mt-1 text-xs">{o.role_text}</p>}
                            </div>
                            <div className="text-right">
                              {o.percentage_ownership && <p className="text-sm font-semibold">{o.percentage_ownership}%</p>}
                              {o.association_date && <p className="text-xs text-[hsl(var(--muted-foreground))]">since {o.association_date}</p>}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {o.private_equity && <Badge variant="destructive">Private Equity</Badge>}
                            {o.reit && <Badge variant="destructive">REIT</Badge>}
                            {o.chain_home_office && <Badge variant="warning">Chain Home Office</Badge>}
                            {o.holding_company && <Badge variant="warning">Holding Co</Badge>}
                            {o.investment_firm && <Badge variant="warning">Investment Firm</Badge>}
                            {o.management_services && <Badge variant="secondary">Mgmt Services</Badge>}
                            {o.for_profit && <Badge variant="warning">For-Profit</Badge>}
                            {o.non_profit && <Badge variant="success">Non-Profit</Badge>}
                            {o.corporation && <Badge variant="secondary">Corporation</Badge>}
                            {o.llc && <Badge variant="secondary">LLC</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-[hsl(var(--muted-foreground))]">No owner records found.</p>}
              </>
            )}
          </TabsContent>

          <TabsContent value="area">
            {loadingDetail ? <LoadingSpinner label="Loading service area…" /> : (
              detail?.service_area_zips && detail.service_area_zips.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Service area — {formatNumber(detail.service_area_zips.length)} ZIPs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.service_area_zips.slice(0, 200).map((z) => (
                      <Badge key={z} variant="secondary">{z}</Badge>
                    ))}
                    {detail.service_area_zips.length > 200 && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">+ {detail.service_area_zips.length - 200} more</span>
                    )}
                  </div>
                </div>
              ) : <p className="text-sm text-[hsl(var(--muted-foreground))]">No service area ZIPs reported.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SortHeader({
  col, sort, dir, onSort,
}: { col: { key: SortKey; label: string; align?: "right" }; sort: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = sort === col.key;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={col.align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onSort(col.key)}
        className={`inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))] ${active ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}
      >
        <span>{col.label}</span>
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function HospiceMarketView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlState = searchParams.get("state") ?? "";
  const urlGroupBy = (searchParams.get("group_by") as HospiceGroupBy | null) ?? "state";
  const urlYear = searchParams.get("year") ?? "";
  const urlQ = searchParams.get("q") ?? "";
  const urlSort = (searchParams.get("sort") as SortKey | null) ?? "_market_share_pct";
  const urlDir = (searchParams.get("dir") as SortDir | null) ?? "desc";

  const [stateInput, setStateInput] = useState(urlState);
  const [searchInput, setSearchInput] = useState(urlQ);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospiceResult | null>(null);
  const [selectedRow, setSelectedRow] = useState<HospiceRow | null>(null);

  const cacheRef = useRef<Map<string, HospiceResult>>(new Map());

  const updateUrl = useCallback((next: Partial<Record<string, string>>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const cacheKey = `${urlState}|${urlYear}|${urlGroupBy}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) { setResult(cached); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = (await mcp("hospice_market_share_proxy", {
          ...(urlState ? { state: urlState } : {}),
          ...(urlYear ? { year: urlYear } : {}),
          group_by: urlGroupBy,
          max_rows: 2000,
        })) as HospiceResult;
        if (cancelled) return;
        cacheRef.current.set(cacheKey, data);
        setResult(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [urlState, urlYear, urlGroupBy]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== urlQ) updateUrl({ q: searchInput });
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput, urlQ, updateUrl]);

  const visibleRows = useMemo<HospiceRow[]>(() => {
    if (!result) return [];
    const q = urlQ.trim().toLowerCase();
    let rows: HospiceRow[] = result.rows;
    if (q) {
      rows = rows.filter((r) =>
        r._provider_name.toLowerCase().includes(q) ||
        (r.doing_business_as ?? "").toLowerCase().includes(q) ||
        r._city.toLowerCase().includes(q) ||
        r._zip.includes(q) ||
        r._provider_id.toLowerCase().includes(q) ||
        (r.npi ?? "").includes(q) ||
        (r.county ?? "").toLowerCase().includes(q) ||
        (r.ownership_type ?? "").toLowerCase().includes(q),
      );
    }
    const dir = urlDir === "asc" ? 1 : -1;
    const k = urlSort;
    rows = [...rows].sort((a, b) => {
      const va = a[k] as unknown;
      const vb = b[k] as unknown;
      // Null/undefined sort last regardless of direction.
      const aNull = va == null || va === "";
      const bNull = vb == null || vb === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return rows;
  }, [result, urlQ, urlSort, urlDir]);

  const onSort = (key: SortKey) => {
    if (urlSort === key) {
      updateUrl({ dir: urlDir === "asc" ? "desc" : "asc" });
    } else {
      const ascByDefault = key === "_provider_name" || key === "_city" || key === "_state" || key === "ownership_type";
      updateUrl({ sort: key, dir: ascByDefault ? "asc" : "desc" });
    }
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ state: stateInput, q: searchInput });
  };

  const onExportCsv = () => {
    const filename = `hospice-${urlState || "all"}-${urlYear || result?.year_used || "latest"}.csv`;
    downloadCsv(visibleRows, filename);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization + Care Compare quality + ownership.
          Click any provider row for the full clinical/quality/CAHPS/ownership/service-area breakdown.
        </p>
      </div>

      <form onSubmit={onSubmitSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">State</label>
          <StateSelect value={stateInput} onChange={setStateInput} placeholder="All states" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Group market by</label>
          <select
            value={urlGroupBy}
            onChange={(e) => updateUrl({ group_by: e.target.value })}
            className="h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <option value="state">State</option>
            <option value="city">City</option>
          </select>
        </div>

        {result && result.years_available.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Year</label>
            <select
              value={urlYear || result.year_used}
              onChange={(e) => updateUrl({ year: e.target.value })}
              className="h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {result.years_available.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-1 min-w-[200px] flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Search</label>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name, DBA, city, ZIP, CCN, NPI, county, ownership"
          />
        </div>

        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Apply
        </Button>
        <Button type="button" variant="outline" disabled={!visibleRows.length} onClick={onExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching hospice market + Care Compare data…" />}

      {!loading && result && (
        <>
          {result.state_summary && (
            <div className="mb-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4">
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {result.state_summary.state} state context · {result.year_used}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">State Beneficiaries</p>
                  <p className="text-base font-semibold">{formatNumber(result.state_summary.total_beneficiaries)}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">State Medicare $</p>
                  <p className="text-base font-semibold">{currency(result.state_summary.total_medicare_payment)}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Standardized $</p>
                  <p className="text-base font-semibold">{result.state_summary.total_standardized_payment ? currency(result.state_summary.total_standardized_payment) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Providers</p>
                  <p className="text-base font-semibold">{formatNumber(result.state_summary.provider_count)}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Market HHI</p>
                  <p><HhiLabel hhi={result.state_summary.market_hhi} /></p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Showing", value: `${formatNumber(visibleRows.length)} / ${formatNumber(result.rows.length)}` },
              { label: "Total Beneficiaries", value: formatNumber(result.total_volume) },
              { label: "Markets", value: formatNumber(Object.keys(result.market_totals).length) },
              { label: "Care Compare match", value: `${formatNumber(result.care_compare_enriched)} / ${formatNumber(result.total_provider_count)}` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="No providers match"
              description={
                urlQ
                  ? `No results for "${urlQ}". Clear the search or change the state filter.`
                  : result.interpretation_note
              }
            />
          ) : (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {SORTABLE_COLS.map((c) => (
                      <SortHeader key={c.key} col={c} sort={urlSort} dir={urlDir} onSort={onSort} />
                    ))}
                    <TableHead>Dominant DX</TableHead>
                    <TableHead>Market</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, i) => (
                    <TableRow
                      key={`${row._provider_id || row._provider_name}-${i}`}
                      className="cursor-pointer hover:bg-[hsl(var(--muted))]/40"
                      onClick={() => setSelectedRow(row)}
                    >
                      <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{row._rank}</TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate" title={row._provider_name}>
                        {row._provider_name || "—"}
                      </TableCell>
                      <TableCell>{row._city || "—"}</TableCell>
                      <TableCell>{row._state || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row._market_volume)}</TableCell>
                      <TableCell><ShareBar pct={row._market_share_pct} /></TableCell>
                      <TableCell><StarRating value={row.star_rating ?? null} /></TableCell>
                      <TableCell><HciCell value={row.hci_overall ?? null} /></TableCell>
                      <TableCell><OwnershipBadge kind={row.ownership_type} /></TableCell>
                      <TableCell className="text-right tabular-nums">{row._payment_per_bene ? currency(row._payment_per_bene) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row._avg_los || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row._avg_age ? row._avg_age.toFixed(1) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row._risk_score ? row._risk_score.toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-xs max-w-[160px]" title={row._dominant_dx_label ? `${row._dominant_dx_label}: ${row._dominant_dx_pct}%` : ""}>
                        <SpecialtyBadge row={row} />
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs" title={row._market}>{row._market}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="mt-4">
            <AlertDescription>{result.interpretation_note}</AlertDescription>
          </Alert>
        </>
      )}

      {selectedRow && <ProviderDetail row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

export default function HospiceMarketPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading…" />}>
      <HospiceMarketView />
    </Suspense>
  );
}
