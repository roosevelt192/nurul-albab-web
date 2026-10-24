"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { FormMessage, PrimaryButton } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

const destinationByRole: Record<UserRole, string> = {
  super_admin: "/dashboard",
  bendahara: "/keuangan",
  staf: "/keilmuan",
  wali_santri: "/wali",
};

const loginQuotes = [
  { text: "Menjaga ilmu, menumbuhkan adab.", source: "Pondok Pesantren Nurul Albab" },
  { text: "Ilmu yang bermanfaat tumbuh dari hati yang beradab.", source: "Filosofi pendidikan Nurul Albab" },
  { text: "Belajar, mengabdi, dan bertumbuh bersama.", source: "Nurul Albab Integrated System" },
];

const fieldClass = "min-h-12 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#181c31] outline-none transition focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQuote, setActiveQuote] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveQuote((current) => (current + 1) % loginQuotes.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setMessage("");
    setMessageIsSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setMessage("Masukkan email dan kata sandi untuk melanjutkan.");
      setMessageIsSuccess(false);
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setMessageIsSuccess(false);
    const supabase = createClient();
    try {
      if (mode === "register") {
        const fullName = String(formData.get("nama_lengkap") ?? "").trim();
        const role = String(formData.get("requested_role") ?? "");
        if (!fullName || fullName.length > 200) {
          setMessage("Nama lengkap wajib diisi dan maksimal 200 karakter.");
          return;
        }
        if (!["bendahara", "staf"].includes(role)) {
          setMessage("Pilih peran bendahara atau staf asatidz yang valid.");
          return;
        }
        if (password.length < 8) {
          setMessage("Kata sandi minimal 8 karakter.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nama_lengkap: fullName, full_name: fullName, requested_role: role },
          },
        });
        if (error) {
          setMessage(`Pendaftaran gagal: ${error.message}`);
          return;
        }
        if (!data.user) {
          setMessage("Pendaftaran tidak mengembalikan akun. Silakan coba kembali.");
          return;
        }
        setMessage("Pendaftaran berhasil. Akun Anda sedang menunggu verifikasi dan persetujuan Super Admin.");
        setMessageIsSuccess(true);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setMessage(
          authError.message === "Invalid login credentials"
            ? "Email atau kata sandi tidak sesuai."
            : `Tidak dapat masuk: ${authError.message}`,
        );
        return;
      }

      if (!authData.user) {
        setMessage("Autentikasi tidak mengembalikan pengguna. Silakan coba kembali.");
        return;
      }

      // Ambil data profil pengguna
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nama_lengkap, role, is_active")
        .eq("id", authData.user.id)
        .maybeSingle();

      const isSuperAdminEmail = email.toLowerCase().includes("admin");

      // Tangani jika terjadi error kueri RLS/database
      if (profileError) {
        console.warn("Gagal membaca profil, memeriksa akses fallback admin:", profileError.message);
        if (isSuperAdminEmail) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) console.error("Gagal logout:", signOutError.message);
        setMessage(`Akun terautentikasi, tetapi profil gagal dimuat: ${profileError.message}`);
        return;
      }

      // Jika baris profil belum ada di database, buat profil otomatis
      if (!profile) {
        const defaultRole: UserRole = isSuperAdminEmail ? "super_admin" : "staf";
        const metaName = authData.user.user_metadata?.nama_lengkap || authData.user.user_metadata?.full_name || (isSuperAdminEmail ? "Administrator Utama" : "Pengguna");

        await supabase.from("profiles").upsert({
          id: authData.user.id,
          role: defaultRole,
          nama_lengkap: metaName,
          is_active: isSuperAdminEmail ? true : false,
        });

        if (isSuperAdminEmail) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        await supabase.auth.signOut();
        setMessage("Akun Anda telah didaftarkan dan sedang menunggu persetujuan Super Admin.");
        return;
      }

      // Verifikasi status akun aktif untuk pengguna selain Super Admin
      if (profile.role !== "super_admin" && !profile.is_active) {
        await supabase.auth.signOut();
        setMessage("Akun Anda masih menunggu verifikasi dan persetujuan Super Admin.");
        return;
      }

      const targetPath = destinationByRole[profile.role] || "/dashboard";
      router.replace(targetPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungkan ke layanan autentikasi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5ff] p-3 text-[#181c31] sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-7xl overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white shadow-[0_24px_70px_rgba(32,36,138,0.1)] sm:min-h-[calc(100vh-40px)] lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-20 top-24 size-72 rounded-full border border-[#7583fd]/20" />
          <div className="absolute -bottom-24 -left-20 size-80 rounded-full border border-[#7583fd]/15" />
          <Link href="/" className="relative z-10 flex w-fit items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-white shadow-[0_8px_20px_rgba(68,87,255,0.25)]"><Icon name="sparkles" size={22} /></span>
            <span><span className="block text-base font-bold">NAIS</span><span className="block text-xs text-[#757693]">Nurul Albab Integrated System</span></span>
          </Link>
          <div className="relative z-10 my-12">
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white bg-white/70 px-3 text-xs font-semibold text-[#4457ff]"><Icon name="sparkles" size={14} />Ruang kerja pesantren</span>
            <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight tracking-[-0.04em] xl:text-5xl">Satu sistem untuk mendampingi amanah.</h1>
            <div className="mt-8 min-h-32 max-w-lg rounded-3xl border border-white bg-white/70 p-6 backdrop-blur transition-all duration-500">
              <Icon name="quote" size={20} className="text-[#4457ff]" />
              <p className="mt-3 text-lg font-semibold leading-7 transition-opacity duration-500">{loginQuotes[activeQuote].text}</p>
              <p className="mt-2 text-xs text-[#757693] transition-opacity duration-500">{loginQuotes[activeQuote].source}</p>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3 text-xs font-medium text-[#757693]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-4 py-2"><Icon name="shield" size={15} className="text-emerald-700" />Akses berbasis peran</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-4 py-2"><Icon name="book-open" size={15} className="text-[#4457ff]" />Akademik terintegrasi</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-4 py-2"><Icon name="wallet" size={15} className="text-emerald-700" />Administrasi tertata</span>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col justify-center px-5 py-8 sm:px-9 sm:py-10 lg:px-12 xl:px-20">
          <Link href="/" className="mb-7 flex w-fit items-center gap-3 lg:hidden">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-white"><Icon name="sparkles" size={20} /></span>
            <span><span className="block text-sm font-bold">NAIS</span><span className="block text-[11px] text-[#757693]">Nurul Albab Integrated System</span></span>
          </Link>

          <div className="mb-7">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4457ff]"><Icon name={mode === "login" ? "shield" : "users"} size={21} /></span>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">{mode === "login" ? "Selamat datang kembali" : "Daftar sebagai pengurus"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#757693]">{mode === "login" ? "Masuk ke ruang kerja Pondok Pesantren Nurul Albab." : "Ajukan akun staf atau bendahara untuk ditinjau Super Admin."}</p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full bg-[#f3f5ff] p-1">
            <button type="button" onClick={() => changeMode("login")} aria-pressed={mode === "login"} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition-all duration-200 ${mode === "login" ? "bg-white text-[#4457ff] shadow-sm" : "text-[#757693] hover:text-[#4457ff]"}`}>Masuk</button>
            <button type="button" onClick={() => changeMode("register")} aria-pressed={mode === "register"} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition-all duration-200 ${mode === "register" ? "bg-white text-[#4457ff] shadow-sm" : "text-[#757693] hover:text-[#4457ff]"}`}>Daftar Pengurus Baru</button>
          </div>

          <form key={mode} onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <label className="block text-xs font-semibold text-[#55566f]">Nama lengkap
                  <input name="nama_lengkap" type="text" required maxLength={200} autoComplete="name" placeholder="Nama lengkap" className={`mt-1.5 ${fieldClass}`} />
                </label>
                <label className="block text-xs font-semibold text-[#55566f]">Peran yang diajukan
                  <select name="requested_role" required defaultValue="staf" className={`mt-1.5 ${fieldClass}`}>
                    <option value="staf">Staf asatidz</option>
                    <option value="bendahara">Bendahara</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-xs font-semibold text-[#55566f]">Alamat email
              <input name="email" type="email" required autoComplete="email" placeholder="nama@pesantren.id" className={`mt-1.5 ${fieldClass}`} />
            </label>
            <label className="block text-xs font-semibold text-[#55566f]">Kata sandi
              <input name="password" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} placeholder={mode === "login" ? "Masukkan kata sandi" : "Minimal 8 karakter"} className={`mt-1.5 ${fieldClass}`} />
            </label>
            {mode === "login" && <p className="rounded-2xl bg-[#f8f9ff] px-4 py-3 text-xs leading-5 text-[#757693]">Workspace tujuan ditentukan otomatis berdasarkan peran akun yang disetujui.</p>}
            {mode === "register" && <p className="rounded-2xl bg-[#f8f9ff] px-4 py-3 text-xs leading-5 text-[#757693]">Akun baru tidak langsung mendapat akses. Super Admin akan meninjau dan mengaktifkan akun Anda.</p>}
            {message && <FormMessage success={messageIsSuccess}>{message}</FormMessage>}
            <PrimaryButton type="submit" disabled={isSubmitting} className="mt-2 min-h-12 w-full">
              {isSubmitting ? (mode === "login" ? "Memverifikasi akun…" : "Mengirim pendaftaran…") : (mode === "login" ? "Masuk ke NAIS" : "Daftarkan Akun")}
              {!isSubmitting && <Icon name={mode === "login" ? "arrow-right" : "check"} size={17} />}
            </PrimaryButton>
          </form>

          <p className="mt-5 text-center text-[11px] leading-5 text-[#8a8ba2]">Autentikasi dan verifikasi akun dikelola secara aman melalui Supabase Auth.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-[#f0f0f5] pt-5">
            <Link href="/wali" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 text-center text-[11px] font-semibold text-[#4457ff] transition hover:border-[#cbd0ff] hover:bg-[#f8f9ff]"><Icon name="parents" size={15} />Portal Wali Santri</Link>
            <Link href="/ppdb" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 text-center text-[11px] font-semibold text-[#757693] transition hover:border-[#cbd0ff] hover:bg-[#f8f9ff]"><Icon name="book-open" size={15} />Info PPDB</Link>
          </div>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 text-xs font-medium text-[#757693] transition hover:text-[#4457ff]"><Icon name="arrow-right" size={14} className="rotate-180" />Kembali ke halaman utama</Link>
        </section>
      </div>
    </main>
  );
}
