"use client";

import { useComparison, type ComparisonItem } from "@/lib/comparison-context";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";

interface ComparisonButtonProps {
  item: ComparisonItem;
}

export function ComparisonButton({ item }: ComparisonButtonProps) {
  const { addItem, removeItem, hasItem } = useComparison();
  const isSelected = hasItem(item.id);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  };

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      className="gap-1"
      title={isSelected ? "Remove from comparison" : "Add to comparison"}
    >
      {isSelected ? (
        <Check className="h-3 w-3" />
      ) : (
        <Plus className="h-3 w-3" />
      )}
      <span className="hidden sm:inline text-xs">
        {isSelected ? "Selected" : "Compare"}
      </span>
    </Button>
  );
}
