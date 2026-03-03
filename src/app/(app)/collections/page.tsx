import { cn } from "@/lib/utils/cn";
import { prisma } from "@/lib/db/client";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdAt: Date;
  notes?: { noteId: string }[];
}

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">
            Organize your notes into thematic groups
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
            Create collections to organize your notes by topic, project, or theme.
          </p>
          <CreateCollectionButton className="mt-4" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}

async function getCollections(): Promise<Collection[]> {
  // TODO: Add authentication
  // For now, return empty array
  return [];
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdAt: Date;
  notes?: { noteId: string }[];
}

function CollectionCard({ collection }: { collection: Collection }) {
  const noteCount = collection.notes?.length || 0;
  
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-all",
        "hover:shadow-sm cursor-pointer"
      )}
      style={{ borderColor: `${collection.color}40` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${collection.color}20`, color: collection.color }}
        >
          {collection.icon || "📁"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{collection.name}</h3>
          {collection.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {collection.description}
            </p>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCollectionButton({ className }: { className?: string }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "transition-colors",
        className
      )}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New Collection
    </button>
  );
}