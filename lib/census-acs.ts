// Census ACS API Integration
// Requires Census API key: https://api.census.gov/data/key_signup.html

export interface DemographicData {
  geographyName: string;
  population: number | null;
  medianHouseholdIncome: number | null;
  povertyRate: number | null;
  uninsuredRate: number | null;
  medianAge: number | null;
  collegeEducationRate: number | null;
  unemploymentRate: number | null;
  raceEthnicity: {
    whitePercent: number | null;
    hispanicPercent: number | null;
    blackPercent: number | null;
    asianPercent: number | null;
    otherPercent: number | null;
  };
  lastUpdated: string;
}

const CENSUS_API_BASE = "https://api.census.gov/data/2021/acs/acs5";
const TIMEOUT = 8000;

async function fetchWithTimeout(url: string, timeout: number = TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDemographicData(
  geography: "state" | "county" | "tract",
  location: string,
  apiKey?: string
): Promise<DemographicData | null> {
  try {
    if (!apiKey) {
      console.warn("Census API key not provided. Visit https://api.census.gov/data/key_signup.html to get one.");
      return null;
    }

    // Variables for ACS 5-year data
    const variables = [
      "B01003_001E", // Total population
      "B19013_001E", // Median household income
      "C17002_001E", // Poverty status
      "B27001_001E", // Health insurance coverage
      "B01002_001E", // Median age
      "B15003_001E", // Educational attainment
      "B23025_005E", // Unemployment
      "B02001_002E", // White population
      "B03003_003E", // Hispanic population
      "B02001_003E", // Black population
      "B02001_005E", // Asian population
    ].join(",");

    const params = new URLSearchParams({
      get: variables,
      for: buildGeographyParam(geography, location),
      key: apiKey,
    });

    const url = `${CENSUS_API_BASE}?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`Census API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as (string | number)[][];
    if (!data || data.length < 2) return null;

    const row = data[1];
    const totalPop = row[0] ? parseInt(String(row[0]), 10) : null;
    const medianIncome = row[1] ? parseInt(String(row[1]), 10) : null;
    const povertyCount = row[2] ? parseInt(String(row[2]), 10) : null;
    const insuredCount = row[3] ? parseInt(String(row[3]), 10) : null;
    const medianAge = row[4] ? parseFloat(String(row[4])) : null;
    const educationCount = row[5] ? parseInt(String(row[5]), 10) : null;
    const unemployed = row[6] ? parseInt(String(row[6]), 10) : null;
    const whiteCount = row[7] ? parseInt(String(row[7]), 10) : null;
    const hispanicCount = row[8] ? parseInt(String(row[8]), 10) : null;
    const blackCount = row[9] ? parseInt(String(row[9]), 10) : null;
    const asianCount = row[10] ? parseInt(String(row[10]), 10) : null;

    const povertyRate = totalPop && povertyCount ? (povertyCount / totalPop) * 100 : null;
    const uninsuredRate = totalPop && insuredCount ? ((totalPop - insuredCount) / totalPop) * 100 : null;
    const collegeRate = educationCount && totalPop ? (educationCount / totalPop) * 100 : null;
    const unemployment = unemployed && totalPop ? (unemployed / totalPop) * 100 : null;

    const whitePercent = totalPop && whiteCount ? (whiteCount / totalPop) * 100 : null;
    const hispanicPercent = totalPop && hispanicCount ? (hispanicCount / totalPop) * 100 : null;
    const blackPercent = totalPop && blackCount ? (blackCount / totalPop) * 100 : null;
    const asianPercent = totalPop && asianCount ? (asianCount / totalPop) * 100 : null;
    const otherPercent =
      whitePercent !== null && hispanicPercent !== null && blackPercent !== null && asianPercent !== null
        ? 100 - whitePercent - hispanicPercent - blackPercent - asianPercent
        : null;

    return {
      geographyName: location,
      population: totalPop,
      medianHouseholdIncome: medianIncome,
      povertyRate,
      uninsuredRate,
      medianAge,
      collegeEducationRate: collegeRate,
      unemploymentRate: unemployment,
      raceEthnicity: {
        whitePercent,
        hispanicPercent,
        blackPercent,
        asianPercent,
        otherPercent,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Census API request failed:", err);
    return null;
  }
}

function buildGeographyParam(
  geography: "state" | "county" | "tract",
  _location: string
): string {
  // Simple implementation - can be enhanced based on location format
  if (geography === "state") {
    return `state:*`;
  } else if (geography === "county") {
    return `county:*&in=state:*`;
  } else {
    return `tract:*&in=state:*+county:*`;
  }
}

export async function getDemographicStats(
  locations: Array<{ geography: "state" | "county" | "tract"; location: string }>,
  apiKey?: string
): Promise<Map<string, DemographicData | null>> {
  const results = new Map<string, DemographicData | null>();

  for (const loc of locations) {
    const key = `${loc.geography}:${loc.location}`;
    const data = await getDemographicData(loc.geography, loc.location, apiKey);
    results.set(key, data);
  }

  return results;
}
