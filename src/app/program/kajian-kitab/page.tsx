import { ProgramDetailPage, type ProgramDetail } from "@/components/program-detail-page";

const program: ProgramDetail = {
  eyebrow: "Program Kajian Turats",
  title: "Kajian Kitab Turots",
  tagline: "Mendalami Khazanah Ulama Salaf dengan Sanad Bersambung.",
  summary: "Kajian kitab dasar dan menengah membimbing santri memahami ilmu agama melalui pembacaan, penjelasan, dan pengamalan yang bertahap.",
  icon: "book",
  objective: "Program kajian kitab memperkenalkan santri pada keluasan khazanah ulama salaf dengan penghormatan terhadap tradisi keilmuan. Santri didampingi untuk membaca teks, memahami istilah, dan menghubungkan pelajaran dengan adab serta kehidupan sehari-hari.",
  stages: [
    { name: "I'dad", focus: "Alat dasar belajar", details: "Penguatan baca kitab, kosakata, istilah dasar, dan adab talaqqi." },
    { name: "Marhalah Ula", focus: "Sorogan & bandongan", details: "Mengkaji kitab dasar dengan bimbingan, catatan makna, dan diskusi halaqah." },
    { name: "Marhalah 'Ulya", focus: "Pendalaman & taqrir", details: "Pendalaman bab, latihan menjelaskan isi kitab, dan penguatan pemahaman." },
  ],
  methods: [
    { title: "Sorogan", details: "Santri membaca dan menjelaskan bagian kitab di hadapan ustadz untuk mendapat bimbingan langsung.", icon: "book-open" },
    { title: "Bandongan", details: "Ustadz membacakan dan menerangkan kitab, sementara santri menyimak dan mencatat pelajaran.", icon: "users" },
    { title: "Takrar & Musyawarah", details: "Pengulangan pelajaran dan diskusi terarah membantu santri menguatkan pemahaman.", icon: "rotate-ccw" },
  ],
};

export default function KajianKitabProgramPage() {
  return <ProgramDetailPage program={program} />;
}
