// Beat Suggestions Hook - React hook for fetching connection suggestions
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BeatConnectionType } from './types';

export interface SuggestedConnection {
  fromBeatId: string;
  toBeatId: string;
  toBeatName: string;
  toBeatType: string;
  toBeatSummary?: string | null;
  suggestedType: BeatConnectionType;
  strength: number;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  source: 'embedding' | 'lexical' | 'llm';
}

export interface UseSuggestionsOptions {
  beatId: string;
  limit?: number;
  minConfidence?: 'high' | 'medium' | 'low';
  useLLM?: boolean;
  autoFetch?: boolean;
}

export interface UseSuggestionsResult {
  suggestions: SuggestedConnection[];
  loading: boolean;
  error: Error | null;
  stats: {
    embeddingCandidates: number;
    lexicalCandidates: number;
    llmAnalyzed: number;
    totalSuggestions: number;
  } | null;
  refetch: () => Promise<void>;
  applySuggestion: (suggestion: SuggestedConnection) => Promise<boolean>;
  dismissSuggestion: (suggestion: SuggestedConnection) => void;
}

/**
 * Hook for fetching and managing connection suggestions
 */
export function useSuggestions(options: UseSuggestionsOptions): UseSuggestionsResult {
  const { beatId, limit = 10, minConfidence = 'medium', useLLM = true, autoFetch = true } = options;

  const [suggestions, setSuggestions] = useState<SuggestedConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<UseSuggestionsResult['stats']>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!beatId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        minConfidence,
        useLLM: String(useLLM),
      });

      const response = await fetch(`/api/beats/suggestions/${beatId}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [beatId, limit, minConfidence, useLLM]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
  }, [autoFetch, fetchSuggestions]);

  // Apply a suggestion by creating the connection
  const applySuggestion = useCallback(async (suggestion: SuggestedConnection): Promise<boolean> => {
    try {
      const response = await fetch(`/api/beats/${suggestion.fromBeatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          toBeatId: suggestion.toBeatId,
          connectionType: suggestion.suggestedType,
          strength: suggestion.strength,
          evidence: suggestion.evidence,
          isSuggested: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create connection');
      }

      // Remove from suggestions list
      setSuggestions(prev => prev.filter(s => s.toBeatId !== suggestion.toBeatId));

      return true;
    } catch (err) {
      console.error('Failed to apply suggestion:', err);
      return false;
    }
  }, []);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((suggestion: SuggestedConnection) => {
    setSuggestions(prev => prev.filter(s => s.toBeatId !== suggestion.toBeatId));
  }, []);

  return {
    suggestions,
    loading,
    error,
    stats,
    refetch: fetchSuggestions,
    applySuggestion,
    dismissSuggestion,
  };
}

/**
 * Hook for batch suggestions across multiple beats
 */
export function useBatchSuggestions(beatIds: string[], options?: Omit<UseSuggestionsOptions, 'beatId'>) {
  const [allSuggestions, setAllSuggestions] = useState<Map<string, SuggestedConnection[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    if (beatIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        beatIds.map(async beatId => {
          const params = new URLSearchParams({
            limit: String(options?.limit ?? 5),
            minConfidence: options?.minConfidence ?? 'medium',
            useLLM: String(options?.useLLM ?? false),
          });

          const response = await fetch(`/api/beats/suggestions/${beatId}?${params}`);
          if (!response.ok) return [beatId, []] as const;

          const data = await response.json();
          return [beatId, data.suggestions || []] as const;
        })
      );

      setAllSuggestions(new Map(results));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [beatIds, options?.limit, options?.minConfidence, options?.useLLM]);

  return {
    suggestions: allSuggestions,
    loading,
    error,
    refetch: fetchAll,
  };
}

export default useSuggestions;