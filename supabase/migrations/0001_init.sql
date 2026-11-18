-- =====================================================================
-- DocMind — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run
-- (or `supabase db push` if you use the Supabase CLI)
-- =====================================================================

-- 1. pgvector: adds the `vector` column type + similarity operators
create extension if not exists vector with schema extensions;

-- 2. One row per uploaded PDF
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  page_count  int  not null default 0,
  word_count  int  not null default 0,
  chunk_count int  not null default 0,
  status      text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at  timestamptz not null default now()
);

-- 3. One row per text chunk (~1000 chars) with its embedding
--    gte-small produces 384-dimensional vectors.
create table if not exists public.chunks (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index int  not null,
  page        int  not null,
  content     text not null,
  embedding   extensions.vector(384) not null
);

create index if not exists chunks_document_idx on public.chunks (document_id, chunk_index);

-- HNSW index = fast approximate nearest-neighbour search (cosine distance)
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

-- 4. Saved question/answer sets
create table if not exists public.qa_sets (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  requested     int  not null,
  generated     int  not null,
  question_type text not null,
  difficulty    text not null,
  items         jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists qa_sets_document_idx on public.qa_sets (document_id, created_at desc);

-- 5. Row Level Security: every user can only see / change their own rows
alter table public.documents enable row level security;
alter table public.chunks    enable row level security;
alter table public.qa_sets   enable row level security;

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own chunks" on public.chunks;
create policy "own chunks" on public.chunks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own qa sets" on public.qa_sets;
create policy "own qa sets" on public.qa_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 6. Similarity search used by the chat function.
--    `security invoker` means RLS still applies → users only search their own chunks.
create or replace function public.match_chunks (
  query_embedding extensions.vector(384),
  doc_id uuid,
  match_count int default 5
)
returns table (id bigint, page int, chunk_index int, content text, similarity float)
language sql stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.page, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.document_id = doc_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
