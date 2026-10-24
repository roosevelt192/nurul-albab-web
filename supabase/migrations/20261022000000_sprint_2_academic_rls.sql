begin;

alter table public.jurnal_keilmuan
  add column if not exists mode_setoran text
    check (mode_setoran in ('ziyadah', 'murojaah')),
  add column if not exists bab_kajian text;

alter table public.perizinan_santri
  add column if not exists kedatangan_aktual timestamptz;

create or replace function public.has_sprint_2_staff_access()
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
      and profile.role::text = any (array['staf', 'super_admin']::text[])
  );
$$;

revoke all on function public.has_sprint_2_staff_access() from public;
grant execute on function public.has_sprint_2_staff_access() to authenticated;

alter table public.santri enable row level security;
alter table public.jurnal_keilmuan enable row level security;
alter table public.perizinan_santri enable row level security;

drop policy if exists "Sprint 2 staff manage santri" on public.santri;
create policy "Sprint 2 staff manage santri"
on public.santri
for all
to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));

drop policy if exists "Sprint 2 staff manage jurnal keilmuan" on public.jurnal_keilmuan;
create policy "Sprint 2 staff manage jurnal keilmuan"
on public.jurnal_keilmuan
for all
to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));

drop policy if exists "Sprint 2 staff manage perizinan santri" on public.perizinan_santri;
create policy "Sprint 2 staff manage perizinan santri"
on public.perizinan_santri
for all
to authenticated
using ((select public.has_sprint_2_staff_access()))
with check ((select public.has_sprint_2_staff_access()));

grant select, insert, update, delete
on public.santri, public.jurnal_keilmuan, public.perizinan_santri
to authenticated;

commit;
