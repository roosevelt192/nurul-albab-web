# PRODUCT REQUIREMENT DOCUMENT (PRD)
## NAIS (Nurul Albab Integrated System)
### *All-in-One Pesantren Management, Islamic Education Journal & Dynamic Multi-Ledger Finance Engine*

---

| Dokumen | Keterangan |
| :--- | :--- |
| **Nama Produk** | **NAIS (Nurul Albab Integrated System)** |
| **Inisial Proyek** | e-NAIS / NAIS Engine |
| **Target Institusi** | Pondok Pesantren Nurul Albab |
| **Versi Dokumen** | **2.1 (Dynamic Design System & End-to-End Synchronized Architecture)** |
| **Status Dokumen** | Approved for Development |
| **Prinsip Biaya** | **Zero Operational Infrastructure Cost (Modal Rp0)** memanfaatkan ekosistem *Free-Tier* modern (Vercel & Supabase) |
| **Prinsip Desain** | **Decoupled & Vibe-Coding Friendly:** Tampilan selalu tunduk dan mengacu dinamis ke file `DESIGN.md` aktif |
| **Prinsip Interaksi** | **Full Animatif, Interaktif, Responsif & Adaptif (Desktop & Mobile-First)** |
| **Target Skalabilitas** | Tahap awal 30 santri hingga mampu menangani ribuan santri (*modular, scalable, decoupled*) |

---

## 1. PENDAHULUAN & PRINSIP PENGEMBANGAN

### 1.1 Konteks Institusi
Pondok Pesantren Nurul Albab bertransisi dari pencatatan manual dan dokumen terpisah (arsip fisik, buku tulis, berkas Word/Excel mandiri) menuju ekosistem operasional digital terpadu satu pintu. Meskipun saat ini populasi santri awal berada di kisaran 30 santri, NAIS dirancang dengan fondasi modular dan decoupled yang siap menampung lonjakan ribuan santri di masa mendatang tanpa perombakan ulang arsitektur sistem.

### 1.2 Pilar Utama Pengembangan (Vibe-Coding Principles)
1. **Pemisahan Logika & Tampilan (Decoupled Design Architecture):**
   * Logika bisnis, validasi data, hak akses, dan alur modul dipandu sepenuhnya oleh dokumen ini (`PRD.md`).
   * Seluruh token visual (warna, radius sudut, tipografi, bayangan, mikro-interaksi, dan komponen UI) dipandu secara independen oleh file **`DESIGN.md`** yang sedang aktif di root proyek.
   * Apabila pengembang mengganti isi `DESIGN.md` (misalnya berganti tema visual atau tata letak), seluruh komponen sistem langsung beradaptasi secara mulus tanpa merusak logika aplikasi.
2. **Sinkronisasi Menyeluruh (End-to-End Cohesion):**
   * Seluruh rute aplikasi—mulai dari Landing Page publik (sebelum login), formulir PPDB online, Single Login Gateway, hingga workspace internal—berada dalam satu siklus data terpadu dan kesatuan identitas visual.
3. **Full Animatif & Interaktif:**
   * Antarmuka didesain hidup dan tidak statis/kaku:
     * Transisi mikro halus (150ms–250ms) pada interaksi tombol, kartu, dan navigasi.
     * Efek hover lift, pill button interaktif, dialog/modal transisi lembut, tab animatif, serta indikator loading yang ramah pengguna.
     * Tidak ada halaman atau komponen yang terasa polos atau kosong; setiap modul dilengkapi visualisasi data, badge status kontras, dan interaksi responsif.
4. **Responsivitas Adaptif (Desktop & Mobile-First):**
   * **Desktop View:** Tata letak luas dan lapang (max-width 1200px/1440px), sidebar navigasi terstruktur, tabel data multi-kolom dengan filter dan pencarian instan.
   * **Mobile View:** Sidebar otomatis beralih menjadi drawer atau navigasi ramah sentuhan, tabel dapat digulir horizontal secara terlindungi, serta kontrol sentuh minimal berukuran 44–48px (terutama pada kasir POS, verifikasi gerbang, dan portal wali santri).

---

## 2. USER PERSONA & ROLE-BASED ACCESS CONTROL (RBAC)

NAIS menerapkan pembatasan hak akses berlapis yang terikat langsung dengan Supabase Auth:

