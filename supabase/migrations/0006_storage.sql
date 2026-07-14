-- 0006_storage — 카드 이미지(JPEG)/릴스 영상(MP4) 저장 버킷.
-- 서버리스(Vercel)는 로컬 FS(.data/images)가 휘발이므로 Storage 로 옮긴다.
-- private 버킷 — service_role(admin 클라이언트)만 접근. 외부(인스타)는 우리 공개
-- 프록시 라우트 /api/render/{id}/{page} · /api/render-video/{id} 를 통해서만 가져간다.

insert into storage.buckets (id, name, public)
values ('card-media', 'card-media', false)
on conflict (id) do nothing;

-- RLS: storage.objects 는 기본 RLS on. 정책을 만들지 않으면 service_role(BYPASSRLS)만
-- 접근 가능 → anon/authenticated 직접 접근 차단(우리 프록시만 서빙). 별도 정책 불필요.
