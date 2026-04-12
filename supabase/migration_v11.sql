-- migration_v11: multi-part exercises, star flag, type classification, source tracking

-- Multi-part structure: [{label, question_latex, solution_latex}]
-- When parts is non-empty, question_latex holds the shared preamble, solution_latex is null.
-- When parts is empty, question_latex/solution_latex hold the full single-part content.
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS parts jsonb DEFAULT '[]';

-- Whether the exercise is "starred" in the source material (has full worked solution)
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS has_star boolean NOT NULL DEFAULT false;

-- Type: 'exercise' (standard), 'esempio' (worked example, difficulty=0), 'application' (real-world)
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'exercise';
ALTER TABLE public.exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type IN ('exercise', 'esempio', 'application'));

-- Sub-topic within a chapter, e.g. "1.1.A" or "1.1.B"
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS subtopic_id text;

-- For application exercises: the thematic category, e.g. "Modelli di crescita ed estinzione"
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS application_category text;

-- Original exercise number from the source, e.g. "1.1", "1.43" (for display and ordering)
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS exercise_number text;
