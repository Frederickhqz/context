'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils/cn';

interface SearchResultsProps {
  query: string;
  type: string;
}

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  contentPlain: string | null;
  noteType: string;
  createdAt: string;
  score: number;
  entities: Array<{
    id: string;
    name: string;
    entityType: string;
  }>;
}

export function SearchResults({ query, type }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('type', type);

        const response = await fetch(`/api/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [query, type]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-full mb-1" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Search Error</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No results found for "{query}"</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try different keywords or switch to semantic search
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
      </p>

      <div className="space-y-3">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const typeColors: Record<string, string> = {
    note: 'bg-primary/10 text-primary border-primary/20',
    journal: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    beat: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  const entityColors: Record<string, string> = {
    person: 'bg-blue-500/10 text-blue-600',
    place: 'bg-green-500/10 text-green-600',
    project: 'bg-purple-500/10 text-purple-600',
    concept: 'bg-pink-500/10 text-pink-600',
    event: 'bg-amber-500/10 text-amber-600',
  };

  return (
    <a
      href={`/notes/${result.id}`}
      className={cn(
        'block rounded-lg border p-4 transition-all',
        'hover:border-primary/30 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground line-clamp-1">
            {result.title || 'Untitled'}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {result.contentPlain || result.content}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn(
            'rounded px-2 py-0.5 text-xs font-medium border',
            typeColors[result.noteType] || typeColors.note
          )}>
            {result.noteType}
          </span>
          {result.score > 0 && (
            <span className="text-xs text-muted-foreground">
              {Math.round(result.score * 100)}% match
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
        </span>
        {result.entities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.entities.slice(0, 3).map((entity) => (
              <span
                key={entity.id}
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs',
                  entityColors[entity.entityType] || 'bg-muted'
                )}
              >
                {entity.name}
              </span>
            ))}
            {result.entities.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{result.entities.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}