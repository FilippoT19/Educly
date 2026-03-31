-- Educly Schema v2 — run this in Supabase SQL Editor after schema.sql

-- Pre-generated exercises from uploaded materials
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  subject text not null,                          -- 'analisi1' | 'analisi2'
  topic_id text not null,                         -- matches curriculum topic ids
  difficulty int not null check (difficulty in (1,2,3)),
  source text not null default 'ai_generated',    -- 'eserciziario' | 'tema_passato' | 'ai_generated'
  source_year int,                                -- for past exams e.g. 2023
  question_latex text not null,
  solution_latex text not null,
  hints jsonb default '[]',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Theory lessons extracted from textbooks
create table public.theory_lessons (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  topic_id text not null,
  lesson_order int not null default 1,
  title text not null,
  content_markdown text not null,          -- text with LaTeX formulas
  key_concepts jsonb default '[]',         -- ["concept1", "concept2"]
  mini_quiz jsonb default '[]',            -- [{question, options:[],correct_index}]
  created_at timestamptz default now()
);

-- Track which exercises a student has already seen
create table public.student_exercise_seen (
  student_id uuid references public.students(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  seen_at timestamptz default now(),
  primary key (student_id, exercise_id)
);

-- Uploaded source documents (for reference)
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  topic_id text,                -- null means applies to whole subject
  doc_type text not null,       -- 'eserciziario' | 'tema_passato' | 'libro_teoria' | 'dispensa'
  title text not null,
  year int,
  exercises_extracted int default 0,
  lessons_extracted int default 0,
  created_at timestamptz default now()
);

-- RLS
alter table public.exercises enable row level security;
alter table public.theory_lessons enable row level security;
alter table public.student_exercise_seen enable row level security;
alter table public.source_documents enable row level security;

-- Everyone can read exercises and lessons (no sensitive data)
create policy "Anyone can read exercises"
  on public.exercises for select using (true);

create policy "Anyone can read theory lessons"
  on public.theory_lessons for select using (true);

-- Students track their own seen exercises
create policy "Students manage own seen"
  on public.student_exercise_seen for all
  using (auth.uid() = student_id);

-- Source docs: readable by all authenticated users
create policy "Authenticated users read docs"
  on public.source_documents for select
  using (auth.uid() is not null);

-- Indexes for performance
create index exercises_subject_topic on public.exercises(subject, topic_id, difficulty);
create index theory_subject_topic on public.theory_lessons(subject, topic_id, lesson_order);
