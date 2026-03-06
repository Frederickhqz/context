import { Timeline } from '@/components/timeline/Timeline';
import { prisma } from '@/lib/db/client';
import { format, subDays } from 'date-fns';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  let grouped: any[] = [];

  try {
    // Get last 30 days by default
    const end = new Date();
    const start = subDays(end, 30);

    // TODO: Add authentication
    const notes = await prisma.note.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const beats = await prisma.beat.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: { noteBeats: { include: { note: true } } },
    });

    // Group by date
    grouped = groupByDate(notes, beats);
  } catch (error) {
    console.error('Failed to fetch timeline data:', error);
    // Return empty state on error
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">
          Your notes and beats over time
        </p>
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No timeline data</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create notes and beats to see them on your timeline.
          </p>
        </div>
      ) : (
        <Timeline groups={grouped} />
      )}
    </div>
  );
}

function groupByDate(notes: any[], beats: any[]) {
  const groups: Record<string, any> = {};

  for (const note of notes) {
    const key = note.createdAt.toISOString().split('T')[0];
    if (!groups[key]) {
      groups[key] = {
        date: key,
        notes: [],
        beats: [],
      };
    }
    groups[key].notes.push(note);
  }

  for (const beat of beats) {
    const key = beat.createdAt.toISOString().split('T')[0];
    if (!groups[key]) {
      groups[key] = {
        date: key,
        notes: [],
        beats: [],
      };
    }
    groups[key].beats.push(beat);
  }

  return Object.values(groups).sort((a: any, b: any) =>
    b.date.localeCompare(a.date)
  );
}