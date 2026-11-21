-- Esegui questo script nel SQL Editor del tuo progetto Supabase.
-- Si può rieseguire senza problemi: aggiunge solo ciò che manca.

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

-- Etichetta e checklist (aggiunte nella versione 2).
alter table public.tasks add column if not exists tag       text  not null default '';
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;

-- Invia le modifiche complete (anche i DELETE) ai client in ascolto.
alter table public.tasks replica identity full;

-- Abilita il tempo reale sulla tabella (ignora l'errore se è già abilitato).
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

-- Accesso: chiunque abbia l'URL dell'app e la chiave pubblica può leggere e scrivere.
-- Va bene per un team piccolo; per limitare l'accesso aggiungi Supabase Auth.
alter table public.tasks enable row level security;

-- I progetti Supabase recenti non danno più accesso automatico alle tabelle:
-- permetti alle chiavi pubbliche (publishable/anon) di usare la tabella.
grant select, insert, update, delete on public.tasks to anon, authenticated;

drop policy if exists "team can read"   on public.tasks;
drop policy if exists "team can write"  on public.tasks;

create policy "team can read"  on public.tasks for select using (true);
create policy "team can write" on public.tasks for all    using (true) with check (true);
