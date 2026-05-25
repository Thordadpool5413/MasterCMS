import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Info } from "lucide-react";

type TrustLevel = "high" | "medium" | "low";

interface TrustBadgeProps {
  level: TrustLevel;
  description?: string;
}

export function TrustBadge({ level, description }: TrustBadgeProps) {
  const config = {
    high: { icon: Shield, color: "bg-green-500 text-white", label: "High Confidence" },
    medium: { icon: AlertTriangle, color: "bg-yellow-500 text-white", label: "Medium Confidence" },
    low: { icon: Info, color: "bg-red-500 text-white", label: "Low Confidence" },
  };

  const { icon: Icon, color, label } = config[level];

  return (
    <Badge className={`gap-1 ${color}`} title={description}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
