import { cn } from '@/lib/utils/cn';

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    noteCount: number;
  };
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border p-4 transition-all',
        'hover:border-primary/30 hover:shadow-sm',
        'cursor-pointer'
      )}
      style={{ borderLeftColor: collection.color, borderLeftWidth: '4px' }}
    >
      <div className="flex items-start gap-3">
        {collection.icon && (
          <span className="text-2xl">{collection.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground line-clamp-1">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {collection.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{collection.noteCount} note{collection.noteCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}