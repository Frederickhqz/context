import { cn } from "@/lib/utils/cn";
import { formatDistanceToNow } from "date-fns";

interface NoteCardProps {
  note: {
    id: string;
    title: string | null;
    content: string;
    contentPlain?: string | null;
    noteType?: string;
    createdAt: Date;
  };
  compact?: boolean;
}

export function NoteCard({ note, compact }: NoteCardProps) {
  const typeColors: Record<string, string> = {
    note: "bg-primary/10 text-primary border-primary/20",
    journal: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    beat: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        "cursor-pointer",
        compact && "p-3"
      )}
    >
      {note.title && (
        <h3 className="mb-2 font-medium text-foreground line-clamp-1">
          {note.title}
        </h3>
      )}
      <p className={cn(
        "text-sm text-muted-foreground",
        compact ? "line-clamp-2" : "line-clamp-3"
      )}>
        {note.contentPlain || note.content}
      </p>
      
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDistanceToNow(note.createdAt, { addSuffix: true })}</span>
        {note.noteType && note.noteType !== "note" && (
          <span className={cn(
            "rounded px-2 py-0.5 border",
            typeColors[note.noteType] || typeColors.note
          )}>
            {note.noteType}
          </span>
        )}
      </div>
    </div>
  );
}