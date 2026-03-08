'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils/cn';
import { Contradiction } from '@/lib/extraction/contradiction-logic';

interface ContradictionPanelProps {
  contradictions: Contradiction[];
  onResolve?: (id: string) => void;
  className?: string;
}

export function ContradictionPanel({ 
  contradictions, 
  onResolve,
  className 
}: ContradictionPanelProps) {
  if (contradictions.length === 0) return null;

  return (
    <div className={cn("space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4", className)}>
      <div className="flex items-center gap-2 text-destructive">
        <Icon name="alertTriangle" size="sm" />
        <h3 className="font-semibold uppercase tracking-wider text-xs">
          Narrative Inconsistencies Detected ({contradictions.length})
        </h3>
      </div>

      <div className="divide-y divide-destructive/10">
        {contradictions.map((contra) => (
          <div key={contra.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-foreground">{contra.description}</p>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border uppercase",
                contra.severity > 0.7 ? "bg-destructive text-destructive-foreground border-destructive" : "border-destructive/30 text-destructive"
              )}>
                {contra.type}
              </span>
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="text-xs p-2 rounded bg-background/50 border border-border/50">
                <span className="text-muted-foreground block mb-1">Observation A:</span>
                {contra.evidence.beatA}
              </div>
              <div className="text-xs p-2 rounded bg-background/50 border border-border/50">
                <span className="text-muted-foreground block mb-1">Observation B:</span>
                {contra.evidence.beatB}
              </div>
            </div>

            <button 
              onClick={() => onResolve?.(contra.id)}
              className="mt-3 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Mark as Intentional Paradox
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
