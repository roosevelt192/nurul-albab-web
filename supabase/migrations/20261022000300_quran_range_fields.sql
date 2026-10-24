begin;

alter table public.jurnal_keilmuan
  add column if not exists surah_awal_number smallint,
  add column if not exists surah_akhir_number smallint,
  add column if not exists ayat_akhir_surat smallint;

commit;
