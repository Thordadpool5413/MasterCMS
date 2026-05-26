// SEC EDGAR — proxied via /api/sec/* server routes to supply correct User-Agent headers.
// Direct browser fetches to data.sec.gov are rate-limited without a valid User-Agent.

const API_BASE = typeof window !== "undefined" ? "" : "http://localhost:3000";

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

// Search companies by name via server-side proxy.
export async function searchSECCompanies(query: string): Promise<SECCompany[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sec/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    return (await res.json()) as SECCompany[];
  } catch {
    return [];
  }
}

// Fetch full company detail via server-side proxy.
export async function getSECCompanyDetails(cik: string): Promise<SECCompanyDetails | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sec/details?cik=${encodeURIComponent(cik)}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SECCompanyDetails | null;
  } catch (err) {
    console.error("SEC EDGAR detail error:", err);
    return null;
  }
}

