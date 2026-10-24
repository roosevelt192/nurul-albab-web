begin;

alter table public.profiles
  add column if not exists no_hp text;

alter table public.santri
  add column if not exists parent_id uuid;

do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select constraint_row.conname
    from pg_constraint as constraint_row
    join pg_attribute as column_row
      on column_row.attrelid = constraint_row.conrelid
      and column_row.attnum = any (constraint_row.conkey)
    where constraint_row.conrelid = 'public.santri'::regclass
      and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'f'
      and column_row.attname = 'parent_id'
      and constraint_row.confdeltype <> 'c'
  loop
    execute format('alter table public.santri drop constraint %I', existing_constraint.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    join pg_attribute as column_row
      on column_row.attrelid = constraint_row.conrelid
      and column_row.attnum = any (constraint_row.conkey)
    where constraint_row.conrelid = 'public.santri'::regclass
      and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'f'
      and column_row.attname = 'parent_id'
      and constraint_row.confdeltype = 'c'
  ) then
    alter table public.santri
      add constraint santri_parent_id_fkey
      foreign key (parent_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

commit;
