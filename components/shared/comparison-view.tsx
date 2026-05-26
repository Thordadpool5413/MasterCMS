"use client";

import { useComparison } from "@/lib/comparison-context";
import { Badge } from "@/components/ui/badge";

export function ComparisonView() {
  const { items } = useComparison();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-8 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No items selected for comparison. Click the &quot;Compare&quot; button on any row to get started.
        </p>
      </div>
    );
  }

  if (items.length === 1) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-8 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Select at least 2 items to enable comparison view.
        </p>
      </div>
    );
  }

  // Get all metric keys from all items
  const allMetricKeys = new Set<string>();
  items.forEach(item => {
    Object.keys(item.data).forEach(key => allMetricKeys.add(key));
  });
  const metricKeys = Array.from(allMetricKeys).sort();

  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full text-sm">
        <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Metric</th>
            {items.map((item) => (
              <th key={item.id} className="px-4 py-3 text-left font-semibold min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span>{item.name}</span>
                  <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricKeys.map((key) => (
            <tr key={key} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/40">
              <td className="px-4 py-3 font-medium text-[hsl(var(--muted-foreground))] sticky left-0 bg-[hsl(var(--background))]">
                {String(key).replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())}
              </td>
              {items.map((item) => (
                <td key={`${item.id}-${key}`} className="px-4 py-3">
                  {formatValue(item.data[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (value > 1000000) return (value / 1000000).toFixed(1) + "M";
    if (value > 1000) return (value / 1000).toFixed(1) + "K";
    if (value < 1 && value > 0) return value.toFixed(2);
    return value.toLocaleString();
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
