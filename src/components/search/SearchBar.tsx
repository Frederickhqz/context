'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface SearchBarProps {
  defaultValue?: string;
  defaultType?: string;
  className?: string;
}

export function SearchBar({ defaultValue = '', defaultType = 'semantic', className }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [type, setType] = useState(defaultType);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const params = new URLSearchParams();
    params.set('q', query);
    if (type !== 'semantic') {
      params.set('type', type);
    }
    
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className={cn('space-y-3', className)}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your notes..."
          className="w-full rounded-lg border bg-background px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('semantic')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            type === 'semantic'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Semantic
        </button>
        <button
          type="button"
          onClick={() => setType('keyword')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            type === 'keyword'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Keyword
        </button>
        <button
          type="button"
          onClick={() => setType('hybrid')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            type === 'hybrid'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Hybrid
        </button>
      </div>
    </form>
  );
}