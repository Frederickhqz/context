export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and account
        </p>
      </div>

      <div className="space-y-4">
        {/* Coming soon */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-sm">
            Settings for themes, notifications, data export, and more will be available here.
          </p>
        </div>

        {/* Database status */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-2">Database Status</h2>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">Demo mode - no database connected</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Configure DATABASE_URL in your environment to enable persistence.
          </p>
        </div>
      </div>
    </div>
  );
}