import { CalendarView } from '@/components/calendar/CalendarView';
import { GraphView } from '@/components/graph/GraphView';
import { TreeView, buildTreeFromConnections } from '@/components/tree/TreeView';
import { prisma } from '@/lib/db/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

// Local type definitions (avoid Prisma client dependency during build)
interface NoteSelect {
  id: string;
  title: string | null;
  createdAt: Date;
}

interface BeatSelect {
  id: string;
  beatType: string;
  createdAt: Date;
  startedAt: Date | null;
}

interface ConnectionWithNotes {
  fromNoteId: string;
  toNoteId: string;
  connectionType: string;
  strength: number;
  fromNote: { id: string; title: string | null };
  toNote: { id: string; title: string | null };
}

interface CalendarEvent {
  id: string;
  date: Date;
  type: 'note' | 'beat';
  title?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'note';
}

interface GraphLink {
  source: string;
  target: string;
  type: 'reference' | 'semantic' | 'temporal';
  strength: number;
}

export default async function VisualizePage() {
  let calendarEvents: CalendarEvent[] = [];
  let graphNodes: GraphNode[] = [];
  let graphLinks: GraphLink[] = [];
  let treeData: any = null;

  try {
    // TODO: Add authentication

    // Fetch notes for calendar
    const notes = await prisma.note.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    // Fetch beats for calendar
    const beats = await prisma.beat.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        beatType: true,
        createdAt: true,
        startedAt: true,
      },
    });

    // Fetch connections for graph/tree
    const connections = await prisma.connection.findMany({
      take: 100,
      include: {
        fromNote: { select: { id: true, title: true } },
        toNote: { select: { id: true, title: true } },
      },
    });

    // Prepare calendar events
    calendarEvents = [
      ...notes.map((n: NoteSelect) => ({
        id: n.id,
        date: n.createdAt,
        type: 'note' as const,
        title: n.title || undefined,
      })),
      ...beats.map((b: BeatSelect) => ({
        id: b.id,
        date: b.startedAt || b.createdAt,
        type: 'beat' as const,
        title: b.beatType,
      })),
    ];

    // Prepare graph nodes
    const noteIds = new Set<string>();
    connections.forEach((c: ConnectionWithNotes) => {
      noteIds.add(c.fromNoteId);
      noteIds.add(c.toNoteId);
    });

    graphNodes = Array.from(noteIds).map((id: string) => {
      const note = connections.find((c: ConnectionWithNotes) => c.fromNoteId === id)?.fromNote ||
        connections.find((c: ConnectionWithNotes) => c.toNoteId === id)?.toNote;
      return {
        id,
        label: note?.title || `Note ${id.slice(0, 4)}`,
        type: 'note' as const,
      };
    });

    graphLinks = connections.map((c: ConnectionWithNotes) => ({
      source: c.fromNoteId,
      target: c.toNoteId,
      type: c.connectionType as 'reference' | 'semantic' | 'temporal',
      strength: c.strength,
    }));

    // Build tree from first connection if available
    treeData = connections.length > 0
      ? buildTreeFromConnections(connections[0].fromNoteId, connections as ConnectionWithNotes[])
      : null;
  } catch (error) {
    console.error('Failed to fetch visualize data:', error);
    // Return empty state on error
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visualize</h1>
        <p className="text-muted-foreground">
          Explore your notes through different views
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">
            <Icon name="calendar" size="sm" className="mr-1.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Icon name="graph" size="sm" className="mr-1.5" />
            Graph
          </TabsTrigger>
          <TabsTrigger value="tree">
            <Icon name="tree" size="sm" className="mr-1.5" />
            Tree
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <div className="rounded-lg border bg-card p-4">
            <CalendarView events={calendarEvents} />
          </div>
        </TabsContent>

        <TabsContent value="graph" className="mt-6">
          <div className="rounded-lg border bg-card h-[600px]">
            {graphNodes.length > 0 ? (
              <GraphView nodes={graphNodes} links={graphLinks} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <Icon name="graph" size="lg" className="text-muted-foreground" />
                  </div>
                  <p>No connections to display</p>
                  <p className="text-sm">Create notes and connect them to see the graph</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tree" className="mt-6">
          <div className="rounded-lg border bg-card h-[600px] overflow-auto">
            {treeData ? (
              <TreeView data={treeData} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <Icon name="tree" size="lg" className="text-muted-foreground" />
                  </div>
                  <p>No connections to display</p>
                  <p className="text-sm">Create hierarchical connections to see the tree view</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}