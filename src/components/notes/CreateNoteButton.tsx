import { cn } from "@/lib/utils/cn";
import Link from "next/link";

interface CreateNoteButtonProps {
  className?: string;
}

export function CreateNoteButton({ className }: CreateNoteButtonProps) {
  return (
    <Link
      href="/notes/new"
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
      New Note
    </Link>
  );
}