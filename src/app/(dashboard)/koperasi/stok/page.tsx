"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
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

type Editor = { product: UnifiedProduct | null } | null;
type ImageMode = "url" | "file";
type StockAdjustmentMode = "add" | "subtract" | "set";
type ProductRow = Database["public"]["Tables"]["produk_koperasi"]["Row"];
type ProductInsert = Database["public"]["Tables"]["produk_koperasi"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["produk_koperasi"]["Update"];
type ProductImportInsert = ProductInsert & {
  nama_produk: string;
  kode_barang: string;
  kategori: string;
  satuan: string;
  hpp: number;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  min_stock: number;
};
type ImportProduct = {
  nama_produk: string;
  category: string;
  unit: string;
  barcode: string | null;
  hpp: number;
  harga_jual: number;
  stok: number;
  min_stok: number;
  image_url: string | null;
  is_active: boolean;
};
type ImportPreviewItem = {
  row: number;
  data: ImportProduct;
  valid: boolean;
  error?: string;
};
type ExcelCell = string | number | boolean | null;

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

const defaultCategories = ["Alat Tulis", "Kitab", "Makanan/Minuman", "Seragam", "Lainnya"];
type ProductCategory = { id: string; name: string; icon: ProductCategoryIcon };
const categoryIconOptions: { value: ProductCategoryIcon; label: string }[] = [
  { value: "utensils-crossed", label: "Makanan" },
  { value: "pencil", label: "Alat tulis" },
  { value: "book-open", label: "Kitab" },
  { value: "shirt", label: "Seragam" },
  { value: "package", label: "Paket" },
  { value: "coffee", label: "Minuman" },
  { value: "apple", label: "Buah" },
  { value: "backpack", label: "Perlengkapan" },
];

const skuPrefixes: Record<string, string> = {
  "Alat Tulis": "ATK-",
  Kitab: "KTB-",
  "Makanan/Minuman": "MKN-",
  Seragam: "SRG-",
  Lainnya: "BRG-",
};

const headerStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: "4457FF" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const titleStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: "1E293B" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
  alignment: { horizontal: "left", vertical: "center" },
};

const exportColumns = [
  { key: "nama_produk", label: "Nama Produk" },
  { key: "category", label: "Kategori" },
  { key: "unit", label: "Satuan" },
  { key: "barcode", label: "Barcode" },
  { key: "hpp", label: "HPP (Rp)" },
  { key: "harga_jual", label: "Harga Jual (Rp)" },
  { key: "stok", label: "Stok" },
  { key: "min_stok", label: "Min Stok" },
  { key: "image_url", label: "URL Foto" },
  { key: "is_active", label: "Aktif (ya/tidak)" },
] as const;

