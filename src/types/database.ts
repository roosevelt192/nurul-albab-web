export type UserRole = "super_admin" | "bendahara" | "staf" | "wali_santri";
export type SantriStatus = "pending_ppdb" | "aktif" | "cuti" | "alumni" | "pindah";
export type SantriGender = "L" | "P";
export type JournalType = "tahfidz" | "kitab";
export type JournalCategory = "sorogan" | "quran" | "matan";
export type JournalPredikat = "mumtaz" | "jayyid" | "dhoif";
export type JournalEvaluation = "sangat_lancar" | "lancar" | "perlu_mengulang" | "baik" | "cukup";
export type PermitStatus = "diajukan" | "disetujui" | "sedang_di_luar" | "kembali" | "terlambat" | "ditolak";
export type CashEntryType = "debit" | "kredit";
export type ChargeCategory = "pribadi" | "bersama";
export type PaymentMethod = "tunai" | "transfer";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableShape<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type TimestampFields = {
  created_at: string;
  updated_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<
        {
          id: string;
          nama_lengkap: string;
          full_name: string | null;
          role: UserRole;
          no_hp: string | null;
          is_active: boolean;
        },
        {
          id: string;
          nama_lengkap: string;
          full_name?: string | null;
          role: UserRole;
          no_hp?: string | null;
          is_active?: boolean;
        }
      >;
      pengaturan_pesantren: TableShape<
        {
          id: string;
          nama_pesantren: string;
          pengasuh: string;
          alamat: string;
          telepon: string;
          email: string;
          logo_url: string | null;
          logo_size: "small" | "medium" | "proportional";
          logo_height: "h-8" | "h-10" | "h-14";
          logo_options: Json;
          show_logo_navbar: boolean;
          show_logo_sidebar: boolean;
          show_logo_kuitansi: boolean;
          footer_kuitansi: string;
          pos_printer_width: string;
          updated_at: string;
          hero_badge: string;
          hero_title: string;
          hero_subtitle: string;
          hero_quote: string;
          hero_quote_source: string;
          tentang_title: string;
          tentang_deskripsi: string;
          ppdb_gelombang: string;
          ppdb_status: string;
          ppdb_brosur_url: string;
          whatsapp_center: string;
          jam_operasional: string;
          alamat_lengkap: string;
          sosmed_instagram: string;
        },
        {
          id?: string;
          nama_pesantren?: string;
          pengasuh?: string;
          alamat?: string;
          telepon?: string;
          email?: string;
          logo_url?: string | null;
          logo_size?: "small" | "medium" | "proportional";
          logo_height?: "h-8" | "h-10" | "h-14";
          logo_options?: Json;
          show_logo_navbar?: boolean;
          show_logo_sidebar?: boolean;
          show_logo_kuitansi?: boolean;
          footer_kuitansi?: string;
          pos_printer_width?: string;
          updated_at?: string;
          hero_badge?: string;
          hero_title?: string;
          hero_subtitle?: string;
          hero_quote?: string;
          hero_quote_source?: string;
          tentang_title?: string;
          tentang_deskripsi?: string;
          ppdb_gelombang?: string;
          ppdb_status?: string;
          ppdb_brosur_url?: string;
          whatsapp_center?: string;
          jam_operasional?: string;
          alamat_lengkap?: string;
          sosmed_instagram?: string;
        }
      >;
      santri: TableShape<
        {
          id: string;
          nis: string | null;
          nisn: string | null;
          nik: string | null;
          nama_lengkap: string;
          tempat_lahir: string | null;
          tanggal_lahir: string | null;
          konsulat: string | null;
          alamat_domisili: string | null;
          foto_url: string | null;
          berkas_kk_path: string | null;
          berkas_akta_path: string | null;
          cita_cita: string | null;
          riwayat_kesehatan: string | null;
          nama_ayah: string | null;
          nama_ibu: string | null;
          nama_wali: string | null;
          no_hp_wali: string | null;
          pekerjaan_wali: string | null;
          parent_id: string | null;
          kamar_asrama: string | null;
          kelas_marhalah: string | null;
          status: string;
          jenis_kelamin: SantriGender | null;
          created_at: string;
        },
        {
          id?: string;
          nis?: string | null;
          nisn?: string | null;
          nik?: string | null;
          nama_lengkap: string;
          tempat_lahir?: string | null;
          tanggal_lahir?: string | null;
          konsulat?: string | null;
          alamat_domisili?: string | null;
          foto_url?: string | null;
          berkas_kk_path?: string | null;
          berkas_akta_path?: string | null;
          cita_cita?: string | null;
          riwayat_kesehatan?: string | null;
          nama_ayah?: string | null;
          nama_ibu?: string | null;
          nama_wali?: string | null;
          no_hp_wali?: string | null;
          pekerjaan_wali?: string | null;
          parent_id?: string | null;
          kamar_asrama?: string | null;
          kelas_marhalah?: string | null;
          status?: string;
          jenis_kelamin?: SantriGender | null;
          created_at?: string;
        }
      >;
      jurnal_keilmuan: TableShape<
        {
          id: string;
          santri_id: string;
          ustadz_id: string | null;
          master_kitab_id: string | null;
          tanggal: string;
          jenis: JournalType;
          kategori_jurnal: JournalCategory;
          mode_setoran: "ziyadah" | "murojaah" | null;
          nama_surat: string | null;
          surah_awal_number: number | null;
          surah_akhir_number: number | null;
          ayat_akhir_surat: number | null;
          ayat_awal: number | null;
          ayat_akhir: number | null;
          surah_number: number | null;
          juz: number | null;
          nama_kitab: string | null;
          bab_kajian: string | null;
          cakupan_bacaan: string | null;
          bait_awal: number | null;
          bait_akhir: number | null;
          predikat: JournalPredikat | null;
          lulus_tasmi: boolean | null;
          kelancaran: JournalEvaluation | null;
          catatan_ustadz: string | null;
          created_at: string;
        },
        {
          id?: string;
          santri_id: string;
          ustadz_id?: string | null;
          master_kitab_id?: string | null;
          tanggal?: string;
          jenis: JournalType;
          kategori_jurnal?: JournalCategory;
          mode_setoran?: "ziyadah" | "murojaah" | null;
          nama_surat?: string | null;
          surah_awal_number?: number | null;
          surah_akhir_number?: number | null;
          ayat_akhir_surat?: number | null;
          ayat_awal?: number | null;
          ayat_akhir?: number | null;
          surah_number?: number | null;
          juz?: number | null;
          nama_kitab?: string | null;
          bab_kajian?: string | null;
          cakupan_bacaan?: string | null;
          bait_awal?: number | null;
          bait_akhir?: number | null;
          predikat?: JournalPredikat | null;
          lulus_tasmi?: boolean | null;
          kelancaran?: JournalEvaluation | null;
          catatan_ustadz?: string | null;
          created_at?: string;
        }
      >;
      master_kitab: TableShape<
        {
          id: string;
          judul: string;
          pengarang: string | null;
          kategori: "sorogan" | "matan";
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          judul: string;
          pengarang?: string | null;
          kategori: "sorogan" | "matan";
          is_active?: boolean;
          created_at?: string;
        }
      >;
      perizinan_santri: TableShape<
        {
          id: string;
          santri_id: string;
          tanggal_keluar: string;
          batas_kembali: string;
          kedatangan_aktual: string | null;
          alasan_izin: string;
          penjemput: string;
          status: string;
          created_at: string;
        },
        {
          id?: string;
          santri_id: string;
          tanggal_keluar: string;
          batas_kembali: string;
          kedatangan_aktual?: string | null;
          alasan_izin: string;
          penjemput: string;
          status?: string;
          created_at?: string;
        }
      >;
      ppdb_pendaftar: TableShape<
        {
          id: string;
          nama_lengkap: string;
          nisn: string | null;
          nik: string | null;
          tempat_lahir: string;
          tanggal_lahir: string;
          jenis_kelamin: SantriGender;
          cita_cita: string | null;
          riwayat_kesehatan: string | null;
          nama_ayah: string;
          nama_ibu: string;
          pekerjaan_wali: string;
          no_hp_wali: string;
          konsulat: string | null;
          alamat_domisili: string;
          status: "pending" | "approved";
          linked_santri_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          nama_lengkap: string;
          nisn?: string | null;
          nik?: string | null;
          tempat_lahir: string;
          tanggal_lahir: string;
          jenis_kelamin: SantriGender;
          cita_cita?: string | null;
          riwayat_kesehatan?: string | null;
          nama_ayah: string;
          nama_ibu: string;
          pekerjaan_wali: string;
          no_hp_wali: string;
          konsulat?: string | null;
          alamat_domisili: string;
          status?: "pending" | "approved";
          linked_santri_id?: string | null;
          created_at?: string;
        }
      >;
      rekening_kas: TableShape<
        TimestampFields & {
          id: string;
          name: string;
          opening_balance: number;
          balance: number;
          manager_id: string | null;
          is_active: boolean;
        },
        {
          id?: string;
          name: string;
          opening_balance?: number;
          balance?: number;
          manager_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        }
      >;
      jurnal_kas: TableShape<
        {
          id: string;
          account_id: string;
          created_by: string | null;
          transaction_date: string;
          proof_number: string;
          type: CashEntryType;
          category: string;
          description: string;
          amount: number;
          created_at: string;
        },
        {
          id?: string;
          account_id: string;
          created_by?: string | null;
          transaction_date?: string;
          proof_number: string;
          type: CashEntryType;
          category: string;
          description: string;
          amount: number;
          created_at?: string;
        }
      >;
      komponen_iuran: TableShape<
        TimestampFields & {
          id: string;
          name: string;
          category: ChargeCategory;
          amount: number;
          is_active: boolean;
        },
        {
          id?: string;
          name: string;
          category: ChargeCategory;
          amount: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        }
      >;
      tagihan_santri: TableShape<
        {
          id: string;
          santri_id: string;
          component_id: string | null;
          month: number;
          year: number;
          total_amount: number;
          paid_amount: number;
          is_paid: boolean;
          due_date: string | null;
          created_at: string;
        },
        {
          id?: string;
          santri_id: string;
          component_id?: string | null;
          month: number;
          year: number;
          total_amount: number;
          paid_amount?: number;
          is_paid?: boolean;
          due_date?: string | null;
          created_at?: string;
        }
      >;
      pembayaran_iuran: TableShape<
        {
          id: string;
          invoice_id: string;
          amount: number;
          method: PaymentMethod;
          proof_url: string | null;
          received_by: string | null;
          paid_at: string;
          created_at: string;
        },
        {
          id?: string;
          invoice_id: string;
          amount: number;
          method: PaymentMethod;
          proof_url?: string | null;
          received_by?: string | null;
          paid_at?: string;
          created_at?: string;
        }
      >;
      produk_koperasi: TableShape<
        TimestampFields & {
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
          is_active: boolean;
          /** Kolom alias Indonesia (dapat kosong pada data hasil impor lama). */
          nama_produk?: string | null;
          kode_barang?: string | null;
          hpp?: number | null;
          harga_beli?: number | null;
          harga_jual?: number | null;
          stok?: number | null;
          min_stock?: number | null;
          kategori?: string | null;
          satuan?: string | null;
        },
        {
          id?: string;
          sku: string;
          barcode?: string | null;
          name: string;
          category?: string;
          unit: string;
          cost_price: number;
          selling_price: number;
          stock?: number;
          min_stok?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
          /** Kolom alias Indonesia yang disinkronkan oleh trigger database. */
          nama_produk?: string | null;
          kode_barang?: string | null;
          hpp?: number | null;
          harga_beli?: number | null;
          harga_jual?: number | null;
          stok?: number | null;
          min_stock?: number | null;
          kategori?: string | null;
          satuan?: string | null;
        }
      >;
      kategori_produk: TableShape<
        {
          id: string;
          name: string;
          icon: "utensils-crossed" | "pencil" | "book-open" | "shirt" | "package" | "coffee" | "apple" | "backpack";
          created_at: string;
        },
        {
          id?: string;
          name: string;
          icon?: "utensils-crossed" | "pencil" | "book-open" | "shirt" | "package" | "coffee" | "apple" | "backpack";
          created_at?: string;
        }
      >;
      penjualan_koperasi: TableShape<
        {
          id: string;
          receipt_number: string;
          sold_at: string;
          cashier_id: string | null;
          santri_id: string | null;
          customer_name: string | null;
          total_amount: number;
          total_cost: number;
          gross_profit: number;
          cash_received: number;
          change_amount: number;
          created_at: string;
        },
        {
          id?: string;
          receipt_number: string;
          sold_at?: string;
          cashier_id?: string | null;
          santri_id?: string | null;
          customer_name?: string | null;
          total_amount: number;
          total_cost: number;
          gross_profit: number;
          cash_received: number;
          change_amount: number;
          created_at?: string;
        }
      >;
      penjualan_koperasi_detail: TableShape<
        {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          subtotal: number;
          unit_price: number;
          unit_cost: number;
          created_at: string;
        },
        {
          id?: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          subtotal: number;
          unit_price: number;
          unit_cost: number;
          created_at?: string;
        }
      >;
      transaksi_penjualan: TableShape<
        {
          id: string;
          receipt_number: string;
          sold_at: string;
          cashier_id: string | null;
          santri_id: string | null;
          customer_name: string | null;
          total_amount: number;
          total_cost: number;
          gross_profit: number;
          cash_received: number;
          change_amount: number;
          created_at: string;
        },
        {
          id?: string;
          receipt_number: string;
          sold_at?: string;
          cashier_id?: string | null;
          santri_id?: string | null;
          customer_name?: string | null;
          total_amount: number;
          total_cost: number;
          gross_profit: number;
          cash_received: number;
          change_amount: number;
          created_at?: string;
        }
      >;
      transaksi_penjualan_detail: TableShape<
        {
          id: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          sku: string;
          quantity: number;
          subtotal: number;
          unit_price: number;
          unit_cost: number;
          created_at: string;
        },
        {
          id?: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          sku: string;
          quantity: number;
          subtotal: number;
          unit_price: number;
          unit_cost: number;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      cooperative_list_students: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; nis: string | null; nama_lengkap: string }[];
      };
      cooperative_profile_names: {
        Args: { p_profile_ids: string[] };
        Returns: { id: string; nama_lengkap: string }[];
      };
      cooperative_restock_product: {
        Args: { p_product_id: string; p_quantity: number };
        Returns: number;
      };
      cooperative_checkout: {
        Args: {
          p_items: { product_id: string; quantity: number }[];
          p_cash_received: number;
          p_santri_id?: string | null;
          p_customer_name?: string | null;
        };
        Returns: { sale_id: string; receipt_number: string }[];
      };
      finance_list_students: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; nis: string | null; nama_lengkap: string; status: string }[];
      };
      finance_generate_invoices: {
        Args: {
          p_component_id: string;
          p_month: number;
          p_year: number;
          p_student_ids: string[] | null;
        };
        Returns: number;
      };
      finance_receive_invoice_payment: {
        Args: {
          p_invoice_id: string;
          p_account_id: string;
          p_amount: number;
          p_method: PaymentMethod;
        };
        Returns: string;
      };
      finance_record_cash_movement: {
        Args: {
          p_account_id: string;
          p_type: CashEntryType;
          p_category: string;
          p_description: string;
          p_amount: number;
          p_transaction_date: string;
        };
        Returns: string;
      };
      finance_profile_names: {
        Args: { p_profile_ids: string[] };
        Returns: { id: string; nama_lengkap: string }[];
      };
      has_system_admin_access: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      list_profile_access: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          nama_lengkap: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }[];
      };
      manage_profile_access: {
        Args: { p_profile_id: string; p_role: string; p_is_active: boolean; p_full_name?: string | null };
        Returns: undefined;
      };
      get_portal_wali_data: {
        Args: { p_nis: string; p_tgl_lahir: string };
        Returns: Json;
      };
      approve_ppdb_pendaftar: {
        Args: { p_santri_id: string; p_class: string; p_room: string };
        Returns: string;
      };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
