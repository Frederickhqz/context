"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { createDemoNote, isDemoMode } from "@/lib/demo/client";

type ImportMode = 'paste' | 'upload' | 'edit';

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('edit');
  const [uploadStats, setUploadStats] = useState<{
    wordCount: number;
    charCount: number;
    estimatedChunks: number;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadStats(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'demo-user'); // Will be replaced by actual user
      if (title) formData.append('title', title);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      
      // Redirect to the created note
      if (data.note?.id) {
        router.push(`/notes/${data.note.id}`);
      } else {
        // Fallback: just set content and show stats
        setUploadStats(data.stats);
        setContent(`[Uploaded: ${file.name}]\n\nContent would be displayed here...`);
        setImportMode('edit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [title, router]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle form submit (paste/edit mode)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isDemoMode()) {
        createDemoNote({
          title: title || undefined,
          content,
          noteType: "note",
        });
        router.push("/notes");
        router.refresh();
        return;
      }

      // Check if content is long enough for chunked processing
      const charCount = content.length;
      const estimatedChunks = Math.ceil(charCount / 8000);

      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          content,
          noteType: estimatedChunks > 1 ? 'import' : 'note',
          metadata: {
            charCount,
            wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
            estimatedChunks,
          }
        }),
      });

      if (!response.ok) throw new Error("Failed to save note");

      const result = await response.json();
      const noteId = result?.note?.id;

      if (noteId) {
        // Auto-extract beats (handles chunking internally)
        await fetch(`/api/notes/${noteId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });

        // Auto-detect connections
        await fetch(`/api/beats/detect-connections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId, maxPairs: 30, minStrength: 0.65 })
        });

        router.push(`/notes/${noteId}`);
      } else {
        router.push("/notes");
      }
    } catch (err) {
      console.error("Failed to save note:", err);
      setError("Failed to save note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate stats
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = content.length;
  const estimatedChunks = Math.ceil(charCount / 8000);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg p-2 hover:bg-muted transition-colors"
            >
              <Icon name="arrowLeft" size="md" />
            </button>
            <h1 className="text-lg font-medium">New Note</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            {charCount > 0 && (
              <div className="text-xs text-muted-foreground mr-2">
                {wordCount.toLocaleString()} words
                {estimatedChunks > 1 && (
                  <span className="ml-1 text-amber-500">
                    ({estimatedChunks} chunks)
                  </span>
                )}
              </div>
            )}
            
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
              {isSaving ? "Saving..." : "Save & Analyze"}
            </button>
          </div>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="border-b bg-muted/30">
        <div className="flex gap-1 px-4 py-1">
          <button
            type="button"
            onClick={() => setImportMode('edit')}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-colors",
              importMode === 'edit' 
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setImportMode('paste')}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-colors",
              importMode === 'paste' 
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Paste
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2",
              importMode === 'upload' 
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Icon name="upload" size="sm" />
                Upload File
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.doc,.docx,.pdf,.rtf,.html"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Upload stats */}
      {uploadStats && (
        <div className="px-4 py-2 bg-green-900/20 border-b border-green-700/30 text-sm text-green-400 flex items-center gap-4">
          <Icon name="check" size="sm" />
          <span>Uploaded: {uploadStats.wordCount.toLocaleString()} words, {uploadStats.charCount.toLocaleString()} chars</span>
          {uploadStats.estimatedChunks > 1 && (
            <span className="text-amber-400">(will process in {uploadStats.estimatedChunks} chunks)</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/30 text-sm text-red-400">
          {error}
        </div>
      )}

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

          {/* Content area */}
          {importMode === 'paste' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex-1 relative"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here...&#10;&#10;Supports:&#10;• Plain text&#10;• Markdown&#10;• Long documents (auto-chunked)&#10;&#10;Or drag & drop a file (.txt, .md, .doc, .docx, .pdf, .html)"
                autoFocus
                className="w-full h-full min-h-[60vh] bg-transparent border border-dashed border-gray-600 rounded-lg p-4 outline-none resize-none placeholder:text-muted-foreground/50 text-base leading-relaxed focus:border-blue-500 transition-colors"
              />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing...&#10;&#10;Tip: Type # + Space for heading, - + Space for list"
              autoFocus
              className="w-full h-full min-h-[60vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50 text-base leading-relaxed"
            />
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
            
            <div className="flex-1" />
            
            {/* Supported formats hint */}
            <div className="text-xs text-muted-foreground">
              Supported: .txt, .md, .doc, .docx, .pdf, .html, .rtf
            </div>
            
            {isDemoMode() && (
              <span className="text-xs text-amber-600">
                Demo mode - notes saved locally
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}