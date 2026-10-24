"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { Field, FormMessage, MetricCard, PageHeading, PillTabs, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import { getJuzProgress, getSurah, QURAN_SURAHS } from "@/lib/quran";
import type { Database, JournalPredikat } from "@/types/database";

type Pillar = Database["public"]["Tables"]["jurnal_keilmuan"]["Row"]["kategori_jurnal"];
type Student = Database["public"]["Tables"]["santri"]["Row"];
type Journal = Database["public"]["Tables"]["jurnal_keilmuan"]["Row"];
type Teacher = Database["public"]["Tables"]["profiles"]["Row"];
type JournalInsert = Database["public"]["Tables"]["jurnal_keilmuan"]["Insert"];
type Book = Database["public"]["Tables"]["master_kitab"]["Row"];

const labels: Record<Pillar, string> = {
  sorogan: "Sorogan Kitab Kuning",
  quran: "Hafalan Al-Qur’an",
  matan: "Hafalan Matan Kitab",
};

const pillarOptions = (Object.keys(labels) as Pillar[]).map((value) => ({ value, label: labels[value] }));
const evaluationOptions = [
  { value: "mumtaz", label: "Mumtaz" },
  { value: "jayyid", label: "Jayyid" },
  { value: "dhoif", label: "Dho’if" },
];

function isJournalPredikat(value: string): value is JournalPredikat {
  return value === "mumtaz" || value === "jayyid" || value === "dhoif";
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

type HistoryFilter = "semua" | Pillar;

const historyFilters: { value: HistoryFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "sorogan", label: "Sorogan Kitab" },
  { value: "quran", label: "Tahfidz Al-Qur’an" },
  { value: "matan", label: "Hafalan Matan" },
];

function predikatMeta(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "mumtaz") {
    return { label: "Mumtaz", tone: "border border-sky-200/70 bg-sky-50 text-sky-700" };
  }
  if (normalized === "jayyid_jiddan" || normalized === "jayyidjiddan") {
    return { label: "Jayyid Jiddan", tone: "border border-emerald-200/70 bg-emerald-50 text-emerald-700" };
  }
  if (normalized === "jayyid") {
    return { label: "Jayyid", tone: "border border-indigo-200/70 bg-indigo-50 text-indigo-700" };
  }
  if (normalized === "dhoif" || normalized === "dhaif") {
    return { label: "Dho’if", tone: "border border-amber-200/70 bg-amber-50 text-amber-700" };
  }
  return { label: value ? value.replace(/_/g, " ") : "Tercatat", tone: "border border-slate-200 bg-slate-50 text-slate-600" };
}

function description(journal: Journal) {
  if (journal.kategori_jurnal === "quran") {
    if (journal.surah_awal_number && journal.surah_akhir_number && journal.surah_awal_number !== journal.surah_akhir_number) {
      return `${journal.nama_surat ?? "Al-Qur’an"} · hingga ayat ${journal.ayat_akhir_surat ?? "akhir surat"}`;
    }
    const range = journal.ayat_awal === null ? "" : ` · ayat ${journal.ayat_awal}–${journal.ayat_akhir ?? journal.ayat_awal}`;
    return `${journal.nama_surat ?? "Al-Qur’an"}${range}${journal.juz ? ` · Juz ${journal.juz}` : ""}`;
  }
  if (journal.kategori_jurnal === "matan") {
    const range = journal.cakupan_bacaan ? ` · ${journal.cakupan_bacaan}` : journal.bait_awal === null ? "" : ` · bait ${journal.bait_awal}–${journal.bait_akhir ?? journal.bait_awal}`;
    return `${journal.nama_kitab ?? "Matan"}${range}`;
  }
  return `${journal.nama_kitab ?? "Kitab"}${journal.bab_kajian ? ` · ${journal.bab_kajian}` : ""}`;
}

