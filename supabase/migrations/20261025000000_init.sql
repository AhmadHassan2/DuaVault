-- DuaVault initial schema
-- Every user-owned table is protected by Row-Level Security: owners only.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.content_type as enum ('dua', 'adhkar', 'quran', 'hadith', 'reminder', 'knowledge');
create type public.verification_status as enum (
  'verified_match', 'possible_match', 'user_provided_unverified', 'unverified', 'review_required'
);
create type public.memorization_state as enum ('not_started', 'learning', 'familiar', 'memorized');
create type public.practice_kind as enum ('viewed', 'practiced', 'memorization_review');
create type public.reference_kind as enum ('quran', 'hadith', 'dua', 'dhikr');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Categories (shared taxonomy, seeded in seed.sql — mirrors src/core/taxonomy.ts)
-- ---------------------------------------------------------------------------
create table public.categories (
  content_type public.content_type not null,
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  primary key (content_type, slug)
);

-- ---------------------------------------------------------------------------
-- Reference datasets (trusted, imported — never user-writable)
-- ---------------------------------------------------------------------------
create table public.reference_sources (
  id text primary key,
  name text not null,
  kind public.reference_kind not null,
  licence text not null,
  url text not null,
  imported_at timestamptz not null default now()
);

create table public.verified_reference_entries (
  id text primary key,
  source_id text not null references public.reference_sources (id) on delete cascade,
  kind public.reference_kind not null,
  arabic text not null,
  arabic_normalized text not null,
  translation text,
  transliteration text,
  reference_label text not null,
  -- Grade is stored only when the dataset supplies it, together with who graded it.
  grade text,
  grade_source text,
  topics text[] not null default '{}',
  check ((grade is null) = (grade_source is null))
);
create index verified_reference_entries_arabic_trgm on public.verified_reference_entries using gin (arabic_normalized extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Saved items
-- ---------------------------------------------------------------------------
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content_type public.content_type not null,
  subcategory text not null,
  arabic_text text not null default '' check (char_length(arabic_text) <= 20000),
  english_text text not null default '' check (char_length(english_text) <= 20000),
  transliteration text check (char_length(transliteration) <= 20000),
  ocr_raw_text text check (char_length(ocr_raw_text) <= 40000),
  ocr_confidence real check (ocr_confidence between 0 and 100),
  source_text text check (char_length(source_text) <= 2000),
  notes text not null default '' check (char_length(notes) <= 10000),
  verification_status public.verification_status not null default 'unverified',
  verification_reference_id text,
  verification_reference_label text,
  verification_source_name text,
  verification_match_score real check (verification_match_score between 0 and 1),
  verification_match_kind text check (verification_match_kind in ('exact', 'partial', 'possible')),
  verification_grade text,
  verification_grade_source text,
  verification_notes jsonb not null default '[]',
  verification_checked_at timestamptz not null default now(),
  screenshot_path text,
  is_favorite boolean not null default false,
  practice_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  -- Normalized Arabic for matching/search is computed client-side by the same code used for verification.
  arabic_normalized text not null default '',
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(english_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(arabic_normalized, '')), 'B')
  ) stored,
  foreign key (content_type, subcategory) references public.categories (content_type, slug),
  -- A screenshot must live in the owner's folder.
  check (screenshot_path is null or screenshot_path like owner_id::text || '/%')
);
create index saved_items_owner_created on public.saved_items (owner_id, created_at desc);
create index saved_items_search on public.saved_items using gin (search_tsv);
create index saved_items_arabic_trgm on public.saved_items using gin (arabic_normalized extensions.gin_trgm_ops);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  unique (owner_id, slug)
);

create table public.saved_item_tags (
  item_id uuid not null references public.saved_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (item_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id uuid not null references public.saved_items (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, item_id)
);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------
create table public.practice_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.saved_items (id) on delete cascade,
  kind public.practice_kind not null,
  rating public.memorization_state,
  at timestamptz not null default now()
);
create index practice_history_owner_at on public.practice_history (owner_id, at desc);

