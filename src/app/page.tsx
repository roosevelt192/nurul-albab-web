import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

const programs: {
  number: string;
  title: string;
  description: string;
  icon: IconName;
  tone: string;
}[] = [
  {
    number: "01",
    title: "Tahfidz Al-Qur’an",
    description:
      "Pendampingan hafalan dan muroja’ah yang terarah, dengan target yang tumbuh bersama kemampuan setiap santri.",
    icon: "book",
    tone: "bg-[#eef0ff] text-[#4457ff]",
  },
  {
    number: "02",
    title: "Kajian Kitab",
    description:
      "Mempelajari kitab-kitab dasar melalui halaqah yang dekat, disiplin, dan relevan dengan kehidupan sehari-hari.",
    icon: "graduation",
    tone: "bg-[#e8f5f0] text-[#25815e]",
  },
  {
    number: "03",
    title: "Pembinaan Karakter",
    description:
      "Membiasakan adab, kemandirian, dan kepedulian sebagai bekal santri untuk berkhidmat di tengah masyarakat.",
    icon: "sparkles",
    tone: "bg-[#fff4e7] text-[#bd7627]",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f5ff] text-[#181c31]">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Beranda Nurul Albab" className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4457ff] to-[#7583fd] text-white shadow-[0_8px_20px_rgba(68,87,255,0.22)]">
            <Icon name="sparkles" size={21} />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight">NURUL ALBAB</span>
            <span className="block text-[11px] font-medium text-[#757693]">Pondok Pesantren</span>
          </span>
        </Link>
        <nav aria-label="Navigasi utama" className="hidden items-center gap-8 md:flex">
          <a href="#tentang" className="text-sm font-medium text-[#757693] transition hover:text-[#4457ff]">Tentang</a>
          <a href="#program" className="text-sm font-medium text-[#757693] transition hover:text-[#4457ff]">Program</a>
          <a href="#penerimaan" className="text-sm font-medium text-[#757693] transition hover:text-[#4457ff]">Penerimaan</a>
        </nav>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-5 text-sm font-semibold text-[#181c31] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd0ff] hover:text-[#4457ff]"
        >
          Masuk
          <Icon name="arrow-right" size={16} />
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 pb-20 pt-10 sm:px-8 md:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-10 lg:pb-28">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white/80 px-4 py-2 text-xs font-semibold text-[#4457ff]">
            <span className="size-2 rounded-full bg-[#4457ff]" />
            Ruang tumbuh untuk ilmu dan akhlak
          </div>
          <h1 className="max-w-[650px] text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[1.08] tracking-[-0.055em]">
            Menjaga ilmu,
            <br />
            <span className="bg-gradient-to-r from-[#4457ff] to-[#7583fd] bg-clip-text text-transparent">
              menumbuhkan adab.
            </span>
          </h1>
          <p className="mt-6 max-w-[535px] text-base leading-8 text-[#757693] sm:text-lg">
            Pondok Pesantren Nurul Albab mendampingi santri belajar, menghafal,
            dan bertumbuh dalam lingkungan yang hangat, disiplin, serta penuh
            keberkahan.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/ppdb"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-7 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(68,87,255,0.25)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(68,87,255,0.3)]"
            >
              Daftar santri baru
              <Icon name="arrow-right" size={17} />
            </Link>
            <a
              href="#tentang"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-7 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd0ff] hover:text-[#4457ff]"
            >
              Kenali pesantren
            </a>
          </div>
          <div className="mt-11 flex items-center gap-4">
            <div className="flex -space-x-2">
              {["NA", "QA", "MI"].map((initials, index) => (
                <span
                  key={initials}
                  className={`flex size-9 items-center justify-center rounded-full border-2 border-[#f3f5ff] text-[10px] font-bold text-white ${
                    index === 0 ? "bg-[#4457ff]" : index === 1 ? "bg-[#7d84d8]" : "bg-[#9ca3af]"
                  }`}
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-xs leading-5 text-[#757693]">
              <span className="font-semibold text-[#181c31]">Belajar bersama, bertumbuh bersama</span>
              <br />
              Berlandaskan ilmu, adab, dan khidmah.
            </p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[530px]">
          <div className="absolute -right-8 -top-8 size-36 rounded-full bg-[#dce2ff] blur-3xl" />
          <div className="absolute -bottom-10 -left-8 size-40 rounded-full bg-[#e4dbff] blur-3xl" />
          <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-gradient-to-br from-[#e8edff] via-[#dce6ff] to-[#f7f4ff] p-5 shadow-[0_28px_70px_rgba(32,36,138,0.14)] sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#757693]">Suasana pesantren</p>
                <p className="mt-1 text-sm font-bold">Belajar dalam kebersamaan</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-white/80 text-[#4457ff]">
                <Icon name="sparkles" size={18} />
              </span>
            </div>
            <div className="relative mt-6 flex h-[290px] items-end justify-center overflow-hidden rounded-[24px] bg-gradient-to-b from-[#b8c7f5] via-[#d5def8] to-[#f2e9de] sm:h-[340px]">
              <div className="absolute left-8 top-10 size-16 rounded-full bg-[#fff4d2] shadow-[0_0_55px_rgba(255,244,210,0.7)]" />
              <div className="absolute inset-x-0 bottom-0 h-24 rounded-[50%_50%_0_0] bg-[#c9d7c6]" />
              <div className="absolute bottom-0 h-[76%] w-[69%] rounded-t-[42%] bg-[#f8f7f1] shadow-[0_12px_35px_rgba(56,64,103,0.1)]">
                <div className="absolute inset-x-0 top-[25%] h-2 bg-[#a6b1d0]" />
                <div className="absolute inset-x-0 top-[56%] h-2 bg-[#a6b1d0]" />
                <div className="absolute left-1/2 top-[-9%] h-[19%] w-[54%] -translate-x-1/2 rounded-t-[50%] border-[9px] border-b-0 border-[#7583ad] bg-[#f7f6ef]" />
                <div className="absolute bottom-0 left-1/2 h-[23%] w-[20%] -translate-x-1/2 rounded-t-full bg-[#9ca8c8]" />
                <div className="absolute left-[12%] top-[34%] h-[16%] w-[16%] rounded-t-full bg-[#b9c5df]" />
                <div className="absolute right-[12%] top-[34%] h-[16%] w-[16%] rounded-t-full bg-[#b9c5df]" />
                <div className="absolute left-[12%] top-[66%] h-[16%] w-[16%] rounded-t-full bg-[#b9c5df]" />
                <div className="absolute right-[12%] top-[66%] h-[16%] w-[16%] rounded-t-full bg-[#b9c5df]" />
              </div>
              <div className="absolute bottom-0 left-[8%] h-[36%] w-[19%] rounded-t-[45%] bg-[#7583ad]" />
              <div className="absolute bottom-0 right-[8%] h-[44%] w-[17%] rounded-t-[45%] bg-[#8995b7]" />
              <div className="absolute bottom-4 left-[13%] size-3 rounded-full bg-[#586b58]" />
              <div className="absolute bottom-2 right-[16%] size-4 rounded-full bg-[#586b58]" />
            </div>
            <div className="absolute bottom-10 left-0 flex max-w-[225px] items-center gap-3 rounded-2xl border border-white/80 bg-white p-3.5 shadow-[0_12px_30px_rgba(24,28,49,0.1)] sm:-left-5 sm:bottom-12">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]">
                <Icon name="book" size={19} />
              </span>
              <span>
                <span className="block text-[11px] font-medium text-[#757693]">Program harian</span>
                <span className="mt-0.5 block text-xs font-bold">Tahfidz & kajian kitab</span>
              </span>
            </div>
            <div className="absolute right-2 top-[42%] rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(24,28,49,0.1)] sm:-right-5">
              <p className="text-[11px] font-medium text-[#757693]">Santri bertumbuh</p>
              <p className="mt-1 text-lg font-bold tracking-tight">30+ <span className="text-xs font-medium text-[#757693]">santri</span></p>
            </div>
          </div>
          <p className="relative mt-4 text-center text-xs text-[#757693]">
            Menyiapkan generasi berilmu yang membawa manfaat.
          </p>
        </div>
      </section>

      <section id="tentang" className="border-y border-[#e5e7eb]/80 bg-white/65">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.75fr_1.25fr] md:items-center md:py-20 lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4457ff]">Tentang Nurul Albab</p>
            <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">
              Pesantren sebagai rumah untuk bertumbuh.
            </h2>
          </div>
          <div className="grid gap-7 sm:grid-cols-2">
            <p className="text-sm leading-7 text-[#757693]">
              Nurul Albab hadir untuk mendampingi perjalanan santri dalam
              menuntut ilmu agama dan membangun kebiasaan baik. Proses belajar
              dijalani dengan bimbingan, kebersamaan, dan perhatian pada
              perkembangan setiap pribadi.
            </p>
            <div className="rounded-3xl border border-[#e5e7eb] bg-white p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4457ff]">
                <Icon name="sparkles" size={19} />
              </div>
              <h3 className="text-base font-bold">Ilmu yang menuntun, adab yang menguatkan</h3>
              <p className="mt-2 text-sm leading-6 text-[#757693]">
                Menumbuhkan kecintaan pada ilmu, kedisiplinan, dan kepedulian
                dalam suasana belajar yang saling menguatkan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="program" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 md:py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4457ff]">Program unggulan</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Bekal untuk dunia dan akhirat.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#757693]">
            Pembelajaran yang menyatukan pendalaman ilmu agama dengan
            pembentukan karakter dan kebiasaan baik.
          </p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {programs.map((program) => (
            <article
              key={program.number}
              className="group rounded-3xl border border-[#e5e7eb] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-[#cbd0ff] hover:shadow-[0_14px_35px_rgba(68,87,255,0.08)] sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className={`flex size-12 items-center justify-center rounded-2xl ${program.tone}`}>
                  <Icon name={program.icon} size={21} />
                </span>
                <span className="text-xs font-bold tracking-[0.12em] text-[#b2b3c5]">{program.number}</span>
              </div>
              <h3 className="mt-7 text-lg font-bold tracking-tight">{program.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#757693]">{program.description}</p>
              <a href="#penerimaan" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4457ff]">
                Pelajari lebih lanjut
                <Icon name="arrow-right" size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="penerimaan" className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-8 md:pb-24 lg:px-10">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-7 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="absolute -right-10 -top-24 size-72 rounded-full border border-white/15" />
          <div className="absolute -right-2 -top-16 size-56 rounded-full border border-white/15" />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-[610px]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Penerimaan santri baru</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Mulai perjalanan baik bersama kami.</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
                Kenali lingkungan belajar Nurul Albab dan dapatkan informasi
                pendaftaran untuk calon santri.
              </p>
            </div>
            <Link
              href="/ppdb"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#4457ff] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Lihat informasi PPDB
              <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] bg-white/65">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-6 text-xs text-[#757693] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span className="font-semibold text-[#181c31]">Pondok Pesantren Nurul Albab</span>
          <span>Menjaga ilmu, menumbuhkan adab.</span>
          <Link href="/login" className="font-semibold transition hover:text-[#4457ff]">Masuk ke NAIS</Link>
        </div>
      </footer>
    </main>
  );
}
