"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { CooperativeNav } from "@/components/cooperative-nav";
import { FormMessage, PageHeading, PrimaryButton } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export interface PosProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  min_stok: number;
  image_url: string | null;
}

type Buyer = { id: string; nis: string | null; nama_lengkap: string };
type Cart = Record<string, number>;
type Receipt = {
  id: string;
  number: string;
  soldAt: string;
  buyerName: string;
  lines: { name: string; sku: string; quantity: number; unitPrice: number; subtotal: number }[];
  total: number;
  cash: number;
  change: number;
};

const categories = ["Semua", "Alat Tulis", "Kitab", "Makanan/Minuman", "Seragam", "Lainnya"];
const quickCash = [10000, 20000, 50000, 100000];
const inputClass = "min-h-12 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#181c31] outline-none focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

function iconForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("kitab") || normalized.includes("buku")) return "📚";
  if (normalized.includes("makan") || normalized.includes("minum")) return "🥤";
  if (normalized.includes("seragam")) return "👕";
  if (normalized.includes("tulis") || normalized.includes("atk")) return "✏️";
  return "🛍️";
}

function categorize(value: string) {
  const category = (value || "").toLowerCase();
  if (category.includes("kitab") || category.includes("buku agama")) return "Kitab";
  if (category.includes("makan") || category.includes("minum")) return "Makanan/Minuman";
  if (category.includes("seragam") || category.includes("pakaian")) return "Seragam";
  if (category.includes("alat tulis") || category.includes("atk") || category.includes("tulis")) return "Alat Tulis";
  return "Lainnya";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizePosProduct(record: Record<string, unknown>): PosProduct {
  const id = String(record.id ?? "");
  return {
    id,
    sku: String(record.sku || record.kode_barang || record.barcode || id.slice(0, 8)),
    barcode: record.barcode ? String(record.barcode) : null,
    name: String(record.name || record.nama_produk || "Produk Tanpa Nama"),
    category: String(record.category || record.kategori || "Lainnya"),
    unit: String(record.unit || record.satuan || "pcs"),
    cost_price: Number(record.hpp ?? record.cost_price ?? record.harga_beli ?? 0),
    selling_price: Number(record.harga_jual ?? record.selling_price ?? record.price ?? 0),
    stock: Number(record.stok ?? record.stock ?? 0),
    min_stok: Number(record.min_stok ?? record.min_stock ?? 5),
    image_url: record.image_url ? String(record.image_url) : null,
  };
}

export default function CooperativePosPage() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [students, setStudents] = useState<Buyer[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [category, setCategory] = useState("Semua");
  const [cashInput, setCashInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // 1. Ambil produk langsung tanpa ketergantungan kolom order tertentu
    const productQuery = supabase.from("produk_koperasi")
      .select("*")
      .eq("is_active", true);

    // 2. Ambil data santri dengan fallback tabel langsung jika RPC belum siap
    const studentsPromise = supabase
      .rpc("cooperative_list_students")
      .then(async (res) => {
        if (res.error) {
          return supabase.from("santri")
            .select("id, nis, nama_lengkap")
            .eq("status", "aktif");
        }
        return res;
      });

    const [productResult, studentResult] = await Promise.all([productQuery, studentsPromise]);

    if (productResult.error) {
      console.error("Gagal memuat produk koperasi:", productResult.error);
      setMessage(`Data POS gagal dimuat: ${productResult.error.message}`);
    } else {
      const mapped = ((productResult.data ?? []) as unknown as Record<string, unknown>[]).map(normalizePosProduct);
      mapped.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
      const sortedStudents = (studentResult.data ?? []).sort(
        (a: { nama_lengkap?: string | null }, b: { nama_lengkap?: string | null }) =>
          String(a.nama_lengkap ?? "").localeCompare(String(b.nama_lengkap ?? ""), "id-ID"),
      );
      setProducts(mapped);
      setStudents(sortedStudents);
      setMessage("");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData().catch((error: unknown) => {
        console.error("Unexpected failure loading cooperative POS.", error);
        setMessage(`Kasir gagal dimuat: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}`);
        setIsLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => {
      const matchesSearch =
        !normalized ||
        product.name.toLocaleLowerCase("id-ID").includes(normalized) ||
        product.sku.toLocaleLowerCase("id-ID").includes(normalized) ||
        (product.barcode ?? "").toLocaleLowerCase("id-ID").includes(normalized);
      return matchesSearch && product.stock > 0 && (category === "Semua" || categorize(product.category) === category);
    });
  }, [category, products, search]);

  const cartLines = products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({
      product,
      quantity: cart[product.id],
      subtotal: Number(product.selling_price) * cart[product.id],
    }));

  const total = cartLines.reduce((sum, line) => sum + line.subtotal, 0);
  const cash = Number(cashInput) || 0;
  const change = Math.max(0, cash - total);
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const filteredBuyers = students.filter((student) =>
    `${student.nama_lengkap} ${student.nis ?? ""}`.toLocaleLowerCase("id-ID").includes(buyerSearch.trim().toLocaleLowerCase("id-ID"))
  );

  function addProduct(product: PosProduct) {
    const quantity = cart[product.id] ?? 0;
    if (quantity >= product.stock) {
      setMessage(`Stok ${product.name} hanya tersedia ${product.stock} unit.`);
      return;
    }
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    setMessage("");
  }

  function changeQuantity(product: PosProduct, amount: number) {
    if ((cart[product.id] ?? 0) + amount > product.stock) {
      setMessage(`Stok ${product.name} hanya tersedia ${product.stock} unit.`);
      return;
    }
    setCart((current) => {
      const nextQuantity = (current[product.id] ?? 0) + amount;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: nextQuantity };
    });
  }

  function startPayment() {
    if (!cartLines.length) {
      setMessage("Tambahkan produk ke keranjang sebelum pembayaran.");
      return;
    }
    setCashInput(String(total));
    setPaymentOpen(true);
  }

  async function completePayment() {
    if (!Number.isFinite(cash) || cash < total) {
      setMessage("Nominal uang diterima belum mencukupi total belanja.");
      return;
    }
    setIsPaying(true);
    setMessage("");

    const lines = [...cartLines];
    const selectedStudent = students.find((student) => student.id === selectedBuyer);

    const supabase = createClient();
    const result = await supabase.rpc("cooperative_checkout", {
      p_items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
      p_cash_received: cash,
      p_santri_id: selectedStudent?.id ?? null,
      p_customer_name: selectedStudent?.nama_lengkap ?? "Pelanggan Umum",
    });

    if (result.error) {
      console.error("Cooperative checkout failed.", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
      setMessage(`Transaksi tidak tersimpan: ${result.error.message || result.error.details || "Terjadi kesalahan database"}`);
      setIsPaying(false);
      return;
    }

    const saved = result.data?.[0];
    if (!saved) {
      console.error("Checkout tidak menghasilkan nomor struk.", result.data);
      setMessage("Transaksi berhasil diproses, memuat ulang data…");
      setIsPaying(false);
      await loadData();
      return;
    }

    setReceipt({
      id: saved.sale_id,
      number: saved.receipt_number,
      soldAt: new Date().toISOString(),
      buyerName: selectedStudent?.nama_lengkap ?? "Pelanggan Umum",
      lines: lines.map(({ product, quantity, subtotal }) => ({
        name: product.name,
        sku: product.sku,
        quantity,
        unitPrice: Number(product.selling_price),
        subtotal,
      })),
      total,
      cash,
      change: cash - total,
    });

    setCart({});
    setCashInput("");
    setPaymentOpen(false);
    setMessage("Pembayaran berhasil dicatat. Stok dan saldo Kas Tunai telah diperbarui.");
    setIsPaying(false);
    await loadData();
  }

  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Koperasi pesantren" title="Kasir Quick POS" description="Kasir cepat dengan stok terkini, keranjang fleksibel, dan pembayaran tunai." />
      <CooperativeNav active="/koperasi" />
      {message && <FormMessage>{message}</FormMessage>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
            <label className="relative block">
              <span className="sr-only">Cari nama produk atau barcode</span>
              <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8ba2]" />
              <input
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama produk, SKU, atau scan barcode…"
                className={`${inputClass} pl-11`}
              />
            </label>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Kategori produk">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition ${
                    category === item ? "bg-[#dbeafe] text-[#4457ff]" : "bg-[#f8f9ff] text-[#757693] hover:bg-[#eef0ff]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-[#e5e7eb] bg-white p-10 text-center text-sm text-[#757693]">Memuat katalog produk…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex min-h-[175px] flex-col rounded-3xl border border-[#e5e7eb] bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd0ff] hover:shadow-[0_10px_24px_rgba(68,87,255,0.08)] active:scale-[0.98]"
                >
                  <span
                    role={product.image_url ? "img" : undefined}
                    aria-label={product.image_url ? product.name : undefined}
                    className="relative flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-[#f3f5ff] text-2xl"
                  >
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : iconForCategory(product.category)}
                  </span>
                  <span className="mt-3 line-clamp-2 text-xs font-bold leading-5">{product.name}</span>
                  <span className="mt-1 text-sm font-bold tabular-nums text-[#4457ff]">{formatRupiah(Number(product.selling_price))}</span>
                  <span className={`mt-auto pt-3 text-[10px] font-medium ${product.stock <= product.min_stok ? "text-[#bd7627]" : "text-[#8a8ba2]"}`}>
                    Sisa {product.stock} {product.unit}
                  </span>
                </button>
              ))}
              {!visibleProducts.length && (
                <div className="col-span-full rounded-3xl border border-dashed border-[#cfd2e3] bg-white p-10 text-center text-sm text-[#757693]">
                  {products.length ? "Produk tidak ditemukan atau stok habis." : "Belum ada produk aktif di inventori."}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="sticky top-4 rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Keranjang</h2>
              <p className="mt-1 text-[11px] text-[#757693]">{itemCount} barang dipilih</p>
            </div>
            <button
              type="button"
              disabled={!cartLines.length}
              onClick={() => setCart({})}
              className="min-h-10 rounded-full px-3 text-[10px] font-semibold text-[#bd4d4d] transition hover:bg-[#fff0f0] disabled:opacity-40"
            >
              Kosongkan
            </button>
          </div>
          <div className="mt-4 max-h-[min(44vh,420px)] space-y-3 overflow-y-auto">
            {cartLines.map(({ product, quantity, subtotal }) => (
              <article key={product.id} className="rounded-2xl border border-[#f0f0f5] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{product.name}</p>
                    <p className="mt-1 text-[10px] text-[#8a8ba2]">
                      {formatRupiah(Number(product.selling_price))} / {product.unit}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-bold tabular-nums">{formatRupiah(subtotal)}</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Kurangi ${product.name}`}
                    onClick={() => changeQuantity(product, -1)}
                    className="flex size-10 items-center justify-center rounded-full bg-[#f3f5ff] text-[#4457ff]"
                  >
                    <Icon name="minus" size={15} />
                  </button>
                  <span className="min-w-8 text-center text-xs font-bold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Tambah ${product.name}`}
                    onClick={() => changeQuantity(product, 1)}
                    className="flex size-10 items-center justify-center rounded-full bg-[#eef0ff] text-[#4457ff]"
                  >
                    <Icon name="plus" size={15} />
                  </button>
                  <span className="ml-auto text-[10px] text-[#8a8ba2]">Stok {product.stock}</span>
                </div>
              </article>
            ))}
            {!cartLines.length && (
              <div className="rounded-2xl bg-[#f8f9ff] px-4 py-10 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-[#8a8ba2]">
                  <Icon name="store" size={20} />
                </span>
                <p className="mt-3 text-xs font-semibold">Keranjang masih kosong</p>
                <p className="mt-1 text-[10px] text-[#8a8ba2]">Pilih produk untuk memulai transaksi.</p>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-3 border-t border-[#f0f0f5] pt-4">
            <div className="flex justify-between text-xs text-[#757693]">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums text-[#181c31]">{formatRupiah(total)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(total)}</span>
            </div>
            <PrimaryButton disabled={!cartLines.length} onClick={startPayment} className="min-h-12 w-full">
              Lanjut Pembayaran <Icon name="arrow-right" size={16} />
            </PrimaryButton>
          </div>
        </aside>
      </div>

      {paymentOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPaying) setPaymentOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Pembayaran koperasi"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:rounded-3xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Pembayaran tunai</h2>
                <p className="mt-1 text-xs text-[#757693]">Masukkan uang diterima untuk menghitung kembalian.</p>
              </div>
              <button
                type="button"
                disabled={isPaying}
                onClick={() => setPaymentOpen(false)}
                aria-label="Tutup"
                className="flex size-10 items-center justify-center rounded-full bg-[#f3f5ff] text-[#757693]"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-[#f8f9ff] p-4">
              <p className="text-[11px] text-[#757693]">Total belanja</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatRupiah(total)}</p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="buyer-search" className="text-xs font-semibold text-[#55566f]">
                  Pembeli
                </label>
                <input
                  id="buyer-search"
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                  placeholder="Cari santri berdasarkan nama / NIS"
                  className={`${inputClass} mt-1.5`}
                />
                <select
                  value={selectedBuyer}
                  onChange={(e) => setSelectedBuyer(e.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Pelanggan Umum</option>
                  {filteredBuyers.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.nama_lengkap} · {student.nis ?? "NIS —"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cash-input" className="text-xs font-semibold text-[#55566f]">
                  Uang diterima (Rp)
                </label>
                <input
                  id="cash-input"
                  type="number"
                  inputMode="numeric"
                  min={total}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className={`${inputClass} mt-1.5 text-lg font-bold tabular-nums`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCashInput(String(total))}
                  className="min-h-10 rounded-full bg-[#dbeafe] px-4 text-[10px] font-semibold text-[#4457ff]"
                >
                  Uang Pas
                </button>
                {quickCash.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCashInput(String(amount))}
                    className="min-h-10 rounded-full border border-[#e5e7eb] px-3 text-[10px] font-semibold text-[#55566f] hover:bg-[#f3f5ff]"
                  >
                    {formatRupiah(amount)}
                  </button>
                ))}
              </div>
              <div
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                  cash >= total ? "border-[#cce8dc] bg-[#f4fbf7]" : "border-[#f2d3d3] bg-[#fffafa]"
                }`}
              >
                <span className="text-xs font-medium">Kembalian</span>
                <span className={`text-lg font-bold tabular-nums ${cash >= total ? "text-[#25815e]" : "text-[#b74444]"}`}>
                  {formatRupiah(change)}
                </span>
              </div>
            </div>
            <PrimaryButton
              disabled={isPaying || cash < total}
              onClick={() => void completePayment()}
              className="mt-5 min-h-12 w-full"
            >
              {isPaying ? "Memproses transaksi…" : "Konfirmasi & Simpan Transaksi"}
            </PrimaryButton>
          </section>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#181c31]/35 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
          <section className="w-full max-w-md rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_24px_80px_rgba(24,28,49,0.18)] print:max-w-none print:border-0 print:p-0 print:shadow-none">
            <div className="receipt-print mx-auto max-w-[300px] font-mono text-[#181c31]">
              <div className="text-center">
                <p className="text-sm font-bold">KOPERASI NURUL ALBAB</p>
                <p className="mt-1 text-[10px]">Bukti transaksi penjualan</p>
              </div>
              <div className="my-3 border-y border-dashed border-[#8a8ba2] py-2 text-[10px]">
                <p>No: {receipt.number}</p>
                <p>{formatDateTime(receipt.soldAt)}</p>
                <p>Pembeli: {receipt.buyerName}</p>
              </div>
              <div className="space-y-2 text-[10px]">
                {receipt.lines.map((line, index) => (
                  <div key={`${line.sku}-${index}`}>
                    <p>
                      {line.name} · {line.sku}
                    </p>
                    <p className="flex justify-between">
                      <span>
                        {line.quantity} x {formatRupiah(line.unitPrice)}
                      </span>
                      <span>{formatRupiah(line.subtotal)}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="my-3 space-y-1 border-t border-dashed border-[#8a8ba2] pt-2 text-[10px]">
                <ReceiptAmount label="Total" value={receipt.total} strong />
                <ReceiptAmount label="Tunai" value={receipt.cash} />
                <ReceiptAmount label="Kembali" value={receipt.change} strong />
              </div>
              <p className="text-center text-[10px]">Terima kasih telah berbelanja</p>
            </div>
            <div className="mt-5 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="min-h-11 rounded-full px-4 text-xs font-semibold text-[#757693] hover:bg-[#f3f5ff]"
              >
                Tutup
              </button>
              <PrimaryButton onClick={() => window.print()}>
                <Icon name="receipt" size={15} /> Cetak Struk
              </PrimaryButton>
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .receipt-print,
          .receipt-print * {
            visibility: visible !important;
          }
          .receipt-print {
            position: fixed;
            inset: 0;
            margin: 0 auto;
            width: 58mm;
            padding: 3mm;
            background: #fff;
            font-size: 10px;
          }
          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}

function ReceiptAmount({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <p className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{formatRupiah(value)}</span>
    </p>
  );
}