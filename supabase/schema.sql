-- Educly MVP Schema
-- Run this in Supabase SQL Editor

-- Enable pgvector for future RAG
create extension if not exists vector;

-- Students profile (extends Supabase auth.users)
create table public.students (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  school text not null default 'politecnico',
  course text not null,        -- e.g. "Ingegneria Informatica"
  year int not null,           -- 1, 2, 3...
  created_at timestamptz default now()
);

-- Topic statistics per student
create table public.topic_stats (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade not null,
  subject text not null,       -- 'analisi1' | 'analisi2'
  topic_id text not null,      -- e.g. 'limiti', 'derivate'
  exercises_done int default 0,
  correct int default 0,
  last_error_types jsonb default '[]',   -- array of error type strings
  last_practiced timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id, subject, topic_id)
);

-- Exercise session log
create table public.exercise_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade not null,
  subject text not null,
  topic_id text not null,
  difficulty int not null,          -- 1=facile, 2=medio, 3=difficile
  exercise_text text not null,
  solution_image_url text,          -- uploaded image URL
  ai_feedback text,
  error_types jsonb default '[]',   -- errors found by AI
  is_correct boolean,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.students enable row level security;
alter table public.topic_stats enable row level security;
alter table public.exercise_log enable row level security;

-- Policies: students can only see their own data
create policy "Students see own profile"
  on public.students for all
  using (auth.uid() = id);

create policy "Students see own stats"
  on public.topic_stats for all
  using (auth.uid() = student_id);

create policy "Students see own exercises"
  on public.exercise_log for all
  using (auth.uid() = student_id);

-- Storage bucket for solution images
insert into storage.buckets (id, name, public) values ('solutions', 'solutions', false);

create policy "Students upload own solutions"
  on storage.objects for insert
  with check (bucket_id = 'solutions' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Students read own solutions"
  on storage.objects for select
  using (bucket_id = 'solutions' and auth.uid()::text = (storage.foldername(name))[1]);
