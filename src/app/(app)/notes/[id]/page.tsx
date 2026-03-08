"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NoteExtractionPanel } from '@/components/notes/NoteExtractionPanel';

interface Note {
  id: string;
  title: string | null;
  content: string;
  contentPlain: string | null;
  noteType: string;
  createdAt: string;
  updatedAt: string;
  analysisStatus?: string;
  noteBeats?: Array<{
    beat: {
      id: string;
      beatType: string;
      name: string;
      summary: string | null;
      intensity: number;
    };
    relevance: number;
  }>;
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchNote = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch note');
      }
      const data = await response.json();
      setNote(data.note);
      setTitle(data.note.title || '');
      setContent(data.note.contentPlain || data.note.content || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleSave = async () => {
    if (!note) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          contentPlain: content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      setEditing(false);
      await fetchNote();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      router.push('/notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleExtracted = (beats: Array<{ id: string; name: string; type: string }>) => {
    fetchNote();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-medium">Note not found</h2>
        <p className="text-muted-foreground mt-2">This note may have been deleted.</p>
        <button
          onClick={() => router.push('/notes')}
          className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Back to Notes
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent border-b border-gray-600 focus:border-blue-500 outline-none w-full"
                placeholder="Note title"
              />
            ) : (
              note.title || 'Untitled'
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last updated {new Date(note.updatedAt).toLocaleDateString()}
            {note.noteType !== 'note' && (
              <span className="ml-2 px-2 py-0.5 rounded border bg-amber-500/10 text-amber-600">
                {note.noteType}
              </span>
            )}
            {note.analysisStatus && note.analysisStatus !== 'NONE' && (
              <span className="ml-2 px-2 py-0.5 rounded border bg-blue-500/10 text-blue-600">
                {note.analysisStatus.toLowerCase()}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTitle(note.title || '');
                  setContent(note.contentPlain || note.content || '');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="bg-card border rounded-lg p-6">
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[300px] bg-transparent resize-none outline-none"
            placeholder="Write your note..."
          />
        ) : (
          <div className="whitespace-pre-wrap">
            {note.contentPlain || note.content}
          </div>
        )}
      </div>

      {/* Extraction Panel */}
      <NoteExtractionPanel noteId={noteId} onExtracted={handleExtracted} />

      {/* Beats */}
      {note.noteBeats && note.noteBeats.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">
            Extracted Beats ({note.noteBeats.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {note.noteBeats.map((nb) => (
              <div
                key={nb.beat.id}
                className="p-3 bg-gray-800 rounded border border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nb.beat.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    {nb.beat.beatType}
                  </span>
                </div>
                {nb.beat.summary && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {nb.beat.summary}
                  </p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Intensity: {(nb.beat.intensity * 100).toFixed(0)}%</span>
                  <span>Relevance: {(nb.relevance * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="pt-4">
        <button
          onClick={() => router.push('/notes')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Notes
        </button>
      </div>
    </div>
  );
}