import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="container max-w-5xl mx-auto py-8 px-4 pt-20 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}