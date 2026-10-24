"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CooperativeNav } from "@/components/cooperative-nav";
import { Icon } from "@/components/icon";
import { FormMessage, MetricCard, PageHeading, PillTabs, StatusBadge } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Sale = Database["public"]["Tables"]["transaksi_penjualan"]["Row"];
type SaleLine = Database["public"]["Tables"]["transaksi_penjualan_detail"]["Row"];
type Period = "today" | "week" | "month" | "all" | "custom";
const shuAllocations = [
  { label: "Subsidi operasional pondok", percent: 40, color: "bg-[#4457ff]", tone: "text-[#4457ff]" },
  { label: "Tambahan modal koperasi", percent: 30, color: "bg-[#7583fd]", tone: "text-[#5d69d7]" },
  { label: "Cadangan sarana prasarana", percent: 20, color: "bg-[#8eb9a7]", tone: "text-[#25815e]" },
  { label: "Insentif pengelola", percent: 10, color: "bg-[#e4b66f]", tone: "text-[#a6641c]" },
];

function localDate() {
  return dateInJakarta(new Date().toISOString());
}

function dateInJakarta(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function CooperativeReportPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [cashiers, setCashiers] = useState<Map<string, string>>(new Map());
  const [period, setPeriod] = useState<Period>("month");
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [today, setToday] = useState("");
  const [referenceTime, setReferenceTime] = useState(0);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToday(localDate());
      setReferenceTime(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const [saleResult, detailResult] = await Promise.all([
      supabase.from("transaksi_penjualan").select("*"),
      supabase.from("transaksi_penjualan_detail").select("*"),
    ]);
    if (saleResult.error || detailResult.error) {
      if (saleResult.error) console.error("Could not load cooperative sales.", {
        code: saleResult.error.code, message: saleResult.error.message, details: saleResult.error.details, hint: saleResult.error.hint,
      });
      if (detailResult.error) console.error("Could not load cooperative sale details.", {
        code: detailResult.error.code, message: detailResult.error.message, details: detailResult.error.details, hint: detailResult.error.hint,
      });
      setMessage(`Laporan penjualan gagal dimuat: ${[saleResult.error?.message, detailResult.error?.message].filter(Boolean).join(" · ")}`);
      setIsLoading(false);
      return;
    }
    const loadedSales = saleResult.data ?? [];
    const cashierIds = [...new Set(loadedSales.map((sale) => sale.cashier_id).filter((id): id is string => Boolean(id)))];
    let cashierNames = new Map<string, string>();
    if (cashierIds.length) {
      const { data, error } = await supabase.rpc("cooperative_profile_names", { p_profile_ids: cashierIds });
      if (error) {
        console.error("Could not load cashier names for cooperative report.", {
          code: error.code, message: error.message, details: error.details, hint: error.hint,
        });
        setMessage(`Nama kasir tidak dapat dimuat: ${error.message}`);
      } else {
        cashierNames = new Map((data ?? []).map((profile) => [profile.id, profile.nama_lengkap]));
        setMessage("");
      }
    } else setMessage("");
    const sortedSales = (loadedSales ?? []).sort(
      (a, b) =>
        String(b.sold_at ?? b.created_at ?? "").localeCompare(
          String(a.sold_at ?? a.created_at ?? ""),
          "id-ID",
        ),
    );
    const sortedDetails = (detailResult.data ?? []).sort(
      (a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""), "id-ID"),
    );
    setSales(sortedSales);
    setSaleLines(sortedDetails);
    setCashiers(cashierNames);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSales().catch((error: unknown) => {
        console.error("Unexpected failure loading cooperative report.", error);
        setMessage(error instanceof Error ? error.message : "Laporan koperasi gagal dimuat.");
        setIsLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSales]);

  const filteredSales = useMemo(() => sales.filter((sale) => {
    if (period === "all") return true;
    if (period === "week") {
      const timestamp = sale.created_at ?? sale.sold_at;
      return referenceTime > 0 && Boolean(timestamp) &&
        new Date(timestamp).getTime() >= referenceTime - 7 * 24 * 60 * 60 * 1000;
    }
    if (period === "custom") {
      if (!appliedRange) return false;
      const soldDate = dateInJakarta(sale.sold_at);
      return soldDate >= appliedRange.start && soldDate <= appliedRange.end;
    }
    if (!today) return false;
    const soldDate = dateInJakarta(sale.sold_at);
    if (period === "today") return soldDate === today;
    if (period === "month") return soldDate.slice(0, 7) === today.slice(0, 7);
    return true;
  }), [appliedRange, period, referenceTime, sales, today]);
  const revenue = filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const cost = filteredSales.reduce((sum, sale) => sum + Number(sale.total_cost), 0);
  const profit = revenue - cost;
  const linesBySale = useMemo(() => {
    const map = new Map<string, SaleLine[]>();
    for (const line of saleLines) {
      map.set(line.sale_id, [...(map.get(line.sale_id) ?? []), line]);
    }
    return map;
  }, [saleLines]);

  const periodOptions = [
    { value: "today" as const, label: "Hari Ini" },
    { value: "week" as const, label: "Minggu Ini" },
    { value: "month" as const, label: "Bulan Ini" },
    { value: "all" as const, label: "Semua" },
    { value: "custom" as const, label: "Rentang Kustom" },
  ];

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setMessage("Pilih rentang tanggal yang valid; tanggal mulai harus sebelum atau sama dengan tanggal akhir.");
      return;
    }
    setAppliedRange({ start: rangeStart, end: rangeEnd });
    setPeriod("custom");
    setMessage("");
  }

  const periodLabel = period === "today"
    ? "hari ini"
    : period === "week"
      ? "7 hari terakhir"
      : period === "month"
        ? "bulan ini"
        : period === "custom" && appliedRange
          ? `${appliedRange.start} – ${appliedRange.end}`
          : "semua periode";

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Koperasi pesantren" title="Laporan penjualan & SHU" description="Pantau omzet, modal barang terjual, dan laba kotor dari transaksi kasir tersimpan." />
      <CooperativeNav active="/koperasi/laporan" />
      {message && <FormMessage>{message}</FormMessage>}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-bold">Periode laporan</h2><p className="mt-1 text-[11px] text-[#757693]">Ringkasan dihitung berdasarkan waktu transaksi kasir.</p></div>
          <PillTabs label="Periode laporan SHU" value={period} options={periodOptions} onChange={setPeriod} />
        </div>
        {period === "custom" && (
          <form onSubmit={applyCustomRange} className="grid gap-3 border-t border-[#f0f0f5] pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold text-[#55566f]">Tanggal Mulai
              <input type="date" required value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#4457ff]" />
            </label>
            <label className="text-xs font-semibold text-[#55566f]">Tanggal Akhir
              <input type="date" required min={rangeStart || undefined} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#4457ff]" />
            </label>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-5 text-xs font-semibold text-white transition hover:-translate-y-0.5">
              Terapkan Filter
            </button>
          </form>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Omzet penjualan" value={formatRupiah(revenue)} detail={`${filteredSales.length} transaksi · ${periodLabel}`} icon="store" />
        <MetricCard label="Total HPP / modal" value={formatRupiah(cost)} detail="Harga modal snapshot item terjual" icon="wallet" tone="bg-[#fff4e7] text-[#bd7627]" />
        <MetricCard label="Laba kotor / SHU" value={formatRupiah(profit)} detail="Omzet dikurangi total HPP" icon="trending-up" tone="bg-[#e8f5f0] text-[#25815e]" />
      </section>
      <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold">Estimasi pembagian SHU</h2><p className="mt-1 text-xs text-[#757693]">Simulasi pembagian berdasarkan laba kotor pada periode terpilih.</p></div><StatusBadge label="Rasio 100%" tone="bg-[#eef0ff] text-[#4457ff]" /></div>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#f0f0f5]">{shuAllocations.map((allocation) => <span key={allocation.label} className={`${allocation.color} transition-all`} style={{ width: `${allocation.percent}%` }} title={`${allocation.label}: ${allocation.percent}%`} />)}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shuAllocations.map((allocation) => <div key={allocation.label} className="rounded-2xl bg-[#f8f9ff] p-4"><p className={`text-xs font-bold ${allocation.tone}`}>{allocation.percent}%</p><p className="mt-1 min-h-8 text-[10px] leading-4 text-[#757693]">{allocation.label}</p><p className="mt-2 text-sm font-bold tabular-nums">{formatRupiah(Math.round(profit * allocation.percent / 100))}</p></div>)}</div>
      </section>
      <section className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 className="text-base font-bold">Riwayat transaksi</h2><p className="mt-1 text-xs text-[#757693]">Pilih transaksi untuk melihat rincian barang dan perhitungan HPP.</p></div><StatusBadge label={`${filteredSales.length} transaksi`} tone="bg-[#eef0ff] text-[#4457ff]" /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left">
          <thead><tr className="border-y border-[#e5e7eb] bg-[#fafaff] text-[10px] font-semibold uppercase tracking-wider text-[#8a8ba2]"><th className="px-5 py-3">Nomor transaksi</th><th className="px-5 py-3">Tanggal / waktu</th><th className="px-5 py-3">Kasir / pembeli</th><th className="px-5 py-3">Total belanja</th><th className="px-5 py-3">HPP</th><th className="px-5 py-3">Laba kotor</th><th className="px-5 py-3">Rincian</th></tr></thead>
          <tbody>{filteredSales.map((sale) => {
            const expanded = expandedSale === sale.id;
            const lines = linesBySale.get(sale.id) ?? [];
            return <Fragment key={sale.id}>
              <tr className="border-b border-[#f0f0f5] transition hover:bg-[#fafaff]">
                <td className="px-5 py-4 text-xs font-semibold tabular-nums">{sale.receipt_number}</td>
                <td className="px-5 py-4 text-xs text-[#757693]">{formatDateTime(sale.sold_at)}</td>
                <td className="px-5 py-4"><span className="block text-xs font-medium">{sale.cashier_id ? cashiers.get(sale.cashier_id) ?? "Kasir" : "Kasir"}</span><span className="mt-1 block text-[10px] text-[#8a8ba2]">{sale.customer_name ?? "Pelanggan Umum"}</span></td>
                <td className="px-5 py-4 text-xs font-bold tabular-nums">{formatRupiah(Number(sale.total_amount))}</td>
                <td className="px-5 py-4 text-xs tabular-nums text-[#757693]">{formatRupiah(Number(sale.total_cost))}</td>
                <td className="px-5 py-4 text-xs font-semibold tabular-nums text-[#25815e]">{formatRupiah(Number(sale.gross_profit))}</td>
                <td className="px-5 py-4"><button type="button" aria-expanded={expanded} onClick={() => setExpandedSale(expanded ? null : sale.id)} className="inline-flex min-h-10 items-center gap-1 rounded-full bg-[#eef0ff] px-3 text-[10px] font-semibold text-[#4457ff]"><Icon name="file" size={14} />{expanded ? "Tutup" : `Detail (${lines.length})`}</button></td>
              </tr>
              {expanded && <tr className="border-b border-[#f0f0f5] bg-[#fafaff]"><td colSpan={7} className="px-5 py-4"><div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-[#f0f0f5] px-4 py-3 text-[9px] font-semibold uppercase text-[#8a8ba2]"><span>Produk / SKU</span><span>Qty</span><span>Harga</span><span>Subtotal / HPP</span></div>{lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-[#f0f0f5] px-4 py-3 text-[10px] last:border-0"><span><strong className="block">{line.product_name}</strong><span className="mt-1 block text-[#8a8ba2]">{line.sku}</span></span><span className="tabular-nums">{line.quantity}</span><span className="tabular-nums">{formatRupiah(Number(line.unit_price))}</span><span className="text-right tabular-nums">{formatRupiah(Number(line.subtotal))}<span className="mt-1 block text-[#8a8ba2]">HPP {formatRupiah(Number(line.unit_cost) * line.quantity)}</span></span></div>)}{!lines.length && <p className="px-4 py-5 text-center text-xs text-[#757693]">Detail item tidak tersedia.</p>}</div></td></tr>}
            </Fragment>;
          })}
          {!isLoading && !filteredSales.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#757693]">Belum ada transaksi pada periode ini.</td></tr>}
          {isLoading && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#757693]">Memuat laporan transaksi…</td></tr>}
          </tbody>
        </table></div>
      </section>
      <p className="text-[10px] leading-5 text-[#8a8ba2]">Estimasi laba kotor dihitung dari snapshot harga jual dikurangi harga modal pada saat transaksi. Pembagian SHU mengikuti rasio 40% subsidi pondok, 30% modal, 20% sarpras, dan 10% insentif.</p>
    </div>
  );
}
