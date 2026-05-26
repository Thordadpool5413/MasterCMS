import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";

interface DataFreshnessIndicatorProps {
  lastUpdated: Date | string;
  staleDays?: number;
}

export function DataFreshnessIndicator({ lastUpdated, staleDays = 30 }: DataFreshnessIndicatorProps) {
  const updated = typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;
  const now = new Date();
  const daysOld = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = daysOld > staleDays;

  return (
    <Badge variant={isStale ? "destructive" : "secondary"} className="gap-1">
      {isStale ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {daysOld === 0 ? "Today" : `${daysOld}d ago`}
    </Badge>
  );
}
