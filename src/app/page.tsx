"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LANDING_PAGE_CONTENT,
  type LandingPageContent,
} from "@/lib/landing-page-content";

const navigation = [
  { label: "Tentang", href: "#tentang" },
  { label: "Program Unggulan", href: "#program" },
  { label: "Penerimaan Santri", href: "#penerimaan" },
  { label: "Kontak", href: "#kontak" },
];

const programs: {
  title: string;
  tagline: string;
  summary: string;
  href: string;
  icon: IconName;
  tone: string;
}[] = [
  {
    title: "Tahfidz Al-Qur'an & Mutun",
    tagline: "Menjaga Kalam Ilahi, Memperkokoh Landasan Matan Keilmuan.",
    summary: "Target hafalan bertahap, setoran harian, dan muroja'ah terarah.",
    href: "/program/tahfidz-al-quran-dan-mutun",
    icon: "book-open",
    tone: "from-emerald-50 to-teal-50 text-emerald-700",
  },
  {
    title: "Kajian Kitab Turots",
    tagline: "Mendalami Khazanah Ulama Salaf dengan Sanad Bersambung.",
    summary: "Jenjang sorogan dan bandongan untuk memahami kitab secara mendalam.",
    href: "/program/kajian-kitab",
    icon: "book",
    tone: "from-indigo-50 to-violet-50 text-indigo-700",
  },
  {
    title: "Pembinaan Karakter & Kepemimpinan",
    tagline: "Membentuk Generasi Berintegritas, Santun, dan Mandiri.",
    summary: "Ekstrakurikuler, pembiasaan disiplin, dan kegiatan khidmah.",
    href: "/program/pembinaan-karakter",
    icon: "shield",
    tone: "from-indigo-50 to-blue-50 text-indigo-700",
  },
];

const values: { title: string; detail: string; icon: IconName; tone: string }[] = [
  {
    title: "Adab Sebelum Ilmu",
    detail: "Penanaman akhlak karimah melalui keteladanan asatidz dan pendampingan sepanjang hari.",
    icon: "sparkles",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Keluasan Turots & Modernitas",
    detail: "Kajian kitab salaf berpadu dengan fasilitas sistem digital yang terintegrasi.",
    icon: "book-open",
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    title: "Kemandirian Santri",
    detail: "Membiasakan hidup tertib, amanah, dan berjiwa kepemimpinan.",
    icon: "award",
    tone: "bg-emerald-50 text-emerald-700",
  },
];

const admissionSteps = [
  "Isi Formulir Online",
  "Tes Wawancara & Baca Al-Qur'an",
  "Pengumuman Kelulusan",
  "Masuk Asrama",
];

function cleanPhoneNumber(value: string): string {
  return value.replace(/\D/g, "").replace(/^0/, "62");
}

