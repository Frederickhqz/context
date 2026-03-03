import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="container max-w-5xl mx-auto py-8 px-6">
          {children}
        </div>
      </div>
    </div>
  );
}