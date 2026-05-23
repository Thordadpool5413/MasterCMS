// Direct CMS API calls — no Python server needed

const CMS_DATA_API = "https://data.cms.gov/data-api/v1";
const PROVIDER_DATA_API = "https://data.cms.gov/provider-data/api/1";
const NPPES_API = "https://npiregistry.cms.hhs.gov/api/";

const HOSPICE_UUID = "4e73f1b5-82cb-4682-8ad2-28493f0b6840";
const HOSPITAL_UUID = "690ddc6c-2767-4618-b277-420ffb2bf27c";
const NURSING_HOME_ID = "4pq5-n9py";

export function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, "").replace(/\$/g, "").replace(/%/g, ""));
  return isNaN(n) ? 0 : n;
}

function findCol(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase().replace(/[_\s-]/g, "") === c.toLowerCase().replace(/[_\s-]/g, ""));
    if (found) return found;
  }
  return null;
}

const HOSPICE_DRG_TERMS = [
  "heart failure","sepsis","respiratory","copd","pneumonia","renal failure",
  "kidney","stroke","malignancy","cancer","dementia","cirrhosis","liver","failure",
];

// ─── Hospice Market Share ─────────────────────────────────────────────────────

export interface HospiceRow {
  _provider_name: string;
  _market: string;
  _market_volume: number;
  _market_total_volume: number;
  _market_share_pct: number;
  _rank: number;
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  Rndrng_Prvdr_Zip_Cd?: string;
  Tot_Benes?: number;
  Tot_Mdcr_Pymt_Amt?: number;
  Bene_Avg_Age?: number;
  Bene_Avg_Risk_Scre?: number;
  [key: string]: unknown;
}

export interface HospiceResult {
  rows: HospiceRow[];
  provider_column_used: string;
  volume_column_used: string;
  market_column_used: string;
  total_volume: number;
  market_totals: Record<string, number>;
  interpretation_note: string;
}

export async function getHospiceMarketShare(state?: string, maxRows = 200): Promise<HospiceResult> {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];
  if (!data.length) return { rows: [], provider_column_used: "", volume_column_used: "", market_column_used: "", total_volume: 0, market_totals: {}, interpretation_note: "No data found." };

  const sample = data[0];
  const provCol = findCol(sample, ["Rndrng_Prvdr_Org_Name","ProviderName","Provider"]) ?? Object.keys(sample)[0];
  const volCol = findCol(sample, ["Tot_Benes","TotBenes","Beneficiaries","Total_Benes"]) ?? findCol(sample, ["Tot"]) ?? Object.keys(sample)[2];
  const mktCol = findCol(sample, ["Rndrng_Prvdr_City","City"]) ?? findCol(sample, ["County","HRR"]) ?? findCol(sample, ["Rndrng_Prvdr_State_Abrvtn","State"]) ?? "";

  const mktTotals: Record<string, number> = {};
  let totalVolume = 0;
  for (const row of data) {
    const mkt = String(row[mktCol] ?? "All");
    const vol = num(row[volCol]);
    mktTotals[mkt] = (mktTotals[mkt] ?? 0) + vol;
    totalVolume += vol;
  }

  const rows: HospiceRow[] = data.map((row) => {
    const mkt = String(row[mktCol] ?? "All");
    const vol = num(row[volCol]);
    const total = mktTotals[mkt] || 1;
    return {
      ...row,
      _provider_name: String(row[provCol] ?? ""),
      _market: mkt,
      _market_volume: vol,
      _market_total_volume: total,
      _market_share_pct: parseFloat(((vol / total) * 100).toFixed(2)),
    } as HospiceRow;
  });

  rows.sort((a, b) => b._market_share_pct - a._market_share_pct);
  rows.forEach((r, i) => { r._rank = i + 1; });

  return {
    rows: rows.slice(0, maxRows),
    provider_column_used: provCol,
    volume_column_used: volCol!,
    market_column_used: mktCol,
    total_volume: totalVolume,
    market_totals: mktTotals,
    interpretation_note: "Market share = provider beneficiary volume ÷ market (city) total. Source: Medicare PAC Utilization Hospice.",
  };
}

