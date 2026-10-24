begin;

create table if not exists public.pengaturan_pesantren (
  id uuid primary key default gen_random_uuid(),
  nama_pesantren text not null default 'Pondok Pesantren Nurul Albab',
  pengasuh text not null default 'K.H. Ahmad Dahlan',
  alamat text not null default 'Jl. Pesantren No. 01',
  telepon text not null default '08123456789',
  email text not null default 'pesantren@nurulalbab.id',
  logo_url text,
  footer_kuitansi text not null default 'Jazakumullah Khairan Katsiran atas partisipasi Anda mendidik generasi Qur''ani.',
  pos_printer_width varchar(10) not null default '58mm',
  updated_at timestamptz not null default now()
);

alter table public.pengaturan_pesantren
  add column if not exists nama_pesantren text default 'Pondok Pesantren Nurul Albab',
  add column if not exists pengasuh text default 'K.H. Ahmad Dahlan',
  add column if not exists alamat text default 'Jl. Pesantren No. 01',
  add column if not exists telepon text default '08123456789',
  add column if not exists email text default 'pesantren@nurulalbab.id',
  add column if not exists logo_url text,
  add column if not exists footer_kuitansi text default 'Jazakumullah Khairan Katsiran atas partisipasi Anda mendidik generasi Qur''ani.',
  add column if not exists pos_printer_width varchar(10) default '58mm',
  add column if not exists updated_at timestamptz default now();

create unique index if not exists pengaturan_pesantren_singleton_idx
  on public.pengaturan_pesantren ((true));

insert into public.pengaturan_pesantren (nama_pesantren)
select 'Pondok Pesantren Nurul Albab'
where not exists (select 1 from public.pengaturan_pesantren);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists is_active boolean not null default true;

update public.profiles
set full_name = nama_lengkap
where full_name is null and nama_lengkap is not null;

create or replace function public.has_system_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role::text = 'super_admin'
      and profile.is_active
  );
$$;

revoke all on function public.has_system_admin_access() from public;
grant execute on function public.has_system_admin_access() to authenticated;

alter table public.pengaturan_pesantren enable row level security;
drop policy if exists "Pengaturan lembaga dapat dibaca publik" on public.pengaturan_pesantren;
create policy "Pengaturan lembaga dapat dibaca publik"
on public.pengaturan_pesantren
for select
to anon, authenticated
using (true);

drop policy if exists "Super admin mengubah pengaturan lembaga" on public.pengaturan_pesantren;
create policy "Super admin mengubah pengaturan lembaga"
on public.pengaturan_pesantren
for update
to authenticated
using ((select public.has_system_admin_access()))
with check ((select public.has_system_admin_access()));

drop policy if exists "Super admin menambahkan pengaturan lembaga" on public.pengaturan_pesantren;
create policy "Super admin menambahkan pengaturan lembaga"
on public.pengaturan_pesantren
for insert
to authenticated
with check ((select public.has_system_admin_access()));

grant select on public.pengaturan_pesantren to anon, authenticated;
grant insert, update on public.pengaturan_pesantren to authenticated;

