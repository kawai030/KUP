-- API 롤 권한 부여 — 0001 마이그레이션이 만든 테이블에 anon/authenticated/service_role의
-- DML(SELECT/INSERT/UPDATE/DELETE)이 자동 부여되지 않아 보강. (Supabase 표준 grant 블록)
-- 보안 게이트는 RLS(0002)다: anon/authenticated 는 grant가 있어도 RLS 정책 범위만 접근.
-- service_role 은 BYPASSRLS(워커 전용, 데이터모델 §6).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- 이후 생성될 객체에도 동일 적용(향후 마이그레이션 대비)
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
