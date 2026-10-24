export type QuranSurah = {
  number: number;
  name: string;
  ayahCount: number;
  juzStart: number;
  juzEnd: number;
};

const surahRows = [
  ["Al-Fatihah", 7], ["Al-Baqarah", 286], ["Ali 'Imran", 200], ["An-Nisa", 176],
  ["Al-Ma'idah", 120], ["Al-An'am", 165], ["Al-A'raf", 206], ["Al-Anfal", 75],
  ["At-Tawbah", 129], ["Yunus", 109], ["Hud", 123], ["Yusuf", 111],
  ["Ar-Ra'd", 43], ["Ibrahim", 52], ["Al-Hijr", 99], ["An-Nahl", 128],
  ["Al-Isra", 111], ["Al-Kahf", 110], ["Maryam", 98], ["Ta-Ha", 135],
  ["Al-Anbya", 112], ["Al-Hajj", 78], ["Al-Mu'minun", 118], ["An-Nur", 64],
  ["Al-Furqan", 77], ["Ash-Shu'ara", 227], ["An-Naml", 93], ["Al-Qasas", 88],
  ["Al-'Ankabut", 69], ["Ar-Rum", 60], ["Luqman", 34], ["As-Sajdah", 30],
  ["Al-Ahzab", 73], ["Saba", 54], ["Fatir", 45], ["Ya-Sin", 83],
  ["As-Saffat", 182], ["Sad", 88], ["Az-Zumar", 75], ["Ghafir", 85],
  ["Fussilat", 54], ["Ash-Shura", 53], ["Az-Zukhruf", 89], ["Ad-Dukhan", 59],
  ["Al-Jathiyah", 37], ["Al-Ahqaf", 35], ["Muhammad", 38], ["Al-Fath", 29],
  ["Al-Hujurat", 18], ["Qaf", 45], ["Adh-Dhariyat", 60], ["At-Tur", 49],
  ["An-Najm", 62], ["Al-Qamar", 55], ["Ar-Rahman", 78], ["Al-Waqi'ah", 96],
  ["Al-Hadid", 29], ["Al-Mujadilah", 22], ["Al-Hashr", 24], ["Al-Mumtahanah", 13],
  ["As-Saff", 14], ["Al-Jumu'ah", 11], ["Al-Munafiqun", 11], ["At-Taghabun", 18],
  ["At-Talaq", 12], ["At-Tahrim", 12], ["Al-Mulk", 30], ["Al-Qalam", 52],
  ["Al-Haqqah", 52], ["Al-Ma'arij", 44], ["Nuh", 28], ["Al-Jinn", 28],
  ["Al-Muzzammil", 20], ["Al-Muddaththir", 56], ["Al-Qiyamah", 40], ["Al-Insan", 31],
  ["Al-Mursalat", 50], ["An-Naba", 40], ["An-Nazi'at", 46], ["'Abasa", 42],
  ["At-Takwir", 29], ["Al-Infitar", 19], ["Al-Mutaffifin", 36], ["Al-Inshiqaq", 25],
  ["Al-Buruj", 22], ["At-Tariq", 17], ["Al-A'la", 19], ["Al-Ghashiyah", 26],
  ["Al-Fajr", 30], ["Al-Balad", 20], ["Ash-Shams", 15], ["Al-Layl", 21],
  ["Ad-Duha", 11], ["Ash-Sharh", 8], ["At-Tin", 8], ["Al-'Alaq", 19],
  ["Al-Qadr", 5], ["Al-Bayyinah", 8], ["Az-Zalzalah", 8], ["Al-'Adiyat", 11],
  ["Al-Qari'ah", 11], ["At-Takathur", 8], ["Al-'Asr", 3], ["Al-Humazah", 9],
  ["Al-Fil", 5], ["Quraysh", 4], ["Al-Ma'un", 7], ["Al-Kawthar", 3],
  ["Al-Kafirun", 6], ["An-Nasr", 3], ["Al-Masad", 5], ["Al-Ikhlas", 4],
  ["Al-Falaq", 5], ["An-Nas", 6],
] as const satisfies readonly (readonly [string, number])[];

const surahData = surahRows.map(([name, ayahCount], index) => ({
  number: index + 1,
  name,
  ayahCount,
}));

const surahOffsets = new Map<number, number>();
let totalAyahs = 0;
for (const surah of surahData) {
  surahOffsets.set(surah.number, totalAyahs);
  totalAyahs += surah.ayahCount;
}

type VerseCoordinate = readonly [surah: number, ayah: number];

const juzStarts: readonly VerseCoordinate[] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111],
  [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75],
  [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

function ordinal([surahNumber, ayahNumber]: VerseCoordinate) {
  const offset = surahOffsets.get(surahNumber);
  if (offset === undefined) throw new Error(`Nomor surat ${surahNumber} tidak valid.`);
  return offset + ayahNumber - 1;
}

const juzRanges = juzStarts.map((start, index) => ({
  start: ordinal(start),
  end: (index === juzStarts.length - 1 ? totalAyahs : ordinal(juzStarts[index + 1])) - 1,
}));

export const QURAN_SURAHS: QuranSurah[] = surahData.map((surah) => {
  const start = surahOffsets.get(surah.number) ?? 0;
  const end = start + surah.ayahCount - 1;
  return {
    ...surah,
    juzStart: juzRanges.findIndex((range) => range.end >= start) + 1,
    juzEnd: juzRanges.findIndex((range) => range.end >= end) + 1,
  };
});

export function getJuzProgress(
  entries: readonly {
    surah_number: number | null;
    surah_awal_number?: number | null;
    surah_akhir_number?: number | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    ayat_akhir_surat?: number | null;
  }[],
) {
  return juzRanges.map(({ start, end }) => {
    const verses = new Set<number>();
    for (const entry of entries) {
      const startSurahNumber = entry.surah_awal_number ?? entry.surah_number;
      const endSurahNumber = entry.surah_akhir_number ?? entry.surah_number;
      if (startSurahNumber === null || startSurahNumber === undefined || endSurahNumber === null || endSurahNumber === undefined) continue;
      if (startSurahNumber < 1 || endSurahNumber > QURAN_SURAHS.length || startSurahNumber > endSurahNumber) continue;
      const startSurah = getSurah(startSurahNumber);
      const endSurah = getSurah(endSurahNumber);
      const first = ordinal([startSurahNumber, entry.ayat_awal ?? 1]);
      const lastAyah = entry.ayat_akhir_surat ?? entry.ayat_akhir ?? endSurah.ayahCount;
      const last = ordinal([endSurahNumber, lastAyah]);
      if (first > last || lastAyah > endSurah.ayahCount || (entry.ayat_awal ?? 1) > startSurah.ayahCount) continue;
      for (let verse = Math.max(first, start); verse <= Math.min(last, end); verse += 1) {
        verses.add(verse);
      }
    }
    const total = end - start + 1;
    return total ? Math.round((verses.size / total) * 100) : 0;
  });
}

export function getSurah(number: number) {
  return QURAN_SURAHS[number - 1];
}
