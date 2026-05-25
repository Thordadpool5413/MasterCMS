import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EnhancedPageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EnhancedPageHeader({
  title,
  description,
  subtitle,
  icon,
  actions,
  className,
}: EnhancedPageHeaderProps) {
  return (
    <div className={cn(
      "relative mb-8 rounded-xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--muted))/0.5] p-6 sm:p-8",
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="mt-1 text-[hsl(var(--primary))]">
                {icon}
              </div>
            )}
            <div className="flex-1">
              {subtitle && (
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                  {subtitle}
                </p>
              )}
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))]">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] max-w-2xl leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
