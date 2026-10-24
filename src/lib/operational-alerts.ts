import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProduct } from "@/lib/data-normalizer";

export type OperationalAlertTone = "danger" | "warning";
export type OperationalAlertKind = "stock" | "permit";

export type OperationalAlert = {
  id: string;
  kind: OperationalAlertKind;
  title: string;
  description: string;
  badge: string;
  tone: OperationalAlertTone;
  href: string;
  stock?: number;
  minStock?: number;
};

/**
 * Kolom yang dibaca notifikasi stok. Alias Indonesia dan Inggris sengaja
 * diminta sekaligus agar notifikasi tetap benar pada data hasil impor lama
 * yang hanya mengisi salah satu pasangan kolom.
 */
export const PRODUCT_ALERT_COLUMNS =
  "id, name, nama_produk, sku, kode_barang, stock, stok, min_stock, min_stok, is_active, unit, satuan, category, kategori, cost_price, hpp, selling_price, harga_jual";

export const ALERTS_REFRESH_EVENT = "nais:alerts-refresh";

/** Meminta header dan dashboard memuat ulang peringatan setelah mutasi data. */
export function requestAlertsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERTS_REFRESH_EVENT));
}

export function sortOperationalAlerts(alerts: OperationalAlert[]) {
  return [...alerts].sort((first, second) => {
    if (first.tone !== second.tone) return first.tone === "danger" ? -1 : 1;
    return first.title.localeCompare(second.title, "id-ID");
  });
}

export function buildStockAlerts(
  rows: Array<Record<string, unknown>> | null | undefined,
): OperationalAlert[] {
  const alerts = (rows ?? [])
    .filter((row) => row.is_active !== false)
    .map((row) => normalizeProduct(row))
    .filter((product) => product.stock <= product.min_stock)
    .map((product) => {
      const empty = product.stock <= 0;
      const unit = product.unit || "unit";
      return {
        id: `${empty ? "stock-empty" : "stock-low"}-${product.id || product.name}`,
        kind: "stock" as const,
        title: product.name,
        description: empty
          ? "Stok Kosong (0 tersisa) — segera lakukan pengadaan."
          : `Sisa ${product.stock} ${unit}, di bawah minimum ${product.min_stock}.`,
        badge: empty ? "Stok Kosong" : "Menipis",
        tone: empty ? ("danger" as const) : ("warning" as const),
        href: "/koperasi/stok",
        stock: product.stock,
        minStock: product.min_stock,
      };
    });

  return sortOperationalAlerts(alerts);
}

export function buildPermitAlerts(
  permits: Array<Record<string, unknown>> | null | undefined,
  studentNames: Map<string, string>,
  now = Date.now(),
): OperationalAlert[] {
  const alerts = (permits ?? [])
    .filter((permit) => {
      if (permit.kedatangan_aktual) return false;
      const status = String(permit.status ?? "").toLowerCase();
      return !["ditolak", "rejected", "dibatalkan", "cancelled", "canceled", "kembali", "returned"]
        .some((keyword) => status.includes(keyword));
    })
    .map((permit) => {
    const studentName = studentNames.get(String(permit.santri_id ?? "")) ?? "Santri";
    const reason = String(permit.alasan_izin ?? "izin keluar");
    const deadline = permit.batas_kembali
      ? new Date(String(permit.batas_kembali)).getTime()
      : Number.NaN;
    const isLate = Number.isFinite(deadline) && deadline < now;

    return {
      id: `permit-${String(permit.id ?? studentName)}`,
      kind: "permit" as const,
      title: studentName,
      description: isLate
        ? `Melewati batas kembali — ${reason}.`
        : `Masih di luar pondok — ${reason}.`,
      badge: isLate ? "Terlambat" : "Di Luar",
      tone: isLate ? ("danger" as const) : ("warning" as const),
      href: "/perizinan",
    };
  });

  return sortOperationalAlerts(alerts);
}

export async function fetchOperationalAlerts(supabase: SupabaseClient): Promise<{
  alerts: OperationalAlert[];
  errors: string[];
}> {
  const errors: string[] = [];

  const [primaryProducts, permitResult, studentResult] = await Promise.all([
    supabase
      .from("produk_koperasi")
      .select(PRODUCT_ALERT_COLUMNS)
      .or("is_active.is.null,is_active.eq.true"),
    supabase
      .from("perizinan_santri")
      .select("id, santri_id, batas_kembali, alasan_izin, kedatangan_aktual, status")
      .is("kedatangan_aktual", null)
      .limit(100),
    supabase.from("santri").select("id, nama_lengkap").limit(2000),
  ]);

  let productRows: Array<Record<string, unknown>> = [];
  if (primaryProducts.error) {
    // Jaga kompatibilitas bila PostgREST belum mengenali filter kolom aktif.
    const fallbackProducts = await supabase.from("produk_koperasi").select("*");
    if (fallbackProducts.error) {
      errors.push(fallbackProducts.error.message);
    } else {
      productRows = (fallbackProducts.data ?? []) as Array<Record<string, unknown>>;
    }
  } else {
    productRows = (primaryProducts.data ?? []) as Array<Record<string, unknown>>;
  }

  const studentNames = new Map(
    ((studentResult.data ?? []) as Array<{ id: string; nama_lengkap: string }>).map((student) => [
      student.id,
      student.nama_lengkap,
    ]),
  );

  if (permitResult.error) errors.push(permitResult.error.message);
  if (studentResult.error) errors.push(studentResult.error.message);

  return {
    alerts: sortOperationalAlerts([
      ...buildStockAlerts(productRows),
      ...buildPermitAlerts(
        (permitResult.data ?? []) as Array<Record<string, unknown>>,
        studentNames,
      ),
    ]),
    errors,
  };
}
