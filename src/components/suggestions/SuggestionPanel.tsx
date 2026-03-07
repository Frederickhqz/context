'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { BEAT_TYPE_CONFIG, CONNECTION_TYPE_CONFIG, type BeatConnectionType } from '@/lib/beats/types';
import { useSuggestions, type SuggestedConnection } from '@/lib/beats/use-suggestions';
import type { BeatType } from '@/lib/beats/types';

interface SuggestionPanelProps {
  beatId: string;
  beatName: string;
  beatType?: BeatType;
  onConnectionCreated?: (connection: { toBeatId: string; connectionType: BeatConnectionType }) => void;
  onClose?: () => void;
  className?: string;
}

export function SuggestionPanel({
  beatId,
  beatName,
  beatType,
  onConnectionCreated,
  onClose,
  className = '',
}: SuggestionPanelProps) {
  const {
    suggestions,
    loading,
    error,
    stats,
    refetch,
    applySuggestion,
    dismissSuggestion,
  } = useSuggestions({
    beatId,
    limit: 10,
    minConfidence: 'medium',
    useLLM: true,
  });

  const [applying, setApplying] = useState<string | null>(null);

  const handleApply = async (suggestion: SuggestedConnection) => {
    setApplying(suggestion.toBeatId);
    try {
      const success = await applySuggestion(suggestion);
      if (success && onConnectionCreated) {
        onConnectionCreated({
          toBeatId: suggestion.toBeatId,
          connectionType: suggestion.suggestedType,
        });
      }
    } finally {
      setApplying(null);
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-900/50 text-green-300 border-green-700',
      medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
      low: 'bg-gray-800 text-gray-400 border-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded border ${colors[confidence]}`}>
        {confidence}
      </span>
    );
  };

  const getSourceIcon = (source: 'embedding' | 'lexical' | 'llm') => {
    const icons = {
      embedding: 'search',
      lexical: 'text',
      llm: 'brain',
    };
    return icons[source] || 'link';
  };

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h3 className="text-lg font-medium text-white">Connection Suggestions</h3>
          <p className="text-sm text-gray-400">
            for <span className="text-white">{beatName}</span>
            {beatType && (
              <span
                className="ml-2 px-2 py-0.5 text-xs rounded"
                style={{ backgroundColor: BEAT_TYPE_CONFIG[beatType]?.color + '33' }}
              >
                {BEAT_TYPE_CONFIG[beatType]?.label}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            title="Refresh suggestions"
          >
            <Icon name={loading ? 'loading' : 'refresh'} size="md" className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            >
              <Icon name="x" size="md" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-4 py-2 bg-gray-800/50 text-xs text-gray-400 flex gap-4">
          <span>Embedding: {stats.embeddingCandidates}</span>
          <span>Lexical: {stats.lexicalCandidates}</span>
          {stats.llmAnalyzed > 0 && <span>LLM: {stats.llmAnalyzed}</span>}
          <span className="ml-auto">Total: {stats.totalSuggestions}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border-b border-red-800 text-red-300 text-sm">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {loading && suggestions.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          <Icon name="loading" className="animate-spin inline mb-2" />
          <p>Analyzing potential connections...</p>
        </div>
      )}

      {/* Suggestions List */}
      <div className="divide-y divide-gray-800">
        {suggestions.map(suggestion => {
          const connectionConfig = CONNECTION_TYPE_CONFIG[suggestion.suggestedType];
          const isApplying = applying === suggestion.toBeatId;

          return (
            <div key={suggestion.toBeatId} className="p-4 hover:bg-gray-800/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{suggestion.toBeatName}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: BEAT_TYPE_CONFIG[suggestion.toBeatType as BeatType]?.color }}
                    />
                    <span className="text-xs text-gray-400">
                      {BEAT_TYPE_CONFIG[suggestion.toBeatType as BeatType]?.label}
                    </span>
                    {getConfidenceBadge(suggestion.confidence)}
                  </div>

                  {suggestion.toBeatSummary && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                      {suggestion.toBeatSummary}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className="flex items-center gap-1"
                      style={{ color: connectionConfig?.color }}
                    >
                      <Icon name="link" size="sm" />
                      {connectionConfig?.label || suggestion.suggestedType}
                    </span>
                    <span className="text-gray-500">
                      Strength: {(suggestion.strength * 100).toFixed(0)}%
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <Icon name={getSourceIcon(suggestion.source) as any} size="sm" />
                      {suggestion.source}
                    </span>
                  </div>

                  {suggestion.evidence && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      {suggestion.evidence}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleApply(suggestion)}
                    disabled={isApplying}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm text-white"
                  >
                    {isApplying ? 'Adding...' : 'Add'}
                  </button>
                  <button
                    onClick={() => dismissSuggestion(suggestion)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {!loading && suggestions.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          <Icon name="link" size="lg" className="mb-2 opacity-50" />
          <p>No suggestions found</p>
          <p className="text-sm mt-1">
            Try creating more beats or extracting from notes
          </p>
        </div>
      )}
    </div>
  );
}

export default SuggestionPanel;