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

// Schema cache: dataset UUID + candidate-list → resolved column name.
// Dataset schemas are stable, so we only need to probe once.
const schemaCache = new Map<string, Map<string, string | null>>();
function findColCached(uuid: string, row: Record<string, unknown>, candidates: string[]): string | null {
  let perDataset = schemaCache.get(uuid);
  if (!perDataset) { perDataset = new Map(); schemaCache.set(uuid, perDataset); }
  const key = candidates.join("|");
  if (perDataset.has(key)) return perDataset.get(key) ?? null;
  const resolved = findCol(row, candidates);
  perDataset.set(key, resolved);
  return resolved;
}

// Page through a CMS dataset until exhausted or safety cap reached.
async function fetchCmsAllPages(
  uuid: string,
  filters: Record<string, string>,
  { pageSize = 5000, maxRows = 20000, timeoutMs = 30_000 }: { pageSize?: number; maxRows?: number; timeoutMs?: number } = {},
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  while (out.length < maxRows) {
    const params = new URLSearchParams({ size: String(pageSize), offset: String(offset) });
    for (const [k, v] of Object.entries(filters)) params.set(k, v);
    const res = await fetch(`${CMS_DATA_API}/dataset/${uuid}/data?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`CMS API error ${res.status}`);
    const raw = await res.json();
    const page: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>).data)
        ? ((raw as Record<string, unknown>).data as Record<string, unknown>[])
        : [];
    if (!page.length) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

const HOSPICE_DRG_TERMS = [
  "heart failure","sepsis","respiratory","copd","pneumonia","renal failure",
  "kidney","stroke","malignancy","cancer","dementia","cirrhosis","liver","failure",
];

// ─── Hospice Market Share ─────────────────────────────────────────────────────

// Raw row shape from CMS PAC Hospice dataset. All numeric fields arrive as
// strings from the API (CMS preserves "*" suppression markers); use num() to
// parse. Index signature preserves access to any field not enumerated here.
export interface RawHospiceCmsRow {
  YEAR?: string;
  YEAR_TYPE?: string;
  SMRY_CTGRY?: "NATION" | "STATE" | "PROVIDER";
  SRVC_CTGRY?: string;
  PRVDR_ID?: string;
  PRVDR_NAME?: string;
  PRVDR_CITY?: string;
  STATE?: string;
  PRVDR_ZIP?: string;
  // Volume + payments
  BENE_DSTNCT_CNT?: string;
  TOT_EPSD_STAY_CNT?: string;
  TOT_SRVC_DAYS?: string;
  TOT_CHRG_AMT?: string;
  TOT_ALOWD_AMT?: string;
  TOT_MDCR_PYMT_AMT?: string;
  TOT_MDCR_STDZD_PYMT_AMT?: string;
  // Demographic + risk
  BENE_DUAL_PCT?: string;
  BENE_RRL_PCT?: string;
  BENE_AVG_AGE?: string;
  BENE_MALE_PCT?: string;
  BENE_FEML_PCT?: string;
  BENE_AVG_RISK_SCRE?: string;
  // Race / ethnicity mix
  BENE_RACE_WHT_PCT?: string;
  BENE_RACE_BLACK_PCT?: string;
  BENE_RACE_API_PCT?: string;
  BENE_RACE_HSPNC_PCT?: string;
  BENE_RACE_NATIND_PCT?: string;
  BENE_RACE_UNK_PCT?: string;
  BENE_RACE_OTHR_PCT?: string;
  // Primary diagnosis mix
  PRMRY_DX_INFCTN_PCT?: string;
  PRMRY_DX_NEOBLD_PCT?: string;
  PRMRY_DX_ENDONUTRMET_PCT?: string;
  PRMRY_DX_MNTBEHNEUDIS_PCT?: string;
  PRMRY_DX_NERVSYSTM_PCT?: string;
  PRMRY_DX_ENTSYS_PCT?: string;
  PRMRY_DX_CIRCSYSTM_PCT?: string;
  PRMRY_DX_RSPSYSTM_PCT?: string;
  PRMRY_DX_DIGSYSTM_PCT?: string;
  PRMRY_DX_SKNMUSSYSTM_PCT?: string;
  PRMRY_DX_GUSYSTM_PCT?: string;
  PRMRY_DX_PRGPERICONG_PCT?: string;
  PRMRY_DX_SXILLDEF_PCT?: string;
  PRMRY_DX_INJPOIS_PCT?: string;
  PRMRY_DX_HLTHSRV_PCT?: string;
  // Visits + level-of-care
  NRSNG_VISITS_CNT?: string;
  MSW_VISITS_CNT?: string;
  AIDE_VISITS_CNT?: string;
  TOT_NRSNG_MNTS?: string;
  HOSPC_RHC_DAYS_PCT?: string;
  [key: string]: unknown;
}

// Labels for primary diagnosis groupings (used by dominant-dx detection).
export const HOSPICE_DX_LABELS: Record<string, string> = {
  PRMRY_DX_INFCTN_PCT: "Infections",
  PRMRY_DX_NEOBLD_PCT: "Cancer / Neoplasms",
  PRMRY_DX_ENDONUTRMET_PCT: "Endocrine / Metabolic",
  PRMRY_DX_MNTBEHNEUDIS_PCT: "Mental / Behavioral",
  PRMRY_DX_NERVSYSTM_PCT: "Nervous System (e.g. Dementia)",
  PRMRY_DX_ENTSYS_PCT: "Eye / ENT",
  PRMRY_DX_CIRCSYSTM_PCT: "Circulatory / Heart",
  PRMRY_DX_RSPSYSTM_PCT: "Respiratory",
  PRMRY_DX_DIGSYSTM_PCT: "Digestive",
  PRMRY_DX_SKNMUSSYSTM_PCT: "Skin / Musculoskeletal",
  PRMRY_DX_GUSYSTM_PCT: "Genitourinary",
  PRMRY_DX_PRGPERICONG_PCT: "Pregnancy / Congenital",
  PRMRY_DX_SXILLDEF_PCT: "Symptoms / Ill-defined",
  PRMRY_DX_INJPOIS_PCT: "Injury / Poisoning",
  PRMRY_DX_HLTHSRV_PCT: "Health Services",
};
const HOSPICE_DX_FIELDS = Object.keys(HOSPICE_DX_LABELS);

// Care Compare enrichment joined via CCN (PRVDR_ID == cms_certification_number_ccn).
export interface HospiceCareCompareJoin {
  star_rating: number | null;       // CAHPS 1-5; null if "Not Available"
  ownership_type: string;           // For-Profit / Non-Profit / Other / Government
  county: string;
  phone: string;
  cms_region: string;
  certification_date: string;
  hci_overall: number | null;       // Hospice Care Index, 0-10
  his_composite: number | null;     // H_008_01 composite process measure, percentage
  npi: string;
  doing_business_as: string;
}

export interface HospiceRow extends RawHospiceCmsRow, Partial<HospiceCareCompareJoin> {
  _provider_name: string;
  _provider_id: string;
  _city: string;
  _state: string;
  _zip: string;
  _payment: number;
  _standardized_payment: number;
  _allowed_amount: number;
  _total_charges: number;
  _avg_age: number;
  _risk_score: number;
  _market: string;
  _market_volume: number;
  _market_total_volume: number;
  _market_share_pct: number;
  _rank: number;
  _year: string;
  // Derived
  _avg_los: number;                  // days per episode
  _payment_per_bene: number;
  _payment_per_day: number;
  _episodes_per_bene: number;
  _nursing_minutes_per_bene: number;
  _visits_per_bene: number;
  _visit_mix_nrsng_pct: number;      // % of visits that were nursing
  _visit_mix_aide_pct: number;
  _visit_mix_msw_pct: number;
  _routine_home_care_pct: number;
  _dominant_dx_field: string;
  _dominant_dx_label: string;
  _dominant_dx_pct: number;
  _dx_concentration: number;         // Herfindahl across DX %s, 0-10000
}

export interface HospiceStateSummary {
  state: string;
  total_beneficiaries: number;
  total_medicare_payment: number;
  total_standardized_payment: number;
  provider_count: number;
  market_hhi: number;                // Herfindahl-Hirschman Index of provider shares in the state, 0-10000
}

export type HospiceGroupBy = "city" | "state";

export interface HospiceResult {
  rows: HospiceRow[];
  group_by: HospiceGroupBy;
  total_volume: number;
  market_totals: Record<string, number>;
  state_summary: HospiceStateSummary | null;
  year_used: string;
  years_available: string[];
  total_provider_count: number;
  care_compare_enriched: number;     // count of rows that got a Care Compare match
  interpretation_note: string;
}

export interface HospiceQueryOptions {
  groupBy?: HospiceGroupBy;
  year?: string;
  enrich?: boolean;                  // default true; join Care Compare data by CCN
}

// ─── Care Compare datastore helpers ──────────────────────────────────────────

const PD_DATASTORE = `${PROVIDER_DATA_API}/datastore/query`;

// Page through a Care Compare datastore endpoint. Conditions are an array of
// { property, value, operator } objects (server expects `conditions[i][...]`).
async function fetchCareCompareAll(
  datasetId: string,
  conditions: Array<{ property: string; value: string; operator?: string }> = [],
  { pageSize = 1500, maxRows = 200000, timeoutMs = 30_000 }: { pageSize?: number; maxRows?: number; timeoutMs?: number } = {},
): Promise<Record<string, unknown>[]> {
  // Provider Data API caps limit at 1500 per request — exceeding it returns a 400.
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  while (out.length < maxRows) {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    conditions.forEach((c, i) => {
      params.set(`conditions[${i}][property]`, c.property);
      params.set(`conditions[${i}][value]`, c.value);
      params.set(`conditions[${i}][operator]`, c.operator ?? "=");
    });
    const res = await fetch(`${PD_DATASTORE}/${datasetId}/0?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Provider-Data API error ${res.status}`);
    const body = (await res.json()) as { results?: Record<string, unknown>[] };
    const page = body.results ?? [];
    if (!page.length) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

// Bulk Care Compare index, cached in-process. Three fetches: general info (one
// row per provider with phone/county/ownership), star rating (CAHPS), and HCI
// overall + HIS composite (quality dataset filtered to two measure codes).
const CARE_COMPARE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
let careCompareCache: { at: number; map: Map<string, HospiceCareCompareJoin> } | null = null;

async function getHospiceCareCompareIndex(): Promise<Map<string, HospiceCareCompareJoin>> {
  // Reuse cache only if it's fresh AND non-empty (an empty result usually means
  // a transient API failure, not a real "no data" answer for ~7K hospices).
  if (careCompareCache && careCompareCache.map.size > 0 && Date.now() - careCompareCache.at < CARE_COMPARE_TTL_MS) {
    return careCompareCache.map;
  }
  const [generalInfo, stars, hci, his, enrollments] = await Promise.all([
    fetchCareCompareAll("yc9t-dgbk", []),
    fetchCareCompareAll("gxki-hrr8", [{ property: "measure_code", value: "SUMMARY_STAR_RATING" }]),
    fetchCareCompareAll("252m-zfp9", [{ property: "measure_code", value: "H_012_00_OBSERVED" }]),
    fetchCareCompareAll("252m-zfp9", [{ property: "measure_code", value: "H_008_01_OBSERVED" }]),
    fetchCmsAllPages("25704213-e833-4b8b-9dbc-58dd17149209", {}, { pageSize: 5000, maxRows: 30000 }).catch(() => [] as Record<string, unknown>[]),
  ]);

  const byCcn = new Map<string, HospiceCareCompareJoin>();
  for (const r of generalInfo) {
    const ccn = String(r.cms_certification_number_ccn ?? "");
    if (!ccn) continue;
    byCcn.set(ccn, {
      star_rating: null,
      ownership_type: String(r.ownership_type ?? ""),
      county: String(r.countyparish ?? ""),
      phone: String(r.telephone_number ?? ""),
      cms_region: String(r.cms_region ?? ""),
      certification_date: String(r.certification_date ?? ""),
      hci_overall: null,
      his_composite: null,
      npi: "",
      doing_business_as: "",
    });
  }
  for (const r of stars) {
    const ccn = String(r.cms_certification_number_ccn ?? "");
    const entry = byCcn.get(ccn);
    if (!entry) continue;
    const star = parseFloat(String(r.star_rating ?? ""));
    entry.star_rating = isNaN(star) ? null : star;
  }
  for (const r of hci) {
    const ccn = String(r.cms_certification_number_ccn ?? "");
    const entry = byCcn.get(ccn);
    if (!entry) continue;
    const v = parseFloat(String(r.score ?? ""));
    entry.hci_overall = isNaN(v) ? null : v;
  }
  for (const r of his) {
    const ccn = String(r.cms_certification_number_ccn ?? "");
    const entry = byCcn.get(ccn);
    if (!entry) continue;
    const v = parseFloat(String(r.score ?? ""));
    entry.his_composite = isNaN(v) ? null : v;
  }
  for (const r of enrollments) {
    const ccn = String(r.CCN ?? "");
    const entry = byCcn.get(ccn);
    if (!entry) continue;
    entry.npi = String(r.NPI ?? "");
    entry.doing_business_as = String(r["DOING BUSINESS AS NAME"] ?? "");
  }
  careCompareCache = { at: Date.now(), map: byCcn };
  return byCcn;
}

// National CAHPS benchmark — single small dataset (~21 rows), cached.
const cahpsNationalCache: { at: number; map: Map<string, string> } = { at: 0, map: new Map() };
async function getCahpsNationalBenchmark(): Promise<Map<string, string>> {
  if (cahpsNationalCache.map.size > 0 && Date.now() - cahpsNationalCache.at < CARE_COMPARE_TTL_MS) {
    return cahpsNationalCache.map;
  }
  const rows = await fetchCareCompareAll("7cv8-v37d", []).catch(() => [] as Record<string, unknown>[]);
  const m = new Map<string, string>();
  for (const r of rows) {
    const code = String(r.measure_code ?? "");
    if (code) m.set(code, String(r.score ?? ""));
  }
  cahpsNationalCache.at = Date.now();
  cahpsNationalCache.map = m;
  return m;
}

// Compute the derived metrics block from a raw provider row.
function computeHospiceDerived(row: RawHospiceCmsRow): {
  _avg_los: number;
  _payment_per_bene: number;
  _payment_per_day: number;
  _episodes_per_bene: number;
  _nursing_minutes_per_bene: number;
  _visits_per_bene: number;
  _visit_mix_nrsng_pct: number;
  _visit_mix_aide_pct: number;
  _visit_mix_msw_pct: number;
  _routine_home_care_pct: number;
  _dominant_dx_field: string;
  _dominant_dx_label: string;
  _dominant_dx_pct: number;
  _dx_concentration: number;
} {
  const benes = num(row.BENE_DSTNCT_CNT);
  const days  = num(row.TOT_SRVC_DAYS);
  const eps   = num(row.TOT_EPSD_STAY_CNT);
  const pay   = num(row.TOT_MDCR_PYMT_AMT);
  const nVis  = num(row.NRSNG_VISITS_CNT);
  const mVis  = num(row.MSW_VISITS_CNT);
  const aVis  = num(row.AIDE_VISITS_CNT);
  const nMin  = num(row.TOT_NRSNG_MNTS);
  const totalVisits = nVis + mVis + aVis;

  // Dominant DX = highest non-suppressed primary-dx percentage.
  let domField = "", domPct = 0;
  let hhi = 0;
  for (const f of HOSPICE_DX_FIELDS) {
    const v = num((row as Record<string, unknown>)[f]);
    if (v > domPct) { domPct = v; domField = f; }
    hhi += v * v; // pct already in 0-100, square gives 0-10000 components
  }

  return {
    _avg_los: eps > 0 ? parseFloat((days / eps).toFixed(1)) : 0,
    _payment_per_bene: benes > 0 ? parseFloat((pay / benes).toFixed(0)) : 0,
    _payment_per_day: days > 0 ? parseFloat((pay / days).toFixed(0)) : 0,
    _episodes_per_bene: benes > 0 ? parseFloat((eps / benes).toFixed(2)) : 0,
    _nursing_minutes_per_bene: benes > 0 ? parseFloat((nMin / benes).toFixed(0)) : 0,
    _visits_per_bene: benes > 0 ? parseFloat((totalVisits / benes).toFixed(1)) : 0,
    _visit_mix_nrsng_pct: totalVisits > 0 ? parseFloat(((nVis / totalVisits) * 100).toFixed(1)) : 0,
    _visit_mix_aide_pct:  totalVisits > 0 ? parseFloat(((aVis / totalVisits) * 100).toFixed(1)) : 0,
    _visit_mix_msw_pct:   totalVisits > 0 ? parseFloat(((mVis / totalVisits) * 100).toFixed(1)) : 0,
    _routine_home_care_pct: num(row.HOSPC_RHC_DAYS_PCT),
    _dominant_dx_field: domField,
    _dominant_dx_label: HOSPICE_DX_LABELS[domField] ?? "",
    _dominant_dx_pct: domPct,
    _dx_concentration: parseFloat(hhi.toFixed(0)),
  };
}

export async function getHospiceMarketShare(
  state?: string,
  maxRows = 200,
  opts: HospiceQueryOptions = {},
): Promise<HospiceResult> {
  const groupBy: HospiceGroupBy = opts.groupBy ?? "city";
  const wantEnrich = opts.enrich !== false;

  // Fetch provider rows (paginated until exhausted)
  const providerFilters: Record<string, string> = { "filter[SMRY_CTGRY]": "PROVIDER" };
  if (state) providerFilters["filter[STATE]"] = state;
  if (opts.year) providerFilters["filter[YEAR]"] = opts.year;

  // Kick off Care Compare bulk join in parallel with the PAC fetch (it's
  // cached in-process after the first hit, so subsequent calls are cheap).
  const enrichPromise = wantEnrich
    ? getHospiceCareCompareIndex().catch(() => new Map<string, HospiceCareCompareJoin>())
    : Promise.resolve(new Map<string, HospiceCareCompareJoin>());

  const data = await fetchCmsAllPages(HOSPICE_UUID, providerFilters);

  if (!data.length) {
    return {
      rows: [],
      group_by: groupBy, total_volume: 0, market_totals: {},
      state_summary: null, year_used: opts.year ?? "", years_available: [],
      total_provider_count: 0, care_compare_enriched: 0,
      interpretation_note: state || opts.year
        ? `No hospice providers found for filter (state=${state ?? "—"}, year=${opts.year ?? "—"}).`
        : "No data found.",
    };
  }

  const sample = data[0];
  const provCol  = findColCached(HOSPICE_UUID, sample, ["PRVDR_NAME","Rndrng_Prvdr_Org_Name","ProviderName","Provider","provider_name"]) ?? Object.keys(sample)[0];
  const idCol    = findColCached(HOSPICE_UUID, sample, ["PRVDR_ID","CCN","ProviderID","provider_id"]) ?? "";
  const volCol   = findColCached(HOSPICE_UUID, sample, ["BENE_DSTNCT_CNT","Tot_Benes","TotBenes","Beneficiaries","bene_dstnct_cnt","total_benes"]) ?? Object.keys(sample)[2];
  const cityCol  = findColCached(HOSPICE_UUID, sample, ["PRVDR_CITY","Rndrng_Prvdr_City","City","prvdr_city"]) ?? "";
  const stateCol = findColCached(HOSPICE_UUID, sample, ["STATE","Rndrng_Prvdr_State_Abrvtn","State","state"]) ?? "";
  const zipCol   = findColCached(HOSPICE_UUID, sample, ["PRVDR_ZIP","Rndrng_Prvdr_Zip_Cd","Zip","prvdr_zip","zip_code"]) ?? "";
  const payCol   = findColCached(HOSPICE_UUID, sample, ["TOT_MDCR_PYMT_AMT","Tot_Mdcr_Pymt_Amt","TotMdcrPymtAmt","MedicarePayment"]) ?? "";
  const ageCol   = findColCached(HOSPICE_UUID, sample, ["BENE_AVG_AGE","Bene_Avg_Age","BeneAvgAge","avg_age"]) ?? "";
  const riskCol  = findColCached(HOSPICE_UUID, sample, ["BENE_AVG_RISK_SCRE","Bene_Avg_Risk_Scre","BeneAvgRiskScre","risk_score"]) ?? "";
  const yearCol  = findColCached(HOSPICE_UUID, sample, ["YEAR","Year","year"]) ?? "";

  // Discover years across the unfiltered pull. If caller didn't pin a year,
  // pin to the latest (avoids mixing multi-year data in market-share math).
  const yearsAvailable = yearCol
    ? Array.from(new Set(data.map((r) => String(r[yearCol] ?? "")).filter(Boolean))).sort().reverse()
    : [];
  const yearUsed = opts.year ?? yearsAvailable[0] ?? "";
  const yearScoped = yearUsed && yearCol
    ? data.filter((r) => String(r[yearCol]) === yearUsed)
    : data;

  // Resolve grouping column based on caller's choice.
  const mktCol = groupBy === "state" ? stateCol : cityCol;
  const mktColUsed = mktCol || stateCol || cityCol;

  const mktTotals: Record<string, number> = {};
  let totalVolume = 0;
  for (const row of yearScoped) {
    const mkt = String(row[mktColUsed] ?? "All");
    const vol = num(row[volCol]);
    mktTotals[mkt] = (mktTotals[mkt] ?? 0) + vol;
    totalVolume += vol;
  }

  // Await Care Compare enrichment (parallel to PAC fetch).
  const careCompareIndex = await enrichPromise;
  let enrichedCount = 0;

  const stdzPayCol = findColCached(HOSPICE_UUID, sample, ["TOT_MDCR_STDZD_PYMT_AMT"]) ?? "";
  const allowedCol = findColCached(HOSPICE_UUID, sample, ["TOT_ALOWD_AMT"]) ?? "";
  const chargesCol = findColCached(HOSPICE_UUID, sample, ["TOT_CHRG_AMT"]) ?? "";

  const rows: HospiceRow[] = yearScoped.map((row) => {
    const mkt = String(row[mktColUsed] ?? "All");
    const vol = num(row[volCol]);
    const total = mktTotals[mkt] || 1;
    const ccn = idCol ? String(row[idCol] ?? "") : "";
    const cc = ccn ? careCompareIndex.get(ccn) : undefined;
    if (cc) enrichedCount++;
    const derived = computeHospiceDerived(row);
    return {
      ...row,
      _provider_name: String(row[provCol] ?? ""),
      _provider_id: ccn,
      _city: cityCol ? String(row[cityCol] ?? "") : "",
      _state: stateCol ? String(row[stateCol] ?? "") : "",
      _zip: zipCol ? String(row[zipCol] ?? "") : "",
      _payment: payCol ? num(row[payCol]) : 0,
      _standardized_payment: stdzPayCol ? num(row[stdzPayCol]) : 0,
      _allowed_amount: allowedCol ? num(row[allowedCol]) : 0,
      _total_charges: chargesCol ? num(row[chargesCol]) : 0,
      _avg_age: ageCol ? num(row[ageCol]) : 0,
      _risk_score: riskCol ? num(row[riskCol]) : 0,
      _market: mkt,
      _market_volume: vol,
      _market_total_volume: total,
      _market_share_pct: parseFloat(((vol / total) * 100).toFixed(2)),
      _rank: 0,
      _year: yearCol ? String(row[yearCol] ?? "") : "",
      ...derived,
      ...(cc ?? {}),
    } as HospiceRow;
  });

  rows.sort((a, b) => b._market_share_pct - a._market_share_pct);
  rows.forEach((r, i) => { r._rank = i + 1; });

  // Pull the matching STATE rollup when a state is filtered, so the page can
  // show a "state context" card without an extra round-trip from the client.
  let stateSummary: HospiceStateSummary | null = null;
  if (state) {
    try {
      const stateFilters: Record<string, string> = {
        "filter[SMRY_CTGRY]": "STATE",
        "filter[STATE]": state,
      };
      if (yearUsed) stateFilters["filter[YEAR]"] = yearUsed;
      const stateRows = await fetchCmsAllPages(HOSPICE_UUID, stateFilters, { pageSize: 100, maxRows: 100 });
      if (stateRows.length) {
        const r = stateRows[0];
        const stateTotal = num(r[volCol]) || rows.reduce((s, x) => s + x._market_volume, 0);
        // HHI: sum of squared provider shares (×10000). DOJ thresholds: <1500 unconcentrated,
        // 1500-2500 moderately concentrated, >2500 highly concentrated.
        const hhi = stateTotal > 0
          ? rows.reduce((s, x) => s + Math.pow((x._market_volume / stateTotal) * 100, 2), 0)
          : 0;
        stateSummary = {
          state,
          total_beneficiaries: num(r[volCol]),
          total_medicare_payment: payCol ? num(r[payCol]) : 0,
          total_standardized_payment: stdzPayCol ? num(r[stdzPayCol]) : 0,
          provider_count: rows.length,
          market_hhi: parseFloat(hhi.toFixed(0)),
        };
      }
    } catch {
      // State rollup is best-effort; fall through.
    }
  }

  return {
    rows: rows.slice(0, maxRows),
    group_by: groupBy,
    total_volume: totalVolume,
    market_totals: mktTotals,
    state_summary: stateSummary,
    year_used: yearUsed,
    years_available: yearsAvailable,
    total_provider_count: rows.length,
    care_compare_enriched: enrichedCount,
    interpretation_note: `Market share = provider beneficiary volume ÷ ${groupBy === "state" ? "state" : "city"} total${yearUsed ? ` (year ${yearUsed})` : ""}. Sources: Medicare PAC Utilization Hospice (claims), Hospice Care Compare (CAHPS + HIS + HCI + ownership).`,
  };
}
// References to provCol/volCol/mktColUsed live above in the row-building loop;
// they're internal implementation details and intentionally omitted from the result.

// ─── Per-provider deep-dive (HIS + CAHPS + ownership + service area) ────────

export interface HospiceMeasureScore {
  measure_code: string;
  measure_name: string;
  score: string;
  star_rating?: string;
  date_range: string;
}

export interface HospiceOwnerRow {
  owner_name: string;
  owner_dba: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  role_text: string;
  percentage_ownership: string;
  association_date: string;
  for_profit: boolean;
  non_profit: boolean;
  private_equity: boolean;
  reit: boolean;
  chain_home_office: boolean;
  holding_company: boolean;
  investment_firm: boolean;
  management_services: boolean;
  corporation: boolean;
  llc: boolean;
}

export interface HospiceEnrollmentInfo {
  enrollment_id: string;
  npi: string;
  doing_business_as: string;
  org_type_structure: string;
  proprietary_nonprofit: string;
  incorporation_date: string;
  incorporation_state: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface HospiceProviderDetail {
  ccn: string;
  facility_name: string;
  general_info: {
    address: string;
    city: string;
    state: string;
    zip: string;
    county: string;
    phone: string;
    ownership_type: string;
    cms_region: string;
    certification_date: string;
  } | null;
  enrollment: HospiceEnrollmentInfo | null;
  owners: HospiceOwnerRow[];
  his_measures: HospiceMeasureScore[];   // H_001..H_011 process measures
  hci_measures: HospiceMeasureScore[];   // H_012_* Hospice Care Index
  profile: HospiceMeasureScore[];        // census/case mix/care locations
  cahps: HospiceMeasureScore[];          // 22 family-experience measures
  cahps_national: Record<string, string>; // measure_code → national-average score
  service_area_zips: string[];
}

function yes(v: unknown): boolean {
  return String(v ?? "").toUpperCase() === "Y";
}

export async function getHospiceProviderDetail(ccn: string): Promise<HospiceProviderDetail> {
  if (!ccn) throw new Error("ccn required");
  const padded = ccn.padStart(6, "0");

  const [general, his, cahps, zips, enrollment, nationalCahps] = await Promise.all([
    fetchCareCompareAll("yc9t-dgbk", [{ property: "cms_certification_number_ccn", value: padded }]),
    fetchCareCompareAll("252m-zfp9", [{ property: "cms_certification_number_ccn", value: padded }]),
    fetchCareCompareAll("gxki-hrr8", [{ property: "cms_certification_number_ccn", value: padded }]),
    fetchCareCompareAll("95rg-2usp", [{ property: "cms_certification_number_ccn", value: padded }]).catch(() => [] as Record<string, unknown>[]),
    fetchCmsAllPages("25704213-e833-4b8b-9dbc-58dd17149209", { "filter[CCN]": padded }, { pageSize: 100, maxRows: 100 }).catch(() => [] as Record<string, unknown>[]),
    getCahpsNationalBenchmark().catch(() => new Map<string, string>()),
  ]);

  const g = general[0];
  const general_info = g ? {
    address: [g.address_line_1, g.address_line_2].filter(Boolean).join(" "),
    city: String(g.citytown ?? ""),
    state: String(g.state ?? ""),
    zip: String(g.zip_code ?? ""),
    county: String(g.countyparish ?? ""),
    phone: String(g.telephone_number ?? ""),
    ownership_type: String(g.ownership_type ?? ""),
    cms_region: String(g.cms_region ?? ""),
    certification_date: String(g.certification_date ?? ""),
  } as HospiceProviderDetail["general_info"] : null;

  // Partition the quality measures into HIS process (H_001..H_011), HCI (H_012_*), and profile fields.
  const his_measures: HospiceMeasureScore[] = [];
  const hci_measures: HospiceMeasureScore[] = [];
  const profile: HospiceMeasureScore[] = [];
  for (const r of his) {
    const m: HospiceMeasureScore = {
      measure_code: String(r.measure_code ?? ""),
      measure_name: String(r.measure_name ?? ""),
      score: String(r.score ?? ""),
      date_range: String(r.measure_date_range ?? ""),
    };
    const c = m.measure_code;
    if (/^H_0(0[1-8]|11)_/.test(c)) his_measures.push(m);
    else if (c.startsWith("H_012")) hci_measures.push(m);
    else profile.push(m);
  }

  const cahpsMeasures: HospiceMeasureScore[] = cahps.map((r) => ({
    measure_code: String(r.measure_code ?? ""),
    measure_name: String(r.measure_name ?? ""),
    score: String(r.score ?? ""),
    star_rating: String(r.star_rating ?? ""),
    date_range: String(r.date ?? ""),
  }));

  // Hospice enrollments → ownership join
  let enrollmentInfo: HospiceEnrollmentInfo | null = null;
  let owners: HospiceOwnerRow[] = [];
  const enr = enrollment[0];
  if (enr) {
    enrollmentInfo = {
      enrollment_id: String(enr["ENROLLMENT ID"] ?? ""),
      npi: String(enr.NPI ?? ""),
      doing_business_as: String(enr["DOING BUSINESS AS NAME"] ?? ""),
      org_type_structure: String(enr["ORGANIZATION TYPE STRUCTURE"] ?? ""),
      proprietary_nonprofit: String(enr.PROPRIETARY_NONPROFIT ?? ""),
      incorporation_date: String(enr["INCORPORATION DATE"] ?? ""),
      incorporation_state: String(enr["INCORPORATION STATE"] ?? ""),
      address: [enr["ADDRESS LINE 1"], enr["ADDRESS LINE 2"]].filter(Boolean).join(" "),
      city: String(enr.CITY ?? ""),
      state: String(enr.STATE ?? ""),
      zip: String(enr["ZIP CODE"] ?? ""),
    };
    try {
      const ownerRows = await fetchCmsAllPages(
        "e983965e-1603-4cb8-82b5-c40090e380d1",
        { "filter[ENROLLMENT ID]": enrollmentInfo.enrollment_id },
        { pageSize: 200, maxRows: 200 },
      );
      owners = ownerRows.map((r) => ({
        owner_name: String(r["ORGANIZATION NAME - OWNER"] || `${r["FIRST NAME - OWNER"] ?? ""} ${r["LAST NAME - OWNER"] ?? ""}`.trim()),
        owner_dba: String(r["DOING BUSINESS AS NAME - OWNER"] ?? ""),
        owner_address: [r["ADDRESS LINE 1 - OWNER"], r["ADDRESS LINE 2 - OWNER"]].filter(Boolean).join(" "),
        owner_city: String(r["CITY - OWNER"] ?? ""),
        owner_state: String(r["STATE - OWNER"] ?? ""),
        owner_zip: String(r["ZIP CODE - OWNER"] ?? ""),
        role_text: String(r["ROLE TEXT - OWNER"] ?? ""),
        percentage_ownership: String(r["PERCENTAGE OWNERSHIP"] ?? ""),
        association_date: String(r["ASSOCIATION DATE - OWNER"] ?? ""),
        for_profit: yes(r["FOR PROFIT - OWNER"]),
        non_profit: yes(r["NON PROFIT - OWNER"]),
        private_equity: yes(r["PRIVATE EQUITY COMPANY - OWNER"]),
        reit: yes(r["REIT - OWNER"]),
        chain_home_office: yes(r["CHAIN HOME OFFICE - OWNER"]),
        holding_company: yes(r["HOLDING COMPANY - OWNER"]),
        investment_firm: yes(r["INVESTMENT FIRM - OWNER"]),
        management_services: yes(r["MANAGEMENT SERVICES COMPANY - OWNER"]),
        corporation: yes(r["CORPORATION - OWNER"]),
        llc: yes(r["LLC - OWNER"]),
      }));
    } catch {
      // Ownership lookup is best-effort.
    }
  }

  const service_area_zips = Array.from(new Set(zips.map((r) => String(r.zip_code ?? r.zip ?? "")).filter(Boolean))).sort();

  return {
    ccn: padded,
    facility_name: String(g?.facility_name ?? ""),
    general_info,
    enrollment: enrollmentInfo,
    owners,
    his_measures,
    hci_measures,
    profile,
    cahps: cahpsMeasures,
    cahps_national: Object.fromEntries(nationalCahps),
    service_area_zips,
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
    // Provider Data API caps `limit` at 1500 — exceeding it returns HTTP 400.
    body: JSON.stringify({ conditions, limit: 1500, offset: 0 }),
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
  // Fetch a larger window when a search term is provided (keyword does fuzzy
  // matching across brand/generic/manufacturer) — we'll sort + dedupe client-side.
  // Without a search term, fetch the largest page CMS allows and rank locally;
  // CMS server-side sort on `-Tot_Spndng_2023` was unreliable and slow.
  const fetchSize = drugName ? 500 : 1000;
  const params = new URLSearchParams({ size: String(fetchSize) });
  if (drugName) params.set("keyword", drugName);

  const res = await fetch(`${CMS_DATA_API}/dataset/${datasetId}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  // Dedupe by (Brnd_Name, Gnrc_Name) — the raw dataset has one row per
  // manufacturer; we keep the row with the highest 2023 spending per drug.
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of data) {
    const key = `${String(item.Brnd_Name ?? "")}|${String(item.Gnrc_Name ?? "")}`.toLowerCase();
    const prev = byKey.get(key);
    if (!prev || num(item.Tot_Spndng_2023) > num(prev.Tot_Spndng_2023)) {
      byKey.set(key, item);
    }
  }
  const deduped = Array.from(byKey.values());

  const rows: DrugSpendingRow[] = deduped.map((item) => {
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

  // Sort by latest spending desc (client-side since CMS sort was unreliable).
  rows.sort((a, b) => (b.year_2023_spending ?? 0) - (a.year_2023_spending ?? 0));
  return { rows: rows.slice(0, maxRows), total: rows.length, spending_type: spendingType };
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
  // Two datasets:
  //   - by-provider: 14d8e8a9-... (no per-drug detail; one row per prescriber)
  //   - by-provider-and-drug: 9552739e-... (one row per prescriber × drug; keyword-searchable)
  // Server-side sort by `-Tot_Clms` causes the by-provider dataset to time out
  // (tens of millions of rows); fetch unsorted and rank locally instead.
  const useProviderDataset = !drugName;
  const datasetId = useProviderDataset
    ? "14d8e8a9-7e9b-4370-a044-bf97c46b4b44"
    : "9552739e-3d05-4c1b-8eff-ecabf391e2e5";

  // Pull a larger sample so client-side ranking surfaces top-volume prescribers.
  const fetchSize = state || prescriberType ? 5000 : 500;
  const params = new URLSearchParams({ size: String(fetchSize) });
  if (drugName && !useProviderDataset) params.set("keyword", drugName);
  if (state) params.set("filter[Prscrbr_State_Abrvtn]", state);
  if (prescriberType) params.set("filter[Prscrbr_Type]", prescriberType);

  const res = await fetch(`${CMS_DATA_API}/dataset/${datasetId}/data?${params}`, {
    signal: AbortSignal.timeout(45_000),
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

  rows.sort((a, b) => b.total_claims - a.total_claims);
  return { rows: rows.slice(0, maxRows), total: rows.length };
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

// Fields returned by the search endpoint (different from detail endpoint)
export interface NonprofitOrg {
  ein: string;       // numeric EIN as string
  strein: string;    // formatted "12-3456789"
  name: string;
  sub_name: string;
  city: string;
  state: string;
  ntee_code: string;
  subseccd: number;  // 501(c)(X) — 3 = 501(c)(3)
  have_filings: boolean | null;
  have_pdfs: boolean | null;
  score: number;
  // Populated from detail endpoint when expanded:
  income_amount?: number;
  asset_amount?: number;
  revenue_amount?: number;
  address?: string;
  zipcode?: string;
  ruling_date?: string;
  tax_period?: string;
  num_filings?: number;
}

export interface NonprofitFiling {
  tax_prd_yr: string;
  tax_prd: string;        // MMYYYY period end
  formtype: string;       // "990", "990EZ", "990PF"
  pdf_url: string;
  updated: string;
  totrevenue: number;
  totfuncexpns: number;
  totassetsend: number;
  totliabend: number;
  totnetassetend: number; // net assets (assets - liabilities)
  compnsatncurrofcr: number;
  pct_compnsatncurrofcr: number; // exec comp as % of revenue
  othrsalwages: number;
  payrolltx: number;
  profndraising: number;
  totcntrbgfts: number;   // total contributions & gifts
  totprgmrevnue: number;
  invstmntinc: number;
  netincfndrsng: number;
  netincsales: number;
  miscrevtot11e: number;
}

export interface NonprofitDetail {
  organization: NonprofitOrg;
  filings: NonprofitFiling[];
}

function formtypeLabel(code: unknown): string {
  switch (String(code)) {
    case "0": return "990";
    case "1": return "990EZ";
    case "2": return "990EZ";
    case "4": return "990PF";
    default: return String(code ?? "990");
  }
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
  // ProPublica returns 404 when no matching orgs exist — treat as empty, not an error
  if (res.status === 404) return { organizations: [], total: 0 };
  if (!res.ok) throw new Error(`ProPublica API error ${res.status}`);
  const data = (await res.json()) as {
    total_results?: number;
    organizations?: Record<string, unknown>[];
  };

  const organizations: NonprofitOrg[] = (data.organizations ?? []).map((o) => ({
    ein: String(o.ein ?? ""),
    strein: String(o.strein ?? ""),
    name: String(o.name ?? ""),
    sub_name: String(o.sub_name ?? ""),
    city: String(o.city ?? ""),
    state: String(o.state ?? ""),
    ntee_code: String(o.ntee_code ?? ""),
    subseccd: Number(o.subseccd ?? 0),
    have_filings: o.have_filings != null ? Boolean(o.have_filings) : null,
    have_pdfs: o.have_pdfs != null ? Boolean(o.have_pdfs) : null,
    score: Number(o.score ?? 0),
  }));

  return { organizations, total: data.total_results ?? 0 };
}

export async function getNonprofitDetail(ein: string | number): Promise<NonprofitDetail> {
  // Accept numeric EINs from search results; strip dashes; zero-pad to 9 digits.
  const clean = String(ein).replace(/-/g, "").padStart(9, "0");
  const res = await fetch(`${PROPUBLICA_API}/organizations/${clean}.json`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) {
    return {
      organization: { ein: clean, strein: "", name: "", sub_name: "", city: "", state: "", ntee_code: "", subseccd: 0, have_filings: false, have_pdfs: false, score: 0 },
      filings: [],
    };
  }
  if (!res.ok) throw new Error(`ProPublica API error ${res.status}`);
  const data = (await res.json()) as {
    organization?: Record<string, unknown>;
    filings_with_data?: Record<string, unknown>[];
  };

  const org = data.organization ?? {};
  const filings: NonprofitFiling[] = (data.filings_with_data ?? []).map((f) => ({
    tax_prd_yr: String(f.tax_prd_yr ?? ""),
    tax_prd: String(f.tax_prd ?? ""),
    formtype: formtypeLabel(f.formtype),
    pdf_url: String(f.pdf_url ?? ""),
    updated: String(f.updated ?? ""),
    totrevenue: num(f.totrevenue),
    totfuncexpns: num(f.totfuncexpns),
    totassetsend: num(f.totassetsend),
    totliabend: num(f.totliabend),
    totnetassetend: num(f.totnetassetend),
    compnsatncurrofcr: num(f.compnsatncurrofcr),
    pct_compnsatncurrofcr: num(f.pct_compnsatncurrofcr),
    othrsalwages: num(f.othrsalwages),
    payrolltx: num(f.payrolltx),
    profndraising: num(f.profndraising),
    totcntrbgfts: num(f.totcntrbgfts),
    totprgmrevnue: num(f.totprgmrevnue),
    invstmntinc: num(f.invstmntinc),
    netincfndrsng: num(f.netincfndrsng),
    netincsales: num(f.netincsales),
    miscrevtot11e: num(f.miscrevtot11e),
  }));

  return {
    organization: {
      ein: String(org.ein ?? clean),
      strein: String(org.ein ?? "").padStart(9, "0").replace(/^(\d{2})(\d{7})$/, "$1-$2"),
      name: String(org.name ?? ""),
      sub_name: String(org.careofname ?? ""),
      city: String(org.city ?? ""),
      state: String(org.state ?? ""),
      ntee_code: String(org.ntee_code ?? ""),
      subseccd: Number(org.subsection_code ?? 0),
      have_filings: filings.length > 0,
      have_pdfs: Boolean(org.have_pdfs),
      score: 0,
      income_amount: num(org.income_amount),
      asset_amount: num(org.asset_amount),
      revenue_amount: num(org.revenue_amount),
      address: org.address ? String(org.address) : undefined,
      zipcode: org.zipcode ? String(org.zipcode) : undefined,
      ruling_date: org.ruling_date ? String(org.ruling_date) : undefined,
      tax_period: org.tax_period ? String(org.tax_period) : undefined,
      num_filings: filings.length,
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

  return { trials, total: trials.length };
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
