import { SearchBar } from "@/components/search/SearchBar";
import { NoteCard } from "@/components/notes/NoteCard";
import { prisma } from "@/lib/db/client";

export default async function SearchPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Find notes by meaning, not just keywords
        </p>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl">
        <SearchBar placeholder="What are you looking for?" className="w-full" />
      </div>

      {/* Search type toggles */}
      <div className="flex gap-2">
        <SearchTypeButton active>Semantic</SearchTypeButton>
        <SearchTypeButton>Keyword</SearchTypeButton>
        <SearchTypeButton>Hybrid</SearchTypeButton>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 text-sm">
        <FilterDropdown label="Type" options={["All", "Notes", "Journal", "Beats"]} />
        <FilterDropdown label="Date" options={["Any time", "Today", "Week", "Month", "Year"]} />
        <FilterDropdown label="Collection" options={["All", "Personal", "Work", "Ideas"]} />
      </div>

      {/* Results placeholder */}
      <div className="mt-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium">Search your notes</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Semantic search finds notes by meaning, even if the exact words don't match.
          </p>
        </div>
      </div>
    </div>
  );
}

function SearchTypeButton({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
        }
      `}
    >
      {children}
    </button>
  );
}

function FilterDropdown({ label, options }: { label: string; options: string[] }) {
  return (
    <div className="relative">
      <select className="appearance-none bg-muted rounded-lg px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}