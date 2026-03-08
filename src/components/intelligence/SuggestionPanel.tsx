'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils/cn';

interface Suggestion {
  toBeat: {
    id: string;
    name: string;
    beatType: string;
    summary: string;
  };
  confidence: number;
  reason: string;
}

interface SuggestionPanelProps {
  beatId: string;
  className?: string;
}

export function SuggestionPanel({ beatId, className }: SuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        const response = await fetch(`/api/beats/${beatId}/suggestions`);
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Failed to load suggestions', err);
      } finally {
        setLoading(false);
      }
    }
    loadSuggestions();
  }, [beatId]);

  if (loading) return <div className="text-xs text-muted-foreground animate-pulse">Scanning for connections...</div>;
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4", className)}>
      <div className="flex items-center gap-2 text-primary">
        <Icon name="sparkles" size="sm" />
        <h3 className="font-semibold uppercase tracking-wider text-xs">
          AI Connection Suggestions
        </h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((sug) => (
          <div key={sug.toBeat.id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50 group">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sug.toBeat.name}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">
                  {sug.toBeat.beatType}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{sug.reason}</p>
            </div>
            
            <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded transition-all text-primary">
              <Icon name="plus" size="sm" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
