-- Educly Migration v5
-- Run in Supabase → SQL Editor

-- Add answer_type, solution_exact, solution_steps to exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS answer_type text NOT NULL DEFAULT 'open' CHECK (answer_type IN ('exact', 'open')),
  ADD COLUMN IF NOT EXISTS solution_exact text,        -- expected answer for exact-type exercises (normalized)
  ADD COLUMN IF NOT EXISTS solution_steps text[] DEFAULT '{}'; -- step-by-step solution breakdown (for interactive review)

-- Add student_answer to exercise_log (text answers replace images for MVP)
ALTER TABLE public.exercise_log
  ADD COLUMN IF NOT EXISTS student_answer text;