export default function KeilmuanPage() {
  const [pillar, setPillar] = useState<Pillar>("sorogan");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("semua");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [progressStudentId, setProgressStudentId] = useState("");
  const [selectedSurahNumber, setSelectedSurahNumber] = useState("1");
  const [quranRangeMode, setQuranRangeMode] = useState<"single" | "cross">("single");
  const [startSurahNumber, setStartSurahNumber] = useState("1");
  const [endSurahNumber, setEndSurahNumber] = useState("1");
  const [today, setToday] = useState("");
  const [journalDate, setJournalDate] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAcademicData() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const [studentResult, teacherResult, journalResult, bookResult] = await Promise.all([
          supabase.from("santri").select("*"),
          supabase.from("profiles").select("*").in("role", ["staf", "super_admin"]),
          supabase.from("jurnal_keilmuan").select("*"),
          supabase.from("master_kitab").select("*").eq("is_active", true),
        ]);
        const errors = [
          studentResult.error && { table: "santri", error: studentResult.error },
          teacherResult.error && { table: "profiles", error: teacherResult.error },
          journalResult.error && { table: "jurnal_keilmuan", error: journalResult.error },
          bookResult.error && { table: "master_kitab", error: bookResult.error },
        ].filter((item): item is { table: string; error: NonNullable<typeof studentResult.error> } => Boolean(item));
        for (const item of errors) console.error("Failed to load academic module data.", { table: item.table, code: item.error.code, message: item.error.message, details: item.error.details, hint: item.error.hint });
        if (errors.length) {
          if (active) setMessage(`Data keilmuan gagal dimuat: ${errors.map((item) => item.error.message).join(" · ")}`);
          return;
        }
        if (active) {
          const sortByNameAsc = <T extends { nama_lengkap?: string | null }>(
            rows: T[],
          ): T[] =>
            [...rows].sort(
              (a, b) =>
                String(a.nama_lengkap ?? "").localeCompare(
                  String(b.nama_lengkap ?? ""),
                  "id-ID",
                ),
            );
          const sortByTanggalDesc = <T extends { tanggal?: string | null; created_at?: string | null }>(
            rows: T[],
          ): T[] =>
            [...rows].sort(
              (a, b) =>
                String(b.tanggal ?? b.created_at ?? "").localeCompare(
                  String(a.tanggal ?? a.created_at ?? ""),
                  "id-ID",
                ),
            );
          setStudents(sortByNameAsc(studentResult.data ?? []));
          setTeachers(sortByNameAsc(teacherResult.data ?? []));
          setJournals(sortByTanggalDesc(journalResult.data ?? []));
          setBooks(
            (bookResult.data ?? []).sort(
              (a, b) =>
                String(a.judul ?? "").localeCompare(String(b.judul ?? ""), "id-ID"),
            ),
          );
          setProgressStudentId((current) => current || studentResult.data?.[0]?.id || "");
          const currentDate = todayLocal();
          setToday(currentDate);
          setJournalDate(currentDate);
          setMessage("");
        }
      } catch (error) {
        console.error("Unable to initialize Supabase while loading academic data.", error);
        if (active) setMessage(error instanceof Error ? error.message : "Tidak dapat memuat data keilmuan.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadAcademicData();
    return () => { active = false; };
  }, []);

  const selectedJuz = useMemo(
    () => getJuzProgress(journals.filter((journal) =>
      journal.santri_id === progressStudentId && journal.kategori_jurnal === "quran",
    )),
    [journals, progressStudentId],
  );
  const todayCount = journals.filter((journal) => journal.tanggal === today).length;
  const categoryCount = (category: Pillar) => journals.filter((journal) => journal.kategori_jurnal === category).length;
  const shownJournals = journals.filter((journal) =>
    historyFilter === "semua" ? true : journal.kategori_jurnal === historyFilter,
  );
  const completedHafalan = useMemo(() => {
    const quranJournals = journals.filter((journal) => journal.kategori_jurnal === "quran");
    const studentIds = [...new Set(quranJournals.map((journal) => journal.santri_id))];
    let juzDone = 0;
    for (const studentId of studentIds) {
      juzDone += getJuzProgress(quranJournals.filter((journal) => journal.santri_id === studentId))
        .filter((progress) => progress === 100).length;
    }
    const tasmiDone = journals.filter((journal) => journal.lulus_tasmi === true).length;
    return { juzDone, tasmiDone, total: juzDone + tasmiDone };
  }, [journals]);
  const selectedSurah = getSurah(Number(selectedSurahNumber));
  const soroganBooks = books.filter((book) => book.kategori === "sorogan");
  const matanBooks = books.filter((book) => book.kategori === "matan");

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    if (isSaving) return;
    const data = new FormData(form);
    const studentId = String(data.get("santri_id") ?? "");
    const teacherId = String(data.get("ustadz_id") ?? "");
    const notes = String(data.get("catatan") ?? "").trim();
    const evaluationValue = String(data.get("predikat") ?? "");
    const supabase = createClient();
    setIsSaving(true);
    setMessage("");
    try {
      const { data: authResult, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Sesi pengguna tidak dapat diverifikasi: ${authError.message}`);
      const selectedTeacher = teacherId || authResult.user?.id || null;
      if (!selectedTeacher) throw new Error("Pilih guru pembimbing yang valid.");
      const evaluation: JournalPredikat | null = isJournalPredikat(evaluationValue) ? evaluationValue : null;
      if (evaluationValue && !evaluation) throw new Error("Pilih predikat kelancaran yang valid.");
      if (pillar !== "matan" && !evaluation) throw new Error("Pilih predikat kelancaran yang valid.");
      const common = {
        santri_id: studentId,
        ustadz_id: selectedTeacher,
        master_kitab_id: null,
        tanggal: String(data.get("tanggal") || todayLocal()),
        kategori_jurnal: pillar,
        predikat: evaluation,
        catatan_ustadz: notes || null,
      };
      let entry: JournalInsert;
      if (pillar === "sorogan") {
        const bookId = String(data.get("master_kitab_id") ?? "");
        const book = books.find((item) => item.id === bookId && item.kategori === "sorogan");
        if (!book) throw new Error("Pilih kitab sorogan dari daftar kitab aktif.");
        entry = {
          ...common,
          jenis: "kitab",
          master_kitab_id: book.id,
          nama_kitab: book.judul,
          bab_kajian: String(data.get("bacaan") ?? "").trim() || null,
          kelancaran: null,
        };
      } else if (pillar === "quran") {
        const modeValue = String(data.get("mode_setoran") ?? "");
        if (modeValue !== "ziyadah" && modeValue !== "murojaah") throw new Error("Pilih jenis setoran Al-Qur’an yang valid.");
        let surahStart: number;
        let surahEnd: number;
        let ayatAwal: number;
        let ayatAkhirSurat: number;
        let surahLabel: string;
        if (quranRangeMode === "single") {
          surahStart = Number(data.get("surah_number"));
          surahEnd = surahStart;
          const surah = getSurah(surahStart);
          ayatAwal = Number(data.get("ayat_awal"));
          ayatAkhirSurat = Number(data.get("ayat_akhir"));
          if (!surah || !Number.isInteger(ayatAwal) || ayatAwal < 1 || !Number.isInteger(ayatAkhirSurat) || ayatAkhirSurat < ayatAwal || ayatAkhirSurat > surah.ayahCount) {
            throw new Error(`Surat atau rentang ayat tidak valid. ${surah ? `${surah.name} memiliki maksimal ${surah.ayahCount} ayat.` : ""}`);
          }
          surahLabel = surah.name;
        } else {
          surahStart = Number(data.get("surah_awal_number"));
          surahEnd = Number(data.get("surah_akhir_number"));
          const firstSurah = getSurah(surahStart);
          const lastSurah = getSurah(surahEnd);
          const finalAyahValue = String(data.get("ayat_akhir_surat") ?? "").trim();
          ayatAwal = 1;
          ayatAkhirSurat = finalAyahValue ? Number(finalAyahValue) : lastSurah?.ayahCount ?? 0;
          if (!firstSurah || !lastSurah || surahStart > surahEnd || !Number.isInteger(ayatAkhirSurat) || ayatAkhirSurat < 1 || ayatAkhirSurat > lastSurah.ayahCount) {
            throw new Error("Rentang surat lintas surat tidak valid. Ayat terakhir harus berada dalam batas surat penutup.");
          }
          surahLabel = `${firstSurah.name} – ${lastSurah.name}`;
        }
        entry = {
          ...common,
          jenis: "tahfidz",
          mode_setoran: modeValue,
          nama_surat: surahLabel,
          surah_number: surahStart,
          surah_awal_number: surahStart,
          surah_akhir_number: surahEnd,
          ayat_akhir_surat: ayatAkhirSurat,
          ayat_awal: ayatAwal,
          ayat_akhir: ayatAkhirSurat,
          juz: null,
          kelancaran: null,
        };
      } else {
        const bookId = String(data.get("master_kitab_id") ?? "");
        const book = books.find((item) => item.id === bookId && item.kategori === "matan");
        const coverage = String(data.get("cakupan_bacaan") ?? "").trim();
        if (!book) throw new Error("Pilih kitab matan dari daftar kitab aktif.");
        if (!coverage) throw new Error("Isi rentang bait atau bagian matan yang disetorkan.");
        entry = {
          ...common,
          jenis: "kitab",
          master_kitab_id: book.id,
          nama_kitab: book.judul,
          bab_kajian: null,
          cakupan_bacaan: coverage,
          lulus_tasmi: data.get("lulus_tasmi") === "true",
          kelancaran: null,
        };
      }
      const { data: inserted, error } = await supabase.from("jurnal_keilmuan").insert(entry).select("*").single();
      if (error) {
        console.error("Failed to insert academic journal.", { table: "jurnal_keilmuan", category: pillar, code: error.code, message: error.message, details: error.details, hint: error.hint });
        throw new Error(error.message);
      }
      setJournals((current) => [inserted, ...current]);
      setMessage(`${labels[pillar]} berhasil dicatat.`);
      form.reset();
      setJournalDate(todayLocal());
    } catch (error) {
      console.error("Unable to save academic journal.", error);
      setMessage(error instanceof Error ? error.message : "Jurnal gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  const studentName = (id: string) => students.find((student) => student.id === id)?.nama_lengkap ?? "Santri tidak ditemukan";
  const teacherName = (id: string | null) => teachers.find((teacher) => teacher.id === id)?.nama_lengkap ?? "Guru";

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Data & akademik" title="Jurnal keilmuan" description="Catat perkembangan santri melalui tiga pilar pembelajaran pesantren." />
      {message && <FormMessage success={message.includes("berhasil dicatat")}>{message}</FormMessage>}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Setoran hari ini" value={String(todayCount)} detail="Sorogan, Al-Qur’an, dan matan" icon="book" />
        <MetricCard label="Hafalan selesai / khatam" value={String(completedHafalan.total)} detail={`${completedHafalan.juzDone} juz tuntas · ${completedHafalan.tasmiDone} tasmi’ lulus`} icon="award" tone="bg-[#e8f5f0] text-[#25815e]" />
        <MetricCard label="Total jurnal" value={String(journals.length)} detail="Seluruh catatan tersimpan" icon="chart" tone="bg-[#eef0ff] text-[#4457ff]" />
      </section>

      <section className="rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="text-base font-bold">Pilar pembelajaran</h2><p className="mt-1 text-xs text-[#757693]">Pilih kategori untuk melihat dan menambahkan setoran.</p></div>
          <PillTabs label="Pilar jurnal keilmuan" value={pillar} options={pillarOptions.map((option) => ({ ...option, label: `${option.label} · ${categoryCount(option.value)}` }))} onChange={(value) => { setPillar(value); setMessage(""); }} />
        </div>
      </section>

      {pillar === "quran" && (
        <section className="relative z-0 isolate rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-base font-bold">Matriks hafalan Al-Qur’an</h2><p className="mt-1 text-xs text-[#757693]">Progress dihitung dari ayat unik yang tercatat dalam rentang setiap juz.</p></div><Field label="Santri" name="progressStudent" value={progressStudentId} onChange={setProgressStudentId}><option value="">Pilih santri</option>{students.map((student) => <option key={student.id} value={student.id}>{student.nama_lengkap}</option>)}</Field></div>
          <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-10">{selectedJuz.map((progress, index) => { const juz = index + 1; return <div key={juz} aria-label={`Juz ${juz}, progres ${progress}%`} title={`Juz ${juz}: ${progress}%`} className="relative flex min-h-14 items-center justify-center overflow-hidden rounded-xl border border-[#dfe2f5] bg-[#fafaff] text-xs font-bold text-[#353b79]"><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#7e83ff]/55 to-[#c6c8ff]/50 transition-[height] duration-500" style={{ height: `${progress}%` }} /><span className="relative z-10">Juz {juz}<small className="block text-[9px] font-medium">{progress}%</small></span></div>; })}</div>
          <p className="mt-4 text-[11px] text-[#757693]">{selectedJuz.filter((progress) => progress === 100).length} dari 30 juz tercatat penuh.</p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-12">
        <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6 lg:col-span-5">
          <div><h2 className="text-base font-bold">Form setoran</h2><p className="mt-1 text-xs text-[#757693]">{labels[pillar]} · tersimpan langsung ke Supabase.</p></div>
          <form key={pillar} onSubmit={addEntry} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nama santri" name="santri_id" required><option value="">Pilih santri</option>{students.map((student) => <option key={student.id} value={student.id}>{student.nama_lengkap} · {student.nis}</option>)}</Field>
            <Field label="Guru pembimbing" name="ustadz_id" required><option value="">Pilih guru</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.nama_lengkap}</option>)}</Field>
            <Field label="Tanggal setoran" name="tanggal" type="date" value={journalDate} onChange={setJournalDate} required />
            {pillar === "sorogan" && <>
              <Field label="Judul kitab" name="master_kitab_id" required><option value="">Pilih kitab</option>{soroganBooks.map((book) => <option key={book.id} value={book.id}>{book.judul}{book.pengarang ? ` — ${book.pengarang}` : ""}</option>)}</Field>
              <Field label="Hanca / bab / halaman bacaan" name="bacaan" placeholder="Contoh: Bab Thaharah, halaman 12–15" required className="sm:col-span-2" />
              <Field label="Status kelancaran" name="predikat" required><option value="">Pilih predikat</option>{evaluationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Field>
              <Field label="Catatan adab / pemahaman" name="catatan" placeholder="Catatan guru" />
            </>}
            {pillar === "quran" && <>
              <Field label="Jenis setoran" name="mode_setoran" required><option value="ziyadah">Ziyadah</option><option value="murojaah">Muroja’ah</option></Field>
              <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-[#55566f]">Rentang setoran</legend><div className="mt-2 inline-flex rounded-full bg-[#eef0fa] p-1"><button type="button" aria-pressed={quranRangeMode === "single"} onClick={() => setQuranRangeMode("single")} className={`min-h-9 rounded-full px-4 text-xs font-semibold transition ${quranRangeMode === "single" ? "bg-white text-[#4457ff] shadow-sm" : "text-[#757693]"}`}>Satu Surat</button><button type="button" aria-pressed={quranRangeMode === "cross"} onClick={() => setQuranRangeMode("cross")} className={`min-h-9 rounded-full px-4 text-xs font-semibold transition ${quranRangeMode === "cross" ? "bg-white text-[#4457ff] shadow-sm" : "text-[#757693]"}`}>Lintas Surat</button></div></fieldset>
              {quranRangeMode === "single" ? <>
                <label className="block text-xs font-semibold text-[#55566f] sm:col-span-2">Surat<select name="surah_number" required value={selectedSurahNumber} onChange={(event) => setSelectedSurahNumber(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#181c31] outline-none focus:border-[#4457ff]">{QURAN_SURAHS.map((surah) => <option key={surah.number} value={surah.number}>{surah.number}. {surah.name} · {surah.ayahCount} ayat · Juz {surah.juzStart}{surah.juzEnd !== surah.juzStart ? `–${surah.juzEnd}` : ""}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#55566f]">Ayat awal<input name="ayat_awal" type="number" min={1} max={selectedSurah?.ayahCount} required className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]" /></label>
                <label className="block text-xs font-semibold text-[#55566f]">Ayat akhir<input name="ayat_akhir" type="number" min={1} max={selectedSurah?.ayahCount} required className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]" /><span className="mt-1 block text-[10px] font-normal text-[#8a8ba2]">{selectedSurah?.name}: maksimal {selectedSurah?.ayahCount} ayat</span></label>
              </> : <>
                <label className="block text-xs font-semibold text-[#55566f]">Surat awal<select name="surah_awal_number" required value={startSurahNumber} onChange={(event) => setStartSurahNumber(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]">{QURAN_SURAHS.map((surah) => <option key={surah.number} value={surah.number}>{surah.number}. {surah.name}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#55566f]">Surat akhir<select name="surah_akhir_number" required value={endSurahNumber} onChange={(event) => setEndSurahNumber(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]">{QURAN_SURAHS.map((surah) => <option key={surah.number} value={surah.number}>{surah.number}. {surah.name} · {surah.ayahCount} ayat</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#55566f] sm:col-span-2">Ayat terakhir disetor <span className="font-normal text-[#8a8ba2]">(opsional; kosong berarti surat terakhir tuntas)</span><input name="ayat_akhir_surat" type="number" min={1} max={getSurah(Number(endSurahNumber))?.ayahCount} placeholder={`Maks. ${getSurah(Number(endSurahNumber))?.ayahCount ?? "—"} ayat`} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none focus:border-[#4457ff]" /></label>
              </>}
              <Field label="Predikat kelancaran" name="predikat" required><option value="">Pilih predikat</option>{evaluationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Field>
              <Field label="Catatan guru" name="catatan" placeholder="Tajwid, makhraj, dan catatan lainnya" className="sm:col-span-2" />
            </>}
            {pillar === "matan" && <>
              <Field label="Judul matan / nadhom" name="master_kitab_id" required><option value="">Pilih kitab</option>{matanBooks.map((book) => <option key={book.id} value={book.id}>{book.judul}{book.pengarang ? ` — ${book.pengarang}` : ""}</option>)}</Field>
              <Field label="Status tasmi’" name="lulus_tasmi" required><option value="false">Belum lulus</option><option value="true">Lulus</option></Field>
              <Field label="Rentang bait / bagian" name="cakupan_bacaan" placeholder="Bait 1 - 25 atau Fasal Mabadi s.d. Bab Kalam" required className="sm:col-span-2" />
              <Field label="Predikat" name="predikat"><option value="">Pilih predikat</option>{evaluationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Field>
              <Field label="Catatan guru" name="catatan" placeholder="Catatan hafalan / tasmi’" />
            </>}
            <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={isSaving || students.length === 0 || teachers.length === 0 || ((pillar === "sorogan" && !soroganBooks.length) || (pillar === "matan" && !matanBooks.length))} className="w-full"><Icon name="plus" size={16} />{isSaving ? "Menyimpan…" : "Simpan setoran"}</PrimaryButton>{(!students.length || !teachers.length || ((pillar === "sorogan" && !soroganBooks.length) || (pillar === "matan" && !matanBooks.length))) && !isLoading && <p className="mt-2 text-[11px] text-[#a6641c]">{!students.length ? "Data santri belum tersedia." : !teachers.length ? "Data guru staf belum tersedia di profiles." : "Tambahkan kitab aktif melalui menu Pengaturan Kitab terlebih dahulu."}</p>}</div>
          </form>
        </article>

        <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Riwayat setoran</h2>
              <p className="mt-1 text-xs text-[#757693]">Catatan terbaru ditampilkan lebih dahulu.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[#eef0ff] px-3 py-1 text-[11px] font-semibold text-[#4457ff]">
              <Icon name="activity" size={13} />
              {shownJournals.length} catatan
            </span>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {historyFilters.map((filter) => {
              const active = historyFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setHistoryFilter(filter.value)}
                  className={`min-h-9 shrink-0 rounded-full px-3.5 text-[11px] font-semibold transition ${
                    active
                      ? "bg-[#4457ff] text-white shadow-sm shadow-[#4457ff]/25"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-[#cbd0ff] hover:text-[#4457ff]"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="rounded-2xl bg-slate-50 py-8 text-center text-xs text-slate-500">Memuat jurnal…</p>
            ) : shownJournals.length ? (
              shownJournals.map((journal) => {
                const predikat = predikatMeta(journal.predikat ?? journal.kelancaran);
                return (
                  <article key={journal.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#cbd0ff] hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">{studentName(journal.santri_id)}</p>
                          <StatusBadge label={predikat.label} tone={predikat.tone} />
                        </div>
                        <p className="mt-1 break-words text-xs font-medium text-[#4457ff]">{description(journal)}</p>
                      </div>
                      <time className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium tabular-nums text-slate-500">
                        {dateLabel(journal.tanggal)}
                      </time>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge label={labels[journal.kategori_jurnal]} tone="bg-[#f1f1f5] text-[#55566f]" />
                      {journal.kategori_jurnal === "quran" && journal.mode_setoran && (
                        <StatusBadge
                          label={journal.mode_setoran === "ziyadah" ? "Ziyadah" : "Muroja’ah"}
                          tone="bg-[#eef0ff] text-[#4457ff]"
                        />
                      )}
                      {journal.kategori_jurnal === "matan" && journal.lulus_tasmi !== null && (
                        <StatusBadge
                          label={journal.lulus_tasmi ? "Tasmi’ lulus" : "Belum lulus"}
                          tone={journal.lulus_tasmi ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4e7] text-[#a6641c]"}
                        />
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <Icon name="user" size={12} />
                        {teacherName(journal.ustadz_id)}
                      </span>
                    </div>
                    {journal.catatan_ustadz && (
                      <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                        {journal.catatan_ustadz}
                      </p>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl bg-slate-50 py-8 text-center text-xs text-slate-500">
                Belum ada jurnal untuk filter ini.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
