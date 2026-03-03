import { EntityCard } from '@/components/entities/EntityCard';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default async function EntitiesPage() {
  // TODO: Add authentication
  const entities = await prisma.entity.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { mentions: true },
      },
    },
  });

  // Group by type
  const grouped = groupByType(entities);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
          <p className="text-muted-foreground">
            People, places, projects, concepts, and events
          </p>
        </div>
      </div>

      {/* Entity groups */}
      {Object.entries(grouped).map(([type, typeEntities]) => (
        <div key={type} className="space-y-3">
          <h2 className="text-lg font-medium capitalize">{type}s</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {typeEntities.map((entity) => (
              <EntityCard 
                key={entity.id} 
                entity={{
                  ...entity,
                  mentionCount: entity._count.mentions,
                }} 
              />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {entities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No entities yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Entities are automatically extracted from your notes. Start creating notes to see entities appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function groupByType(entities: any[]) {
  const grouped: Record<string, any[]> = {
    person: [],
    place: [],
    project: [],
    concept: [],
    event: [],
  };

  for (const entity of entities) {
    if (grouped[entity.entityType]) {
      grouped[entity.entityType].push(entity);
    }
  }

  return grouped;
}