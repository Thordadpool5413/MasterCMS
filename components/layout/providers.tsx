"use client";

import { ComparisonProvider } from "@/lib/comparison-context";
import { ComparisonPanel } from "@/components/shared/comparison-panel";
import { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ComparisonProvider>
      {children}
      <ComparisonPanel />
    </ComparisonProvider>
  );
}
