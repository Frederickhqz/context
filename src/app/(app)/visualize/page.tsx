import { CalendarView } from '@/components/calendar/CalendarView';
import { GraphView } from '@/components/graph/GraphView';
import { TreeView, buildTreeFromConnections } from '@/components/tree/TreeView';
import { prisma } from '@/lib/db/client';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default async function VisualizePage() {
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
  const calendarEvents = [
    ...notes.map(n => ({
      id: n.id,
      date: n.createdAt,
      type: 'note' as const,
      title: n.title || undefined,
    })),
    ...beats.map(b => ({
      id: b.id,
      date: b.startedAt || b.createdAt,
      type: 'beat' as const,
      title: b.beatType,
    })),
  ];

  // Prepare graph nodes
  const noteIds = new Set<string>();
  connections.forEach(c => {
    noteIds.add(c.fromNoteId);
    noteIds.add(c.toNoteId);
  });

  const graphNodes = Array.from(noteIds).map(id => {
    const note = connections.find(c => c.fromNoteId === id)?.fromNote ||
                 connections.find(c => c.toNoteId === id)?.toNote;
    return {
      id,
      label: note?.title || `Note ${id.slice(0, 4)}`,
      type: 'note' as const,
    };
  });

  const graphLinks = connections.map(c => ({
    source: c.fromNoteId,
    target: c.toNoteId,
    type: c.connectionType as 'reference' | 'semantic' | 'temporal',
    strength: c.strength,
  }));

  // Build tree from first connection if available
  const treeData = connections.length > 0
    ? buildTreeFromConnections(connections[0].fromNoteId, connections)
    : null;

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
          <TabsTrigger value="calendar">📅 Calendar</TabsTrigger>
          <TabsTrigger value="graph">🔗 Graph</TabsTrigger>
          <TabsTrigger value="tree">🌲 Tree</TabsTrigger>
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
                  <div className="text-4xl mb-2">🔗</div>
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
                  <div className="text-4xl mb-2">🌲</div>
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