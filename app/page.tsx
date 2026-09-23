import { AppHeader } from "@/components/AppHeader";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/Landing";
import { getCurrentUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  const { view } = await searchParams;
  const data = await loadDashboard(user.id);
  return (
    <main className="app-shell">
      <AppHeader user={user} />
      <Dashboard userName={user.name} data={data} view={view === "all" || view === "past" ? view : "active"} />
    </main>
  );
}
