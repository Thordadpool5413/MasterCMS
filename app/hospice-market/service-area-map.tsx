"use client";

import { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { getZipCodeLocations } from "@/lib/zip-geocoding";

const MapContent = dynamic(
  () => import("react-leaflet").then(m => {
    const MapContainer = m.MapContainer;
    const TileLayer = m.TileLayer;
    const CircleMarker = m.CircleMarker;
    const Popup = m.Popup;

    return {
      default: ({ zips }: { zips: string[] }) => {
        const [markers, setMarkers] = useState<Array<{ zip: string; coords: [number, number] }>>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
          (async () => {
            try {
              const results = await getZipCodeLocations(zips.slice(0, 500));
              setMarkers(results);
            } catch {
              setMarkers([]);
            } finally {
              setLoading(false);
            }
          })();
        }, [zips]);

        if (loading) return <div className="h-96 flex items-center justify-center">Loading map...</div>;

        const bounds = markers.length > 0
          ? [
              [Math.min(...markers.map(m => m.coords[0])) - 2, Math.min(...markers.map(m => m.coords[1])) - 2],
              [Math.max(...markers.map(m => m.coords[0])) + 2, Math.max(...markers.map(m => m.coords[1])) + 2],
            ]
          : [[25, -125], [50, -66]];

        return (
          <MapContainer
            bounds={bounds as any}
            className="h-96 w-full rounded-lg border border-[hsl(var(--border))]"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((m) => (
              <CircleMarker
                key={m.zip}
                center={m.coords}
                pathOptions={{
                  radius: 4,
                  fillColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary))",
                  weight: 1,
                  opacity: 0.7,
                  fillOpacity: 0.6,
                }}
              >
                <Popup>{m.zip}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        );
      },
    };
  }),
  { ssr: false }
);

export default function ServiceAreaMap({ zips }: { zips: string[] }) {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading map…" />}>
      <MapContent zips={zips} />
    </Suspense>
  );
}
