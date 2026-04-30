-- Ensure the table exists
CREATE TABLE IF NOT EXISTS public.cgpa_predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  semester text NOT NULL,
  subjects_data jsonb NOT NULL,
  predicted_sgpa numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add target_sgpa if it was missing from an older version of your app
ALTER TABLE public.cgpa_predictions ADD COLUMN IF NOT EXISTS target_sgpa numeric;

-- Set up Row Level Security (RLS)
ALTER TABLE public.cgpa_predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid the "already exists" error
DROP POLICY IF EXISTS "Users can insert their own predictions" ON public.cgpa_predictions;
DROP POLICY IF EXISTS "Users can view their own predictions" ON public.cgpa_predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON public.cgpa_predictions;
DROP POLICY IF EXISTS "Users can delete their own predictions" ON public.cgpa_predictions;

-- Recreate policies safely
CREATE POLICY "Users can insert their own predictions"
  ON public.cgpa_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own predictions"
  ON public.cgpa_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
  ON public.cgpa_predictions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
  ON public.cgpa_predictions FOR DELETE
  USING (auth.uid() = user_id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_cgpa_predictions_user_id ON public.cgpa_predictions(user_id);
