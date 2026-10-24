type RawRecord = Record<string, unknown>;

type NormalizedAccount = {
  id: string;
  name: string;
  account_number: string;
  balance: number;
  opening_balance: number;
  is_active: boolean;
};

type NormalizedComponent = {
  id: string;
  name: string;
  category: string;
  amount: number;
  is_active: boolean;
};

type NormalizedProduct = {
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
};

function firstString(record: RawRecord, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return fallback;
}

function firstNumber(record: RawRecord, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function activeValue(record: RawRecord): boolean {
  const value = record.is_active;
  return typeof value === "boolean" ? value : value == null ? true : Boolean(value);
}

export function normalizeAccount(a: RawRecord): NormalizedAccount {
  return {
    id: firstString(a, ["id"], ""),
    name: firstString(a, ["name", "nama_kas", "nama"], "Kas"),
    account_number: firstString(a, ["account_number", "nomor_rekening"], "-"),
    balance: firstNumber(a, ["balance", "saldo"], 0),
    opening_balance: firstNumber(a, ["opening_balance", "saldo_awal"], 0),
    is_active: activeValue(a),
  };
}

export function normalizeComponent(c: RawRecord): NormalizedComponent {
  return {
    id: firstString(c, ["id"], ""),
    name: firstString(c, ["name", "nama_pos", "nama_komponen"], "Iuran"),
    category: firstString(c, ["category", "kategori"], "Bulanan"),
    amount: firstNumber(c, ["amount", "nominal", "tarif_default", "nominal_default"], 0),
    is_active: activeValue(c),
  };
}

export function normalizeProduct(p: RawRecord): NormalizedProduct {
  const imageUrl = firstString(p, ["image_url"], "");
  return {
    id: firstString(p, ["id"], ""),
    sku: firstString(p, ["sku", "kode_barang", "barcode"], ""),
    barcode: firstString(p, ["barcode"], "") || null,
    name: firstString(p, ["name", "nama_produk"], "Produk"),
    category: firstString(p, ["category", "kategori"], "Umum"),
    unit: firstString(p, ["unit", "satuan"], "pcs"),
    cost_price: firstNumber(p, ["cost_price", "hpp", "harga_beli", "buy_price"], 0),
    selling_price: firstNumber(p, ["selling_price", "harga_jual", "price", "sell_price"], 0),
    stock: firstNumber(p, ["stock", "stok"], 0),
    min_stock: firstNumber(p, ["min_stock", "min_stok"], 5),
    image_url: imageUrl || null,
    is_active: activeValue(p),
  };
}
