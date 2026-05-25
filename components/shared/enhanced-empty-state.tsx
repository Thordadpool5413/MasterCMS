import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EnhancedEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EnhancedEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EnhancedEmptyStateProps) {
  return (
    <div className={cn(
      "rounded-xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--muted))/0.3] to-[hsl(var(--muted))/0.1] p-12",
      className
    )}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-lg bg-[hsl(var(--primary))/0.1] p-4 text-[hsl(var(--primary))]">
          <div className="h-12 w-12">
            {icon}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
            {description}
          </p>
        </div>
        {action && (
          <Button
            onClick={action.onClick}
            variant="default"
            size="sm"
            className="mt-2"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
