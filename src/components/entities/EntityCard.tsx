import { cn } from "@/lib/utils/cn";
import { formatDistanceToNow } from "date-fns";

interface Entity {
  id: string;
  name: string;
  entityType: string;
  aliases: string[];
  createdAt: Date;
}

interface EntityCardProps {
  entity: Entity;
  onClick?: () => void;
}

const entityColors: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  place: "bg-green-500/10 text-green-600 border-green-500/20",
  project: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  concept: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  event: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const entityIcons: Record<string, string> = {
  person: "👤",
  place: "📍",
  project: "📁",
  concept: "💡",
  event: "📅",
};

export function EntityCard({ entity, onClick }: EntityCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{entityIcons[entity.entityType] || "📌"}</span>
          <div>
            <h3 className="font-medium text-foreground">{entity.name}</h3>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              entityColors[entity.entityType] || entityColors.concept
            )}>
              {entity.entityType}
            </span>
          </div>
        </div>
      </div>
      
      {entity.aliases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entity.aliases.slice(0, 3).map((alias, i) => (
            <span
              key={i}
              className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded"
            >
              {alias}
            </span>
          ))}
          {entity.aliases.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{entity.aliases.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        Added {formatDistanceToNow(entity.createdAt, { addSuffix: true })}
      </div>
    </div>
  );
}