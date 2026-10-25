"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { FormMessage } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import {
  ALERTS_REFRESH_EVENT,
  buildPermitAlerts,
  buildStockAlerts,
} from "@/lib/operational-alerts";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Journal = Database["public"]["Tables"]["jurnal_keilmuan"]["Row"];
type Permit = Database["public"]["Tables"]["perizinan_santri"]["Row"];
type CashEntry = Database["public"]["Tables"]["jurnal_kas"]["Row"];

type ActivityTone = "keilmuan" | "perizinan" | "keuangan";

type Activity = {
  id: string;
  name: string;
  action: string;
  detail: string;
  timestamp: string;
  status: string;
  tone: ActivityTone;
  href: string;
};

type OpsAlert = {
  id: string;
  title: string;
  detail: string;
  badge: string;
  tone: "danger" | "warning";
  href: string;
};

type Metric = {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  color: string;
  iconColor: string;
  href: string;
  highlight?: boolean;
};

type ActivityFilter = "all" | ActivityTone;

interface DashboardState {
  activeStudents: number;
  studentsOut: number;
  todayJournals: number;
  todaySales: { total: number; count: number };
  cashBalance: number | null;
  cashAccounts: Array<{ name: string; balance: number }>;
  activities: Activity[];
  opsAlerts: OpsAlert[];
}

const initialDashboardState: DashboardState = {
  activeStudents: 0,
  studentsOut: 0,
  todayJournals: 0,
  todaySales: { total: 0, count: 0 },
  cashBalance: null,
  cashAccounts: [],
  activities: [],
  opsAlerts: [],
};

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "baru saja";
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatTime(value);
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "NA";
}

function journalDetail(journal: Partial<Journal>) {
  if (journal.kategori_jurnal === "quran") {
    const surahRange =
      journal.surah_awal_number &&
      journal.surah_akhir_number &&
      journal.surah_awal_number !== journal.surah_akhir_number
        ? ` · ${journal.surah_awal_number}–${journal.surah_akhir_number}`
        : "";
    const verseRange =
      journal.ayat_awal === null || journal.ayat_awal === undefined
        ? ""
        : ` · ayat ${journal.ayat_awal}–${journal.ayat_akhir ?? journal.ayat_awal}`;
    return `${journal.nama_surat ?? "Al-Qur’an"}${surahRange}${verseRange}`;
  }
  if (journal.kategori_jurnal === "matan") {
    return `${journal.nama_kitab ?? "Matan"}${journal.cakupan_bacaan ? ` · ${journal.cakupan_bacaan}` : ""}`;
  }
  return `${journal.nama_kitab ?? "Sorogan"}${journal.bab_kajian ? ` · ${journal.bab_kajian}` : ""}`;
}

function permitStatus(status: string, returnedAt: string | null) {
  if (returnedAt || status.includes("kembali") || status === "terlambat") return "Diizinkan";
  return "Di luar";
}

const toneStyles: Record<ActivityTone, { avatar: string; badge: string; labelType: string }> = {
  keilmuan: {
    avatar: "bg-[#eef0ff] text-[#4457ff]",
    badge: "bg-[#eef0ff] text-[#4457ff]",
    labelType: "text-[#4457ff]",
  },
  perizinan: {
    avatar: "bg-[#fff4e7] text-[#bd7627]",
    badge: "bg-[#fff4e7] text-[#bd7627]",
    labelType: "text-[#bd7627]",
  },
  keuangan: {
    avatar: "bg-[#e8f5f0] text-[#25815e]",
    badge: "bg-[#e8f5f0] text-[#25815e]",
    labelType: "text-[#25815e]",
  },
};

const filterOptions: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "keilmuan", label: "Keilmuan" },
  { value: "perizinan", label: "Perizinan" },
  { value: "keuangan", label: "Keuangan" },
];

