-- ============================================================================
-- supabase/sync_all_schema_and_rpc.sql
-- Sinkronisasi skema dan fungsi RPC untuk NAIS (Nurul Albab System).
-- IDEMPOTEN: aman dijalankan berulang kali di SQL Editor Supabase.
-- Akhir: NOTIFY pgrst, 'reload schema' agar PostgREST muat ulang cache skema.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Tambahkan kolom alias (Indonesia <-> Inggris) di semua tabel utama.
--    Semua kolom alias ditambahkan sebagai NULLABLE (tanpa NOT NULL) agar
--    tidak memicu constraint violation saat salah satu alias dikosongkan.
-- ============================================================================

-- produk_koperasi
alter table if exists public.produk_koperasi
  add column if not exists nama_produk text,
  add column if not exists kode_barang text,
  add column if not exists hpp numeric(14, 0),
  add column if not exists harga_jual numeric(14, 0),
  add column if not exists stok integer,
  add column if not exists min_stok integer,
  add column if not exists satuan text,
  add column if not exists kategori text,
  add column if not exists name text,
  add column if not exists sku text,
  add column if not exists cost_price numeric(14, 0),
  add column if not exists selling_price numeric(14, 0),
  add column if not exists stock integer,
  add column if not exists min_stock integer,
  add column if not exists unit text,
  add column if not exists category text;

-- rekening_kas
alter table if exists public.rekening_kas
  add column if not exists nama_kas text,
  add column if not exists saldo numeric(14, 0),
  add column if not exists nama text,
  add column if not exists account_number text,
  add column if not exists balance numeric(14, 0),
  add column if not exists opening_balance numeric(14, 0);
-- jurnal_kas
alter table if exists public.jurnal_kas
  add column if not exists rekening_id uuid,
  add column if not exists tanggal timestamptz,
  add column if not exists nomor_bukti text,
  add column if not exists kategori text,
  add column if not exists keterangan text,
  add column if not exists nominal numeric(14, 0),
  add column if not exists account_id uuid,
  add column if not exists transaction_date timestamptz,
  add column if not exists proof_number text,
  add column if not exists description text,
  add column if not exists amount numeric(14, 0);

-- komponen_iuran
alter table if exists public.komponen_iuran
  add column if not exists nama_pos text,
  add column if not exists tarif_default numeric(14, 0),
  add column if not exists name text,
  add column if not exists amount numeric(14, 0);

-- tagihan_santri
alter table if exists public.tagihan_santri
  add column if not exists komponen_id uuid,
  add column if not exists nominal numeric(14, 0),
  add column if not exists terbayar numeric(14, 0),
  add column if not exists component_id uuid,
  add column if not exists total_amount numeric(14, 0),
  add column if not exists paid_amount numeric(14, 0);

-- pembayaran_iuran
alter table if exists public.pembayaran_iuran
  add column if not exists tagihan_id uuid,
  add column if not exists nominal numeric(14, 0),
  add column if not exists metode text,
  add column if not exists invoice_id uuid,
  add column if not exists amount numeric(14, 0),
  add column if not exists method text;

-- santri
alter table if exists public.santri
  add column if not exists name text,
  add column if not exists student_name text;

-- perizinan_santri
alter table if exists public.perizinan_santri
  add column if not exists student_id uuid;

-- transaksi_penjualan / detail
alter table if exists public.transaksi_penjualan
  add column if not exists customer_name text,
  add column if not exists receipt_number text,
  add column if not exists sold_at timestamptz,
  add column if not exists total_amount numeric(14, 0),
  add column if not exists total_cost numeric(14, 0),
  add column if not exists gross_profit numeric(14, 0),
  add column if not exists cash_received numeric(14, 0),
  add column if not exists change_amount numeric(14, 0),
  add column if not exists created_at timestamptz;

alter table if exists public.transaksi_penjualan_detail
  add column if not exists product_name text,
  add column if not exists sku text,
  add column if not exists quantity integer,
  add column if not exists subtotal numeric(14, 0),
  add column if not exists unit_price numeric(14, 0),
  add column if not exists unit_cost numeric(14, 0),
  add column if not exists created_at timestamptz;