```
                                  ┌───────────────────────────────────┐
                                  │            SUPER ADMIN            │
                                  │ (Full Control, Master Settings,   │
                                  │  Dynamic Multi-Ledger, User Mgmt) │
                                  └───────────────┬───────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
    ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
    │     BENDAHARA PONDOK    │      │    ADMIN STAF / ASATIDZ │      │       WALI SANTRI       │
    │ - Jurnal Induk Pesantren│      │ - Database Induk Santri │      │ - Mobile Portal Santri  │
    │ - Billing Iuran Santri  │      │ - Jurnal Keilmuan       │      │ - Pantau Setoran Hafalan│
    │ - Kasir & Stok Koperasi │      │   (Tahfidz & Kitab)     │      │ - Pantau Pengajian Kitab│
    │ - Laporan Laba Rugi SHU │      │ - Izin Keluar & Keamanan│      │ - Cek Rincian Tagihan   │
    │ - Verifikasi Bukti Bayar│      │ - Form Pendaftaran Baru │      │ - Unduh Bukti Kuitansi  │
    └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

### 2.1 Matriks Kewenangan (Permission Matrix)

| Fitur / Modul | Super Admin | Bendahara | Admin Staf / Asatidz | Wali Santri |
| :--- | :---: | :---: | :---: | :---: |
| **Landing Page & Profil Publik** | Read/Write | Read | Read | Read |
| **Manajemen Pengguna & Staf** | Full Control | No Access | No Access | No Access |
| **Konfigurasi Buku Kas Kustom** | Full Control | Read Only | No Access | No Access |
| **Database Induk Santri** | Full Control | Read Only | Full Control | Anak Sendiri (Read) |
| **Jurnal Keilmuan (Tahfidz/Kitab)**| Full Control | No Access | Full Control | Anak Sendiri (Read) |
| **Perizinan & Keamanan Santri** | Full Control | No Access | Full Control | Anak Sendiri (Read) |
| **Tagihan Iuran & Billing** | Full Control | Full Control | Read Only | Anak Sendiri (Read) |
| **Verifikasi Kas Masuk & SPP** | Full Control | Full Control | No Access | No Access |
| **Kasir POS & Stok Koperasi** | Full Control | Full Control | Kasir Only | No Access |
| **Jurnal Kas Induk & Laporan SHU**| Full Control | Full Control | No Access | No Access |

---

## 3. SPESIFIKASI FITUR DETAIL (FUNCTIONAL REQUIREMENTS)

### 3.1 MODUL 1: Profil Publik, PPDB Online & Autentikasi Terpadu
* **Tujuan:** Menjadi wajah resmi institusi di internet, memfasilitasi penerimaan santri baru secara digital, dan menjadi gerbang login tunggal ke seluruh sistem.
* **Fitur Utama:**
  * **Landing Page Interaktif (`/`):**
    * *Hero Section:* Judul besar dinamis, aksen tipografi sesuai `DESIGN.md`, ringkasan nilai pesantren, tombol pendaftaran santri baru, dan visualisasi kartu/mockup produk.
    * *Profil Lembaga:* Visi, misi, sejarah ringkas, jajaran pengasuh, dan galeri sarana kegiatan pesantren.
    * *Simulasi Biaya Masuk & PPDB:* Informasi transparan mengenai alur tes, jadwal penerimaan, dan rincian biaya awal pendaftaran.
  * **Pendaftaran Santri Baru Online (`/ppdb`):**
    * Formulir pendaftaran bertahap (*multi-step wizard*) yang interaktif dengan indikator langkah:
      * *Langkah 1:* Biodata Calon Santri (Nama, NISN, NIK, TTL, Jenis Kelamin, Cita-cita, Riwayat Penyakit/Alergi).
      * *Langkah 2:* Data Orang Tua / Wali (Nama Ayah & Ibu, Pekerjaan, Alamat, No. WhatsApp aktif).
      * *Langkah 3:* Unggah Berkas & Konfirmasi Pendaftaran (KK, Akta Kelahiran, Pasfoto).
  * **Single Login Gateway (`/login`):**
    * Kartu login terpadu untuk semua peran pengguna (Super Admin, Bendahara, Asatidz, Wali Santri).
    * Otomatis mengarahkan (*auto-redirect*) pengguna ke workspace masing-masing setelah autentikasi berhasil.

---

### 3.2 MODUL 2: Database Induk Santri & Asrama (`/santri`)
* **Tujuan:** Mengelola data demografis, riwayat pendidikan, kamar asrama, dan status mutasi santri secara terpusat.
* **Fitur Utama:**
  * **Nomor Registrasi Baku:** Mengelola NIS unik pondok, NISN, dan NIK santri.
  * **Profil Personal Terpadu:** Data personal lengkap, alokasi kamar asrama, marhalah/kelas diniyah, nama musyrif pembina, kontak darurat keluarga, dan catatan riwayat kesehatan khusus.
  * **Pencarian & Filter Instan:** Filter pencarian real-time berdasarkan Nama, NIS, Kamar Asrama, Kelas, atau Status Santri.
  * **Buku Mutasi Santri:** Status santri terkontrol (*Aktif*, *Cuti*, *Alumni/Lulus*, *Pindah/Keluar*).
  * **Modal Biodata Santri:** Modal pop-up responsif untuk penambahan dan penyuntingan data santri baru secara cepat.

---

### 3.3 MODUL 3: Jurnal Keilmuan Santri (Academic & Mutaba'ah Engine - `/keilmuan`)
* **Tujuan:** Mencatat capaian hafalan Al-Qur'an dan pengajian kitab secara harian agar dapat dipantau oleh asatidz dan orang tua santri.

#### A. Sub-Modul Tahfidz Al-Qur'an
* **Pencatatan Setoran Baru (Ziyadah):** Input tanggal, nama surat, rentang ayat (awal–akhir), nomor juz, evaluasi kelancaran (*Sangat Lancar*, *Lancar*, *Perlu Mengulang*), serta catatan tajwid dan makharijul huruf oleh ustadz pengampu.
* **Pencatatan Muroja'ah:** Target evaluasi pengulangan hafalan berkala santri untuk menjaga kemutqinan hafalan.
* **Visualisasi Matriks Progres 1–30 Juz:** Peta kartu progres interaktif 1–30 juz per santri yang otomatis terwarnai saat juz dinyatakan tuntas.

#### B. Sub-Modul Pengajian Kitab Kuning / Diniyah
* **Master Kitab & Halaqah:** Pengelolaan daftar kitab yang dikaji (*Safinatun Najah*, *Al-Jurumiyah*, *Ta'limul Muta'allim*, *Fathul Qorib*, dll).
* **Jurnal Sesi Halaqah:** Tanggal pertemuan, bab/fasal yang dikaji, presensi kehadiran santri, dan penilaian pemahaman santri.

---

### 3.4 MODUL 4: Sistem Perizinan Santri & Keamanan Gerbang (`/perizinan`)
* **Tujuan:** Mengontrol arus keluar-masuk santri demi menjamin keamanan dan kedisiplinan pondok.
* **Fitur Utama:**
  * **Permohonan & Rekam Izin:** Input santri, alasan izin (sakit, urusan keluarga, lomba), penjemput, tanggal keluar, dan batas wajib kembali.
  * **Pemeriksaan Gerbang Mobile-First (Gate Check):** Antarmuka layar sentuh ramah ponsel bagi petugas keamanan/satpam di pos gerbang untuk memvalidasi kepulangan santri dan mencatat waktu kedatangan riil dalam hitungan detik.
  * **Overdue Warning System:** Sistem mendeteksi santri yang melampaui batas waktu izin secara otomatis dengan indikator badge peringatan yang mencolok.

---

### 3.5 MODUL 5: Sistem Keuangan Terpadu & Multi-Ledger Engine (`/keuangan`)

```
                            ┌──────────────────────────────────────────────┐
                            │            SUMBER KEUANGAN PESANTREN         │
                            └──────────────────────┬───────────────────────┘
                                                   │
                 ┌─────────────────────────────────┴─────────────────────────────────┐
                 ▼                                                                   ▼
