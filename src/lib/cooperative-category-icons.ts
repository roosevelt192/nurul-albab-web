export type ProductCategoryIcon =
  | "utensils-crossed"
  | "pencil"
  | "book-open"
  | "shirt"
  | "package"
  | "coffee"
  | "apple"
  | "backpack";

const categoryIcons: Record<string, ProductCategoryIcon> = {
  "alat tulis": "pencil",
  atk: "pencil",
  kitab: "book-open",
  buku: "book-open",
  "makanan/minuman": "utensils-crossed",
  makanan: "apple",
  minuman: "coffee",
  seragam: "shirt",
  lainnya: "package",
};

export function getProductCategoryIcon(category: string, configuredIcon?: string): ProductCategoryIcon {
  const supportedIcons = new Set<string>([
    "utensils-crossed",
    "pencil",
    "book-open",
    "shirt",
    "package",
    "coffee",
    "apple",
    "backpack",
  ]);
  if (configuredIcon && supportedIcons.has(configuredIcon)) {
    return configuredIcon as ProductCategoryIcon;
  }
  const normalized = category.trim().toLocaleLowerCase("id-ID");
  const exactIcon = categoryIcons[normalized];
  if (exactIcon) return exactIcon;
  if (normalized.includes("kitab") || normalized.includes("buku")) return "book-open";
  if (normalized.includes("tulis") || normalized.includes("atk")) return "pencil";
  if (normalized.includes("makan") || normalized.includes("minum")) return "utensils-crossed";
  if (normalized.includes("seragam") || normalized.includes("pakaian")) return "shirt";
  return "package";
}
