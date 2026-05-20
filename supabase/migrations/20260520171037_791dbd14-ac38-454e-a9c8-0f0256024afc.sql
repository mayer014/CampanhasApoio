
CREATE OR REPLACE FUNCTION public.wa_warmup_cap(_day integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _day <= 1 THEN 20
    WHEN _day = 2 THEN 40
    WHEN _day = 3 THEN 80
    WHEN _day = 4 THEN 120
    WHEN _day = 5 THEN 160
    WHEN _day = 6 THEN 200
    ELSE 300
  END
$$;
