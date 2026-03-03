import { CollectionCard } from '@/components/collections/CollectionCard';
import { CreateCollectionButton } from '@/components/collections/CreateCollectionButton';
import { prisma } from '@/lib/db/client';

export default async function CollectionsPage() {
  // TODO: Add authentication
  const collections = await prisma.collection.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { notes: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">
            Group your notes into collections
          </p>
        </div>
        <CreateCollectionButton />
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No collections yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Collections help you organize related notes together. Create your first collection to get started.
          </p>
          <CreateCollectionButton className="mt-4" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard 
              key={collection.id} 
              collection={{
                ...collection,
                noteCount: collection._count.notes,
              }} 
            />
          ))}
        </div>
      )}
    </div>
  );
}