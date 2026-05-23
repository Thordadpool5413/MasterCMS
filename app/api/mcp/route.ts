import { NextRequest, NextResponse } from "next/server";
import {
  getHospiceMarketShare,
  getHospitalOpportunity,
  getNursingHomeOpportunity,
  lookupNpi,
  getDrugSpending,
  searchPrescribers,
  searchNonprofits,
  getNonprofitDetail,
  searchClinicalTrials,
  getOpenFdaAdverseEvents,
  getOpenFdaDrugLabel,
  getCensusStateDemographics,
} from "@/lib/cms-direct";

export async function POST(req: NextRequest) {
  try {
    const { tool, args } = (await req.json()) as {
      tool: string;
      args: Record<string, unknown>;
    };

    if (!tool) return NextResponse.json({ error: "tool required" }, { status: 400 });

    let result: unknown;

    switch (tool) {
      // ── Existing ────────────────────────────────────────────────────────────
      case "hospice_market_share_proxy":
        result = await getHospiceMarketShare(
          args.state as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;
      case "hospital_hospice_opportunity":
        result = await getHospitalOpportunity(
          args.state as string | undefined,
          args.city as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;
      case "nursing_home_opportunity":
        result = await getNursingHomeOpportunity(
          args.state as string | undefined,
          args.city as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;
      case "lookup_npi":
        result = await lookupNpi(args as Parameters<typeof lookupNpi>[0]);
        break;
      case "drug_spending":
        result = await getDrugSpending(
          args.drug_name as string | undefined,
          (args.spending_type as "part_d" | "part_b") ?? "part_d",
          (args.max_rows as number | undefined) ?? 200,
        );
        break;
      case "prescriber_search":
        result = await searchPrescribers(
          args.drug_name as string | undefined,
          args.state as string | undefined,
          args.prescriber_type as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;

      // ── ProPublica 990 ──────────────────────────────────────────────────────
      case "search_nonprofits":
        result = await searchNonprofits(
          args.query as string,
          args.state as string | undefined,
        );
        break;
      case "get_nonprofit_detail":
        result = await getNonprofitDetail(args.ein as string);
        break;

      // ── ClinicalTrials.gov ──────────────────────────────────────────────────
      case "search_clinical_trials":
        result = await searchClinicalTrials(
          args.condition as string,
          args.state as string | undefined,
          args.status as string | undefined,
          (args.max_results as number | undefined) ?? 25,
        );
        break;

      // ── OpenFDA ─────────────────────────────────────────────────────────────
      case "get_fda_adverse_events":
        result = await getOpenFdaAdverseEvents(
          args.drug_name as string,
          (args.limit as number | undefined) ?? 12,
        );
        break;
      case "get_fda_drug_label":
        result = await getOpenFdaDrugLabel(args.drug_name as string);
        break;

      // ── Census ──────────────────────────────────────────────────────────────
      case "get_census_demographics":
        result = await getCensusStateDemographics(args.state as string);
        break;

      // ── Diagnostics ─────────────────────────────────────────────────────────
      case "debug_cms_columns": {
        const uuid = args.uuid as string ?? "4e73f1b5-82cb-4682-8ad2-28493f0b6840";
        const r = await fetch(`https://data.cms.gov/data-api/v1/dataset/${uuid}/data?size=1`, { signal: AbortSignal.timeout(15_000) });
        if (!r.ok) { result = { error: `HTTP ${r.status}`, uuid }; break; }
        const raw = await r.json();
        const rows = Array.isArray(raw) ? raw : Array.isArray((raw as Record<string,unknown>).data) ? (raw as Record<string,unknown>).data : raw;
        result = { uuid, response_type: Array.isArray(raw) ? "array" : typeof raw, first_row_keys: Array.isArray(rows) && rows.length > 0 ? Object.keys((rows as Record<string,unknown>[])[0]) : [], first_row: Array.isArray(rows) && rows.length > 0 ? (rows as Record<string,unknown>[])[0] : null };
        break;
      }

      // ── Cache stubs ─────────────────────────────────────────────────────────
      case "list_cached_national_datasets":
        result = { cached_datasets: [] };
        break;
      case "cache_core_national_datasets":
        result = { results: {}, note: "Data is fetched live from CMS APIs." };
        break;

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