-- ============================================================================
-- 2. Lepas constraint NOT NULL kaku pada kolom duplikat / alias.
--    Default dipertahankan pada kolom inti; alias baru dikosongkan (nullable)
--    dan disinkronkan oleh trigger di bawah.
-- ============================================================================

alter table if exists public.produk_koperasi
  alter column nama_produk drop not null,
  alter column kode_barang drop not null,
  alter column hpp drop not null,
  alter column harga_jual drop not null,
  alter column stok drop not null,
  alter column min_stok drop not null,
  alter column satuan drop not null,
  alter column kategori drop not null,
  alter column name drop not null,
  alter column sku drop not null,
  alter column cost_price drop not null,
  alter column selling_price drop not null,
  alter column stock drop not null,
  alter column min_stock drop not null,
  alter column unit drop not null,
  alter column category drop not null;

alter table if exists public.rekening_kas
  alter column nama_kas drop not null,
  alter column saldo drop not null,
  alter column nama drop not null,
  alter column account_number drop not null,
  alter column balance drop not null,
  alter column opening_balance drop not null;

alter table if exists public.jurnal_kas
  alter column rekening_id drop not null,
  alter column tanggal drop not null,
  alter column nomor_bukti drop not null,
  alter column kategori drop not null,
  alter column keterangan drop not null,
  alter column nominal drop not null,
  alter column account_id drop not null,
  alter column transaction_date drop not null,
  alter column proof_number drop not null,
  alter column description drop not null,
  alter column amount drop not null;

alter table if exists public.komponen_iuran
  alter column nama_pos drop not null,
  alter column tarif_default drop not null,
  alter column name drop not null,
  alter column amount drop not null;

alter table if exists public.tagihan_santri
  alter column komponen_id drop not null,
  alter column nominal drop not null,
  alter column terbayar drop not null,
  alter column component_id drop not null,
  alter column total_amount drop not null,
  alter column paid_amount drop not null;

alter table if exists public.pembayaran_iuran
  alter column tagihan_id drop not null,
  alter column nominal drop not null,
  alter column metode drop not null,
  alter column invoice_id drop not null,
  alter column amount drop not null,
  alter column method drop not null;

alter table if exists public.santri
  alter column name drop not null,
  alter column student_name drop not null;

alter table if exists public.perizinan_santri
  alter column student_id drop not null;

-- ============================================================================
-- 3. Trigger sinkronisasi otomatis antar kolom Indonesia <-> Inggris.
--    Saat insert/update, kolom yang kosong diisi dari pasangannya (coalesce),
--    sehingga frontend boleh mengirim salah satu atau keduanya.
-- ============================================================================

create or replace function public.sync_produk_koperasi_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.nama_produk := coalesce(new.nama_produk, new.name);
    new.name := coalesce(new.name, new.nama_produk);
    new.kode_barang := coalesce(new.kode_barang, new.sku);
    new.sku := coalesce(new.sku, new.kode_barang);
    new.hpp := coalesce(new.hpp, new.cost_price);
    new.cost_price := coalesce(new.cost_price, new.hpp);
    new.harga_jual := coalesce(new.harga_jual, new.selling_price);
    new.selling_price := coalesce(new.selling_price, new.harga_jual);
    new.stok := coalesce(new.stok, new.stock);
    new.stock := coalesce(new.stock, new.stok);
    new.min_stok := coalesce(new.min_stok, new.min_stock);
    new.min_stock := coalesce(new.min_stock, new.min_stok);
    new.satuan := coalesce(new.satuan, new.unit);
    new.unit := coalesce(new.unit, new.satuan);
    new.kategori := coalesce(new.kategori, new.category);
    new.category := coalesce(new.category, new.kategori);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_produk_koperasi_aliases on public.produk_koperasi;
create trigger trg_sync_produk_koperasi_aliases
  before insert or update on public.produk_koperasi
  for each row execute function public.sync_produk_koperasi_aliases();

create or replace function public.sync_rekening_kas_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.nama_kas := coalesce(new.nama_kas, new.nama);
    new.nama := coalesce(new.nama, new.nama_kas);
    new.saldo := coalesce(new.saldo, new.balance);
    new.balance := coalesce(new.balance, new.saldo);
    new.account_number := coalesce(new.account_number, new.no_rekening);
    new.opening_balance := coalesce(new.opening_balance, new.saldo_awal);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_rekening_kas_aliases on public.rekening_kas;
