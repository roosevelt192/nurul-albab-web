begin;

alter table public.tagihan_santri
  add column if not exists component_id uuid references public.komponen_iuran(id) on delete set null;

create unique index if not exists tagihan_santri_component_period_unique_idx
  on public.tagihan_santri (santri_id, component_id, month, year)
  where component_id is not null;

create or replace function public.has_finance_staff_access()
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
      and profile.role::text = any (array['super_admin', 'bendahara']::text[])
  );
$$;

revoke all on function public.has_finance_staff_access() from public;
grant execute on function public.has_finance_staff_access() to authenticated;

alter table public.rekening_kas enable row level security;
alter table public.jurnal_kas enable row level security;
alter table public.komponen_iuran enable row level security;
alter table public.tagihan_santri enable row level security;
alter table public.pembayaran_iuran enable row level security;

drop policy if exists "Finance staff manage cash accounts" on public.rekening_kas;
create policy "Finance staff manage cash accounts"
on public.rekening_kas for all to authenticated
using ((select public.has_finance_staff_access()))
with check ((select public.has_finance_staff_access()));

drop policy if exists "Dashboard staff read active cash balances" on public.rekening_kas;
create policy "Dashboard staff read active cash balances"
on public.rekening_kas for select to authenticated
using (
  is_active
  and (
    (select public.has_sprint_2_staff_access())
    or (select public.has_finance_staff_access())
  )
);

drop policy if exists "Finance staff manage cash journal" on public.jurnal_kas;
create policy "Finance staff manage cash journal"
on public.jurnal_kas for all to authenticated
using ((select public.has_finance_staff_access()))
with check ((select public.has_finance_staff_access()));

drop policy if exists "Finance staff manage charge components" on public.komponen_iuran;
create policy "Finance staff manage charge components"
on public.komponen_iuran for all to authenticated
using ((select public.has_finance_staff_access()))
with check ((select public.has_finance_staff_access()));

drop policy if exists "Finance staff manage student invoices" on public.tagihan_santri;
create policy "Finance staff manage student invoices"
on public.tagihan_santri for all to authenticated
using ((select public.has_finance_staff_access()))
with check ((select public.has_finance_staff_access()));

drop policy if exists "Finance staff manage invoice payments" on public.pembayaran_iuran;
create policy "Finance staff manage invoice payments"
on public.pembayaran_iuran for all to authenticated
using ((select public.has_finance_staff_access()))
with check ((select public.has_finance_staff_access()));

grant select, insert, update, delete on public.rekening_kas to authenticated;
grant select, insert, update, delete on public.jurnal_kas to authenticated;
grant select, insert, update, delete on public.komponen_iuran to authenticated;
grant select, insert, update, delete on public.tagihan_santri to authenticated;
grant select, insert, update, delete on public.pembayaran_iuran to authenticated;

