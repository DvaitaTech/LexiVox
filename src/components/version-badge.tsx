import { Badge } from "@/components/ui/badge";

const VERSION = "1.1.0";

export function VersionBadge() {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      v{VERSION}
    </Badge>
  );
}