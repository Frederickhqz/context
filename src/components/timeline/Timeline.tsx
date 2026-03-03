'use client';

import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils/cn';

interface TimelineProps {
  groups: Array<{
    date: string;
    notes: Array<{
      id: string;
      title: string | null;
      content: string;
      noteType: string;
      createdAt: Date;
    }>;
    beats: Array<{
      id: string;
      beatType: string;
      intensity: number;
    }>;
  }>;
}

export function Timeline({ groups }: TimelineProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="relative space-y-8">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      {/* Timeline groups */}
      {groups.map((group) => (
        <TimelineGroup key={group.date} group={group} />
      ))}
    </div>
  );
}

function TimelineGroup({ group }: { group: TimelineProps['groups'][0] }) {
  const date = parseISO(group.date);
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isYesterday = format(date, 'yyyy-MM-dd') === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

  const dateLabel = isToday 
    ? 'Today' 
    : isYesterday 
    ? 'Yesterday' 
    : format(date, 'EEEE, MMMM d, yyyy');

  return (
    <div className="relative pl-10">
      {/* Date marker */}
      <div className={cn(
        'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center',
        'bg-card border-2',
        isToday ? 'border-primary' : 'border-border'
      )}>
        <span className="text-xs font-medium">
          {format(date, 'd')}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm text-muted-foreground">
          {dateLabel}
        </h3>

        {/* Notes */}
        {group.notes.length > 0 && (
          <div className="space-y-2">
            {group.notes.map((note) => (
              <TimelineNote key={note.id} note={note} />
            ))}
          </div>
        )}

        {/* Beats */}
        {group.beats.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {group.beats.map((beat) => (
              <TimelineBeat key={beat.id} beat={beat} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {group.notes.length === 0 && group.beats.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No notes
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineNote({ note }: { note: TimelineProps['groups'][0]['notes'][0] }) {
  const typeColors: Record<string, string> = {
    note: 'border-l-primary bg-primary/5',
    journal: 'border-l-pink-500 bg-pink-500/5',
    beat: 'border-l-amber-500 bg-amber-500/5',
  };

  return (
    <a
      href={`/notes/${note.id}`}
      className={cn(
        'block rounded-lg border-l-4 p-3 transition-colors',
        'hover:bg-accent',
        typeColors[note.noteType] || typeColors.note
      )}
    >
      {note.title && (
        <h4 className="font-medium text-sm line-clamp-1">
          {note.title}
        </h4>
      )}
      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
        {note.content.slice(0, 150)}
      </p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span>{format(note.createdAt, 'h:mm a')}</span>
        {note.noteType !== 'note' && (
          <span className="rounded bg-background px-1.5 py-0.5 border">
            {note.noteType}
          </span>
        )}
      </div>
    </a>
  );
}

function TimelineBeat({ beat }: { beat: TimelineProps['groups'][0]['beats'][0] }) {
  const typeColors: Record<string, string> = {
    event: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    milestone: 'bg-green-500/10 text-green-600 border-green-500/20',
    feeling: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    insight: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  const intensityDots = Array(beat.intensity).fill(0);

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
      typeColors[beat.beatType] || typeColors.event
    )}>
      <span>{beat.beatType}</span>
      <div className="flex gap-0.5">
        {intensityDots.map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-current opacity-50" />
        ))}
      </div>
    </div>
  );
}