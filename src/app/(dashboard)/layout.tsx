"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { Icon } from "@/components/icon";
import { navigation } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-2 py-2">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-white">
          <Icon name="sparkles" size={20} />
        </span>
        <span>
          <span className="block text-sm font-bold tracking-tight text-[#181c31]">NAIS</span>
          <span className="block text-[11px] font-medium text-[#757693]">Nurul Albab System</span>
        </span>
      </Link>

      <div className="mt-8 flex-1 space-y-7 overflow-y-auto">
        {navigation.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-3 text-[10px] font-bold tracking-[0.14em] text-[#a2a3b7]">{group.label}</h2>
            <nav className="mt-2 space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition duration-150 ${
                      active
                        ? "bg-[#dbeafe] font-semibold text-[#4457ff]"
                        : "text-[#757693] hover:bg-[#f3f5ff] hover:text-[#181c31]"
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                    {active && <span className="ml-auto size-1.5 rounded-full bg-[#4457ff]" />}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] p-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white text-[#4457ff]">
          <Icon name="book" size={17} />
        </div>
        <p className="mt-3 text-xs font-bold text-[#181c31]">Ruang bertumbuh</p>
        <p className="mt-1 text-[11px] leading-5 text-[#757693]">
          Satu sistem untuk mendampingi amanah pesantren.
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountName, setAccountName] = useState("Akun NAIS");
  const [accountEmail, setAccountEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const activePage =
    navigation
      .flatMap((group) => group.items)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label ?? "Workspace";

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const emailName = session?.user.email?.split("@")[0];
      setAccountEmail(session?.user.email ?? "");
      setAccountName(emailName || "Akun NAIS");
    });

    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      const metadataName =
        user.user_metadata?.nama_lengkap ??
        user.user_metadata?.full_name ??
        user.user_metadata?.name;
      setAccountEmail(user.email ?? "");
      setAccountName(
        typeof metadataName === "string" && metadataName
          ? metadataName
          : user.email?.split("@")[0] || "Akun NAIS",
      );
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setAuthMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthMessage(`Tidak dapat keluar: ${error.message}`);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan saat mengakhiri sesi.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f5ff] text-[#181c31]">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-[#181c31]/30 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside className="fixed bottom-4 left-4 top-4 z-20 hidden w-[260px] rounded-3xl border border-[#e5e7eb] bg-white p-5 md:block">
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <aside
        aria-label="Navigasi dashboard"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`fixed bottom-3 left-3 top-3 z-50 w-[min(290px,calc(100vw-24px))] rounded-3xl border border-[#e5e7eb] bg-white p-5 transition-transform duration-200 md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a2a3b7]">Menu utama</span>
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            className="flex size-10 items-center justify-center rounded-full text-[#757693] transition hover:bg-[#f3f5ff]"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <div className="min-h-screen md:pl-[292px]">
        <AppHeader
          activePage={activePage}
          accountName={accountName}
          accountEmail={accountEmail}
          authMessage={authMessage}
          drawerOpen={drawerOpen}
          isSigningOut={isSigningOut}
          onOpenDrawer={() => setDrawerOpen(true)}
          onSignOut={() => void handleSignOut()}
        />
        <main className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