// ─── Hospital Opportunity ─────────────────────────────────────────────────────

export interface HospitalRow {
  Rndrng_Prvdr_CCN?: string;
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  Rndrng_Prvdr_Zip_Cd?: string;
  DRG_Cd?: string;
  DRG_Desc?: string;
  Tot_Dschrgs?: number;
  Avg_Submtd_Cvrd_Chrg?: number;
  Avg_Tot_Pymt_Amt?: number;
  Avg_Mdcr_Pymt_Amt?: number;
  _opportunity_score: number;
  _matched_hospice_terms: string[];
  _opportunity_reason: string;
  [key: string]: unknown;
}

export async function getHospitalOpportunity(
  state?: string, city?: string, maxRows = 200,
): Promise<{ rows: HospitalRow[]; total_records: number; interpretation_note: string }> {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);
  if (city) params.set("filter[Rndrng_Prvdr_City]", city.toUpperCase());

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPITAL_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows: HospitalRow[] = data.map((row) => {
    const drg = String(row.DRG_Desc ?? "").toLowerCase();
    const discharges = num(row.Tot_Dschrgs);
    const payment = num(row.Avg_Mdcr_Pymt_Amt);
    const matched = HOSPICE_DRG_TERMS.filter((t) => drg.includes(t));
    const clinicalWeight = 1.0 + 0.35 * matched.length;
    const paymentWeight = Math.min(payment / 10000, 10);
    const score = discharges * clinicalWeight + paymentWeight;
    return {
      ...row,
      _opportunity_score: parseFloat(score.toFixed(2)),
      _matched_hospice_terms: matched,
      _opportunity_reason: matched.length
        ? `Hospice-relevant DRGs: ${matched.slice(0, 3).join(", ")}`
        : "Discharge volume only — no hospice-specific DRG match",
    } as HospitalRow;
  });

  rows.sort((a, b) => b._opportunity_score - a._opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = discharges × clinical weight (DRG relevance) + payment weight. Source: Medicare Inpatient Hospitals by Provider & Service.",
  };
}

// ─── Nursing Home Opportunity ─────────────────────────────────────────────────

export interface NursingHomeRow {
  "Provider Name"?: string;
  "Provider Address"?: string;
  "City/Town"?: string;
  State?: string;
  "ZIP Code"?: string;
  "Phone Number"?: string;
  "CMS Certification Number (CCN)"?: string;
  "Ownership Type"?: string;
  "Number of Certified Beds"?: number;
  "Number of Residents in Certified Beds"?: number;
  "Overall Rating"?: number;
  "Health Inspection Rating"?: number;
  "QM Rating"?: number;
  "Staffing Rating"?: number;
  "RN Staffing Rating"?: number;
  _snf_opportunity_score: number;
  _beds_used_for_score: number;
  _quality_pressure_component: number;
  [key: string]: unknown;
}

