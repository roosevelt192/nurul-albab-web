"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import * as XLSX from "xlsx-js-style";
import { CooperativeNav } from "@/components/cooperative-nav";
import { Icon } from "@/components/icon";
import { getProductCategoryIcon, type ProductCategoryIcon } from "@/lib/cooperative-category-icons";
import {
  Field,
  FormMessage,
  MetricCard,
  PageHeading,
  PrimaryButton,
  StatusBadge,
} from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { requestAlertsRefresh } from "@/lib/operational-alerts";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export interface UnifiedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  image_url: string | null;
  is_active: boolean;
}

type StockAdjustmentMode = "add" | "subtract" | "set";
type ProductUpdate = Database["public"]["Tables"]["produk_koperasi"]["Update"];
type ProductInsert = Database["public"]["Tables"]["produk_koperasi"]["Insert"];

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

const defaultCategories = [
  "Alat Tulis & Kantor",
  "Buku & Kitab",
  "Makanan & Minuman",
  "Pakaian & Seragam",
  "Kebutuhan Santri",
  "Lainnya",
];

interface CategoryIconMeta {
  value: ProductCategoryIcon;
  label: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  activeRing: string;
}

const categoryIconOptions: CategoryIconMeta[] = [
  {
    value: "book-open",
    label: "Kitab",
    bgLight: "bg-purple-50",
    textColor: "text-purple-600",
    borderColor: "border-purple-200",
    activeRing: "ring-purple-500",
  },
  {
    value: "pencil",
    label: "ATK",
    bgLight: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    activeRing: "ring-blue-500",
  },
  {
    value: "coffee",
    label: "Minuman",
    bgLight: "bg-amber-50",
    textColor: "text-amber-600",
    borderColor: "border-amber-200",
    activeRing: "ring-amber-500",
  },
  {
    value: "utensils-crossed",
    label: "Makanan",
    bgLight: "bg-orange-50",
    textColor: "text-orange-600",
    borderColor: "border-orange-200",
    activeRing: "ring-orange-500",
  },
  {
    value: "shirt",
    label: "Pakaian",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
    activeRing: "ring-emerald-500",
  },
  {
    value: "backpack",
    label: "Kebutuhan",
    bgLight: "bg-pink-50",
    textColor: "text-pink-600",
    borderColor: "border-pink-200",
    activeRing: "ring-pink-500",
  },
  {
    value: "apple",
    label: "Segar",
    bgLight: "bg-teal-50",
    textColor: "text-teal-600",
    borderColor: "border-teal-200",
    activeRing: "ring-teal-500",
  },
  {
    value: "package",
    label: "Lainnya",
    bgLight: "bg-slate-100",
    textColor: "text-slate-600",
    borderColor: "border-slate-300",
    activeRing: "ring-slate-500",
  },
];

const skuPrefixes: Record<string, string> = {
  "Alat Tulis & Kantor": "ATK-",
  "Alat Tulis": "ATK-",
  "Buku & Kitab": "BKK-",
  Kitab: "KTB-",
  "Makanan & Minuman": "MKN-",
  "Makanan/Minuman": "MKN-",
  "Pakaian & Seragam": "SRG-",
  Seragam: "SRG-",
  "Kebutuhan Santri": "KBT-",
  Lainnya: "BRG-",
};

