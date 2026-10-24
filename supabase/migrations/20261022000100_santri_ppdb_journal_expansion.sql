begin;

alter table public.santri
  add column if not exists tempat_lahir text,
  add column if not exists tanggal_lahir date,
  add column if not exists konsulat text,
  add column if not exists alamat_domisili text,
  add column if not exists foto_url text,
  add column if not exists nama_wali text,
  add column if not exists no_hp_wali text,
  add column if not exists pekerjaan_wali text;

alter table public.jurnal_keilmuan
  add column if not exists kategori_jurnal text not null default 'quran'
    check (kategori_jurnal in ('sorogan', 'quran', 'matan')),
  add column if not exists bait_awal integer,
  add column if not exists bait_akhir integer,
  add column if not exists predikat text
    check (predikat in ('mumtaz', 'jayyid', 'dhoif')),
  add column if not exists lulus_tasmi boolean;

update public.jurnal_keilmuan
  set kategori_jurnal = case when jenis::text = 'kitab' then 'sorogan' else 'quran' end
  where kategori_jurnal = 'quran';

create table if not exists public.ppdb_pendaftar (
  id uuid primary key default gen_random_uuid(),
  nama_lengkap text not null,
  nisn text,
  nik text,
  tempat_lahir text not null,
  tanggal_lahir date not null,
  jenis_kelamin public.jenis_kelamin not null,
  cita_cita text,
  riwayat_kesehatan text,
  nama_ayah text not null,
  nama_ibu text not null,
  pekerjaan_wali text not null,
  no_hp_wali text not null,
  konsulat text,
  alamat_domisili text not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  linked_santri_id uuid references public.santri(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ppdb_pendaftar_pending_created_idx
  on public.ppdb_pendaftar (created_at desc)
  where status = 'pending';

create or replace function public.assign_santri_nis()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  gender_digit text;
  nis_prefix text;
  next_sequence integer;
begin
  if new.nis is not null and btrim(new.nis) <> '' then
    return new;
  end if;

  gender_digit := case new.jenis_kelamin::text
    when 'L' then '1'
    when 'P' then '2'
    else null
  end;

  if gender_digit is null then
    raise exception 'Jenis kelamin diperlukan untuk membuat NIS otomatis';
  end if;

  nis_prefix := to_char(current_date, 'YYYY') || gender_digit;
  perform pg_advisory_xact_lock(hashtext(nis_prefix));

  select coalesce(max(substring(s.nis from 6 for 4)::integer), 0) + 1
    into next_sequence
    from public.santri as s
    where s.nis ~ ('^' || nis_prefix || '[0-9]{4}$');

  if next_sequence > 9999 then
    raise exception 'Nomor urut NIS tahun ini sudah mencapai batas';
  end if;

  new.nis := nis_prefix || lpad(next_sequence::text, 4, '0');
  return new;
end;
$$;
revoke all on function public.assign_santri_nis() from public;

drop trigger if exists santri_assign_nis on public.santri;
create trigger santri_assign_nis
before insert on public.santri
for each row execute function public.assign_santri_nis();

create or replace function public.approve_ppdb_pendaftar(
  p_application_id uuid,
  p_class text,
  p_room text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  applicant public.ppdb_pendaftar%rowtype;
  generated_nis text;
  inserted_santri_id uuid;
begin
  if not public.has_sprint_2_staff_access() then
    raise exception 'Akses staf diperlukan untuk menyetujui pendaftaran';
  end if;

  select *
    into applicant
    from public.ppdb_pendaftar
    where id = p_application_id and status = 'pending'
    for update;

  if not found then
    raise exception 'Pendaftaran pending tidak ditemukan';
  end if;

  insert into public.santri (
    nis, nisn, nik, nama_lengkap, tempat_lahir, tanggal_lahir, jenis_kelamin,
    konsulat, alamat_domisili, nama_wali, no_hp_wali, pekerjaan_wali,
    kamar_asrama, kelas_marhalah, status
  ) values (
    '', applicant.nisn, applicant.nik, applicant.nama_lengkap, applicant.tempat_lahir,
    applicant.tanggal_lahir, applicant.jenis_kelamin, applicant.konsulat,
    applicant.alamat_domisili, coalesce(nullif(applicant.nama_ayah, ''), applicant.nama_ibu),
    applicant.no_hp_wali, applicant.pekerjaan_wali, nullif(p_room, ''), nullif(p_class, ''), 'aktif'
  )
  returning nis, id into generated_nis, inserted_santri_id;

  update public.ppdb_pendaftar
    set status = 'approved', linked_santri_id = inserted_santri_id
    where id = p_application_id;

  return generated_nis;
end;
$$;
revoke all on function public.approve_ppdb_pendaftar(uuid, text, text) from public;
revoke all on function public.approve_ppdb_pendaftar(uuid, text, text) from anon;

alter table public.ppdb_pendaftar enable row level security;

drop policy if exists "Public can submit PPDB applications" on public.ppdb_pendaftar;
create policy "Public can submit PPDB applications"
on public.ppdb_pendaftar
for insert
to anon, authenticated
with check (status = 'pending' and linked_santri_id is null);

drop policy if exists "Staff can review PPDB applications" on public.ppdb_pendaftar;
create policy "Staff can review PPDB applications"
on public.ppdb_pendaftar
for select
to authenticated
using ((select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can update PPDB applications" on public.ppdb_pendaftar;
create policy "Staff can update PPDB applications"
on public.ppdb_pendaftar
for update
to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can delete PPDB applications" on public.ppdb_pendaftar;
create policy "Staff can delete PPDB applications"
on public.ppdb_pendaftar
for delete
to authenticated
using ((select public.has_sprint_2_staff_access()));

grant insert on public.ppdb_pendaftar to anon, authenticated;
grant select, update, delete on public.ppdb_pendaftar to authenticated;
grant execute on function public.approve_ppdb_pendaftar(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('santri-avatars', 'santri-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view santri avatars" on storage.objects;
create policy "Public can view santri avatars"
on storage.objects for select
to public
using (bucket_id = 'santri-avatars');

drop policy if exists "Staff can upload santri avatars" on storage.objects;
create policy "Staff can upload santri avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'santri-avatars' and (select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can update santri avatars" on storage.objects;
create policy "Staff can update santri avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'santri-avatars' and (select public.has_sprint_2_staff_access()))
with check (bucket_id = 'santri-avatars' and (select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can delete santri avatars" on storage.objects;
create policy "Staff can delete santri avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'santri-avatars' and (select public.has_sprint_2_staff_access()));

commit;
