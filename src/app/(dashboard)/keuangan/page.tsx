"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { FormMessage, PageHeading, PillTabs, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export interface UnifiedAccount {
  id: string;
  name: string;
  account_number: string;
  balance: number;
  opening_balance: number;
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
  keterangan?: string | null;
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
  type: "debit" | "kredit";
  category: string;
  description: string;
  amount: number;
  pos_anggaran?: string | null;
  created_by: string | null;
  created_at?: string;
}

type Student = { id: string; nis: string | null; nama_lengkap: string; status: string };
type RawFinanceRow = Record<string, unknown>;
type FinanceTab = "overview" | "kas_pondok" | "kas_bendahara" | "invoices";
type Modal = "movement" | "payment" | "student_detail" | "edit_invoice" | null;

const pageSize = 10;
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const amountInputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

const DEFAULT_ENVELOPE_CAPS = {
  listrik: 30000,
  gas: 10000,
  kesehatan: 10000,
  kas_wajib: 10000,
  kas_kamar: 10000,
  tak_terduga: 15000,
};

function getTodayISO() {
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
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

// Perhitungan hierarki alokasi iuran (mendukung cicilan & pembayaran beberapa bulan sekaligus)
function calculateHierarchy(paidAmount: number, caps = DEFAULT_ENVELOPE_CAPS) {
  const oneCycle = caps.listrik + caps.gas + caps.kesehatan + caps.kas_wajib + caps.kas_kamar + caps.tak_terduga;
  const remaining = Math.max(0, paidAmount);

  const fullCycles = oneCycle > 0 ? Math.floor(remaining / oneCycle) : 0;
  let sisa = oneCycle > 0 ? remaining % oneCycle : remaining;

  let listrik = fullCycles * caps.listrik;
  let gas = fullCycles * caps.gas;
  let kesehatan = fullCycles * caps.kesehatan;
  let kasWajib = fullCycles * caps.kas_wajib;
  let kasKamar = fullCycles * caps.kas_kamar;
  let takTerduga = fullCycles * caps.tak_terduga;

  const addListrik = Math.min(sisa, caps.listrik);
  listrik += addListrik;
  sisa -= addListrik;

  const addGas = Math.min(sisa, caps.gas);
  gas += addGas;
  sisa -= addGas;

  const addKesehatan = Math.min(sisa, caps.kesehatan);
  kesehatan += addKesehatan;
  sisa -= addKesehatan;

  const addKasWajib = Math.min(sisa, caps.kas_wajib);
  kasWajib += addKasWajib;
  sisa -= addKasWajib;

  const addKasKamar = Math.min(sisa, caps.kas_kamar);
  kasKamar += addKasKamar;
  sisa -= addKasKamar;

  const addTakTerduga = Math.min(sisa, caps.tak_terduga);
  takTerduga += addTakTerduga;
  sisa -= addTakTerduga;

  if (sisa > 0) {
    takTerduga += sisa;
  }

  return { listrik, gas, kesehatan, kasWajib, kasKamar, takTerduga };
}

function ModalFrame({ title, description, onClose, children }: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4.5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup modal" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
            <Icon name="close" size={15} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function KeuanganPage() {
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [cashEntries, setCashEntries] = useState<UnifiedCashEntry[]>([]);
  const [envelopeCaps, setEnvelopeCaps] = useState(DEFAULT_ENVELOPE_CAPS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<Modal>(null);

  // State Tanggal Stabil (Aman dari SSR Prerender Error Next.js 16)
  const [todayDate, setTodayDate] = useState("2026-10-26");
  const [activeMonth, setActiveMonth] = useState(10);
  const [activeYear, setActiveYear] = useState(2026);

  // Form states Mutasi
  const [movementAccountType, setMovementAccountType] = useState<"pondok" | "bendahara">("bendahara");
  const [movementType, setMovementType] = useState<"debit" | "kredit">("kredit");
  const [movementPos, setMovementPos] = useState<string>("listrik");
  const [customPosName, setCustomPosName] = useState("");

  // Form states Pembayaran
  const [payStudentId, setPayStudentId] = useState("");
  const [payMonth, setPayMonth] = useState("10");
  const [payYear, setPayYear] = useState("2026");
  const [payAmountInput, setPayAmountInput] = useState<number>(85000);
  const [payMethod, setPayMethod] = useState<"tunai" | "transfer">("tunai");
  const [payKeterangan, setPayKeterangan] = useState("");

  // Detail & Edit Tagihan Santri
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<UnifiedInvoice | null>(null);
  const [editTotalAmount, setEditTotalAmount] = useState<number>(85000);
  const [editKeterangan, setEditKeterangan] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);

  // Filter Mutasi
  const [cashQuery, setCashQuery] = useState("");
  const [cashFilterCategory, setCashFilterCategory] = useState("Semua kategori");
  const [cashMonthFilter, setCashMonthFilter] = useState("Semua bulan");
  const [cashYearFilter, setCashYearFilter] = useState("Semua tahun");
  const [cashSortOrder, setCashSortOrder] = useState<"desc" | "asc">("desc");
  const [cashPage, setCashPage] = useState(1);

  // Filter Santri
  const [studentFinanceQuery, setStudentFinanceQuery] = useState("");
  const [studentFinanceStatus, setStudentFinanceStatus] = useState("Semua status");
  const [studentPage, setStudentPage] = useState(1);

  // Kunci pencegah race-condition saat auto-provisioning tagihan
  const isProvisioningRef = useRef(false);

  // Inisialisasi tanggal riil setelah komponen dipasang di browser
  useEffect(() => {
    const iso = getTodayISO();
    const [yStr, mStr] = iso.split("-");
    const m = Number(mStr);
    const y = Number(yStr);
    setTodayDate(iso);
    setActiveMonth(m);
    setActiveYear(y);
    setPayMonth(String(m));
    setPayYear(String(y));
  }, []);

  // Fungsi Utama Pemuat Data Keuangan
  const loadFinanceData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // 1. Muat pengaturan komponen iuran terlebih dahulu
    let activeCaps = { ...DEFAULT_ENVELOPE_CAPS };
    const { data: compData } = await supabase.from("komponen_iuran").select("*").eq("is_active", true);
    if (compData && compData.length > 0) {
      for (const raw of compData) {
        const c = raw as Record<string, unknown>;
        const name = String(c.name || c.nama_pos || "").toLowerCase();
        const amt = Number(c.amount ?? c.nominal ?? 0);
        if (amt > 0) {
          if (name.includes("listrik")) activeCaps.listrik = amt;
          else if (name.includes("gas")) activeCaps.gas = amt;
          else if (name.includes("sehat") || name.includes("kesehatan")) activeCaps.kesehatan = amt;
          else if (name.includes("wajib")) activeCaps.kas_wajib = amt;
          else if (name.includes("kamar")) activeCaps.kas_kamar = amt;
          else if (name.includes("terduga")) activeCaps.tak_terduga = amt;
        }
      }
      setEnvelopeCaps(activeCaps);
    }

    const totalStandardBill =
      activeCaps.listrik +
      activeCaps.gas +
      activeCaps.kesehatan +
      activeCaps.kas_wajib +
      activeCaps.kas_kamar +
      activeCaps.tak_terduga;

    // 2. Ambil seluruh tabel transaksi
    const [accountResult, studentResult, invoiceResult, paymentResult, cashResult] = await Promise.all([
      supabase.from("rekening_kas").select("*"),
      supabase.from("santri").select("id, nis, nama_lengkap, status").neq("status", "pending_ppdb"),
      supabase.from("tagihan_santri").select("*"),
      supabase.from("pembayaran_iuran").select("*"),
      supabase.from("jurnal_kas").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    let rawAccounts = (accountResult.data ?? []) as unknown as RawFinanceRow[];

    // Pastikan 2 rekening utama benar-benar ada di database Supabase (bukan sekadar objek palsu di memori)
    const hasPondok = rawAccounts.some((a) => rawString(a, "name", rawString(a, "nama_kas")).toLowerCase().includes("pondok"));
    const hasBendahara = rawAccounts.some((a) => rawString(a, "name", rawString(a, "nama_kas")).toLowerCase().includes("bendahara"));

    if (!hasPondok || !hasBendahara) {
      const toInsert: Record<string, unknown>[] = [];
      if (!hasPondok) toInsert.push({ name: "Kas Pondok", account_number: "PNDK-01", balance: 0, opening_balance: 0, is_active: true });
      if (!hasBendahara) toInsert.push({ name: "Kas Bendahara", account_number: "BNDH-01", balance: 0, opening_balance: 0, is_active: true });
      if (toInsert.length > 0) {
        const { data: newAccs } = await supabase.from("rekening_kas").insert(toInsert as never).select();
        if (newAccs) {
          rawAccounts = [...rawAccounts, ...(newAccs as unknown as RawFinanceRow[])];
        }
      }
    }

    // Normalisasi Jurnal Kas (Dengan proteksi transaksi penjualan POS agar selalu masuk / debit)
    const mappedEntries: UnifiedCashEntry[] = ((cashResult.data ?? []) as unknown as RawFinanceRow[]).map((e) => {
      const id = rawString(e, "id");
      const proofNumber = rawString(e, "proof_number") || rawString(e, "nomor_bukti") || `TRX-${id.slice(0, 8)}`;
      const rawCategory = rawString(e, "category") || rawString(e, "kategori") || "Operasional";
      const rawDesc = rawString(e, "description") || rawString(e, "keterangan") || "-";
      const rawType = rawString(e, "type").toLowerCase();

      // Transaksi dari kasir POS / Penjualan Toko Koperasi adalah hakikatnya pemasukan (debit)
      const isPosSale =
        proofNumber.toUpperCase().startsWith("POS-") ||
        rawCategory.toLowerCase().includes("penjualan") ||
        rawDesc.toLowerCase().includes("penjualan");

      const finalType: "debit" | "kredit" = isPosSale ? "debit" : (rawType === "kredit" ? "kredit" : "debit");

      return {
        id,
        account_id: rawString(e, "account_id") || rawString(e, "rekening_id"),
        transaction_date: rawString(e, "transaction_date") || rawString(e, "tanggal") || "2026-10-26",
        proof_number: proofNumber,
        type: finalType,
        category: rawCategory,
        description: rawDesc,
        amount: Math.abs(rawNumber(e, "amount", rawNumber(e, "nominal"))),
        pos_anggaran: rawNullableString(e, "pos_anggaran"),
        created_by: rawNullableString(e, "created_by"),
        created_at: rawNullableString(e, "created_at") ?? undefined,
      };
    });

    // Normalisasi Akun Kas
    const mappedAccounts: UnifiedAccount[] = rawAccounts.map((a) => {
      const id = rawString(a, "id");
      const opening = rawNumber(a, "opening_balance", rawNumber(a, "saldo_awal", 0));
      // Hitung saldo dari jurnal_kas untuk memastikan keakuratan mutlak
      const journalSum = mappedEntries
        .filter((e) => e.account_id === id)
        .reduce((acc, e) => acc + (e.type === "debit" ? e.amount : -e.amount), 0);

      const dbBalance = rawNumber(a, "balance", rawNumber(a, "saldo", 0));
      // Jika ada jurnal untuk akun ini, gunakan hasil perhitungan jurnal + saldo awal
      const hasJournal = mappedEntries.some((e) => e.account_id === id);
      const computedBalance = hasJournal ? opening + journalSum : dbBalance;

      return {
        id,
        name: rawString(a, "name") || rawString(a, "nama_kas") || rawString(a, "nama") || "Kas",
        account_number: rawString(a, "account_number") || rawString(a, "nomor_rekening") || "-",
        balance: computedBalance,
        opening_balance: opening,
        is_active: typeof a.is_active === "boolean" ? a.is_active : true,
      };
    });

    let rawInvoices = (invoiceResult.data ?? []) as unknown as RawFinanceRow[];
    const activeStudents = (studentResult.data ?? []).filter((s) => s.status === "aktif");

    // 3. Auto-Provisioning Tagihan Bulan Berjalan (Dilindungi Lock agar tidak pernah duplikat)
    const isoNow = getTodayISO();
    const curYear = Number(isoNow.slice(0, 4));
    const curMonth = Number(isoNow.slice(5, 7));

    if (!isProvisioningRef.current && activeStudents.length > 0) {
      isProvisioningRef.current = true;
      const missingInvoices: Record<string, unknown>[] = [];

      for (const st of activeStudents) {
        const exists = rawInvoices.some((inv) => {
          let m = rawNumber(inv, "month");
          let y = rawNumber(inv, "year");
          const p = inv.periode_bulan;
          if ((!m || !y) && typeof p === "string" && p.includes("-")) {
            const parts = p.split("-");
            y = Number(parts[0]);
            m = Number(parts[1]);
          }
          return rawString(inv, "santri_id") === st.id && m === curMonth && y === curYear;
        });

        if (!exists) {
          missingInvoices.push({
            santri_id: st.id,
            month: curMonth,
            year: curYear,
            total_amount: totalStandardBill,
            paid_amount: 0,
            is_paid: false,
            periode_bulan: `${curYear}-${String(curMonth).padStart(2, "0")}`,
          });
        }
      }

      if (missingInvoices.length > 0) {
        const { data: inserted } = await supabase
          .from("tagihan_santri")
          .upsert(missingInvoices as never, { onConflict: "santri_id,month,year", ignoreDuplicates: true })
          .select();
        if (inserted) {
          rawInvoices = [...rawInvoices, ...(inserted as unknown as RawFinanceRow[])];
        }
      }
      isProvisioningRef.current = false;
    }

    const mappedInvoices: UnifiedInvoice[] = rawInvoices.map((inv) => {
      let m = rawNumber(inv, "month");
      let y = rawNumber(inv, "year");
      const period = inv.periode_bulan;
      if ((!m || !y) && typeof period === "string" && period.includes("-")) {
        const parts = period.split("-");
        y = Number(parts[0]);
        m = Number(parts[1]);
      }
      const totalAmount = rawNumber(inv, "total_amount", rawNumber(inv, "nominal", totalStandardBill));
      const paidAmount = rawNumber(inv, "paid_amount", rawNumber(inv, "terbayar", 0));
      return {
        id: rawString(inv, "id"),
        santri_id: rawString(inv, "santri_id"),
        component_id: rawNullableString(inv, "component_id"),
        month: m || curMonth,
        year: y || curYear,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        is_paid: paidAmount >= totalAmount && totalAmount > 0,
        keterangan: rawNullableString(inv, "keterangan"),
        created_at: rawNullableString(inv, "created_at") ?? undefined,
      };
    });

    const mappedPayments: UnifiedPayment[] = ((paymentResult.data ?? []) as unknown as RawFinanceRow[]).map((p) => ({
      id: rawString(p, "id"),
      invoice_id: rawString(p, "invoice_id") || rawString(p, "tagihan_id"),
      amount: rawNumber(p, "amount", rawNumber(p, "nominal")),
      method: rawString(p, "method") || rawString(p, "metode") || "tunai",
      paid_at: rawString(p, "paid_at") || rawString(p, "created_at") || `${isoNow}T00:00:00Z`,
      received_by: rawNullableString(p, "received_by"),
    }));

    setAccounts(mappedAccounts);
    setStudents(studentResult.data ?? []);
    setInvoices(mappedInvoices);
    setPayments(mappedPayments);
    setCashEntries(mappedEntries);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  // Identifikasi Akun Pondok & Bendahara (Mendukung penggabungan jika sempat ada >1 akun serupa)
  const pondokAccounts = useMemo(() => accounts.filter((a) => a.name.toLowerCase().includes("pondok")), [accounts]);
  const bendaharaAccounts = useMemo(() => accounts.filter((a) => a.name.toLowerCase().includes("bendahara")), [accounts]);

  const kasPondok = pondokAccounts[0] ?? accounts[0];
  const kasBendahara = bendaharaAccounts[0] ?? accounts[1] ?? accounts[0];

  const totalSaldoPondok = useMemo(() => pondokAccounts.reduce((s, a) => s + a.balance, 0), [pondokAccounts]);
  const totalSaldoBendahara = useMemo(() => bendaharaAccounts.reduce((s, a) => s + a.balance, 0), [bendaharaAccounts]);

  const pondokIds = useMemo(() => new Set(pondokAccounts.map((a) => a.id)), [pondokAccounts]);
  const bendaharaIds = useMemo(() => new Set(bendaharaAccounts.map((a) => a.id)), [bendaharaAccounts]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // KALKULASI 6 AMPLOP VIRTUAL YANG AKURAT & KONSISTEN
  const envelopeCalculated = useMemo(() => {
    const collected = { listrik: 0, gas: 0, kesehatan: 0, kas_wajib: 0, kas_kamar: 0, tak_terduga: 0 };

    // 1. Hitung dari seluruh pembayaran santri yang masuk
    for (const inv of invoices) {
      if (inv.paid_amount > 0) {
        const alloc = calculateHierarchy(inv.paid_amount, envelopeCaps);
        collected.listrik += alloc.listrik;
        collected.gas += alloc.gas;
        collected.kesehatan += alloc.kesehatan;
        collected.kas_wajib += alloc.kasWajib;
        collected.kas_kamar += alloc.kasKamar;
        collected.tak_terduga += alloc.takTerduga;
      }
    }

    // 2. Hitung pemasukan/pengeluaran manual di Kas Bendahara
    const spent = { listrik: 0, gas: 0, kesehatan: 0, kas_kamar: 0, tak_terduga: 0 };
    let manualDebitBendahara = 0;

    for (const e of cashEntries) {
      const isBendahara = bendaharaIds.has(e.account_id);
      if (!isBendahara) continue;

      if (e.type === "debit" && !e.proof_number.startsWith("PAY-") && e.category !== "Iuran Santri") {
        // Jika ada pemasukan manual di luar iuran santri ke Kas Bendahara, tambahkan ke cadangan tak terduga
        manualDebitBendahara += e.amount;
      } else if (e.type === "kredit" && !e.proof_number.startsWith("TRF-") && e.pos_anggaran !== "kas_wajib") {
        const cat = (e.pos_anggaran || e.category || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();

        if (cat.includes("listrik") || desc.includes("listrik") || desc.includes("token")) {
          spent.listrik += e.amount;
        } else if (cat.includes("gas") || desc.includes("gas") || desc.includes("elpiji")) {
          spent.gas += e.amount;
        } else if (cat.includes("sehat") || cat.includes("kesehatan") || desc.includes("obat") || desc.includes("panadol")) {
          spent.kesehatan += e.amount;
        } else if (cat.includes("kamar") || desc.includes("kamar")) {
          spent.kas_kamar += e.amount;
        } else {
          spent.tak_terduga += e.amount;
        }
      }
    }

    const saldoListrik = Math.max(0, collected.listrik - spent.listrik);
    const saldoGas = Math.max(0, collected.gas - spent.gas);
    const saldoKesehatan = Math.max(0, collected.kesehatan - spent.kesehatan);
    const saldoKasKamar = Math.max(0, collected.kas_kamar - spent.kas_kamar);
    const saldoTakTerduga = Math.max(0, collected.tak_terduga + manualDebitBendahara - spent.tak_terduga);

    // Total fisik uang yang ada di 5 amplop aktif Bendahara
    const totalAmplopAktif = saldoListrik + saldoGas + saldoKesehatan + saldoKasKamar + saldoTakTerduga;

    return {
      listrik: saldoListrik,
      gas: saldoGas,
      kesehatan: saldoKesehatan,
      kas_wajib: collected.kas_wajib,
      kas_kamar: saldoKasKamar,
      tak_terduga: saldoTakTerduga,
      totalDanaBendahara: totalAmplopAktif,
      collected,
      spent,
    };
  }, [invoices, cashEntries, bendaharaIds, envelopeCaps]);

  // DAFTAR KEUANGAN BERBASIS SANTRI
  const studentFinanceList = useMemo(() => {
    return students.map((s) => {
      const studentInvoices = invoices.filter((inv) => inv.santri_id === s.id);
      const currentMonthInvoice = studentInvoices.find((inv) => inv.month === activeMonth && inv.year === activeYear);

      const totalBilled = studentInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const totalPaid = studentInvoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
      const totalOutstanding = Math.max(0, totalBilled - totalPaid);

      return {
        student: s,
        currentInvoice: currentMonthInvoice,
        totalPaid,
        totalOutstanding,
        isCurrentPaid: currentMonthInvoice ? currentMonthInvoice.is_paid : false,
      };
    });
  }, [students, invoices, activeMonth, activeYear]);

  // Filter Daftar Santri
  const filteredStudents = useMemo(() => {
    const q = studentFinanceQuery.trim().toLowerCase();
    return studentFinanceList.filter((item) => {
      const matchSearch = !q || item.student.nama_lengkap.toLowerCase().includes(q) || (item.student.nis?.toLowerCase().includes(q) ?? false);
      const matchStatus =
        studentFinanceStatus === "Semua status" ||
        (studentFinanceStatus === "Lunas Bulan Ini" && item.isCurrentPaid) ||
        (studentFinanceStatus === "Ada Tunggakan" && item.totalOutstanding > 0);
      return matchSearch && matchStatus;
    });
  }, [studentFinanceList, studentFinanceQuery, studentFinanceStatus]);

  const visibleStudents = filteredStudents.slice((studentPage - 1) * pageSize, studentPage * pageSize);
  const pageCountStudent = Math.max(1, Math.ceil(filteredStudents.length / pageSize));

  // Filter Mutasi Kas
  const filteredCash = useMemo(() => {
    const q = cashQuery.trim().toLowerCase();
    return cashEntries.filter((e) => {
      if (tab === "kas_pondok" && !pondokIds.has(e.account_id)) return false;
      if (tab === "kas_bendahara" && !bendaharaIds.has(e.account_id)) return false;

      const matchCat = cashFilterCategory === "Semua kategori" || e.category === cashFilterCategory;
      const matchQ = !q || e.description.toLowerCase().includes(q) || e.proof_number.toLowerCase().includes(q);

      const [yStr, mStr] = (e.transaction_date || "2026-10-26").split("-");
      const matchMonth = cashMonthFilter === "Semua bulan" || String(Number(mStr)) === cashMonthFilter;
      const matchYear = cashYearFilter === "Semua tahun" || yStr === cashYearFilter;

      return matchCat && matchQ && matchMonth && matchYear;
    }).sort((a, b) => {
      const diff = (b.transaction_date || "").localeCompare(a.transaction_date || "");
      return cashSortOrder === "desc" ? diff : -diff;
    });
  }, [cashEntries, tab, pondokIds, bendaharaIds, cashQuery, cashFilterCategory, cashMonthFilter, cashYearFilter, cashSortOrder]);

  const visibleCash = filteredCash.slice((cashPage - 1) * pageSize, cashPage * pageSize);
  const pageCountCash = Math.max(1, Math.ceil(filteredCash.length / pageSize));

  // SUBMIT MUTASI KAS MANUAL
  async function submitMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const description = String(fd.get("description") ?? "").trim();
    const date = String(fd.get("transaction_date") ?? todayDate);

    const targetAccount = movementAccountType === "pondok" ? kasPondok : kasBendahara;
    if (!targetAccount || amount <= 0 || !description) {
      setMessage("Pastikan rekening aktif, nominal lebih dari 0, dan uraian terisi.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const supabase = createClient();
    const finalCategory =
      movementAccountType === "bendahara" && movementType === "kredit"
        ? movementPos === "custom" && customPosName
          ? customPosName
          : movementPos
        : movementAccountType === "pondok"
        ? "Operasional Pondok"
        : "Pemasukan Kas";

    const proofNumber = `MUT-${Date.now().toString().slice(-6)}`;

    const { error: errJurnal } = await supabase.from("jurnal_kas").insert([
      {
        account_id: targetAccount.id,
        type: movementType,
        category: finalCategory,
        pos_anggaran: movementAccountType === "bendahara" ? finalCategory : null,
        description,
        amount,
        transaction_date: date,
        proof_number: proofNumber,
      } as never,
    ]);

    if (errJurnal) {
      setMessage(`Gagal menyimpan jurnal mutasi: ${errJurnal.message}`);
      setIsSaving(false);
      return;
    }

    const newBal = movementType === "debit" ? targetAccount.balance + amount : targetAccount.balance - amount;
    const { error: errBal } = await supabase
      .from("rekening_kas")
      .update({ balance: newBal } as never)
      .eq("id", targetAccount.id);

    if (errBal) {
      console.warn("Peringatan update saldo:", errBal.message);
    }

    setMessage(`Mutasi ${movementType === "debit" ? "pemasukan" : "pengeluaran"} ${formatRupiah(amount)} berhasil dicatat.`);
    setModal(null);
    await loadFinanceData();
    setIsSaving(false);
  }

  // SUBMIT PEMBAYARAN IURAN SANTRI (DENGAN ERROR HANDLING KETAT)
  async function submitDirectPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payStudentId || payAmountInput <= 0 || !kasBendahara) {
      setMessage("Pilih santri dan masukkan nominal pembayaran yang valid.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const supabase = createClient();
    const m = Number(payMonth);
    const y = Number(payYear);
    const totalBill =
      envelopeCaps.listrik +
      envelopeCaps.gas +
      envelopeCaps.kesehatan +
      envelopeCaps.kas_wajib +
      envelopeCaps.kas_kamar +
      envelopeCaps.tak_terduga;

    let invoice = invoices.find((i) => i.santri_id === payStudentId && i.month === m && i.year === y);

    if (!invoice) {
      const { data: newInv, error: invErr } = await supabase
        .from("tagihan_santri")
        .insert([
          {
            santri_id: payStudentId,
            month: m,
            year: y,
            total_amount: totalBill,
            paid_amount: 0,
            is_paid: false,
            periode_bulan: `${y}-${String(m).padStart(2, "0")}`,
          } as never,
        ])
        .select()
        .single();

      if (invErr || !newInv) {
        setMessage(`Gagal menyiapkan tagihan: ${invErr?.message ?? "Tidak dapat membuat tagihan"}`);
        setIsSaving(false);
        return;
      }
      const rawInv = newInv as unknown as RawFinanceRow;
      invoice = {
        id: rawString(rawInv, "id"),
        santri_id: payStudentId,
        component_id: null,
        month: m,
        year: y,
        total_amount: totalBill,
        paid_amount: 0,
        is_paid: false,
      };
    }

    const previousPaid = invoice.paid_amount;
    const newPaid = previousPaid + payAmountInput;
    const isPaidNow = newPaid >= invoice.total_amount;

    const prevAlloc = calculateHierarchy(previousPaid, envelopeCaps);
    const newAlloc = calculateHierarchy(newPaid, envelopeCaps);
    const kasWajibToAdd = Math.max(0, newAlloc.kasWajib - prevAlloc.kasWajib);

    // 1. Update status & terbayar pada tagihan_santri
    const { error: errUpdInv } = await supabase
      .from("tagihan_santri")
      .update({ paid_amount: newPaid, is_paid: isPaidNow } as never)
      .eq("id", invoice.id);

    if (errUpdInv) {
      setMessage(`Gagal memperbarui status tagihan santri: ${errUpdInv.message}`);
      setIsSaving(false);
      return;
    }

    // 2. Simpan histori ke pembayaran_iuran
    const { data: pData, error: errPay } = await supabase
      .from("pembayaran_iuran")
      .insert([
        {
          invoice_id: invoice.id,
          amount: payAmountInput,
          method: payMethod,
          paid_at: new Date().toISOString(),
        } as never,
      ])
      .select()
      .single();

    if (errPay) {
      setMessage(`Gagal mencatat kuitansi pembayaran: ${errPay.message}`);
      setIsSaving(false);
      return;
    }

    const studentName = studentMap.get(payStudentId)?.nama_lengkap ?? "Santri";
    const stamp = Date.now().toString().slice(-6);

    // 3. Catat uang masuk (Debit) ke Kas Bendahara
    const { error: errJurnalBendahara } = await supabase.from("jurnal_kas").insert([
      {
        account_id: kasBendahara.id,
        type: "debit",
        category: "Iuran Santri",
        pos_anggaran: "Iuran Santri",
        description: `Pembayaran iuran santri: ${studentName} (${monthNames[m - 1]} ${y})${payKeterangan ? ` - ${payKeterangan}` : ""}`,
        amount: payAmountInput,
        transaction_date: todayDate,
        proof_number: `PAY-${stamp}`,
      } as never,
    ]);

    if (errJurnalBendahara) {
      setMessage(`Gagal mencatat jurnal Kas Bendahara: ${errJurnalBendahara.message}`);
      setIsSaving(false);
      return;
    }

    // 4. Jika ada porsi Kas Wajib: Transfer Real-Time dari Kas Bendahara ke Kas Pondok
    if (kasWajibToAdd > 0 && kasPondok) {
      const { error: errTrfOut } = await supabase.from("jurnal_kas").insert([
        {
          account_id: kasBendahara.id,
          type: "kredit",
          category: "Kas Wajib",
          pos_anggaran: "kas_wajib",
          description: `Auto-Transfer Kas Wajib ke Pondok (${studentName})`,
          amount: kasWajibToAdd,
          transaction_date: todayDate,
          proof_number: `TRF-${stamp}`,
        } as never,
      ]);

      if (errTrfOut) {
        setMessage(`Gagal mencatat mutasi keluar Kas Wajib: ${errTrfOut.message}`);
        setIsSaving(false);
        return;
      }

      const { error: errTrfIn } = await supabase.from("jurnal_kas").insert([
        {
          account_id: kasPondok.id,
          type: "debit",
          category: "Kas Wajib Santri",
          description: `Penerimaan Kas Wajib santri: ${studentName}`,
          amount: kasWajibToAdd,
          transaction_date: todayDate,
          proof_number: `RCV-${stamp}`,
        } as never,
      ]);

      if (errTrfIn) {
        setMessage(`Gagal mencatat penerimaan Kas Pondok: ${errTrfIn.message}`);
        setIsSaving(false);
        return;
      }

      await supabase
        .from("rekening_kas")
        .update({ balance: kasPondok.balance + kasWajibToAdd } as never)
        .eq("id", kasPondok.id);
    }

    // 5. Update saldo akhir Kas Bendahara (Satu kali operasi bersih)
    const netBendaharaIncrease = payAmountInput - kasWajibToAdd;
    await supabase
      .from("rekening_kas")
      .update({ balance: kasBendahara.balance + netBendaharaIncrease } as never)
      .eq("id", kasBendahara.id);

    setMessage(
      `Iuran ${studentName} sebesar ${formatRupiah(payAmountInput)} berhasil disimpan.${
        kasWajibToAdd > 0
          ? ` Kas Bendahara bertambah ${formatRupiah(netBendaharaIncrease)} & Kas Wajib ${formatRupiah(kasWajibToAdd)} otomatis masuk ke Kas Pondok.`
          : ""
      }`
    );
    setModal(null);
    await loadFinanceData();

    if (pData) {
      const rawP = pData as unknown as RawFinanceRow;
      setSelectedPayment({
        id: rawString(rawP, "id"),
        invoice_id: rawString(rawP, "invoice_id", invoice.id),
        amount: rawNumber(rawP, "amount", payAmountInput),
        method: rawString(rawP, "method", payMethod),
        paid_at: rawString(rawP, "paid_at", new Date().toISOString()),
        received_by: null,
      });
    }
    setIsSaving(false);
  }

  // SIMPAN EDIT TAGIHAN / DISPENSASI
  async function submitEditInvoice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingInvoice) return;
    setIsSaving(true);
    const supabase = createClient();

    const isPaid = editingInvoice.paid_amount >= editTotalAmount && editTotalAmount > 0;
    const { error } = await supabase
      .from("tagihan_santri")
      .update({
        total_amount: editTotalAmount,
        is_paid: isPaid,
        keterangan: editKeterangan || null,
      } as never)
      .eq("id", editingInvoice.id);

    if (error) {
      setMessage(`Gagal memperbarui tagihan: ${error.message}`);
    } else {
      setMessage("Data tagihan santri berhasil diperbarui.");
      setModal("student_detail");
      setEditingInvoice(null);
      await loadFinanceData();
    }
    setIsSaving(false);
  }

  const paymentInvoice = selectedPayment ? invoices.find((i) => i.id === selectedPayment.invoice_id) : undefined;
  const paymentStudent = paymentInvoice ? studentMap.get(paymentInvoice.santri_id) : undefined;

  // Saldo Kas Bendahara yang ditampilkan di kartu utama (selalu klop dengan jurnal & amplop)
  const displayBendaharaBalance = totalSaldoBendahara > 0 ? totalSaldoBendahara : envelopeCalculated.totalDanaBendahara;

  const tabs = [
    { value: "overview" as const, label: "Semua Aktivitas" },
    { value: "kas_pondok" as const, label: "Kas Pondok" },
    { value: "kas_bendahara" as const, label: "Kas Bendahara & Pos" },
    { value: "invoices" as const, label: "Daftar Keuangan Santri" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-3.5 px-2.5 py-3 sm:space-y-6 sm:px-6 sm:py-6">
      {/* 1. HEADER */}
      <PageHeading
        eyebrow="Keuangan & Usaha Pesantren"
        title="Sistem Keuangan"
        description="Kelola Kas Pondok, Kas Bendahara, alokasi amplop virtual, dan tagihan santri."
        action={
          tab === "invoices" ? (
            <PrimaryButton
              onClick={() => {
                setPayStudentId(students[0]?.id ?? "");
                setPayMonth(String(activeMonth));
                setPayYear(String(activeYear));
                setPayAmountInput(85000);
                setModal("payment");
              }}
              className="w-full justify-center sm:w-auto"
            >
              <Icon name="plus" size={15} /> Bayar / Terima Iuran
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setModal("movement")} className="w-full justify-center sm:w-auto">
              <Icon name="plus" size={15} /> Catat Mutasi Kas
            </PrimaryButton>
          )
        }
      />

      {message && <FormMessage>{message}</FormMessage>}

      {/* 2. KARTU SALDO REKENING */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* KAS PONDOK */}
        <article className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white to-blue-50/40 p-4 shadow-xs sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Kas Pondok (Operasional)</span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-blue-100 text-[#4457ff]">
              <Icon name="wallet" size={16} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-black tabular-nums text-slate-800 sm:text-3xl">
            {formatRupiah(totalSaldoPondok)}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>SHU Koperasi & Kas Wajib</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Real-time
            </span>
          </div>
        </article>

        {/* KAS BENDAHARA */}
        <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-xs sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Kas Bendahara (Iuran)</span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Icon name="users" size={16} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-black tabular-nums text-slate-800 sm:text-3xl">
            {formatRupiah(displayBendaharaBalance)}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rp85.000 / santri / bulan</span>
            <span className="font-semibold text-slate-700">5 Pos Aktif Tersedia</span>
          </div>
        </article>

        {/* IURAN BULAN INI */}
        <article className="col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:col-span-2 sm:p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Iuran Santri Bulan Ini</span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name="receipt" size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black tabular-nums text-slate-800 sm:text-3xl">
              {studentFinanceList.filter((item) => item.isCurrentPaid).length}{" "}
              <span className="text-sm font-medium text-slate-400">/ {studentFinanceList.length} Lunas</span>
            </p>
            <button type="button" onClick={() => setTab("invoices")} className="text-xs font-semibold text-[#4457ff] hover:underline">
              Buka buku santri &rarr;
            </button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-500">Terdistribusi otomatis ke 6 pos amanah</p>
        </article>
      </section>

      {/* 3. TABS SELECTOR */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3">
        <PillTabs label="Modul Keuangan" value={tab} options={tabs} onChange={(v) => { setTab(v); setMessage(""); }} />
      </section>

      {/* 4. PANTAUAN 6 POS AMPLOP VIRTUAL */}
      {(tab === "kas_bendahara" || tab === "overview") && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 sm:text-base">Pantauan 6 Amplop Virtual (Kas Bendahara)</h3>
              <p className="text-[11px] text-slate-500">
                Total dana 5 pos aktif di Kas Bendahara: <strong>{formatRupiah(envelopeCalculated.totalDanaBendahara)}</strong> (Kas Wajib otomatis dialihkan ke Kas Pondok)
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Standar: Rp85.000 / santri</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: "listrik", label: "1. Listrik", balance: envelopeCalculated.listrik, target: envelopeCaps.listrik, color: "bg-blue-500" },
              { key: "gas", label: "2. Gas Elpiji", balance: envelopeCalculated.gas, target: envelopeCaps.gas, color: "bg-amber-500" },
              { key: "kesehatan", label: "3. Kesehatan", balance: envelopeCalculated.kesehatan, target: envelopeCaps.kesehatan, color: "bg-emerald-500" },
              { key: "kas_wajib", label: "4. Kas Wajib", balance: envelopeCalculated.kas_wajib, target: envelopeCaps.kas_wajib, note: "Dialihkan ke Kas Pondok", color: "bg-purple-500" },
              { key: "kas_kamar", label: "5. Kas Kamar", balance: envelopeCalculated.kas_kamar, target: envelopeCaps.kas_kamar, color: "bg-indigo-500" },
              { key: "tak_terduga", label: "6. Tak Terduga", balance: envelopeCalculated.tak_terduga, target: envelopeCaps.tak_terduga, color: "bg-rose-500" },
            ].map((pos) => (
              <div key={pos.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">{pos.label}</span>
                  <span className="text-[10px] text-slate-400">{pos.note ? "Termutasi" : "Tersedia"}</span>
                </div>
                <p className="mt-1 text-xs font-bold tabular-nums text-slate-800">{formatRupiah(pos.balance)}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${pos.color}`} style={{ width: pos.balance > 0 ? "100%" : "8%" }} />
                </div>
                <p className="mt-1.5 text-[9px] text-slate-400">
                  {pos.note ? "Masuk ke Kas Pondok" : `Jatah: ${formatRupiah(pos.target)}/santri`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. VIEW BUKU KAS (RIWAYAT MUTASI) */}
      {tab !== "invoices" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="p-3.5 sm:p-5">
            <h2 className="text-sm font-bold text-slate-800 sm:text-base">
              {tab === "kas_pondok" ? "Buku Kas Utama Pondok" : tab === "kas_bendahara" ? "Buku Kas Iuran Bendahara" : "Semua Riwayat Aktivitas Keuangan"}
            </h2>
            <p className="text-[11px] text-slate-500">Mutasi debit, kredit, dan histori saldo kas</p>

            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="col-span-2 sm:col-span-1">
                <input
                  value={cashQuery}
                  onChange={(e) => { setCashQuery(e.target.value); setCashPage(1); }}
                  placeholder="Cari uraian / bukti…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#4457ff]"
                />
              </div>
              <div>
                <select
                  value={cashMonthFilter}
                  onChange={(e) => { setCashMonthFilter(e.target.value); setCashPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-[#4457ff]"
                >
                  <option>Semua bulan</option>
                  {monthNames.map((m, idx) => (
                    <option key={m} value={String(idx + 1)}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={cashYearFilter}
                  onChange={(e) => { setCashYearFilter(e.target.value); setCashPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-[#4457ff]"
                >
                  <option>Semua tahun</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
              <div>
                <select
                  value={cashFilterCategory}
                  onChange={(e) => { setCashFilterCategory(e.target.value); setCashPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-[#4457ff]"
                >
                  <option>Semua kategori</option>
                  {[...new Set(cashEntries.map((e) => e.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={cashSortOrder}
                  onChange={(e) => setCashSortOrder(e.target.value as "desc" | "asc")}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#4457ff]"
                >
                  <option value="desc">Terbaru &darr;</option>
                  <option value="asc">Terlama &uarr;</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Tanggal / Bukti</th>
                  <th className="px-4 py-3">Akun Kas</th>
                  <th className="px-4 py-3">Pos / Uraian</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3 text-center">Tipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleCash.map((e) => {
                  const isDebit = e.type === "debit";
                  const acc = accountMap.get(e.account_id);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{formatDate(e.transaction_date)}</span>
                        <span className="block text-[10px] text-slate-400">{e.proof_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${acc?.name.toLowerCase().includes("pondok") ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {acc?.name ?? "Kas"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{e.category}</span>
                        <span className="block text-[10px] text-slate-500 line-clamp-1">{e.description}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${isDebit ? "text-emerald-600" : "text-rose-600"}`}>
                        {isDebit ? "+" : "−"}{formatRupiah(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge label={isDebit ? "Masuk" : "Keluar"} tone={isDebit ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"} />
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && visibleCash.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">Belum ada mutasi kas yang tercatat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
            <span>Menampilkan {visibleCash.length} dari {filteredCash.length} data</span>
            <div className="flex gap-1.5">
              <button disabled={cashPage <= 1} onClick={() => setCashPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40">Sebelumnya</button>
              <button disabled={cashPage >= pageCountCash} onClick={() => setCashPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        </section>
      )}

      {/* 6. DAFTAR KEUANGAN BERBASIS SANTRI */}
      {tab === "invoices" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="p-3.5 sm:p-5">
            <h2 className="text-sm font-bold text-slate-800 sm:text-base">Daftar Rekapitulasi Keuangan Santri</h2>
            <p className="text-[11px] text-slate-500">Tagihan otomatis terbit setiap awal bulan. Ketuk nama santri untuk melihat histori lengkap</p>

            <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={studentFinanceQuery}
                onChange={(e) => { setStudentFinanceQuery(e.target.value); setStudentPage(1); }}
                placeholder="Cari nama santri / NIS…"
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#4457ff]"
              />
              <select
                value={studentFinanceStatus}
                onChange={(e) => { setStudentFinanceStatus(e.target.value); setStudentPage(1); }}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#4457ff]"
              >
                <option>Semua status</option>
                <option>Lunas Bulan Ini</option>
                <option>Ada Tunggakan</option>
              </select>
              <div className="flex items-center px-1 text-xs text-slate-500">
                Periode Aktif: <strong className="ml-1 text-slate-800">{monthNames[activeMonth - 1]} {activeYear}</strong>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Nama Santri</th>
                  <th className="px-4 py-3">Bulan Ini ({monthNames[activeMonth - 1]})</th>
                  <th className="px-4 py-3 text-right">Total Terbayar</th>
                  <th className="px-4 py-3 text-right">Total Tunggakan</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleStudents.map((item) => {
                  const s = item.student;
                  const curInv = item.currentInvoice;
                  const curSisa = curInv ? Math.max(0, curInv.total_amount - curInv.paid_amount) : 85000;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => { setSelectedStudentForDetail(s); setModal("student_detail"); }}
                          className="group text-left"
                        >
                          <span className="font-bold text-slate-800 group-hover:text-[#4457ff] group-hover:underline">
                            {s.nama_lengkap}
                          </span>
                          <span className="block text-[10px] text-slate-400">NIS: {s.nis ?? "—"}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {item.isCurrentPaid ? (
                          <StatusBadge label="Lunas" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                        ) : (
                          <span className="font-semibold text-amber-700">Kurang {formatRupiah(curSisa)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">
                        {formatRupiah(item.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        <span className={item.totalOutstanding > 0 ? "text-rose-600" : "text-slate-400"}>
                          {item.totalOutstanding > 0 ? formatRupiah(item.totalOutstanding) : "Rp 0"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!item.isCurrentPaid ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPayStudentId(s.id);
                                setPayMonth(String(activeMonth));
                                setPayYear(String(activeYear));
                                setPayAmountInput(curSisa > 0 ? curSisa : 85000);
                                setModal("payment");
                              }}
                              className="rounded-lg bg-[#4457ff] px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition active:scale-95"
                            >
                              Bayar
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Terbayar
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => { setSelectedStudentForDetail(s); setModal("student_detail"); }}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Rincian
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
            <span>Menampilkan {visibleStudents.length} dari {filteredStudents.length} santri</span>
            <div className="flex gap-1.5">
              <button disabled={studentPage <= 1} onClick={() => setStudentPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40">Sebelumnya</button>
              <button disabled={studentPage >= pageCountStudent} onClick={() => setStudentPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL 1: CATAT MUTASI */}
      {modal === "movement" && (
        <ModalFrame title="Catat Mutasi Kas" description="Pencatatan pemasukan atau pengeluaran kas pesantren" onClose={() => setModal(null)}>
          <form onSubmit={submitMovement} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Pilih Rekening Kas</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementAccountType("bendahara")}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${movementAccountType === "bendahara" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}
                >
                  Kas Bendahara
                </button>
                <button
                  type="button"
                  onClick={() => setMovementAccountType("pondok")}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${movementAccountType === "pondok" ? "border-blue-500 bg-blue-50 text-[#4457ff]" : "border-slate-200 text-slate-600"}`}
                >
                  Kas Pondok
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jenis Arus Kas</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType("debit")}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${movementType === "debit" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-600"}`}
                >
                  + Pemasukan (Debit)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("kredit")}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${movementType === "kredit" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-600"}`}
                >
                  − Pengeluaran (Kredit)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nominal (Rp)</label>
                <input name="amount" type="number" min="1000" placeholder="0" required className={amountInputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Transaksi</label>
                <input name="transaction_date" type="date" defaultValue={todayDate} className={amountInputClass} />
              </div>
            </div>

            {movementAccountType === "bendahara" && movementType === "kredit" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Alokasi Beban Pos Anggaran</label>
                <select value={movementPos} onChange={(e) => setMovementPos(e.target.value)} className={amountInputClass}>
                  <option value="listrik">Pos 1: Listrik</option>
                  <option value="gas">Pos 2: Gas Elpiji</option>
                  <option value="kesehatan">Pos 3: Kesehatan</option>
                  <option value="kas_kamar">Pos 5: Kas Kamar</option>
                  <option value="tak_terduga">Pos 6: Biaya Tak Terduga</option>
                  <option value="custom">Kategori Custom (Tulis Bebas)</option>
                </select>
                {movementPos === "custom" && (
                  <input
                    value={customPosName}
                    onChange={(e) => setCustomPosName(e.target.value)}
                    placeholder="Contoh: Pembelian Alat Kebersihan"
                    className={`${amountInputClass} mt-2`}
                    required
                  />
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Uraian / Keterangan Transaksi</label>
              <textarea name="description" rows={2} placeholder="Tuliskan keterangan keperluan transaksi..." required className={`${amountInputClass} h-auto py-2`} />
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600">Batal</button>
              <PrimaryButton type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan…" : "Simpan Mutasi"}
              </PrimaryButton>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* MODAL 2: BAYAR IURAN */}
      {modal === "payment" && (
        <ModalFrame title="Pencatatan Pembayaran Iuran" description="Pilih santri, periode, dan masukkan nominal yang diterima" onClose={() => setModal(null)}>
          <form onSubmit={submitDirectPayment} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Pilih Santri</label>
              <select
                value={payStudentId}
                onChange={(e) => setPayStudentId(e.target.value)}
                required
                className={amountInputClass}
              >
                <option value="" disabled>-- Pilih Nama Santri --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama_lengkap} (NIS: {s.nis ?? "—"})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Bulan Tagihan</label>
                <select value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className={amountInputClass}>
                  {monthNames.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tahun</label>
                <input value={payYear} onChange={(e) => setPayYear(e.target.value)} type="number" className={amountInputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nominal Bayar (Rp)</label>
                <input
                  type="number"
                  min="1000"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(Number(e.target.value))}
                  required
                  className={amountInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Metode Bayar</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as "tunai" | "transfer")} className={amountInputClass}>
                  <option value="tunai">Tunai</option>
                  <option value="transfer">Transfer Bank</option>
                </select>
              </div>
            </div>

            {/* SIMULASI HIERARKI AMPLOP */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Simulasi Alokasi Amplop:</p>
              {(() => {
                const next = calculateHierarchy(payAmountInput, envelopeCaps);
                return (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                    <div>Listrik: <strong className="text-slate-700">{formatRupiah(next.listrik)}</strong></div>
                    <div>Gas: <strong className="text-slate-700">{formatRupiah(next.gas)}</strong></div>
                    <div>Kesehatan: <strong className="text-slate-700">{formatRupiah(next.kesehatan)}</strong></div>
                    <div className="font-semibold text-purple-700">
                      Kas Wajib: {formatRupiah(next.kasWajib)} {next.kasWajib > 0 ? "⚡ Auto-Pondok" : ""}
                    </div>
                    <div>Kas Kamar: <strong className="text-slate-700">{formatRupiah(next.kasKamar)}</strong></div>
                    <div>Tak Terduga: <strong className="text-slate-700">{formatRupiah(next.takTerduga)}</strong></div>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Tambahan (Opsional)</label>
              <input value={payKeterangan} onChange={(e) => setPayKeterangan(e.target.value)} placeholder="Misal: Cicilan ke-1" className={amountInputClass} />
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600">Batal</button>
              <PrimaryButton type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan…" : "Simpan Pembayaran"}
              </PrimaryButton>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* MODAL 3: RINCIAN KEUANGAN SANTRI */}
      {modal === "student_detail" && selectedStudentForDetail && (
        <ModalFrame
          title={`Buku Iuran: ${selectedStudentForDetail.nama_lengkap}`}
          description={`NIS: ${selectedStudentForDetail.nis ?? "—"} • Riwayat tagihan dan pembayaran santri`}
          onClose={() => setModal(null)}
        >
          <div className="mt-4 space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Periode</th>
                    <th className="px-3 py-2.5 text-right">Tagihan</th>
                    <th className="px-3 py-2.5 text-right">Terbayar</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices
                    .filter((inv) => inv.santri_id === selectedStudentForDetail.id)
                    .sort((a, b) => b.year - a.year || b.month - a.month)
                    .map((inv) => {
                      const sisa = Math.max(0, inv.total_amount - inv.paid_amount);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-slate-800">{monthNames[inv.month - 1]} {inv.year}</span>
                            {inv.keterangan && <span className="block text-[10px] text-amber-700">{inv.keterangan}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatRupiah(inv.total_amount)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">{formatRupiah(inv.paid_amount)}</td>
                          <td className="px-3 py-2.5">
                            {inv.is_paid ? (
                              <StatusBadge label="Lunas" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-600">Sisa {formatRupiah(sisa)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!inv.is_paid && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayStudentId(selectedStudentForDetail.id);
                                    setPayMonth(String(inv.month));
                                    setPayYear(String(inv.year));
                                    setPayAmountInput(sisa);
                                    setModal("payment");
                                  }}
                                  className="rounded bg-[#4457ff] px-2 py-0.5 text-[10px] font-semibold text-white"
                                >
                                  Bayar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setEditTotalAmount(inv.total_amount);
                                  setEditKeterangan(inv.keterangan ?? "");
                                  setModal("edit_invoice");
                                }}
                                className="rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* MODAL 4: EDIT TAGIHAN / DISPENSASI */}
      {modal === "edit_invoice" && editingInvoice && (
        <ModalFrame title="Sesuaikan Tagihan Santri" description="Atur nominal khusus (beasiswa/keringanan)" onClose={() => setModal("student_detail")}>
          <form onSubmit={submitEditInvoice} className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-xs">
              <p className="font-bold text-slate-800">{studentMap.get(editingInvoice.santri_id)?.nama_lengkap ?? "Santri"}</p>
              <p className="text-[11px] text-slate-500">Periode: {monthNames[editingInvoice.month - 1]} {editingInvoice.year}</p>
              <p className="mt-1 text-slate-600">Sudah Terbayar: <strong>{formatRupiah(editingInvoice.paid_amount)}</strong></p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nominal Tagihan (Rp)</label>
              <input
                type="number"
                min={editingInvoice.paid_amount}
                value={editTotalAmount}
                onChange={(e) => setEditTotalAmount(Number(e.target.value))}
                required
                className={amountInputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Keterangan Perubahan</label>
              <input
                value={editKeterangan}
                onChange={(e) => setEditKeterangan(e.target.value)}
                placeholder="Misal: Keringanan Anak Yatim / Beasiswa"
                className={amountInputClass}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setModal("student_detail")} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600">Batal</button>
              <PrimaryButton type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan…" : "Simpan Tagihan"}
              </PrimaryButton>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* MODAL KUITANSI PEMBAYARAN */}
      {selectedPayment && paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon name="check" size={20} />
              </div>
              <h3 className="mt-2.5 text-base font-bold text-slate-800">Pembayaran Berhasil</h3>
              <p className="text-xs text-slate-500">Iuran {monthNames[paymentInvoice.month - 1]} {paymentInvoice.year}</p>
            </div>

            <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Santri:</span><span className="font-bold text-slate-700">{paymentStudent?.nama_lengkap ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Nominal:</span><span className="font-bold text-emerald-700">{formatRupiah(selectedPayment.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tanggal:</span><span className="text-slate-600">{formatDateTime(selectedPayment.paid_at)}</span></div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSelectedPayment(null)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600">
                Tutup
              </button>
              <button type="button" onClick={() => window.print()} className="flex-1 rounded-xl bg-[#4457ff] py-2 text-xs font-semibold text-white shadow-xs">
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
