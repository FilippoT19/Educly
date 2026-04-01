import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 md:pt-0 pt-14 relative">
        {/* Subtle dot-grid overlay */}
        <div className="dot-grid absolute inset-0 pointer-events-none opacity-40" aria-hidden />
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
