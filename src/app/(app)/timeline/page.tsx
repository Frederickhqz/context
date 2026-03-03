import { Timeline } from "@/components/timeline/Timeline";
import { SearchBar } from "@/components/search/SearchBar";
import { prisma } from "@/lib/db/client";

export default async function TimelinePage() {
  // Fetch timeline items
  // TODO: Add authentication
  const notes = await getTimelineItems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-muted-foreground">
            Visualize your notes and beats over time
          </p>
        </div>
      </div>

      {/* Search */}
      <SearchBar placeholder="Search timeline..." />

      {/* View toggles */}
      <div className="flex gap-2">
        <ViewToggle active>Vertical</ViewToggle>
        <ViewToggle>Horizontal</ViewToggle>
        <ViewToggle>Calendar</ViewToggle>
        <ViewToggle>Tree</ViewToggle>
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <Timeline items={notes} mode="VERTICAL" />
      </div>
    </div>
  );
}

async function getTimelineItems() {
  // TODO: Add authentication
  // For now, return empty array
  return [];
}

function ViewToggle({ children, active }: { children: React.ReactNode; active?: boolean }) {
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