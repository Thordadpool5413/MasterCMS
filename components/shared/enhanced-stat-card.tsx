import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EnhancedStatCardProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon?: ReactNode;
  trend?: {
    direction: "up" | "down";
    value: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function EnhancedStatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  variant = "default",
  className,
}: EnhancedStatCardProps) {
  const variantStyles = {
    default: "border-[hsl(var(--border))] bg-[hsl(var(--card))]",
    primary: "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.05]",
    success: "border-green-200 bg-green-50 dark:bg-green-950/20",
    warning: "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20",
    danger: "border-red-200 bg-red-50 dark:bg-red-950/20",
  };

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-all hover:shadow-md",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {subtext}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-[hsl(var(--muted-foreground))] opacity-40">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.direction === "up" ? "text-green-600" : "text-red-600"}>
            {trend.direction === "up" ? "↑" : "↓"}
          </span>
          <span className={trend.direction === "up" ? "text-green-600" : "text-red-600"}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