export default function Home() {
  const [content, setContent] = useState<LandingPageContent>(DEFAULT_LANDING_PAGE_CONTENT);
  const [activeStudents, setActiveStudents] = useState<number | null>(null);
  const [institutionLogo, setInstitutionLogo] = useState<{ url: string; height: string; visible: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLandingData() {
      try {
        const supabase = createClient();
        const [settingsResult, studentsResult] = await Promise.all([
          supabase.from("pengaturan_pesantren").select("*").limit(1).maybeSingle(),
          supabase.from("santri").select("id", { count: "exact", head: true }).eq("status", "aktif"),
        ]);
        if (!active) return;

        if (settingsResult.error) {
          console.warn("Unable to load landing page CMS content; using defaults.", settingsResult.error.message);
        } else if (settingsResult.data) {
          setContent({ ...DEFAULT_LANDING_PAGE_CONTENT, ...settingsResult.data });
          setInstitutionLogo(settingsResult.data.logo_url
            ? {
              url: settingsResult.data.logo_url,
              height: ["h-8", "h-10", "h-14"].includes(settingsResult.data.logo_height)
                ? settingsResult.data.logo_height
                : "h-10",
              visible: settingsResult.data.show_logo_navbar,
            }
            : {
              url: "",
              height: ["h-8", "h-10", "h-14"].includes(settingsResult.data.logo_height)
                ? settingsResult.data.logo_height
                : "h-10",
              visible: settingsResult.data.show_logo_navbar,
            });
        }
        if (studentsResult.error) {
          console.warn("Unable to load the active student count.", studentsResult.error.message);
        } else {
          setActiveStudents(studentsResult.count ?? 0);
        }
      } catch (error) {
        if (!active) return;
        console.warn("Unable to load public landing data.", error);
      }
    }

    void loadLandingData();
    return () => {
      active = false;
    };
  }, []);

  const whatsappHref = `https://wa.me/${cleanPhoneNumber(content.whatsapp_center)}`;
  const instagramHref = `https://instagram.com/${content.sosmed_instagram.replace(/^@/, "")}`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f5ff] text-[#181c31]">
      <header className="relative z-30 border-b border-[#e5e7eb] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Beranda Nurul Albab" className="flex min-h-11 items-center gap-3">
            {institutionLogo?.visible !== false && (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef0ff]">
                {institutionLogo?.url ? (
                <Image
                  src={institutionLogo.url}
                  alt="Logo Pondok Pesantren Nurul Albab"
                  width={56}
                  height={56}
                  unoptimized
                    className={`w-auto max-w-full object-contain ${institutionLogo.height}`}
                />
                ) : <Icon name="sparkles" size={20} className="text-[#4457ff]" />}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-extrabold tracking-tight">NURUL ALBAB</span>
              <span className="block text-[11px] font-medium text-[#757693]">Pondok Pesantren</span>
            </span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-7 lg:flex">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="inline-flex min-h-11 items-center text-sm font-medium text-[#757693] transition-colors duration-200 hover:text-[#4457ff]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/wali" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100">
              <Icon name="parents" size={17} /> Portal Wali Santri
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(68,87,255,0.25)]">
              Masuk Sistem (NAIS) <Icon name="arrow-right" size={15} />
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#757693] transition-colors duration-200 hover:border-indigo-200 hover:text-[#4457ff] lg:hidden"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={20} />
          </button>

          {menuOpen && (
            <div id="mobile-navigation" className="basis-full rounded-3xl border border-[#e5e7eb] bg-white p-3 shadow-[0_12px_32px_rgba(32,36,138,0.08)] lg:hidden">
              <nav aria-label="Navigasi mobile" className="grid gap-1">
                {navigation.map((item) => (
                  <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#757693] transition-colors duration-200 hover:bg-[#f3f5ff] hover:text-[#4457ff]">
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="mt-2 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <Link href="/wali" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition-colors duration-300 hover:bg-emerald-100">
                  <Icon name="parents" size={17} /> Portal Wali
                </Link>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-3 text-sm font-semibold text-white transition-colors duration-200">
                  Masuk Sistem (NAIS) <Icon name="arrow-right" size={15} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
            <span className="truncate">{content.hero_badge}</span>
          </div>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-[1.12] tracking-[-0.045em] sm:text-4xl lg:text-5xl">
            {content.hero_title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{content.hero_subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/ppdb" className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(68,87,255,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(68,87,255,0.25)]">
              Daftar Santri Baru (PPDB) <Icon name="arrow-right" size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a href="#program" className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-6 text-sm font-semibold text-[#757693] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:text-[#4457ff]">
              Jelajahi Program
            </a>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4457ff] shadow-sm"><Icon name="users" size={18} /></span>
            <span><strong className="font-bold text-slate-900"></strong> Bertumbuh dalam Ilmu, Bersama dalam Amal</span>
          </div>
          <blockquote className="mt-6 max-w-xl rounded-3xl border border-[#e5e7eb] bg-white/80 p-4">
            <Icon name="quote" size={17} className="text-emerald-700" />
            <p className="mt-2 break-words text-sm leading-6 text-[#757693]">“{content.hero_quote}”</p>
            <cite className="mt-2 block text-xs font-semibold not-italic text-emerald-800">{content.hero_quote_source}</cite>
          </blockquote>
        </div>

        <div className="relative flex min-w-0 items-center justify-center">
          <div className="relative isolate flex aspect-[1/0.88] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-3xl border border-white bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] shadow-[0_24px_70px_rgba(32,36,138,0.12)] sm:aspect-[1/0.82]">
            <div className="float-card absolute left-[13%] top-[16%] size-3 rounded-sm rotate-45 bg-white/80" />
            <div className="float-card float-card-delay absolute right-[18%] top-[23%] size-2 rounded-full bg-[#7583fd]/60" />
            <div className="absolute left-[18%] top-[28%] size-36 rounded-full bg-[#fff8dc]/70 blur-2xl sm:size-48" />
            <svg viewBox="0 0 520 430" role="img" aria-label="Ilustrasi pesantren dengan kubah dan menara di bawah cahaya fajar" className="relative z-0 h-auto w-[94%] max-w-[500px]">
              <defs>
                <linearGradient id="mosque-sky" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e3e9ff" />
                  <stop offset="100%" stopColor="#f8f9ff" />
                </linearGradient>
                <linearGradient id="mosque-wall" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#e7ebff" />
                </linearGradient>
                <linearGradient id="mosque-dome" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7583fd" />
                  <stop offset="100%" stopColor="#4457ff" />
                </linearGradient>
              </defs>
              <ellipse cx="260" cy="364" rx="214" ry="26" fill="#b7c1ed" opacity=".34" />
              <path d="M70 354h380v18H70z" fill="#c8d1f3" />
              <path d="M91 233h338v121H91z" fill="url(#mosque-wall)" stroke="#cbd3f2" strokeWidth="2" />
              <path d="M70 234 260 155l190 79H70Z" fill="#f6f7ff" stroke="#cbd3f2" strokeWidth="2" />
              <path d="M157 230v-42c0-57 46-103 103-103s103 46 103 103v42H157Z" fill="url(#mosque-dome)" />
              <path d="M169 190c0-50 41-91 91-91s91 41 91 91" fill="none" stroke="#aab4ff" strokeWidth="5" opacity=".7" />
              <path d="M260 82c-8-9-8-16 0-24 8 8 8 15 0 24Z" fill="#7583fd" />
              <path d="M255 83h10v10h-10z" fill="#7583fd" />
              <path d="M110 231v-99h39v99m222 0v-99h39v99" fill="#f7f8ff" stroke="#cbd3f2" strokeWidth="2" />
              <path d="M104 132h51l-7-14h-37Zm222 0h51l-7-14h-37Z" fill="#7583fd" />
              <path d="M123 117V69h13v48m222 0V69h13v48" fill="#e8ebff" stroke="#cbd3f2" strokeWidth="2" />
              <path d="M122 69h15l-7.5-19Z M357 69h15l-7.5-19Z" fill="#7583fd" />
              <path d="M206 354v-56a54 54 0 0 1 108 0v56Z" fill="#dfe5ff" stroke="#cbd3f2" strokeWidth="2" />
              <path d="M224 354v-54a36 36 0 0 1 72 0v54Z" fill="#7583fd" opacity=".88" />
              <rect x="119" y="279" width="25" height="38" rx="8" fill="#c6ceff" />
              <rect x="376" y="279" width="25" height="38" rx="8" fill="#c6ceff" />
              <rect x="229" y="260" width="17" height="26" rx="8" fill="#c6ceff" />
              <rect x="274" y="260" width="17" height="26" rx="8" fill="#c6ceff" />
              <path d="M74 354c19-22 40-22 59 0m254 0c19-22 40-22 59 0" fill="none" stroke="#9fceaF" strokeWidth="5" strokeLinecap="round" />
              <circle cx="180" cy="113" r="3" fill="#7583fd" />
              <circle cx="338" cy="103" r="4" fill="#9fceaF" />
              <path d="M190 137h-14m7-7v14m151-23h-12m6-6v12" stroke="#7583fd" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="float-card absolute left-3 top-5 z-10 inline-flex min-h-10 max-w-[62%] items-center gap-2 rounded-full border border-white bg-white/95 px-3 text-[11px] font-semibold text-[#4457ff] shadow-[0_8px_24px_rgba(32,36,138,0.1)] transition-transform duration-200 hover:-translate-y-1 sm:left-5 sm:top-7 sm:px-4 sm:text-xs">
              <Icon name="book-open" size={15} className="shrink-0" />Tahfidz & Sanad Keilmuan
            </span>
            <span className="float-card float-card-delay absolute bottom-5 right-3 z-10 inline-flex min-h-10 max-w-[60%] items-center gap-2 rounded-full border border-white bg-white/95 px-3 text-[11px] font-semibold text-emerald-800 shadow-[0_8px_24px_rgba(32,36,138,0.1)] transition-transform duration-200 hover:-translate-y-1 sm:bottom-7 sm:right-5 sm:px-4 sm:text-xs">
              <Icon name="sparkles" size={15} className="shrink-0" />Adab Sebelum Ilmu
            </span>
          </div>
        </div>
      </section>

      <section id="tentang" className="scroll-mt-20 border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 px-4 py-14 sm:gap-10 sm:px-6 sm:py-18 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Tentang Nurul Albab</p>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">{content.tentang_title}</h2>
            <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{content.tentang_deskripsi}</p>
            <div className="mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Filosofi pendidikan</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Ilmu yang bermanfaat tumbuh dari hati yang beradab, bimbingan yang istiqamah, dan lingkungan yang saling menguatkan.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            {values.map((value, index) => (
              <article key={value.title} className={`group flex items-start gap-4 rounded-3xl border border-[#e5e7eb] bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_12px_32px_rgba(32,36,138,0.08)] sm:p-6 ${index === 1 ? "sm:translate-x-4" : ""}`}>
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${value.tone} transition-transform duration-300 group-hover:scale-105`}><Icon name={value.icon} size={21} /></span>
                <div>
                  <h3 className="text-base font-bold">{value.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{value.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="program" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Program Unggulan</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">Bekal ilmu, adab, dan khidmah.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Jelajahi kurikulum dan pengalaman belajar yang mendampingi perjalanan setiap santri.</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {programs.map((program, index) => (
            <article key={program.href} className="group flex h-full flex-col rounded-3xl border border-[#e5e7eb] bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_12px_32px_rgba(32,36,138,0.08)] sm:p-6">
              <div className="flex items-center justify-between">
                <span className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${program.tone}`}><Icon name={program.icon} size={22} /></span>
                <span className="text-xs font-bold tracking-[0.12em] text-slate-400">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{program.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-indigo-800">{program.tagline}</p>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{program.summary}</p>
              <Link href={program.href} className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-indigo-700 transition-colors duration-300 hover:text-violet-700">
                Lihat Kurikulum & Detail <Icon name="arrow-right" size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="penerimaan" className="scroll-mt-20 mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-18 lg:px-8 lg:pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-[#dfe5ff] bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] p-5 sm:p-8 lg:p-10">
          <div className="absolute -right-20 -top-28 size-72 rounded-full border border-[#7583fd]/15" />
          <div className="absolute -right-8 -top-16 size-52 rounded-full border border-[#7583fd]/10" />
          <div className="relative">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-500" />{content.ppdb_status}
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#757693]">{content.ppdb_gelombang}</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">Mulai perjalanan baik bersama kami.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#757693]">Kenali lingkungan belajar Nurul Albab dan daftarkan calon santri melalui tahapan yang mudah dan terarah.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
                <Link href="/ppdb" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(68,87,255,0.25)]">
                  Isi Formulir PPDB Online <Icon name="arrow-right" size={16} />
                </Link>
                {content.ppdb_brosur_url && (
                  <a href={content.ppdb_brosur_url} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-5 text-sm font-semibold text-[#757693] transition-all duration-200 hover:border-[#4457ff]/30 hover:text-[#4457ff]">
                    <Icon name="download" size={16} /> Unduh Brosur (PDF)
                  </a>
                )}
              </div>
            </div>
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {admissionSteps.map((step, index) => (
                <li key={step} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white bg-white/75 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-sm font-bold text-[#4457ff]">{index + 1}</span>
                  <span className="text-sm font-semibold leading-5 text-[#181c31]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <footer id="kontak" className="scroll-mt-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-12">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white"><Icon name="sparkles" size={20} /></span>
              <span className="text-sm font-extrabold tracking-tight">NURUL ALBAB</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-slate-600">Pondok Pesantren yang mendampingi santri bertumbuh dalam ilmu, adab, dan khidmah.</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">Izin operasional pesantren dikelola sesuai ketentuan yang berlaku.</p>
          </div>

          <div>
            <h2 className="text-sm font-bold">Tautan Program</h2>
            <ul className="mt-3 space-y-1">
              {programs.map((program) => <li key={program.href}><Link href={program.href} className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors duration-300 hover:text-indigo-700">{program.title}</Link></li>)}
              <li><Link href="/wali" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 transition-colors duration-300 hover:text-emerald-600">Portal Wali Santri</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold">Layanan Sekretariat</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Jam layanan & kunjungan wali santri:</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{content.jam_operasional}</p>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-700 transition-colors duration-300 hover:text-emerald-600">
              <Icon name="phone" size={16} /> WhatsApp {content.whatsapp_center}
            </a>
          </div>

          <div>
            <h2 className="text-sm font-bold">Kunjungi Kami</h2>
            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600"><Icon name="map-pin" size={17} className="mt-0.5 shrink-0 text-indigo-600" />{content.alamat_lengkap}</p>
            <a href={instagramHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-700 transition-colors duration-300 hover:text-violet-700">
              <Icon name="sparkles" size={16} /> Instagram {content.sosmed_instagram}
            </a>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>Pondok Pesantren Nurul Albab. Menjaga ilmu, menumbuhkan adab.</span>
            <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-slate-700 transition-colors duration-300 hover:text-indigo-700">Masuk Pengurus NAIS <Icon name="arrow-right" size={14} className="ml-1" /></Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
