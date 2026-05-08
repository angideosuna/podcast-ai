import { NavHeader } from "@/components/nav-header";
import { Sidebar } from "@/components/sidebar";
import { DashboardProvider } from "@/components/dashboard-context";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <NavHeader />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
