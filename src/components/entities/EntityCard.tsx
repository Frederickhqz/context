import { cn } from '@/lib/utils/cn';

interface EntityCardProps {
  entity: {
    id: string;
    name: string;
    entityType: string;
    aliases: string[];
    mentionCount: number;
    metadata?: Record<string, unknown> | null;
  };
}

export function EntityCard({ entity }: EntityCardProps) {
  const typeColors: Record<string, string> = {
    person: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    place: 'bg-green-500/10 text-green-600 border-green-500/20',
    project: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    concept: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    event: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  const typeIcons: Record<string, string> = {
    person: '👤',
    place: '📍',
    project: '📁',
    concept: '💡',
    event: '📅',
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-4 transition-all',
        'hover:border-primary/30 hover:shadow-sm',
        'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" title={entity.entityType}>
            {typeIcons[entity.entityType] || '📌'}
          </span>
          <div>
            <h3 className="font-medium text-foreground line-clamp-1">
              {entity.name}
            </h3>
            {entity.aliases.length > 0 && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                aka: {entity.aliases.slice(0, 3).join(', ')}
                {entity.aliases.length > 3 && ` +${entity.aliases.length - 3}`}
              </p>
            )}
          </div>
        </div>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium border',
          typeColors[entity.entityType]
        )}>
          {entity.entityType}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{entity.mentionCount} mention{entity.mentionCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}