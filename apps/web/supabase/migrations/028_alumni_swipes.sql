-- alumni_swipes: the persisted swipe/skip signal that adaptive scoring reads.
-- The mobile app and the picks engine have referenced this table all along —
-- it was never created, so swipe-learning silently no-oped (every read/write
-- failed soft). This makes the signal real.

CREATE TABLE IF NOT EXISTS public.alumni_swipes (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  alumni_id   uuid REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
  action      text NOT NULL CHECK (action IN ('save', 'pass')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, alumni_id)
);

CREATE INDEX IF NOT EXISTS alumni_swipes_user_idx ON public.alumni_swipes (user_id);

ALTER TABLE public.alumni_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own swipes" ON public.alumni_swipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users write own swipes" ON public.alumni_swipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
