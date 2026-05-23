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
    const found = keys.find(
      (k) => k.toLowerCase().replace(/[_\s-]/g, "") === c.toLowerCase().replace(/[_\s-]/g, ""),
    );
    if (found) return found;
  }
  return null;
}

const HOSPICE_DRG_TERMS = [
  "heart failure", "sepsis", "respiratory", "copd", "pneumonia", "renal failure",
  "kidney", "stroke", "malignancy", "cancer", "dementia", "cirrhosis", "liver", "failure",
];

// ─── Hospice Market Share ─────────────────────────────────────────────────────

export async function getHospiceMarketShare(state?: string, maxRows = 200) {
  const params = new URLSearchParams({ size: "5000" });
  if (state) params.set("filter[STATE]", state);

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const raw = await res.json();
  const allData: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>).data)
      ? ((raw as Record<string, unknown>).data as Record<string, unknown>[])
      : [];

  // Filter to PROVIDER-level rows only (exclude NATION and STATE summaries)
  const data = allData.filter((r) => {
    const cat = String(r["SMRY_CTGRY"] ?? r["SMRY_CTGRY"] ?? "").toUpperCase();
    return cat === "PROVIDER" || (cat !== "NATION" && cat !== "STATE" && cat !== "");
  });

  if (!data.length) {
    return { rows: [], provider_column_used: "PRVDR_NAME", volume_column_used: "BENE_DSTNCT_CNT", market_column_used: "PRVDR_CITY", total_volume: 0, market_totals: {}, interpretation_note: "No data found." };
  }

  // Known column names from the actual CMS dataset
  const mktTotals: Record<string, number> = {};
  let totalVolume = 0;
  for (const row of data) {
    const mkt = String(row["PRVDR_CITY"] ?? row["STATE"] ?? "All");
    const vol = num(row["BENE_DSTNCT_CNT"]);
    mktTotals[mkt] = (mktTotals[mkt] ?? 0) + vol;
    totalVolume += vol;
  }

  const rows = data.map((row) => {
    const mkt = String(row["PRVDR_CITY"] ?? row["STATE"] ?? "All");
    const vol = num(row["BENE_DSTNCT_CNT"]);
    const total = mktTotals[mkt] || 1;
    return {
      ...row,
      _provider_name: String(row["PRVDR_NAME"] ?? ""),
      _city: String(row["PRVDR_CITY"] ?? ""),
      _state: String(row["STATE"] ?? ""),
      _zip: String(row["PRVDR_ZIP"] ?? ""),
      _payment: num(row["TOT_MDCR_PYMT_AMT"]),
      _avg_age: num(row["BENE_AVG_AGE"]),
      _risk_score: num(row["BENE_AVG_RISK_SCRE"] ?? row["BENE_AVG_RISK_SCORE"]),
      _market: mkt,
      _market_volume: vol,
      _market_total_volume: total,
      _market_share_pct: parseFloat(((vol / total) * 100).toFixed(2)),
      _rank: 0,
    };
  });

  rows.sort((a, b) => b._market_share_pct - a._market_share_pct);
  rows.forEach((r, i) => { r._rank = i + 1; });

  return {
    rows: rows.slice(0, maxRows),
    provider_column_used: "PRVDR_NAME",
    volume_column_used: "BENE_DSTNCT_CNT",
    market_column_used: "PRVDR_CITY",
    total_volume: totalVolume,
    market_totals: mktTotals,
    interpretation_note: "Market share = provider beneficiary volume ÷ city total. Source: Medicare PAC Utilization Hospice.",
  };
}

// ─── Hospital Opportunity ─────────────────────────────────────────────────────

export async function getHospitalOpportunity(state?: string, city?: string, maxRows = 200) {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);
  if (city) params.set("filter[Rndrng_Prvdr_City]", city.toUpperCase());

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPITAL_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows = data.map((row) => {
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
        : "Discharge volume only",
    };
  });

  rows.sort((a, b) => b._opportunity_score - a._opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = discharges × clinical weight (DRG relevance) + payment weight. Source: Medicare Inpatient Hospitals by Provider & Service.",
  };
}

// ─── Nursing Home Opportunity ─────────────────────────────────────────────────

export async function getNursingHomeOpportunity(state?: string, city?: string, maxRows = 200) {
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

  const rows = data.map((row) => {
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
    };
  });

  rows.sort((a, b) => b._snf_opportunity_score - a._snf_opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = beds + quality pressure × 18. Lower star ratings = higher pressure = higher hospice opportunity.",
  };
}

// ─── Drug Spending ────────────────────────────────────────────────────────────

