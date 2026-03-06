-- 계정별 사용자 이름 추가/수정 쿼리
-- 사용법: email, display_name 값을 변경하여 실행

INSERT INTO public.user_profiles (email, display_name)
VALUES ('dauphins_78@neungyule.com', '김현준')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 추가 계정 예시:
-- INSERT INTO public.user_profiles (email, display_name)
-- VALUES ('다른계정@example.com', '홍길동')
-- ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;
