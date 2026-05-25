"use client";

import { useComparison } from "@/lib/comparison-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Download } from "lucide-react";

export function ComparisonPanel() {
  const { items, removeItem, clearComparison } = useComparison();

  if (items.length === 0) return null;

  const exportComparison = () => {
    const csv = [
      ["Name", "Type", ...Object.keys(items[0]?.data || {})].join(","),
      ...items.map(item =>
        [item.name, item.type, ...Object.values(item.data || {}).map(v => JSON.stringify(v))].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-lg z-40">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Comparison ({items.length} selected)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearComparison}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportComparison}
            className="gap-1"
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="gap-1 py-1"
            >
              <span className="text-xs">{item.name}</span>
              <button
                onClick={() => removeItem(item.id)}
                className="ml-1 hover:opacity-70"
                aria-label="Remove from comparison"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
