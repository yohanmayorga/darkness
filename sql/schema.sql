-- ============================================================================
-- DARKNESS — Esquema SQL para Supabase (PostgreSQL + Row Level Security)
-- ============================================================================
-- Instrucciones:
-- 1. Crea un proyecto gratuito en https://supabase.com
-- 2. Abre el "SQL Editor" en tu panel de Supabase, pega este script y ejecútalo.
-- 3. Copia tu Project URL y Anon Key en la vista #/settings de Darkness.
-- ============================================================================

-- Tabla de Snapshots Sincronizados por Usuario (Sincronización Instantánea Offline-First)
create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Activar Row Level Security (RLS) para que ningún usuario pueda ver ni modificar datos ajenos
alter table public.user_snapshots enable row level security;

create policy "Usuarios leen solo su propio snapshot"
  on public.user_snapshots for select
  using (auth.uid() = user_id);

create policy "Usuarios insertan solo su propio snapshot"
  on public.user_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Usuarios actualizan solo su propio snapshot"
  on public.user_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