create or replace function public.finance_profile_names(p_profile_ids uuid[])
returns table (id uuid, nama_lengkap text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;

  return query
    select profile.id, profile.nama_lengkap
    from public.profiles as profile
    where profile.id = any(coalesce(p_profile_ids, array[]::uuid[]));
end;
$$;

create or replace function public.finance_list_students()
returns table (id uuid, nis text, nama_lengkap text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;

  return query
    select student.id, student.nis, student.nama_lengkap, student.status::text
    from public.santri as student
    where student.status <> 'pending_ppdb'
    order by student.nama_lengkap;
end;
$$;

create or replace function public.finance_record_cash_movement(
  p_account_id uuid,
  p_type text,
  p_category text,
  p_description text,
  p_amount numeric,
  p_transaction_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.rekening_kas%rowtype;
  generated_proof text;
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;
  if p_type not in ('debit', 'kredit') then
    raise exception 'Jenis mutasi kas tidak valid';
  end if;
  if p_transaction_date is null then
    raise exception 'Tanggal transaksi wajib diisi';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Nominal mutasi harus berupa bilangan bulat lebih dari nol';
  end if;
  if nullif(btrim(p_category), '') is null or nullif(btrim(p_description), '') is null then
    raise exception 'Kategori dan keterangan mutasi wajib diisi';
  end if;

  select *
    into account_row
    from public.rekening_kas
    where id = p_account_id and is_active
    for update;

  if not found then
    raise exception 'Rekening kas aktif tidak ditemukan';
  end if;
  if p_type = 'debit' and account_row.balance < p_amount then
    raise exception 'Saldo rekening tidak mencukupi untuk pengeluaran ini';
  end if;

  generated_proof := 'KAS-' || to_char(p_transaction_date, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.jurnal_kas (
    account_id, created_by, transaction_date, proof_number, type, category, description, amount
  ) values (
    p_account_id, auth.uid(), p_transaction_date, generated_proof, p_type,
    btrim(p_category), btrim(p_description), p_amount
  );

  update public.rekening_kas
    set balance = balance + case when p_type = 'kredit' then p_amount else -p_amount end,
        updated_at = now()
    where id = p_account_id;

  return generated_proof;
end;
$$;

create or replace function public.finance_generate_invoices(
  p_component_id uuid,
  p_month integer,
  p_year integer,
  p_student_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  component_row public.komponen_iuran%rowtype;
  inserted_count integer;
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;
  if p_month is null or p_month not between 1 and 12 or
     p_year is null or p_year < 2020 or p_year > 9999 then
    raise exception 'Periode tagihan tidak valid';
  end if;
  if p_student_ids is not null and cardinality(p_student_ids) = 0 then
    raise exception 'Pilih setidaknya satu santri';
  end if;

  perform pg_advisory_xact_lock(hashtext(
    p_component_id::text || ':' || p_month::text || ':' || p_year::text
  ));

  select *
    into component_row
    from public.komponen_iuran
    where id = p_component_id and is_active
    for share;

  if not found then
    raise exception 'Komponen iuran aktif tidak ditemukan';
  end if;
  if component_row.amount <= 0 then
    raise exception 'Tarif komponen harus lebih dari nol';
  end if;

  insert into public.tagihan_santri (
    santri_id, component_id, month, year, total_amount, paid_amount, is_paid
  )
  select student.id, component_row.id, p_month, p_year, component_row.amount, 0, false
  from public.santri as student
  where student.status = 'aktif'
    and (p_student_ids is null or student.id = any(p_student_ids))
  on conflict (santri_id, component_id, month, year) where component_id is not null
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.finance_receive_invoice_payment(
  p_invoice_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.tagihan_santri%rowtype;
  account_row public.rekening_kas%rowtype;
  payment_id uuid;
  generated_proof text;
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;
  if p_method not in ('tunai', 'transfer') then
    raise exception 'Metode pembayaran tidak valid';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Nominal pembayaran harus berupa bilangan bulat lebih dari nol';
  end if;

  select *
    into invoice_row
    from public.tagihan_santri
    where id = p_invoice_id
    for update;
  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;
  if invoice_row.is_paid or p_amount > invoice_row.total_amount - invoice_row.paid_amount then
    raise exception 'Nominal pembayaran melebihi sisa tagihan atau tagihan sudah lunas';
  end if;

  select *
    into account_row
    from public.rekening_kas
    where id = p_account_id and is_active
    for update;
  if not found then
    raise exception 'Rekening kas aktif tidak ditemukan';
  end if;

  insert into public.pembayaran_iuran (
    invoice_id, amount, method, received_by, paid_at
  ) values (
    p_invoice_id, p_amount, p_method, auth.uid(), now()
  )
  returning id into payment_id;

  update public.tagihan_santri
    set paid_amount = paid_amount + p_amount,
        is_paid = paid_amount + p_amount >= total_amount
    where id = p_invoice_id;

  generated_proof := 'IUR-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(payment_id::text, '-', ''), 1, 8));

  insert into public.jurnal_kas (
    account_id, created_by, transaction_date, proof_number, type, category, description, amount
  ) values (
    p_account_id, auth.uid(), current_date, generated_proof, 'kredit', 'Iuran Santri',
    'Pembayaran iuran santri untuk tagihan ' || p_invoice_id::text, p_amount
  );

  update public.rekening_kas
    set balance = balance + p_amount,
        updated_at = now()
    where id = p_account_id;

  return payment_id;
end;
$$;

revoke all on function public.finance_profile_names(uuid[]) from public;
revoke all on function public.finance_list_students() from public;
revoke all on function public.finance_record_cash_movement(uuid, text, text, text, numeric, date) from public;
revoke all on function public.finance_generate_invoices(uuid, integer, integer, uuid[]) from public;
revoke all on function public.finance_receive_invoice_payment(uuid, uuid, numeric, text) from public;
grant execute on function public.finance_profile_names(uuid[]) to authenticated;
grant execute on function public.finance_list_students() to authenticated;
grant execute on function public.finance_record_cash_movement(uuid, text, text, text, numeric, date) to authenticated;
grant execute on function public.finance_generate_invoices(uuid, integer, integer, uuid[]) to authenticated;
grant execute on function public.finance_receive_invoice_payment(uuid, uuid, numeric, text) to authenticated;

commit;
