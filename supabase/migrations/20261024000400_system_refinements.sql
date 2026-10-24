begin;

alter table public.pengaturan_pesantren
  add column if not exists logo_height text not null default 'h-10',
  add column if not exists logo_options jsonb not null default '{}'::jsonb,
  add column if not exists show_logo_navbar boolean not null default true,
  add column if not exists show_logo_sidebar boolean not null default true,
  add column if not exists show_logo_kuitansi boolean not null default true;

alter table public.pengaturan_pesantren
  drop constraint if exists pengaturan_pesantren_logo_height_check;
alter table public.pengaturan_pesantren
  add constraint pengaturan_pesantren_logo_height_check
  check (logo_height in ('h-8', 'h-10', 'h-14'));

create table if not exists public.kategori_produk (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  icon text not null default 'package'
    check (icon in ('utensils-crossed', 'pencil', 'book-open', 'shirt', 'package', 'coffee', 'apple', 'backpack')),
  created_at timestamptz not null default now()
);

insert into public.kategori_produk (name, icon)
values
  ('Alat Tulis', 'pencil'),
  ('Kitab', 'book-open'),
  ('Makanan/Minuman', 'utensils-crossed'),
  ('Seragam', 'shirt'),
  ('Lainnya', 'package')
on conflict (name) do nothing;

alter table public.kategori_produk enable row level security;
drop policy if exists "Staff can read cooperative categories" on public.kategori_produk;
create policy "Staff can read cooperative categories"
on public.kategori_produk for select to authenticated
using ((select public.has_sprint_2_staff_access()));
drop policy if exists "Staff can manage cooperative categories" on public.kategori_produk;
create policy "Staff can manage cooperative categories"
on public.kategori_produk for all to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));
grant select, insert, update, delete on public.kategori_produk to authenticated;

drop function if exists public.manage_profile_access(uuid, text, boolean);
create or replace function public.manage_profile_access(
  p_profile_id uuid,
  p_role text,
  p_is_active boolean,
  p_full_name text default null
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
  v_full_name text := nullif(trim(p_full_name), '');
begin
  if not public.has_system_admin_access() then
    raise exception 'Akses super admin diperlukan' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nais-manage-profile-access'));

  if p_profile_id is null
    or p_role is null
    or p_role not in ('super_admin', 'bendahara', 'staf', 'wali_santri')
    or p_is_active is null
    or (p_full_name is not null and length(trim(p_full_name)) = 0)
    or (p_full_name is not null and length(trim(p_full_name)) > 200)
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

  if v_current_role = 'super_admin' and (p_role <> 'super_admin' or not p_is_active) then
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
  join pg_catalog.pg_class as profile_table on profile_table.oid = role_column.attrelid
  join pg_catalog.pg_namespace as table_namespace on table_namespace.oid = profile_table.relnamespace
  join pg_catalog.pg_type as role_type on role_type.oid = role_column.atttypid
  join pg_catalog.pg_namespace as type_namespace on type_namespace.oid = role_type.typnamespace
  where table_namespace.nspname = 'public'
    and profile_table.relname = 'profiles'
    and role_column.attname = 'role'
    and not role_column.attisdropped;

  if v_role_type is null then
    raise exception 'Tipe kolom role profil tidak ditemukan' using errcode = '42704';
  end if;

  execute format(
    'update public.profiles set role = $1::%s, is_active = $2, full_name = coalesce($3, full_name), nama_lengkap = coalesce($3, nama_lengkap) where id = $4',
    v_role_type
  )
  using p_role, p_is_active, v_full_name, p_profile_id;
end;
$$;
revoke all on function public.manage_profile_access(uuid, text, boolean, text) from public;
grant execute on function public.manage_profile_access(uuid, text, boolean, text) to authenticated;

create or replace function public.create_staff_profile_for_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'nama_lengkap'), '');
  v_role text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'staf');
  v_role_type text;
begin
  if v_role not in ('bendahara', 'staf') then
    v_role := 'staf';
  end if;
  if v_name is null then
    v_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'Pengurus Baru');
  end if;

  select format('%I.%I', type_namespace.nspname, role_type.typname)
  into v_role_type
  from pg_catalog.pg_attribute as role_column
  join pg_catalog.pg_class as profile_table on profile_table.oid = role_column.attrelid
  join pg_catalog.pg_namespace as table_namespace on table_namespace.oid = profile_table.relnamespace
  join pg_catalog.pg_type as role_type on role_type.oid = role_column.atttypid
  join pg_catalog.pg_namespace as type_namespace on type_namespace.oid = role_type.typnamespace
  where table_namespace.nspname = 'public'
    and profile_table.relname = 'profiles'
    and role_column.attname = 'role'
    and not role_column.attisdropped;

  if v_role_type is null then
    raise exception 'Tipe kolom role profil tidak ditemukan';
  end if;

  execute format(
    'insert into public.profiles (id, nama_lengkap, full_name, role, is_active) values ($1, $2, $2, $3::%s, false) on conflict (id) do nothing',
    v_role_type
  )
  using new.id, v_name, v_role;
  return new;
end;
$$;

drop trigger if exists nais_create_staff_profile on auth.users;
create trigger nais_create_staff_profile
after insert on auth.users
for each row execute function public.create_staff_profile_for_signup();

revoke all on function public.create_staff_profile_for_signup() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
