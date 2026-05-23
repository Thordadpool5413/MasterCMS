export interface HospiceRow {
  _provider_name: string;
  _city: string;
  _state: string;
  _zip: string;
  _payment: number;
  _avg_age: number;
  _risk_score: number;
  _market: string;
  _market_volume: number;
  _market_total_volume: number;
  _market_share_pct: number;
  _rank: number;
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

export interface NpiResult {
  rows: Record<string, unknown>[];
  result_count: number;
}

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

export interface StateDemographics {
  state: string;
  state_name: string;
  total_population: number;
  population_65_plus: number;
  pct_65_plus: number;
  median_household_income: number;
}
