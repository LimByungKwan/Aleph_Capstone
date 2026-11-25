
-- ============================================================================
-- 커플 타로 결과 저장 (DB 담당: 지민 / 타로 화면·AI: 병관)
-- Supabase SQL Editor에 통째로 붙여 실행 (20261123120000_jm_appearance.sql 다음)
--
-- 왜 DB인가: Render 무료 서버는 잠들 때 파일이 지워져서 결과를 서버 파일에 둘 수 없다.
--   하지만 지민 서버는 원래 파일이 아니라 Supabase에 저장한다 → 이 표 하나로 "지난번 카드와 비교"를
--   다른 기기·다른 브라우저에서도 할 수 있다. (mock 모드에서는 client.js가 이 브라우저에 저장)
--
-- 판단
--   - 카드 id와 해석 요약만 저장. 두 사람이 직접 쓴 답 원문은 저장하지 않는다
--     (한 기기에서 번갈아 답하는 방식이라 두 번째 사람은 이 계정 주인이 아님 → 동의 없이 남의 글을 남기지 않음)
--     질문 카드 id·고른 보기 id처럼 정해진 값은 detail(jsonb)에 넣어도 됨
--   - 쓰기는 save_tarot_reading 함수로만 (형식·크기·횟수 검사). 읽기·삭제는 본인 것만 (RLS)
--   - 사람마다 최근 30개만 남김 → 무료 DB 용량을 한 사람이 채우지 못하게
-- ============================================================================

create table public.tarot_readings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  spread     text not null check (spread ~ '^[a-z0-9_]{1,30}$'),           -- 'couple' 등 (병관 화면이 정함)
  cards      text[] not null check (cardinality(cards) between 1 and 10), -- 'major_00' 같은 카드 id, 뽑은 순서대로
  summary    text not null check (char_length(summary) between 1 and 1000),
  detail     jsonb not null default '{}'::jsonb
             check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 4096),
  created_at timestamptz not null default now()
);
create index tarot_readings_user_idx on public.tarot_readings (user_id, created_at desc);

alter table public.tarot_readings enable row level security;
-- insert·update 정책은 일부러 없음 → 화면이 표에 직접 쓰지 못하고 아래 함수만 거침
create policy tarot_read_own   on public.tarot_readings for select to authenticated using (user_id = auth.uid());
create policy tarot_delete_own on public.tarot_readings for delete to authenticated using (user_id = auth.uid());

-- 결과 저장
--   예) select public.save_tarot_reading('couple', array['major_06','major_17'], '서로의 속도를 맞춰 가는 시기예요.', '{"questionIds":["q03","q07"]}');
-- 응답: { id, spread, cards, summary, detail, createdAt }
create or replace function public.save_tarot_reading(
  p_spread  text,
  p_cards   text[],
  p_summary text,
  p_detail  jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.require_user();
  v_recent int;
  v_row    public.tarot_readings;
begin
  if p_spread is null or p_spread !~ '^[a-z0-9_]{1,30}$' then
    raise exception 'INVALID_INPUT' using detail = '타로 종류(spread)를 확인해 주세요.';
  end if;
  if p_cards is null or cardinality(p_cards) not between 1 and 10
     or exists (select 1 from unnest(p_cards) c where c is null or c !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'INVALID_INPUT' using detail = '카드는 1~10장, 영문 소문자·숫자·_ id로 보내 주세요.';
  end if;
  if p_summary is null or char_length(btrim(p_summary)) not between 1 and 1000 then
    raise exception 'INVALID_INPUT' using detail = '해석 요약은 1~1000자로 보내 주세요.';
  end if;
  p_detail := coalesce(p_detail, '{}'::jsonb);
  if jsonb_typeof(p_detail) <> 'object' then
    raise exception 'INVALID_INPUT' using detail = 'detail은 객체로 보내 주세요.';
  end if;
  if octet_length(p_detail::text) > 4096 then
    raise exception 'TOO_LARGE' using detail = '타로 기록이 너무 커요.';
  end if;

  -- 버튼 연타·스크립트 반복 저장 방지 (보관 30개보다 작아야 의미 있음)
  select count(*) into v_recent from public.tarot_readings
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'TOO_MANY_REQUESTS' using detail = '잠시 뒤에 다시 시도해 주세요.'; end if;

  insert into public.tarot_readings (user_id, spread, cards, summary, detail)
  values (v_uid, p_spread, p_cards, btrim(p_summary), p_detail)
  returning * into v_row;

  -- 최근 30개만 남김
  delete from public.tarot_readings
   where user_id = v_uid
     and id not in (select id from public.tarot_readings where user_id = v_uid order by created_at desc, id desc limit 30);

  return jsonb_build_object(
    'id', v_row.id, 'spread', v_row.spread, 'cards', to_jsonb(v_row.cards),
    'summary', v_row.summary, 'detail', v_row.detail, 'createdAt', v_row.created_at);
end;
$$;

revoke execute on function public.save_tarot_reading(text, text[], text, jsonb) from public, anon;
grant execute on function public.save_tarot_reading(text, text[], text, jsonb) to authenticated;
