begin;

alter table public.pengaturan_pesantren
  add column if not exists hero_badge text not null default 'Ruang Tumbuh untuk Ilmu dan Akhlak',
  add column if not exists hero_title text not null default 'Menjaga ilmu, menumbuhkan adab.',
  add column if not exists hero_subtitle text not null default 'Pondok Pesantren Nurul Albab mendampingi santri belajar, menghafal, dan bertumbuh dalam lingkungan yang hangat, disiplin, serta penuh keberkahan.',
  add column if not exists hero_quote text not null default 'Sebaik-baik kalian adalah orang yang belajar Al-Qur''an dan mengajarkannya.',
  add column if not exists hero_quote_source text not null default 'HR. Bukhari',
  add column if not exists tentang_title text not null default 'Pesantren sebagai rumah untuk bertumbuh.',
  add column if not exists tentang_deskripsi text not null default 'Nurul Albab hadir mendampingi perjalanan santri dalam menuntut ilmu agama, memadukan tradisi kitab turots dengan keteladanan akhlak nabawiyah.',
  add column if not exists ppdb_gelombang text not null default 'Gelombang I — T.A 2026/2027',
  add column if not exists ppdb_status text not null default 'Pendaftaran Sedang Dibuka',
  add column if not exists ppdb_brosur_url text not null default '',
  add column if not exists whatsapp_center text not null default '081234567890',
  add column if not exists jam_operasional text not null default 'Senin - Ahad, 08.00 - 16.00 WIB',
  add column if not exists alamat_lengkap text not null default 'Jl. Pesantren No. 01, Cisarua, Bogor, Jawa Barat',
  add column if not exists sosmed_instagram text not null default '@nurulalbab.official';

drop policy if exists "Pengaturan lembaga dapat dibaca publik" on public.pengaturan_pesantren;
create policy "Pengaturan lembaga dapat dibaca publik"
on public.pengaturan_pesantren
for select
to anon, authenticated
using (true);

grant select on public.pengaturan_pesantren to anon, authenticated;

notify pgrst, 'reload schema';
commit;
