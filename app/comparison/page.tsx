"use client";

import { useComparison } from "@/lib/comparison-context";
import { ComparisonView } from "@/components/shared/comparison-view";
import { BenchmarkView } from "@/components/shared/benchmark-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ComparisonPage() {
  const { items } = useComparison();

  const benchmarkMetrics = [
    { key: "_market_share_pct", label: "Market Share %", format: (v: number) => `${v.toFixed(1)}%` },
    { key: "star_rating", label: "Star Rating", format: (v: number) => `${v.toFixed(1)}/5` },
    { key: "_payment", label: "Medicare Payment", format: (v: number) => `$${(v / 1000000).toFixed(1)}M` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" size="sm" className="mb-4 gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Comparison Analysis</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {items.length === 0
            ? "Select items from any market page to compare side-by-side."
            : `Comparing ${items.length} organizations`}
        </p>
      </div>

      <div className="space-y-6">
        {items.length >= 2 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Quick Benchmarks</h2>
            <BenchmarkView metrics={benchmarkMetrics} />
          </div>
        )}

        <div>
          <h2 className="mb-3 text-lg font-semibold">Detailed Comparison</h2>
          <ComparisonView />
        </div>
      </div>

      {items.length === 0 && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-12 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No items selected. Visit any market intelligence page and click "Compare" on rows to get started.
          </p>
        </div>
      )}
    </div>
  );
}
