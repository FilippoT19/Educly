-- Educly Migration v4
-- Run in Supabase → SQL Editor

-- Track every exercise attempt (richer than student_exercise_seen)
CREATE TABLE IF NOT EXISTS public.exercise_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  is_correct  boolean NOT NULL,
  score       int,          -- 0–100
  attempted_at timestamptz DEFAULT now()
);

ALTER TABLE public.exercise_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own attempts"
  ON public.exercise_attempts FOR ALL
  USING (auth.uid() = student_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS attempts_student_exercise
  ON public.exercise_attempts(student_id, exercise_id);

CREATE INDEX IF NOT EXISTS attempts_student_subject
  ON public.exercise_attempts(student_id, attempted_at DESC);
