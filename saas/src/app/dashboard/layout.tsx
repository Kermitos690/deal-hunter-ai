import { requireUser } from "@/lib/security/session";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="lg:flex"><DashboardNav user={user} /><main className="min-w-0 flex-1 p-5 md:p-8">{children}</main></div>;
}
