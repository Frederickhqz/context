import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';

interface SearchPageProps {
  searchParams: {
    q?: string;
    type?: string;
  };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  const type = searchParams.type || 'semantic';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Find notes by meaning or keywords
        </p>
      </div>

      {/* Search bar */}
      <SearchBar defaultValue={query} defaultType={type} />

      {/* Results */}
      {query && (
        <SearchResults query={query} type={type} />
      )}

      {/* Empty state */}
      {!query && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">Search your notes</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Use semantic search to find notes by meaning, or keyword search for exact matches.
          </p>
          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="text-lg">💡</span>
              <span>Try searching for concepts like "project planning" or "meeting notes"</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">🔍</span>
              <span>Semantic search understands meaning, not just keywords</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">⚡</span>
              <span>Use @ to find mentions of people or # for tags</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}