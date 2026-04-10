-- migration_v7: concept tags on exercises + concept mastery table

-- Add concept_tags column to exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS concept_tags text[] DEFAULT '{}';

-- Table: concept_mastery
-- Tracks per-student mastery (0.0–1.0) for each concept tag
CREATE TABLE IF NOT EXISTS concept_mastery (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject      text NOT NULL,
  concept      text NOT NULL,
  mastery      float NOT NULL DEFAULT 0.5,  -- starts at neutral 0.5
  attempts     int  NOT NULL DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (student_id, subject, concept)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_concept_mastery_student_subject
  ON concept_mastery (student_id, subject);
