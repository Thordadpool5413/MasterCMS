"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

function approximateZipLocation(zip: string): [number, number] {
  const z = parseInt(zip, 10);
  if (isNaN(z)) return [39.8283, -98.5795];

  const firstDigit = Math.floor(z / 10000);
  const secondDigit = Math.floor((z % 10000) / 1000);

  const latByFirst = [46, 40, 37, 35, 35, 35, 35, 37, 40, 21];
  const lngByFirst = [-93, -95, -94, -92, -87, -82, -78, -75, -71, -156];

  let lat = latByFirst[firstDigit] || 39;
  let lng = lngByFirst[firstDigit] || -98;

  const latVariance = Math.sin(secondDigit) * 3;
  const lngVariance = Math.cos(secondDigit) * 4;

  return [lat + latVariance, lng + lngVariance];
}

const MapContent = dynamic(
  () => import("react-leaflet").then(m => {
    const MapContainer = m.MapContainer;
    const TileLayer = m.TileLayer;
    const CircleMarker = m.CircleMarker;
    const Popup = m.Popup;

    return {
      default: ({ zips }: { zips: string[] }) => {
        const markers = zips.slice(0, 500).map((z) => ({
          zip: z,
          coords: approximateZipLocation(z),
        }));

        const bounds = markers.length > 0
          ? [
              [Math.min(...markers.map(m => m.coords[0])) - 2, Math.min(...markers.map(m => m.coords[1])) - 2],
              [Math.max(...markers.map(m => m.coords[0])) + 2, Math.max(...markers.map(m => m.coords[1])) + 2],
            ]
          : [[25, -125], [50, -66]];

        return (
          <MapContainer
            bounds={bounds}
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
