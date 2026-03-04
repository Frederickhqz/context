"use client";

import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { createDemoNote, isDemoMode } from "@/lib/demo/client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isDemoMode()) {
        // Demo mode - save to localStorage
        createDemoNote({
          title: title || undefined,
          content,
          noteType: "note",
        });
        router.push("/notes");
        router.refresh();
      } else {
        // Production mode - save to API
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || null,
            content,
            noteType: "note",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save note");
        }

        router.push("/notes");
      }
    } catch (err) {
      console.error("Failed to save note:", err);
      setError("Failed to save note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/notes"
              className="rounded-lg p-2 hover:bg-muted transition-colors"
            >
              <Icon name="arrowLeft" size="md" />
            </Link>
            <h1 className="text-lg font-medium">New Note</h1>
          </div>

          <button
            type="submit"
            form="note-form"
            disabled={isSaving || !content.trim()}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      {/* Editor */}
      <form id="note-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-4 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full text-xl font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            autoFocus
            className="flex-1 w-full min-h-[60vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50 text-base leading-relaxed"
          />

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              # Tags
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              @ Entities
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
            >
              <Icon name="calendar" size="sm" />
              Date
            </button>
            
            {/* Demo mode indicator */}
            {isDemoMode() && (
              <span className="ml-auto text-xs text-muted-foreground">
                Demo mode - notes saved locally
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}