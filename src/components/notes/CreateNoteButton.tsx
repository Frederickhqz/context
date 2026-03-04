import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
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
      <Icon name="plus" size="sm" />
      New Note
    </Link>
  );
}