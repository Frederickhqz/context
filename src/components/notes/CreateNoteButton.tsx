"use client";

import { cn } from "@/lib/utils/cn";
import { useState } from "react";

interface CreateNoteButtonProps {
  className?: string;
}

export function CreateNoteButton({ className }: CreateNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
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
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Note</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Title (optional)"
                  className="w-full rounded-lg border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <textarea
                  placeholder="What's on your mind?"
                  rows={8}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    # Tags
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    @ Entities
                  </button>
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}