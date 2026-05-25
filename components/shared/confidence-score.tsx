import { Badge } from "@/components/ui/badge";

interface ConfidenceScoreProps {
  score: number;
  max?: number;
  label?: string;
}

export function ConfidenceScore({ score, max = 100, label }: ConfidenceScoreProps) {
  const percentage = Math.min((score / max) * 100, 100);
  const color = percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500";
  const textColor = percentage >= 80 ? "text-green-600" : percentage >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 max-w-xs">
        <div className="h-2 rounded-full bg-[hsl(var(--border))] overflow-hidden">
          <div className={`h-full transition-all ${color}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <Badge variant="secondary" className={`${textColor} font-semibold`}>
        {label ? `${label}: ` : ""}{percentage.toFixed(0)}%
      </Badge>
    </div>
  );
}
