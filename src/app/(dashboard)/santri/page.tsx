"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import NextImage from "next/image";
import * as XLSX from "xlsx";
import { Icon } from "@/components/icon";
import { StudentAvatar } from "@/components/student-avatar";
import { Field, FormMessage, MetricCard, PageHeading, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import type { Database, SantriGender } from "@/types/database";

type Student = Database["public"]["Tables"]["santri"]["Row"];
type StudentInsert = Database["public"]["Tables"]["santri"]["Insert"];
type Applicant = Database["public"]["Tables"]["santri"]["Row"];
type EditorMode = "create" | "edit" | "detail";
type SortOrder = "name-asc" | "name-desc";
type StudentFilters = { kelas: string; kamar: string; konsulat: string };

const studentColumns = "id, nis, nisn, nik, nama_lengkap, tempat_lahir, tanggal_lahir, jenis_kelamin, konsulat, alamat_domisili, foto_url, berkas_kk_path, berkas_akta_path, nama_wali, nama_ayah, nama_ibu, no_hp_wali, pekerjaan_wali, cita_cita, riwayat_kesehatan, parent_id, kamar_asrama, kelas_marhalah, status, created_at";
const templateHeaders = ["Nama Lengkap", "NIK", "Jenis Kelamin (L/P)", "Kelas", "Kamar", "Konsulat", "Domisili", "Nama Wali", "No HP WA", "Tanggal Lahir (YYYY-MM-DD)"];
const templateKeys = ["nama_lengkap", "nik", "jenis_kelamin", "kelas_marhalah", "kamar_asrama", "konsulat", "alamat_domisili", "nama_wali", "no_hp_wali", "tanggal_lahir"];
const headerAliases: Record<string, string> = {
  "nama lengkap": "nama_lengkap",
  "jenis kelamin (l/p)": "jenis_kelamin",
  "nama wali": "nama_wali",
  kelas: "kelas_marhalah",
  kamar: "kamar_asrama",
  domisili: "alamat_domisili",
  "no hp wa": "no_hp_wali",
  "no hp wali": "no_hp_wali",
  "tanggal lahir (yyyy-mm-dd)": "tanggal_lahir",
};
const exportColumns: { key: keyof Student; label: string }[] = [
  { key: "nis", label: "NIS" }, { key: "nama_lengkap", label: "Nama Lengkap" },
  { key: "nisn", label: "NISN" }, { key: "nik", label: "NIK" },
  { key: "tempat_lahir", label: "Tempat Lahir" }, { key: "tanggal_lahir", label: "Tanggal Lahir" },
  { key: "jenis_kelamin", label: "Jenis Kelamin (L/P)" }, { key: "kelas_marhalah", label: "Kelas" },
  { key: "kamar_asrama", label: "Kamar" }, { key: "konsulat", label: "Konsulat" },
  { key: "alamat_domisili", label: "Domisili" }, { key: "nama_wali", label: "Nama Wali" },
  { key: "no_hp_wali", label: "No HP WA" }, { key: "nama_ayah", label: "Nama Ayah" },
  { key: "nama_ibu", label: "Nama Ibu" }, { key: "pekerjaan_wali", label: "Pekerjaan Wali" },
  { key: "cita_cita", label: "Cita-cita" }, { key: "riwayat_kesehatan", label: "Riwayat Kesehatan" },
  { key: "status", label: "Status" }, { key: "created_at", label: "Tanggal Masuk" },
];

const headerStyle = {
  fill: { fgColor: { rgb: "4457FF" } },
  font: { bold: true, color: { rgb: "FFFFFF" } },
  alignment: { vertical: "center", wrapText: true },
};

function styleHeader(sheet: XLSX.WorkSheet, columnCount: number) {
  for (let column = 0; column < columnCount; column += 1) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: column });
    if (sheet[cell]) sheet[cell].s = headerStyle;
  }
  sheet["!rows"] = [{ hpt: 32 }];
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } }) };
}

async function cropAvatar(file: File, focusY: number, zoom: number) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Foto tidak dapat dibaca untuk pemotongan."));
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const sourceX = (image.naturalWidth - side) / 2;
    const sourceY = (image.naturalHeight - side) * focusY;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak mendukung pemrosesan foto.");
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Foto tidak berhasil diproses."));
    }, "image/jpeg", 0.9));
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-crop.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function genderLabel(value: Student["jenis_kelamin"]) {
  return value === "L" ? "Laki-laki" : value === "P" ? "Perempuan" : "—";
}

type StudentStatusKey = "aktif" | "lulus" | "izin" | "pindah" | "lainnya";
type StatusFilter = "semua" | Exclude<StudentStatusKey, "lainnya">;

type StudentStatusMeta = {
  key: StudentStatusKey;
  label: string;
  tone: string;
  dot: string;
};