export async function getDrugSpending(
  drugName?: string,
  spendingType: "part_d" | "part_b" = "part_d",
  maxRows = 100,
) {
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

  const rows = data.map((item) => {
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

export async function searchPrescribers(
  drugName?: string,
  state?: string,
  prescriberType?: string,
  maxRows = 100,
) {
  const datasetId = "9552739e-3d05-4c1b-8eff-ecabf391e2e5";
  const params = new URLSearchParams({ size: String(Math.min(maxRows, 500)) });
  if (state) params.set("filter[Prscrbr_State_Abrvtn]", state);
  if (prescriberType) params.set("filter[Prscrbr_Type]", prescriberType);
  params.set("sort", "-Tot_Clms");

  const res = await fetch(`${CMS_DATA_API}/dataset/${datasetId}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows = data
    .filter((item) => !drugName || String(item.Brnd_Name ?? item.Gnrc_Name ?? "").toLowerCase().includes(drugName.toLowerCase()))
    .map((item) => ({
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

  return { rows, total: rows.length };
}

// ─── NPI Lookup ───────────────────────────────────────────────────────────────

export async function lookupNpi(params: {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  state?: string;
  city?: string;
  taxonomy_description?: string;
  limit?: number;
}) {
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

// ─── ProPublica Nonprofit 990 ─────────────────────────────────────────────────

const PROPUBLICA_API = "https://projects.propublica.org/nonprofits/api/v2";

export async function searchNonprofits(query: string, stateFilter?: string) {
  const params = new URLSearchParams({ q: query });
  if (stateFilter) params.set("state[id]", stateFilter);

  const res = await fetch(`${PROPUBLICA_API}/search.json?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ProPublica API error ${res.status}`);
  const data = (await res.json()) as { total_results?: number; organizations?: unknown[] };

  return {
    organizations: data.organizations ?? [],
    total: data.total_results ?? 0,
  };
}

export async function getNonprofitDetail(ein: string) {
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
  const filings = (data.filings_with_data ?? []).map((f) => ({
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

export async function searchClinicalTrials(
  condition: string,
  stateFilter?: string,
  statusFilter?: string,
  maxResults = 25,
) {
  const params = new URLSearchParams({
    format: "json",
    pageSize: String(Math.min(maxResults, 50)),
    "query.term": condition,
  });
  if (stateFilter) params.set("query.locn", stateFilter);
  params.set("filter.overallStatus", statusFilter ?? "RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING");

  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ClinicalTrials API error ${res.status}`);
  const data = (await res.json()) as { studies?: Record<string, unknown>[]; totalCount?: number };

  const trials = (data.studies ?? []).map((study) => {
    const proto = (study.protocolSection ?? {}) as Record<string, Record<string, unknown>>;
    const idMod = proto.identificationModule ?? {};
    const statusMod = proto.statusModule ?? {};
    const sponsorMod = proto.sponsorCollaboratorsModule ?? {};
    const condMod = proto.conditionsModule ?? {};
    const designMod = proto.designModule ?? {};
    const locMod = proto.contactsLocationsModule ?? {};
    const phases = (designMod.phases as string[] | undefined) ?? [];
    const phase = phases.length ? phases.map((p) => p.replace("PHASE", "Phase ").replace("_", " ")).join(", ") : "N/A";
    const locs = ((locMod.locations as Record<string, string>[] | undefined) ?? [])
      .slice(0, 3)
      .map((l) => ({ facility: String(l.facility ?? ""), city: String(l.city ?? ""), state: String(l.state ?? "") }));
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

export async function getOpenFdaAdverseEvents(drugName: string, limit = 12) {
  const search = encodeURIComponent(`patient.drug.medicinalproduct:"${drugName.toUpperCase()}"`);
  const res = await fetch(
    `https://api.fda.gov/drug/event.json?search=${search}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 404) return { reactions: [], total_reports: 0 };
  if (!res.ok) throw new Error(`OpenFDA error ${res.status}`);
  const data = (await res.json()) as { results?: { term: string; count: number }[]; meta?: { results?: { total?: number } } };
  return { reactions: data.results ?? [], total_reports: data.meta?.results?.total ?? 0 };
}

export async function getOpenFdaDrugLabel(drugName: string) {
  const search = encodeURIComponent(`openfda.brand_name:"${drugName}"`);
  const res = await fetch(`https://api.fda.gov/drug/label.json?search=${search}&limit=1`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  if (!data.results?.length) return null;
  const r = data.results[0];
  const fda = (r.openfda as Record<string, string[]> | undefined) ?? {};
  const first = (arr: unknown): string => (Array.isArray(arr) ? String(arr[0] ?? "").slice(0, 600) : "");
  return {
    brand_name: first(fda.brand_name) || drugName,
    generic_name: first(fda.generic_name) || "",
    indications_and_usage: first(r.indications_and_usage),
    warnings: first(r.warnings),
    boxed_warning: first(r.boxed_warning),
  };
}

// ─── Census ACS Demographics ──────────────────────────────────────────────────

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

export async function getCensusStateDemographics(stateAbbr: string) {
  const apiKey = process.env["CENSUS_API_KEY"];
  if (!apiKey) return null;
  const fips = STATE_FIPS[stateAbbr.toUpperCase()];
  if (!fips) return null;

  const vars = [
    "NAME", "B01003_001E",
    "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
    "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
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
    "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
    "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
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

// ─── Backend config ───────────────────────────────────────────────────────────

export function getAvailableBackends() {
  return [
    {
      id: "anthropic",
      label: "Anthropic (Claude) + CMS Direct",
      description: "Uses Claude with built-in CMS API tools. Fastest, no external dependencies.",
      requiredEnvVars: ["ANTHROPIC_API_KEY"],
      available: !!process.env["ANTHROPIC_API_KEY"],
    },
    {
      id: "openai",
      label: "OpenAI GPT-4o + CMS Direct",
      description: "Uses GPT-4o with built-in CMS API tools.",
      requiredEnvVars: ["OPENAI_API_KEY"],
      available: !!process.env["OPENAI_API_KEY"],
    },
    {
      id: "local-mcp",
      label: "Local TypeScript MCP Server",
      description: "Connects to the medicare-mcp TypeScript server running locally.",
      requiredEnvVars: ["LOCAL_MCP_URL"],
      available: !!process.env["LOCAL_MCP_URL"],
    },
  ];
}
