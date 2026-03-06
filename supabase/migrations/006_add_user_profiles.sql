-- 계정별 사용자 이름
CREATE TABLE IF NOT EXISTS public.user_profiles (
  email        TEXT NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- 샘플 데이터
INSERT INTO public.user_profiles (email, display_name)
VALUES ('dauphins_78@neungyule.com', '김현준')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;
