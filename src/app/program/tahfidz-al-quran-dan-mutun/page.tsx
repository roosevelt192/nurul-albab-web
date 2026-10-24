import { ProgramDetailPage, type ProgramDetail } from "@/components/program-detail-page";

const program: ProgramDetail = {
  eyebrow: "Program Tahfidz & Mutun",
  title: "Tahfidz Al-Qur'an & Mutun",
  tagline: "Menjaga Kalam Ilahi, Memperkokoh Landasan Matan Keilmuan.",
  summary: "Hafalan Al-Qur'an dan matan dasar dibimbing secara bertahap, dengan perhatian pada ketepatan bacaan, pemahaman, dan kekuatan muroja'ah.",
  icon: "book-open",
  objective: "Program ini menumbuhkan kedekatan santri dengan Al-Qur'an sekaligus membangun fondasi ilmu melalui hafalan matan. Setiap target disesuaikan dengan kemampuan, dijaga melalui pengulangan, dan diperkuat dengan bimbingan asatidz.",
  stages: [
    { name: "I'dad", focus: "Fondasi bacaan", details: "Tahsin makhraj dan tajwid, adab menghafal, serta pembiasaan muroja'ah." },
    { name: "Marhalah Ula", focus: "Hafalan terarah", details: "Setoran ayat dan matan dasar secara bertahap dengan penguatan hafalan harian." },
    { name: "Marhalah 'Ulya", focus: "Mutqin & pengayaan", details: "Pemantapan hafalan, sambung ayat atau bait, serta penguatan pemahaman." },
  ],
  methods: [
    { title: "Setoran Harian", details: "Santri menyetorkan hafalan baru kepada pembimbing dan menerima koreksi bacaan serta pelafalan.", icon: "check" },
    { title: "Halaqah Talaqqi", details: "Pembelajaran tatap muka dalam kelompok terarah untuk menjaga ketepatan bacaan dan disiplin belajar.", icon: "users" },
    { title: "Takrar & Muroja'ah", details: "Pengulangan hafalan lama dan baru secara terjadwal agar hafalan semakin kuat dan terjaga.", icon: "rotate-ccw" },
  ],
};

export default function TahfidzProgramPage() {
  return <ProgramDetailPage program={program} />;
}
