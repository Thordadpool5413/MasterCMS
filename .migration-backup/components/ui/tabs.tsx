"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const TabsCtx = createContext<{ active: string; set: (v: string) => void } | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, set] = useState(defaultValue);
  return (
    <TabsCtx.Provider value={{ active, set }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-lg bg-[hsl(var(--muted))] p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(TabsCtx)!;
  return (
    <button
      onClick={() => ctx.set(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        ctx.active === value
          ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm"
          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.active !== value) return null;
  return <div className={className}>{children}</div>;
}
