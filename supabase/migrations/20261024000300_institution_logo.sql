begin;

alter table public.pengaturan_pesantren
  add column if not exists logo_size text not null default 'medium';

alter table public.pengaturan_pesantren
  drop constraint if exists pengaturan_pesantren_logo_size_check;

alter table public.pengaturan_pesantren
  add constraint pengaturan_pesantren_logo_size_check
  check (logo_size in ('small', 'medium', 'proportional'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pesantren',
  'pesantren',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view pesantren assets" on storage.objects;
create policy "Public can view pesantren assets"
on storage.objects for select
to public
using (bucket_id = 'pesantren');

drop policy if exists "Staff can upload pesantren assets" on storage.objects;
create policy "Staff can upload pesantren assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'pesantren' and (select public.has_sprint_2_staff_access()));

drop policy if exists "Staff can delete pesantren assets" on storage.objects;
create policy "Staff can delete pesantren assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'pesantren' and (select public.has_sprint_2_staff_access()));

commit;
