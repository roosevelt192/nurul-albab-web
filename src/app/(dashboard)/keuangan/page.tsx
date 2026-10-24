"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { FormMessage, MetricCard, PageHeading, PillTabs, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export interface UnifiedAccount {
  id: string;
  name: string;
  account_number: string;
  balance: number;
  opening_balance: number;
  is_active: boolean;
}

export interface UnifiedComponent {
  id: string;
  name: string;
  category: string;
  amount: number;
  is_active: boolean;
}

export interface UnifiedInvoice {
  id: string;
  santri_id: string;
  component_id: string | null;
  month: number;
  year: number;
  total_amount: number;
  paid_amount: number;
  is_paid: boolean;
  created_at?: string;
}

export interface UnifiedPayment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  paid_at: string;
  received_by: string | null;
}

export interface UnifiedCashEntry {
  id: string;
  account_id: string;
  transaction_date: string;
  proof_number: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  created_by: string | null;
  created_at?: string;
}

type Student = { id: string; nis: string | null; nama_lengkap: string; status: string };
type ReceiptInstitution = Pick<
  Database["public"]["Tables"]["pengaturan_pesantren"]["Row"],
  "nama_pesantren" | "alamat" | "logo_url" | "logo_size" | "logo_height" | "show_logo_kuitansi" | "footer_kuitansi"
>;
type RawFinanceRow = Record<string, unknown>;
type FinanceTab = "cash" | "invoices";
type Modal = "movement" | "invoice" | "payment" | null;

const pageSize = 10;
const cashCategories = ["Operasional", "Listrik", "Konsumsi", "Donasi", "Iuran Santri", "Setoran SHU", "Perawatan", "Lainnya"];
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const amountInputClass = "min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#181c31] outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rawString(row: RawFinanceRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" && value ? value : fallback;
}

