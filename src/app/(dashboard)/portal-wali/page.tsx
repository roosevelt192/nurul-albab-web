"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { FormMessage, MetricCard, PageHeading, StatusBadge } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["santri"]["Row"];
type Journal = Database["public"]["Tables"]["jurnal_keilmuan"]["Row"];
type Permit = Database["public"]["Tables"]["perizinan_santri"]["Row"];
type Invoice = Database["public"]["Tables"]["tagihan_santri"]["Row"];
type Payment = Database["public"]["Tables"]["pembayaran_iuran"]["Row"];

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function evaluationLabel(value: string | null) {
  if (!value) return "Belum dinilai";
  return value.replaceAll("_", " ");
}

export default function PortalWaliPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [message, setMessage] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(todayInJakarta()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadStudents() {
      const { data, error } = await createClient()
        .from("santri")
        .select("*")
        .eq("status", "aktif")
        .order("nama_lengkap");
      if (!active) return;
      if (error) {
        console.error("Failed to load active students for the staff parent portal viewer.", error);
        setMessage(`Daftar santri aktif gagal dimuat: ${error.message}`);
      } else {
        setStudents(data ?? []);
        setSelectedStudentId(data?.[0]?.id ?? "");
        setMessage(data?.length ? "" : "Belum ada santri aktif yang dapat ditampilkan.");
      }
      setIsLoadingStudents(false);
    }
    void loadStudents();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    let active = true;
    async function loadStudentDetails() {
      setIsLoadingDetails(true);
      setMessage("");
      const supabase = createClient();
      const [journalResult, permitResult, invoiceResult] = await Promise.all([
        supabase.from("jurnal_keilmuan").select("*").eq("santri_id", selectedStudentId).order("tanggal", { ascending: false }),
        supabase.from("perizinan_santri").select("*").eq("santri_id", selectedStudentId).order("tanggal_keluar", { ascending: false }),
        supabase.from("tagihan_santri").select("*").eq("santri_id", selectedStudentId).order("year", { ascending: false }).order("month", { ascending: false }),
      ]);
      const errors = [
        journalResult.error && `Jurnal keilmuan: ${journalResult.error.message}`,
        permitResult.error && `Riwayat izin: ${permitResult.error.message}`,
        invoiceResult.error && `Tagihan: ${invoiceResult.error.message}`,
      ].filter(Boolean);
      if (errors.length) {
        console.error("Failed to load one or more student portal viewer sections.", errors);
        if (active) {
          setJournals([]);
          setPermits([]);
          setInvoices([]);
          setPayments([]);
          setMessage(`Data santri tidak lengkap. ${errors.join(" · ")}`);
          setIsLoadingDetails(false);
        }
        return;
      }
      const loadedInvoices = invoiceResult.data ?? [];
      const invoiceIds = loadedInvoices.map((invoice) => invoice.id);
      const paymentResult = invoiceIds.length
        ? await supabase.from("pembayaran_iuran").select("*").in("invoice_id", invoiceIds).order("paid_at", { ascending: false })
        : { data: [] as Payment[], error: null };
      if (!active) return;
      if (paymentResult.error) {
        console.error("Failed to load student invoice payment history.", paymentResult.error);
        setMessage(`Histori pembayaran gagal dimuat: ${paymentResult.error.message}`);
        setPayments([]);
      } else {
        setPayments(paymentResult.data ?? []);
      }
      setJournals(journalResult.data ?? []);
      setPermits(permitResult.data ?? []);
      setInvoices(loadedInvoices);
      setIsLoadingDetails(false);
    }
    void loadStudentDetails().catch((error: unknown) => {
      if (!active) return;
      console.error("Unexpected error loading student portal viewer data.", error);
      setMessage(`Data santri gagal dimuat: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}`);
      setIsLoadingDetails(false);
    });
    return () => { active = false; };
  }, [selectedStudentId]);

  const student = students.find((item) => item.id === selectedStudentId);
  const activeJournals = useMemo(
    () => journals.filter((journal) => journal.jenis === "tahfidz"),
    [journals],
  );
  const memorizedJuzCount = new Set(activeJournals.flatMap((journal) => journal.juz ? [journal.juz] : [])).size;
  const todayJournals = journals.filter((journal) => journal.tanggal === today);
  const outstandingAmount = invoices.reduce(
    (sum, invoice) => sum + (invoice.is_paid ? 0 : Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount))),
    0,
  );
  const paymentInvoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId);
  const selectedPaymentInvoice = selectedPayment ? paymentInvoiceMap.get(selectedPayment.invoice_id) : undefined;

  const timeline = useMemo(() => [
    ...journals.map((journal) => ({
      id: `journal-${journal.id}`,
      date: journal.tanggal,
      kind: "journal" as const,
      title: journal.jenis === "tahfidz"
        ? `Tahfidz · ${journal.nama_surat || "Setoran hafalan"}`
        : `Kajian · ${journal.nama_kitab || journal.bab_kajian || "Kitab"}`,
      details: journal.cakupan_bacaan || [
        journal.ayat_awal != null ? `Ayat ${journal.ayat_awal}` : "",
        journal.ayat_akhir != null ? `–${journal.ayat_akhir}` : "",
        journal.juz ? ` · Juz ${journal.juz}` : "",
      ].join("") || "Cakupan belajar tidak dicatat.",
      note: journal.catatan_ustadz,
      status: evaluationLabel(journal.kelancaran ?? journal.predikat),
    })),
    ...permits.map((permit) => ({
      id: `permit-${permit.id}`,
      date: permit.tanggal_keluar,
      kind: "permit" as const,
      title: `Perizinan · ${permit.alasan_izin}`,
      details: `Penjemput: ${permit.penjemput || "Tidak dicatat"} · Batas kembali ${formatDateTime(permit.batas_kembali)}`,
      note: permit.kedatangan_aktual ? `Kembali ${formatDateTime(permit.kedatangan_aktual)}` : null,
      status: permit.status.replaceAll("_", " "),
    })),
  ].sort((first, second) => second.date.localeCompare(first.date)), [journals, permits]);

  return (
    <div className="mx-auto max-w-[1050px] space-y-6">
      <PageHeading eyebrow="Portal keluarga · Viewer staf" title="Perkembangan santri" description="Cari santri aktif untuk meninjau jurnal keilmuan, mutaba’ah, tagihan, dan riwayat perizinan." />
      {message && <FormMessage>{message}</FormMessage>}
      <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-7">
        <label htmlFor="student-picker" className="block text-xs font-semibold text-[#55566f]">Pencarian santri cepat</label>
        <div className="relative mt-1.5">
          <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a8ba2]" />
          <select
            id="student-picker"
            value={selectedStudentId}
            onChange={(event) => { setSelectedStudentId(event.target.value); setSelectedPaymentId(""); }}
            disabled={isLoadingStudents || !students.length}
            className="min-h-12 w-full appearance-none rounded-xl border border-[#e5e7eb] bg-white pl-10 pr-10 text-sm outline-none transition focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10 disabled:bg-[#f8f9ff]"
          >
            <option value="">{isLoadingStudents ? "Memuat santri aktif…" : "Pilih santri aktif"}</option>
            {students.map((item) => <option key={item.id} value={item.id}>{item.nama_lengkap} · NIS {item.nis || "—"}</option>)}
          </select>
          <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a8ba2]" />
        </div>
      </section>

      {student && (
        <>
          <section className="rounded-3xl border border-[#e5e7eb] bg-gradient-to-r from-[#eef0ff] to-white p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-lg font-bold text-[#4457ff]">
                {student.foto_url ? <Image src={student.foto_url} alt={student.nama_lengkap} width={64} height={64} unoptimized className="size-full object-cover" /> : student.nama_lengkap.split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#757693]">Perkembangan santri terpilih</p>
                <h2 className="mt-1 break-words text-xl font-bold tracking-tight">{student.nama_lengkap}</h2>
                <p className="mt-1 text-xs text-[#757693]">NIS {student.nis || "—"} · {student.kelas_marhalah || "Kelas belum diatur"} · {student.kamar_asrama || "Kamar belum diatur"}</p>
              </div>
              <StatusBadge label="Santri aktif" tone="bg-[#e8f5f0] text-[#25815e]" />
            </div>
          </section>

          {isLoadingDetails ? (
            <div className="rounded-3xl border border-[#e5e7eb] bg-white p-10 text-center text-sm text-[#757693]">Memuat data perkembangan santri…</div>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-3">
                <MetricCard label="Progres hafalan" value={`${memorizedJuzCount} juz`} detail={`${activeJournals.length} catatan tahfidz · dari jurnal keilmuan`} icon="book" />
                <MetricCard label="Mutaba’ah hari ini" value={todayJournals.length ? "Tercatat" : "Belum tercatat"} detail={todayJournals.length ? `${todayJournals.length} jurnal pada ${formatDate(today)}` : `Belum ada jurnal pada ${formatDate(today)}`} icon="check" tone={todayJournals.length ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4d6] text-[#a6641c]"} />
                <MetricCard label="Tagihan belum lunas" value={formatRupiah(outstandingAmount)} detail={`${invoices.filter((invoice) => !invoice.is_paid).length} tagihan tersisa`} icon="wallet" tone="bg-[#fff4d6] text-[#a6641c]" />
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <article className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
                  <div className="px-5 py-5 sm:px-6"><h2 className="text-base font-bold">Tagihan &amp; iuran</h2><p className="mt-1 text-xs text-[#757693]">Tagihan aktif dan status pembayaran santri terpilih.</p></div>
                  <div className="divide-y divide-[#f0f0f5]">
                    {invoices.map((invoice) => {
                      const balance = Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount));
                      return (
                        <div key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                          <div className="min-w-0"><p className="text-xs font-semibold">{new Date(invoice.year, invoice.month - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p><p className="mt-1 text-[10px] text-[#757693]">Tagihan {formatRupiah(Number(invoice.total_amount))} · Terbayar {formatRupiah(Number(invoice.paid_amount))}</p></div>
                          <div className="shrink-0 text-right"><StatusBadge label={invoice.is_paid ? "Lunas" : "Belum lunas"} tone={invoice.is_paid ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4d6] text-[#a6641c]"} />{!invoice.is_paid && <p className="mt-1 text-[10px] font-semibold tabular-nums text-[#a6641c]">Sisa {formatRupiah(balance)}</p>}</div>
                        </div>
                      );
                    })}
                    {!invoices.length && <p className="px-5 py-8 text-center text-xs text-[#757693]">Belum ada tagihan untuk santri ini.</p>}
                  </div>
                </article>

                <article className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
                  <div className="px-5 py-5 sm:px-6"><h2 className="text-base font-bold">Histori pembayaran &amp; kuitansi</h2><p className="mt-1 text-xs text-[#757693]">Riwayat pembayaran yang tersimpan di sistem keuangan.</p></div>
                  <div className="divide-y divide-[#f0f0f5]">
                    {payments.map((payment) => {
                      const invoice = paymentInvoiceMap.get(payment.invoice_id);
                      return (
                        <div key={payment.id} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                          <div className="min-w-0"><p className="text-xs font-semibold tabular-nums">{formatRupiah(Number(payment.amount))}</p><p className="mt-1 text-[10px] text-[#757693]">{formatDateTime(payment.paid_at)} · {payment.method}</p><p className="mt-1 text-[10px] text-[#8a8ba2]">{invoice ? `Tagihan ${invoice.month}/${invoice.year}` : "Tagihan"}</p></div>
                          <button type="button" onClick={() => setSelectedPaymentId(payment.id)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3 text-[10px] font-semibold text-[#4457ff] transition hover:bg-[#f8f9ff]"><Icon name="receipt" size={14} />Kuitansi</button>
                        </div>
                      );
                    })}
                    {!payments.length && <p className="px-5 py-8 text-center text-xs text-[#757693]">Belum ada pembayaran tercatat.</p>}
                  </div>
                </article>
              </section>

              <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
                <div><h2 className="text-base font-bold">Catatan asatidz &amp; riwayat izin</h2><p className="mt-1 text-xs text-[#757693]">Timeline jurnal mutaba’ah dan perizinan aktual.</p></div>
                <div className="mt-5 space-y-3">
                  {timeline.map((entry) => (
                    <article key={entry.id} className="flex gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f8f9ff] p-4">
                      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${entry.kind === "journal" ? "bg-[#dbeafe] text-[#4457ff]" : "bg-emerald-50 text-emerald-700"}`}><Icon name={entry.kind === "journal" ? "book-open" : "clock"} size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-xs font-semibold">{entry.title}</h3><StatusBadge label={entry.status} tone={entry.kind === "journal" ? "bg-[#eef0ff] text-[#4457ff]" : "bg-emerald-50 text-emerald-800"} /></div>
                        <p className="mt-1 text-[10px] leading-5 text-[#757693]">{entry.details}</p>
                        {entry.note && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[10px] leading-5 text-[#55566f]">{entry.note}</p>}
                        <p className="mt-2 text-[10px] text-[#8a8ba2]">{formatDate(entry.date)}</p>
                      </div>
                    </article>
                  ))}
                  {!timeline.length && <p className="rounded-2xl bg-[#f8f9ff] p-7 text-center text-xs text-[#757693]">Belum ada jurnal mutaba’ah atau riwayat izin untuk santri ini.</p>}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {selectedPayment && selectedPaymentInvoice && student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181c31]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPaymentId(""); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="student-receipt-title" className="w-full max-w-md rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-3"><div><span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="receipt" size={19} /></span><h2 id="student-receipt-title" className="mt-4 text-lg font-bold">Kuitansi pembayaran</h2><p className="mt-1 text-xs text-[#757693]">{student.nama_lengkap}</p></div><button type="button" aria-label="Tutup kuitansi" onClick={() => setSelectedPaymentId("")} className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={18} /></button></div>
            <dl className="mt-6 space-y-3 border-y border-dashed border-[#e5e7eb] py-5 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-[#757693]">Periode</dt><dd className="text-right font-semibold">{selectedPaymentInvoice.month}/{selectedPaymentInvoice.year}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#757693]">Tanggal bayar</dt><dd className="text-right font-semibold">{formatDateTime(selectedPayment.paid_at)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#757693]">Metode</dt><dd className="text-right font-semibold">{selectedPayment.method}</dd></div>
              <div className="flex justify-between gap-4 pt-2 text-sm"><dt className="font-bold">Total diterima</dt><dd className="font-bold tabular-nums text-[#4457ff]">{formatRupiah(Number(selectedPayment.amount))}</dd></div>
            </dl>
            <button type="button" onClick={() => window.print()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-xs font-semibold text-white print:hidden"><Icon name="receipt" size={15} />Cetak Kuitansi</button>
          </section>
        </div>
      )}
    </div>
  );
}
