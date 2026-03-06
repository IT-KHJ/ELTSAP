-- dauphins_78@neungyule.com 계정에 admin 권한 부여 (동기화 메뉴 접근용)
-- Supabase SQL Editor에서 실행

-- app_metadata에 role: admin 추가 (권장 - 서버에서만 수정 가능)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'dauphins_78@neungyule.com';

-- 적용 확인 (1건 조회되면 성공)
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE email = 'dauphins_78@neungyule.com';
