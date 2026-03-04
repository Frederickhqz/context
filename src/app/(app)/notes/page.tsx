"use client";

import { NoteCard } from "@/components/notes/NoteCard";
import { CreateNoteButton } from "@/components/notes/CreateNoteButton";
import { useEffect, useState } from "react";
import { getDemoNotes, isDemoMode, type DemoNote } from "@/lib/demo/client";

export default function NotesPage() {
  const [notes, setNotes] = useState<DemoNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      try {
        if (isDemoMode()) {
          // Demo mode - load from localStorage
          const demoNotes = getDemoNotes();
          setNotes(demoNotes);
        } else {
          // Production mode - load from API
          const response = await fetch("/api/notes");
          const data = await response.json();
          setNotes(data.notes || []);
        }
      } catch (error) {
        console.error("Failed to load notes:", error);
      } finally {
        setLoading(false);
      }
    }

    loadNotes();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">
            Your thoughts, ideas, and memories
            {isDemoMode() && <span className="text-amber-600 ml-2">(Demo mode)</span>}
          </p>
        </div>
        <CreateNoteButton />
      </div>

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No notes yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Start capturing your thoughts, ideas, and memories. Your notes will appear here.
          </p>
          <CreateNoteButton className="mt-4" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}