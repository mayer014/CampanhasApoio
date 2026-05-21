
CREATE POLICY "sj_owner_select" ON public.social_jobs
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY "sj_owner_insert" ON public.social_jobs
  FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());
