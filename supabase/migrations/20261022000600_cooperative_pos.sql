begin;

alter table public.produk_koperasi
  add column if not exists barcode text,
  add column if not exists category text not null default 'Lainnya',
  add column if not exists image_url text,
  add column if not exists min_stok integer not null default 5
    check (min_stok >= 0);

create unique index if not exists produk_koperasi_barcode_unique_idx
  on public.produk_koperasi (barcode)
  where barcode is not null and barcode <> '';

create table if not exists public.transaksi_penjualan (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  sold_at timestamptz not null default now(),
  cashier_id uuid references public.profiles(id) on delete set null,
  santri_id uuid references public.santri(id) on delete set null,
  customer_name text,
  total_amount numeric(14, 0) not null check (total_amount > 0),
  total_cost numeric(14, 0) not null check (total_cost >= 0),
  gross_profit numeric(14, 0) not null,
  cash_received numeric(14, 0) not null check (cash_received >= total_amount),
  change_amount numeric(14, 0) not null check (change_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.transaksi_penjualan_detail (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.transaksi_penjualan(id) on delete cascade,
  product_id uuid not null references public.produk_koperasi(id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  subtotal numeric(14, 0) not null check (subtotal >= 0),
  unit_price numeric(14, 0) not null check (unit_price >= 0),
  unit_cost numeric(14, 0) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists transaksi_penjualan_sold_at_idx
  on public.transaksi_penjualan (sold_at desc);
create index if not exists transaksi_penjualan_detail_sale_idx
  on public.transaksi_penjualan_detail (sale_id);

create or replace function public.has_cooperative_access()
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
      and profile.role::text = any (array['super_admin', 'bendahara', 'staf']::text[])
  );
$$;

revoke all on function public.has_cooperative_access() from public;
grant execute on function public.has_cooperative_access() to authenticated;

alter table public.produk_koperasi enable row level security;
alter table public.transaksi_penjualan enable row level security;
alter table public.transaksi_penjualan_detail enable row level security;

drop policy if exists "Cooperative staff manage products" on public.produk_koperasi;
create policy "Cooperative staff manage products"
on public.produk_koperasi for all to authenticated
using ((select public.has_cooperative_access()))
with check ((select public.has_cooperative_access()));

drop policy if exists "Cooperative staff read sales" on public.transaksi_penjualan;
create policy "Cooperative staff read sales"
on public.transaksi_penjualan for select to authenticated
using ((select public.has_cooperative_access()));

drop policy if exists "Cooperative staff read sale details" on public.transaksi_penjualan_detail;
create policy "Cooperative staff read sale details"
on public.transaksi_penjualan_detail for select to authenticated
using ((select public.has_cooperative_access()));

grant select, insert, update, delete on public.produk_koperasi to authenticated;
grant select on public.transaksi_penjualan, public.transaksi_penjualan_detail to authenticated;

create or replace function public.cooperative_list_students()
returns table (id uuid, nis text, nama_lengkap text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_cooperative_access() then
    raise exception 'Akses staf koperasi diperlukan';
  end if;

  return query
    select student.id, student.nis, student.nama_lengkap
    from public.santri as student
    where student.status = 'aktif'
    order by student.nama_lengkap;
end;
$$;

create or replace function public.cooperative_profile_names(p_profile_ids uuid[])
returns table (id uuid, nama_lengkap text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_cooperative_access() then
    raise exception 'Akses staf koperasi diperlukan';
  end if;

  return query
    select profile.id, profile.nama_lengkap
    from public.profiles as profile
    where profile.id = any(coalesce(p_profile_ids, array[]::uuid[]));
end;
$$;

create or replace function public.cooperative_restock_product(
  p_product_id uuid,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stock integer;
begin
  if not public.has_cooperative_access() then
    raise exception 'Akses staf koperasi diperlukan';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Jumlah stok masuk harus lebih dari nol';
  end if;

  update public.produk_koperasi
    set stock = stock + p_quantity,
        updated_at = now()
    where id = p_product_id and is_active
    returning stock into current_stock;

  if not found then
    raise exception 'Produk aktif tidak ditemukan';
  end if;

  return current_stock;
end;
$$;

create or replace function public.cooperative_checkout(
  p_items jsonb,
  p_cash_received numeric,
  p_santri_id uuid default null,
  p_customer_name text default null
)
returns table (sale_id uuid, receipt_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  product_row public.produk_koperasi%rowtype;
  account_row public.rekening_kas%rowtype;
  created_sale_id uuid;
  created_receipt text;
  total numeric(14, 0) := 0;
  total_cost numeric(14, 0) := 0;
  quantity integer;
  line_count integer := 0;
  received numeric(14, 0);
begin
  if not public.has_cooperative_access() then
    raise exception 'Akses staf koperasi diperlukan';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang belanja kosong';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item_row(value)
    group by item_row.value->>'product_id'
    having count(*) > 1
  ) then
    raise exception 'Produk duplikat dalam keranjang tidak diizinkan';
  end if;

  received := p_cash_received;
  for item in select value from jsonb_array_elements(p_items)
  loop
    if item->>'product_id' is null or coalesce(item->>'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Item transaksi tidak valid';
    end if;
    quantity := (item->>'quantity')::integer;

    select *
      into product_row
      from public.produk_koperasi
      where id = (item->>'product_id')::uuid and is_active
      for update;
    if not found then
      raise exception 'Produk aktif tidak ditemukan';
    end if;
    if product_row.stock < quantity then
      raise exception 'Stok % tidak mencukupi (tersedia %)', product_row.name, product_row.stock;
    end if;
    total := total + product_row.selling_price * quantity;
    total_cost := total_cost + product_row.cost_price * quantity;
    line_count := line_count + 1;
  end loop;

  if line_count <> jsonb_array_length(p_items) then
    raise exception 'Item keranjang duplikat tidak diizinkan';
  end if;
  if received is null or received < total or received <> trunc(received) then
    raise exception 'Uang diterima tidak mencukupi atau tidak valid';
  end if;
  if p_santri_id is not null and not exists (
    select 1 from public.santri
    where id = p_santri_id and status = 'aktif'
  ) then
    raise exception 'Pembeli santri aktif tidak ditemukan';
  end if;
  if p_santri_id is null and nullif(btrim(p_customer_name), '') is null then
    p_customer_name := 'Pelanggan Umum';
  end if;

  select *
    into account_row
    from public.rekening_kas
    where is_active
      and lower(btrim(name)) in ('kas tunai', 'kas utama')
    order by case when lower(btrim(name)) = 'kas tunai' then 0 else 1 end
    limit 1
    for update;
  if not found then
    raise exception 'Rekening aktif Kas Tunai (atau Kas Utama) tidak ditemukan';
  end if;

  created_receipt := 'KOP-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.transaksi_penjualan (
    receipt_number, cashier_id, santri_id, customer_name, total_amount, total_cost,
    gross_profit, cash_received, change_amount
  ) values (
    created_receipt, auth.uid(), p_santri_id, nullif(btrim(p_customer_name), ''),
    total, total_cost, total - total_cost, received, received - total
  )
  returning id into created_sale_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := (item->>'quantity')::integer;
    select * into product_row
      from public.produk_koperasi
      where id = (item->>'product_id')::uuid
      for update;

    insert into public.transaksi_penjualan_detail (
      sale_id, product_id, product_name, sku, quantity, subtotal, unit_price, unit_cost
    ) values (
      created_sale_id, product_row.id, product_row.name, product_row.sku,
      quantity, product_row.selling_price * quantity, product_row.selling_price, product_row.cost_price
    );

    update public.produk_koperasi
      set stock = stock - quantity,
          updated_at = now()
      where id = product_row.id;
  end loop;

  insert into public.jurnal_kas (
    account_id, created_by, transaction_date, proof_number, type, category, description, amount
  ) values (
    account_row.id, auth.uid(), current_date, created_receipt, 'kredit',
    'Penjualan Koperasi', 'Penerimaan transaksi koperasi ' || created_receipt, total
  );

  update public.rekening_kas
    set balance = balance + total,
        updated_at = now()
    where id = account_row.id;

  return query select created_sale_id, created_receipt;
end;
$$;

revoke all on function public.cooperative_list_students() from public;
revoke all on function public.cooperative_profile_names(uuid[]) from public;
revoke all on function public.cooperative_restock_product(uuid, integer) from public;
revoke all on function public.cooperative_checkout(jsonb, numeric, uuid, text) from public;
grant execute on function public.cooperative_list_students() to authenticated;
grant execute on function public.cooperative_profile_names(uuid[]) to authenticated;
grant execute on function public.cooperative_restock_product(uuid, integer) to authenticated;
grant execute on function public.cooperative_checkout(jsonb, numeric, uuid, text) to authenticated;

commit;
