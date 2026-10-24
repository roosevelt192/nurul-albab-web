"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { Icon } from "@/components/icon";
import { navigation } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database, UserRole } from "@/types/database";

type SidebarBrand = Pick<
  Database["public"]["Tables"]["pengaturan_pesantren"]["Row"],
  "logo_url" | "logo_height" | "show_logo_sidebar"
>;

// Pemetaan izin menu berdasarkan peran pengguna
const allowedHrefsByRole: Record<UserRole, string[]> = {
  super_admin: [
    "/dashboard",
    "/santri",
    "/keilmuan",
    "/perizinan",
    "/keuangan",
    "/koperasi",
    "/koperasi/stok",
    "/koperasi/laporan",
    "/portal-wali",
    "/pengaturan",
  ],
  bendahara: [
    "/keuangan",
    "/koperasi",
    "/koperasi/stok",
    "/koperasi/laporan",
    "/portal-wali",
  ],
  staf: [
    "/keilmuan",
    "/santri",
    "/perizinan",
    "/portal-wali",
  ],
  wali_santri: [
    "/portal-wali",
  ],
};

function SidebarContent({
  onNavigate,
  brand,
  currentRole,
}: {
  onNavigate: () => void;
  brand: SidebarBrand | null;
  currentRole: UserRole | null;
}) {
  const pathname = usePathname();
  const allowedHrefs = currentRole ? allowedHrefsByRole[currentRole] ?? [] : [];

  // Filter navigasi berdasarkan hak akses peran pengguna
  const filteredNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        allowedHrefs.some(
          (allowed) => item.href === allowed || item.href.startsWith(`${allowed}/`)
        )
      ),
    }))
    .filter((group) => group.items.length > 0);

  const homeHref = currentRole === "bendahara" ? "/keuangan" : currentRole === "staf" ? "/keilmuan" : "/dashboard";

  return (
    <div className="flex h-full flex-col">
      <Link href={homeHref} onClick={onNavigate} className="flex items-center gap-3 px-2 py-2">
        {brand?.show_logo_sidebar !== false && (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef0ff]">
            {brand?.logo_url ? (
              <Image
                src={brand.logo_url}
                alt="Logo lembaga"
                width={56}
                height={56}
                unoptimized
                className={`w-auto max-w-full object-contain ${brand.logo_height ?? "h-10"}`}
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-white">
                <Icon name="sparkles" size={20} />
              </span>
            )}
          </span>
        )}
        <span>
          <span className="block text-sm font-bold tracking-tight text-[#181c31]">NAIS</span>
          <span className="block text-[11px] font-medium text-[#757693]">Nurul Albab System</span>
        </span>
      </Link>

      <div className="mt-8 flex-1 space-y-7 overflow-y-auto pr-1">
        {filteredNavigation.map((group) => (
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
  const [accountName, setAccountName] = useState("Memuat akun…");
  const [accountEmail, setAccountEmail] = useState("");
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sidebarBrand, setSidebarBrand] = useState<SidebarBrand | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const activePage =
    navigation
      .flatMap((group) => group.items)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label ?? "Workspace";

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadUserProfile() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!active || authError || !authData.user) return;

        const email = authData.user.email ?? "";
        setAccountEmail(email);

        const { data: profile } = await supabase
          .from("profiles")
          .select("nama_lengkap, full_name, role")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!active) return;

        if (profile) {
          const finalName = profile.nama_lengkap || profile.full_name || email.split("@")[0] || "Pengguna";
          setAccountName(finalName);
          setCurrentRole((profile.role as UserRole) || (email.includes("admin") ? "super_admin" : "staf"));
        } else {
          setAccountName(email.split("@")[0] || "Pengguna");
          setCurrentRole(email.includes("admin") ? "super_admin" : "staf");
        }
      } catch (err) {
        console.warn("Gagal memuat profil pengguna:", err);
      }
    }

    void loadUserProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAccountEmail("");
        setAccountName("Akun NAIS");
        setCurrentRole(null);
      } else {
        void loadUserProfile();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBrand() {
      const { data, error } = await createClient()
        .from("pengaturan_pesantren")
        .select("logo_url, logo_height, show_logo_sidebar")
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn("Unable to load sidebar logo settings.", error.message);
        return;
      }
      setSidebarBrand(data);
    }
    void loadBrand();
    return () => {
      active = false;
    };
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
        error instanceof Error ? error.message : "Terjadi kesalahan saat mengakhiri sesi."
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
        <SidebarContent
          onNavigate={() => setDrawerOpen(false)}
          brand={sidebarBrand}
          currentRole={currentRole}
        />
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
        <SidebarContent
          onNavigate={() => setDrawerOpen(false)}
          brand={sidebarBrand}
          currentRole={currentRole}
        />
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