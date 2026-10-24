"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { FormMessage, PageHeading, PillTabs, PrimaryButton } from "@/components/workspace-ui";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Book = Database["public"]["Tables"]["master_kitab"]["Row"];
type BookCategory = Book["kategori"];
type BookInsert = Database["public"]["Tables"]["master_kitab"]["Insert"];

const categoryOptions = [
  { value: "sorogan", label: "Kitab Sorogan" },
  { value: "matan", label: "Matan Kitab" },
] as const satisfies { value: BookCategory; label: string }[];

export default function PengaturanPage() {
  const [category, setCategory] = useState<BookCategory>("sorogan");
  const [books, setBooks] = useState<Book[]>([]);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBooks() {
      const { data, error } = await createClient().from("master_kitab").select("*");
      if (!active) return;
      if (error) {
        console.error("Failed to load master kitab.", { table: "master_kitab", code: error.code, message: error.message, details: error.details, hint: error.hint });
        setMessage(`Daftar kitab gagal dimuat: ${error.message}`);
        setMessageIsError(true);
      } else {
        const sortedBooks = (data ?? []).sort(
        (a, b) =>
          String(a.kategori ?? "").localeCompare(String(b.kategori ?? ""), "id-ID") ||
          String(a.judul ?? "").localeCompare(String(b.judul ?? ""), "id-ID"),
      );
      setBooks(sortedBooks);
        setMessage("");
      }
      setIsLoading(false);
    }
    void loadBooks();
    return () => { active = false; };
  }, []);

  const visibleBooks = books.filter((book) => book.kategori === category);

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
      setBooks((current) => editingBook
        ? current.map((book) => book.id === result.data.id ? result.data : book)
        : [...current, result.data].sort((first, second) => first.judul.localeCompare(second.judul, "id")));
      setMessage(`Kitab “${result.data.judul}” berhasil ${editingBook ? "diperbarui" : "ditambahkan"}.`);
      setMessageIsError(false);
      setEditingBook(null);
      form.reset();
    } catch (error) {
      console.error("Failed to save master kitab.", { category, editingId: editingBook?.id, error });
      setMessage(`Kitab gagal disimpan: ${error instanceof Error ? error.message : "kesalahan Supabase"}`);
      setMessageIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Hapus kitab “${book.judul}”? Riwayat jurnal lama tetap tersimpan.`)) return;
    const { error } = await createClient().from("master_kitab").delete().eq("id", book.id);
    if (error) {
      console.error("Failed to delete master kitab.", { bookId: book.id, code: error.code, message: error.message, details: error.details, hint: error.hint });
      setMessage(`Kitab gagal dihapus: ${error.message}`);
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
      <PageHeading eyebrow="Workspace" title="Pengaturan kitab" description="Kelola judul kitab dan pengarang yang tersedia pada formulir jurnal keilmuan." />
      {message && <FormMessage success={!messageIsError}>{message}</FormMessage>}
      <section className="rounded-3xl border border-[#e5e7eb] bg-white p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="text-base font-bold">Master kitab</h2><p className="mt-1 text-xs text-[#757693]">Daftar aktif digunakan oleh pencatatan sorogan dan hafalan matan.</p></div>
          <PillTabs label="Kategori kitab" value={category} options={categoryOptions} onChange={(value) => { setCategory(value); setEditingBook(null); setMessage(""); }} />
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
          <div className="space-y-3">
            {isLoading ? <p className="rounded-2xl bg-[#f8f9ff] p-6 text-center text-xs text-[#757693]">Memuat daftar kitab…</p> : visibleBooks.length ? visibleBooks.map((book) => (
              <article key={book.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#e5e7eb] p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="book" size={18} /></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{book.judul}</h3><p className="mt-1 text-xs text-[#757693]">{book.pengarang || "Pengarang belum dicatat"}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${book.is_active ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#f1f1f5] text-[#757693]"}`}>{book.is_active ? "Aktif" : "Nonaktif"}</span></div></div>
                <div className="flex gap-2"><button type="button" onClick={() => startEdit(book)} className="min-h-10 rounded-full border border-[#e5e7eb] px-4 text-xs font-semibold hover:border-[#cbd0ff] hover:text-[#4457ff]">Edit</button><button type="button" onClick={() => void deleteBook(book)} className="min-h-10 rounded-full border border-[#f2d3d3] px-4 text-xs font-semibold text-[#b74444] hover:bg-[#fff7f7]">Hapus</button></div>
              </article>
            )) : <p className="rounded-2xl bg-[#f8f9ff] p-6 text-center text-xs text-[#757693]">Belum ada {category === "sorogan" ? "kitab sorogan" : "matan kitab"}.</p>}
          </div>
          <form key={`${category}-${editingBook?.id ?? "new"}`} onSubmit={saveBook} className="h-fit rounded-2xl bg-[#f8f9ff] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{editingBook ? "Edit kitab" : "Tambah kitab"}</h3><p className="mt-1 text-[11px] text-[#757693]">{category === "sorogan" ? "Kitab untuk kegiatan sorogan." : "Kitab untuk hafalan bait atau matan."}</p></div>{editingBook && <button type="button" onClick={startCreate} className="text-xs font-semibold text-[#4457ff]">Batal edit</button>}</div>
            <label className="mt-4 block text-xs font-semibold text-[#55566f]">Judul kitab<input name="judul" required defaultValue={editingBook?.judul ?? ""} placeholder={category === "sorogan" ? "Contoh: Fathul Qorib" : "Contoh: Nadhom Imrithi"} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff]" /></label>
            <label className="mt-4 block text-xs font-semibold text-[#55566f]">Nama pengarang<input name="pengarang" defaultValue={editingBook?.pengarang ?? ""} placeholder="Nama pengarang (opsional)" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff]" /></label>
            {editingBook && <label className="mt-4 flex items-center gap-2 text-xs font-medium text-[#55566f]"><input name="is_active" type="checkbox" defaultChecked={editingBook.is_active} className="size-4 accent-[#4457ff]" /> Kitab aktif dan tersedia untuk setoran</label>}
            <PrimaryButton type="submit" disabled={isSaving} className="mt-5 w-full"><Icon name={editingBook ? "check" : "plus"} size={16} />{isSaving ? "Menyimpan…" : editingBook ? "Simpan perubahan" : "Tambah kitab"}</PrimaryButton>
          </form>
        </div>
      </section>
    </div>
  );
}
