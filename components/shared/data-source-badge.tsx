import { Badge } from "@/components/ui/badge";
import { Database, Calendar, CheckCircle2 } from "lucide-react";

interface DataSourceBadgeProps {
  source: string;
  lastUpdated?: string;
  verified?: boolean;
}

export function DataSourceBadge({ source, lastUpdated, verified }: DataSourceBadgeProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <Badge variant="outline" className="gap-1">
        <Database className="h-3 w-3" />
        {source}
      </Badge>
      {lastUpdated && (
        <Badge variant="secondary" className="gap-1">
          <Calendar className="h-3 w-3" />
          {lastUpdated}
        </Badge>
      )}
      {verified && (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      )}
    </div>
  );
}
