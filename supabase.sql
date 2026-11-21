-- Esegui TUTTO questo script nel SQL Editor del tuo progetto Supabase.
-- Si può rieseguire senza problemi: crea solo ciò che manca e non cancella dati.

-- ============ Attività (bacheca) ============
create table if not exists public.tasks (
  id          uuid primary key,
  title       text not null default '',
  notes       text not null default '',
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee    text not null default '',
  due         date,
  position    double precision not null default 0,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.tasks add column if not exists tag       text  not null default '';
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;

-- ============ Pagine (documenti liberi con allegati) ============
create table if not exists public.pages (
  id          uuid primary key,
  title       text not null default '',
  icon        text not null default '📄',
  content     text not null default '',
  files       jsonb not null default '[]'::jsonb,
  position    double precision not null default 0,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============ Tempo reale e permessi (per entrambe le tabelle) ============
alter table public.tasks replica identity full;
alter table public.pages replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.pages;
exception when duplicate_object then null;
end $$;

-- Chiunque abbia l'URL dell'app e la chiave pubblica può leggere e scrivere.
-- Va bene per un team piccolo; per limitare l'accesso aggiungi Supabase Auth.
alter table public.tasks enable row level security;
alter table public.pages enable row level security;
grant select, insert, update, delete on public.tasks to anon, authenticated;
grant select, insert, update, delete on public.pages to anon, authenticated;

drop policy if exists "team can read"  on public.tasks;
drop policy if exists "team can write" on public.tasks;
create policy "team can read"  on public.tasks for select using (true);
create policy "team can write" on public.tasks for all    using (true) with check (true);

drop policy if exists "team can read"  on public.pages;
drop policy if exists "team can write" on public.pages;
create policy "team can read"  on public.pages for select using (true);
create policy "team can write" on public.pages for all    using (true) with check (true);

-- ============ Allegati (Supabase Storage) ============
-- Cartella "attachments", file fino a 25 MB. I file sono raggiungibili da chi ha il link.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', true, 26214400)
on conflict (id) do nothing;

drop policy if exists "team attachments read"   on storage.objects;
drop policy if exists "team attachments upload" on storage.objects;
drop policy if exists "team attachments delete" on storage.objects;
create policy "team attachments read"   on storage.objects for select using (bucket_id = 'attachments');
create policy "team attachments upload" on storage.objects for insert with check (bucket_id = 'attachments');
create policy "team attachments delete" on storage.objects for delete using (bucket_id = 'attachments');
