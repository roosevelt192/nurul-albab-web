"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { FormMessage, PageHeading, PillTabs, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_LANDING_PAGE_CONTENT, type LandingPageContent } from "@/lib/landing-page-content";
import type { Database, UserRole } from "@/types/database";

type Book = Database["public"]["Tables"]["master_kitab"]["Row"];
type BookCategory = Book["kategori"];
type BookInsert = Database["public"]["Tables"]["master_kitab"]["Insert"];
type InstitutionSettings = Database["public"]["Tables"]["pengaturan_pesantren"]["Row"];
type InstitutionSettingsDraft = Omit<InstitutionSettings, "id"> & { id: string | null };

type ProfileRow = {
  id: string;
  full_name?: string | null;
  nama_lengkap?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
};

type SettingsSection = "institution" | "landing" | "access" | "books";
type LogoSize = InstitutionSettings["logo_size"];
type LogoHeight = InstitutionSettings["logo_height"];

const logoMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const maxLogoFileSize = 1024 * 1024;

const defaultSettings = {
  nama_pesantren: "Pondok Pesantren Nurul Albab",
  pengasuh: "K.H. Ahmad Dahlan",
  alamat: "Jl. Pesantren No. 01",
  telepon: "08123456789",
  email: "pesantren@nurulalbab.id",
  logo_url: null,
  logo_size: "medium",
  logo_height: "h-10",
  logo_options: {},
  show_logo_navbar: true,
  show_logo_sidebar: true,
  show_logo_kuitansi: true,
  pos_printer_width: "58mm",
  footer_kuitansi: "Jazakumullah Khairan Katsiran atas partisipasi Anda mendidik generasi Qur'ani.",
  updated_at: "",
  ...DEFAULT_LANDING_PAGE_CONTENT,
} satisfies Omit<InstitutionSettings, "id">;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("File logo tidak dapat dibaca."));
    };
    reader.onerror = () => reject(new Error("File logo tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

const systemRoles: { value: UserRole; label: string; description: string }[] = [
  { value: "super_admin", label: "Super admin", description: "Mengelola akun dan konfigurasi sistem." },
  { value: "bendahara", label: "Bendahara", description: "Mengakses keuangan dan transaksi." },
  { value: "staf", label: "Staf", description: "Mengelola data santri dan akademik." },
  { value: "wali_santri", label: "Wali santri", description: "Mengakses portal wali setelah masuk." },
];

const categoryOptions = [
  { value: "sorogan", label: "Kitab Sorogan" },
  { value: "matan", label: "Matan Kitab" },
] as const satisfies { value: BookCategory; label: string }[];

export default function PengaturanPage() {
  const [section, setSection] = useState<SettingsSection>("institution");
  const [category, setCategory] = useState<BookCategory>("sorogan");
  const [books, setBooks] = useState<Book[]>([]);
  const [institution, setInstitution] = useState<InstitutionSettingsDraft | null>(null);
  const [profileAccess, setProfileAccess] = useState<ProfileRow[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState("");
  const [isSavingLanding, setIsSavingLanding] = useState(false);
  const [isLogoRemoved, setIsLogoRemoved] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [isLogoDropActive, setIsLogoDropActive] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSystemSettings() {
      try {
        const supabase = createClient();
        const [{ data: authData }, { data: settings }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("pengaturan_pesantren").select("*").limit(1).maybeSingle(),
        ]);

        if (!active) return;
        setCurrentProfileId(authData.user?.id ?? "");
        setInstitution(settings ?? { id: null, ...defaultSettings });

        // Query tabel profiles tanpa kolom status
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, nama_lengkap, role, is_active, created_at")
          .order("created_at", { ascending: false });

        if (active && profilesData) {
          setProfileAccess(profilesData as unknown as ProfileRow[]);
        }
      } catch (error) {
        if (!active) return;
        console.error("Gagal memuat pengaturan sistem:", error);
        setInstitution((curr) => curr ?? { id: null, ...defaultSettings });
      } finally {
        if (active) setIsLoadingSystem(false);
      }
    }

    void loadSystemSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBooks() {
      const { data, error } = await createClient().from("master_kitab").select("*");
      if (!active) return;
      if (error) {
        setMessage(`Daftar kitab gagal dimuat: ${error.message}`);
        setMessageIsError(true);
      } else {
        const sortedBooks = (data ?? []).sort(
          (a, b) =>
            String(a.kategori ?? "").localeCompare(String(b.kategori ?? ""), "id-ID") ||
            String(a.judul ?? "").localeCompare(String(b.judul ?? ""), "id-ID")
        );
        setBooks(sortedBooks);
      }
      setIsLoading(false);
    }

    void loadBooks();
    return () => {
      active = false;
    };
  }, []);

  const visibleBooks = books.filter((book) => book.kategori === category);
  const logoUrl = isLogoRemoved ? null : institution?.logo_url ?? null;
  const previewLogoUrl = logoPreviewUrl || logoUrl;

  async function selectLogoFile(file: File | undefined) {
    if (!file) return;
    if (!logoMimeTypes.includes(file.type)) {
      setMessage("Format logo harus PNG, JPG, WEBP, atau SVG.");
      setMessageIsError(true);
      return;
    }
    if (file.size > maxLogoFileSize) {
      setMessage("Ukuran file logo maksimal 1 MB.");
      setMessageIsError(true);
      return;
    }
    try {
      setLogoPreviewUrl(await fileToDataUrl(file));
      setLogoFile(file);
      setIsLogoRemoved(false);
      setMessage("");
    } catch {
      setMessage("File logo tidak dapat dibaca.");
      setMessageIsError(true);
    }
  }

  async function handleLogoInput(event: ChangeEvent<HTMLInputElement>) {
    await selectLogoFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function handleLogoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsLogoDropActive(false);
    await selectLogoFile(event.dataTransfer.files[0]);
  }

  async function uploadLogo(supabase: ReturnType<typeof createClient>, file: File) {
    const ext = file.name.split(".").pop() || "png";
    const path = `logo/${crypto.randomUUID()}.${ext}`;
    for (const bucket of ["pesantren", "public-assets"]) {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (!error && data) {
        return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      }
    }
    return fileToDataUrl(file);
  }

  async function saveLandingContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institution || isSavingLanding) return;

    const formData = new FormData(event.currentTarget);
    const field = (name: keyof LandingPageContent) => String(formData.get(name) ?? "").trim();

    const landingPayload: LandingPageContent = {
      hero_badge: field("hero_badge"),
      hero_title: field("hero_title"),
      hero_subtitle: field("hero_subtitle"),
      hero_quote: field("hero_quote"),
      hero_quote_source: field("hero_quote_source"),
      tentang_title: field("tentang_title"),
      tentang_deskripsi: field("tentang_deskripsi"),
      ppdb_gelombang: field("ppdb_gelombang"),
      ppdb_status: field("ppdb_status"),
      ppdb_brosur_url: field("ppdb_brosur_url"),
      whatsapp_center: field("whatsapp_center"),
      jam_operasional: field("jam_operasional"),
      alamat_lengkap: field("alamat_lengkap"),
      sosmed_instagram: field("sosmed_instagram"),
    };

    setIsSavingLanding(true);
    setMessage("");
    try {
      const supabase = createClient();
      const payload = {
        ...(!institution.id ? defaultSettings : {}),
        ...landingPayload,
        updated_at: new Date().toISOString(),
      };

      const result = institution.id
        ? await supabase.from("pengaturan_pesantren").update(payload).eq("id", institution.id).select("*").single()
        : await supabase.from("pengaturan_pesantren").insert(payload).select("*").single();

      if (result.error) throw result.error;
      setInstitution(result.data);
      setMessage("Konten landing page berhasil disimpan.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(`Gagal menyimpan: ${error instanceof Error ? error.message : "Kesalahan server"}`);
      setMessageIsError(true);
    } finally {
      setIsSavingLanding(false);
    }
  }

  async function saveInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institution || isSaving) return;

    const formData = new FormData(event.currentTarget);
    const namaPesantren = String(formData.get("nama_pesantren") ?? "").trim();
    if (!namaPesantren) {
      setMessage("Nama lembaga wajib diisi.");
      setMessageIsError(true);
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      const supabase = createClient();
      const savedLogoUrl = logoFile ? await uploadLogo(supabase, logoFile) : logoUrl;
      const payload = {
        nama_pesantren: namaPesantren,
        pengasuh: String(formData.get("pengasuh") ?? "").trim(),
        alamat: String(formData.get("alamat") ?? "").trim(),
        telepon: String(formData.get("telepon") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        logo_url: savedLogoUrl,
        logo_size: (formData.get("logo_size") as LogoSize) ?? "medium",
        logo_height: (formData.get("logo_height") as LogoHeight) ?? "h-10",
        show_logo_navbar: formData.get("show_logo_navbar") === "on",
        show_logo_sidebar: formData.get("show_logo_sidebar") === "on",
        show_logo_kuitansi: formData.get("show_logo_kuitansi") === "on",
        footer_kuitansi: String(formData.get("footer_kuitansi") ?? "").trim(),
        pos_printer_width: String(formData.get("pos_printer_width") ?? "58mm"),
        updated_at: new Date().toISOString(),
      };

      const result = institution.id
        ? await supabase.from("pengaturan_pesantren").update(payload).eq("id", institution.id).select("*").single()
        : await supabase.from("pengaturan_pesantren").insert(payload).select("*").single();

      if (result.error) throw result.error;
      setInstitution(result.data);
      setLogoFile(null);
      setLogoPreviewUrl("");
      setIsLogoRemoved(false);
      setMessage("Profil lembaga berhasil diperbarui.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(`Pengaturan lembaga gagal disimpan: ${error instanceof Error ? error.message : "Kesalahan server"}`);
      setMessageIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProfileState(profileId: string, role: string, isActive: boolean, fullName: string) {
    setSavingProfileId(profileId);
    setMessage("");
    try {
      const supabase = createClient();

      // Eksekusi update langsung ke Supabase
      const { data, error } = await supabase
        .from("profiles")
        .update({
          role: role as UserRole,
          is_active: isActive,
          nama_lengkap: fullName,
        })
        .eq("id", profileId)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      // Pastikan ada baris yang benar-benar terupdate oleh RLS
      if (!data || data.length === 0) {
        throw new Error("Pembaruan ditolak oleh database (RLS). Pastikan Anda memiliki akses Super Admin.");
      }

      // Perbarui tampilan lokal setelah dipastikan tersimpan di server
      setProfileAccess((current) =>
        current.map((item) =>
          item.id === profileId
            ? { ...item, role: role as UserRole, is_active: isActive, nama_lengkap: fullName, full_name: fullName }
            : item
        )
      );

      setMessage(`Hak akses untuk ${fullName || "pengguna"} berhasil diperbarui dan aktif.`);
      setMessageIsError(false);
    } catch (error) {
      console.error("Gagal simpan profil:", error);
      setMessage(`Gagal menyimpan ke server: ${error instanceof Error ? error.message : "Kesalahan tidak diketahui"}`);
      setMessageIsError(true);
    } finally {
      setSavingProfileId("");
    }
  }

  function saveProfileAccess(event: FormEvent<HTMLFormElement>, profile: ProfileRow) {
    event.preventDefault();
    if (savingProfileId) return;

    const formData = new FormData(event.currentTarget);
    const role = String(formData.get("role") ?? "");
    const isActive = formData.get("is_active") === "on";
    const fullName = String(formData.get("full_name") ?? "").trim();

    if (!fullName) {
      setMessage("Nama lengkap wajib diisi.");
      setMessageIsError(true);
      return;
    }

    void updateProfileState(profile.id, role, isActive, fullName);
  }

  function startCreate() {
    setEditingBook(null);
    setMessage("");
  }

  function startEdit(book: Book) {
    setEditingBook(book);
    setMessage("");
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    if (isSaving) return;

    const values = new FormData(form);
    const judul = String(values.get("judul") ?? "").trim();
    const pengarang = String(values.get("pengarang") ?? "").trim();
    if (!judul) {
      setMessage("Judul kitab wajib diisi.");
      setMessageIsError(true);
      return;
    }

    const payload: BookInsert = {
      judul,
      pengarang: pengarang || null,
      kategori: category,
      is_active: editingBook ? values.get("is_active") === "on" : true,
    };

    setIsSaving(true);
    setMessage("");
    try {
      const result = editingBook
        ? await createClient().from("master_kitab").update(payload).eq("id", editingBook.id).select("*").single()
        : await createClient().from("master_kitab").insert(payload).select("*").single();

      if (result.error) throw result.error;
      setBooks((current) =>
        editingBook
          ? current.map((book) => (book.id === result.data.id ? result.data : book))
          : [...current, result.data].sort((a, b) => a.judul.localeCompare(b.judul, "id"))
      );
      setMessage(`Kitab “${result.data.judul}” berhasil disimpan.`);
      setMessageIsError(false);
      setEditingBook(null);
      form.reset();
    } catch (error) {
      setMessage(`Kitab gagal disimpan: ${error instanceof Error ? error.message : "Kesalahan server"}`);
      setMessageIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Hapus kitab “${book.judul}”?`)) return;
    const { error } = await createClient().from("master_kitab").delete().eq("id", book.id);
    if (error) {
      setMessage(`Gagal menghapus: ${error.message}`);
      setMessageIsError(true);
      return;
    }
    setBooks((current) => current.filter((item) => item.id !== book.id));
    if (editingBook?.id === book.id) setEditingBook(null);
    setMessage(`Kitab “${book.judul}” berhasil dihapus.`);
    setMessageIsError(false);
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Workspace" title="Pengaturan sistem" description="Kelola profil lembaga, hak akses pengguna, dan master kitab." />
      {message && <FormMessage success={!messageIsError}>{message}</FormMessage>}
      
      <nav aria-label="Bagian pengaturan" className="flex flex-wrap gap-2">
        {([
          ["institution", "Profil lembaga", "settings"],
          ["landing", "Konten Halaman Depan", "sparkles"],
          ["access", "Hak akses", "users"],
          ["books", "Master kitab", "book"],
        ] as const).map(([val, label, icon]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              setSection(val);
              setMessage("");
            }}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-semibold transition-all ${
              section === val
                ? "bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-white shadow-[0_8px_20px_rgba(68,87,255,0.2)]"
                : "border border-[#e5e7eb] bg-white text-[#55566f] hover:border-[#cbd0ff] hover:text-[#4457ff]"
            }`}
          >
            <Icon name={icon} size={15} />
            {label}
          </button>
        ))}
      </nav>

      {section === "institution" && (
        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-base font-bold">Profil lembaga dan kuitansi</h2>
            <p className="mt-1 text-xs text-[#757693]">Identitas resmi lembaga dan pengaturan cetak struk.</p>
          </div>
          {isLoadingSystem ? (
            <p className="p-6 text-center text-xs text-[#757693]">Memuat konfigurasi lembaga…</p>
          ) : institution ? (
            <form onSubmit={saveInstitution} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Nama pesantren *
                <input name="nama_pesantren" required defaultValue={institution.nama_pesantren} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Nama pengasuh
                <input name="pengasuh" defaultValue={institution.pengasuh} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Telepon
                <input name="telepon" type="tel" defaultValue={institution.telepon} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Alamat
                <textarea name="alamat" rows={2} defaultValue={institution.alamat} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Email
                <input name="email" type="email" defaultValue={institution.email} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>

              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-[#55566f]">Logo lembaga</p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsLogoDropActive(true);
                  }}
                  onDragLeave={() => setIsLogoDropActive(false)}
                  onDrop={handleLogoDrop}
                  className={`mt-1.5 flex flex-col gap-4 rounded-3xl border border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:p-5 ${
                    isLogoDropActive ? "border-[#4457ff] bg-[#eef0ff]" : "border-[#cbd0df] bg-[#f8f9ff]"
                  }`}
                >
                  <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                    {previewLogoUrl ? (
                      <Image
                        src={previewLogoUrl}
                        alt="Logo"
                        width={96}
                        height={96}
                        unoptimized
                        className={`max-w-full object-contain ${institution.logo_height}`}
                      />
                    ) : (
                      <Icon name="sparkles" size={30} className="text-[#a3a7c2]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#181c31]">{logoFile?.name ?? (logoUrl ? "Logo tersimpan" : "Belum ada logo")}</p>
                    <p className="mt-1 text-xs text-[#757693]">Pilih format PNG, JPG, WEBP, atau SVG (maks. 1 MB).</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label htmlFor="institution-logo-file" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-4 text-xs font-semibold text-white">
                        <Icon name="upload" size={15} />
                        {logoUrl || logoFile ? "Ganti Logo" : "Pilih File"}
                      </label>
                      {(logoUrl || logoFile) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreviewUrl("");
                            setIsLogoRemoved(true);
                          }}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-4 text-xs font-semibold text-[#757693] hover:text-rose-700"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <input id="institution-logo-file" type="file" accept="image/*" onChange={handleLogoInput} className="sr-only" />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <fieldset>
                    <legend className="text-xs font-semibold text-[#55566f]">Tinggi logo</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        ["h-8", "Kecil"],
                        ["h-10", "Sedang"],
                        ["h-14", "Besar"],
                      ] as const).map(([val, label]) => (
                        <label
                          key={val}
                          className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                            institution.logo_height === val ? "border-[#4457ff] bg-[#eef0ff] text-[#4457ff]" : "border-[#e5e7eb] bg-white text-[#757693]"
                          }`}
                        >
                          <input type="radio" name="logo_height" value={val} defaultChecked={institution.logo_height === val} className="accent-[#4457ff]" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="text-xs font-semibold text-[#55566f]">
                    Ukuran proporsi logo
                    <select name="logo_size" defaultValue={institution.logo_size ?? "medium"} className="mt-2 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]">
                      <option value="small">Kecil</option>
                      <option value="medium">Sedang</option>
                      <option value="proportional">Proporsional</option>
                    </select>
                  </label>
                </div>

                <fieldset className="mt-4">
                  <legend className="text-xs font-semibold text-[#55566f]">Tampilkan logo pada</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {([
                      ["show_logo_navbar", "Navbar beranda", institution.show_logo_navbar],
                      ["show_logo_sidebar", "Sidebar dashboard", institution.show_logo_sidebar],
                      ["show_logo_kuitansi", "Kuitansi keuangan", institution.show_logo_kuitansi],
                    ] as const).map(([name, label, checked]) => (
                      <label key={name} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs font-medium text-[#55566f]">
                        <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-[#4457ff]" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Footer kuitansi
                <textarea name="footer_kuitansi" rows={2} defaultValue={institution.footer_kuitansi} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Lebar printer POS
                <select name="pos_printer_width" defaultValue={institution.pos_printer_width} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]">
                  <option value="58mm">58 mm</option>
                  <option value="80mm">80 mm</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <PrimaryButton type="submit" disabled={isSaving}>
                  <Icon name="check" size={16} />
                  {isSaving ? "Menyimpan…" : "Simpan profil lembaga"}
                </PrimaryButton>
              </div>
            </form>
          ) : null}
        </section>
      )}

      {section === "landing" && (
        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-base font-bold">Konten Halaman Depan</h2>
            <p className="mt-1 text-xs text-[#757693]">Perubahan langsung terlihat di beranda utama.</p>
          </div>
          {institution && (
            <form onSubmit={saveLandingContent} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Badge hero
                <input name="hero_badge" required defaultValue={institution.hero_badge} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Headline hero
                <input name="hero_title" required defaultValue={institution.hero_title} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Subtitle hero
                <textarea name="hero_subtitle" required rows={3} defaultValue={institution.hero_subtitle} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Kutipan mutiara / hadits
                <textarea name="hero_quote" required rows={2} defaultValue={institution.hero_quote} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Sumber kutipan
                <input name="hero_quote_source" required defaultValue={institution.hero_quote_source} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Judul bagian tentang
                <input name="tentang_title" required defaultValue={institution.tentang_title} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Deskripsi pesantren
                <textarea name="tentang_deskripsi" required rows={4} defaultValue={institution.tentang_deskripsi} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Gelombang PPDB
                <input name="ppdb_gelombang" required defaultValue={institution.ppdb_gelombang} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Status pendaftaran
                <input name="ppdb_status" required defaultValue={institution.ppdb_status} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                URL brosur PDF (opsional)
                <input name="ppdb_brosur_url" type="url" defaultValue={institution.ppdb_brosur_url} placeholder="https://…" className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                WhatsApp sekretariat
                <input name="whatsapp_center" required type="tel" defaultValue={institution.whatsapp_center} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f]">
                Jam operasional & kunjungan
                <input name="jam_operasional" required defaultValue={institution.jam_operasional} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Alamat lengkap
                <textarea name="alamat_lengkap" required rows={2} defaultValue={institution.alamat_lengkap} className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3.5 py-3 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="text-xs font-semibold text-[#55566f] sm:col-span-2">
                Akun Instagram
                <input name="sosmed_instagram" required defaultValue={institution.sosmed_instagram} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <div className="sm:col-span-2">
                <PrimaryButton type="submit" disabled={isSavingLanding}>
                  <Icon name="check" size={16} />
                  {isSavingLanding ? "Menyimpan…" : "Simpan Konten Landing Page"}
                </PrimaryButton>
              </div>
            </form>
          )}
        </section>
      )}

      {section === "access" && (
        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-7">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold">Pengguna dan hak akses</h2>
              <p className="mt-1 text-xs text-[#757693]">Setujui akun pendaftar baru dan tentukan peran akses.</p>
            </div>
            <span className="w-fit rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#4457ff]">
              Total: {profileAccess.length} Akun
            </span>
          </div>

          {isLoadingSystem ? (
            <p className="p-6 text-center text-xs text-[#757693]">Memuat daftar pengguna…</p>
          ) : profileAccess.length ? (
            <div className="space-y-4">
              {profileAccess.map((profile) => {
                const isCurrentUser = profile.id === currentProfileId;
                const displayName = profile.nama_lengkap || profile.full_name || "Pengguna Baru";
                const isPending = !profile.is_active;

                return (
                  <form
                    key={profile.id}
                    onSubmit={(e) => saveProfileAccess(e, profile)}
                    className="grid gap-4 rounded-2xl border border-[#e5e7eb] p-4 transition-all sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] sm:items-center hover:border-[#cbd0ff]"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[#181c31]">{displayName}</p>
                      <p className="mt-1 break-all text-[11px] text-[#8a8ba2]">
                        {profile.id}
                        {isCurrentUser ? " · Akun Anda" : ""}
                      </p>
                      <div className="mt-2">
                        <StatusBadge
                          label={profile.is_active ? "Aktif" : "Menunggu Persetujuan"}
                          tone={profile.is_active ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4d6] text-[#a6641c]"}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-[11px] font-semibold text-[#55566f]">
                        Nama lengkap
                        <input
                          name="full_name"
                          required
                          defaultValue={profile.nama_lengkap || profile.full_name || ""}
                          disabled={isCurrentUser || Boolean(savingProfileId)}
                          className="mt-1.5 min-h-[40px] w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs outline-none focus:border-[#4457ff] disabled:bg-[#f1f1f5]"
                        />
                      </label>
                      <label className="block text-[11px] font-semibold text-[#55566f]">
                        Peran
                        <select
                          name="role"
                          defaultValue={profile.role}
                          disabled={isCurrentUser || Boolean(savingProfileId)}
                          className="mt-1.5 min-h-[40px] w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs outline-none focus:border-[#4457ff] disabled:bg-[#f1f1f5]"
                        >
                          {systemRoles.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#55566f]">
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked={profile.is_active}
                          disabled={isCurrentUser || Boolean(savingProfileId)}
                          className="size-4 accent-[#4457ff]"
                        />
                        Akun aktif
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <PrimaryButton type="submit" disabled={isCurrentUser || Boolean(savingProfileId)} className="min-h-[40px] px-4 text-xs">
                        <Icon name="check" size={14} />
                        {savingProfileId === profile.id ? "Menyimpan…" : "Simpan akses"}
                      </PrimaryButton>

                      {isPending && !isCurrentUser && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={Boolean(savingProfileId)}
                            onClick={() =>
                              void updateProfileState(
                                profile.id,
                                profile.role,
                                true,
                                profile.nama_lengkap || profile.full_name || "Pengguna"
                              )
                            }
                            className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(savingProfileId)}
                            onClick={() =>
                              void updateProfileState(
                                profile.id,
                                profile.role,
                                false,
                                profile.nama_lengkap || profile.full_name || "Pengguna"
                              )
                            }
                            className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                );
              })}
            </div>
          ) : (
            <p className="p-6 text-center text-xs text-[#757693]">Belum ada pengguna lain yang mendaftar.</p>
          )}
        </section>
      )}

      {section === "books" && (
        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold">Master kitab</h2>
              <p className="mt-1 text-xs text-[#757693]">Daftar aktif digunakan untuk mutaba&apos;ah sorogan dan matan.</p>
            </div>
            <PillTabs
              label="Kategori kitab"
              value={category}
              options={categoryOptions}
              onChange={(val) => {
                setCategory(val);
                setEditingBook(null);
                setMessage("");
              }}
            />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
            <div className="space-y-3">
              {isLoading ? (
                <p className="p-6 text-center text-xs text-[#757693]">Memuat daftar kitab…</p>
              ) : visibleBooks.length ? (
                visibleBooks.map((book) => (
                  <article key={book.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#e5e7eb] p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]">
                        <Icon name="book" size={18} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold">{book.judul}</h3>
                        <p className="mt-1 text-xs text-[#757693]">{book.pengarang || "Pengarang belum dicatat"}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${book.is_active ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#f1f1f5] text-[#757693]"}`}>
                          {book.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(book)} className="min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-xs font-semibold hover:border-[#cbd0ff] hover:text-[#4457ff]">
                        Edit
                      </button>
                      <button type="button" onClick={() => void deleteBook(book)} className="min-h-[44px] rounded-full border border-[#f2d3d3] px-4 text-xs font-semibold text-[#b74444] hover:bg-[#fff7f7]">
                        Hapus
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="p-6 text-center text-xs text-[#757693]">Belum ada data kitab.</p>
              )}
            </div>
            <form onSubmit={saveBook} className="h-fit rounded-2xl bg-[#f8f9ff] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">{editingBook ? "Edit kitab" : "Tambah kitab"}</h3>
                {editingBook && (
                  <button type="button" onClick={startCreate} className="text-xs font-semibold text-[#4457ff]">
                    Batal edit
                  </button>
                )}
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#55566f]">
                Judul kitab
                <input name="judul" required defaultValue={editingBook?.judul ?? ""} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              <label className="mt-4 block text-xs font-semibold text-[#55566f]">
                Nama pengarang
                <input name="pengarang" defaultValue={editingBook?.pengarang ?? ""} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]" />
              </label>
              {editingBook && (
                <label className="mt-4 flex items-center gap-2 text-xs font-medium text-[#55566f]">
                  <input name="is_active" type="checkbox" defaultChecked={editingBook.is_active} className="size-4 accent-[#4457ff]" />
                  Kitab aktif
                </label>
              )}
              <PrimaryButton type="submit" disabled={isSaving} className="mt-5 w-full">
                <Icon name={editingBook ? "check" : "plus"} size={16} />
                {isSaving ? "Menyimpan…" : editingBook ? "Simpan perubahan" : "Tambah kitab"}
              </PrimaryButton>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}