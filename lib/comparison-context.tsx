import { createContext, useContext, useState, ReactNode } from "react";

export interface ComparisonItem {
  id: string;
  name: string;
  type: "hospice" | "nursing_home" | "hospital" | "competitor";
  data: Record<string, unknown>;
}

interface ComparisonContextType {
  items: ComparisonItem[];
  addItem: (item: ComparisonItem) => void;
  removeItem: (id: string) => void;
  clearComparison: () => void;
  hasItem: (id: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparisonItem[]>([]);

  const addItem = (item: ComparisonItem) => {
    if (!items.some(i => i.id === item.id)) {
      setItems([...items, item]);
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const clearComparison = () => {
    setItems([]);
  };

  const hasItem = (id: string) => {
    return items.some(i => i.id === id);
  };

  return (
    <ComparisonContext.Provider value={{ items, addItem, removeItem, clearComparison, hasItem }}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison must be used within ComparisonProvider");
  }
  return context;
}