create trigger trg_sync_rekening_kas_aliases
  before insert or update on public.rekening_kas
  for each row execute function public.sync_rekening_kas_aliases();

create or replace function public.sync_jurnal_kas_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.rekening_id := coalesce(new.rekening_id, new.account_id);
    new.account_id := coalesce(new.account_id, new.rekening_id);
    new.tanggal := coalesce(new.tanggal, new.transaction_date);
    new.transaction_date := coalesce(new.transaction_date, new.tanggal);
    new.nomor_bukti := coalesce(new.nomor_bukti, new.proof_number);
    new.proof_number := coalesce(new.proof_number, new.nomor_bukti);
    new.kategori := coalesce(new.kategori, new.category);
    new.category := coalesce(new.category, new.kategori);
    new.keterangan := coalesce(new.keterangan, new.description);
    new.description := coalesce(new.description, new.keterangan);
    new.nominal := coalesce(new.nominal, new.amount);
    new.amount := coalesce(new.amount, new.nominal);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_jurnal_kas_aliases on public.jurnal_kas;
create trigger trg_sync_jurnal_kas_aliases
  before insert or update on public.jurnal_kas
  for each row execute function public.sync_jurnal_kas_aliases();

create or replace function public.sync_komponen_iuran_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.nama_pos := coalesce(new.nama_pos, new.name);
    new.name := coalesce(new.name, new.nama_pos);
    new.tarif_default := coalesce(new.tarif_default, new.amount);
    new.amount := coalesce(new.amount, new.tarif_default);
    new.kategori := coalesce(new.kategori, new.category);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_komponen_iuran_aliases on public.komponen_iuran;
create trigger trg_sync_komponen_iuran_aliases
  before insert or update on public.komponen_iuran
  for each row execute function public.sync_komponen_iuran_aliases();

create or replace function public.sync_tagihan_santri_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.komponen_id := coalesce(new.komponen_id, new.component_id);
    new.component_id := coalesce(new.component_id, new.komponen_id);
    new.nominal := coalesce(new.nominal, new.total_amount);
    new.total_amount := coalesce(new.total_amount, new.nominal);
    new.terbayar := coalesce(new.terbayar, new.paid_amount);
    new.paid_amount := coalesce(new.paid_amount, new.terbayar);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_tagihan_santri_aliases on public.tagihan_santri;
create trigger trg_sync_tagihan_santri_aliases
  before insert or update on public.tagihan_santri
  for each row execute function public.sync_tagihan_santri_aliases();

create or replace function public.sync_pembayaran_iuran_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.tagihan_id := coalesce(new.tagihan_id, new.invoice_id);
    new.invoice_id := coalesce(new.invoice_id, new.tagihan_id);
    new.nominal := coalesce(new.nominal, new.amount);
    new.amount := coalesce(new.amount, new.nominal);
    new.metode := coalesce(new.metode, new.method);
    new.method := coalesce(new.method, new.metode);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_pembayaran_iuran_aliases on public.pembayaran_iuran;
create trigger trg_sync_pembayaran_iuran_aliases
  before insert or update on public.pembayaran_iuran
  for each row execute function public.sync_pembayaran_iuran_aliases();

-- ============================================================================
-- 4. Perbaiki fungsi RPC dengan casting tipe eksplisit
--    agar bebas dari error "structure of query does not match function result type".
-- ============================================================================

