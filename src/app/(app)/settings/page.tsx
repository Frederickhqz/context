import { WebLLMSettings } from '@/components/settings/WebLLMSettings';
import { EmbeddingModelSettings } from '@/components/settings/EmbeddingModelSettings';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and account
        </p>
      </div>

      <div className="space-y-6">
        {/* AI Models */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">AI Models</h2>
          <WebLLMSettings />
        </div>

        {/* Embedding Models */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Embedding Models</h2>
          <EmbeddingModelSettings />
        </div>

        {/* Database status */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-2">Database Status</h2>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Connected to Supabase PostgreSQL</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            pgvector enabled for semantic search and embeddings.
          </p>
        </div>

        {/* Coming soon */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-sm">
            Settings for themes, notifications, data export, and more will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}