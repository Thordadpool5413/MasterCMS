export interface FAERSEvent {
  serious: boolean;
  seriousnessdeath: number;
  seriousnesslifethreatening: number;
  seriousnessospitalization: number;
  seriousnessother: number;
  outcomes: string[];
}

export interface FAERSReaction {
  reactionmeddrapt: string;
  reactionmeddraversionpt: string;
  reactionoutcome: string[];
}

export interface DrugSafetyData {
  drugName: string;
  totalReports: number;
  seriousReports: number;
  deathReports: number;
  topReactions: Array<{ reaction: string; count: number }>;
  lastUpdated: string;
}

const OPENFDA_BASE = "https://api.fda.gov/drug/event.json";
const TIMEOUT = 5000;

async function fetchWithTimeout(url: string, timeout: number = TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchDrugSafety(drugName: string): Promise<DrugSafetyData | null> {
  try {
    const cleanName = drugName.trim().toLowerCase();
    const query = encodeURIComponent(`patient.drug.openfda.generic_name:"${cleanName}" OR patient.drug.openfda.brand_name:"${cleanName}"`);
    const url = `${OPENFDA_BASE}?search=${query}&limit=1`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results?.length) return null;

    const result = data.results[0];
    const events = result.reports || [];

    const reactions = new Map<string, number>();
    events.forEach((event: any) => {
      if (event.patient?.reaction) {
        const rxns = Array.isArray(event.patient.reaction) ? event.patient.reaction : [event.patient.reaction];
        rxns.forEach((rxn: any) => {
          const name = rxn.reactionmeddrapt || "Unknown";
          reactions.set(name, (reactions.get(name) || 0) + 1);
        });
      }
    });

    const seriousCount = events.filter((e: any) => e.serious === 1).length;
    const deathCount = events.filter((e: any) => e.seriousnessdeath === 1).length;

    return {
      drugName,
      totalReports: events.length,
      seriousReports: seriousCount,
      deathReports: deathCount,
      topReactions: Array.from(reactions.entries())
        .map(([reaction, count]) => ({ reaction, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("OpenFDA search failed:", err);
    return null;
  }
}

export async function getDrugSafetyStats(drugNames: string[]): Promise<Map<string, DrugSafetyData | null>> {
  const results = new Map<string, DrugSafetyData | null>();

  for (const drugName of drugNames) {
    const data = await searchDrugSafety(drugName);
    results.set(drugName, data);
  }

  return results;
}