function normalizeImportHeader(header: unknown): string {
  const key = String(header ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (["barcode", "barcodeopsional"].includes(key)) return "barcode";
  if (key.includes("kategori") || key.includes("category")) return "category";
  if (key.includes("min") || key.includes("minimum") || key.includes("limit")) return "min_stok";
  if (key.includes("stokawal") || key.includes("stockawal") || key.includes("stok") || key.includes("stock")) {
    return "stok";
  }
  if (key.includes("nama") || key.includes("produk") || key.includes("barang") || key.includes("name")) {
    return "nama_produk";
  }
  if (key.includes("satuan") || key.includes("unit")) return "unit";
  if (key.includes("jual") || key.includes("selling") || key.includes("price")) return "harga_jual";
  if (key.includes("hpp") || key.includes("modal") || key.includes("cost") || key.includes("bel")) return "hpp";
  if (key.includes("image") || key.includes("urlfoto")) return "image_url";
  if (key === "aktif" || key === "isactive") return "is_active";
  if (key === "sku" || key === "kodebarang" || key === "kodesku") return "sku";
  return key;
}

function parseImportNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // Format Indonesia: 2.500,50
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // Format Inggris: 2,500.50
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const thousands =
      parts.length > 2 || parts.slice(1).every((part) => part.length === 3);
    normalized = thousands ? cleaned.replace(/\./g, "") : cleaned;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function generateSku(category: string, existing: UnifiedProduct[]): string {
  const prefix = skuPrefixes[category] ?? "BRG-";
  const count = existing.filter((p) => p.category === category).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

function mapToUnified(row: ProductRow): UnifiedProduct {
  const fields = row as unknown as Record<string, unknown>;
  const id = String(fields.id ?? "");
  return {
    id,
    sku: String(fields.sku || fields.kode_barang || fields.barcode || id.slice(0, 8)),
    barcode: fields.barcode ? String(fields.barcode) : null,
    name: String(fields.nama_produk || fields.name || "Produk Tanpa Nama"),
    category: String(fields.category || fields.kategori || "Lainnya"),
    unit: String(fields.unit || fields.satuan || "pcs"),
    cost_price: Number(fields.hpp ?? fields.cost_price ?? fields.harga_beli ?? fields.buy_price ?? 0),
    selling_price: Number(fields.harga_jual ?? fields.selling_price ?? fields.sell_price ?? fields.price ?? 0),
    stock: Number(fields.stok ?? fields.stock ?? 0),
    min_stock: Number(fields.min_stok ?? fields.min_stock ?? 5),
    image_url: fields.image_url ? String(fields.image_url) : null,
    is_active: typeof fields.is_active === "boolean" ? fields.is_active : true,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "terjadi kesalahan";
}

export default function StokPage() {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [stockFilter, setStockFilter] = useState("Semua stok");
  const [editor, setEditor] = useState<Editor>(null);
  const [restockProduct, setRestockProduct] = useState<UnifiedProduct | null>(null);
  const [stockAdjustmentMode, setStockAdjustmentMode] = useState<StockAdjustmentMode>("add");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>(
    defaultCategories.map((name) => ({
      id: name,
      name,
      icon: getProductCategoryIcon(name) as ProductCategoryIcon,
    })),
  );
  const [newCategoryIcon, setNewCategoryIcon] = useState<ProductCategoryIcon>("package");

  // Kode SKU (kontrol agar terisi ulang otomatis saat kategori berubah di mode Tambah)
  const [sku, setSku] = useState("");
  const lastGeneratedSku = useRef("");
  const importInputRef = useRef<HTMLInputElement>(null);

  // Image input mode & file
  const [imageMode, setImageMode] = useState<ImageMode>("url");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Import / Export
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDraggingImportFile, setIsDraggingImportFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadProductImage = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `produk/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("koperasi")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (!error) {
        const { data } = supabase.storage
          .from("koperasi")
          .getPublicUrl(path);
        return data?.publicUrl ?? null;
      }

      // Fallback: base64 data URL
      return readFileAsDataUrl(file);
    } catch {
      return readFileAsDataUrl(file);
    }
  };

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const [productResult, categoryResult] = await Promise.all([
      supabase.from("produk_koperasi").select("*").or("is_active.is.null,is_active.eq.true"),
      supabase.from("kategori_produk").select("*").order("name"),
    ]);

    if (productResult.error) {
      console.error("Gagal memuat inventori koperasi:", productResult.error);
      setMessage(`Data stok gagal dimuat: ${productResult.error.message}`);
    } else {
      const mapped = (productResult.data ?? []).map(mapToUnified);
      mapped.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
      setProducts(mapped);
      if (categoryResult.error) {
        console.error("Gagal memuat kategori produk:", categoryResult.error);
        setMessage(`Kategori produk gagal dimuat: ${categoryResult.error.message}`);
      } else {
        const loadedCategories = (categoryResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
        }));
        setCategories(loadedCategories.length ? loadedCategories : defaultCategories.map((name) => ({
          id: name,
          name,
          icon: getProductCategoryIcon(name) as ProductCategoryIcon,
        })));
        setMessage("");
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts().catch((error: unknown) => {
        console.error("Unexpected failure loading inventory:", error);
        setMessage(error instanceof Error ? error.message : "Inventori gagal dimuat.");
        setIsLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const searchMatch = `${product.name} ${product.sku} ${product.barcode ?? ""}`
        .toLocaleLowerCase("id-ID")
        .includes(query.trim().toLocaleLowerCase("id-ID"));
      const categoryMatch = category === "Semua kategori" || product.category === category;
      const low = product.stock <= product.min_stock;
      const stockMatch =
        stockFilter === "Semua stok" ||
        (stockFilter === "Menipis" && product.stock > 0 && low) ||
        (stockFilter === "Stok Kosong" && product.stock === 0) ||
        (stockFilter === "Aman" && product.stock > product.min_stock);
      return searchMatch && categoryMatch && stockMatch;
    });
  }, [products, query, category, stockFilter]);

  const lowStock = products.filter((p) => p.stock <= p.min_stock).length;
  const stockValue = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0);

  function openEditor(product: UnifiedProduct | null) {
    const selectedCategory = product?.category ??
      (category === "Semua kategori" ? categories[0]?.name ?? "Lainnya" : category);
    setCategory(selectedCategory);
    const nextSku = product?.sku ?? generateSku(selectedCategory, products);
    setSku(nextSku);
    lastGeneratedSku.current = nextSku;
    setEditor({ product });
  }

  function handleEditorCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    if (editor?.product?.id) return;
    if (!sku || sku === lastGeneratedSku.current) {
      const nextSku = generateSku(nextCategory, products);
      setSku(nextSku);
      lastGeneratedSku.current = nextSku;
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const enteredSku = String(sku).trim();
    const name = String(data.get("name") ?? "").trim();
    const selectedCategory = String(data.get("category") ?? "").trim() || "Lainnya";
    const enteredCustomCategory = String(data.get("custom_category") ?? "").trim();
    const unit = String(data.get("unit") ?? "").trim() || "pcs";
    const barcode = String(data.get("barcode") ?? "").trim() || null;
    const costPrice = Number(data.get("cost_price"));
    const sellingPrice = Number(data.get("selling_price"));
    const stock = Number(data.get("stock"));
    const minStock = Number(data.get("min_stock"));
    const enteredImageUrl = String(data.get("image_url") ?? "").trim() || null;

    // Resolve kategori akhir: jika "Lainnya" dan ada input custom, gunakan custom category
    let finalCategory = selectedCategory;
    let customCategoryRecord: ProductCategory | null = null;
    if (selectedCategory === "Lainnya" && enteredCustomCategory) {
      finalCategory = enteredCustomCategory;
      customCategoryRecord = {
        id: finalCategory,
        name: finalCategory,
        icon: newCategoryIcon,
      };
    }

    // Resolve SKU: mode create & kosong → generate otomatis; mode edit & kosong → generate; mode edit & diisi → biarkan lama
    let finalSku = enteredSku;
    const isCreate = !editor?.product?.id;
    if (!finalSku || isCreate) {
      finalSku = generateSku(finalCategory, products);
    } else if (editor?.product?.id && finalSku !== editor.product.sku) {
      // Admin sengaja mengubah SKU di mode edit: gunakan yang baru
      finalSku = enteredSku || generateSku(finalCategory, products);
    }

    if (
      !finalSku ||
      !name ||
      !Number.isFinite(costPrice) || costPrice < 0 ||
      !Number.isFinite(sellingPrice) || sellingPrice <= 0 ||
      !Number.isFinite(stock) || stock < 0 ||
      !Number.isFinite(minStock) || minStock < 0
    ) {
      setMessage("Pastikan SKU, nama produk terisi, harga jual > 0, dan angka valid.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    if (customCategoryRecord && !categories.some((item) => item.name === customCategoryRecord?.name)) {
      const { data: savedCategory, error: categoryError } = await supabase
        .from("kategori_produk")
        .upsert({ name: customCategoryRecord.name, icon: customCategoryRecord.icon }, { onConflict: "name" })
        .select("*")
        .single();
      if (categoryError) {
        console.error("Gagal menyimpan kategori produk:", categoryError);
        setMessage(`Kategori produk gagal disimpan: ${categoryError.message}`);
        setIsSaving(false);
        return;
      }
      setCategories((current) => [...current.filter((item) => item.name !== savedCategory.name), savedCategory]);
    }

    // Resolve image_url: prioritas file upload, lalu URL manual, lalu pertahankan lama (mode edit)
    let finalImageUrl: string | null = enteredImageUrl;
    if (imageFile && imageMode === "file") {
      const uploaded = await uploadProductImage(imageFile);
      finalImageUrl = uploaded ?? enteredImageUrl ?? null;
      setImageFile(null);
      setImagePreview(null);
      setImageMode("url");
    } else if (isCreate && !enteredImageUrl) {
      finalImageUrl = null;
    }

    // Kolom inti; trigger Supabase menyinkronkan pasangan alias Indonesia-Inggris.
    const payload = {
      sku: finalSku,
      name,
      cost_price: costPrice,
      selling_price: sellingPrice,
      stock,
      min_stok: minStock,
      category: finalCategory,
      unit,
      barcode,
      image_url: finalImageUrl,
      is_active: true,
    };

    let result;
    if (editor?.product?.id) {
      result = await supabase
        .from("produk_koperasi")
        .update(payload as ProductUpdate)
        .eq("id", editor.product.id)
        .select("*")
        .single();
    } else {
      result = await supabase
        .from("produk_koperasi")
        .insert(payload as ProductInsert)
        .select("*")
        .single();
    }

    if (result.error) {
      console.error("Gagal simpan produk:", result.error);
      setMessage(`Produk gagal disimpan: ${result.error.message}`);
      setIsSaving(false);
      return;
    }

    const saved = mapToUnified(result.data);
    setProducts((current) => {
      const idx = current.findIndex((p) => p.id === saved.id);
      if (idx < 0) return [...current, saved].sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
      return current.map((p) => (p.id === saved.id ? saved : p)).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
    });

    setMessage(`Produk "${saved.name}" berhasil disimpan.`);
    requestAlertsRefresh();
    setEditor(null);
    setIsSaving(false);
  }

  // ============================================================================
  // Export Excel (xlsx-js-style) – template premium dengan lembar panduan
  // ============================================================================
  const sanitizeCellForExcel = (value: ExcelCell): ExcelCell => {
    if (typeof value === "string") {
      if (value.length > 32000) return value.slice(0, 32000);
      return value;
    }
    return value;
  };

  const safeImageUrl = (url: string | null): string => {
    if (!url) return "";
    if (/^data:image\//i.test(url) || url.length > 2000) return "[Foto Tersimpan Lokal]";
    if (!/^https?:\/\//i.test(url) || url.length >= 1000) return "";
    return url;
  };

  const handleExportExcel = useCallback(async () => {
    if (products.length === 0) {
      setMessage("Tidak ada data produk untuk diekspor.");
      return;
    }
    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // --- Lembar 1: Data Produk ---
      const wsData: ExcelCell[][] = [
        exportColumns.map((c) => c.label),
        ...products.map((p) => {
          const row = [
            p.name,
            p.category,
            p.unit,
            p.barcode ?? "",
            p.cost_price,
            p.selling_price,
            p.stock,
            p.min_stock,
            safeImageUrl(p.image_url),
            p.is_active ? "ya" : "tidak",
          ];
          return row.map((cell) => sanitizeCellForExcel(cell));
        }),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Style header
      const lastCol = XLSX.utils.encode_col(exportColumns.length - 1);
      for (let c = 0; c < exportColumns.length; c += 1) {
        const cell = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[cell]) ws[cell].s = headerStyle;
      }

      // Auto-width kolom
      const widths = exportColumns.map((c) => {
        const maxLen = Math.max(
          c.label.length,
          ...products.map((p) => String(p[c.key as keyof UnifiedProduct] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
      });
      ws["!cols"] = widths;

      // Tautkan baris data
      ws["!rows"] = products.map(() => ({ hpt: 22 }));
      ws["!autofilter"] = { ref: `A1:${lastCol}1` };

      // Format angka pada sel nominal HPP (kolom E, indeks 4) dan Harga Jual (kolom F, indeks 5).
      for (let r = 1; r < wsData.length; r += 1) {
        for (const c of [4, 5]) {
          const cell = XLSX.utils.encode_cell({ r, c });
          if (ws[cell]) ws[cell].z = "#,##0";
        }
      }

      XLSX.utils.book_append_sheet(workbook, ws, "Data Produk");

      // --- Lembar 2: Panduan Pengisian ---
      const guideWs = XLSX.utils.aoa_to_sheet([
        ["PANDUAN PENGISIAN DATA PRODUK KOPERASI"],
        [""],
        ["1. Isi semua kolom wajib: Nama Produk, Kategori, Satuan, HPP, Harga Jual, Stok, Min Stok."],
        ["2. Kode SKU / Barang akan di-generate otomatis saat diimpor, Anda boleh mengosongkannya."],
        ["3. Kategori yang valid: Alat Tulis, Kitab, Makanan/Minuman, Seragam, Lainnya."],
        ["4. Jika memilih 'Lainnya', tulis nama kategori baru di kolom Kategori."],
        ["5. HPP dan Harga Jual harus berupa angka (tanpa titik/koma). Harga jual harus > 0."],
        ["6. Stok dan Min Stok harus berupa angka bulat >= 0."],
        ["7. URL Foto opsional. Isikan URL gambar publik atau kosongkan."],
        ["8. Aktif (ya/tidak): isi 'ya' jika produk ingin tetap ditampilkan, 'tidak' untuk diarsipkan."],
        [""],
        ["Contoh baris data:"],
        ["Buku Tulis TW 38 Lembar", "Alat Tulis", "pcs", "", 3500, 5000, 100, 10, "https://example.com/foto.jpg", "ya"],
        ["Buku Kitab Fiqih", "Kitab", "buku", "", 45000, 65000, 25, 3, "", "ya"],
      ]);
      for (let c = 0; c < 10; c += 1) {
        const cell = XLSX.utils.encode_cell({ r: 0, c });
        if (guideWs[cell]) guideWs[cell].s = titleStyle;
      }
      guideWs["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(workbook, guideWs, "Panduan Pengisian");

      // Download
      const now = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      XLSX.writeFile(workbook, `NAIS-produk-koperasi-${now}.xlsx`);
      setMessage("Data produk berhasil diekspor ke Excel.");
    } catch (error: unknown) {
      console.error("Gagal ekspor Excel:", error);
      setMessage(`Ekspor gagal: ${getErrorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  }, [products]);

  const handleDownloadTemplate = useCallback(() => {
    try {
      const workbook = XLSX.utils.book_new();

      // --- Sheet 1: Template Data ---
      const templateHeaders = [
        "Nama Produk*",
        "Kategori*",
        "Satuan*",
        "Harga Modal HPP (Rp)*",
        "Harga Jual (Rp)*",
        "Stok Awal",
        "Batas Minimum Stok",
        "Barcode (Opsional)",
      ];
      const templateRows = [
        ["Buku Tulis 38 Lembar", "Alat Tulis", "pcs", 3500, 5000, 100, 10, ""],
        ["Kitab Safinah", "Kitab", "buku", 45000, 65000, 25, 3, ""],
        ["Air Mineral 600ml", "Makanan/Minuman", "botol", 2500, 4000, 50, 5, ""],
      ];
      const templateWs = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);

      const tLastCol = XLSX.utils.encode_col(templateHeaders.length - 1);
      for (let c = 0; c < templateHeaders.length; c += 1) {
        const cell = XLSX.utils.encode_cell({ r: 0, c });
        if (templateWs[cell]) templateWs[cell].s = headerStyle;
      }
      templateWs["!cols"] = templateHeaders.map((header, column) => ({
        wch: Math.min(
          Math.max(
            header.length + 4,
            ...templateRows.map((row) => String(row[column] ?? "").length + 2),
            16
          ),
          40
        ),
      }));
      templateWs["!rows"] = [{ hpt: 34 }];
      templateWs["!autofilter"] = { ref: `A1:${tLastCol}1` };
      XLSX.utils.book_append_sheet(workbook, templateWs, "Template Data");

      // --- Sheet 2: Panduan Pengisian ---
      const guideRows = [
        ["PANDUAN PENGISIAN TEMPLATE IMPOR STOK BARANG"],
        ["Pondok Pesantren Nurul Albab"],
        [""],
        ["Kategori yang tersedia:", "Alat Tulis, Kitab, Makanan/Minuman, Seragam, Lainnya"],
        ["Kolom yang ditandai bintang (*) wajib diisi."],
        ["HPP dan Harga Jual diisi hanya angka, tanpa titik atau koma (contoh: 3500, 5000)."],
        ["Stok Awal dan Batas Minimum Stok diisi angka bulat >= 0."],
        ["Kolom Kode SKU tidak perlu diisi; sistem akan men-generate otomatis saat impor."],
        ["Jika memilih 'Lainnya', tulis nama kategori baru di kolom Kategori."],
        ["Barcode bersifat opsional; boleh dikosongkan."],
      ];
      const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
      guideWs["A1"].s = titleStyle;
      guideWs["!cols"] = [0, 1].map((column) => ({
        wch: Math.min(
          Math.max(...guideRows.map((row) => String(row[column] ?? "").length + 2), 16),
          80
        ),
      }));
      Object.keys(guideWs)
        .filter((cell) => !cell.startsWith("!"))
        .forEach((cell) => {
          guideWs[cell].s = {
            ...guideWs[cell].s,
            alignment: { vertical: "top", wrapText: true },
          };
        });
      guideWs["A1"].s = titleStyle;
      XLSX.utils.book_append_sheet(workbook, guideWs, "Panduan Pengisian");

      XLSX.writeFile(workbook, "Template_Import_Stok_Barang.xlsx");
      setMessage("Template impor berhasil diunduh.");
    } catch (error: unknown) {
      console.error("Gagal unduh template:", error);
      setMessage(`Unduh template gagal: ${getErrorMessage(error)}`);
    }
  }, []);

  // ============================================================================
  // Import Excel – baca, validasi, preview, generate SKU, insert massal
  // ============================================================================
  const readExcelFile = async (file: File): Promise<unknown[][]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
  };

  const handleImportFile = async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setMessage("Pilih file Excel (.xlsx, .xls) atau CSV.");
      return;
    }

    setImportFile(file);
    setShowImportPreview(false);
    setImportPreview([]);

    try {
      const raw = await readExcelFile(file);
      if (!raw || raw.length < 2) {
        setMessage("File Excel tidak berisi data baris.");
        return;
      }

      const headerRow = raw[0].map(normalizeImportHeader);
      const dataRows = raw.slice(1);
      const preview: ImportPreviewItem[] = [];

      let validCount = 0;
      dataRows.forEach((row, idx) => {
        const rowNumber = idx + 2;
        const mapped: Record<string, unknown> = {};
        headerRow.forEach((h, ci) => {
          mapped[h] = row[ci] ?? "";
        });

        const errors: string[] = [];
        const name = String(mapped.nama_produk ?? "").trim();
        const category = String(mapped.category ?? "Lainnya").trim() || "Lainnya";
        const hpp = parseImportNumber(mapped.hpp);
        const hargaJual = parseImportNumber(mapped.harga_jual);
        const stok = Math.round(parseImportNumber(mapped.stok));
        const minStokRaw = String(mapped.min_stok ?? "").trim();
        const minStok = minStokRaw ? Math.round(parseImportNumber(minStokRaw)) : 5;

        if (!name) errors.push("Nama produk wajib diisi.");
        if (!Number.isFinite(hpp) || hpp < 0) errors.push("HPP harus angka >= 0.");
        if (!Number.isFinite(hargaJual) || hargaJual <= 0) errors.push("Harga jual harus > 0.");
        if (!Number.isFinite(stok) || stok < 0) errors.push("Stok harus angka >= 0.");
        if (!Number.isFinite(minStok) || minStok < 0) errors.push("Min stok harus angka >= 0.");

        const valid = errors.length === 0;
        if (valid) validCount += 1;

        preview.push({
          row: rowNumber,
          data: {
            nama_produk: name,
            category,
            unit: String(mapped.unit ?? "pcs").trim() || "pcs",
            barcode: String(mapped.barcode ?? "").trim() || null,
            hpp,
            harga_jual: hargaJual,
            stok,
            min_stok: minStok,
            image_url: String(mapped.image_url ?? "").trim() || null,
            // Impor selalu mengaktifkan produk agar langsung terbaca notifikasi stok.
            is_active: true,
          },
          valid,
          error: errors.length ? errors.join("; ") : undefined,
        });
      });

      setImportPreview(preview);
      setShowImportModal(false);
      setShowImportPreview(true);
      setMessage(`Ditemukan ${preview.length} baris, ${validCount} valid untuk diimpor.`);
    } catch (error: unknown) {
      console.error("Gagal baca Excel:", error);
      setMessage(`Gagal membaca file Excel: ${getErrorMessage(error)}`);
    }
  };
  const handleConfirmImport = async () => {
    const validRows = importPreview.filter((p) => p.valid);
    if (validRows.length === 0) {
      setMessage("Tidak ada baris valid untuk diimpor.");
      return;
    }

    setIsImporting(true);
    try {
      const supabase = createClient();

      const existingByCategory: Record<string, number> = {};
      products.forEach((p) => {
        existingByCategory[p.category] = (existingByCategory[p.category] ?? 0) + 1;
      });

      const inserts: ProductImportInsert[] = [];
      validRows.forEach(({ data }) => {
        const cat = data.category;
        const count = (existingByCategory[cat] ?? 0) + 1;
        existingByCategory[cat] = count;
        const sku = `${skuPrefixes[cat] ?? "BRG-"}${String(count).padStart(3, "0")}`;
        const safeStock = Math.max(0, Math.round(data.stok));
        const safeMinStock = Math.max(0, Math.round(data.min_stok));

        inserts.push({
          nama_produk: data.nama_produk,
          name: data.nama_produk,
          kode_barang: sku,
          sku,
          kategori: data.category,
          category: data.category,
          satuan: data.unit,
          unit: data.unit,
          hpp: data.hpp,
          cost_price: data.hpp,
          harga_beli: data.hpp,
          harga_jual: data.harga_jual,
          selling_price: data.harga_jual,
          stok: safeStock,
          stock: safeStock,
          min_stock: safeMinStock,
          min_stok: safeMinStock,
          barcode: data.barcode,
          image_url: data.image_url,
          is_active: true,
        });
      });

      const { error } = await supabase
        .from("produk_koperasi")
        // The deployed table includes legacy alias columns missing from generated Database types.
        .insert(inserts as unknown as ProductInsert[])
        .select("*");

      if (error) throw error;

      setShowImportPreview(false);
      setImportPreview([]);
      setImportFile(null);
      void loadProducts();
      requestAlertsRefresh();
      setMessage(`${inserts.length} produk berhasil diimpor ke stok koperasi.`);
    } catch (error: unknown) {
      console.error("Gagal impor massal:", error);
      setMessage(`Impor gagal: ${getErrorMessage(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  async function submitRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rawQuantity = formData.get("quantity");
    const amount = Number(rawQuantity);

    if (
      !restockProduct ||
      rawQuantity == null ||
      String(rawQuantity).trim() === "" ||
      !Number.isInteger(amount) ||
      amount < (stockAdjustmentMode === "set" ? 0 : 1)
    ) {
      setMessage(stockAdjustmentMode === "set"
        ? "Stok akhir harus berupa angka bulat minimal 0."
        : "Jumlah penyesuaian stok harus berupa angka bulat lebih dari nol.");
      return;
    }

    const finalStock = stockAdjustmentMode === "add"
      ? restockProduct.stock + amount
      : stockAdjustmentMode === "subtract"
        ? restockProduct.stock - amount
        : amount;
    if (finalStock < 0) {
      setMessage(`Stok tidak dapat kurang dari 0. Stok saat ini ${restockProduct.stock} ${restockProduct.unit}.`);
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const restockUpdate = { stok: finalStock, stock: finalStock } as unknown as ProductUpdate;
    const { error: updateError } = await supabase
      .from("produk_koperasi")
      .update(restockUpdate)
      .eq("id", restockProduct.id);

    if (updateError) {
      console.error("Gagal tambah stok:", updateError);
      setMessage(`Stok gagal diperbarui: ${updateError.message}`);
      setIsSaving(false);
      return;
    }

    setProducts((current) =>
      current.map((p) => (p.id === restockProduct.id ? { ...p, stock: finalStock } : p))
    );
    requestAlertsRefresh();
    setMessage(`Stok ${restockProduct.name} berhasil diperbarui menjadi ${finalStock} ${restockProduct.unit}.`);
    setRestockProduct(null);
    setIsSaving(false);
  }

  async function archiveProduct(product: UnifiedProduct) {
    if (!window.confirm(`Nonaktifkan produk "${product.name}"?`)) return;

    const { error } = await createClient()
      .from("produk_koperasi")
      .update({ is_active: false })
      .eq("id", product.id);

    if (error) {
      console.error("Gagal nonaktifkan produk:", error);
      setMessage(`Produk gagal dinonaktifkan: ${error.message}`);
      return;
    }

    setProducts((current) => current.filter((item) => item.id !== product.id));
    requestAlertsRefresh();
    setMessage(`Produk "${product.name}" dinonaktifkan.`);
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Koperasi Pesantren / Manajemen Stok"
        title="Manajemen stok"
        description="Kelola katalog, HPP, harga jual, margin, dan batas minimum stok dalam satu dasbor."
        action={
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:w-auto md:items-center">
            <PrimaryButton onClick={handleExportExcel} disabled={exporting || isLoading} className="w-full justify-center md:w-auto">
              {exporting ? "Mengekspor…" : <><Icon name="download" size={14} /> Export Excel</>}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => {
                setImportFile(null);
                setImportPreview([]);
                setShowImportModal(true);
              }}
              disabled={isLoading}
              className="w-full justify-center md:w-auto"
            >
              {isImporting ? "Mengimpor…" : <><Icon name="file" size={14} /> Import Excel</>}
            </PrimaryButton>
            <PrimaryButton onClick={() => openEditor(null)} className="w-full justify-center md:w-auto">
              <Icon name="plus" size={16} /> Tambah Produk
            </PrimaryButton>
          </div>
        }
      />

      <div className="-mt-2">
        <CooperativeNav active="/koperasi/stok" />
      </div>

      {message && <FormMessage>{message}</FormMessage>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-full">
          <MetricCard label="Produk aktif" value={String(products.length)} detail="Produk dalam inventori" icon="store" />
        </div>
        <div className="h-full">
          <MetricCard label="Stok menipis" value={String(lowStock)} detail="Stok di bawah batas minimum" icon="clock" tone="bg-[#fff4e7] text-[#bd7627]" />
        </div>
        <div className="h-full sm:col-span-2 lg:col-span-1">
          <MetricCard label="Nilai modal stok" value={formatRupiah(stockValue)} detail="Stok fisik × HPP modal" icon="wallet" tone="bg-[#e8f5f0] text-[#25815e]" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_200px] lg:items-center">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Pencarian</span>
            <span className="relative block">
              <Icon
                name="search"
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, SKU, atau barcode…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10"
              />
            </span>
          </label>
          <Field label="Kategori" name="category" value={category} onChange={setCategory}>
            <option>Semua kategori</option>
            {categories.map((item) => (
              <option key={item.id}>{item.name}</option>
            ))}
          </Field>
          <Field label="Status stok" name="stock" value={stockFilter} onChange={setStockFilter}>
            <option>Semua stok</option>
            <option>Menipis</option>
            <option>Stok Kosong</option>
            <option>Aman</option>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{visibleProducts.length}</span> produk
            ditampilkan dari {products.length} produk aktif
          </p>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              Aman {products.filter((p) => p.stock > p.min_stock).length}
            </span>
            <span className="rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-amber-700">
              Menipis {products.filter((p) => p.stock > 0 && p.stock <= p.min_stock).length}
            </span>
            <span className="rounded-full border border-rose-200/70 bg-rose-50 px-2.5 py-1 text-rose-700">
              Kosong {products.filter((p) => p.stock === 0).length}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-4 py-3.5 sm:px-5">Foto</th>
                <th className="px-4 py-3.5 sm:px-5">Barcode / Produk</th>
                <th className="px-4 py-3.5 sm:px-5">Kategori</th>
                <th className="px-4 py-3.5 text-right sm:px-5">Modal HPP</th>
                <th className="px-4 py-3.5 text-right sm:px-5">Harga jual</th>
                <th className="px-4 py-3.5 text-right sm:px-5">Margin</th>
                <th className="px-4 py-3.5 sm:px-5">Stok / minimum</th>
                <th className="px-4 py-3.5 sm:px-5">Status</th>
                <th className="px-4 py-3.5 text-center sm:px-5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const empty = product.stock === 0;
                const low = product.stock > 0 && product.stock <= product.min_stock;
                const margin = product.selling_price - product.cost_price;
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-slate-100 align-middle transition last:border-0 hover:bg-slate-50/70 ${
                      empty ? "bg-rose-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={32}
                            height={32}
                            unoptimized
                            className="size-8 rounded-lg object-cover"
                          />
                        ) : (
                          <Icon name={getProductCategoryIcon(product.category, categories.find((item) => item.name === product.category)?.icon)} size={16} className="text-[#4457ff]" />
                        )}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-4 py-3.5 sm:px-5">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {product.name}
                      </span>
                      <span className="mt-1 block truncate text-[10px] tabular-nums text-slate-500">
                        {product.barcode || product.sku} · SKU {product.sku}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        <Icon name={getProductCategoryIcon(product.category, categories.find((item) => item.name === product.category)?.icon)} size={13} className="text-[#4457ff]" />
                        {product.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs tabular-nums text-slate-600 sm:px-5">
                      {formatRupiah(product.cost_price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-bold tabular-nums text-slate-800 sm:px-5">
                      {formatRupiah(product.selling_price)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold tabular-nums sm:px-5 ${
                        margin >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatRupiah(margin)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3.5 text-xs font-bold tabular-nums sm:px-5 ${
                        low || empty ? "text-rose-600" : "text-slate-700"
                      }`}
                    >
                      {product.stock} {product.unit}
                      <span className="block pt-1 text-[10px] font-normal text-slate-400">
                        Min. {product.min_stock}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge
                        label={empty ? "Stok Kosong" : low ? "Menipis" : "Aman"}
                        tone={
                          empty
                            ? "border border-rose-200/70 bg-rose-50 text-rose-700"
                            : low
                              ? "border border-amber-200/70 bg-amber-50 text-amber-700"
                              : "border border-emerald-200/70 bg-emerald-50 text-emerald-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setStockAdjustmentMode("add");
                            setRestockProduct(product);
                          }}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#eef0ff] px-3 text-xs font-semibold text-[#4457ff] transition hover:bg-[#dbeafe]"
                        >
                          <Icon name="settings" size={13} /> Atur stok
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditor(product)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Nonaktifkan ${product.name}`}
                          title={`Nonaktifkan ${product.name}`}
                          onClick={() => void archiveProduct(product)}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !visibleProducts.length && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                    Produk tidak ditemukan. Coba ubah kata kunci atau filter stok.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                    Memuat data stok…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 md:hidden">
          {visibleProducts.map((product) => {
            const empty = product.stock === 0;
            const low = product.stock > 0 && product.stock <= product.min_stock;
            const margin = product.selling_price - product.cost_price;
            return (
              <article
                key={product.id}
                className={`rounded-2xl border p-4 ${empty ? "border-rose-200 bg-rose-50/40" : low ? "border-amber-200/70 bg-amber-50/30" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={36}
                        height={36}
                        unoptimized
                        className="size-9 rounded-lg object-cover"
                      />
                    ) : (
                      <Icon name={getProductCategoryIcon(product.category, categories.find((item) => item.name === product.category)?.icon)} size={17} className="text-[#4457ff]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-slate-800">{product.name}</h3>
                        <p className="mt-0.5 truncate text-[10px] tabular-nums text-slate-500">
                          {product.barcode || product.sku} · SKU {product.sku}
                        </p>
                      </div>
                      <StatusBadge
                        label={empty ? "Stok Kosong" : low ? "Menipis" : "Aman"}
                        tone={
                          empty
                            ? "border border-rose-200/70 bg-rose-50 text-rose-700"
                            : low
                              ? "border border-amber-200/70 bg-amber-50 text-amber-700"
                              : "border border-emerald-200/70 bg-emerald-50 text-emerald-700"
                        }
                      />
                    </div>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      <Icon name={getProductCategoryIcon(product.category, categories.find((item) => item.name === product.category)?.icon)} size={13} className="text-[#4457ff]" />
                      {product.category}
                    </span>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white/70 p-3 text-[10px]">
                  <div>
                    <dt className="text-slate-400">HPP</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-700">{formatRupiah(product.cost_price)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Harga jual</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-slate-800">{formatRupiah(product.selling_price)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Margin</dt>
                    <dd className={`mt-0.5 font-semibold tabular-nums ${margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {formatRupiah(margin)}
                    </dd>
                  </div>
                  <div className="col-span-3 flex items-center justify-between border-t border-slate-100 pt-2">
                    <dt className="text-slate-400">Stok / minimum</dt>
                    <dd className={`font-bold tabular-nums ${low || empty ? "text-rose-600" : "text-slate-700"}`}>
                      {product.stock} {product.unit} · min. {product.min_stock}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStockAdjustmentMode("add");
                      setRestockProduct(product);
                    }}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#eef0ff] px-4 text-xs font-semibold text-[#4457ff]"
                  >
                    <Icon name="settings" size={13} /> Atur stok
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(product)}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-semibold text-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Nonaktifkan ${product.name}`}
                    onClick={() => void archiveProduct(product)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-rose-200/70 text-rose-600"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </article>
            );
          })}
          {!isLoading && !visibleProducts.length && (
            <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Produk tidak ditemukan. Coba ubah kata kunci atau filter stok.
            </p>
          )}
          {isLoading && (
            <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Memuat data stok…
            </p>
          )}
        </div>
      </section>

      {editor && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSaving) setEditor(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={editor.product ? "Edit produk" : "Tambah produk"}
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:rounded-3xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{editor.product ? "Edit produk" : "Tambah produk"}</h2>
                <p className="mt-1 text-xs text-[#757693]">Atur data katalog, harga modal HPP, dan stok minimum.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="flex size-10 items-center justify-center rounded-full bg-[#f3f5ff]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <form key={editor.product?.id ?? "new-product"} onSubmit={saveProduct} className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* SKU: auto-generate, read-only namun bisa diedit / di-reset */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#55566f]">Kode SKU / Barang</label>
                <div className="flex gap-2 mt-1.5">
                <input
                  name="sku"
                  readOnly={!!editor?.product?.id}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ATK-001"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setSku(generateSku(category, products))}
                  disabled={isSaving || !!editor?.product?.id}
                  className="min-h-11 rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm text-[#4457ff] font-semibold hover:bg-[#eef0ff] disabled:opacity-50"
                >
                  {editor?.product?.id ? "Kunci (edit)" : "Generate ulang"}
                </button>
                </div>
                {editor?.product?.id && (
                  <p className="mt-1 text-[10px] text-[#8a8ba2]">SKU produk lama dipertahankan saat edit.</p>
                )}
              </div>

              <Field label="Barcode (opsional)" name="barcode" placeholder="Scan barcode" defaultValue={editor.product?.barcode ?? ""} />
              <Field label="Nama produk" name="name" placeholder="Buku tulis 38 lembar" defaultValue={editor.product?.name} required />
              {/* Kategori + input custom saat "Lainnya" */}
              <div className="col-span-2 sm:col-span-1">
                <Field label="Kategori" name="category" defaultValue={editor.product?.category ?? categories[0]?.name ?? "Lainnya"} onChange={handleEditorCategoryChange}>
                  {categories.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </Field>
                {category === "Lainnya" && (
                  <>
                    <Field
                      label="Keterangan Kategori Baru"
                      name="custom_category"
                      placeholder="Misal: Alat Olahraga"
                    />
                    <fieldset className="mt-3">
                      <legend className="text-[11px] font-semibold text-[#55566f]">Ikon kategori</legend>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {categoryIconOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setNewCategoryIcon(option.value)}
                            aria-label={option.label}
                            aria-pressed={newCategoryIcon === option.value}
                            title={option.label}
                            className={`flex min-h-10 items-center justify-center rounded-xl border transition-colors ${newCategoryIcon === option.value ? "border-[#4457ff] bg-[#eef0ff] text-[#4457ff]" : "border-[#e5e7eb] bg-white text-[#757693] hover:border-[#cbd0ff]"}`}
                          >
                            <Icon name={option.value} size={18} />
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>
              <Field label="Satuan" name="unit" placeholder="pcs / botol / buku" defaultValue={editor.product?.unit ?? "pcs"} required />

              {/* Foto: tab URL atau File */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#55566f]">Sumber foto</label>
                <div className="flex gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setImageMode("url")}
                    className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${imageMode === "url" ? "bg-[#4457ff] text-white" : "bg-white border border-[#e5e7eb] text-[#55566f] hover:bg-[#f3f5ff]"}`}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode("file")}
                    className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${imageMode === "file" ? "bg-[#4457ff] text-white" : "bg-white border border-[#e5e7eb] text-[#55566f] hover:bg-[#f3f5ff]"}`}
                  >
                    File / Kamera
                  </button>
                </div>
              </div>

              {imageMode === "url" ? (
                <Field
                  label="URL foto produk (opsional)"
                  name="image_url"
                  placeholder="https://…"
                  defaultValue={editor.product?.image_url ?? ""}
                />
              ) : (
                <>
                  <label className="block text-xs font-semibold text-[#55566f]">Pilih file gambar / ambil foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0] ?? null;
                      setImageFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setImagePreview(url);
                      } else {
                        setImagePreview(null);
                      }
                    }}
                    className="mt-1.5 block w-full text-sm text-[#55566f] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#4457ff] file:text-white hover:file:bg-[#3a4fd4]"
                  />
                  {imagePreview && (
                    <div className="mt-2 flex size-16 shrink-0 items-center justify-center rounded-xl bg-[#f3f5ff] border border-[#e5e7eb]">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={56}
                        height={56}
                        unoptimized
                        className="size-14 rounded-lg object-cover"
                      />
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-[#8a8ba2]">File akan diunggah ke Supabase Storage (bucket `koperasi`); fallback data URL jika storage tidak tersedia.</p>
                </>
              )}
              <Field label="Harga modal HPP (Rp)" name="cost_price" type="number" placeholder="0" defaultValue={String(editor.product?.cost_price ?? "")} required />
              <Field label="Harga jual (Rp)" name="selling_price" type="number" placeholder="0" defaultValue={String(editor.product?.selling_price ?? "")} required />
              <Field label="Stok saat ini" name="stock" type="number" placeholder="0" defaultValue={String(editor.product?.stock ?? 0)} required />
              <Field label="Batas minimum stok" name="min_stock" type="number" placeholder="5" defaultValue={String(editor.product?.min_stock ?? 5)} required />

              <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditor(null)}
                  className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]"
                >
                  Batal
                </button>
                <PrimaryButton type="submit" disabled={isSaving}>
                  {isSaving ? "Menyimpan…" : editor.product ? "Simpan Perubahan" : "Tambah Produk"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {restockProduct && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSaving) setRestockProduct(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Atur stok produk"
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:rounded-3xl sm:p-6"
          >
            <h2 className="text-lg font-bold">Atur stok produk</h2>
            <p className="mt-1 text-xs text-[#757693]">
              {restockProduct.name} · stok sekarang {restockProduct.stock} {restockProduct.unit}
            </p>
            <form onSubmit={submitRestock} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mode penyesuaian stok">
                {([
                  ["add", "Tambah (+)"],
                  ["subtract", "Kurangi (-)"],
                  ["set", "Atur langsung (=)"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={stockAdjustmentMode === mode}
                    onClick={() => setStockAdjustmentMode(mode)}
                    className={`min-h-10 rounded-xl border px-2 text-xs font-semibold transition ${
                      stockAdjustmentMode === mode
                        ? "border-[#4457ff] bg-[#eef0ff] text-[#4457ff]"
                        : "border-[#e5e7eb] text-[#757693] hover:bg-[#f8f9ff]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-semibold text-[#55566f]">
                {stockAdjustmentMode === "add"
                  ? "Jumlah stok yang ditambahkan"
                  : stockAdjustmentMode === "subtract"
                    ? "Jumlah stok yang dikurangi"
                    : "Jumlah stok akhir"}
                <input
                  autoFocus
                  name="quantity"
                  type="number"
                  min={stockAdjustmentMode === "set" ? 0 : 1}
                  max={stockAdjustmentMode === "subtract" ? restockProduct.stock : undefined}
                  step={1}
                  placeholder={stockAdjustmentMode === "set" ? String(restockProduct.stock) : "10"}
                  required
                  className={inputClass}
                />
              </label>
              {stockAdjustmentMode === "subtract" && (
                <p className="text-[11px] text-[#757693]">
                  Pengurangan tidak dapat melebihi stok saat ini ({restockProduct.stock} {restockProduct.unit}).
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#757693]"
                >
                  Batal
                </button>
                <PrimaryButton type="submit" disabled={isSaving}>
                  {isSaving
                    ? "Menyimpan…"
                    : stockAdjustmentMode === "add"
                      ? "Tambah Stok"
                      : stockAdjustmentMode === "subtract"
                        ? "Kurangi Stok"
                        : "Atur Stok"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#181c31]/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <section className="w-full max-w-xl rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_24px_80px_rgba(24,28,49,0.18)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Import Data Barang</h2>
                <p className="mt-1 text-xs text-[#757693]">Unggah file Excel atau CSV untuk menambahkan stok barang.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                aria-label="Tutup modal impor"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3f5ff]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4457ff] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#3648e8]"
            >
              <Icon name="file" size={17} />
              <Icon name="download" size={15} />
              Unduh Template Excel
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
                event.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => importInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  importInputRef.current?.click();
                }
              }}
              onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingImportFile(true);
              }}
              onDragLeave={() => setIsDraggingImportFile(false)}
              onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingImportFile(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleImportFile(file);
              }}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                isDraggingImportFile
                  ? "border-[#4457ff] bg-[#eef0ff]"
                  : "border-[#d9dbea] bg-[#fafaff] hover:border-[#4457ff]"
              }`}
            >
              <Icon name="file" size={28} className="mx-auto text-[#4457ff]" />
              <p className="mt-3 text-sm font-semibold text-[#292a40]">Seret file ke sini atau klik untuk memilih</p>
              <p className="mt-1 text-xs text-[#757693]">Format yang didukung: .xlsx, .xls, .csv</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="min-h-10 rounded-full px-4 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]"
              >
                Batal
              </button>
            </div>
          </section>
        </div>
      )}
      {showImportPreview && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#e5e7eb] bg-white p-4 shadow-[0_24px_80px_rgba(24,28,49,0.18)] sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Preview Import Excel</h2>
                <p className="mt-1 truncate text-xs text-[#757693]">{importFile?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex min-h-10 items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-3 text-xs font-semibold text-[#55566f] hover:bg-[#f3f5ff]"
                >
                  <Icon name="download" size={14} /> Unduh Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportPreview(false)}
                  aria-label="Tutup pratinjau impor"
                  className="flex size-10 items-center justify-center rounded-full bg-[#f3f5ff]"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
            <div className="mb-4 overflow-x-auto rounded-xl border border-[#e5e7eb]">
              <table className="w-full min-w-[640px] border-collapse text-xs">
                <thead className="bg-[#fafaff]">
                  <tr>
                    <th className="border-b px-3 py-2 text-left">#</th>
                    <th className="border-b px-3 py-2 text-left">Nama Produk</th>
                    <th className="border-b px-3 py-2 text-left">Kategori</th>
                    <th className="border-b px-3 py-2 text-center">HPP</th>
                    <th className="border-b px-3 py-2 text-center">Harga Jual</th>
                    <th className="border-b px-3 py-2 text-center">Stok</th>
                    <th className="border-b px-3 py-2 text-center">Status</th>
                    {importPreview.some((p) => !p.valid) && (
                      <th className="border-b px-3 py-2 text-left">Kesalahan</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((item) => (
                    <tr
                      key={item.row}
                      className={`border-b ${!item.valid ? "bg-[#fff7f7]" : ""}`}
                    >
                      <td className="px-3 py-2">{item.row}</td>
                      <td className="px-3 py-2 font-medium">{item.data.nama_produk}</td>
                      <td className="px-3 py-2">{item.data.category}</td>
                      <td className="px-3 py-2 tabular-nums">{formatRupiah(item.data.hpp)}</td>
                      <td className="px-3 py-2 tabular-nums font-semibold">
                        {formatRupiah(item.data.harga_jual)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{item.data.stok}</td>
                      <td className="px-3 py-2">{item.data.is_active ? "Aktif" : "Tidak Aktif"}</td>
                      {!item.valid && (
                        <td className="px-3 py-2 text-[10px] text-[#b74444]">{item.error}</td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-[#eef0ff] font-semibold">
                    <td colSpan={importPreview.some((p) => !p.valid) ? 8 : 7} className="px-3 py-2">
                      Total valid: {importPreview.filter((p) => p.valid).length} dari{" "}
                      {importPreview.length} baris
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowImportPreview(false)}
                className="min-h-10 rounded-full px-4 text-sm font-semibold text-[#757693] hover:bg-[#f3f5ff]"
              >
                Batal
              </button>
              <PrimaryButton
                type="button"
                onClick={handleConfirmImport}
                disabled={
                  isImporting || importPreview.filter((p) => p.valid).length === 0
                }
              >
                {isImporting ? "Mengimpor…" : "Konfirmasi Impor"}
              </PrimaryButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}