create or replace function public.list_profile_access()
returns table (
  id uuid,
  nama_lengkap text,
  full_name text,
  role text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_system_admin_access() then
    raise exception 'Akses super admin diperlukan' using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.nama_lengkap,
    profile.full_name,
    profile.role::text,
    profile.is_active
  from public.profiles as profile
  order by coalesce(profile.full_name, profile.nama_lengkap, '');
end;
$$;

revoke all on function public.list_profile_access() from public;
grant execute on function public.list_profile_access() to authenticated;

create or replace function public.manage_profile_access(
  p_profile_id uuid,
  p_role text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_role_type text;
  v_admin_count integer;
begin
  if not public.has_system_admin_access() then
    raise exception 'Akses super admin diperlukan' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nais-manage-profile-access')
  );

  if p_profile_id is null
    or p_role is null
    or p_role not in ('super_admin', 'bendahara', 'staf', 'wali_santri')
    or p_is_active is null
  then
    raise exception 'Data hak akses tidak valid' using errcode = '22023';
  end if;

  if p_profile_id = (select auth.uid()) then
    raise exception 'Hak akses dan status akun sendiri tidak dapat diubah' using errcode = '22023';
  end if;

  select profile.role::text
  into v_current_role
  from public.profiles as profile
  where profile.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profil pengguna tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_current_role = 'super_admin'
    and (p_role <> 'super_admin' or not p_is_active)
  then
    select count(*)
    into v_admin_count
    from public.profiles as profile
    where profile.role::text = 'super_admin'
      and profile.is_active
      and profile.id <> p_profile_id;

    if v_admin_count = 0 then
      raise exception 'Sistem harus memiliki minimal satu super admin aktif' using errcode = '22023';
    end if;
  end if;

  select format('%I.%I', type_namespace.nspname, role_type.typname)
  into v_role_type
  from pg_catalog.pg_attribute as role_column
  join pg_catalog.pg_class as profile_table
    on profile_table.oid = role_column.attrelid
  join pg_catalog.pg_namespace as table_namespace
    on table_namespace.oid = profile_table.relnamespace
  join pg_catalog.pg_type as role_type
    on role_type.oid = role_column.atttypid
  join pg_catalog.pg_namespace as type_namespace
    on type_namespace.oid = role_type.typnamespace
  where table_namespace.nspname = 'public'
    and profile_table.relname = 'profiles'
    and role_column.attname = 'role'
    and not role_column.attisdropped;

  if v_role_type is null then
    raise exception 'Tipe kolom role profil tidak ditemukan' using errcode = '42704';
  end if;

  execute format(
    'update public.profiles set role = $1::%s, is_active = $2 where id = $3',
    v_role_type
  )
  using p_role, p_is_active, p_profile_id;
end;
$$;

revoke all on function public.manage_profile_access(uuid, text, boolean) from public;
grant execute on function public.manage_profile_access(uuid, text, boolean) to authenticated;

create or replace function public.get_portal_wali_data(
  p_nis text,
  p_tgl_lahir date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_santri public.santri%rowtype;
  v_keuangan jsonb;
  v_pembayaran jsonb;
  v_keilmuan jsonb;
  v_perizinan jsonb;
begin
  if p_nis is null
    or length(trim(p_nis)) < 2
    or length(trim(p_nis)) > 32
    or p_tgl_lahir is null
    or p_tgl_lahir > current_date
  then
    return null;
  end if;

  select student.*
  into v_santri
  from public.santri as student
  where student.nis = trim(p_nis)
    and student.tanggal_lahir = p_tgl_lahir
    and student.status <> 'pending_ppdb'
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bulan', coalesce((to_jsonb(invoice)->>'month')::integer, extract(month from invoice.created_at)::integer),
        'tahun', coalesce((to_jsonb(invoice)->>'year')::integer, extract(year from invoice.created_at)::integer),
        'nominal', coalesce(nullif(to_jsonb(invoice)->>'total_amount', '')::numeric, nullif(to_jsonb(invoice)->>'nominal', '')::numeric, 0),
        'terbayar', coalesce(nullif(to_jsonb(invoice)->>'paid_amount', '')::numeric, nullif(to_jsonb(invoice)->>'terbayar', '')::numeric, 0),
        'status', coalesce(
          nullif(to_jsonb(invoice)->>'status', ''),
          case
            when coalesce(nullif(to_jsonb(invoice)->>'is_paid', '')::boolean, false) then 'lunas'
            else 'belum_lunas'
          end
        ),
        'kode_tagihan', to_jsonb(invoice)->>'kode_tagihan',
        'komponen', coalesce(
          to_jsonb(component)->>'nama_pos',
          to_jsonb(component)->>'nama_komponen',
          to_jsonb(component)->>'name',
          'Iuran Pondok'
        )
      )
      order by invoice.created_at desc
    ),
    '[]'::jsonb
  )
  into v_keuangan
  from public.tagihan_santri as invoice
  left join public.komponen_iuran as component
    on component.id::text = coalesce(
      to_jsonb(invoice)->>'component_id',
      to_jsonb(invoice)->>'komponen_id'
    )
  where invoice.santri_id = v_santri.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nominal', payment.amount,
        'tanggal', payment.paid_at,
        'metode', payment.method,
        'komponen', coalesce(
          to_jsonb(component)->>'nama_pos',
          to_jsonb(component)->>'name',
          'Iuran Pondok'
        )
      )
      order by payment.paid_at desc
    ),
    '[]'::jsonb
  )
  into v_pembayaran
  from public.pembayaran_iuran as payment
  join public.tagihan_santri as invoice
    on invoice.id = payment.invoice_id
  left join public.komponen_iuran as component
    on component.id = invoice.component_id
  where invoice.santri_id = v_santri.id;

  select coalesce(
    jsonb_agg(journal.entry order by journal.created_at desc),
    '[]'::jsonb
  )
  into v_keilmuan
  from (
    select
      record.created_at,
      jsonb_build_object(
        'tanggal', coalesce(to_jsonb(record)->>'tanggal', record.created_at::text),
        'kategori', coalesce(to_jsonb(record)->>'kategori_jurnal', to_jsonb(record)->>'jenis', 'Keilmuan'),
        'judul_kitab', coalesce(
          to_jsonb(record)->>'nama_kitab',
          to_jsonb(record)->>'nama_surat',
          to_jsonb(record)->>'bab_kajian',
          '-'
        ),
        'hanca', coalesce(
          to_jsonb(record)->>'cakupan_bacaan',
          to_jsonb(record)->>'ayat_awal',
          to_jsonb(record)->>'juz',
          '-'
        ),
        'predikat', coalesce(to_jsonb(record)->>'kelancaran', to_jsonb(record)->>'predikat', 'mumtaz')
      ) as entry
    from public.jurnal_keilmuan as record
    where record.santri_id = v_santri.id
    order by record.created_at desc
    limit 20
  ) as journal;

  select coalesce(
    jsonb_agg(permit.entry order by permit.created_at desc),
    '[]'::jsonb
  )
  into v_perizinan
  from (
    select
      record.created_at,
      jsonb_build_object(
        'keperluan', coalesce(
          to_jsonb(record)->>'alasan_izin',
          to_jsonb(record)->>'keperluan',
          to_jsonb(record)->>'alasan',
          '-'
        ),
        'status', coalesce(to_jsonb(record)->>'status', 'kembali'),
        'waktu_keluar', coalesce(to_jsonb(record)->>'tanggal_keluar', record.created_at::text),
        'batas_kembali', to_jsonb(record)->>'batas_kembali',
        'waktu_kembali', coalesce(to_jsonb(record)->>'kedatangan_aktual', to_jsonb(record)->>'waktu_kembali')
      ) as entry
    from public.perizinan_santri as record
    where record.santri_id = v_santri.id
    order by record.created_at desc
    limit 10
  ) as permit;

  return jsonb_build_object(
    'santri', jsonb_build_object(
      'nis', v_santri.nis,
      'nama_lengkap', v_santri.nama_lengkap,
      'jenis_kelamin', v_santri.jenis_kelamin,
      'kelas', coalesce(v_santri.kelas_marhalah, '-'),
      'kamar', coalesce(v_santri.kamar_asrama, '-'),
      'konsulat', coalesce(v_santri.konsulat, '-'),
      'status', coalesce(v_santri.status, 'aktif'),
      'foto_url', v_santri.foto_url
    ),
    'keuangan', jsonb_build_object(
      'tagihan', v_keuangan,
      'pembayaran', v_pembayaran
    ),
    'keilmuan', v_keilmuan,
    'perizinan', v_perizinan
  );
end;
$$;

revoke all on function public.get_portal_wali_data(text, date) from public;
grant execute on function public.get_portal_wali_data(text, date) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
