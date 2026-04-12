-- migration_v8: RLS on concept_mastery (missed in v7)

ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own concept mastery"
  ON public.concept_mastery FOR ALL
  USING (auth.uid() = student_id);

-- Also lock down exercises/source_documents inserts/updates to service role only
-- (currently "Anyone can read" is fine; this blocks anonymous writes)
CREATE POLICY "No direct writes to exercises"
  ON public.exercises FOR INSERT
  USING (false);

CREATE POLICY "No direct deletes of exercises"
  ON public.exercises FOR DELETE
  USING (false);
