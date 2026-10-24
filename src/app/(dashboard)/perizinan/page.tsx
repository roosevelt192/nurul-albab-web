"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { StudentAvatar } from "@/components/student-avatar";
import { Field, FormMessage, MetricCard, PageHeading, PillTabs, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import { requestAlertsRefresh } from "@/lib/operational-alerts";
import type { Database } from "@/types/database";

type GateStatus = "Sedang di Luar" | "Kembali Tepat Waktu" | "Terlambat" | "Lainnya";
type PermitFilter = "Semua" | GateStatus;
type Student = Database["public"]["Tables"]["santri"]["Row"];
type Permit = Database["public"]["Tables"]["perizinan_santri"]["Row"];
type PermitInsert = Database["public"]["Tables"]["perizinan_santri"]["Insert"];
type PermitView = Permit & {
  santri_name: string;
  nis: string;
  kamar_asrama: string | null;
  kelas_marhalah: string | null;
  foto_url: string | null;
  no_hp_wali: string | null;
};

type PermitCategory = {
  label: string;
  tone: string;
};

function permitCategory(reason: string | null | undefined): PermitCategory {
  const normalized = String(reason ?? "").toLowerCase();
  if (normalized.includes("sakit") || normalized.includes("berobat") || normalized.includes("rumah sakit")) {
    return { label: "Sakit / Berobat", tone: "border border-rose-200/70 bg-rose-50 text-rose-700" };
  }
  if (
    normalized.includes("pulang") ||
    normalized.includes("berkala") ||
    normalized.includes("libur") ||
    normalized.includes("cuti")
  ) {
    return { label: "Pulang Berkala", tone: "border border-sky-200/70 bg-sky-50 text-sky-700" };
  }
  if (
    normalized.includes("mendesak") ||
    normalized.includes("darurat") ||
    normalized.includes("keluarga") ||
    normalized.includes("duka")
  ) {
    return { label: "Mendesak", tone: "border border-amber-200/70 bg-amber-50 text-amber-700" };
  }
  return { label: "Izin Umum", tone: "border border-slate-200 bg-slate-50 text-slate-600" };
}

function getGateStatus(
  status: string,
  actualReturn: string | null,
  deadline?: string | null,
  now = Date.now(),
): GateStatus {
  const normalized = status.toLowerCase();
  if (actualReturn || normalized.includes("kembali") || normalized.includes("returned")) {
    return normalized.includes("terlambat") || normalized.includes("late")
      ? "Terlambat"
      : "Kembali Tepat Waktu";
  }
  if (normalized.includes("terlambat") || normalized.includes("late")) return "Terlambat";
  const deadlineTime = deadline ? new Date(deadline).getTime() : Number.NaN;
  if (Number.isFinite(deadlineTime) && deadlineTime < now) return "Terlambat";
  if (normalized.includes("luar") || normalized.includes("approved") || normalized.includes("setuju") || normalized.includes("diajukan") || normalized.includes("pending")) return "Sedang di Luar";
  return "Lainnya";
}

const statusStyles: Record<GateStatus, { tone: string; note: string }> = {
  "Sedang di Luar": { tone: "bg-[#fff4e7] text-[#a6641c]", note: "Menunggu verifikasi kepulangan petugas" },
  "Kembali Tepat Waktu": { tone: "bg-[#e8f5f0] text-[#25815e]", note: "Kepulangan telah tercatat di database" },
  Terlambat: { tone: "bg-[#fff0f0] text-[#b74444]", note: "Melewati batas waktu izin" },
  Lainnya: { tone: "bg-[#f1f1f5] text-[#757693]", note: "Status izin mengikuti data database" },
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function relativeDeadline(deadline: string | null, now: number) {
  if (!deadline || now <= 0) return "—";
  const diff = new Date(deadline).getTime() - now;
  if (!Number.isFinite(diff)) return "—";
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const text = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
  return diff < 0 ? `Lewat ${text}` : `${text} lagi`;
}

function toIso(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export default function PerizinanPage() {
  const [permits, setPermits] = useState<PermitView[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<PermitFilter>("Semua");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [permitSearch, setPermitSearch] = useState("");
  const [permitStudentId, setPermitStudentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPermitData() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const [studentResult, permitResult] = await Promise.all([
          supabase.from("santri").select("*"),
          supabase.from("perizinan_santri").select(
            "id, santri_id, tanggal_keluar, batas_kembali, kedatangan_aktual, alasan_izin, penjemput, status, created_at"
          ),
        ]);

        if (studentResult.error) {
          console.error("Failed to load santri for the gate permit list.", {
            table: "santri",
            code: studentResult.error.code,
            message: studentResult.error.message,
            details: studentResult.error.details,
            hint: studentResult.error.hint,
          });
        }
        if (permitResult.error) {
          console.error("Failed to load perizinan_santri from Supabase.", {
            table: "perizinan_santri",
            code: permitResult.error.code,
            message: permitResult.error.message,
            details: permitResult.error.details,
            hint: permitResult.error.hint,
          });
        }

        if (studentResult.error || permitResult.error) {
          if (active) {
            setMessage(
              `Data perizinan gagal dimuat: ${[studentResult.error?.message, permitResult.error?.message].filter(Boolean).join(" · ")}`,
            );
          }
          return;
        }

        if (active) {
          const loadedStudents = (studentResult.data ?? []).sort(
            (a, b) =>
              String(a.nama_lengkap ?? "").localeCompare(String(b.nama_lengkap ?? ""), "id-ID"),
          );
          const studentById = new Map(loadedStudents.map((student) => [student.id, student]));
          setStudents(loadedStudents);
          const sortedPermits = (permitResult.data ?? [])
            .sort(
              (a, b) =>
                String(b.tanggal_keluar ?? "").localeCompare(
                  String(a.tanggal_keluar ?? ""),
                  "id-ID",
                ),
            )
            .map((permit) => {
              const student = studentById.get(permit.santri_id);
              return {
                ...permit,
                santri_name: student?.nama_lengkap ?? "Santri tidak ditemukan",
                nis: student?.nis ?? "—",
                kamar_asrama: student?.kamar_asrama ?? null,
                kelas_marhalah: student?.kelas_marhalah ?? null,
                foto_url: student?.foto_url ?? null,
                no_hp_wali: student?.no_hp_wali ?? null,
              };
            });
          setPermits(sortedPermits);
          setMessage("");
        }
      } catch (error) {
        console.error("Unable to initialize Supabase while loading gate permit data.", error);
        if (active) setMessage(error instanceof Error ? error.message : "Tidak dapat menghubungkan ke Supabase.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadPermitData();
    return () => {
      active = false;
    };
  }, []);

  const visiblePermits = useMemo(
    () => permits.filter((permit) => filter === "Semua" || getGateStatus(permit.status, permit.kedatangan_aktual, permit.batas_kembali, now) === filter),
    [permits, filter, now],
  );
  const eligibleStudents = students.filter((student) => student.status === "aktif");
  const searchableStudents = eligibleStudents.filter((student) =>
    `${student.nama_lengkap} ${student.nis ?? ""} ${student.kamar_asrama ?? ""}`
      .toLocaleLowerCase("id-ID")
      .includes(permitSearch.trim().toLocaleLowerCase("id-ID")),
  );
  const selectedPermitStudent = eligibleStudents.find((student) => student.id === permitStudentId) ?? null;

  async function markReturned(permit: PermitView) {
    if (returningId) return;
    setReturningId(permit.id);
    setMessage("");

    try {
      const arrivalTime = new Date();
      const arrivedAt = arrivalTime.toISOString();
      const deadline = new Date(permit.batas_kembali).getTime();
      const status = deadline < arrivalTime.getTime() ? "terlambat" : "kembali_tepat_waktu";
      const supabase = createClient();
      const { data, error } = await supabase
        .from("perizinan_santri")
        .update({ kedatangan_aktual: arrivedAt, status })
        .eq("id", permit.id)
        .select("id, santri_id, tanggal_keluar, batas_kembali, kedatangan_aktual, alasan_izin, penjemput, status, created_at")
        .single();

      if (error) {
        const errorDescription = [error.message, error.details, error.hint].filter(Boolean).join(" · ");
        console.error("Failed to verify santri return in perizinan_santri.", {
          table: "perizinan_santri",
          permitId: permit.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setMessage(`Kepulangan ${permit.santri_name} gagal disimpan${error.code ? ` (${error.code})` : ""}: ${errorDescription}`);
        return;
      }

      setPermits((current) => current.map((item) => item.id === permit.id ? {
        ...data,
        santri_name: permit.santri_name,
        nis: permit.nis,
        kamar_asrama: permit.kamar_asrama,
        kelas_marhalah: permit.kelas_marhalah,
        foto_url: permit.foto_url,
        no_hp_wali: permit.no_hp_wali,
      } : item));
      setMessage(`Kepulangan ${permit.santri_name} tercatat ${status === "terlambat" ? "melewati batas waktu" : "tepat waktu"} pada ${formatDateTime(data.kedatangan_aktual)}.`);
      requestAlertsRefresh();
    } catch (error) {
      console.error("Unable to initialize Supabase while verifying a gate return.", error);
      setMessage(error instanceof Error ? error.message : "Tidak dapat menyimpan verifikasi kepulangan.");
    } finally {
      setReturningId(null);
    }
  }

  async function addPermit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    if (isSaving) return;

    const data = new FormData(form);
    const santriId = String(data.get("santri_id") ?? "");
    const permit: PermitInsert = {
      santri_id: santriId,
      tanggal_keluar: toIso(data.get("tanggal_keluar")),
      batas_kembali: toIso(data.get("batas_kembali")),
      kedatangan_aktual: null,
      alasan_izin: String(data.get("alasan_izin")).trim(),
      penjemput: String(data.get("penjemput")).trim(),
      status: "sedang_di_luar",
    };

    if (!permit.tanggal_keluar || !permit.batas_kembali) {
      setMessage("Isi waktu keluar dan batas kembali dengan tanggal yang valid.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: inserted, error } = await supabase
        .from("perizinan_santri")
        .insert(permit)
        .select("id, santri_id, tanggal_keluar, batas_kembali, kedatangan_aktual, alasan_izin, penjemput, status, created_at")
        .single();

      if (error) {
        console.error("Failed to insert perizinan_santri into Supabase.", {
          table: "perizinan_santri",
          santriId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setMessage(`Izin gagal disimpan: ${error.message}`);
        return;
      }

      const student = students.find((item) => item.id === santriId);
      setPermits((current) => [{
        ...inserted,
        santri_name: student?.nama_lengkap ?? "Santri tidak ditemukan",
        nis: student?.nis ?? "—",
        kamar_asrama: student?.kamar_asrama ?? null,
        kelas_marhalah: student?.kelas_marhalah ?? null,
        foto_url: student?.foto_url ?? null,
        no_hp_wali: student?.no_hp_wali ?? null,
      }, ...current]);
      setFormOpen(false);
      setPermitSearch("");
      setPermitStudentId("");
      setMessage(`Izin keluar untuk ${student?.nama_lengkap ?? "santri"} berhasil disimpan ke database.`);
      requestAlertsRefresh();
      form.reset();
    } catch (error) {
      console.error("Unable to initialize Supabase while creating a permit.", error);
      setMessage(error instanceof Error ? error.message : "Tidak dapat menyimpan izin ke Supabase.");
    } finally {
      setIsSaving(false);
    }
  }

  const countStatus = (status: GateStatus) => permits.filter((permit) => getGateStatus(permit.status, permit.kedatangan_aktual, permit.batas_kembali, now) === status).length;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Data & keamanan" title="Perizinan santri" description="Data izin dan verifikasi kepulangan dicatat langsung di Supabase untuk petugas gerbang." action={<PrimaryButton onClick={() => { setPermitStudentId(""); setPermitSearch(""); setFormOpen(true); }}><Icon name="plus" size={17} /> Catat izin</PrimaryButton>} />
      {message && <FormMessage success={message.includes("berhasil disimpan") || message.includes("tercatat pada")}>{message}</FormMessage>}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Sedang di luar" value={String(countStatus("Sedang di Luar"))} detail="Menunggu verifikasi kembali" icon="clock" tone="bg-[#fff4e7] text-[#bd7627]" />
        <MetricCard label="Kembali tepat waktu" value={String(countStatus("Kembali Tepat Waktu"))} detail="Kepulangan tercatat di database" icon="check" tone="bg-[#e8f5f0] text-[#25815e]" />
        <MetricCard label="Terlambat" value={String(countStatus("Terlambat"))} detail="Perlu tindak lanjut pengasuh" icon="shield" tone="bg-[#fff0f0] text-[#b74444]" />
      </section>

      {formOpen && (
        <div className="backdrop-enter fixed inset-0 z-50 flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setFormOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="permit-form-heading" className="modal-enter-up max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#4457ff]">Pintu gerbang</p><h2 id="permit-form-heading" className="mt-1 text-xl font-bold">Catat izin santri</h2><p className="mt-1 text-xs text-[#757693]">Pilih santri dan masukkan waktu wajib kembali.</p></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Tutup formulir" className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={17} /></button></div>
            <form onSubmit={addPermit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#55566f] sm:col-span-2">Cari santri<input value={permitSearch} onChange={(event) => setPermitSearch(event.target.value)} placeholder="Ketik nama, NIS, atau kamar…" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff]" /></label>
              <Field label="Nama santri" name="santri_id" required value={permitStudentId} onChange={setPermitStudentId} className="sm:col-span-2"><option value="">Pilih santri aktif</option>{searchableStudents.map((student) => <option key={student.id} value={student.id}>{student.nama_lengkap} · {student.nis ?? "NIS—"} · {student.kamar_asrama || "Kamar—"}</option>)}</Field>
              {selectedPermitStudent && <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9ff] p-3 sm:col-span-2"><StudentAvatar name={selectedPermitStudent.nama_lengkap} src={selectedPermitStudent.foto_url} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{selectedPermitStudent.nama_lengkap}</p><p className="mt-1 text-[10px] text-[#757693]">Wali: {selectedPermitStudent.nama_wali || "Belum tercatat"} · {selectedPermitStudent.no_hp_wali || "Nomor kontak belum tersedia"}</p></div>{selectedPermitStudent.no_hp_wali && <a href={whatsappUrl(selectedPermitStudent.no_hp_wali)} target="_blank" rel="noreferrer" className="min-h-10 shrink-0 rounded-full bg-[#e8f5f0] px-4 py-2 text-[11px] font-semibold text-[#25815e]">Hubungi wali</a>}</div>}
              <Field label="Alasan izin" name="alasan_izin" placeholder="Sakit, urusan keluarga…" required />
              <Field label="Nama penjemput" name="penjemput" placeholder="Nama wali / penjemput" required />
              <Field label="Waktu keluar" name="tanggal_keluar" type="datetime-local" required />
              <Field label="Batas wajib kembali" name="batas_kembali" type="datetime-local" required />
              <div className="flex flex-col-reverse gap-2 border-t border-[#f0f0f5] pt-4 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setFormOpen(false)} disabled={isSaving} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold">Batal</button><PrimaryButton type="submit" disabled={isSaving || eligibleStudents.length === 0} className="w-full sm:w-auto">{isSaving ? "Menyimpan…" : "Simpan izin"}</PrimaryButton></div>
              {eligibleStudents.length === 0 && !isLoading && <p className="text-[11px] text-[#a6641c] sm:col-span-2">Tidak ada santri aktif yang tersedia atau data santri tidak dapat dibaca. Periksa kebijakan RLS.</p>}
            </form>
          </section>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><h2 className="text-base font-bold">Log gerbang</h2><p className="mt-1 text-xs text-[#757693]">Validasi kepulangan santri dan simpan waktu kedatangan aktual.</p></div>
          <PillTabs label="Filter status perizinan" value={filter} options={["Semua", "Sedang di Luar", "Kembali Tepat Waktu", "Terlambat"].map((value) => ({ value: value as PermitFilter, label: value }))} onChange={setFilter} />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Santri</th>
                <th className="px-5 py-3 font-semibold">Tujuan / penjemput</th>
                <th className="px-5 py-3 font-semibold">Keluar</th>
                <th className="px-5 py-3 font-semibold">Batas kembali</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visiblePermits.map((permit) => {
                const gateStatus = getGateStatus(permit.status, permit.kedatangan_aktual, permit.batas_kembali, now);
                const status = statusStyles[gateStatus];
                const category = permitCategory(permit.alasan_izin);
                const late = gateStatus === "Terlambat";
                const returned = Boolean(permit.kedatangan_aktual);
                return (
                  <tr
                    key={permit.id}
                    className={`border-b border-slate-100 align-middle transition last:border-0 ${late ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-slate-50/70"}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentAvatar name={permit.santri_name} src={permit.foto_url} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{permit.santri_name}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            NIS {permit.nis} · {permit.kelas_marhalah || "Kelas —"} · {permit.kamar_asrama || "Kamar —"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[240px] px-5 py-4">
                      <StatusBadge label={category.label} tone={category.tone} />
                      <span className="mt-1.5 block truncate text-xs text-slate-600">{permit.alasan_izin}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">Penjemput: {permit.penjemput}</span>
                    </td>
                    <td className="px-5 py-4 text-[11px] tabular-nums text-slate-600">{formatDateTime(permit.tanggal_keluar)}</td>
                    <td className="px-5 py-4">
                      <span className={`block text-[11px] font-semibold tabular-nums ${late ? "text-rose-600" : "text-slate-700"}`}>
                        {formatDateTime(permit.batas_kembali)}
                      </span>
                      <span className={`mt-0.5 block text-[10px] ${late ? "text-rose-500" : "text-slate-400"}`}>
                        {returned ? `Tiba ${formatDateTime(permit.kedatangan_aktual)}` : relativeDeadline(permit.batas_kembali, now)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge label={gateStatus} tone={status.tone} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!returned && (
                          <button
                            type="button"
                            disabled={returningId !== null}
                            onClick={() => void markReturned(permit)}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#4457ff] px-3 text-[11px] font-semibold text-white transition hover:bg-[#3546e8] disabled:opacity-60"
                          >
                            <Icon name="check" size={13} />
                            {returningId === permit.id ? "Menyimpan…" : "Konfirmasi Kembali ke Pondok"}
                          </button>
                        )}
                        {returned && <span className="text-[11px] text-slate-400">Selesai</span>}
                        {permit.no_hp_wali && (
                          <a
                            href={whatsappUrl(permit.no_hp_wali)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp wali ${permit.santri_name}`}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <Icon name="phone" size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && visiblePermits.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Belum ada data izin yang sesuai pada database.</td></tr>
              )}
              {isLoading && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Memuat data perizinan dari Supabase…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 md:hidden">
          {visiblePermits.map((permit) => {
            const gateStatus = getGateStatus(permit.status, permit.kedatangan_aktual, permit.batas_kembali, now);
            const status = statusStyles[gateStatus];
            const category = permitCategory(permit.alasan_izin);
            const late = gateStatus === "Terlambat";
            const returned = Boolean(permit.kedatangan_aktual);
            return (
              <article
                key={permit.id}
                className={`rounded-2xl border p-4 ${late ? "border-rose-200 bg-rose-50/60" : returned ? "border-emerald-200/70 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <StudentAvatar name={permit.santri_name} src={permit.foto_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-slate-800">{permit.santri_name}</h3>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                          NIS {permit.nis} · {permit.kelas_marhalah || "Kelas —"} · {permit.kamar_asrama || "Kamar —"}
                        </p>
                      </div>
                      <StatusBadge label={gateStatus} tone={status.tone} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge label={category.label} tone={category.tone} />
                    </div>
                    <p className="mt-2 break-words text-xs text-slate-600">{permit.alasan_izin}</p>
                    <p className="mt-0.5 break-words text-[11px] text-slate-400">Penjemput: {permit.penjemput}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-3 text-[10px]">
                  <div>
                    <dt className="text-slate-400">Keluar</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-700">{formatDateTime(permit.tanggal_keluar)}</dd>
                  </div>
                  <div>
                    <dt className={late ? "text-rose-500" : "text-slate-400"}>Batas kembali</dt>
                    <dd className={`mt-0.5 font-semibold tabular-nums ${late ? "text-rose-600" : "text-slate-700"}`}>
                      {formatDateTime(permit.batas_kembali)}
                      <span className="mt-0.5 block text-[10px] font-normal">{returned ? `Tiba ${formatDateTime(permit.kedatangan_aktual)}` : relativeDeadline(permit.batas_kembali, now)}</span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!returned && (
                    <button
                      type="button"
                      disabled={returningId !== null}
                      onClick={() => void markReturned(permit)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#4457ff] px-4 text-xs font-semibold text-white transition hover:bg-[#3546e8] disabled:opacity-60"
                    >
                      <Icon name="check" size={15} />
                      {returningId === permit.id ? "Menyimpan…" : "Konfirmasi Kembali ke Pondok"}
                    </button>
                  )}
                  {returned && <span className="text-[11px] font-medium text-emerald-700">Kepulangan tercatat</span>}
                  {permit.no_hp_wali && (
                    <a
                      href={whatsappUrl(permit.no_hp_wali)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-4 text-[11px] font-semibold text-emerald-700"
                    >
                      <Icon name="phone" size={14} /> Wali
                    </a>
                  )}
                </div>
              </article>
            );
          })}
          {!isLoading && visiblePermits.length === 0 && <p className="py-10 text-center text-xs text-slate-500">Belum ada data izin yang sesuai pada database.</p>}
          {isLoading && <p className="py-10 text-center text-xs text-slate-500">Memuat data perizinan dari Supabase…</p>}
        </div>
      </section>
    </div>
  );
}
