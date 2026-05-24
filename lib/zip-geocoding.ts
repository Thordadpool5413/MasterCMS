// Zippopotam.us API for accurate zip code geocoding (no API key needed)
// Returns centroid coordinates for US zip codes

interface ZipGeoLocation {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

// In-memory cache for zip code lookups (persists across requests in the same process)
const zipCache = new Map<string, ZipGeoLocation>();

export async function getZipCodeLocation(zip: string): Promise<[number, number]> {
  const normalized = zip.trim().substring(0, 5);

  // Check cache first
  if (zipCache.has(normalized)) {
    const cached = zipCache.get(normalized)!;
    return [cached.latitude, cached.longitude];
  }

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${normalized}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Fallback to US center if zip not found
      return [39.8283, -98.5795];
    }

    const data = (await res.json()) as {
      places?: Array<{ latitude: string; longitude: string; "place name": string; "state abbreviation": string }>;
    };

    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      const lat = parseFloat(place.latitude);
      const lng = parseFloat(place.longitude);

      // Cache the result
      zipCache.set(normalized, {
        latitude: lat,
        longitude: lng,
        city: place["place name"] || "",
        state: place["state abbreviation"] || "",
      });

      return [lat, lng];
    }
  } catch {
    // Network error or timeout — fall through to fallback
  }

  // Fallback: return US center
  return [39.8283, -98.5795];
}

export async function getZipCodeLocations(zips: string[]): Promise<Array<{ zip: string; coords: [number, number] }>> {
  // Batch fetch with concurrency limit to avoid overwhelming the API
  const results: Array<{ zip: string; coords: [number, number] }> = [];
  const batchSize = 5;

  for (let i = 0; i < zips.length; i += batchSize) {
    const batch = zips.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (zip) => ({
        zip,
        coords: await getZipCodeLocation(zip),
      }))
    );
    results.push(...batchResults);
  }

  return results;
}
