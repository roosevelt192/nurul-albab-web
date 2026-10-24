"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Field, FormMessage, PrimaryButton } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

const destinationByRole: Record<UserRole, string> = {
  super_admin: "/dashboard",
  bendahara: "/keuangan",
  staf: "/keilmuan",
  wali_santri: "/portal-wali",
};

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setMessage("Masukkan email dan kata sandi untuk melanjutkan.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      const supabase = createClient();
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nama_lengkap, role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to read the signed-in user's profile from public.profiles.", {
          userId: authData.user.id,
          table: "profiles",
          columns: ["id", "nama_lengkap", "role"],
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
        });
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Unable to clear session after the profile query failed.", {
            userId: authData.user.id,
            message: signOutError.message,
          });
        }
        setMessage(
          `Akun berhasil diautentikasi, tetapi query public.profiles gagal: ${profileError.message}. Periksa kolom id, nama_lengkap, role dan kebijakan SELECT RLS.`,
        );
        return;
      }

      if (!profile) {
        console.warn("No public.profiles row exists for the authenticated Supabase user.", {
          userId: authData.user.id,
          expectedColumns: ["id", "nama_lengkap", "role"],
          nextStep: "Create a profiles row whose id matches auth.users.id and allow the user to SELECT their own row.",
        });
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Unable to clear session because the profile row is missing.", {
            userId: authData.user.id,
            message: signOutError.message,
          });
        }
        setMessage("Profil peran akun belum tersedia. Pastikan baris profiles.id sama dengan ID pengguna Auth dan pengguna diizinkan membaca profilnya.");
        return;
      }

      if (!Object.hasOwn(destinationByRole, profile.role)) {
        console.error("The signed-in user's profile has an unsupported role.", {
          userId: authData.user.id,
          role: profile.role,
          profileName: profile.nama_lengkap,
        });
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Unable to clear session for an unsupported profile role.", {
            userId: authData.user.id,
            message: signOutError.message,
          });
        }
        setMessage("Peran akun belum dikenali. Hubungi administrator untuk memperbarui profil Anda.");
        return;
      }

      router.replace(destinationByRole[profile.role]);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghubungkan ke layanan autentikasi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5ff] px-4 py-8">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-white">
            <Icon name="sparkles" size={20} />
          </span>
          <span>
            <span className="block text-sm font-bold">NAIS</span>
            <span className="block text-[11px] text-[#757693]">Nurul Albab Integrated System</span>
          </span>
        </Link>

        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-6 sm:p-9">
          <div className="mb-7">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4457ff]">
              <Icon name="shield" size={21} />
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-[-0.04em]">Selamat datang kembali</h1>
            <p className="mt-2 text-sm leading-6 text-[#757693]">Masuk ke ruang kerja Pondok Pesantren Nurul Albab.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Alamat email" name="email" type="email" placeholder="nama@pesantren.id" required />
            <Field label="Kata sandi" name="password" type="password" placeholder="Masukkan kata sandi" required />
            <p className="rounded-2xl bg-[#f8f9ff] px-4 py-3 text-xs leading-5 text-[#757693]">
              Workspace tujuan ditentukan otomatis berdasarkan peran akun yang terdaftar.
            </p>
            {message && <FormMessage>{message}</FormMessage>}
            <PrimaryButton type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? "Memverifikasi akun…" : "Masuk ke NAIS"}
              {!isSubmitting && <Icon name="arrow-right" size={17} />}
            </PrimaryButton>
          </form>
          <p className="mt-5 text-center text-[11px] leading-5 text-[#8a8ba2]">
            Autentikasi aman dikelola melalui Supabase Auth.
          </p>
          <div className="mt-6 border-t border-[#f0f0f5] pt-5 text-center text-sm text-[#757693]">
            Calon santri baru?{" "}
            <Link href="/ppdb" className="font-semibold text-[#4457ff] hover:underline">Daftar di sini</Link>
          </div>
        </section>
        <Link href="/" className="mt-5 flex min-h-11 items-center justify-center gap-2 text-xs font-medium text-[#757693] hover:text-[#4457ff]">
          <Icon name="arrow-right" size={14} className="rotate-180" /> Kembali ke halaman utama
        </Link>
      </div>
    </main>
  );
}
