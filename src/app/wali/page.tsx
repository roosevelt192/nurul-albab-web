"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { FormMessage, MetricCard, PrimaryButton, StatusBadge } from "@/components/workspace-ui";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type PortalStudent = {
  nis: string;
  nama_lengkap: string;
  jenis_kelamin: string | null;
  kelas: string;
  kamar: string;
  konsulat: string;
  status: string;
  foto_url: string | null;
};

type PortalInvoice = {
  bulan: number;
  tahun: number;
  nominal: number;
  terbayar: number;
  status: string;
  kode_tagihan: string | null;
  komponen: string;
};

type PortalPayment = {
  nominal: number;
  tanggal: string;
  metode: string;
  komponen: string;
};

type PortalJournal = {
  tanggal: string;
  kategori: string;
  judul_kitab: string;
  hanca: string;
  predikat: string;
};

type PortalPermit = {
  keperluan: string;
  status: string;
  waktu_keluar: string;
  batas_kembali: string | null;
  waktu_kembali: string | null;
};

type PortalData = {
  santri: PortalStudent;
  keuangan: { tagihan: PortalInvoice[]; pembayaran: PortalPayment[] };
  keilmuan: PortalJournal[];
  perizinan: PortalPermit[];
};

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: Json | undefined, fallback = "—"): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: Json | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecordList<T>(
  value: Json | undefined,
  mapRecord: (record: { [key: string]: Json | undefined }) => T,
): T[] {
  return Array.isArray(value) ? value.filter(isRecord).map(mapRecord) : [];
}

function parsePortalData(value: Json): PortalData {
  if (!isRecord(value) || !isRecord(value.santri) || !isRecord(value.keuangan)) {
    throw new Error("Data portal tidak memiliki format yang dikenali.");
  }

  const studentRecord = value.santri;
  const financeRecord = value.keuangan;
  const studentName = asString(studentRecord.nama_lengkap, "");
  const nis = asString(studentRecord.nis, "");
  if (!studentName || !nis) throw new Error("Profil santri pada portal tidak lengkap.");

  return {
    santri: {
      nis,
      nama_lengkap: studentName,
      jenis_kelamin: typeof studentRecord.jenis_kelamin === "string" ? studentRecord.jenis_kelamin : null,
      kelas: asString(studentRecord.kelas),
      kamar: asString(studentRecord.kamar),
      konsulat: asString(studentRecord.konsulat),
      status: asString(studentRecord.status, "aktif"),
      foto_url: typeof studentRecord.foto_url === "string" ? studentRecord.foto_url : null,
    },
    keuangan: {
      tagihan: asRecordList(financeRecord.tagihan, (record) => ({
        bulan: asNumber(record.bulan),
        tahun: asNumber(record.tahun),
        nominal: asNumber(record.nominal),
        terbayar: asNumber(record.terbayar),
        status: asString(record.status, "belum_lunas"),
        kode_tagihan: typeof record.kode_tagihan === "string" ? record.kode_tagihan : null,
        komponen: asString(record.komponen, "Iuran Pondok"),
      })),
      pembayaran: asRecordList(financeRecord.pembayaran, (record) => ({
        nominal: asNumber(record.nominal),
        tanggal: asString(record.tanggal, ""),
        metode: asString(record.metode, "—"),
        komponen: asString(record.komponen, "Iuran Pondok"),
      })),
    },
    keilmuan: asRecordList(isRecord(value) ? value.keilmuan : undefined, (record) => ({
      tanggal: asString(record.tanggal, ""),
      kategori: asString(record.kategori, "Keilmuan"),
      judul_kitab: asString(record.judul_kitab),
      hanca: asString(record.hanca),
      predikat: asString(record.predikat),
    })),
    perizinan: asRecordList(isRecord(value) ? value.perizinan : undefined, (record) => ({
      keperluan: asString(record.keperluan),
      status: asString(record.status, "kembali"),
      waktu_keluar: asString(record.waktu_keluar, ""),
      batas_kembali: typeof record.batas_kembali === "string" ? record.batas_kembali : null,
      waktu_kembali: typeof record.waktu_kembali === "string" ? record.waktu_kembali : null,
    })),
  };
}

