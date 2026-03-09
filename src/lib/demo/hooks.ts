"use client";

import { useState, useCallback } from "react";
import {
  getDemoNotes,
  createDemoNote,
  updateDemoNote,
  deleteDemoNote,
  searchDemoNotes,
  isDemoMode,
  getAuthToken,
} from "@/lib/demo/client";
import type { DemoNote } from "@/lib/demo/client";

export function useDemoNotes() {
  const [notes, setNotes] = useState<DemoNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Load notes from localStorage or API
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      if (isDemoMode()) {
        const demoNotes = getDemoNotes();
        setNotes(demoNotes);
      } else {
        const token = getAuthToken();
        const response = await fetch("/api/notes", {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new note
  const createNote = useCallback(async (data: {
    title?: string;
    content: string;
    noteType?: string;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      if (isDemoMode()) {
        const note = createDemoNote(data);
        setNotes(prev => [note, ...prev]);
        return note;
      } else {
        const token = getAuthToken();
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (result.note) {
          setNotes(prev => [result.note, ...prev]);
        }
        return result.note;
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      throw error;
    }
  }, []);

  // Update a note
  const updateNote = useCallback(async (id: string, data: Partial<DemoNote>) => {
    try {
      if (isDemoMode()) {
        const note = updateDemoNote(id, data);
        if (note) {
          setNotes(prev => prev.map(n => n.id === id ? note : n));
        }
        return note;
      } else {
        const token = getAuthToken();
        const response = await fetch("/api/notes", {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ id, ...data }),
        });
        const result = await response.json();
        if (result.note) {
          setNotes(prev => prev.map(n => n.id === id ? result.note : n));
        }
        return result.note;
      }
    } catch (error) {
      console.error("Failed to update note:", error);
      throw error;
    }
  }, []);

  // Delete a note
  const deleteNote = useCallback(async (id: string) => {
    try {
      if (isDemoMode()) {
        deleteDemoNote(id);
        setNotes(prev => prev.filter(n => n.id !== id));
        return true;
      } else {
        const token = getAuthToken();
        const response = await fetch(`/api/notes?id=${id}`, { 
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        const result = await response.json();
        if (result.success) {
          setNotes(prev => prev.filter(n => n.id !== id));
        }
        return result.success;
      }
    } catch (error) {
      console.error("Failed to delete note:", error);
      throw error;
    }
  }, []);

  // Search notes
  const searchNotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      return notes;
    }

    try {
      if (isDemoMode()) {
        return searchDemoNotes(query);
      } else {
        const token = getAuthToken();
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        const data = await response.json();
        return data.results || [];
      }
    } catch (error) {
      console.error("Failed to search notes:", error);
      return [];
    }
  }, [notes]);

  return {
    notes,
    loading,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
  };
}