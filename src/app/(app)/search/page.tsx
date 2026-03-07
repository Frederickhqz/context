import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { Icon } from '@/components/ui/Icon';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || '';
  const type = params.type || 'semantic';

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
            <Icon name="search" size="lg" className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Search your notes</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Use semantic search to find notes by meaning, or keyword search for exact matches.
          </p>
          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Icon name="lightbulb" size="md" className="text-amber-500 shrink-0" />
              <span>Try searching for concepts like "project planning" or "meeting notes"</span>
            </div>
            <div className="flex items-center gap-3">
              <Icon name="search" size="md" className="text-blue-500 shrink-0" />
              <span>Semantic search understands meaning, not just keywords</span>
            </div>
            <div className="flex items-center gap-3">
              <Icon name="bolt" size="md" className="text-purple-500 shrink-0" />
              <span>Use @ to find mentions of people or # for tags</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}