function rawNumber(row: RawFinanceRow, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function rawNullableString(row: RawFinanceRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const err = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | undefined;
  if (err?.message) {
    const parts = [String(err.message)];
    if (err.code) parts.push(`[kode ${err.code}]`);
    if (err.details) parts.push(`detail: ${err.details}`);
    if (err.hint) parts.push(`hint: ${err.hint}`);
    return parts.join(" ");
  }
  return "Terjadi kesalahan yang tidak diketahui.";
}

function SelectField({
  label,
  name,
  children,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  children: ReactNode;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-[#55566f]">
      {label}
      <select required={required} name={name} defaultValue={defaultValue} className={`${amountInputClass} mt-1.5`}>
        {children}
      </select>
    </label>
  );
}

function TextField({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-[#55566f]">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} min={min} className={`${amountInputClass} mt-1.5`} />
    </label>
  );
}

function ModalFrame({ title, description, onClose, children }: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-[#757693]">{description}</p></div>
          <button type="button" onClick={onClose} aria-label="Tutup modal" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3f5ff] text-[#757693] transition hover:text-[#181c31]"><Icon name="close" size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function KeuanganPage() {
  const [tab, setTab] = useState<FinanceTab>("cash");
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [components, setComponents] = useState<UnifiedComponent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [cashEntries, setCashEntries] = useState<UnifiedCashEntry[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [receiptInstitution, setReceiptInstitution] = useState<ReceiptInstitution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<"all" | "selected">("all");
  const [cashFilter, setCashFilter] = useState("Semua kategori");
  const [cashPage, setCashPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("Semua status");
  const [invoiceMonth, setInvoiceMonth] = useState("Semua periode");
  const [currentDate, setCurrentDate] = useState("");
  const [invoiceYear, setInvoiceYear] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const date = localDate();
      setCurrentDate(date);
      setInvoiceYear(date.slice(0, 4));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const loadFinanceData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Query data secara aman tanpa klausa .order kolom kaku
    const [accountResult, componentResult, studentResult, invoiceResult, paymentResult, cashResult, institutionResult] = await Promise.all([
      supabase.from("rekening_kas").select("*").eq("is_active", true),
      supabase.from("komponen_iuran").select("*").eq("is_active", true),
      supabase.rpc("finance_list_students").then(async (res) => {
        if (res.error) {
          return supabase.from("santri").select("id, nis, nama_lengkap, status").neq("status", "pending_ppdb");
        }
        return res;
      }),
      supabase.from("tagihan_santri").select("*"),
      supabase.from("pembayaran_iuran").select("*"),
      supabase.from("jurnal_kas").select("*"),
      supabase.from("pengaturan_pesantren").select("nama_pesantren, alamat, logo_url, logo_size, logo_height, show_logo_kuitansi, footer_kuitansi").limit(1).maybeSingle(),
    ]);
    if (institutionResult.error) {
      console.warn("Unable to load institution branding for receipts.", institutionResult.error.message);
      setReceiptInstitution(null);
    } else {
      setReceiptInstitution(institutionResult.data);
    }

    // Normalisasi Rekening Kas
    const mappedAccounts: UnifiedAccount[] = ((accountResult.data ?? []) as unknown as RawFinanceRow[]).map((a) => ({
      id: rawString(a, "id"),
      name: rawString(a, "name") || rawString(a, "nama_kas") || rawString(a, "nama") || "Kas",
      account_number: rawString(a, "account_number") || rawString(a, "nomor_rekening") || "-",
      balance: rawNumber(a, "balance", rawNumber(a, "saldo")),
      opening_balance: rawNumber(a, "opening_balance", rawNumber(a, "saldo_awal")),
      is_active: typeof a.is_active === "boolean" ? a.is_active : true,
    }));
    mappedAccounts.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));

    // Normalisasi Komponen Iuran (mendukung nama_pos, nama_komponen, name)
    const mappedComponents: UnifiedComponent[] = ((componentResult.data ?? []) as unknown as RawFinanceRow[]).map((c) => ({
      id: rawString(c, "id"),
      name: rawString(c, "name") || rawString(c, "nama_pos") || rawString(c, "nama_komponen") || "Iuran Santri",
      category: rawString(c, "category") || rawString(c, "kategori") || "Iuran Wajib",
      amount: rawNumber(c, "amount", rawNumber(c, "nominal", rawNumber(c, "nominal_default"))),
      is_active: typeof c.is_active === "boolean" ? c.is_active : true,
    }));
    mappedComponents.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));

    // Normalisasi Tagihan Santri
    const mappedInvoices: UnifiedInvoice[] = ((invoiceResult.data ?? []) as unknown as RawFinanceRow[]).map((inv) => {
      let m = rawNumber(inv, "month");
      let y = rawNumber(inv, "year");
      const period = inv.periode_bulan;
      if ((!m || !y) && typeof period === "string" && period.includes("-")) {
        const parts = period.split("-");
        y = Number(parts[0]);
        m = Number(parts[1]);
      }
      return {
        id: rawString(inv, "id"),
        santri_id: rawString(inv, "santri_id"),
        component_id: rawNullableString(inv, "component_id"),
        month: m || 1,
        year: y || new Date().getFullYear(),
        total_amount: rawNumber(inv, "total_amount", rawNumber(inv, "nominal")),
        paid_amount: rawNumber(inv, "paid_amount", rawNumber(inv, "terbayar")),
        is_paid: typeof inv.is_paid === "boolean"
          ? inv.is_paid
          : rawNumber(inv, "paid_amount") >= rawNumber(inv, "total_amount"),
        created_at: rawNullableString(inv, "created_at") ?? undefined,
      };
    });
    mappedInvoices.sort((a, b) => (b.year - a.year) || (b.month - a.month));

    // Normalisasi Pembayaran Iuran
    const mappedPayments: UnifiedPayment[] = ((paymentResult.data ?? []) as unknown as RawFinanceRow[]).map((p) => ({
      id: rawString(p, "id"),
      invoice_id: rawString(p, "invoice_id") || rawString(p, "tagihan_id"),
      amount: rawNumber(p, "amount", rawNumber(p, "nominal")),
      method: rawString(p, "method") || rawString(p, "metode") || "tunai",
      paid_at: rawString(p, "paid_at") || rawString(p, "created_at") || new Date().toISOString(),
      received_by: rawNullableString(p, "received_by"),
    }));
    mappedPayments.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

    // Normalisasi Jurnal Kas
    const mappedEntries: UnifiedCashEntry[] = ((cashResult.data ?? []) as unknown as RawFinanceRow[]).map((e) => {
      const id = rawString(e, "id");
      return {
        id,
        account_id: rawString(e, "account_id") || rawString(e, "rekening_id"),
        transaction_date: rawString(e, "transaction_date") || rawString(e, "tanggal") || localDate(),
        proof_number: rawString(e, "proof_number") || rawString(e, "nomor_bukti") || `TRX-${id.slice(0, 8)}`,
        type: rawString(e, "type") || (e.kredit ? "kredit" : "debit"),
        category: rawString(e, "category") || rawString(e, "kategori") || "Umum",
        description: rawString(e, "description") || rawString(e, "keterangan") || "-",
        amount: rawNumber(e, "amount", rawNumber(e, "nominal")),
        created_by: rawNullableString(e, "created_by"),
        created_at: rawNullableString(e, "created_at") ?? undefined,
      };
    });
    mappedEntries.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

    // Profil Staf Keuangan
    const profileIds = [...new Set([
      ...mappedEntries.map((entry) => entry.created_by),
      ...mappedPayments.map((payment) => payment.received_by),
    ].filter((id): id is string => Boolean(id)))];

    let profileMap = new Map<string, string>();
    if (profileIds.length) {
      const { data } = await supabase.from("profiles")
        .select("id, nama_lengkap")
        .in("id", profileIds);
      if (data) {
        profileMap = new Map(data.map((profile) => [profile.id, profile.nama_lengkap]));
      }
    }

    setAccounts(mappedAccounts);
    setComponents(mappedComponents);
    setStudents(studentResult.data ?? []);
    setInvoices(mappedInvoices);
    setPayments(mappedPayments);
    setCashEntries(mappedEntries);
    setProfiles(profileMap);
    setMessage("");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFinanceData().catch((error: unknown) => {
        console.error("Unexpected error while loading finance module.", error);
        setMessage(`Data keuangan gagal dimuat: ${errorMessage(error)}`);
        setIsLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFinanceData]);

  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const componentMap = useMemo(() => new Map(components.map((component) => [component.id, component])), [components]);
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const totalCash = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount)), 0);
  const monthReceiptTotal = payments.filter((payment) => currentDate && payment.paid_at.slice(0, 7) === currentDate.slice(0, 7))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const invoiceViews = useMemo(() => {
    const normalizedQuery = invoiceQuery.trim().toLocaleLowerCase("id-ID");
    return invoices.map((invoice) => ({
      invoice,
      student: studentMap.get(invoice.santri_id),
      component: invoice.component_id ? componentMap.get(invoice.component_id) : undefined,
    })).filter(({ invoice, student }) => {
      const matchesSearch = !normalizedQuery ||
        student?.nama_lengkap.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
        (student?.nis ?? "").toLocaleLowerCase("id-ID").includes(normalizedQuery);
      const isPaid = invoice.is_paid;
      const matchesStatus = invoiceStatus === "Semua status" ||
        (invoiceStatus === "Lunas" ? isPaid : !isPaid);
      const matchesMonth = invoiceMonth === "Semua periode" ||
        (invoice.month === Number(invoiceMonth) && invoice.year === Number(invoiceYear));
      return matchesSearch && matchesStatus && matchesMonth &&
        (!invoiceYear || invoice.year === Number(invoiceYear));
    });
  }, [invoiceMonth, invoiceQuery, invoiceStatus, invoiceYear, invoices, studentMap, componentMap]);

  const cashViews = useMemo(() => {
    return cashEntries.filter((entry) => cashFilter === "Semua kategori" || entry.category === cashFilter)
      .map((entry) => ({
        entry,
        account: accountMap.get(entry.account_id),
        creator: entry.created_by ? profiles.get(entry.created_by) ?? `Petugas (${entry.created_by.slice(0, 8)})` : "Petugas",
      }));
  }, [accountMap, cashEntries, cashFilter, profiles]);

  const visibleCash = cashViews.slice((cashPage - 1) * pageSize, cashPage * pageSize);
  const visibleInvoices = invoiceViews.slice((invoicePage - 1) * pageSize, invoicePage * pageSize);
  const pageCountCash = Math.max(1, Math.ceil(cashViews.length / pageSize));
  const pageCountInvoices = Math.max(1, Math.ceil(invoiceViews.length / pageSize));

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const accountId = String(data.get("account_id") ?? "");
    const type = String(data.get("type") ?? "");
    const amount = Number(data.get("amount"));
    const category = String(data.get("category") ?? "");
    const description = String(data.get("description") ?? "").trim();
    const transactionDate = String(data.get("transaction_date") ?? "");

    if (!accountId || !["debit", "kredit"].includes(type) || !Number.isFinite(amount) || amount <= 0 || !category || !description || !transactionDate) {
      setMessage("Lengkapi data mutasi dan masukkan nominal berupa angka lebih dari nol.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const supabase = createClient();
    const { data: proofNumber, error } = await supabase.rpc("finance_record_cash_movement", {
      p_account_id: accountId,
      p_type: type as "debit" | "kredit",
      p_category: category,
      p_description: description,
      p_amount: amount,
      p_transaction_date: transactionDate,
    });

    if (error) {
      const detailMsg = error.message || error.details || error.hint || JSON.stringify(error);
      console.error("Gagal simpan mutasi kas:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setMessage(`Mutasi kas gagal disimpan: ${detailMsg}`);
      setIsSaving(false);
      return;
    }

    form.reset();
    setModal(null);
    setMessage(`Mutasi kas berhasil dicatat dengan nomor bukti: ${proofNumber}.`);
    await loadFinanceData();
    setIsSaving(false);
  }

  async function submitInvoiceGeneration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const componentId = String(data.get("component_id") ?? "");
    const month = Number(data.get("month"));
    const year = Number(data.get("year"));
    const target = String(data.get("target") ?? "all");
    const chosen = data.getAll("student_ids").map(String).filter(Boolean);

    if (!componentId || month < 1 || month > 12 || year < 2020 || (target === "selected" && !chosen.length)) {
      setMessage("Pilih komponen, periode yang valid, dan minimal satu santri untuk target tertentu.");
      return;
    }

    setIsSaving(true);
    const { data: insertedCount, error } = await createClient().rpc("finance_generate_invoices", {
      p_component_id: componentId,
      p_month: month,
      p_year: year,
      p_student_ids: target === "all" ? null : chosen,
    });

    if (error) {
      const err = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | undefined;
      console.error("Gagal generate tagihan ke Supabase.", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      });
      setMessage(`Pembuatan tagihan gagal: ${err?.message ?? "terjadi kesalahan"}`);
      setIsSaving(false);
      return;
    }

    form.reset();
    setModal(null);
    setInvoiceTarget("all");
    setMessage(`${insertedCount ?? 0} tagihan baru berhasil dibuat. Tagihan yang sudah ada tidak digandakan.`);
    await loadFinanceData();
    setIsSaving(false);
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const invoiceId = String(data.get("invoice_id") ?? "");
    const accountId = String(data.get("account_id") ?? "");
    const method = String(data.get("method") ?? "");
    const amount = Number(data.get("amount"));
    const invoice = invoices.find((item) => item.id === invoiceId);
    const remaining = invoice ? Number(invoice.total_amount) - Number(invoice.paid_amount) : 0;

    if (!invoice || !accountId || !["tunai", "transfer"].includes(method) || !Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      setMessage("Periksa kembali nominal. Pembayaran harus lebih dari nol dan tidak boleh melebihi sisa tagihan.");
      return;
    }

    setIsSaving(true);
    const { data: paymentId, error } = await createClient().rpc("finance_receive_invoice_payment", {
      p_invoice_id: invoiceId,
      p_account_id: accountId,
      p_amount: amount,
      p_method: method as "tunai" | "transfer",
    });

    if (error) {
      const err = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | undefined;
      console.error("Gagal bayar tagihan ke Supabase.", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      });
      setMessage(`Pembayaran gagal disimpan: ${err?.message ?? "terjadi kesalahan"}`);
      setIsSaving(false);
      return;
    }

    form.reset();
    setModal(null);
    setSelectedInvoiceId("");
    setMessage("Pembayaran tersimpan. Saldo rekening dan jurnal kas telah diperbarui.");
    await loadFinanceData();

    if (paymentId) {
      const { data: savedPayment } = await createClient().from("pembayaran_iuran")
        .select("*")
        .eq("id", paymentId)
        .single();
      if (savedPayment) {
        const rawPayment = savedPayment as unknown as RawFinanceRow;
        setSelectedPayment({
          id: rawString(rawPayment, "id"),
          invoice_id: rawString(rawPayment, "invoice_id") || rawString(rawPayment, "tagihan_id"),
          amount: rawNumber(rawPayment, "amount", rawNumber(rawPayment, "nominal")),
          method: rawString(rawPayment, "method") || rawString(rawPayment, "metode") || "tunai",
          paid_at: rawString(rawPayment, "paid_at") || new Date().toISOString(),
          received_by: rawNullableString(rawPayment, "received_by"),
        });
      }
    }
    setIsSaving(false);
  }

  function showPayment(invoiceId: string) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.is_paid) return;
    setSelectedInvoiceId(invoiceId);
    setModal("payment");
  }

  function printReceipt(payment: UnifiedPayment) {
    setSelectedPayment(payment);
    window.setTimeout(() => window.print(), 0);
  }

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);
  const selectedStudent = selectedInvoice ? studentMap.get(selectedInvoice.santri_id) : undefined;
  const selectedComponent = selectedInvoice?.component_id ? componentMap.get(selectedInvoice.component_id) : undefined;
  const paymentInvoice = selectedPayment ? invoices.find((invoice) => invoice.id === selectedPayment.invoice_id) : undefined;
  const paymentStudent = paymentInvoice ? studentMap.get(paymentInvoice.santri_id) : undefined;
  const paymentComponent = paymentInvoice?.component_id ? componentMap.get(paymentInvoice.component_id) : undefined;
  
  const latestPaymentByInvoice = useMemo(() => {
    const map = new Map<string, UnifiedPayment>();
    for (const payment of payments) {
      if (!map.has(payment.invoice_id)) map.set(payment.invoice_id, payment);
    }
    return map;
  }, [payments]);

  const tabs = [
    { value: "cash" as const, label: "Buku Kas & Mutasi" },
    { value: "invoices" as const, label: "Tagihan & Iuran Santri" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Keuangan pesantren"
        title="Keuangan & iuran"
        description="Kelola rekening multi-ledger, catat mutasi, dan terbitkan tagihan santri."
        action={tab === "cash" ? (
          <PrimaryButton onClick={() => setModal("movement")} disabled={!accounts.length}>
            <Icon name="plus" size={16} /> Catat Mutasi Kas
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => setModal("invoice")} disabled={!components.length}>
            <Icon name="plus" size={16} /> Buat Tagihan Baru
          </PrimaryButton>
        )}
      />

      {message && <FormMessage>{message}</FormMessage>}
      {!isLoading && !accounts.length && <FormMessage>Belum ada rekening kas aktif. Tambahkan rekening kas terlebih dahulu di Supabase.</FormMessage>}
      {!isLoading && !components.length && <FormMessage>Belum ada komponen iuran aktif. Tambahkan komponen sebelum membuat tagihan.</FormMessage>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="h-full"><MetricCard label="Total kas aktif" value={formatRupiah(totalCash)} detail={`${accounts.length} rekening kas aktif`} icon="wallet" /></div>
        <div className="h-full"><MetricCard label="Sisa tagihan" value={formatRupiah(outstanding)} detail="Akumulasi semua tagihan belum lunas" icon="clock" tone="bg-[#fff4e7] text-[#bd7627]" /></div>
        <div className="h-full"><MetricCard label="Pembayaran bulan ini" value={formatRupiah(monthReceiptTotal)} detail="Total penerimaan iuran" icon="trending-up" tone="bg-[#e8f5f0] text-[#25815e]" /></div>
      </section>

      <section className="rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <PillTabs label="Modul keuangan" value={tab} options={tabs} onChange={(value) => { setTab(value); setMessage(""); }} />
      </section>

      {tab === "cash" && (
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><h2 className="text-base font-bold">Saldo rekening</h2><p className="mt-1 text-xs text-[#757693]">Saldo berjalan sesuai jurnal kas tersimpan.</p></div>
              <p className="text-sm font-bold tabular-nums">Total {formatRupiah(totalCash)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account) => (
                <article key={account.id} className="rounded-3xl border border-[#e5e7eb] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#cbd0ff]">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-medium text-[#757693]">Rekening kas</p><h3 className="mt-1 text-sm font-bold">{account.name}</h3></div>
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="wallet" size={18} /></span>
                  </div>
                  <p className="mt-5 break-words text-2xl font-bold tracking-tight tabular-nums">{formatRupiah(Number(account.balance))}</p>
                  <p className="mt-2 text-[10px] text-[#8a8ba2]">Saldo awal {formatRupiah(Number(account.opening_balance))}</p>
                </article>
              ))}
              {!accounts.length && !isLoading && <article className="rounded-3xl border border-dashed border-[#cfd2e3] bg-white p-6 text-center text-xs text-[#757693]">Rekening kas belum tersedia.</article>}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
            <div className="flex flex-col justify-between gap-3 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
              <div><h2 className="text-base font-bold">Riwayat mutasi kas</h2><p className="mt-1 text-xs text-[#757693]">Transaksi pemasukan dan pengeluaran semua rekening.</p></div>
              <label className="block text-xs font-semibold text-[#55566f]">Kategori
                <select value={cashFilter} onChange={(event) => { setCashFilter(event.target.value); setCashPage(1); }} className="mt-1.5 min-h-10 rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs outline-none focus:border-[#4457ff]">
                  <option>Semua kategori</option>
                  {[...new Set(cashEntries.map((entry) => entry.category))].map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead><tr className="border-y border-[#e5e7eb] bg-[#fafaff] text-[10px] uppercase tracking-wider text-[#8a8ba2]"><th className="px-5 py-3">Tanggal / bukti</th><th className="px-5 py-3">Rekening</th><th className="px-5 py-3">Kategori / keterangan</th><th className="px-5 py-3">Nominal</th><th className="px-5 py-3">Pembuat</th></tr></thead>
                <tbody>
                  {visibleCash.map(({ entry, account, creator }) => {
                    const incoming = entry.type === "kredit";
                    return (
                      <tr key={entry.id} className="border-b border-[#f0f0f5] last:border-0 transition hover:bg-[#fafaff]">
                        <td className="px-5 py-4"><span className="block text-xs font-medium">{formatDate(entry.transaction_date)}</span><span className="mt-1 block text-[10px] text-[#8a8ba2]">{entry.proof_number}</span></td>
                        <td className="px-5 py-4 text-xs font-medium">{account?.name ?? "Rekening diarsipkan"}</td>
                        <td className="px-5 py-4"><span className="block text-xs font-semibold">{entry.category}</span><span className="mt-1 block max-w-sm text-[10px] text-[#8a8ba2]">{entry.description}</span></td>
                        <td className={`px-5 py-4 text-xs font-bold tabular-nums ${incoming ? "text-[#25815e]" : "text-[#bd4d4d]"}`}>{incoming ? "+" : "−"}{formatRupiah(Number(entry.amount))}</td>
                        <td className="px-5 py-4 text-xs text-[#757693]">{creator}</td>
                      </tr>
                    );
                  })}
                  {!isLoading && !visibleCash.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-[#757693]">Belum ada mutasi untuk kategori ini.</td></tr>}
                  {isLoading && <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-[#757693]">Memuat buku kas…</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={cashPage} pageCount={pageCountCash} rowCount={cashViews.length} onChange={setCashPage} />
          </section>
        </div>
      )}

      {tab === "invoices" && (
        <section className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
          <div className="flex flex-col justify-between gap-4 px-5 py-5 sm:px-6">
            <div><h2 className="text-base font-bold">Tagihan per santri</h2><p className="mt-1 text-xs text-[#757693]">Cari tagihan, catat pembayaran, dan cetak kuitansi digital.</p></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <label className="block text-xs font-semibold text-[#55566f]">Pencarian Santri
                <div className="relative mt-1.5">
                  <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8ba2]" />
                  <input value={invoiceQuery} onChange={(event) => { setInvoiceQuery(event.target.value); setInvoicePage(1); }} placeholder="Cari nama / NIS" className={`${amountInputClass} h-11 pl-9`} />
                </div>
              </label>
              <label className="block text-xs font-semibold text-[#55566f]">Status<select value={invoiceStatus} onChange={(event) => { setInvoiceStatus(event.target.value); setInvoicePage(1); }} className={`${amountInputClass} mt-1.5 h-11`}><option>Semua status</option><option>Lunas</option><option>Belum lunas</option></select></label>
              <label className="block text-xs font-semibold text-[#55566f]">Periode<select value={invoiceMonth} onChange={(event) => { setInvoiceMonth(event.target.value); setInvoicePage(1); }} className={`${amountInputClass} mt-1.5 h-11`}><option>Semua periode</option>{monthNames.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select></label>
              <label className="block text-xs font-semibold text-[#55566f]">Tahun<input value={invoiceYear} onChange={(event) => { setInvoiceYear(event.target.value); setInvoicePage(1); }} type="number" min="2020" className={`${amountInputClass} mt-1.5 h-11`} /></label>
            </div>
          </div>
          <div className="overflow-x-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-thin">
            <table className="w-full min-w-[850px] text-left">
              <thead><tr className="border-y border-[#e5e7eb] bg-[#fafaff] text-[10px] uppercase tracking-wider text-[#8a8ba2]"><th className="px-4 py-3.5 sm:px-5">Santri</th><th className="px-4 py-3.5 sm:px-5">Komponen</th><th className="px-4 py-3.5 sm:px-5">Periode</th><th className="px-4 py-3.5 sm:px-5 text-right">Tagihan</th><th className="px-4 py-3.5 sm:px-5">Terbayar / sisa</th><th className="px-4 py-3.5 sm:px-5 text-center">Status / aksi</th></tr></thead>
              <tbody>
                {visibleInvoices.map(({ invoice, student, component }) => {
                  const remaining = Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount));
                  const latestPayment = latestPaymentByInvoice.get(invoice.id);
                  return (
                    <tr key={invoice.id} className="border-b border-[#f0f0f5] last:border-0 transition hover:bg-[#fafaff] align-middle">
                      <td className="px-4 py-3.5 sm:px-5"><span className="block text-xs font-semibold">{student?.nama_lengkap ?? "Santri tidak ditemukan"}</span><span className="mt-1 block text-[10px] text-[#8a8ba2]">NIS {student?.nis ?? "—"}</span></td>
                      <td className="px-4 py-3.5 sm:px-5"><span className="text-xs font-medium">{component?.name ?? "Tagihan"}</span>{component && <span className="mt-1 block text-[10px] capitalize text-[#8a8ba2]">{component.category}</span>}</td>
                      <td className="px-4 py-3.5 sm:px-5 text-xs text-[#757693]">{monthNames[invoice.month - 1]} {invoice.year}</td>
                      <td className="px-4 py-3.5 sm:px-5 text-xs font-semibold tabular-nums text-right">{formatRupiah(Number(invoice.total_amount))}</td>
                      <td className="px-4 py-3.5 sm:px-5"><span className="block text-xs tabular-nums">{formatRupiah(Number(invoice.paid_amount))}</span>{remaining > 0 && <span className="mt-1 block text-[10px] text-[#bd7627]">Sisa {formatRupiah(remaining)}</span>}</td>
                      <td className="px-4 py-3.5 sm:px-5 text-center"><div className="flex flex-wrap items-center justify-center gap-2">{invoice.is_paid ? <><StatusBadge label="Lunas" tone="bg-[#e8f5f0] text-[#25815e]" />{latestPayment && <button type="button" onClick={() => printReceipt(latestPayment)} title="Cetak kuitansi" className="inline-flex items-center gap-1.5 rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-semibold text-[#4457ff]"><Icon name="receipt" size={14} />Kwitansi</button>}</> : <button type="button" onClick={() => showPayment(invoice.id)} className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5">Bayar</button>}</div></td>
                    </tr>
                  );
                })}
                {!isLoading && !visibleInvoices.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-[#757693]">Tidak ada tagihan yang sesuai filter.</td></tr>}
                {isLoading && <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-[#757693]">Memuat tagihan…</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={invoicePage} pageCount={pageCountInvoices} rowCount={invoiceViews.length} onChange={setInvoicePage} />
        </section>
      )}

      {modal === "movement" && (
        <ModalFrame title="Catat mutasi kas" description="Mutasi dan saldo rekening disimpan bersama dalam satu transaksi database." onClose={() => !isSaving && setModal(null)}>
          <form onSubmit={submitMovement} className="mt-5 space-y-4">
            <SelectField label="Rekening kas" name="account_id" defaultValue=""><option value="">Pilih rekening</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatRupiah(Number(account.balance))}</option>)}</SelectField>
            <SelectField label="Arus kas" name="type" defaultValue="kredit"><option value="kredit">Masuk</option><option value="debit">Keluar</option></SelectField>
            <SelectField label="Kategori" name="category" defaultValue="Operasional">{cashCategories.map((category) => <option key={category}>{category}</option>)}</SelectField>
            <div className="grid gap-4 sm:grid-cols-2"><TextField label="Nominal (Rp)" name="amount" type="number" min="1" /><TextField label="Tanggal transaksi" name="transaction_date" type="date" defaultValue={currentDate} /></div>
            <label className="block text-xs font-semibold text-[#55566f]">Keterangan<textarea name="description" required rows={3} className={`${amountInputClass} mt-1.5 py-3`} placeholder="Tuliskan tujuan atau sumber transaksi" /></label>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setModal(null)} className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]">Batal</button><PrimaryButton type="submit" disabled={isSaving || !accounts.length}>{isSaving ? "Menyimpan…" : "Simpan Mutasi"}</PrimaryButton></div>
          </form>
        </ModalFrame>
      )}

      {modal === "invoice" && (
        <ModalFrame title="Buat tagihan baru" description="Tagihan dibuat hanya untuk santri aktif. Tagihan komponen yang sama pada periode yang sama tidak akan diduplikasi." onClose={() => !isSaving && setModal(null)}>
          <form onSubmit={submitInvoiceGeneration} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-[#55566f]">Komponen iuran
              <select name="component_id" required defaultValue="" className={`${amountInputClass} mt-1.5`}><option value="" disabled>Pilih komponen</option>{components.map((component) => <option key={component.id} value={component.id}>{component.name} · {component.category} · {formatRupiah(Number(component.amount))}</option>)}</select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#55566f]">Bulan<select name="month" defaultValue={currentDate ? String(Number(currentDate.slice(5, 7))) : "1"} className={`${amountInputClass} mt-1.5`}>{monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
              <TextField label="Tahun" name="year" type="number" min="2020" defaultValue={currentDate.slice(0, 4)} />
            </div>
            <label className="block text-xs font-semibold text-[#55566f]">Target tagihan<select name="target" value={invoiceTarget} onChange={(event) => setInvoiceTarget(event.target.value as "all" | "selected")} className={`${amountInputClass} mt-1.5`}><option value="all">Semua santri aktif</option><option value="selected">Santri tertentu</option></select></label>
            {invoiceTarget === "selected" && <label className="block text-xs font-semibold text-[#55566f]">Pilih santri (Ctrl/Cmd untuk memilih beberapa)
              <select name="student_ids" multiple size={5} className={`${amountInputClass} mt-1.5 h-auto py-2`}>{students.filter((student) => student.status === "aktif").map((student) => <option key={student.id} value={student.id}>{student.nama_lengkap} · {student.nis ?? "NIS belum ada"}</option>)}</select>
            </label>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setModal(null)} className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]">Batal</button><PrimaryButton type="submit" disabled={isSaving || !components.length}>{isSaving ? "Membuat…" : "Buat Tagihan"}</PrimaryButton></div>
          </form>
        </ModalFrame>
      )}

      {modal === "payment" && selectedInvoice && (
        <ModalFrame title="Catat pembayaran iuran" description="Pembayaran, kuitansi, mutasi masuk, dan saldo kas diperbarui atomik." onClose={() => !isSaving && setModal(null)}>
          <div className="mt-5 rounded-2xl bg-[#f8f9ff] p-4 text-xs">
            <p className="font-bold">{selectedStudent?.nama_lengkap ?? "Santri"}</p>
            <p className="mt-1 text-[#757693]">NIS {selectedStudent?.nis ?? "—"} · {selectedComponent?.name ?? "Tagihan"} · {monthNames[selectedInvoice.month - 1]} {selectedInvoice.year}</p>
            <div className="mt-3 flex justify-between gap-3"><span className="text-[#757693]">Sisa tagihan</span><strong className="tabular-nums">{formatRupiah(Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount))}</strong></div>
          </div>
          <form onSubmit={submitPayment} className="mt-4 space-y-4">
            <input type="hidden" name="invoice_id" value={selectedInvoice.id} />
            <label className="block text-xs font-semibold text-[#55566f]">Rekening tujuan
              <select name="account_id" required defaultValue="" className={`${amountInputClass} mt-1.5`}><option value="" disabled>Pilih rekening kas masuk</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatRupiah(Number(account.balance))}</option>)}</select>
            </label>
            <TextField label="Nominal bayar (Rp)" name="amount" type="number" min="1" defaultValue={String(Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount))} />
            <SelectField label="Metode pembayaran" name="method" defaultValue="tunai"><option value="tunai">Tunai</option><option value="transfer">Transfer</option></SelectField>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setModal(null)} className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]">Batal</button><PrimaryButton type="submit" disabled={isSaving || !accounts.length}>{isSaving ? "Menyimpan…" : "Simpan Pembayaran"}</PrimaryButton></div>
          </form>
        </ModalFrame>
      )}

      {selectedPayment && paymentInvoice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#181c31]/35 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
          <section className="w-full max-w-md rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_24px_80px_rgba(24,28,49,0.18)] print:max-w-none print:border-0 print:p-0 print:shadow-none">
            <div className="receipt-print mx-auto max-w-sm">
              <div className="text-center">
                {receiptInstitution?.show_logo_kuitansi && receiptInstitution.logo_url && (
                  <Image
                    src={receiptInstitution.logo_url}
                    alt={`Logo ${receiptInstitution.nama_pesantren}`}
                    width={96}
                    height={96}
                    unoptimized
                    className={`mx-auto mb-2 w-auto max-w-full object-contain ${receiptInstitution.logo_height}`}
                  />
                )}
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4457ff]">Pondok Pesantren</p>
                <h2 className="mt-1 text-xl font-bold">{receiptInstitution?.nama_pesantren ?? "Nurul Albab"}</h2>
                {receiptInstitution?.alamat && <p className="mt-1 text-[10px] text-[#757693]">{receiptInstitution.alamat}</p>}
                <p className="mt-1 text-[10px] text-[#757693]">Kuitansi pembayaran iuran santri</p>
              </div>
              <div className="my-5 border-y border-dashed border-[#cfd2e3] py-4 text-xs">
                <ReceiptRow label="Santri" value={paymentStudent?.nama_lengkap ?? "—"} />
                <ReceiptRow label="NIS" value={paymentStudent?.nis ?? "—"} />
                <ReceiptRow label="Komponen" value={paymentComponent?.name ?? "Tagihan"} />
                <ReceiptRow label="Periode" value={`${monthNames[paymentInvoice.month - 1]} ${paymentInvoice.year}`} />
                <ReceiptRow label="Nominal dibayar" value={formatRupiah(Number(selectedPayment.amount))} strong />
                <ReceiptRow label="Tanggal" value={formatDateTime(selectedPayment.paid_at)} />
                <ReceiptRow label="Petugas" value={selectedPayment.received_by ? profiles.get(selectedPayment.received_by) ?? `Petugas (${selectedPayment.received_by.slice(0, 8)})` : "Petugas"} />
                <ReceiptRow label="Metode" value={selectedPayment.method === "tunai" ? "Tunai" : "Transfer"} />
              </div>
              <p className="text-center text-[10px] text-[#8a8ba2]">{receiptInstitution?.footer_kuitansi || "Simpan bukti ini sebagai arsip pembayaran."}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2 print:hidden"><button type="button" onClick={() => setSelectedPayment(null)} className="min-h-10 rounded-full px-4 text-xs font-semibold text-[#757693] hover:bg-[#f3f5ff]">Tutup</button><PrimaryButton onClick={() => window.print()}><Icon name="receipt" size={15} /> Cetak Kuitansi</PrimaryButton></div>
          </section>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .receipt-print, .receipt-print * { visibility: visible !important; }
          .receipt-print { position: fixed; inset: 0; margin: 0 auto; width: 100%; padding: 24px; color: #181c31; background: #fff; }
          @page { size: A5 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}

function Pagination({ page, pageCount, rowCount, onChange }: {
  page: number;
  pageCount: number;
  rowCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f0f5] px-5 py-3 text-[10px] text-[#8a8ba2] sm:px-6">
      <span>{rowCount ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rowCount)} dari ${rowCount} data` : "0 data"}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="min-h-9 rounded-full border border-[#e5e7eb] px-3 disabled:opacity-40">Sebelumnya</button>
        <span>Halaman {page} / {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="min-h-9 rounded-full border border-[#e5e7eb] px-3 disabled:opacity-40">Berikutnya</button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-[#757693]">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}