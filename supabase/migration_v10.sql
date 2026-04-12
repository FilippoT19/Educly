-- migration_v10: add chapter_title to exercises and theory_lessons for grouping

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS chapter_title text;
ALTER TABLE public.theory_lessons ADD COLUMN IF NOT EXISTS chapter_title text;
