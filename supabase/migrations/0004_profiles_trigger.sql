-- 0004: 신규 가입 시 profiles 행 자동 생성
-- auth.users 에 사용자가 생기면(이메일 가입·구글 OAuth 공통) public.profiles 행을 자동으로 만든다.
-- 기존엔 dev-seed 가 수동 upsert 했지만, 정식 가입 흐름에선 트리거가 보장한다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
