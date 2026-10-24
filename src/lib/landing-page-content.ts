import type { Database } from "@/types/database";

export type LandingPageContent = Pick<
  Database["public"]["Tables"]["pengaturan_pesantren"]["Row"],
  | "hero_badge"
  | "hero_title"
  | "hero_subtitle"
  | "hero_quote"
  | "hero_quote_source"
  | "tentang_title"
  | "tentang_deskripsi"
  | "ppdb_gelombang"
  | "ppdb_status"
  | "ppdb_brosur_url"
  | "whatsapp_center"
  | "jam_operasional"
  | "alamat_lengkap"
  | "sosmed_instagram"
>;

export const DEFAULT_LANDING_PAGE_CONTENT: LandingPageContent = {
  hero_badge: "Ruang Tumbuh untuk Ilmu dan Akhlak",
  hero_title: "Menjaga ilmu, menumbuhkan adab.",
  hero_subtitle:
    "Pondok Pesantren Nurul Albab mendampingi santri belajar, menghafal, dan bertumbuh dalam lingkungan yang hangat, disiplin, serta penuh keberkahan.",
  hero_quote: "Sebaik-baik kalian adalah orang yang belajar Al-Qur'an dan mengajarkannya.",
  hero_quote_source: "HR. Bukhari",
  tentang_title: "Pesantren sebagai rumah untuk bertumbuh.",
  tentang_deskripsi:
    "Nurul Albab hadir mendampingi perjalanan santri dalam menuntut ilmu agama, memadukan tradisi kitab turots dengan keteladanan akhlak nabawiyah.",
  ppdb_gelombang: "Gelombang I — T.A 2026/2027",
  ppdb_status: "Pendaftaran Sedang Dibuka",
  ppdb_brosur_url: "",
  whatsapp_center: "081234567890",
  jam_operasional: "Senin - Ahad, 08.00 - 16.00 WIB",
  alamat_lengkap: "Jl. Pesantren No. 01, Cisarua, Bogor, Jawa Barat",
  sosmed_instagram: "@nurulalbab.official",
};
