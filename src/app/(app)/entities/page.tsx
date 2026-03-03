import { EntityCard } from "@/components/entities/EntityCard";
import { prisma } from "@/lib/db/client";

export default async function EntitiesPage() {
  const entities = await getEntities();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
          <p className="text-muted-foreground">
            People, places, projects, and concepts in your notes
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <FilterButton active>All</FilterButton>
        <FilterButton>👤 People</FilterButton>
        <FilterButton>📍 Places</FilterButton>
        <FilterButton>📁 Projects</FilterButton>
        <FilterButton>💡 Concepts</FilterButton>
        <FilterButton>📅 Events</FilterButton>
      </div>

      {/* Entity grid */}
      {entities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No entities yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Entities are automatically extracted from your notes. Start writing to see them appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}

async function getEntities() {
  // TODO: Add authentication
  // For now, return empty array
  return [];
}

function FilterButton({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
        }
      `}
    >
      {children}
    </button>
  );
}