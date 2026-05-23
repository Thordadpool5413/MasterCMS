import { Router } from "express";
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
} from "../lib/cms-direct.js";

const router = Router();

router.post("/mcp", async (req, res) => {
  try {
    const { tool, args } = req.body as { tool: string; args: Record<string, unknown> };

    if (!tool) {
      res.status(400).json({ error: "tool required" });
      return;
    }

    let result: unknown;

    switch (tool) {
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

      case "search_nonprofits":
        result = await searchNonprofits(
          args.query as string,
          args.state as string | undefined,
        );
        break;

      case "get_nonprofit_detail":
        result = await getNonprofitDetail(args.ein as string);
        break;

      case "search_clinical_trials":
        result = await searchClinicalTrials(
          args.condition as string,
          args.state as string | undefined,
          args.status as string | undefined,
          (args.max_results as number | undefined) ?? 25,
        );
        break;

      case "get_fda_adverse_events":
        result = await getOpenFdaAdverseEvents(
          args.drug_name as string,
          (args.limit as number | undefined) ?? 12,
        );
        break;

      case "get_fda_drug_label":
        result = await getOpenFdaDrugLabel(args.drug_name as string);
        break;

      case "get_census_demographics":
        result = await getCensusStateDemographics(args.state as string);
        break;

      case "list_cached_national_datasets":
        result = { cached_datasets: [] };
        break;

      case "cache_core_national_datasets":
        result = { results: {}, note: "Data is fetched live from CMS APIs." };
        break;

      default:
        res.status(400).json({ error: `Unknown tool: ${tool}` });
        return;
    }

    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
