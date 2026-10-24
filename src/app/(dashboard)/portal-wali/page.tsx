"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { formatRupiah } from "@/lib/format";
import { FormMessage, MetricCard, PageHeading, StatusBadge } from "@/components/workspace-ui";

const payments = [
  { id: "INV-2026-10-014", month: "Oktober 2026", amount: 635000, date: "03 Okt 2026", status: "Lunas" },
  { id: "INV-2026-09-014", month: "September 2026", amount: 635000, date: "04 Sep 2026", status: "Lunas" },
  { id: "INV-2026-08-014", month: "Agustus 2026", amount: 635000, date: "05 Agu 2026", status: "Lunas" },
];

function receiptContent(payment: (typeof payments)[number]) {
  return [
    "PONDOK PESANTREN NURUL ALBAB",
    "KUITANSI PEMBAYARAN IURAN SANTRI",
    "",
    `Nomor: ${payment.id}`,
    "Nama santri: Ahmad Rifqi Maulana",
    `Periode: ${payment.month}`,
    `Tanggal bayar: ${payment.date}`,
    `Jumlah: ${formatRupiah(payment.amount)}`,
    "Status: LUNAS",
    "",
    "Dokumen simulasi portal wali NAIS.",
  ].join("\n");
}

export default function PortalWaliPage() {
  const [selectedReceipt, setSelectedReceipt] = useState<(typeof payments)[number] | null>(null);
  const [message, setMessage] = useState("");

  function downloadReceipt(payment: (typeof payments)[number]) {
    const file = new Blob([receiptContent(payment)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${payment.id}-kuitansi.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Kuitansi ${payment.month} berhasil diunduh sebagai file simulasi.`);
  }

  return (
    <div className="mx-auto max-w-[1050px] space-y-6">
      <PageHeading eyebrow="Portal keluarga" title="Assalamu’alaikum, Ibu Salma" description="Ringkasan perkembangan dan administrasi putra Ibu di Pondok Pesantren Nurul Albab." />
      {message && <FormMessage success>{message}</FormMessage>}
      <section className="rounded-3xl border border-[#e5e7eb] bg-gradient-to-r from-[#eef0ff] to-white p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-bold text-[#4457ff]">AR</span>
          <div className="min-w-0 flex-1"><p className="text-xs font-medium text-[#757693]">Perkembangan putra Ibu</p><h2 className="mt-1 text-xl font-bold tracking-tight">Ahmad Rifqi Maulana</h2><p className="mt-1 text-xs text-[#757693]">NIS NA-2024-001 · Wustha 2 · Kamar Al-Farabi 1</p></div>
          <StatusBadge label="Santri aktif" tone="bg-[#e8f5f0] text-[#25815e]" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Progres hafalan" value="6 juz" detail="Dari target 30 juz · bertambah 2 ayat" icon="book" />
        <MetricCard label="Mutaba’ah hari ini" value="Tercatat" detail="Al-Mulk · ayat 1–10 · sangat lancar" icon="check" tone="bg-[#e8f5f0] text-[#25815e]" />
        <MetricCard label="Tagihan berikutnya" value={formatRupiah(635000)} detail="Iuran November · jatuh tempo 05 Nov" icon="wallet" tone="bg-[#fff4e7] text-[#bd7627]" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold">Capaian belajar terbaru</h2><p className="mt-1 text-xs text-[#757693]">Catatan dari asatidz</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="book" size={18} /></span></div>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3 rounded-2xl bg-[#f8f9ff] p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef0ff] text-[#4457ff]"><Icon name="book" size={16} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">Tahfidz · Surah Al-Mulk</p><StatusBadge label="Sangat lancar" tone="bg-[#e8f5f0] text-[#25815e]" /></div><p className="mt-1 text-[11px] text-[#757693]">Ayat 1–10 · tajwid dan makharijul huruf baik.</p><p className="mt-2 text-[10px] text-[#a2a3b7]">Hari ini · 08.42 · Ust. Hamdan</p></div></div>
            <div className="flex gap-3 rounded-2xl border border-[#e5e7eb] p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff4e7] text-[#bd7627]"><Icon name="graduation" size={16} /></span><div><p className="text-xs font-semibold">Kajian Safinatun Najah</p><p className="mt-1 text-[11px] text-[#757693]">Bab Thaharah · pemahaman baik dan aktif berdiskusi.</p><p className="mt-2 text-[10px] text-[#a2a3b7]">Kemarin · 07.30 · Ustz. Muna</p></div></div>
          </div>
          <div className="mt-5 rounded-2xl border border-[#e5e7eb] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Status perizinan</p><StatusBadge label="Di pondok" tone="bg-[#e8f5f0] text-[#25815e]" /></div><p className="mt-2 text-[11px] text-[#757693]">Tidak ada izin keluar yang sedang berlangsung.</p></div>
        </article>

        <article className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
          <div className="px-5 py-5 sm:px-6"><h2 className="text-base font-bold">Histori pembayaran iuran</h2><p className="mt-1 text-xs text-[#757693]">Lihat atau unduh kuitansi pembayaran.</p></div>
          <div className="divide-y divide-[#f0f0f5]">
            {payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-xs font-semibold">{payment.month}</p><p className="mt-1 text-[10px] text-[#8a8ba2]">{payment.id} · {payment.date}</p><p className="mt-1 text-xs font-bold tabular-nums">{formatRupiah(payment.amount)}</p></div><div className="flex items-center gap-2"><StatusBadge label={payment.status} tone="bg-[#e8f5f0] text-[#25815e]" /><button type="button" onClick={() => setSelectedReceipt(payment)} aria-label={`Lihat kuitansi ${payment.month}`} className="flex min-h-10 items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3 text-[10px] font-semibold text-[#4457ff] hover:bg-[#f8f9ff]"><Icon name="receipt" size={14} /> Lihat</button><button type="button" onClick={() => downloadReceipt(payment)} aria-label={`Unduh kuitansi ${payment.month}`} className="flex size-10 items-center justify-center rounded-full border border-[#e5e7eb] text-[#4457ff] hover:bg-[#f8f9ff]"><Icon name="download" size={15} /></button></div></div>)}
          </div>
          <div className="border-t border-[#f0f0f5] px-5 py-4 text-[10px] leading-5 text-[#8a8ba2] sm:px-6">Data ini adalah simulasi tampilan portal wali. Akses hanya menampilkan satu profil santri.</div>
        </article>
      </section>

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181c31]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReceipt(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="w-full max-w-md rounded-3xl border border-[#e5e7eb] bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between"><div><span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="receipt" size={19} /></span><h2 id="receipt-title" className="mt-4 text-lg font-bold">Kuitansi pembayaran</h2><p className="mt-1 text-xs text-[#757693]">{selectedReceipt.id}</p></div><button type="button" aria-label="Tutup kuitansi" onClick={() => setSelectedReceipt(null)} className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={18} /></button></div>
            <dl className="mt-6 space-y-3 border-y border-dashed border-[#e5e7eb] py-5 text-xs"><div className="flex justify-between gap-4"><dt className="text-[#757693]">Nama santri</dt><dd className="text-right font-semibold">Ahmad Rifqi Maulana</dd></div><div className="flex justify-between gap-4"><dt className="text-[#757693]">Periode</dt><dd className="text-right font-semibold">{selectedReceipt.month}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#757693]">Tanggal bayar</dt><dd className="text-right font-semibold">{selectedReceipt.date}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#757693]">Pembayaran</dt><dd className="text-right font-semibold">Tunai · Lunas</dd></div><div className="flex justify-between gap-4 pt-2 text-sm"><dt className="font-bold">Total diterima</dt><dd className="font-bold tabular-nums text-[#4457ff]">{formatRupiah(selectedReceipt.amount)}</dd></div></dl>
            <div className="mt-5 flex gap-2"><button type="button" onClick={() => downloadReceipt(selectedReceipt)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#e5e7eb] text-xs font-semibold text-[#4457ff] hover:bg-[#f8f9ff]"><Icon name="download" size={15} /> Unduh</button><button type="button" onClick={() => window.print()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-xs font-semibold text-white"><Icon name="receipt" size={15} /> Cetak</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
