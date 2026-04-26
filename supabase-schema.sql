-- Run this in your Supabase SQL Editor (Database → SQL Editor → New query)

create table if not exists transactions (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date text not null,
  vendor text not null,
  category text not null,
  amount numeric(10,2) not null,
  method text,
  job_number text,
  note text,
  type text not null default 'expense'
);

create table if not exists vendors (
  id bigint generated always as identity primary key,
  name_normalized text unique not null,
  name_display text not null,
  category text not null,
  created_at timestamptz default now()
);

create table if not exists jobs (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  job_number text,
  customer text,
  location text,
  start_date text,
  end_date text,
  invoice_amount numeric(10,2) default 0,
  materials numeric(10,2) default 0,
  helper_days numeric(5,1) default 0,
  helper_cost numeric(10,2) default 0,
  other_expenses numeric(10,2) default 0,
  notes text,
  status text default 'active'
);

create table if not exists settings (
  id bigint generated always as identity primary key,
  key text unique not null,
  value text
);

insert into settings (key, value) values
  ('w2_salary', '52000'),
  ('revenue_target', '120000'),
  ('federal_tax_rate', '0.22'),
  ('state_tax_rate', '0.0425'),
  ('helper_day_rate', '280')
on conflict (key) do nothing;

-- Reconciliation table
create table if not exists reconciliations (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  period_label text not null,
  statement_date text not null,
  opening_balance numeric(10,2) default 0,
  closing_balance_statement numeric(10,2) not null,
  closing_balance_books numeric(10,2),
  difference numeric(10,2),
  status text default 'open'
);

create table if not exists reconciliation_items (
  id bigint generated always as identity primary key,
  reconciliation_id bigint references reconciliations(id) on delete cascade,
  transaction_id bigint,
  transaction_type text,
  cleared boolean default false
);

-- Add cleared + reconciled columns to transactions
alter table transactions add column if not exists cleared boolean default false;
alter table transactions add column if not exists reconciliation_id bigint;

-- Additional settings
insert into settings (key, value) values
  ('opening_balance', '0'),
  ('ytd_payroll_paid', '0')
on conflict (key) do nothing;
