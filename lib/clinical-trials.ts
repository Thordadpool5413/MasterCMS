export interface ClinicalTrial {
  id: string;
  title: string;
  status: "RECRUITING" | "NOT_YET_RECRUITING" | "ENROLLING_BY_INVITATION" | "ACTIVE_NOT_RECRUITING" | "COMPLETED" | "TERMINATED" | "WITHDRAWN" | string;
  phase: string | null;
  studyType: string;
  conditions: string[];
  interventions: string[];
  enrollment: number | null;
  startDate: string | null;
  completionDate: string | null;
  locations: string[];
  sponsor: string;
  url: string;
}

export interface ClinicalTrialsSearchResult {
  drugName: string;
  totalStudies: number;
  studies: ClinicalTrial[];
  lastUpdated: string;
}

const CLINICALTRIALS_API = "https://clinicaltrials.gov/api/v2/studies";
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

export async function searchClinicalTrials(drugName: string, limit: number = 10): Promise<ClinicalTrialsSearchResult | null> {
  try {
    const cleanName = drugName.trim().toLowerCase();
    const params = new URLSearchParams({
      query: `drug:${cleanName}`,
      pageSize: String(limit),
      format: "json",
    });

    const url = `${CLINICALTRIALS_API}?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return null;

    const data = await response.json() as { studies?: Array<{
      protocolSection: {
        identificationModule: {
          nctId: string;
          officialTitle?: string;
          briefTitle?: string;
        };
        statusModule?: {
          overallStatus?: string;
          enrollmentInfo?: { count?: number };
          startDateStruct?: { date?: string };
          completionDateStruct?: { date?: string };
        };
        designModule?: {
          phases?: string[];
          studyType?: string;
        };
        conditionsModule?: {
          conditions?: string[];
        };
        armsInterventionsModule?: {
          interventions?: Array<{ name?: string }>;
        };
        contactsLocationsModule?: {
          locations?: Array<{ facility?: string; city?: string; state?: string; country?: string }>;
          centralContacts?: Array<{ name?: string; role?: string }>;
        };
        sponsorCollaboratorsModule?: {
          leadSponsor?: { name?: string };
        };
      };
    }> };

    if (!data.studies?.length) return null;

    const studies: ClinicalTrial[] = data.studies.slice(0, limit).map((study) => {
      const id = study.protocolSection?.identificationModule?.nctId || "";
      const title = study.protocolSection?.identificationModule?.officialTitle ||
                   study.protocolSection?.identificationModule?.briefTitle || "";
      const status = study.protocolSection?.statusModule?.overallStatus || "UNKNOWN";
      const phase = study.protocolSection?.designModule?.phases?.[0] || null;
      const studyType = study.protocolSection?.designModule?.studyType || "Other";
      const conditions = study.protocolSection?.conditionsModule?.conditions || [];
      const interventions = study.protocolSection?.armsInterventionsModule?.interventions?.map(i => i.name || "").filter(Boolean) || [];
      const enrollment = study.protocolSection?.statusModule?.enrollmentInfo?.count || null;
      const startDate = study.protocolSection?.statusModule?.startDateStruct?.date || null;
      const completionDate = study.protocolSection?.statusModule?.completionDateStruct?.date || null;
      const locations = (study.protocolSection?.contactsLocationsModule?.locations || [])
        .map(loc => [loc.city, loc.state, loc.country].filter(Boolean).join(", "))
        .filter(Boolean);
      const sponsor = study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name || "Unknown";

      return {
        id,
        title,
        status: status as ClinicalTrial["status"],
        phase,
        studyType,
        conditions,
        interventions,
        enrollment,
        startDate,
        completionDate,
        locations,
        sponsor,
        url: `https://clinicaltrials.gov/ct2/show/${id}`,
      };
    });

    return {
      drugName,
      totalStudies: studies.length,
      studies,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("ClinicalTrials.gov search failed:", err);
    return null;
  }
}

export async function getClinicalTrialsStats(drugNames: string[]): Promise<Map<string, ClinicalTrialsSearchResult | null>> {
  const results = new Map<string, ClinicalTrialsSearchResult | null>();

  for (const drugName of drugNames) {
    const data = await searchClinicalTrials(drugName);
    results.set(drugName, data);
  }

  return results;
}
