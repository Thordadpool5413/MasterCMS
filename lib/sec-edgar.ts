// SEC EDGAR — free public APIs, no auth required
// Company search: www.sec.gov/files/company_tickers.json
// Company details: data.sec.gov/submissions/CIK{cik}.json
// Financial facts (XBRL): data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json

const SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS = "https://data.sec.gov/submissions";
const SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts";

export interface SECCompany {
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
}

export interface SECFiling {
  accession_number: string;
  filing_date: string;
  report_date: string;
  form_type: string;
  document_url?: string;
  primary_doc?: string;
}

export interface SECFinancialYear {
  year: number;
  revenues?: number;
  net_income?: number;
  operating_income?: number;
  total_assets?: number;
  total_liabilities?: number;
  stockholders_equity?: number;
  eps_basic?: number;
}

export interface SECCompanyDetails extends SECCompany {
  sic?: string;
  sic_description?: string;
  entity_type?: string;
  category?: string;
  state_of_incorporation?: string;
  fiscal_year_end?: string;
  phone?: string;
  city?: string;
  state?: string;
  website?: string;
  filings: SECFiling[];
  financials: SECFinancialYear[];
}

// Search companies by name using SEC's static company_tickers file.
export async function searchSECCompanies(query: string): Promise<SECCompany[]> {
  try {
    const res = await fetch(SEC_TICKERS, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<
      string,
      { cik_str: number; ticker: string; title: string }
    >;
    const q = query.toLowerCase();
    return Object.values(data)
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 15)
      .map((c) => ({
        cik: String(c.cik_str).padStart(10, "0"),
        name: c.title,
        ticker: c.ticker || undefined,
      }));
  } catch {
    return [];
  }
}

// Fetch full company detail: submissions + XBRL financial facts in parallel.
export async function getSECCompanyDetails(
  cik: string
): Promise<SECCompanyDetails | null> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const cikNum = parseInt(paddedCik, 10);

    const [subRes, factsRes] = await Promise.allSettled([
      fetch(`${SEC_SUBMISSIONS}/CIK${paddedCik}.json`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${SEC_FACTS}/CIK${paddedCik}.json`, {
        signal: AbortSignal.timeout(15_000),
      }),
    ]);

    if (subRes.status === "rejected" || !subRes.value.ok) return null;

    // The submissions API returns parallel arrays under filings.recent, not
    // an array of objects — this is the key schema to get right.
    const sub = (await subRes.value.json()) as {
      cik: string;
      name: string;
      entityType?: string;
      sic?: string;
      sicDescription?: string;
      tickers?: string[];
      exchanges?: string[];
      category?: string;
      website?: string;
      fiscalYearEnd?: string;
      stateOfIncorporation?: string;
      phone?: string;
      mailingAddress?: { city?: string; stateOrCountry?: string };
      businessAddress?: { city?: string; stateOrCountry?: string };
      filings: {
        recent: {
          accessionNumber: string[];
          filingDate: string[];
          reportDate: string[];
          form: string[];
          primaryDocument: string[];
          isXBRL: number[];
        };
      };
    };

    // Zip parallel arrays into filing objects.
    const r = sub.filings.recent;
    const filings: SECFiling[] = [];
    for (let i = 0; i < (r.accessionNumber?.length ?? 0); i++) {
      const form = r.form[i];
      if (form !== "10-K" && form !== "10-Q") continue;
      const accn = r.accessionNumber[i].replace(/-/g, "");
      const doc = r.primaryDocument?.[i];
      filings.push({
        accession_number: r.accessionNumber[i],
        filing_date: r.filingDate?.[i] ?? "",
        report_date: r.reportDate?.[i] ?? "",
        form_type: form,
        primary_doc: doc,
        document_url: doc
          ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accn}/${doc}`
          : undefined,
      });
      if (filings.length >= 20) break;
    }

    // Parse XBRL financial facts for annual FY data.
    let financials: SECFinancialYear[] = [];
    if (factsRes.status === "fulfilled" && factsRes.value.ok) {
      const facts = (await factsRes.value.json()) as {
        facts?: {
          "us-gaap"?: Record<
            string,
            {
              units?: {
                USD?: Array<{
                  end: string;
                  val: number;
                  fy: number;
                  fp: string;
                  form: string;
                }>;
                "USD/shares"?: Array<{
                  end: string;
                  val: number;
                  fy: number;
                  fp: string;
                  form: string;
                }>;
              };
            }
          >;
        };
      };
      financials = extractFinancials(facts.facts?.["us-gaap"] ?? {});
    }

    const addr = sub.businessAddress ?? sub.mailingAddress;

    return {
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
    };
  } catch (err) {
    console.error("SEC EDGAR detail error:", err);
    return null;
  }
}

type GaapFacts = Record<
  string,
  {
    units?: {
      USD?: Array<{ end: string; val: number; fy: number; fp: string; form: string }>;
      "USD/shares"?: Array<{ end: string; val: number; fy: number; fp: string; form: string }>;
    };
  }
>;

function getAnnual(
  gaap: GaapFacts,
  ...keys: string[]
): Array<{ fy: number; val: number }> {
  for (const key of keys) {
    const usd = gaap[key]?.units?.USD;
    if (usd?.length) {
      return usd
        .filter((d) => d.form === "10-K" && d.fp === "FY" && d.fy > 2000)
        .sort((a, b) => b.fy - a.fy)
        .slice(0, 7);
    }
  }
  return [];
}

function getAnnualShares(
  gaap: GaapFacts,
  ...keys: string[]
): Array<{ fy: number; val: number }> {
  for (const key of keys) {
    const shares = gaap[key]?.units?.["USD/shares"];
    if (shares?.length) {
      return shares
        .filter((d) => d.form === "10-K" && d.fp === "FY" && d.fy > 2000)
        .sort((a, b) => b.fy - a.fy)
        .slice(0, 7);
    }
  }
  return [];
}

function extractFinancials(gaap: GaapFacts): SECFinancialYear[] {
  const years = new Map<number, SECFinancialYear>();

  const merge = (
    entries: Array<{ fy: number; val: number }>,
    set: (y: SECFinancialYear, v: number) => void
  ) => {
    for (const e of entries) {
      if (!years.has(e.fy)) years.set(e.fy, { year: e.fy });
      set(years.get(e.fy)!, e.val);
    }
  };

  merge(
    getAnnual(
      gaap,
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "HealthCareOrganizationRevenue",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
    ),
    (y, v) => (y.revenues = v)
  );
  merge(getAnnual(gaap, "NetIncomeLoss", "ProfitLoss"), (y, v) => (y.net_income = v));
  merge(getAnnual(gaap, "OperatingIncomeLoss"), (y, v) => (y.operating_income = v));
  merge(getAnnual(gaap, "Assets"), (y, v) => (y.total_assets = v));
  merge(getAnnual(gaap, "Liabilities"), (y, v) => (y.total_liabilities = v));
  merge(
    getAnnual(
      gaap,
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"
    ),
    (y, v) => (y.stockholders_equity = v)
  );
  merge(
    getAnnualShares(gaap, "EarningsPerShareBasic"),
    (y, v) => (y.eps_basic = v)
  );

  return Array.from(years.values())
    .filter((y) => y.revenues || y.net_income || y.total_assets)
    .sort((a, b) => b.year - a.year)
    .slice(0, 7);
}