function studentStatusMeta(value: string | null | undefined): StudentStatusMeta {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    normalized.includes("tidak") ||
    normalized.includes("nonaktif") ||
    normalized.includes("inactive")
  ) {
    return {
      key: "izin",
      label: "Tidak Aktif",
      tone: "border border-rose-200/70 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
    };
  }
  if (normalized === "aktif" || normalized === "active" || normalized.includes("status_aktif")) {
    return {
      key: "aktif",
      label: "Aktif",
      tone: "border border-emerald-200/70 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }
  if (
    normalized.includes("alumni") ||
    normalized.includes("lulus") ||
    normalized.includes("mutamakhrij") ||
    normalized.includes("mutakhorij") ||
    normalized.includes("khatam")
  ) {
    return {
      key: "lulus",
      label: "Lulus / Mutamakhrij",
      tone: "border border-blue-200/70 bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
    };
  }
  if (
    normalized.includes("cuti") ||
    normalized.includes("izin") ||
    normalized.includes("pending")
  ) {
    return {
      key: "izin",
      label: normalized.includes("cuti") ? "Cuti" : "Izin",
      tone: "border border-amber-200/70 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    };
  }
  if (
    normalized.includes("pindah") ||
    normalized.includes("keluar") ||
    normalized.includes("dropout")
  ) {
    return {
      key: "pindah",
      label: "Pindah",
      tone: "border border-rose-200/70 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
    };
  }
  return {
    key: "lainnya",
    label: value ? value.replace(/_/g, " ") : "Belum diatur",
    tone: "border border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  };
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function emptyStudentForm() {
  return {
    nama_lengkap: "", nik: "", tempat_lahir: "", tanggal_lahir: "", jenis_kelamin: "",
    konsulat: "", alamat_domisili: "", nama_wali: "", no_hp_wali: "", pekerjaan_wali: "",
    nama_ayah: "", nama_ibu: "", cita_cita: "", riwayat_kesehatan: "",
    kelas_marhalah: "", kamar_asrama: "",
  };
}

function todayFileDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function SantriPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formValues, setFormValues] = useState(emptyStudentForm());
  const [pendingOpen, setPendingOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Applicant | null>(null);
  const [approvalClass, setApprovalClass] = useState("");
  const [approvalRoom, setApprovalRoom] = useState("");
  const [filters, setFilters] = useState<StudentFilters>({ kelas: "Semua kelas", kamar: "Semua kamar", konsulat: "Semua konsulat" });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [mutationTarget, setMutationTarget] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [kkFile, setKkFile] = useState<File | null>(null);
  const [aktaFile, setAktaFile] = useState<File | null>(null);
  const [avatarFocusY, setAvatarFocusY] = useState(0.5);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [documentUrls, setDocumentUrls] = useState<Record<string, { kk: string | null; akta: string | null }>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("santri").select(studentColumns);
        if (error) {
          console.error("Failed to load santri records.", { table: "santri", code: error.code, message: error.message, details: error.details, hint: error.hint });
          if (active) setMessage(`Data santri gagal dimuat: ${error.message}`);
        } else if (active) {
          const allStudents = (data ?? []).sort(
            (a, b) =>
              String(a.nama_lengkap ?? "").localeCompare(String(b.nama_lengkap ?? ""), "id-ID"),
          );
          setStudents(allStudents.filter((student) => student.status !== "pending_ppdb"));
          setApplicants(allStudents.filter((student) => student.status === "pending_ppdb"));
        }
      } catch (error) {
        console.error("Unable to initialize Supabase while loading student data.", error);
        if (active) setMessage(error instanceof Error ? error.message : "Tidak dapat memuat data santri.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id-ID");
    return students
      .filter((student) => [
        student.nama_lengkap, student.nis, student.konsulat, student.alamat_domisili,
        student.kamar_asrama, student.kelas_marhalah,
      ].some((value) => value?.toLocaleLowerCase("id-ID").includes(term)) &&
        (filters.kelas === "Semua kelas" || student.kelas_marhalah === filters.kelas) &&
        (filters.kamar === "Semua kamar" || student.kamar_asrama === filters.kamar) &&
        (filters.konsulat === "Semua konsulat" || student.konsulat === filters.konsulat) &&
        (statusFilter === "semua" || studentStatusMeta(student.status).key === statusFilter))
      .sort((first, second) => {
        if (sortOrder === "name-desc") return second.nama_lengkap.localeCompare(first.nama_lengkap, "id");
        return first.nama_lengkap.localeCompare(second.nama_lengkap, "id");
      });
  }, [students, query, sortOrder, filters, statusFilter]);

  const classOptions = [...new Set(students.map((student) => student.kelas_marhalah).filter((value): value is string => Boolean(value)))].sort();
  const roomOptions = [...new Set(students.map((student) => student.kamar_asrama).filter((value): value is string => Boolean(value)))].sort();
  const consulateOptions = [...new Set(students.map((student) => student.konsulat).filter((value): value is string => Boolean(value)))].sort();

  const activeCount = students.filter((student) => student.status.toLowerCase() === "aktif").length;
  const combinedFilterValue =
    statusFilter !== "semua" ? `status:${statusFilter}` : `konsulat:${filters.konsulat}`;

  function openCreate() {
    setSelectedStudent(null);
    setAvatarFile(null);
    setKkFile(null);
    setAktaFile(null);
    setAvatarPreviewUrl("");
    setAvatarFocusY(0.5);
    setAvatarZoom(1);
    setFormValues(emptyStudentForm());
    setEditorMode("create");
  }

  function openEditor(student: Student, mode: EditorMode) {
    setMutationTarget(null);
    setSelectedStudent(student);
    setAvatarFile(null);
    setKkFile(null);
    setAktaFile(null);
    setAvatarPreviewUrl("");
    setAvatarFocusY(0.5);
    setAvatarZoom(1);
    if (mode === "detail") void loadDocumentUrls(student);
    setFormValues({
      nama_lengkap: student.nama_lengkap,
      nik: student.nik ?? "",
      tempat_lahir: student.tempat_lahir ?? "",
      tanggal_lahir: student.tanggal_lahir ?? "",
      jenis_kelamin: student.jenis_kelamin ?? "",
      konsulat: student.konsulat ?? "",
      alamat_domisili: student.alamat_domisili ?? "",
      nama_wali: student.nama_wali ?? "",
      nama_ayah: student.nama_ayah ?? "",
      nama_ibu: student.nama_ibu ?? "",
      cita_cita: student.cita_cita ?? "",
      riwayat_kesehatan: student.riwayat_kesehatan ?? "",
      no_hp_wali: student.no_hp_wali ?? "",
      pekerjaan_wali: student.pekerjaan_wali ?? "",
      kelas_marhalah: student.kelas_marhalah ?? "",
      kamar_asrama: student.kamar_asrama ?? "",
    });
    setEditorMode(mode);
  }

  function openMutation(student: Student) {
    openEditor(student, "edit");
    setMutationTarget(student.id);
    window.setTimeout(() => {
      document.getElementById("placement-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("kelas_marhalah")?.focus();
    }, 120);
  }

  function handleCombinedFilter(value: string) {
    if (value.startsWith("status:")) {
      setStatusFilter(value.slice("status:".length) as StatusFilter);
      setFilters((current) => ({ ...current, konsulat: "Semua konsulat" }));
      return;
    }
    setFilters((current) => ({ ...current, konsulat: value.slice("konsulat:".length) }));
    setStatusFilter("semua");
  }

  async function loadDocumentUrls(student: Student) {
    const supabase = createClient();
    const [kkResult, aktaResult] = await Promise.all([
      student.berkas_kk_path ? supabase.storage.from("santri-berkas").createSignedUrl(student.berkas_kk_path, 3600) : Promise.resolve({ data: null, error: null }),
      student.berkas_akta_path ? supabase.storage.from("santri-berkas").createSignedUrl(student.berkas_akta_path, 3600) : Promise.resolve({ data: null, error: null }),
    ]);
    for (const result of [kkResult, aktaResult]) {
      if (result.error) console.error("Failed to create a signed URL for santri documents.", { studentId: student.id, message: result.error.message });
    }
    setDocumentUrls((current) => ({
      ...current,
      [student.id]: { kk: kkResult.data?.signedUrl ?? null, akta: aktaResult.data?.signedUrl ?? null },
    }));
  }

  async function uploadAvatar(file: File, studentId: string) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("Foto harus berupa gambar dengan ukuran maksimal 5 MB.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${studentId}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("santri-avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("santri-avatars").getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  }

  async function uploadDocument(file: File, studentId: string, kind: "kk" | "akta") {
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error("Berkas harus PDF/JPG/PNG/WebP dengan ukuran maksimal 10 MB.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${studentId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await createClient().storage.from("santri-berkas").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    if (isSaving || editorMode === "detail") return;
    setIsSaving(true);
    setMessage("");
    const data = new FormData(form);
    const genderValue = String(data.get("jenis_kelamin") ?? "");
    const gender: SantriGender | null = genderValue === "L" || genderValue === "P" ? genderValue : null;
    if (!gender) {
      setMessage("Pilih jenis kelamin yang valid.");
      setIsSaving(false);
      return;
    }
    const values = {
      nama_lengkap: String(data.get("nama_lengkap") ?? "").trim(),
      nik: String(data.get("nik") ?? "").trim() || null,
      tempat_lahir: String(data.get("tempat_lahir") ?? "").trim() || null,
      tanggal_lahir: String(data.get("tanggal_lahir") ?? "").trim() || null,
      jenis_kelamin: gender,
      konsulat: String(data.get("konsulat") ?? "").trim() || null,
      alamat_domisili: String(data.get("alamat_domisili") ?? "").trim() || null,
      nama_wali: String(data.get("nama_wali") ?? "").trim() || null,
      no_hp_wali: String(data.get("no_hp_wali") ?? "").trim() || null,
      pekerjaan_wali: String(data.get("pekerjaan_wali") ?? "").trim() || null,
      nama_ayah: String(data.get("nama_ayah") ?? "").trim() || null,
      nama_ibu: String(data.get("nama_ibu") ?? "").trim() || null,
      cita_cita: String(data.get("cita_cita") ?? "").trim() || null,
      riwayat_kesehatan: String(data.get("riwayat_kesehatan") ?? "").trim() || null,
      kelas_marhalah: String(data.get("kelas_marhalah") ?? "").trim() || null,
      kamar_asrama: String(data.get("kamar_asrama") ?? "").trim() || null,
    };
    const supabase = createClient();
    const studentId = selectedStudent?.id ?? crypto.randomUUID();
    const uploadedObjects: { bucket: "santri-avatars" | "santri-berkas"; path: string }[] = [];
    try {
      const existing = selectedStudent;
      const croppedAvatar = avatarFile ? await cropAvatar(avatarFile, avatarFocusY, avatarZoom) : null;
      const uploadedPhoto = croppedAvatar ? await uploadAvatar(croppedAvatar, studentId) : null;
      const photoUrl = uploadedPhoto?.publicUrl ?? existing?.foto_url ?? null;
      if (uploadedPhoto) uploadedObjects.push({ bucket: "santri-avatars", path: uploadedPhoto.path });
      const kkPath = kkFile ? await uploadDocument(kkFile, studentId, "kk") : existing?.berkas_kk_path ?? null;
      if (kkFile && kkPath) uploadedObjects.push({ bucket: "santri-berkas", path: kkPath });
      const aktaPath = aktaFile ? await uploadDocument(aktaFile, studentId, "akta") : existing?.berkas_akta_path ?? null;
      if (aktaFile && aktaPath) uploadedObjects.push({ bucket: "santri-berkas", path: aktaPath });
      const payload: StudentInsert = {
        ...values,
        id: studentId,
        ...(existing ? {} : { status: "aktif" }),
        foto_url: photoUrl,
        berkas_kk_path: kkPath,
        berkas_akta_path: aktaPath,
      };
      const result = existing
        ? await supabase.from("santri").update(payload).eq("id", existing.id).select(studentColumns).single()
        : await supabase.from("santri").insert(payload).select(studentColumns).single();
      if (result.error) throw result.error;
      const savedStudent = result.data;
      setStudents((current) => existing
        ? current.map((student) => student.id === savedStudent.id ? savedStudent : student)
        : [...current, savedStudent].sort((first, second) => first.nama_lengkap.localeCompare(second.nama_lengkap)));
      setMessage(existing
        ? `Data ${savedStudent.nama_lengkap} berhasil diperbarui.`
        : `${savedStudent.nama_lengkap} tersimpan dengan NIS otomatis ${savedStudent.nis ?? "belum tersedia"}.`);
      form.reset();
      setEditorMode(null);
      setMutationTarget(null);
    } catch (error) {
      console.error("Failed to save santri.", { studentId, error });
      for (const object of uploadedObjects) {
        const { error: cleanupError } = await supabase.storage.from(object.bucket).remove([object.path]);
        if (cleanupError) console.error("Failed to clean up an uploaded santri file.", { object, cleanupError });
      }
      setMessage(error instanceof Error ? `Data santri gagal disimpan: ${error.message}` : "Data santri gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`Hapus data ${student.nama_lengkap} (${student.nis})?`)) return;
    const { error } = await createClient().from("santri").delete().eq("id", student.id);
    if (error) {
      console.error("Failed to delete santri.", { studentId: student.id, code: error.code, message: error.message, details: error.details, hint: error.hint });
      setMessage(error.code === "23503"
        ? `Data ${student.nama_lengkap} belum dapat dihapus karena masih direferensikan oleh data lain. Periksa kebijakan ON DELETE CASCADE dan constraint terkait. (${error.message})`
        : `Data ${student.nama_lengkap} gagal dihapus: ${error.message}`);
      return;
    }
    setStudents((current) => current.filter((item) => item.id !== student.id));
    setMessage(`Data ${student.nama_lengkap} telah dihapus.`);
  }

  async function reviewApplicant(applicant: Applicant, approve: boolean) {
    const supabase = createClient();
    if (!approve) {
      if (!window.confirm(`Hapus pendaftaran ${applicant.nama_lengkap}? Tindakan ini tidak dapat dibatalkan.`)) return;
      const { error } = await supabase.from("santri").delete().eq("id", applicant.id).eq("status", "pending_ppdb");
      if (error) {
        console.error("Failed to remove rejected pending santri.", { santriId: applicant.id, code: error.code, message: error.message, details: error.details, hint: error.hint });
        setMessage(`Pendaftaran gagal dihapus: ${error.message}`);
        return;
      }
      setApplicants((current) => current.filter((item) => item.id !== applicant.id));
      setApprovalTarget(null);
      setMessage(`Pendaftaran ${applicant.nama_lengkap} dihapus dari antrean.`);
      const storedPaths = [applicant.berkas_kk_path, applicant.berkas_akta_path].filter((path): path is string => Boolean(path));
      if (storedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from("santri-berkas").remove(storedPaths);
        if (cleanupError) {
          console.error("Rejected PPDB files could not be removed from storage.", { santriId: applicant.id, cleanupError });
          setMessage((current) => `${current} Berkas di penyimpanan perlu dihapus manual.`);
        }
      }
      return;
    }
    if (!approvalClass.trim() || !approvalRoom.trim()) {
      setMessage("Tentukan kelas dan kamar sebelum menyetujui calon santri.");
      return;
    }
    setIsSaving(true);
    let generatedNis: string | null = null;
    let linkedGuardianName: string | null = null;
    try {
      const guardianPhone = normalizePhone(applicant.no_hp_wali ?? "");
      let parentId: string | null = null;
      if (guardianPhone) {
        const { data: guardians, error: guardianError } = await supabase
          .from("profiles")
          .select("id, nama_lengkap, no_hp")
          .eq("role", "wali_santri");
        if (guardianError) {
          console.error("Failed to find a wali profile by phone number before PPDB approval.", {
            santriId: applicant.id,
            code: guardianError.code,
            message: guardianError.message,
            details: guardianError.details,
            hint: guardianError.hint,
          });
          throw new Error(`Pencocokan akun wali gagal: ${guardianError.message}`);
        }
        const matches = (guardians ?? []).filter(
          (guardian) => normalizePhone(guardian.no_hp ?? "") === guardianPhone,
        );
        if (matches.length === 1) {
          parentId = matches[0].id;
          linkedGuardianName = matches[0].nama_lengkap;
        } else if (matches.length > 1) {
          console.warn("More than one wali profile has the applicant's normalized phone number; no parent account was linked.", {
            santriId: applicant.id,
            matchingProfileIds: matches.map((guardian) => guardian.id),
          });
        }
      }

      const result = await supabase.rpc("approve_ppdb_pendaftar", {
        p_santri_id: applicant.id,
        p_class: approvalClass.trim(),
        p_room: approvalRoom.trim(),
      });
      generatedNis = result.data;
      if (result.error) throw result.error;

      if (parentId) {
        const { error: linkError } = await supabase
          .from("santri")
          .update({ parent_id: parentId })
          .eq("id", applicant.id);
        if (linkError) {
          console.error("Santri was approved but the matching wali profile could not be linked.", {
            santriId: applicant.id,
            parentId,
            code: linkError.code,
            message: linkError.message,
            details: linkError.details,
            hint: linkError.hint,
          });
          linkedGuardianName = null;
          setMessage(`Santri berhasil disetujui, tetapi akun wali cocok dan gagal ditautkan: ${linkError.message}`);
        }
      }
    } catch (error) {
      console.error("Failed to approve pending santri.", { santriId: applicant.id, error });
      setMessage(`Persetujuan calon santri gagal: ${error instanceof Error ? error.message : "kesalahan Supabase"}`);
      return;
    } finally {
      setIsSaving(false);
    }
    setApplicants((current) => current.filter((item) => item.id !== applicant.id));
    setApprovalTarget(null);
    setApprovalClass("");
    setApprovalRoom("");
    setMessage((current) => current.startsWith("Santri berhasil disetujui, tetapi akun wali")
      ? current
      : `${applicant.nama_lengkap} disetujui sebagai santri dengan NIS ${generatedNis ?? "—"}.${linkedGuardianName ? ` Terhubung ke akun wali ${linkedGuardianName}.` : applicant.no_hp_wali ? " Akun wali belum ditemukan atau nomornya tidak unik; parent_id dibiarkan kosong." : ""}`);
    setReloadToken((current) => current + 1);
  }

  function exportStudents() {
    const rows = [
      exportColumns.map((column) => column.label),
      ...students.map((student) => exportColumns.map(({ key }) => {
        const value = student[key];
        return key === "created_at" && value ? String(value).slice(0, 10) : String(value ?? "");
      })),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = exportColumns.map((column) => ({ wch: Math.min(Math.max(column.label.length + 3, 16), 32) }));
    styleHeader(sheet, exportColumns.length);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Data Santri");
    XLSX.writeFile(workbook, `data-santri-nurul-albab-${todayFileDate()}.xlsx`);
  }

  function downloadTemplate() {
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet([templateHeaders, Array(templateHeaders.length).fill("")]);
    dataSheet["!cols"] = [30, 20, 22, 20, 20, 24, 38, 28, 20, 28].map((wch) => ({ wch }));
    styleHeader(dataSheet, templateHeaders.length);
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Data Santri");
    const guideRows = [
      ["PANDUAN IMPOR DATA SANTRI"],
      ["Pondok Pesantren Nurul Albab"],
      [],
      ["Kolom", "Petunjuk pengisian"],
      ["Nama Lengkap", "Nama santri sesuai dokumen resmi."],
      ["NIK", "16 digit NIK; isi tanpa tanda petik."],
      ["Jenis Kelamin (L/P)", "Isi L untuk laki-laki atau P untuk perempuan."],
      ["Kelas dan Kamar", "Isi penempatan santri; NIS dibuat otomatis oleh sistem."],
      ["Tanggal Lahir (YYYY-MM-DD)", "Opsional. Gunakan format tahun-bulan-tanggal, contoh 2012-08-17."],
      ["No HP WA", "Gunakan nomor yang dapat dihubungi, contoh 081234567890."],
      ["Domisili dan Konsulat", "Gunakan alamat lengkap serta nama konsulat/daerah asal."],
      [],
      ["Contoh data"],
      ["Ahmad Fulan", "3201012345678901", "L", "Wustha 1", "Al-Farabi 1", "Konsulat Jakarta", "Jl. Contoh No. 1, Jakarta", "Bapak Fulan", "081234567890", "2012-08-17"],
    ];
    const guide = XLSX.utils.aoa_to_sheet(guideRows);
    guide["!cols"] = [{ wch: 34 }, { wch: 84 }, ...Array.from({ length: 8 }, () => ({ wch: 22 }))];
    guide["A1"].s = { font: { bold: true, color: { rgb: "4457FF" }, sz: 16 } };
    guide["A4"].s = headerStyle;
    guide["B4"].s = headerStyle;
    for (let column = 0; column < templateHeaders.length; column += 1) {
      const cell = XLSX.utils.encode_cell({ r: 13, c: column });
      if (guide[cell]) guide[cell].s = { fill: { fgColor: { rgb: "EEF0FF" } } };
    }
    XLSX.utils.book_append_sheet(workbook, guide, "Panduan");
    XLSX.writeFile(workbook, "template-impor-santri-nurul-albab.xlsx");
  }

  async function importStudents(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Berkas Excel tidak memiliki lembar data.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false })
        .filter((row) => row.some((cell) => String(cell).trim()));
      const rawHeaders = rows.shift()?.map((header) => String(header).trim().toLocaleLowerCase("id-ID")) ?? [];
      const headers = rawHeaders.map((header) => headerAliases[header] ?? header);
      const missing = templateKeys.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(", ")}.`);
      const inserts: StudentInsert[] = rows.map((row, index) => {
        const record: Record<string, string> = {};
        headers.forEach((header, column) => {
          record[header] = String(row[column] ?? "").trim();
        });
        const rawGender = (record.jenis_kelamin ?? "").toUpperCase();
        const gender = rawGender === "L" || rawGender === "LAKI-LAKI" || rawGender === "LAKI_LAKI" ? "L" : rawGender === "P" || rawGender === "PEREMPUAN" ? "P" : null;
        const name = record.nama_lengkap ?? "";
        if (!name || !gender) throw new Error(`Baris ${index + 2}: nama dan jenis kelamin (L/P) wajib valid.`);
        const status = String(record.status || "aktif").toLowerCase();
        if (!["aktif", "cuti", "alumni", "pindah"].includes(status)) throw new Error(`Baris ${index + 2}: status harus aktif, cuti, alumni, atau pindah.`);
        const birthDate = record.tanggal_lahir || null;
        if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new Error(`Baris ${index + 2}: tanggal lahir harus berformat YYYY-MM-DD.`);
        return {
          nama_lengkap: name,
          nisn: record.nisn || null,
          nik: record.nik || null,
          tempat_lahir: record.tempat_lahir || null,
          tanggal_lahir: birthDate,
          jenis_kelamin: gender,
          konsulat: record.konsulat || null,
          alamat_domisili: record.alamat_domisili || null,
          kamar_asrama: record.kamar_asrama || null,
          kelas_marhalah: record.kelas_marhalah || null,
          nama_wali: record.nama_wali || null,
          no_hp_wali: record.no_hp_wali || null,
          pekerjaan_wali: record.pekerjaan_wali || null,
          status,
        };
      });
      if (!inserts.length) throw new Error("Berkas Excel tidak berisi data santri.");
      const { data, error } = await createClient().from("santri").insert(inserts).select(studentColumns);
      if (error) throw error;
      setStudents((current) => [...current, ...(data ?? [])].sort((first, second) => first.nama_lengkap.localeCompare(second.nama_lengkap)));
      setMessage(`${data?.length ?? 0} data santri berhasil diimpor. NIS dibuat otomatis oleh database.`);
      setImportOpen(false);
    } catch (error) {
      console.error("Failed to import santri Excel workbook.", error);
      setMessage(error instanceof Error ? `Impor gagal: ${error.message}` : "Impor Excel gagal.");
    }
  }

  async function openPendingQueue() {
    setPendingOpen(true);
    await Promise.all(applicants.map((student) => loadDocumentUrls(student)));
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Data & akademik"
        title="Data induk santri"
        description="Kelola biodata, penempatan, dan antrean calon santri dalam satu ruang kerja."
        action={<div className="flex flex-wrap gap-2"><button type="button" onClick={exportStudents} className="min-h-11 rounded-full border border-[#e5e7eb] bg-white px-4 text-xs font-semibold transition hover:border-[#cbd0ff] hover:text-[#4457ff]">Ekspor</button><button type="button" onClick={() => setImportOpen(true)} className="min-h-11 rounded-full border border-[#e5e7eb] bg-white px-4 text-xs font-semibold transition hover:border-[#cbd0ff] hover:text-[#4457ff]">Impor</button><PrimaryButton onClick={openCreate}><Icon name="plus" size={17} /> Tambah santri</PrimaryButton></div>}
      />
      {message && <FormMessage success={message.includes("berhasil") || message.includes("disetujui")}>{message}</FormMessage>}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total santri" value={String(students.length)} detail="Data induk terdaftar" icon="users" />
        <MetricCard label="Santri aktif" value={String(activeCount)} detail="Status aktif saat ini" icon="check" tone="bg-[#e8f5f0] text-[#25815e]" />
        <button type="button" onClick={() => void openPendingQueue()} className="rounded-3xl text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4457ff]"><MetricCard label="Calon santri (PPDB pending)" value={String(applicants.length)} detail="Buka antrean untuk verifikasi" icon="clock" tone="bg-[#fff4e7] text-[#bd7627]" /></button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800">Daftar santri</h2>
              <p className="mt-1 text-xs text-slate-500">
                Cari nama, NIS, konsulat, domisili, kelas, kamar, atau status.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{filtered.length}</span> dari{" "}
              {students.length} santri
            </p>
          </div>

          <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block sm:col-span-2 lg:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Cari nama / NIS</span>
              <span className="relative block">
                <Icon
                  name="search"
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama, NIS, atau domisili…"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10"
                />
              </span>
            </label>
            <Field
              label="Kelas"
              name="filterClass"
              value={filters.kelas}
              onChange={(kelas) => setFilters((current) => ({ ...current, kelas }))}
            >
              <option>Semua kelas</option>
              {classOptions.map((value) => <option key={value}>{value}</option>)}
            </Field>
            <Field
              label="Kamar"
              name="filterRoom"
              value={filters.kamar}
              onChange={(kamar) => setFilters((current) => ({ ...current, kamar }))}
            >
              <option>Semua kamar</option>
              {roomOptions.map((value) => <option key={value}>{value}</option>)}
            </Field>
            <Field
              label="Konsulat / status"
              name="filterConsulate"
              value={combinedFilterValue}
              onChange={handleCombinedFilter}
            >
              <option value="konsulat:Semua konsulat">Semua konsulat</option>
              {consulateOptions.map((value) => (
                <option key={`konsulat:${value}`} value={`konsulat:${value}`}>
                  {value}
                </option>
              ))}
              <optgroup label="Status santri">
                <option value="status:aktif">Aktif</option>
                <option value="status:lulus">Lulus / Mutamakhrij</option>
                <option value="status:izin">Izin / Tidak aktif</option>
                <option value="status:pindah">Pindah</option>
              </optgroup>
            </Field>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    Santri
                    <button
                      type="button"
                      aria-label={sortOrder === "name-asc" ? "Urutkan nama Z ke A" : "Urutkan nama A ke Z"}
                      title={sortOrder === "name-asc" ? "Urutkan Z–A" : "Urutkan A–Z"}
                      onClick={() => setSortOrder((current) => current === "name-asc" ? "name-desc" : "name-asc")}
                      className="flex size-7 items-center justify-center rounded-lg text-[#4457ff] transition hover:bg-[#eef0ff]"
                    >
                      <span aria-hidden="true" className="text-sm">{sortOrder === "name-asc" ? "↑" : "↓"}</span>
                    </button>
                  </span>
                </th>
                <th className="px-5 py-3 font-semibold">Gender</th>
                <th className="px-5 py-3 font-semibold">Kelas &amp; kamar</th>
                <th className="px-5 py-3 font-semibold">Konsulat / domisili</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const status = studentStatusMeta(student.status);
                return (
                  <tr key={student.id} className="border-b border-slate-100 align-middle transition last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openEditor(student, "detail")}
                        className="group flex min-w-0 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4457ff]"
                      >
                        <StudentAvatar name={student.nama_lengkap} src={student.foto_url} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-[#4457ff]">
                            {student.nama_lengkap}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] tabular-nums text-slate-500">
                            NIS {student.nis ?? "—"} · {student.nik ? `NIK ${student.nik}` : "NIK belum diisi"}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{genderLabel(student.jenis_kelamin)}</td>
                    <td className="px-5 py-4">
                      <span className="block text-xs font-semibold text-slate-700">
                        {student.kelas_marhalah || "Kelas belum diatur"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {student.kamar_asrama || "Kamar belum diatur"}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      <span className="block truncate text-xs font-medium text-slate-700">
                        {student.konsulat || "—"}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {student.alamat_domisili || "Domisili belum diisi"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.tone}`}>
                        <span className={`size-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditor(student, "detail")}
                          className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditor(student, "edit")}
                          className="min-h-9 rounded-lg bg-[#eef0ff] px-2.5 text-[11px] font-semibold text-[#4457ff] transition hover:bg-[#dbeafe]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openMutation(student)}
                          className="min-h-9 rounded-lg border border-emerald-200/70 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Mutasi
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus ${student.nama_lengkap}`}
                          title={`Hapus ${student.nama_lengkap}`}
                          onClick={() => void deleteStudent(student)}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    Tidak ada data yang sesuai pencarian atau filter.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    Memuat data santri…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 px-4 pb-4 md:hidden">
          {filtered.map((student) => {
            const status = studentStatusMeta(student.status);
            return (
              <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={`Lihat biodata ${student.nama_lengkap}`}
                    onClick={() => openEditor(student, "detail")}
                    className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4457ff]"
                  >
                    <StudentAvatar name={student.nama_lengkap} src={student.foto_url} size="size-12" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openEditor(student, "detail")}
                          className="break-words text-left text-sm font-bold text-slate-800 hover:text-[#4457ff]"
                        >
                          {student.nama_lengkap}
                        </button>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                          NIS {student.nis ?? "belum ada"}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.tone}`}>
                        <span className={`size-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="min-w-0">
                        <dt className="text-slate-400">Kelas</dt>
                        <dd className="mt-0.5 truncate font-semibold text-slate-700">{student.kelas_marhalah || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-slate-400">Kamar</dt>
                        <dd className="mt-0.5 truncate font-semibold text-slate-700">{student.kamar_asrama || "—"}</dd>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <dt className="text-slate-400">Konsulat / domisili</dt>
                        <dd className="mt-0.5 break-words font-medium text-slate-700">
                          {student.konsulat || "—"} · {student.alamat_domisili || "Domisili belum diisi"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditor(student, "detail")}
                        className="min-h-10 rounded-full border border-slate-200 px-4 text-xs font-semibold text-slate-600"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(student, "edit")}
                        className="min-h-10 rounded-full bg-[#eef0ff] px-4 text-xs font-semibold text-[#4457ff]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openMutation(student)}
                        className="min-h-10 rounded-full border border-emerald-200/70 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700"
                      >
                        Mutasi
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteStudent(student)}
                        className="min-h-10 rounded-full border border-rose-200/70 px-4 text-xs font-semibold text-rose-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {!filtered.length && !isLoading && (
            <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Tidak ada data yang cocok.
            </p>
          )}
          {isLoading && (
            <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Memuat data santri…
            </p>
          )}
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">
          {filtered.length} dari {students.length} santri
        </p>
      </section>

      {editorMode && (
        <div className="backdrop-enter fixed inset-0 z-50 flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-[2px] transition sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setEditorMode(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="student-editor-heading" className="modal-enter-up max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#4457ff]">{editorMode === "create" ? "Data santri" : editorMode === "edit" ? "Perbarui data" : "Profil santri"}</p><h2 id="student-editor-heading" className="mt-1 text-xl font-bold">{editorMode === "create" ? "Tambah santri" : selectedStudent?.nama_lengkap}</h2>{selectedStudent && <p className="mt-1 text-xs text-[#757693]">NIS {selectedStudent.nis}</p>}</div><button type="button" onClick={() => setEditorMode(null)} aria-label="Tutup" className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={17} /></button></div>
            {editorMode === "detail" && selectedStudent ? <div className="mt-6 space-y-6"><div className="grid gap-5 sm:grid-cols-[180px_1fr]"><div className="space-y-3">{selectedStudent.foto_url ? <a href={selectedStudent.foto_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-[#f8f9ff]">            <NextImage src={selectedStudent.foto_url} alt={`Foto ${selectedStudent.nama_lengkap}`} width={640} height={640} unoptimized className="max-h-64 w-full object-contain" /></a> : <StudentAvatar name={selectedStudent.nama_lengkap} src={null} size="size-28" />}<p className="text-center text-[10px] text-[#8a8ba2]">Foto profil · klik untuk resolusi penuh</p></div><dl className="grid gap-4 text-xs sm:grid-cols-2">{[["NIS", selectedStudent.nis], ["Jenis kelamin", genderLabel(selectedStudent.jenis_kelamin)], ["NIK", selectedStudent.nik], ["Tempat, tanggal lahir", `${selectedStudent.tempat_lahir || "—"}, ${selectedStudent.tanggal_lahir || "—"}`], ["Konsulat", selectedStudent.konsulat], ["Domisili", selectedStudent.alamat_domisili], ["Kelas & kamar", `${selectedStudent.kelas_marhalah || "—"} · ${selectedStudent.kamar_asrama || "—"}`], ["Ayah / ibu", `${selectedStudent.nama_ayah || "—"} / ${selectedStudent.nama_ibu || "—"}`], ["WhatsApp wali", selectedStudent.no_hp_wali], ["Pekerjaan wali", selectedStudent.pekerjaan_wali], ["Cita-cita", selectedStudent.cita_cita], ["Riwayat kesehatan", selectedStudent.riwayat_kesehatan]].map(([label, value]) => <div key={label}><dt className="text-[#8a8ba2]">{label}</dt><dd className="mt-1 break-words font-semibold">{value || "—"}</dd></div>)}</dl></div><div><h3 className="text-sm font-bold">Berkas santri</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["Kartu keluarga", documentUrls[selectedStudent.id]?.kk], ["Akta kelahiran", documentUrls[selectedStudent.id]?.akta]].map(([label, href]) => <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e5e7eb] p-4"><div><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-[10px] text-[#8a8ba2]">{href ? "Tautan aman aktif selama 1 jam" : "Belum ada berkas"}</p></div>{href ? <a href={href} target="_blank" rel="noreferrer" download className="min-h-10 rounded-full bg-[#eef0ff] px-4 py-2 text-xs font-semibold text-[#4457ff]">Lihat / unduh</a> : <span className="text-xs text-[#a2a3b7]">—</span>}</div>)}</div></div></div> : (
              <form onSubmit={saveStudent} className="mt-6 space-y-6">
                <fieldset disabled={editorMode === "detail"} className="space-y-5">
                  {editorMode === "create" && <p className="rounded-2xl bg-[#f8f9ff] px-4 py-3 text-xs text-[#757693]">NIS dibuat otomatis berdasarkan tahun, jenis kelamin, dan nomor urut setelah data tersimpan.</p>}
                  <div><h3 className="text-sm font-bold">Data diri</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Nama lengkap" name="nama_lengkap" required value={formValues.nama_lengkap} onChange={(value) => setFormValues((current) => ({ ...current, nama_lengkap: value }))} className="sm:col-span-2" /><Field label="NIK" name="nik" value={formValues.nik} onChange={(value) => setFormValues((current) => ({ ...current, nik: value }))} /><Field label="Jenis kelamin" name="jenis_kelamin" required value={formValues.jenis_kelamin} onChange={(value) => setFormValues((current) => ({ ...current, jenis_kelamin: value }))}><option value="">Pilih jenis kelamin</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></Field><Field label="Tempat lahir" name="tempat_lahir" value={formValues.tempat_lahir} onChange={(value) => setFormValues((current) => ({ ...current, tempat_lahir: value }))} /><Field label="Tanggal lahir" name="tanggal_lahir" type="date" value={formValues.tanggal_lahir} onChange={(value) => setFormValues((current) => ({ ...current, tanggal_lahir: value }))} /><Field label="Konsulat / asal" name="konsulat" value={formValues.konsulat} onChange={(value) => setFormValues((current) => ({ ...current, konsulat: value }))} /><Field label="Alamat domisili" name="alamat_domisili" value={formValues.alamat_domisili} onChange={(value) => setFormValues((current) => ({ ...current, alamat_domisili: value }))} className="sm:col-span-2" /><div className="sm:col-span-2"><label className="block text-xs font-semibold text-[#55566f]">Foto profil (JPG/PNG/WebP, maks. 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; setAvatarFile(file); setAvatarPreviewUrl(file ? URL.createObjectURL(file) : ""); setAvatarFocusY(0.5); setAvatarZoom(1); }} className="mt-2 block min-h-11 w-full rounded-xl border border-[#e5e7eb] p-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#eef0ff] file:px-4 file:py-2 file:text-[#4457ff]" /></label>{avatarFile && <div className="mt-4 grid gap-4 rounded-2xl bg-[#f8f9ff] p-4 sm:grid-cols-[112px_1fr]"><div className="size-28 overflow-hidden rounded-2xl bg-[#e8eaff]"><NextImage src={avatarPreviewUrl} alt="Pratinjau foto yang dipilih" width={112} height={112} unoptimized className="size-full object-cover" style={{ objectPosition: `50% ${avatarFocusY * 100}%`, transform: `scale(${avatarZoom})` }} /></div><div className="space-y-4"><label className="block text-xs font-semibold text-[#55566f]">Fokus foto <span className="font-normal text-[#8a8ba2]">({avatarFocusY === 0 ? "Atas" : avatarFocusY === 1 ? "Bawah" : "Tengah"})</span><input type="range" min="0" max="1" step="0.01" value={avatarFocusY} onChange={(event) => setAvatarFocusY(Number(event.target.value))} className="mt-2 block w-full accent-[#4457ff]" /></label><label className="block text-xs font-semibold text-[#55566f]">Zoom <span className="font-normal text-[#8a8ba2]">{avatarZoom.toFixed(1)}×</span><input type="range" min="1" max="2" step="0.05" value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} className="mt-2 block w-full accent-[#4457ff]" /></label><p className="text-[10px] text-[#8a8ba2]">Fokus dan zoom akan dipotong ke foto persegi sebelum diunggah.</p></div></div>}</div></div></div>
                  <div><h3 className="text-sm font-bold">Data orang tua / wali</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Nama orang tua / wali" name="nama_wali" value={formValues.nama_wali} onChange={(value) => setFormValues((current) => ({ ...current, nama_wali: value }))} /><Field label="Nama ayah" name="nama_ayah" value={formValues.nama_ayah} onChange={(value) => setFormValues((current) => ({ ...current, nama_ayah: value }))} /><Field label="Nama ibu" name="nama_ibu" value={formValues.nama_ibu} onChange={(value) => setFormValues((current) => ({ ...current, nama_ibu: value }))} /><Field label="No. HP WhatsApp" name="no_hp_wali" type="tel" value={formValues.no_hp_wali} onChange={(value) => setFormValues((current) => ({ ...current, no_hp_wali: value }))} /><Field label="Pekerjaan" name="pekerjaan_wali" value={formValues.pekerjaan_wali} onChange={(value) => setFormValues((current) => ({ ...current, pekerjaan_wali: value }))} /><Field label="Cita-cita" name="cita_cita" value={formValues.cita_cita} onChange={(value) => setFormValues((current) => ({ ...current, cita_cita: value }))} /><Field label="Riwayat kesehatan / alergi" name="riwayat_kesehatan" value={formValues.riwayat_kesehatan} onChange={(value) => setFormValues((current) => ({ ...current, riwayat_kesehatan: value }))} className="sm:col-span-2" /></div></div>
                  <div id="placement-section" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><h3 className="text-sm font-bold">Penempatan pesantren</h3>{mutationTarget === selectedStudent?.id && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"><Icon name="rotate-ccw" size={13} /> Mode mutasi — ubah kelas atau kamar</p>}<div className="mt-3 grid gap-4 sm:grid-cols-2"><Field id="kelas_marhalah" label="Kelas / marhalah" name="kelas_marhalah" value={formValues.kelas_marhalah} onChange={(value) => setFormValues((current) => ({ ...current, kelas_marhalah: value }))} /><Field label="Kamar asrama" name="kamar_asrama" value={formValues.kamar_asrama} onChange={(value) => setFormValues((current) => ({ ...current, kamar_asrama: value }))} /></div></div>
                  <div><h3 className="text-sm font-bold">Berkas dokumen</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-[#55566f]">Kartu keluarga (PDF/JPG/PNG/WebP, maks. 10 MB)<input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => setKkFile(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full rounded-xl border border-[#e5e7eb] p-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#eef0ff] file:px-4 file:py-2 file:text-[#4457ff]" /></label><label className="block text-xs font-semibold text-[#55566f]">Akta kelahiran (PDF/JPG/PNG/WebP, maks. 10 MB)<input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => setAktaFile(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full rounded-xl border border-[#e5e7eb] p-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#eef0ff] file:px-4 file:py-2 file:text-[#4457ff]" /></label></div>{(selectedStudent?.berkas_kk_path || selectedStudent?.berkas_akta_path) && <p className="mt-2 text-[10px] text-[#757693]">Dokumen yang ada akan dipertahankan jika tidak diganti.</p>}</div>
                </fieldset>
                {message && <FormMessage>{message}</FormMessage>}
                <div className="flex justify-end gap-2 border-t border-[#f0f0f5] pt-4"><button type="button" onClick={() => setEditorMode(null)} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold">Tutup</button>{editorMode !== "detail" && <PrimaryButton type="submit" disabled={isSaving}>{isSaving ? "Menyimpan…" : "Simpan data"}</PrimaryButton>}</div>
              </form>
            )}
          </section>
        </div>
      )}

      {importOpen && <div className="backdrop-enter fixed inset-0 z-50 flex items-end justify-center bg-[#181c31]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="import-heading" className="modal-enter-up w-full max-w-xl rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#4457ff]">Data santri</p><h2 id="import-heading" className="mt-1 text-xl font-bold">Impor Excel</h2></div><button type="button" onClick={() => setImportOpen(false)} aria-label="Tutup impor" className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={17} /></button></div><div className="mt-5 rounded-2xl bg-[#f8f9ff] p-4 text-xs leading-5 text-[#757693]"><p className="font-semibold text-[#181c31]">Template resmi XLSX</p><p className="mt-1">Lembar Data Santri memuat nama, NIK, gender L/P, kelas, kamar, konsulat, domisili, nama wali, No HP WA, dan tanggal lahir YYYY-MM-DD. Lembar Panduan berisi instruksi dan contoh.</p><p className="mt-2">NIS dibuat otomatis oleh sistem. Simpan file sebagai .xlsx sebelum mengimpor.</p></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={downloadTemplate} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-xs font-semibold transition hover:border-[#cbd0ff] hover:text-[#4457ff]">Unduh template Excel</button><button type="button" onClick={() => importRef.current?.click()} className="min-h-11 rounded-full bg-[#eef0ff] px-5 text-xs font-semibold text-[#4457ff]">Pilih berkas .xlsx</button><input ref={importRef} type="file" accept=".xlsx,.xls" onChange={(event) => void importStudents(event)} className="sr-only" /></div>{message && <div className="mt-4"><FormMessage success={message.includes("berhasil")}>{message}</FormMessage></div>}</section></div>}

      {pendingOpen && <div className="backdrop-enter fixed inset-0 z-50 flex justify-end bg-[#181c31]/35 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPendingOpen(false); setApprovalTarget(null); } }}><aside role="dialog" aria-modal="true" aria-labelledby="ppdb-queue-heading" className="drawer-enter h-full w-full max-w-xl overflow-y-auto bg-white p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#4457ff]">Verifikasi pendaftaran</p><h2 id="ppdb-queue-heading" className="mt-1 text-xl font-bold">Calon santri pending</h2><p className="mt-1 text-xs text-[#757693]">{applicants.length} pendaftaran menunggu keputusan</p></div><button type="button" onClick={() => { setPendingOpen(false); setApprovalTarget(null); }} aria-label="Tutup antrean" className="flex size-10 items-center justify-center rounded-full hover:bg-[#f3f5ff]"><Icon name="close" size={17} /></button></div><div className="mt-6 space-y-3">{applicants.map((applicant) => <article key={applicant.id} className="rounded-3xl border border-[#e5e7eb] p-4 transition hover:border-[#cbd0ff]"><div className="flex items-start gap-3"><StudentAvatar name={applicant.nama_lengkap} src={applicant.foto_url} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{applicant.nama_lengkap}</h3><StatusBadge label="Pending PPDB" tone="bg-[#fff4e7] text-[#a6641c]" /></div><p className="mt-1 break-words text-[11px] text-[#757693]">NISN {applicant.nisn || "—"} · NIK {applicant.nik || "—"} · {genderLabel(applicant.jenis_kelamin)}</p><p className="mt-2 text-xs text-[#55566f]">{applicant.tempat_lahir || "Tempat lahir —"}, {applicant.tanggal_lahir || "Tanggal lahir —"} · {applicant.konsulat || "Asal belum diisi"}</p><p className="mt-1 break-words text-xs text-[#757693]">{applicant.nama_ayah || "—"} / {applicant.nama_ibu || "—"} · {applicant.pekerjaan_wali || "Pekerjaan —"} · {applicant.no_hp_wali || "WhatsApp —"}</p><p className="mt-2 break-words text-xs text-[#757693]">{applicant.alamat_domisili || "Domisili belum diisi"}</p>{applicant.cita_cita && <p className="mt-1 text-[11px] text-[#8a8ba2]">Cita-cita: {applicant.cita_cita}</p>}{applicant.riwayat_kesehatan && <p className="mt-1 text-[11px] text-[#a6641c]">Riwayat kesehatan: {applicant.riwayat_kesehatan}</p>}<div className="mt-3 grid gap-2 sm:grid-cols-2">{[["Kartu keluarga", documentUrls[applicant.id]?.kk], ["Akta kelahiran", documentUrls[applicant.id]?.akta]].map(([label, href]) => <div key={label} className="flex items-center justify-between gap-2 rounded-xl bg-[#f8f9ff] px-3 py-2"><span className="text-[10px] font-medium">{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer" download className="text-[10px] font-semibold text-[#4457ff]">Lihat / unduh</a> : <span className="text-[10px] text-[#a2a3b7]">Belum ada</span>}</div>)}</div>{approvalTarget?.id === applicant.id ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Kelas / marhalah" name="approvalClass" value={approvalClass} onChange={setApprovalClass} required /><Field label="Kamar asrama" name="approvalRoom" value={approvalRoom} onChange={setApprovalRoom} required /><div className="flex flex-wrap gap-2 sm:col-span-2"><PrimaryButton disabled={isSaving} onClick={() => void reviewApplicant(applicant, true)}>{isSaving ? "Memproses…" : "Setujui & buat NIS"}</PrimaryButton><button type="button" onClick={() => setApprovalTarget(null)} className="min-h-11 rounded-full border border-[#e5e7eb] px-4 text-xs font-semibold">Batal</button></div></div> : <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setApprovalTarget(applicant); setApprovalClass(""); setApprovalRoom(""); setMessage(""); }} className="min-h-10 rounded-full bg-[#eef0ff] px-4 text-xs font-semibold text-[#4457ff]">Verifikasi & ACC</button><button type="button" onClick={() => void reviewApplicant(applicant, false)} className="min-h-10 rounded-full border border-[#f2d3d3] px-4 text-xs font-semibold text-[#b74444]">Tolak & hapus</button></div>}</div></div></article>)}{!applicants.length && <p className="rounded-3xl bg-[#f8f9ff] p-6 text-center text-xs text-[#757693]">Tidak ada pendaftaran pending.</p>}</div>{message && <div className="mt-4"><FormMessage>{message}</FormMessage></div>}</aside></div>}
    </div>
  );
}
