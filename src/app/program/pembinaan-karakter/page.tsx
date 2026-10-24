import { ProgramDetailPage, type ProgramDetail } from "@/components/program-detail-page";

const program: ProgramDetail = {
  eyebrow: "Program Karakter & Kepemimpinan",
  title: "Pembinaan Karakter & Kepemimpinan",
  tagline: "Membentuk Generasi Berintegritas, Santun, dan Mandiri.",
  summary: "Pembiasaan kehidupan pesantren, kegiatan khidmah, dan ruang kepemimpinan membantu santri bertumbuh menjadi pribadi yang bertanggung jawab.",
  icon: "shield",
  objective: "Pendidikan karakter berlangsung melalui teladan, kebiasaan sehari-hari, dan tanggung jawab bersama. Santri belajar menjaga amanah, menghargai sesama, mengelola diri, serta siap berkhidmah di tengah masyarakat.",
  stages: [
    { name: "I'dad", focus: "Adaptasi & disiplin", details: "Mengenal tata tertib, membangun kebiasaan baik, dan belajar hidup bersama." },
    { name: "Marhalah Ula", focus: "Amanah & kolaborasi", details: "Berlatih bertanggung jawab, bekerja sama, dan terlibat dalam kegiatan khidmah." },
    { name: "Marhalah 'Ulya", focus: "Kepemimpinan & khidmah", details: "Mengembangkan inisiatif, keteladanan, dan kesiapan mengabdi kepada masyarakat." },
  ],
  methods: [
    { title: "Uswah & Pembiasaan", details: "Keteladanan asatidz dan rutinitas pesantren menanamkan adab, disiplin, serta sikap saling menghormati.", icon: "sparkles" },
    { title: "Ekstrakurikuler", details: "Kegiatan minat dan bakat menjadi ruang belajar percaya diri, kerja sama, dan kepemimpinan.", icon: "award" },
    { title: "Khidmah & Evaluasi", details: "Tugas pelayanan dan refleksi bersama membiasakan amanah serta kepedulian.", icon: "users" },
  ],
};

export default function CharacterProgramPage() {
  return <ProgramDetailPage program={program} />;
}
