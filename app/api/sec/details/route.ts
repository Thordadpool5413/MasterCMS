import { NextRequest, NextResponse } from "next/server";

const UA = "MasterCMS-App nick.lynch.coaching@outlook.com";

const SEC_SUBMISSIONS = "https://data.sec.gov/submissions";
const SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts";

type GaapFacts = Record<string, {
  units?: {
    USD?: Array<{ end: string; val: number; fy: number; fp: string; form: string }>;
    "USD/shares"?: Array<{ end: string; val: number; fy: number; fp: string; form: string }>;
  };
}>;

function getAnnual(gaap: GaapFacts, ...keys: string[]) {
  for (const key of keys) {
    const entries = gaap[key]?.units?.USD;
    if (entries?.length) {
      const annual = entries
        .filter((d) => d.form.startsWith("10-K") && d.fy > 2000)
        .sort((a, b) => b.fy - a.fy || b.end.localeCompare(a.end));
      // Deduplicate by fiscal year — keep first (most recent filing for that FY)
      const seen = new Set<number>();
      const deduped = annual.filter((d) => {
        if (seen.has(d.fy)) return false;
        seen.add(d.fy);
        return true;
      });
      if (deduped.length) return deduped.slice(0, 7);
    }
  }
  return [];
}

function getAnnualShares(gaap: GaapFacts, ...keys: string[]) {
  for (const key of keys) {
    const entries = gaap[key]?.units?.["USD/shares"];
    if (entries?.length) {
      const annual = entries
        .filter((d) => d.form.startsWith("10-K") && d.fy > 2000)
        .sort((a, b) => b.fy - a.fy);
      const seen = new Set<number>();
      return annual.filter((d) => { if (seen.has(d.fy)) return false; seen.add(d.fy); return true; }).slice(0, 7);
    }
  }
  return [];
}

function extractFinancials(gaap: GaapFacts) {
  const years = new Map<number, Record<string, number | undefined> & { year: number }>();
  const merge = (entries: Array<{ fy: number; val: number }>, field: string) => {
    for (const e of entries) {
      if (!years.has(e.fy)) years.set(e.fy, { year: e.fy });
      years.get(e.fy)![field] = e.val;
    }
  };

  merge(getAnnual(gaap, "Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet", "HealthCareOrganizationRevenue",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense"), "revenues");
  merge(getAnnual(gaap, "NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"), "net_income");
  merge(getAnnual(gaap, "OperatingIncomeLoss"), "operating_income");
  merge(getAnnual(gaap, "Assets"), "total_assets");
  merge(getAnnual(gaap, "Liabilities"), "total_liabilities");
  merge(getAnnual(gaap, "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"), "stockholders_equity");
  merge(getAnnualShares(gaap, "EarningsPerShareBasic"), "eps_basic");

  return Array.from(years.values())
    .filter((y) => y.revenues || y.net_income || y.total_assets)
    .sort((a, b) => b.year - a.year)
    .slice(0, 7);
}

export async function GET(req: NextRequest) {
  const cik = req.nextUrl.searchParams.get("cik") ?? "";
  if (!cik) return NextResponse.json(null);

  const paddedCik = cik.padStart(10, "0");
  const cikNum = parseInt(paddedCik, 10);
  const headers = { "User-Agent": UA, "Accept": "application/json" };

  try {
    const [subRes, factsRes] = await Promise.allSettled([
      fetch(`${SEC_SUBMISSIONS}/CIK${paddedCik}.json`, { headers }),
      fetch(`${SEC_FACTS}/CIK${paddedCik}.json`, { headers }),
    ]);

    if (subRes.status === "rejected" || !subRes.value.ok) return NextResponse.json(null);

    const sub = await subRes.value.json() as {
      cik: string; name: string; entityType?: string; sic?: string;
      sicDescription?: string; tickers?: string[]; exchanges?: string[];
      category?: string; website?: string; fiscalYearEnd?: string;
      stateOfIncorporation?: string; phone?: string;
      mailingAddress?: { city?: string; stateOrCountry?: string };
      businessAddress?: { city?: string; stateOrCountry?: string };
      filings: { recent: {
        accessionNumber: string[]; filingDate: string[]; reportDate: string[];
        form: string[]; primaryDocument: string[];
      }};
    };

    const r = sub.filings.recent;
    const filings = [];
    for (let i = 0; i < (r.accessionNumber?.length ?? 0); i++) {
      const form = r.form[i];
      if (!form?.startsWith("10-K") && form !== "10-Q") continue;
      const accn = r.accessionNumber[i].replace(/-/g, "");
      const doc = r.primaryDocument?.[i];
      filings.push({
        accession_number: r.accessionNumber[i],
        filing_date: r.filingDate?.[i] ?? "",
        report_date: r.reportDate?.[i] ?? "",
        form_type: form,
        primary_doc: doc,
        document_url: doc ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accn}/${doc}` : undefined,
      });
      if (filings.length >= 20) break;
    }

    let financials: ReturnType<typeof extractFinancials> = [];
    if (factsRes.status === "fulfilled" && factsRes.value.ok) {
      const facts = await factsRes.value.json() as { facts?: { "us-gaap"?: GaapFacts } };
      financials = extractFinancials(facts.facts?.["us-gaap"] ?? {});
    }

    const addr = sub.businessAddress ?? sub.mailingAddress;
    return NextResponse.json({
      cik: paddedCik,
      name: sub.name,
      ticker: sub.tickers?.[0],
      exchange: sub.exchanges?.[0],
      sic: sub.sic,
      sic_description: sub.sicDescription,
      entity_type: sub.entityType,
      category: sub.category,
      website: sub.website,
      state_of_incorporation: sub.stateOfIncorporation,
      fiscal_year_end: sub.fiscalYearEnd,
      phone: sub.phone,
      city: addr?.city,
      state: addr?.stateOrCountry,
      filings,
      financials,
    });
  } catch (err) {
    console.error("SEC details error:", err);
    return NextResponse.json(null);
  }
}
