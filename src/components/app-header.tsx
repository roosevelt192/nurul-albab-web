"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Icon, type IconName } from "@/components/icon";
import {
  ALERTS_REFRESH_EVENT,
  fetchOperationalAlerts,
  type OperationalAlert,
} from "@/lib/operational-alerts";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

type AlertItem = OperationalAlert & { icon: IconName };

const roleConfig: Record<string, { label: string; badgeClass: string }> = {
  super_admin: { label: "Super Admin", badgeClass: "bg-[#eef0ff] text-[#4457ff]" },
  bendahara: { label: "Bendahara", badgeClass: "bg-[#e8f5f0] text-[#25815e]" },
  staf: { label: "Staf Asatidz", badgeClass: "bg-[#f3e8ff] text-[#7e22ce]" },
  wali_santri: { label: "Wali Santri", badgeClass: "bg-[#f1f1f5] text-[#757693]" },
};

export function AppHeader({
  activePage,
  accountName,
  accountEmail,
  currentRole: propRole,
  authMessage,
  drawerOpen,
  isSigningOut,
  onOpenDrawer,
  onSignOut,
}: {
  activePage: string;
  accountName: string;
  accountEmail: string;
  currentRole?: UserRole | null;
  authMessage: string;
  drawerOpen: boolean;
  isSigningOut: boolean;
  onOpenDrawer: () => void;
  onSignOut: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsRead, setAlertsRead] = useState(false);

  // State peran mandiri untuk memastikan badge tidak macet di status "Memuat..."
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(propRole ?? null);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propRole) {
      setResolvedRole(propRole);
      return;
    }

    // Fallback mandiri jika layout belum/tidak mengirimkan propRole
    let active = true;
    async function resolveUserRole() {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user || !active) return;

        const email = authData.user.email ?? "";
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!active) return;
        if (profile?.role) {
          setResolvedRole(profile.role as UserRole);
        } else if (email.includes("admin")) {
          setResolvedRole("super_admin");
        } else {
          setResolvedRole("staf");
        }
      } catch {
        if (active) setResolvedRole("staf");
      }
    }

    void resolveUserRole();
    return () => {
      active = false;
    };
  }, [propRole]);

  const roleKey = resolvedRole ?? (accountEmail.includes("admin") ? "super_admin" : "staf");
  const roleMeta = roleConfig[roleKey] ?? {
    label: "Pengurus",
    badgeClass: "bg-[#f1f1f5] text-[#757693]",
  };

  const loadAlerts = useCallback(async () => {
    const supabase = createClient();
    const { alerts, errors } = await fetchOperationalAlerts(supabase);

    if (errors.length) {
      console.error("Gagal memuat notifikasi operasional:", errors);
    }

    setAlertCount(alerts.length);
    setAlerts(
      alerts.slice(0, 20).map((alert) => ({
        ...alert,
        icon: alert.kind === "stock" ? "alert-triangle" : "shield",
      }))
    );
    setAlertsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAlerts().catch(() => setAlertsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAlerts]);

  useEffect(() => {
    function refreshAlerts() {
      void loadAlerts().catch(() => setAlertsLoading(false));
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshAlerts();
    }

    window.addEventListener(ALERTS_REFRESH_EVENT, refreshAlerts);
    window.addEventListener("focus", refreshAlerts);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(refreshAlerts, 60_000);

    return () => {
      window.removeEventListener(ALERTS_REFRESH_EVENT, refreshAlerts);
      window.removeEventListener("focus", refreshAlerts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [loadAlerts]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const unreadCount = alertsRead ? 0 : alertCount;
  const initials =
    accountName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "NA";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f3f5ff]/90 px-3 py-2.5 backdrop-blur-xl sm:px-6 md:px-8">
        <div className="mx-auto flex min-h-12 max-w-[1440px] items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              aria-expanded={drawerOpen}
              onClick={onOpenDrawer}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 md:hidden"
            >
              <Icon name="menu" size={19} />
            </button>
            <div className="min-w-0">
              <p className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
                Pondok Pesantren Nurul Albab
              </p>
              <h1 className="truncate text-sm font-bold text-slate-800 sm:text-base">{activePage}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buka pencarian cepat"
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-3 pr-2 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-800 md:flex"
            >
              <Icon name="search" size={15} />
              <span className="hidden lg:inline">Cari santri, produk, menu…</span>
              <kbd className="ml-2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Ctrl K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buka pencarian cepat"
              className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-[#4457ff] md:hidden"
            >
              <Icon name="search" size={18} />
            </button>

            {/* Notifikasi */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} peringatan` : ""}`}
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((current) => !current);
                  setProfileOpen(false);
                  if (!notifOpen) void loadAlerts().catch(() => setAlertsLoading(false));
                }}
                className="relative flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-[#4457ff]"
              >
                <Icon name="bell" size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-[18px] text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <div
                className={`fixed left-3 right-3 top-[68px] z-50 origin-top rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] transition-all duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] ${
                  notifOpen ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Notifikasi</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {alertsLoading ? "Memuat peringatan…" : `${alertCount} peringatan aktif`}
                    </p>
                  </div>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#eef0ff] text-[#4457ff]">
                    <Icon name="bell" size={15} />
                  </span>
                </div>

                <div className="max-h-[320px] overflow-y-auto p-2 [scrollbar-width:thin]">
                  {alertsLoading ? (
                    <p className="px-3 py-8 text-center text-xs text-slate-400">Memeriksa data pesantren…</p>
                  ) : alerts.length ? (
                    alerts.map((alert) => (
                      <Link
                        key={alert.id}
                        href={alert.href}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                      >
                        <span
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            alert.tone === "danger"
                              ? "bg-[#fff0f0] text-[#b74444]"
                              : "bg-[#fff4e7] text-[#bd7627]"
                          }`}
                        >
                          <Icon name={alert.icon} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <span className="truncate text-xs font-semibold text-slate-800">{alert.title}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                alert.tone === "danger"
                                  ? "bg-[#fff0f0] text-[#b74444]"
                                  : "bg-[#fff4e7] text-[#bd7627]"
                              }`}
                            >
                              {alert.badge}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{alert.description}</span>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-8 text-center">
                      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#e8f5f0] text-[#25815e]">
                        <Icon name="check" size={18} />
                      </span>
                      <p className="mt-2 text-xs font-semibold text-slate-700">Semua terkendali</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Tidak ada peringatan stok atau perizinan.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setAlertsRead(true)}
                    disabled={!alerts.length || alertsRead}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#4457ff] transition hover:bg-[#eef0ff] disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    {alertsRead ? "Sudah dibaca" : "Tandai sudah dibaca"}
                  </button>
                  <Link
                    href="/perizinan"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    Lihat perizinan
                  </Link>
                </div>
              </div>
            </div>

            {/* Menu Profil Pengguna */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-label="Menu profil"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1 transition hover:border-slate-300 sm:pr-3"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-[11px] font-bold uppercase text-white">
                  {initials}
                </span>
                <span className="hidden min-w-0 sm:block text-left">
                  <span className="block max-w-32 truncate text-xs font-semibold text-slate-800">{accountName}</span>
                  <span className="block text-[10px] text-slate-500">{roleMeta.label}</span>
                </span>
                <Icon name="chevron-down" size={14} className="hidden text-slate-400 sm:block" />
              </button>

              <div
                className={`absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)] transition-all duration-200 ${
                  profileOpen ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
                }`}
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{accountName}</p>
                  <p className="truncate text-[11px] text-slate-500">{accountEmail}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${roleMeta.badgeClass}`}>
                    {roleMeta.label}
                  </span>
                </div>

                {roleKey === "super_admin" && (
                  <>
                    <div className="my-1 h-px bg-slate-100" />
                    <Link
                      href="/pengaturan"
                      onClick={() => setProfileOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Icon name="settings" size={16} /> Pengaturan Sistem
                    </Link>
                  </>
                )}

                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={isSigningOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#b74444] transition hover:bg-[#fff0f0] disabled:opacity-60"
                >
                  <Icon name="log-out" size={16} /> {isSigningOut ? "Sedang keluar…" : "Keluar"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {authMessage && (
          <p role="alert" className="mx-auto mt-2 max-w-[1440px] text-right text-[11px] text-[#b74444]">
            {authMessage}
          </p>
        )}
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}