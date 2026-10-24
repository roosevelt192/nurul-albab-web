"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { Field, FormMessage, PrimaryButton } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

const steps = ["Data diri", "Data wali / ortu", "Konfirmasi berkas"];
const draftKey = "nais-ppdb-draft";
type FormValues = Record<string, string>;
type StudentInsert = Database["public"]["Tables"]["santri"]["Insert"];

const initialValues: FormValues = {
  name: "", nisn: "", nik: "", birthPlace: "", birthDate: "", gender: "",
  aspiration: "", health: "", father: "", mother: "", occupation: "",
  whatsapp: "", address: "", consulate: "",
};

export default function PpdbPage() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<{ familyCard: File | null; birthCertificate: File | null; photo: File | null }>({
    familyCard: null,
    birthCertificate: null,
    photo: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  function restoreDraft() {
    try {
      const savedDraft = window.localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed: unknown = JSON.parse(savedDraft);
        if (typeof parsed === "object" && parsed !== null && "values" in parsed && "step" in parsed) {
          const draft = parsed as { values: FormValues; step: number };
          setValues({ ...initialValues, ...draft.values });
          setStep(Math.min(Math.max(draft.step, 0), 2));
          setMessage("Draft pendaftaran sebelumnya berhasil dipulihkan.");
          setSuccess(true);
          return;
        }
      }
      setMessage("Belum ada draft pendaftaran yang tersimpan pada perangkat ini.");
      setSuccess(false);
    } catch {
      setMessage("Draft sebelumnya tidak dapat dibaca. Silakan lanjutkan dengan formulir baru.");
      setSuccess(false);
    }
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ values, step }));
      setMessage("Draft tersimpan di perangkat ini. Anda dapat melanjutkan kapan saja.");
      setSuccess(true);
    } catch {
      setMessage("Draft tidak dapat disimpan di perangkat ini. Periksa pengaturan penyimpanan browser.");
      setSuccess(false);
    }
  }

  function nextStep() {
    if (formRef.current?.reportValidity()) {
      setStep((current) => Math.min(current + 1, 2));
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const gender = values.gender === "Laki-laki" ? "L" : values.gender === "Perempuan" ? "P" : null;
    if (!gender) {
      setMessage("Pilih jenis kelamin calon santri yang valid.");
      setSuccess(false);
      return;
    }
    if (!files.familyCard || !files.birthCertificate || !files.photo) {
      setMessage("Unggah foto, kartu keluarga, dan akta kelahiran sebelum mengirim pendaftaran.");
      setSuccess(false);
      return;
    }
    const maxFileSize = 10 * 1024 * 1024;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(files.photo.type) ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(files.familyCard.type) ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(files.birthCertificate.type) ||
      [files.photo, files.familyCard, files.birthCertificate].some((file) => file.size > maxFileSize)
    ) {
      setMessage("Format foto harus JPG, PNG, atau WebP. Dokumen boleh PDF/JPG/PNG/WebP dengan ukuran maksimal 10 MB.");
      setSuccess(false);
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    const id = crypto.randomUUID();
    const uploadedObjects: { bucket: "santri-avatars" | "santri-berkas"; path: string }[] = [];
    try {
      const supabase = createClient();
      async function upload(bucket: "santri-avatars" | "santri-berkas", file: File, label: string) {
        const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${id}/${label}-${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedObjects.push({ bucket, path });
        return path;
      }
      const [photoPath, familyCardPath, birthCertificatePath] = await Promise.all([
        upload("santri-avatars", files.photo, "profile"),
        upload("santri-berkas", files.familyCard, "kartu-keluarga"),
        upload("santri-berkas", files.birthCertificate, "akta-kelahiran"),
      ]);
      const { data: photoUrl } = supabase.storage.from("santri-avatars").getPublicUrl(photoPath);
      const student: StudentInsert = {
        id,
        nama_lengkap: values.name.trim(),
        nisn: values.nisn.trim() || null,
        nik: values.nik.trim() || null,
        tempat_lahir: values.birthPlace.trim(),
        tanggal_lahir: values.birthDate,
        jenis_kelamin: gender,
        cita_cita: values.aspiration.trim() || null,
        riwayat_kesehatan: values.health.trim() || null,
        nama_wali: `${values.father.trim()} / ${values.mother.trim()}`,
        nama_ayah: values.father.trim(),
        nama_ibu: values.mother.trim(),
        no_hp_wali: values.whatsapp.trim(),
        pekerjaan_wali: values.occupation.trim(),
        konsulat: values.consulate.trim() || null,
        alamat_domisili: values.address.trim(),
        foto_url: photoUrl.publicUrl,
        berkas_kk_path: familyCardPath,
        berkas_akta_path: birthCertificatePath,
        status: "pending_ppdb",
      };
      const { error } = await supabase.from("santri").insert(student);
      if (error) {
        console.error("Failed to submit pending PPDB santri.", {
          table: "santri",
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setMessage(`Pendaftaran gagal dikirim: ${error.message}`);
        setSuccess(false);
        await Promise.all(uploadedObjects.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])));
        return;
      }
      setMessage(`Terima kasih, ${values.name}. Pendaftaran tersimpan dan menunggu verifikasi pesantren.`);
      setSuccess(true);
      window.localStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Unable to initialize Supabase while submitting PPDB application.", error);
      setMessage(error instanceof Error ? error.message : "Pendaftaran gagal dikirim.");
      setSuccess(false);
      if (uploadedObjects.length) {
        const supabase = createClient();
        const cleanup = await Promise.all(uploadedObjects.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])));
        cleanup.forEach(({ error: cleanupError }) => {
          if (cleanupError) console.error("Failed to remove orphaned PPDB upload.", cleanupError);
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5ff] px-4 py-7 sm:py-10">
      <div className="mx-auto max-w-[760px]">
        <header className="mb-7 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-white"><Icon name="sparkles" size={19} /></span>
            <span><span className="block text-sm font-bold">NAIS · PPDB</span><span className="text-[11px] text-[#757693]">Pondok Pesantren Nurul Albab</span></span>
          </Link>
          <Link href="/login" className="min-h-11 content-center text-xs font-semibold text-[#4457ff]">Masuk <span aria-hidden="true">↗</span></Link>
        </header>

        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4457ff]">Penerimaan santri baru</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Formulir pendaftaran</h1>
          <p className="mt-2 text-sm leading-6 text-[#757693]">Isi data calon santri dan keluarga secara bertahap. Draft dapat disimpan pada perangkat ini.</p>

          <ol aria-label="Tahap pendaftaran" className="mt-7 grid grid-cols-3 gap-2">
            {steps.map((label, index) => (
              <li key={label} aria-current={step === index ? "step" : undefined}>
                <div className={`h-1.5 rounded-full ${index <= step ? "bg-gradient-to-r from-[#4457ff] to-[#7583fd]" : "bg-[#e9eaf2]"}`} />
                <p className={`mt-2 text-[10px] font-semibold sm:text-xs ${index === step ? "text-[#4457ff]" : "text-[#8a8ba2]"}`}>
                  <span className="mr-1">{String(index + 1).padStart(2, "0")}</span>{label}
                </p>
              </li>
            ))}
          </ol>

          <form ref={formRef} onSubmit={submitApplication} className="mt-8">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama lengkap calon santri" name="name" placeholder="Nama sesuai dokumen" required value={values.name} onChange={(value) => updateValue("name", value)} className="sm:col-span-2" />
                <Field label="NISN" name="nisn" placeholder="10 digit NISN" value={values.nisn} onChange={(value) => updateValue("nisn", value)} />
                <Field label="NIK" name="nik" placeholder="16 digit NIK" value={values.nik} onChange={(value) => updateValue("nik", value)} />
                <Field label="Tempat lahir" name="birthPlace" placeholder="Kota / kabupaten" required value={values.birthPlace} onChange={(value) => updateValue("birthPlace", value)} />
                <Field label="Tanggal lahir" name="birthDate" type="date" required value={values.birthDate} onChange={(value) => updateValue("birthDate", value)} />
                <Field label="Jenis kelamin" name="gender" required value={values.gender} onChange={(value) => updateValue("gender", value)}>
                  <option value="">Pilih jenis kelamin</option><option>Laki-laki</option><option>Perempuan</option>
                </Field>
                <Field label="Konsulat / daerah asal" name="consulate" placeholder="Kabupaten / daerah asal" value={values.consulate} onChange={(value) => updateValue("consulate", value)} />
                <Field label="Cita-cita" name="aspiration" placeholder="Contoh: pendidik" value={values.aspiration} onChange={(value) => updateValue("aspiration", value)} />
                <Field label="Riwayat penyakit / alergi" name="health" placeholder="Tuliskan jika ada" value={values.health} onChange={(value) => updateValue("health", value)} className="sm:col-span-2" />
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama ayah" name="father" placeholder="Nama lengkap ayah" required value={values.father} onChange={(value) => updateValue("father", value)} />
                <Field label="Nama ibu" name="mother" placeholder="Nama lengkap ibu" required value={values.mother} onChange={(value) => updateValue("mother", value)} />
                <Field label="Pekerjaan orang tua / wali" name="occupation" placeholder="Pekerjaan" required value={values.occupation} onChange={(value) => updateValue("occupation", value)} />
                <Field label="Nomor WhatsApp aktif" name="whatsapp" type="tel" placeholder="08xxxxxxxxxx" required value={values.whatsapp} onChange={(value) => updateValue("whatsapp", value)} />
                <label className="block text-xs font-semibold text-[#55566f] sm:col-span-2">Alamat lengkap
                  <textarea name="address" required value={values.address} onChange={(event) => updateValue("address", event.target.value)} placeholder="Jalan, RT/RW, desa, kecamatan, kabupaten" className="mt-1.5 min-h-28 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-3 text-sm font-normal outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10" />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-[#f8f9ff] p-4">
                  <h2 className="text-sm font-bold">Ringkasan calon santri</h2>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div><dt className="text-[#8a8ba2]">Nama</dt><dd className="mt-1 font-semibold">{values.name || "—"}</dd></div>
                    <div><dt className="text-[#8a8ba2]">Tanggal lahir</dt><dd className="mt-1 font-semibold">{values.birthDate || "—"}</dd></div>
                    <div><dt className="text-[#8a8ba2]">Wali</dt><dd className="mt-1 font-semibold">{values.father || "—"} / {values.mother || "—"}</dd></div>
                    <div><dt className="text-[#8a8ba2]">WhatsApp</dt><dd className="mt-1 font-semibold">{values.whatsapp || "—"}</dd></div>
                  </dl>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {([
                    ["familyCard", "Kartu keluarga"],
                    ["birthCertificate", "Akta kelahiran"],
                    ["photo", "Pasfoto calon santri"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbd0e0] bg-[#fafaff] px-3 text-center transition hover:border-[#4457ff]">
                      <Icon name="file" size={20} className="text-[#4457ff]" />
                      <span className="mt-2 text-xs font-semibold">{label}</span>
                      <span className="mt-1 break-all text-[10px] text-[#8a8ba2]">{files[key]?.name || "Pilih berkas"}</span>
                      <input type="file" accept="image/*,.pdf" required className="sr-only" onChange={(event) => setFiles((current) => ({ ...current, [key]: event.target.files?.[0] ?? null }))} />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-[#8a8ba2]">Foto profil akan ditampilkan pada data santri. Berkas KK dan akta hanya dapat dilihat oleh pengurus.</p>
              </div>
            )}

            {message && <div className="mt-5"><FormMessage success={success}>{message}</FormMessage></div>}

            <div className="mt-7 flex flex-col-reverse justify-between gap-3 border-t border-[#f0f0f5] pt-5 sm:flex-row">
              <div className="flex gap-2">
                {step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold text-[#55566f] transition hover:bg-[#f8f9ff]">Kembali</button>}
                <button type="button" onClick={restoreDraft} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold text-[#55566f] transition hover:bg-[#f8f9ff]">Pulihkan draft</button>
                <button type="button" onClick={saveDraft} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold text-[#55566f] transition hover:border-[#cbd0ff] hover:text-[#4457ff]">Simpan draft</button>
              </div>
              {step < 2 ? (
                <PrimaryButton onClick={nextStep}>Lanjutkan <Icon name="arrow-right" size={16} /></PrimaryButton>
              ) : (
                <PrimaryButton type="submit" disabled={isSubmitting}>{isSubmitting ? "Mengirim…" : "Konfirmasi pendaftaran"} <Icon name="check" size={16} /></PrimaryButton>
              )}
            </div>
          </form>
        </section>
        <p className="mt-5 text-center text-[11px] text-[#8a8ba2]">Pondok Pesantren Nurul Albab · Penerimaan santri baru</p>
      </div>
    </main>
  );
}