┌─────────────────────────────────┐                                 ┌─────────────────────────────────┐
│       1. IURAN SANTRI           │                                 │   2. UNIT KOPERASI PONDOK       │
└────────────────┬────────────────┘                                 └────────────────┬────────────────┘
                 │                                                                   │
        ┌────────┴────────┐                                                 ┌────────┴────────┐
        ▼                 ▼                                                 ▼                 ▼
 ┌─────────────┐   ┌─────────────┐                                   ┌─────────────┐   ┌─────────────┐
 │ KEPENTINGAN │   │ KEPENTINGAN │                                   │ POS KASIR   │   │  STOK TOKO  │
 │   PRIBADI   │   │   BERSAMA   │                                   │ Harian POS  │   │  Inventori  │
 ├─────────────┤   ├─────────────┤                                   └──────┬──────┘   └─────────────┘
 │- Makan/Gizi │   │- Listrik PLN│                                          │
 │- Laundry    │   │- Air Bersih │                                          ▼
 └─────────────┘   │- Gas Dapur  │                                   ┌─────────────────────────────────┐
                   │- Poskestren │                                   │ PERHITUNGAN SHU OTOMATIS        │
                   │- Sarpras    │                                   │ Laba Kotor = Omzet - HPP        │
                   └─────────────┘                                   │ Laba Bersih = Kotor - Ops Toko  │
                                                                     └──────────────┬──────────────────┘
                                                                                    │
                                                                   ┌────────────────┴────────────────┐
                                                                   ▼                                 ▼
                                                            ┌──────────────┐                  ┌──────────────┐
                                                            │ 40% SUBSIDI  │                  │  60% RETAIN  │
                                                            │  KAS PONDOK  │                  │ (30% Modal,  │
                                                            │ (Disetor ke  │                  │  20% Sarpras,│
                                                            │  Jurnal Kas) │                  │  10% Insentif│
                                                            └──────┬───────┘                  └──────────────┘
                                                                   │
                                                                   ▼
                                                    ┌──────────────────────────────┐
                                                    │ BUKU JURNAL KAS INDUK PONDOK │
                                                    │ - Pemasukan Iuran Santri     │
                                                    │ - Setoran Pembagian SHU      │
                                                    │ - Pengeluaran Operasional    │
                                                    │ - Saldo Kas Berjalan         │
                                                    └──────────────────────────────┘
```

#### A. Arsitektur Iuran Santri (Billing Engine)
* **Pemisahan Komponen Iuran:**
  * *Pos Kepentingan Pribadi:* Konsumsi makan harian santri dan jasa cuci pakaian (laundry).
  * *Pos Kepentingan Bersama:* Beban token listrik asrama, air bersih & sanitasi, gas dapur umum, P3K Poskestren, dan pemeliharaan fasilitas.
* **Tagihan & Kuitansi Elektronik:** Tagihan terbit otomatis tiap awal bulan, dilengkapi tombol verifikasi pembayaran (tunai/transfer) serta penerbitan kuitansi elektronik resmi.

#### B. Buku Jurnal Kas Induk (General Ledger)
* Format pembukuan standar: *Tanggal*, *No. Bukti*, *Kategori Transaksi*, *Uraian*, *Debit*, *Kredit*, dan *Saldo Berjalan (Running Balance)* otomatis.

#### C. Dynamic Multi-Ledger Engine (Zero-Code Configuration)
* Super Admin dapat membuat buku kas baru secara mandiri langsung dari antarmuka (misal: *Kas Pembangunan Asrama*, *Kas Donasi Khusus*, *Kas Wakaf*) lengkap dengan saldo awal dan penetapan pengelolanya.

---

### 3.6 MODUL 6: Koperasi Pondok (POS Kasir, Stok & Alokasi SHU - `/koperasi`)
* **Antarmuka Kasir Cepat (Touch-Friendly POS - `/koperasi/pos`):**
  * Dioptimalkan untuk layar sentuh HP/tablet: pencarian instan barang kebutuhan santri, keranjang belanja interaktif, tombol nominal uang cepat (*Quick Cash*: Rp2.000, Rp5.000, Rp10.000, Rp20.000, Rp50.000), dan kalkulator kembalian instan.
* **Manajemen Stok & Harga Pokok (HPP - `/koperasi/stok`):**
  * Master barang: Kode SKU/Barcode, nama barang, harga modal beli (HPP), harga jual santri, dan stok fisik yang otomatis terpotong saat transaksi kasir tersimpan.
* **Kalkulasi Laba & Alokasi SHU Otomatis (`/koperasi/shu`):**
  * Perhitungan otomatis Laba Kotor (Omzet − HPP) dan Laba Bersih setelah beban toko.
  * **Formula Pembagian SHU Terkonfigurasi:**
    * **40% Subsidi Operasional Pesantren** (Otomatis masuk antrean setor kas induk pondok).
    * **30% Tambah Modal Usaha Koperasi**.
    * **20% Cadangan Sarana Prasarana Pondok**.
    * **10% Insentif Pengelola Toko / Asatidz Khidmat**.

---

### 3.7 MODUL 7: Portal Khusus Wali Santri (`/portal-wali`)
* **Tujuan:** Memberikan ketenangan batin dan transparansi menyeluruh bagi orang tua santri dari rumah.
* **Fitur Utama:**
  * **Pengalaman Mobile-First:** Tata letak kartu ringkas yang ramah layar ponsel orang tua.
  * **Akses Terbatas Aman:** Orang tua hanya dapat mengakses data santri yang terhubung dengan akun mereka sendiri.
  * **Rangkuman Capaian Santri:** Riwayat setoran tahfidz terakhir, kitab yang sedang dikaji, status izin keluar pondok, rincian tagihan iuran, dan tombol unduh/cetak kuitansi resmi.

---

## 4. ARSITEKTUR TEKNOLOGI & STRATEGI MODAL RP0 (ZERO-COST STACK)

Seluruh sistem NAIS berjalan pada lapis gratis (*Free-Tier*) industri modern tanpa batas kedaluwarsa waktu:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (Next.js 15)                       │
│  - App Router, Server Actions, Dynamic Routes                          │
│  - Tailwind CSS + Lucide Icons + Komponen Terstandar DESIGN.md         │
│  - Progressive Web App (PWA) Engine:                                   │
│    * manifest.json & Service Workers                                   │
│    * Standalone mode di HP Android & iOS tanpa App Store               │
│  - Hosting Platform: Vercel Free-Tier (Zero Cost, Global CDN)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS API / Server Actions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND & DATABASE LAYER (Supabase)                  │
│  - PostgreSQL 15 Database (Free-Tier: 500 MB Storage Data Teks)        │
│  - Supabase Auth: Session JWT, Role-Based Access Control               │
│  - PostgreSQL Functions & Triggers (Otomasi Saldo Kas & Stok POS)      │
│  - Storage Bucket (Free Tier 1 GB) untuk Pasfoto Santri & Bukti Bayar  │
│  - Realtime Engine: Pembaruan stok & transaksi kasir langsung          │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Rincian Efisiensi Biaya (Cost Breakdown: Rp0)

| Komponen Infrastruktur | Provider / Solusi | Batasan Free-Tier | Estimasi Daya Tampung Pesantren | Biaya |
| :--- | :--- | :--- | :--- | :---: |
| **Web Hosting & Compute** | Vercel Hobby Tier | 100 GB Bandwidth / bulan | Mampu menampung 5.000–10.000 kunjungan harian | **Rp0** |
| **Database Server** | Supabase PostgreSQL | 500 MB Storage Database | Cukup untuk >100.000 transaksi kasir & santri | **Rp0** |
| **Penyimpanan Berkas** | Supabase Storage | 1 GB File Storage | Menampung >3.000 foto berkas santri & bukti bayar | **Rp0** |
| **Autentikasi Pengguna** | Supabase Auth | 50.000 Monthly Active Users | Lebih dari cukup untuk seluruh staf & wali santri | **Rp0** |
| **Aplikasi Android & iOS**| Progressive Web App | Unlimited Install via Browser| Pasang langsung di layar HP tanpa biaya lisensi toko | **Rp0** |
| **Total Biaya Bulanan** | — | — | — | **Rp0 / Bulan** |

---

## 5. SKEMA BASIS DATA UTAMA (POSTGRESQL SCHEMA)

1. **`profiles`**: Metadata pengguna yang terhubung ke Supabase Auth (Nama, No HP, Role: `super_admin`, `bendahara`, `staf`, `wali_santri`).
2. **`santri`**: Master data santri, NIS, NISN, NIK, tanggal lahir, kamar asrama, kelas marhalah, riwayat alergi, status keaktifan, dan relasi `parent_id` ke tabel profiles wali santri.
3. **`jurnal_keilmuan`**: Log mutaba'ah harian, tipe (`tahfidz`/`kitab`), nama surat, rentang ayat, juz, nama kitab, bab kajian, evaluasi kelancaran, dan catatan asatidz.
4. **`perizinan_santri`**: Tanggal keluar, batas kembali, kedatangan aktual, alasan izin, penjemput, dan status verifikasi gerbang.
5. **`rekening_kas`**: Daftar buku kas mandiri (*Kas Utama*, *Kas Koperasi*, *Kas Pembangunan*), saldo berjalan real-time, dan status aktif.
6. **`jurnal_kas`**: Log transaksi umum, relasi ke `rekening_kas`, tanggal, no bukti, jenis (`debit`/`kredit`), kategori, keterangan, dan nominal.
7. **`komponen_iuran`**: Master pos tagihan, nama pos (Makan, Laundry, Listrik, Air, Gas, Poskestren, Sarpras), kategori (`pribadi`/`bersama`), dan tarif baku.
8. **`tagihan_santri`**: Rekap tagihan bulanan per santri, bulan, tahun, total kewajiban, total terbayar, dan flag status lunas.
9. **`pembayaran_iuran`**: Riwayat transaksi pembayaran SPP, nominal, metode bayar (Tunai/Transfer), bukti setoran, dan staf penerima.
10. **`produk_koperasi`**: Master stok barang toko, SKU dan barcode unik, kategori, nama item, satuan, HPP beli, harga jual, sisa stok, batas minimum (`min_stok`), dan URL foto opsional.
11. **`transaksi_penjualan`**: Header nota transaksi kasir, tanggal, no struk, kasir, pembeli santri/umum, total belanja, HPP, laba kotor, tunai diterima, dan kembalian.
12. **`transaksi_penjualan_detail`**: Snapshot produk, SKU, kuantitas, subtotal, harga jual satuan, dan harga modal saat transaksi.

Transaksi POS disimpan melalui RPC atomik agar snapshot penjualan, pengurangan stok, jurnal kas masuk, dan saldo rekening tunai selalu konsisten. Migrasi koperasi menambahkan kebijakan akses peran staf/bendahara dan tabel transaksi tersebut.

---

## 6. STRUKTUR DIREKTORI PROYEK (NEXT.JS APP ROUTER)

```text
nurul-albab-web/
├── .github/
│   └── copilot-instructions.md       # Instruksi Otomatis Copilot (PRD.md & DESIGN.md)
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx              # Landing Page Publik Interaktif
│   │   │   ├── ppdb/page.tsx         # Formulir Pendaftaran PPDB Multi-Step
│   │   │   ├── login/page.tsx        # Single Login Gateway Terpadu
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Shell Navigasi (Sidebar Desktop & Drawer Mobile)
│   │   │   ├── dashboard/page.tsx    # Executive Dashboard & Ringkasan KPI
│   │   │   ├── santri/page.tsx       # Database & Mutasi Santri Terpadu
│   │   │   ├── keilmuan/page.tsx     # Jurnal Tahfidz Quran & Pengajian Kitab
│   │   │   ├── perizinan/page.tsx    # Manajemen Izin Keluar & Mobile Gate-Check
│   │   │   ├── keuangan/page.tsx     # Billing Iuran, Kas Induk & Multi-Ledger Engine
│   │   │   ├── koperasi/
│   │   │   │   ├── pos/page.tsx      # Kasir Cepat Touchscreen (POS)
│   │   │   │   ├── stok/page.tsx     # Inventori Barang & Harga Pokok (HPP)
│   │   │   │   └── shu/page.tsx      # Laba Rugi & Laporan Alokasi SHU Otomatis
│   │   │   ├── portal-wali/page.tsx  # Portal Khusus Orang Tua Santri (Mobile-First)
│   │   │   └── pengaturan/page.tsx   # Konfigurasi Akun Kas & Profil Pesantren
│   │   ├── globals.css               # Token CSS Variables Mengikuti DESIGN.md Aktif
│   │   └── layout.tsx                # Root Layout & Metadata PWA
│   ├── components/                   # Komponen Reusable (Cards, Buttons, Tables, Charts)
│   └── lib/                          # Helper Koneksi Supabase, Format Rupiah, Format Tanggal
├── public/                           # Aset Statis, Ikon PWA & manifest.json
├── DESIGN.md                         # Acuan Baku Desain UI/UX yang Sedang Aktif
├── PRD.md                            # Dokumen Spesifikasi Produk & Alur Bisnis
└── package.json
```

---

Dokumen PRD ini menjadi acuan tunggal logika produk, struktur data, dan arsitektur fungsional untuk seluruh tahapan *vibe-coding* pada sistem **NAIS (Nurul Albab Integrated System)**.