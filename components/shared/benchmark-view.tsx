"use client";

import { useComparison } from "@/lib/comparison-context";
import { Badge } from "@/components/ui/badge";

interface BenchmarkMetric {
  key: string;
  label: string;
  format?: (v: number) => string;
}

export function BenchmarkView({ metrics }: { metrics: BenchmarkMetric[] }) {
  const { items } = useComparison();

  if (items.length < 2) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4 text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Select at least 2 items to view benchmarks
        </p>
      </div>
    );
  }

  const calculateStats = (key: string) => {
    const values = items
      .map(item => {
        const val = item.data[key];
        return typeof val === "number" ? val : null;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    return { values, avg, min, max, range };
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">BENCHMARK ANALYSIS</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const stats = calculateStats(metric.key);
          if (!stats) return null;

          const itemWithMin = items.find(item => item.data[metric.key] === stats.min);
          const itemWithMax = items.find(item => item.data[metric.key] === stats.max);

          return (
            <div key={metric.key} className="rounded-md border border-[hsl(var(--border))] p-3">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold">
                avg: {metric.format ? metric.format(stats.avg) : stats.avg.toFixed(0)}
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Highest:</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="success" className="text-xs">
                      {metric.format ? metric.format(stats.max) : stats.max.toFixed(0)}
                    </Badge>
                    <span className="text-[hsl(var(--muted-foreground))]">{itemWithMax?.name}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Lowest:</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {metric.format ? metric.format(stats.min) : stats.min.toFixed(0)}
                    </Badge>
                    <span className="text-[hsl(var(--muted-foreground))]">{itemWithMin?.name}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
