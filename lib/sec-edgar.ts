// SEC EDGAR API (free, no auth required)
// https://www.sec.gov/cgi-bin/browse-edgar

const SEC_BASE = "https://data.sec.gov/submissions";

interface SECCompany {
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
  category?: string;
  sic_code?: string;
  sic_description?: string;
  headquarters?: string;
}

interface SECFiling {
  accession_number: string;
  filing_date: string;
  report_date: string;
  form_type: string;
  document_url?: string;
  filing_details?: {
    revenue?: number;
    net_income?: number;
    total_assets?: number;
    operating_expenses?: number;
  };
}

interface SECCompanyDetails extends SECCompany {
  filings: SECFiling[];
}

async function searchSECCompanies(query: string): Promise<SECCompany[]> {
  try {
    // Use SEC's JSON API for company search
    const response = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(query)}&type=&dateb=&owner=exclude&count=100&search_text=&json=1`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      hits?: { hits?: Array<{ _source?: { company_name?: string; cik_str?: number; ticker?: string } }> };
    };

    return (data.hits?.hits || [])
      .filter((h) => h._source?.company_name && h._source?.cik_str)
      .slice(0, 10)
      .map((h) => ({
        cik: String(h._source?.cik_str).padStart(10, "0"),
        name: h._source?.company_name || "",
        ticker: h._source?.ticker,
      }));
  } catch {
    return [];
  }
}

async function getSECCompanyDetails(cik: string): Promise<SECCompanyDetails | null> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const response = await fetch(`${SEC_BASE}/CIK${paddedCik}.json`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      entityInformation?: { name?: string; tickers?: string[] };
      filings?: {
        recent?: Array<{
          accessionNumber?: string;
          filingDate?: string;
          reportDate?: string;
          form?: string;
          primaryDocument?: string;
        }>;
      };
    };

    const entityInfo = data.entityInformation || {};
    const recentFilings = data.filings?.recent || [];

    // Filter to 10-K (annual) and 10-Q (quarterly) forms
    const relevantFilings = recentFilings
      .filter(
        (f) => f.form === "10-K" || f.form === "10-Q"
      )
      .slice(0, 10)
      .map((f) => ({
        accession_number: f.accessionNumber || "",
        filing_date: f.filingDate || "",
        report_date: f.reportDate || "",
        form_type: f.form || "",
        document_url: f.primaryDocument
          ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${paddedCik}&accession_number=${f.accessionNumber}&xbrl_type=v`
          : undefined,
      }));

    return {
      cik: paddedCik,
      name: String(entityInfo.name || ""),
      ticker: (entityInfo.tickers?.[0] as string) || undefined,
      filings: relevantFilings,
    };
  } catch {
    return null;
  }
}

export { searchSECCompanies, getSECCompanyDetails };
export type { SECCompany, SECFiling, SECCompanyDetails };