create table public.memorization_progress (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.saved_items (id) on delete cascade,
  state public.memorization_state not null default 'learning',
  ease real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  primary key (owner_id, item_id)
);

create table public.reminder_preferences (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_reminder_enabled boolean not null default false,
  daily_reminder_time time not null default '08:00',
  updated_at timestamptz not null default now()
);

-- Private journal: personal duas and reflections. Never shared, never mixed with references.
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  arabic_text text not null default '' check (char_length(arabic_text) <= 20000),
  topic text not null default '',
  reminder_enabled boolean not null default false,
  reminder_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger saved_items_touch before update on public.saved_items for each row execute function public.touch_updated_at();
create trigger collections_touch before update on public.collections for each row execute function public.touch_updated_at();
create trigger journal_touch before update on public.journal_entries for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.reference_sources enable row level security;
alter table public.verified_reference_entries enable row level security;
alter table public.saved_items enable row level security;
alter table public.tags enable row level security;
alter table public.saved_item_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.practice_history enable row level security;
alter table public.memorization_progress enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.journal_entries enable row level security;

create policy "profiles: owner read" on public.profiles for select using (id = (select auth.uid()));
create policy "profiles: owner update" on public.profiles for update using (id = (select auth.uid()));

-- Shared, read-only reference data
create policy "categories: read" on public.categories for select to authenticated using (true);
create policy "reference_sources: read" on public.reference_sources for select to authenticated using (true);
create policy "reference_entries: read" on public.verified_reference_entries for select to authenticated using (true);

-- Owner-only tables
do $$
declare t text;
begin
  foreach t in array array[
    'saved_items', 'tags', 'saved_item_tags', 'collections', 'collection_items',
    'practice_history', 'memorization_progress', 'reminder_preferences', 'journal_entries'
  ] loop
    execute format('create policy "%1$s: owner select" on public.%1$I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner insert" on public.%1$I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner update" on public.%1$I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner delete" on public.%1$I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Join rows may only point at the owner's own items/collections/tags.
create policy "saved_item_tags: own item" on public.saved_item_tags as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.saved_items i where i.id = item_id and i.owner_id = (select auth.uid()))
    and exists (select 1 from public.tags g where g.id = tag_id and g.owner_id = (select auth.uid()))
  );
create policy "collection_items: own rows" on public.collection_items as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.saved_items i where i.id = item_id and i.owner_id = (select auth.uid()))
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))
  );
create policy "practice_history: own item" on public.practice_history as restrictive for insert to authenticated
  with check (exists (select 1 from public.saved_items i where i.id = item_id and i.owner_id = (select auth.uid())));
create policy "memorization_progress: own item" on public.memorization_progress as restrictive for insert to authenticated
  with check (exists (select 1 from public.saved_items i where i.id = item_id and i.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Practice RPC: records an event and updates the item atomically.
-- ---------------------------------------------------------------------------
create or replace function public.record_practice(p_item_id uuid, p_kind public.practice_kind, p_rating public.memorization_state default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.practice_history (item_id, kind, rating) values (p_item_id, p_kind, p_rating);
  update public.saved_items
     set last_reviewed_at = now(),
         practice_count = practice_count + case when p_kind = 'viewed' then 0 else 1 end
   where id = p_item_id and owner_id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Full-text search over the caller's own items (RLS still applies: security invoker).
-- ---------------------------------------------------------------------------
create or replace function public.search_saved_items(p_query text, p_arabic text default '')
returns table (id uuid, rank real)
language sql stable security invoker set search_path = '' as $$
  select s.id,
         (ts_rank(s.search_tsv, websearch_to_tsquery('english', p_query))
          + case when p_arabic <> '' then extensions.similarity(s.arabic_normalized, p_arabic) else 0 end)::real as rank
    from public.saved_items s
   where s.owner_id = (select auth.uid())
     and (s.search_tsv @@ websearch_to_tsquery('english', p_query)
          or (p_arabic <> '' and s.arabic_normalized operator(extensions.%) p_arabic))
   order by rank desc
   limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private screenshots bucket, files under "<uid>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "screenshots: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "screenshots: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "screenshots: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
