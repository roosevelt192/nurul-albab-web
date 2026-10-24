import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

export type ProgramDetail = {
  eyebrow: string;
  title: string;
  tagline: string;
  summary: string;
  icon: IconName;
  objective: string;
  stages: { name: string; focus: string; details: string }[];
  methods: { title: string; details: string; icon: IconName }[];
};

export function ProgramDetailPage({ program }: { program: ProgramDetail }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f5ff] text-[#181c31]">
      <header className="border-b border-[#e5e7eb] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 font-extrabold tracking-tight">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-r from-[#4457ff] to-[#7583fd] text-white shadow-[0_8px_20px_rgba(68,87,255,0.2)]"><Icon name="sparkles" size={20} /></span>
            <span>Nurul Albab</span>
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e5e7eb] px-4 text-sm font-semibold text-[#757693] transition-all duration-200 hover:-translate-x-0.5 hover:border-[#4457ff]/30 hover:text-[#4457ff]">
            <Icon name="arrow-down-left" size={16} /> Kembali ke Beranda
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff]">
        <div className="absolute -right-16 -top-24 size-72 rounded-full border border-[#7583fd]/15" />
        <div className="absolute -bottom-36 left-1/3 size-80 rounded-full border border-[#7583fd]/10" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
          <div>
            <span className="inline-flex min-h-8 items-center rounded-full bg-white px-3 text-xs font-semibold text-[#4457ff] shadow-sm">{program.eyebrow}</span>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-[1.12] tracking-[-0.04em] sm:text-5xl lg:text-[56px]">{program.title}</h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#4457ff] sm:text-lg">{program.tagline}</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#757693] sm:text-base">{program.summary}</p>
            <Link href="/ppdb" className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-6 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(68,87,255,0.25)]">
              Daftar Santri Baru <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          <div className="relative mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center rounded-3xl border border-white bg-white/80 shadow-[0_16px_48px_rgba(32,36,138,0.1)] sm:max-w-[380px]">
            <span className="absolute right-[14%] top-[15%] size-3 rotate-45 rounded-sm bg-[#7583fd]/30" />
            <span className="absolute bottom-[18%] left-[16%] size-2 rounded-full bg-emerald-300" />
            <span className="flex size-36 items-center justify-center rounded-3xl bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] text-[#4457ff] sm:size-44">
              <Icon name={program.icon} size={76} />
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-10 sm:gap-6 sm:px-6 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <article className="rounded-3xl border border-[#e5e7eb] bg-white p-6 transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(32,36,138,0.08)] sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#4457ff]"><Icon name="sparkles" size={22} /></span>
          <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">Tujuan & Filosofi Program</h2>
          <p className="mt-4 text-sm leading-7 text-[#757693] sm:text-base">{program.objective}</p>
        </article>
        <article className="rounded-3xl border border-[#e5e7eb] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4457ff]">Tahapan Belajar</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Kurikulum bertahap dan terarah</h2>
          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {program.stages.map((stage, index) => (
              <li key={stage.name} className="rounded-2xl border border-[#e5e7eb] bg-[#f8f9ff] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#7583fd]/40 hover:bg-white">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#4457ff] text-xs font-bold text-white">{index + 1}</span>
                <h3 className="mt-3 text-sm font-bold">{stage.name}</h3>
                <p className="mt-1 text-xs font-semibold text-[#4457ff]">{stage.focus}</p>
                <p className="mt-2 text-xs leading-5 text-[#757693]">{stage.details}</p>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="border-y border-[#e5e7eb] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Pendampingan Istiqamah</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Metode pembelajaran</h2>
            <p className="mt-3 text-sm leading-6 text-[#757693]">Pembelajaran menggabungkan bimbingan langsung, pengulangan, dan evaluasi berkala sesuai perkembangan santri.</p>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {program.methods.map((method) => (
              <article key={method.title} className="rounded-3xl border border-[#e5e7eb] bg-[#f8f9ff] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_12px_32px_rgba(32,36,138,0.08)] sm:p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={method.icon} size={20} /></span>
                <h3 className="mt-4 text-base font-bold">{method.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#757693]">{method.details}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-[#dfe5ff] bg-gradient-to-t from-[#f8f9ff] to-[#dee7ff] p-6 sm:p-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Mari bertumbuh bersama</p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">Siapkan langkah baik untuk masa depan.</h2>
            <p className="mt-2 text-sm leading-6 text-[#757693]">Kenali proses penerimaan santri baru dan mulai pendaftaran secara online.</p>
          </div>
          <Link href="/ppdb" className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-6 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(68,87,255,0.25)]">
            Informasi PPDB <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[#757693] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Pondok Pesantren Nurul Albab</span><Link href="/" className="inline-flex min-h-11 items-center font-semibold text-[#4457ff]">Beranda</Link>
        </div>
      </footer>
    </main>
  );
}
