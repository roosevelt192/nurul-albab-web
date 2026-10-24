begin;

alter table public.santri
  alter column nis drop not null,
  alter column status drop default,
  alter column status type text using status::text,
  alter column status set default 'aktif',
  add column if not exists berkas_kk_path text,
  add column if not exists berkas_akta_path text,
  add column if not exists cita_cita text,
  add column if not exists riwayat_kesehatan text,
  add column if not exists nama_ayah text,
  add column if not exists nama_ibu text;

create table if not exists public.master_kitab (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  pengarang text,
  kategori text not null check (kategori in ('sorogan', 'matan')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.master_kitab
  add column if not exists is_active boolean not null default true;

alter table public.jurnal_keilmuan
  add column if not exists master_kitab_id uuid references public.master_kitab(id) on delete set null,
  add column if not exists surah_number smallint,
  add column if not exists cakupan_bacaan text;

create index if not exists master_kitab_kategori_active_idx
  on public.master_kitab (kategori, judul)
  where is_active;

alter table public.master_kitab enable row level security;

drop policy if exists "Staff can read master kitab" on public.master_kitab;
create policy "Staff can read master kitab"
on public.master_kitab for select to authenticated
using ((select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can insert master kitab" on public.master_kitab;
create policy "Staff can insert master kitab"
on public.master_kitab for insert to authenticated
with check ((select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can update master kitab" on public.master_kitab;
create policy "Staff can update master kitab"
on public.master_kitab for update to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can delete master kitab" on public.master_kitab;
create policy "Staff can delete master kitab"
on public.master_kitab for delete to authenticated
using ((select public.has_sprint_2_staff_access()));

grant select, insert, update, delete on public.master_kitab to authenticated;

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
  if new.status = 'pending_ppdb' then
    new.nis := null;
    return new;
  end if;

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

drop trigger if exists santri_assign_nis on public.santri;
create trigger santri_assign_nis
before insert or update of status, jenis_kelamin on public.santri
for each row execute function public.assign_santri_nis();

drop function if exists public.approve_ppdb_pendaftar(uuid, text, text);

create function public.approve_ppdb_pendaftar(
  p_santri_id uuid,
  p_class text,
  p_room text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  student public.santri%rowtype;
  generated_nis text;
  gender_digit text;
  nis_prefix text;
  next_sequence integer;
begin
  if not public.has_sprint_2_staff_access() then
    raise exception 'Akses staf diperlukan untuk menyetujui pendaftaran';
  end if;
  if nullif(btrim(p_class), '') is null or nullif(btrim(p_room), '') is null then
    raise exception 'Kelas dan kamar wajib ditentukan';
  end if;

  select * into student
    from public.santri
    where id = p_santri_id and status = 'pending_ppdb'
    for update;
  if not found then
    raise exception 'Santri dengan status pending PPDB tidak ditemukan';
  end if;

  gender_digit := case student.jenis_kelamin::text when 'L' then '1' when 'P' then '2' else null end;
  if gender_digit is null then
    raise exception 'Jenis kelamin diperlukan untuk membuat NIS';
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
  generated_nis := nis_prefix || lpad(next_sequence::text, 4, '0');

  update public.santri
    set status = 'aktif',
        nis = generated_nis,
        kelas_marhalah = btrim(p_class),
        kamar_asrama = btrim(p_room)
    where id = p_santri_id;

  return generated_nis;
end;
$$;

revoke all on function public.approve_ppdb_pendaftar(uuid, text, text) from public;
revoke all on function public.approve_ppdb_pendaftar(uuid, text, text) from anon;
grant execute on function public.approve_ppdb_pendaftar(uuid, text, text) to authenticated;

drop policy if exists "Public can submit PPDB applications" on public.ppdb_pendaftar;
drop policy if exists "Public can submit pending PPDB santri" on public.santri;
create policy "Public can submit pending PPDB santri"
on public.santri for insert to anon, authenticated
with check (status = 'pending_ppdb' and nis is null);
grant insert on public.santri to anon, authenticated;

insert into public.santri (
  nis, nisn, nik, nama_lengkap, tempat_lahir, tanggal_lahir, jenis_kelamin,
  konsulat, alamat_domisili, nama_wali, no_hp_wali, pekerjaan_wali,
  nama_ayah, nama_ibu, cita_cita, riwayat_kesehatan, status, created_at
)
select
  null, applicant.nisn, applicant.nik, applicant.nama_lengkap, applicant.tempat_lahir,
  applicant.tanggal_lahir, applicant.jenis_kelamin, applicant.konsulat,
  applicant.alamat_domisili, coalesce(nullif(applicant.nama_ayah, ''), applicant.nama_ibu),
  applicant.no_hp_wali, applicant.pekerjaan_wali, applicant.nama_ayah, applicant.nama_ibu,
  applicant.cita_cita, applicant.riwayat_kesehatan, 'pending_ppdb', applicant.created_at
from public.ppdb_pendaftar as applicant
where applicant.status = 'pending'
  and not exists (
    select 1 from public.santri as student
    where student.status = 'pending_ppdb'
      and student.nama_lengkap = applicant.nama_lengkap
      and student.nik is not distinct from applicant.nik
  );

delete from public.ppdb_pendaftar where status = 'pending';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('santri-berkas', 'santri-berkas', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload PPDB documents" on storage.objects;
create policy "Public can upload PPDB documents"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'santri-berkas');

drop policy if exists "Public can upload PPDB avatars" on storage.objects;
create policy "Public can upload PPDB avatars"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'santri-avatars');

drop policy if exists "Staff can read santri documents" on storage.objects;
create policy "Staff can read santri documents"
on storage.objects for select to authenticated
using (bucket_id = 'santri-berkas' and (select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can delete santri documents" on storage.objects;
create policy "Staff can delete santri documents"
on storage.objects for delete to authenticated
using (bucket_id = 'santri-berkas' and (select public.has_sprint_2_staff_access()));

commit;
