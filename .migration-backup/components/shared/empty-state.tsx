import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] py-16 text-center",
        className,
      )}
    >
      <Icon className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3 opacity-50" />
      {title && (
        <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">{title}</p>
      )}
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">{description}</p>
    </div>
  );
}