export async function getNursingHomeOpportunity(
  state?: string, city?: string, maxRows = 200,
): Promise<{ rows: NursingHomeRow[]; total_records: number; interpretation_note: string }> {
  const conditions: { property: string; value: string; operator: string }[] = [];
  if (state) conditions.push({ property: "State", value: state, operator: "=" });
  if (city) conditions.push({ property: "City/Town", value: city.toUpperCase(), operator: "=" });

  const res = await fetch(`${PROVIDER_DATA_API}/datastore/query/${NURSING_HOME_ID}/0`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditions, limit: 2000, offset: 0 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Provider Data API error ${res.status}`);
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  const data = json.results ?? [];

  const rows: NursingHomeRow[] = data.map((row) => {
    const beds = num(row["Number of Certified Beds"]);
    const overall = num(row["Overall Rating"]) || 3;
    const staffing = num(row["Staffing Rating"]) || 3;
    const qm = num(row["QM Rating"]) || 3;
    const qualityPressure =
      Math.max(0, 5 - overall) + Math.max(0, 5 - staffing) * 0.5 + Math.max(0, 5 - qm) * 0.35;
    const score = beds + qualityPressure * 18;
    return {
      ...row,
      _snf_opportunity_score: parseFloat(score.toFixed(2)),
      _beds_used_for_score: beds,
      _quality_pressure_component: parseFloat(qualityPressure.toFixed(2)),
    } as NursingHomeRow;
  });

  rows.sort((a, b) => b._snf_opportunity_score - a._snf_opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = beds + quality pressure × 18. Lower star ratings = higher pressure = higher hospice opportunity.",
  };
}

// ─── Drug Spending ────────────────────────────────────────────────────────────

export interface DrugSpendingRow {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  year_2019_spending?: number;
  year_2020_spending?: number;
  year_2021_spending?: number;
  year_2022_spending?: number;
  year_2023_spending?: number;
  year_2019_claims?: number;
  year_2020_claims?: number;
  year_2021_claims?: number;
  year_2022_claims?: number;
  year_2023_claims?: number;
  latest_spending: number;
  latest_year: string;
  [key: string]: unknown;
}

export async function getDrugSpending(
  drugName?: string,
  spendingType: "part_d" | "part_b" = "part_d",
  maxRows = 100,
): Promise<{ rows: DrugSpendingRow[]; total: number; spending_type: string }> {
  const datasetMap: Record<string, string> = {
    part_d: "7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b",
    part_b: "76a714ad-3a2c-43ac-b76d-9dadf8f7d890",
  };
  const datasetId = datasetMap[spendingType];
  const params = new URLSearchParams({ size: String(Math.min(maxRows, 500)) });
  if (drugName) params.set("filter[Brnd_Name]", drugName);
  params.set("sort", "-Tot_Spndng_2023");

  const res = await fetch(`${CMS_DATA_API}/dataset/${datasetId}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows: DrugSpendingRow[] = data.map((item) => {
    const years = ["2019", "2020", "2021", "2022", "2023"];
    let latestSpending = 0;
    let latestYear = "N/A";
    for (const y of years.slice().reverse()) {
      const v = num(item[`Tot_Spndng_${y}`]);
      if (v > 0) { latestSpending = v; latestYear = y; break; }
    }
    return {
      brand_name: String(item.Brnd_Name ?? ""),
      generic_name: String(item.Gnrc_Name ?? ""),
      manufacturer: String(item.Mftr_Name ?? ""),
      year_2019_spending: num(item.Tot_Spndng_2019),
      year_2020_spending: num(item.Tot_Spndng_2020),
      year_2021_spending: num(item.Tot_Spndng_2021),
      year_2022_spending: num(item.Tot_Spndng_2022),
      year_2023_spending: num(item.Tot_Spndng_2023),
      year_2019_claims: num(item.Tot_Clms_2019),
      year_2020_claims: num(item.Tot_Clms_2020),
      year_2021_claims: num(item.Tot_Clms_2021),
      year_2022_claims: num(item.Tot_Clms_2022),
      year_2023_claims: num(item.Tot_Clms_2023),
      latest_spending: latestSpending,
      latest_year: latestYear,
    };
  });

  return { rows, total: data.length, spending_type: spendingType };
}

// ─── Prescriber Data ──────────────────────────────────────────────────────────

export interface PrescriberRow {
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
  [key: string]: unknown;
}

export async function searchPrescribers(
  drugName?: string,
  state?: string,
  prescriberType?: string,
  maxRows = 100,
): Promise<{ rows: PrescriberRow[]; total: number }> {
  const useProviderDataset = !drugName;
  const datasetId = useProviderDataset
    ? "14d8e8a9-7e9b-4370-a044-bf97c46b4b44"
    : "9552739e-3d05-4c1b-8eff-ecabf391e2e5";

  const params = new URLSearchParams({ size: String(Math.min(maxRows, 500)) });
  if (drugName && !useProviderDataset) params.set("keyword", drugName);
  if (state) params.set("filter[Prscrbr_State_Abrvtn]", state);
  if (prescriberType) params.set("filter[Prscrbr_Type]", prescriberType);
  params.set("sort", "-Tot_Clms");

  const res = await fetch(`${CMS_DATA_API}/dataset/${datasetId}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows: PrescriberRow[] = data.map((item) => ({
    npi: String(item.PRSCRBR_NPI ?? item.Prscrbr_NPI ?? ""),
    prescriber_name: `${item.Prscrbr_Last_Org_Name ?? ""}, ${item.Prscrbr_First_Name ?? ""}`.trim().replace(/^,\s*/, ""),
    prescriber_type: String(item.Prscrbr_Type ?? ""),
    city: String(item.Prscrbr_City ?? ""),
    state: String(item.Prscrbr_State_Abrvtn ?? ""),
    zip: String(item.Prscrbr_zip5 ?? ""),
    total_claims: num(item.Tot_Clms),
    total_drug_cost: num(item.Tot_Drug_Cst),
    total_beneficiaries: num(item.Tot_Benes),
    brand_claims: num(item.Brnd_Tot_Clms),
    generic_claims: num(item.Gnrc_Tot_Clms),
  }));

  return { rows, total: data.length };
}

// ─── NPI Lookup ───────────────────────────────────────────────────────────────

export interface NpiResult {
  rows: Record<string, unknown>[];
  result_count: number;
}

export async function lookupNpi(params: {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  state?: string;
  city?: string;
  taxonomy_description?: string;
  limit?: number;
}): Promise<NpiResult> {
  const q = new URLSearchParams({ version: "2.1", limit: String(params.limit ?? 20) });
  if (params.first_name) q.set("first_name", params.first_name);
  if (params.last_name) q.set("last_name", params.last_name);
  if (params.organization_name) q.set("organization_name", params.organization_name);
  if (params.state) q.set("state", params.state);
  if (params.city) q.set("city", params.city);
  if (params.taxonomy_description) q.set("taxonomy_description", params.taxonomy_description);

  const res = await fetch(`${NPPES_API}?${q}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`NPPES API error ${res.status}`);
  const json = (await res.json()) as { results?: unknown[]; result_count?: number };

  return {
    rows: (json.results ?? []) as Record<string, unknown>[],
    result_count: json.result_count ?? 0,
  };
}

// ─── ProPublica Nonprofit 990 Explorer ────────────────────────────────────────

const PROPUBLICA_API = "https://projects.propublica.org/nonprofits/api/v2";

export interface NonprofitOrg {
  ein: string;
  name: string;
  city: string;
  state: string;
  ntee_code: string;
  income_amount: number;
  asset_amount: number;
  form_990_count: number;
  have_pdfs: boolean;
}

export interface NonprofitFiling {
  tax_prd_yr: string;
  formtype: string;
  pdf_url: string;
  totrevenue: number;
  totfuncexpns: number;
  totassetsend: number;
  totliabend: number;
  compnsatncurrofcr: number;
  othrsalwages: number;
  totprgmrevnue: number;
  totcontribution: number;
}

export interface NonprofitDetail {
  organization: NonprofitOrg & { num_employees?: number; address?: string; zipcode?: string };
  filings: NonprofitFiling[];
}

export async function searchNonprofits(
  query: string,
  stateFilter?: string,
): Promise<{ organizations: NonprofitOrg[]; total: number }> {
  const params = new URLSearchParams({ q: query });
  if (stateFilter) params.set("state[id]", stateFilter);

  const res = await fetch(`${PROPUBLICA_API}/search.json?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ProPublica API error ${res.status}`);
  const data = (await res.json()) as { total_results?: number; organizations?: NonprofitOrg[] };

  return {
    organizations: data.organizations ?? [],
    total: data.total_results ?? 0,
  };
}

export async function getNonprofitDetail(ein: string): Promise<NonprofitDetail> {
  const clean = ein.replace(/-/g, "");
  const res = await fetch(`${PROPUBLICA_API}/organizations/${clean}.json`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ProPublica API error ${res.status}`);
  const data = (await res.json()) as {
    organization?: Record<string, unknown>;
    filings_with_data?: Record<string, unknown>[];
  };

  const org = data.organization ?? {};
  const filings: NonprofitFiling[] = (data.filings_with_data ?? []).map((f) => ({
    tax_prd_yr: String(f.tax_prd_yr ?? ""),
    formtype: String(f.formtype ?? "990"),
    pdf_url: String(f.pdf_url ?? ""),
    totrevenue: num(f.totrevenue),
    totfuncexpns: num(f.totfuncexpns),
    totassetsend: num(f.totassetsend),
    totliabend: num(f.totliabend),
    compnsatncurrofcr: num(f.compnsatncurrofcr),
    othrsalwages: num(f.othrsalwages),
    totprgmrevnue: num(f.totprgmrevnue),
    totcontribution: num(f.totcontribution),
  }));

  return {
    organization: {
      ein: String(org.ein ?? ""),
      name: String(org.name ?? ""),
      city: String(org.city ?? ""),
      state: String(org.state ?? ""),
      ntee_code: String(org.nteeCode ?? org.ntee_code ?? ""),
      income_amount: num(org.income_amount ?? org.incomeAmt),
      asset_amount: num(org.asset_amount ?? org.assetAmount),
      form_990_count: Number(org.form990TotalAssets ?? 0),
      have_pdfs: Boolean(org.have_pdfs),
      num_employees: org.numEmployees != null ? Number(org.numEmployees) : undefined,
      address: org.address ? String(org.address) : undefined,
      zipcode: org.zipcode ? String(org.zipcode) : undefined,
    },
    filings,
  };
}

// ─── ClinicalTrials.gov v2 ────────────────────────────────────────────────────

export interface ClinicalTrial {
  nct_id: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  sponsor: string;
  enrollment: number | null;
  start_date: string;
  locations: { facility: string; city: string; state: string }[];
  url: string;
}

export async function searchClinicalTrials(
  condition: string,
  stateFilter?: string,
  statusFilter?: string,
  maxResults = 25,
): Promise<{ trials: ClinicalTrial[]; total: number }> {
  const params = new URLSearchParams({
    format: "json",
    pageSize: String(Math.min(maxResults, 50)),
    "query.term": condition,
  });
  if (stateFilter) params.set("query.locn", stateFilter);
  params.set(
    "filter.overallStatus",
    statusFilter ?? "RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING",
  );

  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ClinicalTrials API error ${res.status}`);
  const data = (await res.json()) as {
    studies?: Record<string, unknown>[];
    totalCount?: number;
  };

  const trials: ClinicalTrial[] = (data.studies ?? []).map((study) => {
    const proto = (study.protocolSection ?? {}) as Record<string, Record<string, unknown>>;
    const idMod = proto.identificationModule ?? {};
    const statusMod = proto.statusModule ?? {};
    const sponsorMod = proto.sponsorCollaboratorsModule ?? {};
    const condMod = proto.conditionsModule ?? {};
    const designMod = proto.designModule ?? {};
    const locMod = proto.contactsLocationsModule ?? {};

    const phases = (designMod.phases as string[] | undefined) ?? [];
    const phase = phases.length
      ? phases.map((p) => p.replace("PHASE", "Phase ").replace("_", " ")).join(", ")
      : "N/A";

    const locs = ((locMod.locations as Record<string, string>[] | undefined) ?? [])
      .slice(0, 3)
      .map((l) => ({
        facility: String(l.facility ?? ""),
        city: String(l.city ?? ""),
        state: String(l.state ?? ""),
      }));

    const enrollInfo = designMod.enrollmentInfo as Record<string, unknown> | undefined;
    const leadSponsor = sponsorMod.leadSponsor as Record<string, string> | undefined;
    const startDate = (statusMod.startDateStruct as Record<string, string> | undefined)?.date ?? "";
    const nctId = String(idMod.nctId ?? "");

    return {
      nct_id: nctId,
      title: String(idMod.briefTitle ?? ""),
      status: String(statusMod.overallStatus ?? "").replace(/_/g, " "),
      phase,
      conditions: (condMod.conditions as string[] | undefined) ?? [],
      sponsor: String(leadSponsor?.name ?? ""),
      enrollment: enrollInfo?.count != null ? Number(enrollInfo.count) : null,
      start_date: startDate,
      locations: locs,
      url: `https://clinicaltrials.gov/study/${nctId}`,
    };
  });

  return { trials, total: data.totalCount ?? 0 };
}

// ─── OpenFDA ──────────────────────────────────────────────────────────────────

export interface AdverseEventReaction {
  term: string;
  count: number;
}

export interface DrugLabelSummary {
  brand_name: string;
  generic_name: string;
  indications_and_usage: string;
  warnings: string;
  boxed_warning: string;
}

export async function getOpenFdaAdverseEvents(
  drugName: string,
  limit = 12,
): Promise<{ reactions: AdverseEventReaction[]; total_reports: number }> {
  const search = encodeURIComponent(
    `patient.drug.medicinalproduct:"${drugName.toUpperCase()}"`,
  );
  const res = await fetch(
    `https://api.fda.gov/drug/event.json?search=${search}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 404) return { reactions: [], total_reports: 0 };
  if (!res.ok) throw new Error(`OpenFDA error ${res.status}`);
  const data = (await res.json()) as {
    results?: { term: string; count: number }[];
    meta?: { results?: { total?: number } };
  };
  return {
    reactions: data.results ?? [],
    total_reports: data.meta?.results?.total ?? 0,
  };
}

export async function getOpenFdaDrugLabel(
  drugName: string,
): Promise<DrugLabelSummary | null> {
  const search = encodeURIComponent(`openfda.brand_name:"${drugName}"`);
  const res = await fetch(
    `https://api.fda.gov/drug/label.json?search=${search}&limit=1`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  if (!data.results?.length) return null;
  const r = data.results[0];
  const fda = (r.openfda as Record<string, string[]> | undefined) ?? {};
  const first = (arr: unknown): string =>
    Array.isArray(arr) ? String(arr[0] ?? "").slice(0, 600) : "";
  return {
    brand_name: first(fda.brand_name) || drugName,
    generic_name: first(fda.generic_name) || "",
    indications_and_usage: first(r.indications_and_usage),
    warnings: first(r.warnings),
    boxed_warning: first(r.boxed_warning),
  };
}

// ─── Census Bureau ACS Demographics ──────────────────────────────────────────

const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

export interface StateDemographics {
  state: string;
  state_name: string;
  total_population: number;
  population_65_plus: number;
  pct_65_plus: number;
  median_household_income: number;
}

export async function getCensusStateDemographics(
  stateAbbr: string,
): Promise<StateDemographics | null> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) return null;
  const fips = STATE_FIPS[stateAbbr.toUpperCase()];
  if (!fips) return null;

  const vars = [
    "NAME", "B01003_001E",
    "B01001_020E", "B01001_021E", "B01001_022E",
    "B01001_023E", "B01001_024E", "B01001_025E",
    "B01001_044E", "B01001_045E", "B01001_046E",
    "B01001_047E", "B01001_048E", "B01001_049E",
    "B19013_001E",
  ].join(",");

  const res = await fetch(
    `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=state:${fips}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as string[][];
  if (rows.length < 2) return null;

  const [header, row] = [rows[0], rows[1]];
  const g = (v: string) => Number(row[header.indexOf(v)] ?? 0);

  const totalPop = g("B01003_001E");
  const pop65 = [
    "B01001_020E", "B01001_021E", "B01001_022E",
    "B01001_023E", "B01001_024E", "B01001_025E",
    "B01001_044E", "B01001_045E", "B01001_046E",
    "B01001_047E", "B01001_048E", "B01001_049E",
  ].reduce((s, v) => s + g(v), 0);

  return {
    state: stateAbbr.toUpperCase(),
    state_name: row[header.indexOf("NAME")],
    total_population: totalPop,
    population_65_plus: pop65,
    pct_65_plus: totalPop > 0 ? parseFloat(((pop65 / totalPop) * 100).toFixed(1)) : 0,
    median_household_income: g("B19013_001E"),
  };
}
