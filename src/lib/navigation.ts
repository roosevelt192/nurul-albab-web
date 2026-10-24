import type { IconName } from "@/components/icon";

export type NavigationItem = {
  label: string;
  href: string;
  icon: IconName;
  description: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigation: NavigationGroup[] = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid", description: "Ringkasan operasional pesantren" },
    ],
  },
  {
    label: "DATA & AKADEMIK",
    items: [
      { label: "Data santri", href: "/santri", icon: "users", description: "Data induk dan profil santri" },
      { label: "Jurnal keilmuan", href: "/keilmuan", icon: "book", description: "Setoran hafalan dan sorogan" },
      { label: "Perizinan", href: "/perizinan", icon: "shield", description: "Izin keluar dan kepulangan santri" },
    ],
  },
  {
    label: "KEUANGAN & USAHA",
    items: [
      { label: "Keuangan", href: "/keuangan", icon: "wallet", description: "Kas, tagihan, dan pembayaran iuran" },
      { label: "Kasir Quick POS", href: "/koperasi", icon: "store", description: "Transaksi penjualan koperasi" },
      { label: "Stok koperasi", href: "/koperasi/stok", icon: "store", description: "Katalog dan stok barang" },
      { label: "Laporan SHU", href: "/koperasi/laporan", icon: "chart", description: "Laporan sisa hasil usaha" },
    ],
  },
  {
    label: "KOMUNIKASI",
    items: [
      { label: "Portal wali", href: "/portal-wali", icon: "parents", description: "Akses informasi untuk wali santri" },
    ],
  },
  {
    label: "PENGATURAN",
    items: [
      { label: "Pengaturan", href: "/pengaturan", icon: "settings", description: "Preferensi akun dan sistem" },
    ],
  },
];

export const navigationItems: NavigationItem[] = navigation.flatMap((group) => group.items);