-- cooperative_list_students
create or replace function public.cooperative_list_students()
returns table (id uuid, nis text, nama_lengkap text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id::uuid as id,
    coalesce(s.nis, '')::text as nis,
    coalesce(s.nama_lengkap, '')::text as nama_lengkap
  from public.santri as s
  where s.status = 'aktif'
  order by coalesce(s.nama_lengkap, '') collate "id-ID";
$$;

revoke all on function public.cooperative_list_students() from public;
grant execute on function public.cooperative_list_students() to authenticated;

-- cooperative_profile_names
create or replace function public.cooperative_profile_names(p_profile_ids uuid[])
returns table (id uuid, nama_lengkap text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id::uuid as id,
    coalesce(p.nama_lengkap, '')::text as nama_lengkap
  from public.profiles as p
  where p.id = any (p_profile_ids);
$$;

revoke all on function public.cooperative_profile_names(uuid[]) from public;
grant execute on function public.cooperative_profile_names(uuid[]) to authenticated;

-- cooperative_restock_product
create or replace function public.cooperative_restock_product(
  p_product_id uuid,
  p_quantity integer
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  new_stock numeric;
begin
  update public.produk_koperasi
    set stock = coalesce(stock, 0) + p_quantity,
        stok = coalesce(stok, 0) + p_quantity,
        updated_at = now()
  where id = p_product_id::uuid
  returning coalesce(stock, stok)::numeric into new_stock;

  if not found then
    raise exception 'Produk koperasi tidak ditemukan';
  end if;

  return new_stock;
end;
$$;

revoke all on function public.cooperative_restock_product(uuid, integer) from public;
grant execute on function public.cooperative_restock_product(uuid, integer) to authenticated;

-- cooperative_checkout
create or replace function public.cooperative_checkout(
  p_items jsonb,
  p_cash_received numeric,
  p_santri_id uuid,
  p_customer_name text
)
returns table (sale_id uuid, receipt_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_row public.rekening_kas%rowtype;
  created_sale_id uuid;
  created_receipt text;
  total numeric(14, 0) := 0;
  total_cost numeric(14, 0) := 0;
  received numeric(14, 0) := coalesce(p_cash_received, 0)::numeric;
  item record;
  product_row public.produk_koperasi%rowtype;
  quantity integer;
  line_count integer := 0;
begin
  if not public.has_cooperative_access() then
    raise exception 'Akses koperasi diperlukan';
  end if;

  if received is null or received <> trunc(received) then
    raise exception 'Uang diterima tidak valid';
  end if;

  if p_santri_id is not null and not exists (
    select 1 from public.santri
    where id = p_santri_id::uuid and status = 'aktif'
  ) then
    raise exception 'Pembeli santri aktif tidak ditemukan';
  end if;

  if p_santri_id is null and nullif(btrim(p_customer_name::text), '') is null then
    p_customer_name := 'Pelanggan Umum';
  end if;

  select count(*) into line_count
  from jsonb_array_elements(p_items) as it(value);

  created_receipt := 'KOP-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.transaksi_penjualan (
    receipt_number, cashier_id, santri_id, customer_name,
    total_amount, total_cost, gross_profit, cash_received, change_amount
  ) values (
    created_receipt::text, auth.uid()::uuid, p_santri_id::uuid,
    nullif(btrim(p_customer_name::text), ''),
    total::numeric(14, 0), total_cost::numeric(14, 0),
    (total - total_cost)::numeric(14, 0),
    received::numeric(14, 0),
    (received - total)::numeric(14, 0)
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
      sale_id, product_id, product_name, sku, quantity,
      subtotal, unit_price, unit_cost
    ) values (
      created_sale_id::uuid, product_row.id::uuid,
      coalesce(product_row.nama_produk, product_row.name)::text,
      coalesce(product_row.sku, product_row.kode_barang)::text,
      quantity::integer,
      (coalesce(product_row.selling_price, product_row.harga_jual, 0)::numeric(14, 0) * quantity)::numeric(14, 0),
      coalesce(product_row.selling_price, product_row.harga_jual, 0)::numeric(14, 0),
      coalesce(product_row.cost_price, product_row.hpp, 0)::numeric(14, 0)
    );

    update public.produk_koperasi
      set stock = coalesce(stock, 0) - quantity,
          stok = coalesce(stok, 0) - quantity,
          updated_at = now()
      where id = product_row.id::uuid;

    total := total + (coalesce(product_row.selling_price, product_row.harga_jual, 0)::numeric(14, 0) * quantity);
    total_cost := total_cost + (coalesce(product_row.cost_price, product_row.hpp, 0)::numeric(14, 0) * quantity);
  end loop;

  update public.transaksi_penjualan
    set total_amount = total::numeric(14, 0),
        total_cost = total_cost::numeric(14, 0),
        gross_profit = (total - total_cost)::numeric(14, 0),
        change_amount = (received - total)::numeric(14, 0)
    where id = created_sale_id::uuid;

  select row into account_row
    from public.rekening_kas
    where is_active
      and lower(btrim(coalesce(nama_kas, nama)::text)) in ('kas tunai', 'kas utama')
    order by case when lower(btrim(coalesce(nama_kas, nama)::text)) = 'kas tunai' then 0 else 1 end
    limit 1
    for update;

  if not found then
    raise exception 'Rekening aktif Kas Tunai (atau Kas Utama) tidak ditemukan';
  end if;

  insert into public.jurnal_kas (
    account_id, created_by, transaction_date, proof_number,
    type, category, description, amount
  ) values (
    account_row.id::uuid, auth.uid()::uuid, current_date, created_receipt::text,
    'kredit', 'Penjualan Koperasi',
    'Penerimaan transaksi koperasi ' || created_receipt::text,
    total::numeric(14, 0)
  );

  update public.rekening_kas
    set balance = coalesce(balance, 0) + total,
        updated_at = now()
    where id = account_row.id::uuid;

  return query
    select created_sale_id::uuid as sale_id, created_receipt::text as receipt_number;
end;
$$;

revoke all on function public.cooperative_checkout(jsonb, numeric, uuid, text) from public;
grant execute on function public.cooperative_checkout(jsonb, numeric, uuid, text) to authenticated;

-- approve_ppdb_pendaftar (arg disesuaikan dengan frontend: p_santri_id)
create or replace function public.approve_ppdb_pendaftar(
  p_santri_id uuid,
  p_class text,
  p_room text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  generated_nis text;
begin
  update public.santri
    set status = 'aktif',
        kelas_marhalah = coalesce(nullif(btrim(p_class::text), ''), kelas_marhalah),
        kamar_asrama = coalesce(nullif(btrim(p_room::text), ''), kamar_asrama),
        updated_at = now()
  where id = p_santri_id::uuid
  returning nis into generated_nis;

  if not found then
    raise exception 'Santri tidak ditemukan';
  end if;

  return coalesce(generated_nis, p_santri_id::text);
end;
$$;

revoke all on function public.approve_ppdb_pendaftar(uuid, text, text) from public;
grant execute on function public.approve_ppdb_pendaftar(uuid, text, text) to authenticated;

-- finance_list_students
create or replace function public.finance_list_students()
returns table (id uuid, nis text, nama_lengkap text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id::uuid as id,
    coalesce(s.nis, '')::text as nis,
    coalesce(s.nama_lengkap, '')::text as nama_lengkap,
    coalesce(s.status, 'aktif')::text as status
  from public.santri as s
  where s.status <> 'pending_ppdb';
$$;

revoke all on function public.finance_list_students() from public;
grant execute on function public.finance_list_students() to authenticated;

-- finance_generate_invoices
create or replace function public.finance_generate_invoices(
  p_component_id uuid,
  p_month integer,
  p_year integer,
  p_student_ids uuid[]
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  student record;
  comp_amount numeric(14, 0) := 0;
begin
  select coalesce(amount, tarif_default, 0)::numeric(14, 0)
    into comp_amount
    from public.komponen_iuran
    where id = p_component_id::uuid
    limit 1;

  for student in
    select id from public.santri
    where status <> 'pending_ppdb'
      and (p_student_ids is null or id = any (p_student_ids))
  loop
    insert into public.tagihan_santri (
      santri_id, component_id, month, year,
      total_amount, paid_amount, is_paid
    ) values (
      student.id::uuid, p_component_id::uuid,
      p_month::integer, p_year::integer,
      comp_amount, 0, false
    )
    on conflict (santri_id, component_id, month, year)
    where component_id is not null
    do nothing;

    get diagnostics inserted_count = row_count + inserted_count;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.finance_generate_invoices(uuid, integer, integer, uuid[]) from public;
grant execute on function public.finance_generate_invoices(uuid, integer, integer, uuid[]) to authenticated;
-- finance_receive_invoice_payment
create or replace function public.finance_receive_invoice_payment(
  p_invoice_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language plpgsql
stable
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

  if p_method::text not in ('tunai', 'transfer') then
    raise exception 'Metode pembayaran tidak valid';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Nominal pembayaran harus berupa bilangan bulat lebih dari nol';
  end if;

  select * into invoice_row
    from public.tagihan_santri
    where id = p_invoice_id::uuid
    for update;

  if not found then
    raise exception 'Tagihan tidak ditemukan';
  end if;

  if invoice_row.is_paid or p_amount > invoice_row.total_amount - invoice_row.paid_amount then
    raise exception 'Nominal pembayaran melebihi sisa tagihan atau tagihan sudah lunas';
  end if;

  select * into account_row
    from public.rekening_kas
    where id = p_account_id::uuid and is_active
    for update;

  if not found then
    raise exception 'Rekening kas aktif tidak ditemukan';
  end if;

  insert into public.pembayaran_iuran (
    invoice_id, amount, method, received_by, paid_at
  ) values (
    p_invoice_id::uuid, p_amount::numeric(14, 0),
    p_method::text, auth.uid()::uuid, now()
  )
  returning id into payment_id;

  update public.tagihan_santri
    set paid_amount = coalesce(paid_amount, 0) + p_amount,
        is_paid = coalesce(paid_amount, 0) + p_amount >= total_amount,
        terbayar = coalesce(terbayar, 0) + p_amount,
        nominal = coalesce(nominal, total_amount)
    where id = p_invoice_id::uuid;

  generated_proof := 'IUR-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(payment_id::text, '-', ''), 1, 8));

  insert into public.jurnal_kas (
    account_id, created_by, transaction_date, proof_number,
    type, category, description, amount
  ) values (
    p_account_id::uuid, auth.uid()::uuid, current_date, generated_proof::text,
    'kredit', 'Iuran Santri',
    'Pembayaran iuran santri untuk tagihan ' || p_invoice_id::text,
    p_amount::numeric(14, 0)
  );

  update public.rekening_kas
    set balance = coalesce(balance, 0) + p_amount,
        updated_at = now()
    where id = p_account_id::uuid;

  return payment_id::uuid;
end;
$$;

revoke all on function public.finance_receive_invoice_payment(uuid, uuid, numeric, text) from public;
grant execute on function public.finance_receive_invoice_payment(uuid, uuid, numeric, text) to authenticated;

-- finance_record_cash_movement
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
stable
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if not public.has_finance_staff_access() then
    raise exception 'Akses bendahara diperlukan';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari nol';
  end if;

  insert into public.jurnal_kas (
    account_id, transaction_date, proof_number, type,
    category, description, amount, created_by
  ) values (
    p_account_id::uuid, p_transaction_date::date,
    ('TRX-' || to_char(now(), 'YYYYMMDDHH24MISS'))::text,
    p_type::text, p_category::text, p_description::text,
    p_amount::numeric(14, 0), auth.uid()::uuid
  )
  returning id into created_id;

  update public.rekening_kas
    set balance = balance +
      case when lower(p_type::text) = 'kredit' then p_amount else - p_amount end,
        updated_at = now()
    where id = p_account_id::uuid;

  return created_id::text;
end;
$$;

revoke all on function public.finance_record_cash_movement(uuid, text, text, text, numeric, date) from public;
grant execute on function public.finance_record_cash_movement(uuid, text, text, text, numeric, date) to authenticated;

-- finance_profile_names
create or replace function public.finance_profile_names(p_profile_ids uuid[])
returns table (id uuid, nama_lengkap text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id::uuid as id,
    coalesce(p.nama_lengkap, '')::text as nama_lengkap
  from public.profiles as p
  where p.id = any (p_profile_ids);
$$;

revoke all on function public.finance_profile_names(uuid[]) from public;
grant execute on function public.finance_profile_names(uuid[]) to authenticated;

-- ============================================================================
-- 5. Muat ulang cache skema PostgREST setelah semua perubahan.
-- ============================================================================

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
end
$$;

commit;

-- ============================================================================
-- Selesai. Jalankan skrip ini di Supabase SQL Editor, lalu verifikasi
-- dengan `npx tsc --noEmit` dan refresh tipe Supabase jika diperlukan.
-- ============================================================================


