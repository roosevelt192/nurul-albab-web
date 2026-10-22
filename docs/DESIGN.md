# FeedHive — Style Reference (Active Design System for NAIS)

> Lavender control room at dawn. One confident blue-violet accent breathing over a near-white workspace.

**Theme:** Light
**Scope:** Seluruh antarmuka NAIS (Landing Page Publik, PPDB, Single Login Gateway, Shell Dashboard, Jurnal Keilmuan, Multi-Ledger Keuangan, POS Koperasi, dan Portal Wali).

## 1. Prinsip Desain & Filosofi Visual

* **Airy Productivity Workspace:** Latar kanvas bernuansa lavender sejuk (`#f3f5ff`), bukan putih mentah yang menyilaukan.

* **Card-Lift Clarity:** Permukaan kartu berwarna putih bersih (`#ffffff`) yang mengapung di atas kanvas lavender dengan sudut rounded besar (`24px`).

* **Punctuation Accent:** Halaman dijaga 95% tenang dan profesional (achromatic/ink/iris). Warna aksen violet gradien hanya digunakan sebagai tanda tindakan utama (*punch of action*), tombol pill, atau badge penting.

* **Full Animatif & Interaktif:** Efek hover lembut (lift transisi 150ms-200ms), pill button dengan glow violet, stepper PPDB yang mulus, dan kartu interaktif.

* **Responsif Adaptif:** Optimal untuk tampilan monitor lebar dan otomatis ramah sentuhan (touch target minimal 44-48px) saat diakses via ponsel/tablet.

## 2. Token Warna (Colors)

| Nama Token | Nilai Hex | Variabel CSS | Peran & Penggunaan | 
| ----- | ----- | ----- | ----- | 
| **Lavender Canvas** | `#f3f5ff` | `--color-lavender-canvas` | Latar belakang seluruh halaman/layar aplikasi | 
| **Card White** | `#ffffff` | `--color-card-white` | Permukaan kartu, panel modal/drawer, sidebar, topbar | 
| **Ink** | `#181c31` | `--color-ink` | Teks utama, judul headline, label tombol tebal | 
| **Muted Iris** | `#757693` | `--color-muted-iris` | Deskripsi sub-teks, teks penolong, nav inactive, placeholder | 
| **Border Mist** | `#e5e7eb` | `--color-border-mist` | Garis pembatas kartu halus, border input, garis tabel | 
| **Soft Blue Wash** | `#dbeafe` | `--color-soft-blue-wash` | Sorotan baris tabel terpilih, background pill kategori | 
| **Brand Violet** | `#4457ff` | `--color-brand-violet` | Aksen warna tindakan primer & start gradient | 
| **Brand Violet Light** | `#7583fd` | `--color-brand-violet-light` | Stop gradient aksen tindakan primer | 
| **Shadow Violet** | `rgba(32, 36, 138, 0.25)` | `--color-shadow-violet` | Bayangan khusus hero preview dan kartu unggulan | 

## 3. Sistem Gradien (Gradient Rules)

Hanya ada dua gradien resmi:

1. **Brand Action Gradient:** `linear-gradient(to right, #4457ff, #7583fd)`

   * Digunakan untuk: Tombol CTA primer, teks gradien pada satu frasa hero landing page, dan badge aktif penting.

2. **Lavender Surface Wash:** `linear-gradient(to top, #f8f9ff, #dee7ff)`

   * Digunakan untuk: Latar panel kartu informasi khusus / spotlight panel.

## 4. Tipografi & Skala Teks

* **Font Family:** `Inter`, `DM Sans`, `Manrope`, atau `system-ui, sans-serif`.

* **Gaya Judul:** Bold (700) dengan tracking sedikit rapat (`-0.02em`).

* **Format Angka:** Selalu gunakan tabular nums (`tabular-nums`) dan format Rupiah rapi (contoh: `Rp12.450.000`).

| Role | Ukuran (Desktop) | Weight | Line Height | Keterangan | 
| ----- | ----- | ----- | ----- | ----- | 
| **Display Hero** | `48px` - `60px` | 700 | 1.1 | Headline utama landing page | 
| **Page Title** | `28px` - `32px` | 700 | 1.25 | Judul halaman dashboard | 
| **Section Title** | `20px` - `24px` | 600 | 1.3 | Judul blok modul & kartu | 
| **Body Large** | `16px` | 400/500 | 1.55 | Paragraf penjelas & isi kartu | 
| **Body Small** | `14px` | 400 | 1.5 | Teks tabel, form label | 
| **Caption / Badge** | `12px` | 600 | 1.4 | Badge status, indikator pill | 

## 5. Bentuk Komponen & Radius Sudut

| Elemen UI | Nilai Radius | Class Tailwind | Karakter Desain | 
| ----- | ----- | ----- | ----- | 
| **Tombol CTA & Tags** | `9999px` | `rounded-full` | Bentuk kapsul (Pill) khas FeedHive | 
| **Kartu & Kontainer Modul** | `24px` | `rounded-3xl` | Sudut membulat lebar dan lapang | 
| **Input & Form Field** | `12px` - `16px` | `rounded-xl` / `rounded-2xl` | Bersih, border mist 1.5px | 
| **Modal & Dialog Popup** | `24px` | `rounded-3xl` | Mengambang dengan shadow halus | 

## 6. Pola Komponen Inti

### 6.1 Primary Pill Button

* Background: `linear-gradient(to right, #4457ff, #7583fd)`

* Text: Putih bersih (`#ffffff`), font-weight 500, padding `12px 24px`, `rounded-full`.

* Interaksi: Hover lift (`translate-y-[-1px]`) dengan bayangan violet halus (`shadow-[0_8px_20px_rgba(68,87,255,0.25)]`).

### 6.2 Workspace Cards

* Background: Card White (`#ffffff`) murni mengapung di atas Lavender Canvas (`#f3f5ff`).

* Radius: `rounded-3xl` (24px), border 1px solid `border-[#e5e7eb]`, padding internal `24px`.

* Tanpa shadow kusam; pemisah visual murni memanfaatkan kontras kanvas lavender vs kartu putih.

### 6.3 Input Form & Sentuhan Layar

* Latar putih, border 1.5px solid `#e5e7eb`.

* Saat aktif (*focus*): Border berubah menjadi `#4457ff` dengan ring halus tanpa bayangan hitam.

* Ketinggian kontrol: minimal 42px di desktop dan 48px di perangkat mobile/POS kasir.

### 6.4 Sidebar & Topbar Shell

* Sidebar lebar 260px latar putih bersih dengan pemisah border halus ke area kanvas kerja.

* Menu aktif: Berlatar Soft Blue Wash (`#dbeafe`), teks tebal Brand Violet (`#4457ff`), sudut kapsul/rounded-xl.

* Menu inaktif: Teks Muted Iris (`#757693`) dengan efek hover lavender.