export default function DashboardPage() {
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [userName, setUserName] = useState("");
  const [data, setData] = useState<DashboardState>(initialDashboardState);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [alertsRefreshToken, setAlertsRefreshToken] = useState(0);

  useEffect(() => {
    function refresh() {
      setAlertsRefreshToken((current) => current + 1);
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refresh();
    }

    window.addEventListener(ALERTS_REFRESH_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener(ALERTS_REFRESH_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const today = todayLocal();
    setCurrentDateStr(today);

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: authData }) => {
      const user = authData?.user;
      if (!user) return;
      const metadataName =
        user.user_metadata?.nama_lengkap ?? user.user_metadata?.full_name ?? user.user_metadata?.name;
      const fallback = user.email?.split("@")[0] ?? "";
      const raw = (typeof metadataName === "string" && metadataName ? metadataName : fallback).trim();
      if (!raw) return;
      const pretty = raw.charAt(0).toUpperCase() + raw.slice(1);
      setUserName(/^ustadz/i.test(pretty) ? pretty : `Ustadz ${pretty}`);
    });
  }, []);

  const loadDashboardData = useCallback(async (today: string) => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const [
        studentCount,
        outsideCount,
        journalCount,
        recentJournals,
        recentPermits,
        activePermits,
        cashAccountsResult,
        salesToday,
        stockProducts,
        recentCash,
      ] = await Promise.all([
        supabase.from("santri").select("id", { count: "exact", head: true }).eq("status", "aktif"),
        supabase
          .from("perizinan_santri")
          .select("id", { count: "exact", head: true })
          .in("status", ["sedang_di_luar", "diajukan", "disetujui"])
          .is("kedatangan_aktual", null),
        supabase.from("jurnal_keilmuan").select("id", { count: "exact", head: true }).eq("tanggal", today),
        supabase
          .from("jurnal_keilmuan")
          .select("id, santri_id, kategori_jurnal, mode_setoran, nama_surat, surah_awal_number, surah_akhir_number, ayat_awal, ayat_akhir, nama_kitab, cakupan_bacaan, bab_kajian, predikat, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("perizinan_santri")
          .select("id, santri_id, tanggal_keluar, batas_kembali, kedatangan_aktual, alasan_izin, penjemput, status, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("perizinan_santri")
          .select("id, santri_id, batas_kembali, alasan_izin, kedatangan_aktual, status, created_at")
          .is("kedatangan_aktual", null)
          .limit(25),
        supabase.from("rekening_kas").select("name, balance").eq("is_active", true),
        supabase
          .from("transaksi_penjualan")
          .select("total_amount")
          .gte("sold_at", `${today}T00:00:00`)
          .lt("sold_at", `${today}T23:59:59.999`),
        supabase
          .from("produk_koperasi")
          .select("id, name, stock, min_stock")
          .or("is_active.is.null,is_active.eq.true"),
        supabase
          .from("jurnal_kas")
          .select("id, category, type, description, proof_number, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const referencedSantriIds = Array.from(
        new Set([
          ...(recentJournals.data ?? []).map((j) => j.santri_id),
          ...(recentPermits.data ?? []).map((p) => p.santri_id),
          ...(activePermits.data ?? []).map((p) => p.santri_id),
        ]),
      ).filter(Boolean);

      let studentNames = new Map<string, string>();
      if (referencedSantriIds.length > 0) {
        const { data: studentsData } = await supabase
          .from("santri")
          .select("id, nama_lengkap")
          .in("id", referencedSantriIds);

        studentNames = new Map(
          ((studentsData ?? []) as Array<{ id: string; nama_lengkap: string }>).map((s) => [s.id, s.nama_lengkap]),
        );
      }

      const accounts = ((cashAccountsResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((account) => ({
        name: String(account.name ?? "Kas"),
        balance: Number(account.balance ?? 0),
      }));
      const totalCash = cashAccountsResult.error ? null : accounts.reduce((sum, acc) => sum + acc.balance, 0);

      const sales = (salesToday.data ?? []) as unknown as Array<Record<string, unknown>>;
      const totalSales = {
        total: sales.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0),
        count: sales.length,
      };

      const rawStockProducts = (stockProducts.data ?? []) as unknown as Array<Record<string, unknown>>;
      const rawActivePermits = (activePermits.data ?? []) as unknown as Array<Record<string, unknown>>;

      const nextAlerts: OpsAlert[] = [
        ...buildStockAlerts(rawStockProducts).map((alert) => ({
          id: alert.id,
          title: alert.title,
          detail: alert.description,
          badge: alert.badge,
          tone: alert.tone,
          href: alert.href,
        })),
        ...buildPermitAlerts(rawActivePermits, studentNames).map((alert) => ({
          id: alert.id,
          title: alert.title,
          detail: alert.description,
          badge: alert.badge,
          tone: alert.tone,
          href: alert.href,
        })),
      ].sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));

      const journalActivities: Activity[] = (recentJournals.data ?? []).map((journal) => ({
        id: `journal-${journal.id}`,
        name: studentNames.get(journal.santri_id) ?? "Santri",
        action:
          journal.kategori_jurnal === "quran"
            ? `Setoran ${journal.mode_setoran ? `${journal.mode_setoran} ` : ""}Al-Qur’an`
            : journal.kategori_jurnal === "matan"
              ? "Hafalan matan kitab"
              : "Sorogan kitab",
        detail: journalDetail(journal),
        timestamp: journal.created_at,
        status: journal.predikat ?? "Tercatat",
        tone: "keilmuan",
        href: "/keilmuan",
      }));

      const permitActivities: Activity[] = (recentPermits.data ?? []).map((permit: Partial<Permit> & { id: string; created_at: string; santri_id: string }) => ({
        id: `permit-${permit.id}`,
        name: studentNames.get(permit.santri_id) ?? "Santri",
        action: "Izin keluar pondok",
        detail: `${permit.alasan_izin ?? "Keperluan pribadi"}${permit.batas_kembali ? ` · batas ${formatTime(permit.batas_kembali)}` : ""}`,
        timestamp: permit.created_at,
        status: permitStatus(permit.status ?? "", permit.kedatangan_aktual ?? null),
        tone: "perizinan",
        href: "/perizinan",
      }));

      const cashActivities: Activity[] = ((recentCash.data ?? []) as CashEntry[]).map((entry) => ({
        id: `cash-${entry.id}`,
        name: entry.category || "Kas pondok",
        action: entry.type === "kredit" ? "Penerimaan kas" : "Pengeluaran kas",
        detail: entry.description || entry.proof_number || "Mutasi tercatat",
        timestamp: entry.created_at,
        status: entry.type === "kredit" ? "Masuk" : "Keluar",
        tone: "keuangan",
        href: "/keuangan",
      }));

      const combinedActivities = [...journalActivities, ...permitActivities, ...cashActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);

      setData({
        activeStudents: studentCount.count ?? 0,
        studentsOut: outsideCount.count ?? 0,
        todayJournals: journalCount.count ?? 0,
        todaySales: totalSales,
        cashBalance: totalCash,
        cashAccounts: accounts,
        activities: combinedActivities,
        opsAlerts: nextAlerts,
      });

      setMessage("");
    } catch (err) {
      console.error("Gagal sinkronisasi data dashboard:", err);
      setMessage("Sebagian data gagal diperbarui secara real-time.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentDateStr) {
      void loadDashboardData(currentDateStr);
    }
  }, [currentDateStr, alertsRefreshToken, loadDashboardData]);

  const metrics: Metric[] = useMemo(
    () => [
      {
        label: "Santri Aktif",
        value: String(data.activeStudents),
        detail: "Status aktif induk",
        icon: "users",
        color: "bg-[#eef0ff]",
        iconColor: "text-[#4457ff]",
        href: "/santri",
      },
      {
        label: "Santri Izin",
        value: String(data.studentsOut),
        detail: data.studentsOut > 0 ? "Di luar pondok" : "Semua di pondok",
        icon: "shield",
        color: data.studentsOut > 0 ? "bg-[#fff4e7]" : "bg-slate-50",
        iconColor: data.studentsOut > 0 ? "text-[#bd7627]" : "text-slate-400",
        href: "/perizinan",
        highlight: data.studentsOut > 0,
      },
      {
        label: "Setoran Hari Ini",
        value: String(data.todayJournals),
        detail: "Jurnal santri hari ini",
        icon: "book",
        color: "bg-[#f4ebff]",
        iconColor: "text-[#8a50c7]",
        href: "/keilmuan",
      },
      {
        label: "Omzet Koperasi",
        value: formatRupiah(data.todaySales.total),
        detail: `${data.todaySales.count} transaksi hari ini`,
        icon: "store",
        color: "bg-[#e8f5f0]",
        iconColor: "text-[#25815e]",
        href: "/koperasi",
      },
    ],
    [data.activeStudents, data.studentsOut, data.todayJournals, data.todaySales],
  );

  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return data.activities;
    return data.activities.filter((item) => item.tone === activityFilter);
  }, [activityFilter, data.activities]);

  const dangerCount = useMemo(
    () => data.opsAlerts.filter((item) => item.tone === "danger").length,
    [data.opsAlerts],
  );

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-3 px-2.5 py-3 sm:space-y-6 sm:px-6 sm:py-6">
      {/* 1. KARTU SALAM */}
      <section className="flex w-full min-w-0 flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold tracking-tight text-slate-800 sm:text-2xl">
            Assalamu’alaikum, {userName || "Ustadz Admin"} 👋
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 sm:text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <Icon name="calendar-days" size={13} className="text-slate-400" />
              {currentDateStr ? formatDate(currentDateStr) : "Memuat tanggal…"}
            </span>
            <span className="hidden text-slate-300 sm:inline">•</span>
            <span className="text-slate-400">Sinkronisasi otomatis Supabase</span>
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 sm:self-auto sm:text-[11px]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Data langsung
        </div>
      </section>

      {message && <FormMessage>{message}</FormMessage>}

      {/* 2. KARTU METRIK RINGKASAN */}
      <section aria-label="Ringkasan pesantren" className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="group min-w-0">
            <article
              className={`flex h-full min-w-0 flex-col justify-between rounded-xl border bg-white p-3 shadow-sm transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md sm:rounded-2xl sm:p-4 ${
                metric.highlight ? "border-amber-300 bg-amber-50/20" : "border-slate-200/80"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{metric.label}</p>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8 sm:rounded-xl ${metric.color} ${metric.iconColor}`}
                >
                  <Icon name={metric.icon} size={14} />
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <p className="truncate text-base font-bold leading-none tabular-nums tracking-tight text-slate-800 sm:text-2xl">
                  {isLoading ? "…" : metric.value}
                </p>
                <p className="mt-1 hidden truncate text-[10px] text-slate-400 sm:block sm:text-[11px]">
                  {metric.detail}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </section>

      {/* 3. GRID BAWAH: PANTAUAN OPERASIONAL & AKTIVITAS TERKINI */}
      <section className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12">
        {/* PANTAUAN OPERASIONAL */}
        <article className="flex w-full min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold tracking-tight text-slate-800 sm:text-base">
                Pantauan Operasional
              </h2>
              <p className="truncate text-[11px] text-slate-500">Peringatan dan status kas hari ini</p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:size-9">
              <Icon name="alert-triangle" size={16} />
            </span>
          </div>

          <div className="mt-3.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perlu perhatian</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold sm:text-[10px] ${
                  data.opsAlerts.length ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {data.opsAlerts.length ? `${data.opsAlerts.length} peringatan` : "Aman"}
              </span>
            </div>

            <div className="mt-2 space-y-2">
              {isLoading ? (
                <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                  Memeriksa data operasional…
                </p>
              ) : data.opsAlerts.length ? (
                data.opsAlerts.slice(0, 4).map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl border-l-2 p-2.5 transition hover:bg-slate-50 ${
                      alert.tone === "danger"
                        ? "border-red-500 bg-red-50/40"
                        : "border-amber-500 bg-amber-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${
                        alert.tone === "danger" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <Icon name="alert-triangle" size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-xs font-semibold text-slate-800">{alert.title}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            alert.tone === "danger"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {alert.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-slate-500">
                        {alert.detail}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/60 p-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">Semua terkendali</p>
                    <p className="text-[11px] text-emerald-700/80">Tidak ada stok kritis atau izin terlewat.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STATUS KAS */}
          <div className="mt-4 border-t border-slate-100 pt-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status kas</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 sm:text-xl">
                  {data.cashBalance === null ? "—" : formatRupiah(data.cashBalance)}
                </p>
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon name="wallet" size={15} />
              </span>
            </div>

            <div className="mt-2.5 space-y-2">
              {data.cashAccounts.length ? (
                data.cashAccounts.slice(0, 4).map((account) => {
                  const pct =
                    data.cashBalance && data.cashBalance > 0
                      ? Math.round((account.balance / data.cashBalance) * 100)
                      : 0;
                  return (
                    <div key={account.name} className="min-w-0">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="truncate text-slate-600">{account.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                          {formatRupiah(account.balance)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#4457ff]"
                            style={{ width: `${Math.min(100, Math.max(pct, 2))}%` }}
                          />
                        </div>
                        <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-slate-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-400">Belum ada rekening kas aktif.</p>
              )}
            </div>

            <Link
              href="/keuangan"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4457ff] hover:underline"
            >
              Kelola keuangan <Icon name="arrow-right" size={12} />
            </Link>
          </div>
        </article>

        {/* AKTIVITAS TERKINI */}
        <article className="flex w-full min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-5 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold tracking-tight text-slate-800 sm:text-base">
                Aktivitas Terkini
              </h2>
              <p className="truncate text-[11px] text-slate-500">Setoran, perizinan, dan mutasi kas real-time</p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff] sm:size-9">
              <Icon name="clock" size={16} />
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActivityFilter(option.value)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition sm:text-[11px] ${
                  activityFilter === option.value
                    ? "bg-[#4457ff] text-white shadow-sm"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-2.5 max-h-[380px] divide-y divide-slate-100 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {isLoading ? (
              <p className="py-12 text-center text-xs text-slate-400">Memuat aktivitas terbaru…</p>
            ) : filteredActivities.length ? (
              filteredActivities.map((activity) => {
                const styles = toneStyles[activity.tone];
                return (
                  <Link
                    key={activity.id}
                    href={activity.href}
                    className="flex w-full min-w-0 items-start gap-2.5 py-2.5 transition hover:bg-slate-50/70 sm:py-3"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:size-9 sm:text-[11px] ${styles.avatar}`}
                    >
                      {initialsOf(activity.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-800">{activity.name}</p>
                        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                          {timeAgo(activity.timestamp)}
                        </span>
                      </div>
                      <p className={`truncate text-[11px] font-medium ${styles.labelType}`}>{activity.action}</p>
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        <p className="truncate text-[10px] text-slate-500 sm:text-[11px]">{activity.detail}</p>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${styles.badge}`}
                        >
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Icon name="clock" size={18} />
                </span>
                <p className="mt-2 text-xs font-semibold text-slate-700">Belum ada aktivitas</p>
                <p className="text-[11px] text-slate-400">Belum ada catatan aktivitas baru.</p>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400">{filteredActivities.length} aktivitas ditampilkan</span>
            <Link
              href={
                activityFilter === "keuangan"
                  ? "/keuangan"
                  : activityFilter === "perizinan"
                    ? "/perizinan"
                    : "/keilmuan"
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4457ff] hover:underline"
            >
              Buka modul <Icon name="arrow-right" size={12} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}