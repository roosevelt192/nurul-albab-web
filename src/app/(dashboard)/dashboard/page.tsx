"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function journalDetail(journal: Journal) {
  if (journal.kategori_jurnal === "quran") {
    const surahRange =
      journal.surah_awal_number &&
      journal.surah_akhir_number &&
      journal.surah_awal_number !== journal.surah_akhir_number
        ? ` · ${journal.surah_awal_number}–${journal.surah_akhir_number}`
        : "";
    const verseRange =
      journal.ayat_awal === null
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
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [userName, setUserName] = useState("");

  const [activeStudents, setActiveStudents] = useState(0);
  const [studentsOut, setStudentsOut] = useState(0);
  const [todayJournals, setTodayJournals] = useState(0);
  const [todaySales, setTodaySales] = useState({ total: 0, count: 0 });
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [cashAccounts, setCashAccounts] = useState<Array<{ name: string; balance: number }>>([]);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [opsAlerts, setOpsAlerts] = useState<OpsAlert[]>([]);
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
    const timer = window.setTimeout(() => {
      const currentDate = todayLocal();
      setToday(currentDate);
      setDate(formatDate(currentDate));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
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

  useEffect(() => {
    if (!today) return;
    let active = true;

    async function loadDashboardData() {
      setIsLoading(true);
      const supabase = createClient();

      const [
        studentCount,
        outsideCount,
        journalCount,
        recentJournals,
        recentPermits,
        activePermits,
        recentStudents,
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
        supabase.from("jurnal_keilmuan").select("*").limit(10),
        supabase
          .from("perizinan_santri")
          .select("id, santri_id, tanggal_keluar, batas_kembali, kedatangan_aktual, alasan_izin, penjemput, status, created_at")
          .limit(10),
        supabase
          .from("perizinan_santri")
          .select("id, santri_id, batas_kembali, alasan_izin, kedatangan_aktual, status, created_at")
          .is("kedatangan_aktual", null)
          .limit(30),
        supabase.from("santri").select("id, nama_lengkap").limit(1000),
        supabase.from("rekening_kas").select("name, balance").eq("is_active", true),
        supabase
          .from("transaksi_penjualan")
          .select("total_amount, sold_at")
          .gte("sold_at", `${today}T00:00:00`)
          .lt("sold_at", `${today}T23:59:59.999`),
        supabase
          .from("produk_koperasi")
          .select("*")
          .or("is_active.is.null,is_active.eq.true"),
        supabase.from("jurnal_kas").select("*").limit(8),
      ]);

      const errors = [
        studentCount.error && { resource: "santri KPI", error: studentCount.error },
        outsideCount.error && { resource: "perizinan KPI", error: outsideCount.error },
        journalCount.error && { resource: "jurnal KPI", error: journalCount.error },
        recentJournals.error && { resource: "jurnal terbaru", error: recentJournals.error },
        recentPermits.error && { resource: "perizinan terbaru", error: recentPermits.error },
        activePermits.error && { resource: "perizinan aktif", error: activePermits.error },
        recentStudents.error && { resource: "nama santri", error: recentStudents.error },
        cashAccountsResult.error && { resource: "saldo rekening kas", error: cashAccountsResult.error },
        salesToday.error && { resource: "omzet kasir hari ini", error: salesToday.error },
        stockProducts.error && { resource: "stok koperasi", error: stockProducts.error },
        recentCash.error && { resource: "jurnal kas", error: recentCash.error },
      ].filter(
        (entry): entry is { resource: string; error: NonNullable<typeof studentCount.error> } => Boolean(entry),
      );

      for (const entry of errors) {
        console.error("Failed to load dashboard data from Supabase.", {
          resource: entry.resource,
          code: entry.error.code,
          message: entry.error.message,
          details: entry.error.details,
          hint: entry.error.hint,
        });
      }

      if (!active) return;

      setActiveStudents(studentCount.error ? 0 : studentCount.count ?? 0);
      setStudentsOut(outsideCount.error ? 0 : outsideCount.count ?? 0);
      setTodayJournals(journalCount.error ? 0 : journalCount.count ?? 0);

      if (cashAccountsResult.error) {
        setCashBalance(null);
        setCashAccounts([]);
      } else {
        const accounts = ((cashAccountsResult.data ?? []) as Array<Record<string, unknown>>).map((account) => ({
          name: String(account.name ?? "Kas"),
          balance: Number(account.balance ?? 0),
        }));
        setCashAccounts(accounts);
        setCashBalance(accounts.reduce((sum, account) => sum + account.balance, 0));
      }

      if (salesToday.error) {
        setTodaySales({ total: 0, count: 0 });
      } else {
        const sales = (salesToday.data ?? []) as Array<Record<string, unknown>>;
        setTodaySales({
          total: sales.reduce((sum, sale) => sum + Number(sale.total_amount ?? 0), 0),
          count: sales.length,
        });
      }

      const studentNames = new Map(
        ((recentStudents.data ?? []) as Array<{ id: string; nama_lengkap: string }>).map((student) => [
          student.id,
          student.nama_lengkap,
        ]),
      );

      // ---- Pantauan operasional: stok menipis + izin terlewat ----
      const nextAlerts: OpsAlert[] = [
        ...buildStockAlerts(
          (stockProducts.data ?? []) as Array<Record<string, unknown>>,
        ).map((alert) => ({
          id: alert.id,
          title: alert.title,
          detail: alert.description,
          badge: alert.badge,
          tone: alert.tone,
          href: alert.href,
        })),
        ...buildPermitAlerts(
          (activePermits.data ?? []) as Array<Record<string, unknown>>,
          studentNames,
        ).map((alert) => ({
          id: alert.id,
          title: alert.title,
          detail: alert.description,
          badge: alert.badge,
          tone: alert.tone,
          href: alert.href,
        })),
      ];

      nextAlerts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
      setOpsAlerts(nextAlerts);

      // ---- Feed aktivitas: keilmuan, perizinan, keuangan ----
      const sortByCreatedAtDesc = <T extends { created_at?: string | null }>(rows: T[]): T[] =>
        [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""), "id-ID"));

      const journalActivities: Activity[] = sortByCreatedAtDesc(recentJournals.data ?? []).map((journal) => ({
        id: `journal-${journal.id}`,
        name: studentNames.get(journal.santri_id) ?? "Santri tidak ditemukan",
        action:
          journal.kategori_jurnal === "quran"
            ? `Menyetorkan ${journal.mode_setoran ? `${journal.mode_setoran} ` : ""}Al-Qur’an`
            : journal.kategori_jurnal === "matan"
              ? "Hafalan matan kitab"
              : "Sorogan kitab",
        detail: journalDetail(journal),
        timestamp: journal.created_at,
        status: journal.predikat ?? "Tercatat",
        tone: "keilmuan",
        href: "/keilmuan",
      }));

      const permitActivities: Activity[] = sortByCreatedAtDesc(recentPermits.data ?? []).map((permit: Permit) => ({
        id: `permit-${permit.id}`,
        name: studentNames.get(permit.santri_id) ?? "Santri tidak ditemukan",
        action: "Pengajuan izin keluar",
        detail: `${permit.alasan_izin}${permit.batas_kembali ? ` · batas kembali ${formatTime(permit.batas_kembali)}` : ""}`,
        timestamp: permit.created_at,
        status: permitStatus(permit.status, permit.kedatangan_aktual),
        tone: "perizinan",
        href: "/perizinan",
      }));

      const cashActivities: Activity[] = sortByCreatedAtDesc((recentCash.data ?? []) as CashEntry[]).map((entry) => ({
        id: `cash-${entry.id}`,
        name: entry.category || "Kas pondok",
        action: entry.type === "kredit" ? "Penerimaan kas" : "Pengeluaran kas",
        detail: entry.description || entry.proof_number,
        timestamp: entry.created_at,
        status: entry.type === "kredit" ? "Masuk" : "Keluar",
        tone: "keuangan",
        href: "/keuangan",
      }));

      setActivities(
        [...journalActivities, ...permitActivities, ...cashActivities]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 18),
      );

      setMessage(
        errors.length
          ? `Sebagian data dashboard gagal dimuat: ${errors.map((entry) => entry.error.message).join(" · ")}`
          : "",
      );
      setIsLoading(false);
    }

    void loadDashboardData().catch((error: unknown) => {
      console.error("Unexpected failure while loading dashboard metrics.", error);
      if (active) {
        setMessage(error instanceof Error ? error.message : "Dashboard gagal memuat data.");
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [today, alertsRefreshToken]);

  const metrics: Metric[] = [
    {
      label: "Santri Aktif",
      value: String(activeStudents),
      detail: "Status aktif dari data induk",
      icon: "users",
      color: "bg-[#eef0ff]",
      iconColor: "text-[#4457ff]",
      href: "/santri",
    },
    {
      label: "Santri Izin Keluar",
      value: String(studentsOut),
      detail: studentsOut > 0 ? "Perlu dipantau kepulangannya" : "Tidak ada santri di luar",
      icon: "shield",
      color: studentsOut > 0 ? "bg-[#fff4e7]" : "bg-slate-100",
      iconColor: studentsOut > 0 ? "text-[#bd7627]" : "text-slate-500",
      href: "/perizinan",
      highlight: studentsOut > 0,
    },
    {
      label: "Setoran Hari Ini",
      value: String(todayJournals),
      detail: "Jurnal keilmuan tercatat hari ini",
      icon: "book",
      color: "bg-[#f4ebff]",
      iconColor: "text-[#8a50c7]",
      href: "/keilmuan",
    },
    {
      label: "Omzet Koperasi",
      value: formatRupiah(todaySales.total),
      detail: `${todaySales.count} transaksi hari ini`,
      icon: "store",
      color: "bg-[#e8f5f0]",
      iconColor: "text-[#25815e]",
      href: "/koperasi",
    },
  ];

  const filteredActivities =
    activityFilter === "all" ? activities : activities.filter((activity) => activity.tone === activityFilter);

  const dangerCount = opsAlerts.filter((alert) => alert.tone === "danger").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
            Assalamu’alaikum, {userName || "Ustadz Admin"} 👋
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar-days" size={14} className="text-slate-400" />
              {date || "Memuat tanggal…"}
            </span>
            <span className="hidden text-slate-300 sm:inline">•</span>
            <span className="text-slate-400">Sinkronisasi otomatis dengan Supabase</span>
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Data langsung
        </div>
      </section>

      {message && <FormMessage>{message}</FormMessage>}

      {/* Metric cards */}
      <section aria-label="Ringkasan pesantren" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="h-full">
            <article
              className={`flex h-full flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                metric.highlight ? "border-amber-200" : "border-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">{metric.label}</p>
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 ${metric.color} ${metric.iconColor}`}
                >
                  <Icon name={metric.icon} size={17} />
                </span>
              </div>
              <p className="mt-3 truncate text-[19px] font-bold leading-tight tabular-nums tracking-tight text-slate-800 sm:text-2xl">
                {isLoading ? "…" : metric.value}
              </p>
              <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">{metric.detail}</p>
            </article>
          </Link>
        ))}
      </section>

      {/* Main grid */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Operational monitoring */}
        <article className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800">Pantauan Operasional</h2>
              <p className="mt-1 text-xs text-slate-500">Peringatan dan status kas hari ini</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#fff4e7] text-[#bd7627]">
              <Icon name="alert-triangle" size={17} />
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Perlu perhatian</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  opsAlerts.length ? "bg-[#fff0f0] text-[#b74444]" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {opsAlerts.length ? `${opsAlerts.length} peringatan` : "Aman"}
              </span>
            </div>

            <div className="mt-2 space-y-2">
              {isLoading ? (
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                  Memeriksa data operasional…
                </p>
              ) : opsAlerts.length ? (
                opsAlerts.slice(0, 4).map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className={`flex items-start gap-2.5 rounded-xl border-l-2 p-2.5 transition hover:bg-slate-50 ${
                      alert.tone === "danger"
                        ? "border-red-400 bg-red-50/50"
                        : "border-amber-400 bg-amber-50/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                        alert.tone === "danger" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      <Icon name="alert-triangle" size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-slate-700">{alert.title}</span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            alert.tone === "danger"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {alert.badge}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{alert.detail}</span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/60 p-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Semua terkendali</p>
                    <p className="mt-0.5 text-[11px] text-emerald-700/80">
                      Tidak ada stok kritis atau izin terlewat.
                    </p>
                  </div>
                </div>
              )}
              {opsAlerts.length > 4 && (
                <Link
                  href="/koperasi/stok"
                  className="block px-1 text-[11px] font-semibold text-[#4457ff] hover:underline"
                >
                  Lihat {opsAlerts.length - 4} peringatan lainnya
                </Link>
              )}
              {dangerCount > 0 && (
                <p className="px-1 text-[10px] text-slate-400">{dangerCount} butuh tindakan segera.</p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Status kas</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-800">
                  {cashBalance === null ? "—" : formatRupiah(cashBalance)}
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#e8f5f0] text-[#25815e]">
                <Icon name="wallet" size={17} />
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {cashAccounts.length ? (
                cashAccounts.slice(0, 5).map((account) => {
                  const pct =
                    cashBalance && cashBalance > 0 ? Math.round((account.balance / cashBalance) * 100) : 0;
                  return (
                    <div key={account.name}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-600">{account.name}</p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                          {formatRupiah(account.balance)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#4457ff]"
                            style={{ width: `${Math.min(100, Math.max(pct, 2))}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] tabular-nums text-slate-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">Belum ada rekening kas aktif.</p>
              )}
            </div>

            <Link
              href="/keuangan"
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4457ff] hover:underline"
            >
              Kelola keuangan <Icon name="arrow-right" size={13} />
            </Link>
          </div>
        </article>

        {/* Activity feed */}
        <article className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:col-span-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800">Aktivitas Terkini</h2>
              <p className="mt-1 text-xs text-slate-500">Setoran, perizinan, dan mutasi kas terbaru</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]">
              <Icon name="clock" size={17} />
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActivityFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  activityFilter === option.value
                    ? "bg-[#4457ff] text-white shadow-sm"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[420px] divide-y divide-slate-100 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {isLoading ? (
              <p className="py-10 text-center text-xs text-slate-400">Memuat aktivitas dari Supabase…</p>
            ) : filteredActivities.length ? (
              filteredActivities.map((activity) => {
                const styles = toneStyles[activity.tone];
                return (
                  <Link
                    key={activity.id}
                    href={activity.href}
                    className="flex items-start gap-3 py-3 transition hover:bg-slate-50/70"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${styles.avatar}`}
                    >
                      {initialsOf(activity.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                        <p className="truncate text-xs font-semibold text-slate-800">{activity.name}</p>
                        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                          {timeAgo(activity.timestamp)}
                        </span>
                      </div>
                      <p className={`mt-0.5 truncate text-[11px] font-medium ${styles.labelType}`}>
                        {activity.action}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{activity.detail}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${styles.badge}`}
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
                <span className="flex size-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Icon name="clock" size={22} />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada aktivitas</p>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Aktivitas akan tampil setelah ada setoran, izin, atau mutasi kas yang dicatat.
                </p>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-[10px] text-slate-400">{filteredActivities.length} aktivitas terbaru</p>
            <Link
              href={activityFilter === "keuangan" ? "/keuangan" : activityFilter === "perizinan" ? "/perizinan" : "/keilmuan"}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4457ff] hover:underline"
            >
              Lihat semua <Icon name="arrow-right" size={13} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
