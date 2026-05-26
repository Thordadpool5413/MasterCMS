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

    function MapInner({ zips }: { zips: string[] }) {
        const [markers, setMarkers] = useState<Array<{ zip: string; coords: [number, number] }>>([]);
        const [isInitialLoading, setIsInitialLoading] = useState(true);

        useEffect(() => {
          let cancelled = false;
          const zipList = zips.slice(0, 500);
          if (zipList.length === 0) {
            setIsInitialLoading(false);
            return;
          }

          (async () => {
            try {
              const batchSize = 20;
              let accumulated: Array<{ zip: string; coords: [number, number] }> = [];

              for (let i = 0; i < zipList.length; i += batchSize) {
                if (cancelled) return;

                const batch = zipList.slice(i, i + batchSize);
                const results = await getZipCodeLocations(batch);
                accumulated = [...accumulated, ...results];

                if (i === 0) setIsInitialLoading(false);
                setMarkers([...accumulated]);
              }
            } catch {
              if (!cancelled) {
                setMarkers([]);
                setIsInitialLoading(false);
              }
            }
          })();

          return () => { cancelled = true; };
        }, [zips]);

        const bounds = markers.length > 0
          ? [
              [Math.min(...markers.map(m => m.coords[0])) - 2, Math.min(...markers.map(m => m.coords[1])) - 2],
              [Math.max(...markers.map(m => m.coords[0])) + 2, Math.max(...markers.map(m => m.coords[1])) + 2],
            ]
          : [[25, -125], [50, -66]];

        return (
          <div className="relative h-96 w-full rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <MapContainer
              bounds={bounds as [number, number][]}
              className="h-full w-full"
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
            {isInitialLoading && (
              <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Loading locations...</div>
              </div>
            )}
          </div>
        );
    }
    return { default: MapInner };
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
