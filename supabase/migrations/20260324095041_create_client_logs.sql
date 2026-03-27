CREATE TABLE IF NOT EXISTS public.client_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level text NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  context jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_logs_user_id_idx ON public.client_logs(user_id);
CREATE INDEX IF NOT EXISTS client_logs_created_at_idx ON public.client_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS client_logs_level_idx ON public.client_logs(level);

ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_logs' AND policyname = 'users_insert_own_logs') THEN
    CREATE POLICY "users_insert_own_logs" ON public.client_logs
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_logs' AND policyname = 'admins_read_all_logs') THEN
    CREATE POLICY "admins_read_all_logs" ON public.client_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;