function formatMonth(month: number, year: number): string {
  if (month < 1 || month > 12) return String(year);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export default function PublicWaliPage() {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const formData = new FormData(event.currentTarget);
    const nis = String(formData.get("nis") ?? "").trim();
    const tanggalLahir = String(formData.get("tanggal_lahir") ?? "").trim();
    if (!nis || !tanggalLahir) {
      setMessage("Masukkan NIS dan tanggal lahir santri.");
      setMessageIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setPortalData(null);
    const { data, error } = await createClient().rpc("get_portal_wali_data", {
      p_nis: nis,
      p_tgl_lahir: tanggalLahir,
    });

    if (error) {
      console.error("Portal wali lookup failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      setMessage("Data belum dapat dimuat. Silakan coba kembali beberapa saat lagi.");
      setMessageIsError(true);
    } else if (!data) {
      setMessage("Data tidak ditemukan. Periksa kembali NIS dan tanggal lahir.");
      setMessageIsError(true);
    } else {
      try {
        setPortalData(parsePortalData(data));
        setMessage("");
        setMessageIsError(false);
      } catch (parseError) {
        console.error("Portal wali returned an invalid data shape.", parseError);
        setMessage("Data portal belum dapat ditampilkan. Silakan hubungi administrasi pesantren.");
        setMessageIsError(true);
      }
    }
    setIsLoading(false);
  }

  const outstanding = portalData?.keuangan.tagihan.reduce(
    (total, invoice) => total + Math.max(0, invoice.nominal - invoice.terbayar),
    0,
  ) ?? 0;
  const activePermit = portalData?.perizinan.find((permit) =>
    ["diajukan", "disetujui", "sedang_di_luar", "terlambat"].includes(permit.status.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-[#f3f5ff] px-4 py-8 text-[#181c31] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-[#1e293b] to-[#4457ff] p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Nurul Albab System</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Portal Wali Santri</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            Periksa perkembangan belajar, administrasi, dan perizinan santri menggunakan NIS dan tanggal lahir.
          </p>
        </header>

        <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold">Verifikasi data santri</h2>
              <p className="mt-1 text-xs leading-5 text-[#757693]">
                Data hanya ditampilkan jika kedua informasi cocok dengan data administrasi pesantren.
              </p>
            </div>
          </div>
          <form onSubmit={handleLookup} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-xs font-semibold text-[#55566f]">
              Nomor Induk Santri (NIS)
              <input
                name="nis"
                required
                maxLength={32}
                autoComplete="username"
                placeholder="Masukkan NIS"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]"
              />
            </label>
            <label className="block text-xs font-semibold text-[#55566f]">
              Tanggal lahir santri
              <input
                name="tanggal_lahir"
                type="date"
                required
                autoComplete="bday"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#e5e7eb] px-3.5 text-sm outline-none focus:border-[#4457ff]"
              />
            </label>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? "Memeriksa…" : <><Icon name="search" size={15} /> Cek Data</>}
            </PrimaryButton>
          </form>
          {message && (
            <div className="mt-4">
              <FormMessage success={!messageIsError}>{message}</FormMessage>
            </div>
          )}
        </section>

        {portalData && (
          <>
            <section className="flex flex-col gap-4 rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:flex-row sm:items-center sm:p-7">
              {portalData.santri.foto_url ? (
                <Image
                  src={portalData.santri.foto_url}
                  alt={`Foto ${portalData.santri.nama_lengkap}`}
                  width={72}
                  height={72}
                  unoptimized
                  className="size-[72px] rounded-2xl object-cover"
                />
              ) : (
                <span className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-[#eef0ff] text-xl font-bold text-[#4457ff]">
                  {portalData.santri.nama_lengkap.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#757693]">Profil santri</p>
                <h2 className="mt-1 text-xl font-bold">{portalData.santri.nama_lengkap}</h2>
                <p className="mt-1 text-xs text-[#757693]">
                  NIS {portalData.santri.nis} · {portalData.santri.kelas} · {portalData.santri.kamar}
                </p>
              </div>
              <StatusBadge
                label={portalData.santri.status.replaceAll("_", " ")}
                tone="bg-[#e8f5f0] text-[#25815e]"
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Total sisa tagihan"
                value={formatRupiah(outstanding)}
                detail={`${portalData.keuangan.tagihan.length} catatan tagihan`}
                icon="wallet"
                tone={outstanding ? "bg-[#fff4e7] text-[#bd7627]" : "bg-[#e8f5f0] text-[#25815e]"}
              />
              <MetricCard
                label="Pembayaran tercatat"
                value={String(portalData.keuangan.pembayaran.length)}
                detail="Riwayat pembayaran iuran"
                icon="receipt"
              />
              <MetricCard
                label="Perizinan"
                value={activePermit ? "Dalam proses" : "Di pondok"}
                detail={activePermit?.keperluan ?? "Tidak ada izin yang sedang berlangsung"}
                icon="shield"
                tone={activePermit ? "bg-[#fff4e7] text-[#bd7627]" : "bg-[#e8f5f0] text-[#25815e]"}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]"><Icon name="book" size={18} /></span>
                  <div><h2 className="text-base font-bold">Perkembangan keilmuan</h2><p className="mt-1 text-xs text-[#757693]">Catatan terbaru asatidz</p></div>
                </div>
                <div className="mt-5 space-y-3">
                  {portalData.keilmuan.length ? portalData.keilmuan.map((entry, index) => (
                    <div key={`${entry.tanggal}-${entry.judul_kitab}-${index}`} className="rounded-2xl bg-[#f8f9ff] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{entry.kategori} · {entry.judul_kitab}</p>
                        <StatusBadge label={entry.predikat} tone="bg-[#e8f5f0] text-[#25815e]" />
                      </div>
                      <p className="mt-2 text-xs text-[#757693]">{entry.hanca}</p>
                      <p className="mt-2 text-[10px] text-[#8a8ba2]">{formatDate(entry.tanggal)}</p>
                    </div>
                  )) : <p className="rounded-2xl bg-[#f8f9ff] p-5 text-center text-xs text-[#757693]">Belum ada catatan keilmuan.</p>}
                </div>
              </article>

              <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#fff4e7] text-[#bd7627]"><Icon name="wallet" size={18} /></span>
                  <div><h2 className="text-base font-bold">Tagihan dan pembayaran</h2><p className="mt-1 text-xs text-[#757693]">Informasi administrasi iuran</p></div>
                </div>
                <div className="mt-5 space-y-3">
                  {portalData.keuangan.tagihan.length ? portalData.keuangan.tagihan.map((invoice, index) => {
                    const paid = invoice.terbayar >= invoice.nominal;
                    return (
                      <div key={`${invoice.tahun}-${invoice.bulan}-${invoice.komponen}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-[#e5e7eb] p-4">
                        <div>
                          <p className="text-xs font-semibold">{invoice.komponen}</p>
                          <p className="mt-1 text-[10px] text-[#8a8ba2]">{formatMonth(invoice.bulan, invoice.tahun)}</p>
                          <p className="mt-2 text-xs font-bold tabular-nums">{formatRupiah(invoice.nominal)}</p>
                          <p className="mt-1 text-[10px] text-[#757693]">Terbayar {formatRupiah(invoice.terbayar)}</p>
                        </div>
                        <StatusBadge
                          label={paid ? "Lunas" : invoice.status.replaceAll("_", " ")}
                          tone={paid ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4e7] text-[#bd7627]"}
                        />
                      </div>
                    );
                  }) : <p className="rounded-2xl bg-[#f8f9ff] p-5 text-center text-xs text-[#757693]">Belum ada tagihan.</p>}
                  {portalData.keuangan.pembayaran.length > 0 && (
                    <div className="border-t border-[#f0f0f5] pt-3">
                      <h3 className="mb-2 text-xs font-semibold">Pembayaran terakhir</h3>
                      {portalData.keuangan.pembayaran.slice(0, 5).map((payment, index) => (
                        <div key={`${payment.tanggal}-${index}`} className="flex justify-between gap-3 py-2 text-[11px]">
                          <span className="text-[#757693]">{payment.komponen} · {formatDate(payment.tanggal)}</span>
                          <span className="font-semibold tabular-nums">{formatRupiah(payment.nominal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#e8f5f0] text-[#25815e]"><Icon name="shield" size={18} /></span>
                <div><h2 className="text-base font-bold">Riwayat perizinan</h2><p className="mt-1 text-xs text-[#757693]">Informasi izin keluar dan kepulangan</p></div>
              </div>
              {portalData.perizinan.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-[#8a8ba2]"><tr><th className="px-3 py-2">Keperluan</th><th className="px-3 py-2">Keluar</th><th className="px-3 py-2">Batas kembali</th><th className="px-3 py-2">Status</th></tr></thead>
                    <tbody>{portalData.perizinan.map((permit, index) => (
                      <tr key={`${permit.waktu_keluar}-${index}`} className="border-t border-[#f0f0f5]">
                        <td className="px-3 py-3 font-medium">{permit.keperluan}</td>
                        <td className="px-3 py-3 text-[#757693]">{formatDate(permit.waktu_keluar)}</td>
                        <td className="px-3 py-3 text-[#757693]">{formatDate(permit.batas_kembali)}</td>
                        <td className="px-3 py-3"><StatusBadge label={permit.status.replaceAll("_", " ")} tone={permit.waktu_kembali ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4e7] text-[#bd7627]"} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="mt-4 rounded-2xl bg-[#f8f9ff] p-5 text-center text-xs text-[#757693]">Belum ada riwayat perizinan.</p>}
            </section>
          </>
        )}

        <footer className="text-center text-[11px] leading-5 text-[#8a8ba2]">
          Portal ini menampilkan data satu santri setelah NIS dan tanggal lahir cocok. Jaga kerahasiaan informasi akses Anda.
        </footer>
      </div>
    </main>
  );
}