function generateSku(category: string, existing: UnifiedProduct[]): string {
  const prefix = skuPrefixes[category] ?? "BRG-";
  const count = existing.filter((p) => p.category === category).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

function mapToUnified(row: unknown): UnifiedProduct {
  const f = (row ?? {}) as Record<string, unknown>;
  const id = String(f.id ?? "");
  return {
    id,
    sku: String(f.sku || f.kode_barang || f.barcode || id.slice(0, 8)),
    barcode: f.barcode ? String(f.barcode) : null,
    name: String(f.nama_produk || f.name || "Produk"),
    category: String(f.category || f.kategori || "Lainnya"),
    unit: String(f.unit || f.satuan || "pcs"),
    cost_price: Number(f.hpp ?? f.cost_price ?? f.harga_beli ?? 0),
    selling_price: Number(f.harga_jual ?? f.selling_price ?? f.price ?? 0),
    stock: Number(f.stok ?? f.stock ?? 0),
    min_stock: Number(f.min_stok ?? f.min_stock ?? 5),
    image_url: f.image_url ? String(f.image_url) : null,
    is_active: typeof f.is_active === "boolean" ? f.is_active : true,
  };
}

export default function StokPage() {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [stockFilter, setStockFilter] = useState("Semua stok");

  const [editorProduct, setEditorProduct] = useState<UnifiedProduct | null | undefined>(undefined);
  const [restockProduct, setRestockProduct] = useState<UnifiedProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [stockAdjustmentMode, setStockAdjustmentMode] = useState<StockAdjustmentMode>("add");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string; icon: ProductCategoryIcon }[]>(
    defaultCategories.map((name) => ({
      id: name,
      name,
      icon: getProductCategoryIcon(name) as ProductCategoryIcon,
    }))
  );
  const [newCategoryIcon, setNewCategoryIcon] = useState<ProductCategoryIcon>("backpack");
  const [sku, setSku] = useState("");

  const [imageMode, setImageMode] = useState<"url" | "file">("url");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const [pRes, cRes] = await Promise.all([
      supabase.from("produk_koperasi").select("*").or("is_active.is.null,is_active.eq.true"),
      supabase.from("kategori_produk").select("*").order("name"),
    ]);

    if (!pRes.error && pRes.data) {
      const mapped = pRes.data.map(mapToUnified).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
      setProducts(mapped);
    }
    if (!cRes.error && cRes.data && cRes.data.length > 0) {
      setCategories(cRes.data as { id: string; name: string; icon: ProductCategoryIcon }[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchSearch = `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(q);
      const matchCat = category === "Semua kategori" || p.category === category;
      const low = p.stock <= p.min_stock;
      const matchStock =
        stockFilter === "Semua stok" ||
        (stockFilter === "Menipis" && p.stock > 0 && low) ||
        (stockFilter === "Stok Kosong" && p.stock === 0) ||
        (stockFilter === "Aman" && p.stock > p.min_stock);
      return matchSearch && matchCat && matchStock;
    });
  }, [products, query, category, stockFilter]);

  const lowStock = products.filter((p) => p.stock <= p.min_stock).length;
  const stockValue = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0);

  function openEditor(product: UnifiedProduct | null) {
    const selCat = product?.category ?? (category === "Semua kategori" ? categories[0]?.name ?? "Lainnya" : category);
    setCategory(selCat);
    setSku(product?.sku ?? generateSku(selCat, products));
    setImageFile(null);
    setImagePreview(product?.image_url ?? null);
    setImageMode(product?.image_url ? "url" : "file");
    setEditorProduct(product);
  }

  async function handleSaveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const selCat = String(fd.get("category") ?? "").trim() || "Lainnya";
    const customCat = String(fd.get("custom_category") ?? "").trim();
    const unit = String(fd.get("unit") ?? "").trim() || "pcs";
    const barcode = String(fd.get("barcode") ?? "").trim() || null;
    const costPrice = Number(fd.get("cost_price"));
    const sellingPrice = Number(fd.get("selling_price"));
    const stock = Number(fd.get("stock"));
    const minStock = Number(fd.get("min_stock"));
    const urlImage = String(fd.get("image_url") ?? "").trim() || null;

    const finalCategory = selCat === "Lainnya" && customCat ? customCat : selCat;
    const finalSku = sku || generateSku(finalCategory, products);

    if (!name || sellingPrice <= 0 || costPrice < 0) {
      setMessage("Pastikan nama terisi, harga jual > 0, dan HPP valid.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    let finalImageUrl = urlImage;
    if (imageFile && imageMode === "file") {
      try {
        const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `produk/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("koperasi").upload(path, imageFile);
        if (!error) {
          finalImageUrl = supabase.storage.from("koperasi").getPublicUrl(path).data.publicUrl;
        }
      } catch {
        // Fallback simpan teks
      }
    } else if (editorProduct && !urlImage && imageMode === "url") {
      finalImageUrl = editorProduct.image_url;
    }

    const payload: Record<string, unknown> = {
      name,
      nama_produk: name,
      sku: finalSku,
      kode_barang: finalSku,
      cost_price: costPrice,
      hpp: costPrice,
      harga_beli: costPrice,
      selling_price: sellingPrice,
      harga_jual: sellingPrice,
      price: sellingPrice,
      stock,
      stok: stock,
      min_stok: minStock,
      min_stock: minStock,
      category: finalCategory,
      kategori: finalCategory,
      unit,
      satuan: unit,
      barcode,
      image_url: finalImageUrl,
      is_active: true,
    };

    let error;
    if (editorProduct?.id) {
      const res = await supabase
        .from("produk_koperasi")
        .update(payload as unknown as ProductUpdate)
        .eq("id", editorProduct.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("produk_koperasi")
        .insert([payload as unknown as ProductInsert]);
      error = res.error;
    }

    if (error) {
      setMessage(`Gagal menyimpan: ${error.message}`);
    } else {
      setMessage(`Produk "${name}" berhasil disimpan.`);
      setEditorProduct(undefined);
      await loadProducts();
      requestAlertsRefresh();
    }
    setIsSaving(false);
  }

  async function handleRestock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!restockProduct) return;
    const amount = Number(new FormData(e.currentTarget).get("quantity"));
    if (!Number.isInteger(amount)) return;

    const finalStock =
      stockAdjustmentMode === "add"
        ? restockProduct.stock + amount
        : stockAdjustmentMode === "subtract"
          ? restockProduct.stock - amount
          : amount;

    if (finalStock < 0) {
      setMessage("Stok tidak boleh kurang dari 0.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("produk_koperasi")
      .update({ stok: finalStock, stock: finalStock } as unknown as ProductUpdate)
      .eq("id", restockProduct.id);

    if (error) {
      setMessage(`Gagal ubah stok: ${error.message}`);
    } else {
      setProducts((curr) => curr.map((p) => (p.id === restockProduct.id ? { ...p, stock: finalStock } : p)));
      setMessage(`Stok "${restockProduct.name}" berhasil disesuaikan.`);
      setRestockProduct(null);
      requestAlertsRefresh();
    }
    setIsSaving(false);
  }

  async function handleArchiveProduct() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("produk_koperasi")
      .update({ is_active: false } as unknown as ProductUpdate)
      .eq("id", deleteTarget.id);

    if (error) {
      setMessage(`Gagal menghapus produk: ${error.message}`);
    } else {
      setProducts((curr) => curr.filter((p) => p.id !== deleteTarget.id));
      setMessage(`Produk "${deleteTarget.name}" dinonaktifkan.`);
      setDeleteTarget(null);
      requestAlertsRefresh();
    }
    setIsDeleting(false);
  }

  function exportToExcel() {
    if (!products.length) return;
    const ws = XLSX.utils.json_to_sheet(
      products.map((p) => ({
        "Nama Produk": p.name,
        Kategori: p.category,
        Satuan: p.unit,
        HPP: p.cost_price,
        "Harga Jual": p.selling_price,
        Stok: p.stock,
        "Min Stok": p.min_stock,
        SKU: p.sku,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Koperasi");
    XLSX.writeFile(wb, `NAIS-Stok-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-3.5 px-2.5 py-3 sm:space-y-6 sm:px-6 sm:py-6">
      <PageHeading
        eyebrow="Koperasi Pesantren / Manajemen Stok"
        title="Manajemen stok"
        description="Kelola katalog, HPP, harga jual, margin, dan batas minimum stok."
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <PrimaryButton onClick={exportToExcel} className="justify-center text-xs sm:text-sm">
              <Icon name="download" size={14} /> Export
            </PrimaryButton>
            <PrimaryButton onClick={() => openEditor(null)} className="justify-center text-xs sm:text-sm">
              <Icon name="plus" size={15} /> Tambah
            </PrimaryButton>
          </div>
        }
      />

      <div className="-mt-2 overflow-x-auto">
        <CooperativeNav active="/koperasi/stok" />
      </div>

      {message && <FormMessage>{message}</FormMessage>}

      {/* METRIC CARDS */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        <div className="h-full">
          <MetricCard label="Produk aktif" value={String(products.length)} detail="Dalam katalog" icon="store" />
        </div>
        <div className="h-full">
          <MetricCard label="Stok menipis" value={String(lowStock)} detail="Perlu restock" icon="clock" tone="bg-amber-50 text-amber-700" />
        </div>
        <div className="col-span-2 h-full lg:col-span-1">
          <MetricCard label="Nilai modal stok" value={formatRupiah(stockValue)} detail="Total inventori aset" icon="wallet" tone="bg-emerald-50 text-emerald-700" />
        </div>
      </section>

      {/* FILTER PENCARIAN */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:p-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_220px_200px] lg:items-center">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, SKU, barcode…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-[#4457ff] sm:text-sm"
            />
          </div>
          <Field label="Kategori" name="category" value={category} onChange={setCategory}>
            <option>Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </Field>
          <Field label="Status stok" name="stock" value={stockFilter} onChange={setStockFilter}>
            <option>Semua stok</option>
            <option>Menipis</option>
            <option>Stok Kosong</option>
            <option>Aman</option>
          </Field>
        </div>
      </section>

      {/* DAFTAR PRODUK */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        {/* DESKTOP TABLE */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">HPP</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3">Stok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProducts.map((p) => {
                const empty = p.stock === 0;
                const low = p.stock > 0 && p.stock <= p.min_stock;
                const margin = p.selling_price - p.cost_price;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 overflow-hidden">
                          {p.image_url ? (
                            <Image src={p.image_url} alt={p.name} width={36} height={36} unoptimized className="size-full object-cover" />
                          ) : (
                            <Icon name={getProductCategoryIcon(p.category, categories.find((c) => c.name === p.category)?.icon)} size={15} className="text-[#4457ff]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400">SKU: {p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.category}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">{formatRupiah(p.cost_price)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-800">{formatRupiah(p.selling_price)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold tabular-nums ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatRupiah(margin)}</td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-slate-700">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={empty ? "Kosong" : low ? "Menipis" : "Aman"} tone={empty ? "border-rose-200 bg-rose-50 text-rose-700" : low ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => { setStockAdjustmentMode("add"); setRestockProduct(p); }} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                          Atur
                        </button>
                        <button type="button" onClick={() => openEditor(p)} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget({ id: p.id, name: p.name })} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50">
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* HP CARDS VIEW */}
        <div className="grid gap-2 p-2.5 md:hidden">
          {visibleProducts.map((p) => {
            const empty = p.stock === 0;
            const low = p.stock > 0 && p.stock <= p.min_stock;
            const iconBg = p.category.includes("Kitab") || p.category.includes("Buku")
              ? "bg-purple-100/70 text-purple-600"
              : p.category.includes("Alat Tulis")
                ? "bg-blue-100/70 text-blue-600"
                : p.category.includes("Minuman")
                  ? "bg-amber-100/70 text-amber-600"
                  : p.category.includes("Makanan")
                    ? "bg-orange-100/70 text-orange-600"
                    : p.category.includes("Pakaian") || p.category.includes("Seragam")
                      ? "bg-emerald-100/70 text-emerald-600"
                      : p.category.includes("Kebutuhan")
                        ? "bg-pink-100/70 text-pink-600"
                        : "bg-slate-100 text-slate-600";

            return (
              <article key={p.id} className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-2xs ${iconBg}`}>
                    {p.image_url ? (
                      <Image src={p.image_url} alt={p.name} width={40} height={40} unoptimized className="size-full object-cover" />
                    ) : (
                      <Icon name={getProductCategoryIcon(p.category, categories.find((c) => c.name === p.category)?.icon)} size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="truncate text-xs font-bold text-slate-800">{p.name}</h3>
                      <StatusBadge
                        label={empty ? "Kosong" : low ? "Menipis" : "Aman"}
                        tone={empty ? "border-rose-200 bg-rose-50 text-rose-700" : low ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{p.category} • SKU: {p.sku}</p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-1.5 text-center text-[10px]">
                  <div>
                    <span className="block text-[9px] text-slate-400">HPP</span>
                    <span className="font-semibold text-slate-600">{formatRupiah(p.cost_price)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400">Harga Jual</span>
                    <span className="font-bold text-slate-800">{formatRupiah(p.selling_price)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400">Stok</span>
                    <span className={`font-bold ${empty || low ? "text-rose-600" : "text-slate-700"}`}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setStockAdjustmentMode("add"); setRestockProduct(p); }}
                    className="flex-1 rounded-lg bg-[#eef0ff] py-1 text-center text-[11px] font-semibold text-[#4457ff] active:scale-95 transition"
                  >
                    Atur stok
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(p)}
                    className="flex-1 rounded-lg border border-slate-200 py-1 text-center text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                    className="rounded-lg border border-rose-100 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 active:scale-95 transition"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* MODAL FORM TAMBAH / EDIT PRODUK */}
      {editorProduct !== undefined && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-sm font-bold text-slate-800">{editorProduct ? "Edit Produk" : "Tambah Produk Baru"}</h2>
                <p className="text-[11px] text-slate-500">Atur SKU, harga jual, dan stok</p>
              </div>
              <button type="button" onClick={() => setEditorProduct(undefined)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <Icon name="close" size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">Kode SKU</label>
                  <div className="flex gap-1">
                    <input name="sku" value={sku} onChange={(e) => setSku(e.target.value)} readOnly={!!editorProduct} className={`${inputClass} text-xs`} />
                    <button type="button" onClick={() => setSku(generateSku(category, products))} disabled={!!editorProduct} className="rounded-xl border border-slate-200 px-2 text-[10px] font-semibold text-[#4457ff] disabled:opacity-30">
                      Auto
                    </button>
                  </div>
                </div>
                <Field label="Barcode (opsional)" name="barcode" placeholder="Scan barcode" defaultValue={editorProduct?.barcode ?? ""} />
              </div>

              <Field label="Nama Produk" name="name" placeholder="Misal: Buku Tulis TW" defaultValue={editorProduct?.name ?? ""} required />

              <div className="grid grid-cols-2 gap-2">
                <Field label="Kategori" name="category" defaultValue={editorProduct?.category ?? categories[0]?.name ?? "Lainnya"} onChange={setCategory}>
                  {categories.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                </Field>
                <Field label="Satuan" name="unit" placeholder="pcs / botol" defaultValue={editorProduct?.unit ?? "pcs"} required />
              </div>

              {category === "Lainnya" && (
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 transition-all">
                  <Field
                    label="Nama Kategori Baru"
                    name="custom_category"
                    placeholder="Misal: Obat & Kebersihan"
                  />

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Pilih Ikon Kategori
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        Ketuk untuk memilih
                      </span>
                    </div>

                    {/* Grid Pemilih Ikon Interaktif & Animatif */}
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {categoryIconOptions.map((opt) => {
                        const isSelected = newCategoryIcon === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNewCategoryIcon(opt.value)}
                            className={`group relative flex flex-col items-center justify-center rounded-xl border p-2 transition-all duration-200 active:scale-90 ${
                              isSelected
                                ? `bg-white shadow-md ring-2 ${opt.activeRing} ${opt.borderColor}`
                                : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs"
                            }`}
                          >
                            {/* Indikator Centang Animatif Saat Terpilih */}
                            {isSelected && (
                              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#4457ff] text-[9px] font-bold text-white shadow-xs animate-in zoom-in-50 duration-150">
                                ✓
                              </span>
                            )}

                            {/* Badge Ikon Berwarna */}
                            <div
                              className={`flex size-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${
                                isSelected ? `${opt.bgLight} ${opt.textColor}` : "bg-slate-50 text-slate-500"
                              }`}
                            >
                              <Icon name={opt.value} size={16} />
                            </div>

                            {/* Label Kategori */}
                            <span
                              className={`mt-1.5 truncate text-[10px] font-medium tracking-tight ${
                                isSelected ? "font-bold text-slate-800" : "text-slate-500"
                              }`}
                            >
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Foto Produk</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setImageMode("url")} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${imageMode === "url" ? "bg-[#4457ff] text-white" : "border border-slate-200 text-slate-600"}`}>
                    URL
                  </button>
                  <button type="button" onClick={() => setImageMode("file")} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${imageMode === "file" ? "bg-[#4457ff] text-white" : "border border-slate-200 text-slate-600"}`}>
                    File / Kamera
                  </button>
                </div>
                {imageMode === "url" ? (
                  <input name="image_url" placeholder="https://..." defaultValue={editorProduct?.image_url ?? ""} className={`${inputClass} mt-1 text-xs`} />
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} className="text-xs text-slate-500" />
                    {imagePreview && <Image src={imagePreview} alt="preview" width={32} height={32} unoptimized className="size-8 rounded-lg object-cover" />}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Harga Modal HPP (Rp)" name="cost_price" type="number" defaultValue={String(editorProduct?.cost_price ?? "")} required />
                <Field label="Harga Jual (Rp)" name="selling_price" type="number" defaultValue={String(editorProduct?.selling_price ?? "")} required />
                <Field label="Stok Saat Ini" name="stock" type="number" defaultValue={String(editorProduct?.stock ?? 0)} required />
                <Field label="Batas Minimum" name="min_stock" type="number" defaultValue={String(editorProduct?.min_stock ?? 5)} required />
              </div>

              <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                <button type="button" onClick={() => setEditorProduct(undefined)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600">
                  Batal
                </button>
                <PrimaryButton type="submit" disabled={isSaving} className="text-xs">
                  {isSaving ? "Menyimpan…" : "Simpan Produk"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL ATUR STOK */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <section className="w-full max-w-sm rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl">
            <h3 className="text-xs font-bold text-slate-800">{restockProduct.name}</h3>
            <p className="text-[10px] text-slate-500">Stok sekarang: {restockProduct.stock} {restockProduct.unit}</p>
            <form onSubmit={handleRestock} className="mt-2.5 space-y-2.5">
              <div className="grid grid-cols-3 gap-1">
                {(["add", "subtract", "set"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setStockAdjustmentMode(m)} className={`rounded-lg py-1 text-[11px] font-semibold ${stockAdjustmentMode === m ? "bg-[#4457ff] text-white" : "border border-slate-200 text-slate-600"}`}>
                    {m === "add" ? "Tambah (+)" : m === "subtract" ? "Kurang (-)" : "Set (=)"}
                  </button>
                ))}
              </div>
              <input name="quantity" type="number" min={stockAdjustmentMode === "set" ? 0 : 1} placeholder="Jumlah..." required className={inputClass} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setRestockProduct(null)} className="rounded-lg px-3 py-1 text-xs text-slate-600">
                  Batal
                </button>
                <PrimaryButton type="submit" disabled={isSaving} className="text-xs">
                  Simpan
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS ELEGAN */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Icon name="alert-triangle" size={20} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">Nonaktifkan Produk?</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Produk <strong className="text-slate-700">"{deleteTarget.name}"</strong> tidak akan lagi muncul di kasir dan katalog koperasi.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button type="button" disabled={isDeleting} onClick={handleArchiveProduct} className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {isDeleting ? "Menghapus…" : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}