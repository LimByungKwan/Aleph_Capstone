-- ============================================================================
-- SceneWalk AI 핵심 DB (스탬프 · 쿠폰 · 체험 완료 · 접속 기록 · 역할)
-- 담당: 지민 (JM) — 회원·역할, 스탬프·쿠폰 API, DB(Supabase)
--
-- 설계 원칙 (자세한 판단 근거는 docs/jm-db-design.md)
--  1. "한 번만"이 중요한 규칙은 앱 코드가 아니라 DB 제약으로 막는다
--     - 스탬프 중복 획득      → UNIQUE (user_id, place_id)
--     - 가게당 쿠폰 1인 1장   → UNIQUE (user_id, shop_id)
--     - 쿠폰 1회 사용         → UPDATE ... WHERE used_at IS NULL (조건부 갱신, 원자적)
--     - 체험 완료 1회 기록    → UNIQUE (user_id, activity_id)
--  2. 같은 요청이 두 번 와도(네트워크 재시도·더블 클릭) 결과가 같게: 멱등성 키 (redeem_requests)
--  3. 클라이언트는 테이블에 직접 쓰지 않는다. 쓰기는 모두 RPC(SECURITY DEFINER 함수)로만.
--     → RLS에는 "읽기" 정책만 두고, 쓰기 경로는 함수 안에서 검사 (공격 면적 축소)
--  4. 날짜 기준은 한국 시간(Asia/Seoul). 일일 집계·쿠폰 유효기간 모두 KST 날짜
--
-- 실행: Supabase 대시보드 SQL Editor 또는 `supabase db push`
-- 화면(client.js)의 함수 이름·응답 모양은 그대로 두고 안쪽만 이 RPC 호출로 바꾸는 것이 목표
-- ============================================================================

-- ── 0. 공통: 한국 날짜 ────────────────────────────────────────────────────
create or replace function public.kst_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- ── 1. 장소 (shared/places.json과 같은 id) ───────────────────────────────
-- 3D 맵의 상호작용 지점. 가게(type='cafe')가 쿠폰을 내는 단위
create table public.places (
  id         text primary key,
  type       text not null check (type in ('spot', 'cafe', 'npc')),
  zone       text not null,                -- 'HUB' | 'JM' | 'BK' | 'HJ' | 'SG'
  name       text not null,
  work       text                           -- 가상 작품명. 같은 구역 + 같은 작품 가게에만 쿠폰 발급
);

-- 가게별 쿠폰 혜택 (없으면 기본 문구로 발급)
create table public.shop_offers (
  shop_id    text primary key references public.places (id) on delete cascade,
  title      text not null,
  discount   text not null,                 -- 티켓에 크게 보이는 짧은 표기 (예: 'SIZE UP')
  perk       text,
  menu       text,
  valid_days int  not null default 30 check (valid_days between 1 and 365)
);

-- ── 2. 회원 프로필 · 역할 ─────────────────────────────────────────────────
-- auth.users(Supabase 로그인)와 1:1. 역할은 여기서만 관리
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '순례객',
  role         text not null default 'pilgrim' check (role in ('pilgrim', 'owner', 'admin')),
  shop_id      text references public.places (id),
  created_at   timestamptz not null default now(),
  -- 사장님은 반드시 가게 하나에 묶이고, 사장님이 아니면 가게가 없음
  constraint owner_has_shop check ((role = 'owner') = (shop_id is not null))
);

-- 가입하면 자동으로 순례객 프로필 생성 (역할은 관리자만 바꿈)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '순례객'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 내 역할 (RLS 정책에서 자주 씀). SECURITY DEFINER라 profiles RLS를 다시 타지 않음 (무한 재귀 방지)
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_shop()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select shop_id from public.profiles where id = auth.uid() $$;

-- 본인이 자기 역할·가게를 바꾸는 것(권한 상승) 차단. 이름만 바꿀 수 있음
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.shop_id is distinct from old.shop_id)
     and coalesce(public.my_role(), '') <> 'admin'
     and current_user in ('authenticated', 'anon') then
    raise exception 'FORBIDDEN' using detail = '역할·가게는 관리자만 바꿀 수 있어요.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ── 3. 스탬프 ─────────────────────────────────────────────────────────────
create table public.stamps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  place_id   text not null references public.places (id),
  created_at timestamptz not null default now(),
  constraint stamps_once_per_place unique (user_id, place_id)   -- 중복 획득 차단
);

-- ── 4. 쿠폰 ───────────────────────────────────────────────────────────────
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),  -- 0/O, 1/I 제외 6자리
  user_id     uuid not null references public.profiles (id) on delete cascade,
  shop_id     text not null references public.places (id),
  title       text not null,
  discount    text not null,
  reason      text,
  valid_until date not null,
  issued_at   timestamptz not null default now(),
  used_at     timestamptz,
  used_by     uuid references public.profiles (id),
  constraint coupons_once_per_shop unique (user_id, shop_id),    -- 가게당 1인 1장
  constraint coupons_used_pair check ((used_at is null) = (used_by is null))
);
create index coupons_shop_idx on public.coupons (shop_id, used_at desc);

-- 쿠폰 사용 요청의 멱등성 키: 같은 키로 다시 오면 처음 결과를 그대로 돌려줌
-- (사장님 화면에서 버튼 두 번 / 응답 유실 후 재시도 → "이미 사용" 에러 대신 같은 성공 응답)
create table public.redeem_requests (
  idempotency_key uuid primary key,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  coupon_id       uuid not null references public.coupons (id) on delete cascade,
  created_at      timestamptz not null default now()
);

-- ── 5. 체험 (농구 슛, 비 오는 정류장 …) ───────────────────────────────────
create table public.activities (
  id          text primary key,             -- 'jm_hoop' | 'jm_busstop' (jm_activityStore.js와 같은 id)
  place_id    text references public.places (id),
  name        text not null,
  min_seconds int  not null default 5 check (min_seconds >= 0)   -- 이보다 빨리 끝나면 가짜로 봄
);

-- 시작 기록: 서버가 시작 시각을 남겨 두고, 완료 요청 때 걸린 시간을 서버 시계로 검사
create table public.activity_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  activity_id text not null references public.activities (id),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index activity_sessions_user_idx on public.activity_sessions (user_id, started_at desc);

create table public.activity_completions (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  activity_id  text not null references public.activities (id),
  session_id   uuid not null references public.activity_sessions (id),
  completed_at timestamptz not null default now(),
  primary key (user_id, activity_id)        -- 완료는 1회만 기록
);

-- ── 6. 접속 기록 (일일 접속자 집계용, 한국 시간) ───────────────────────────
create table public.access_logs (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  logged_at timestamptz not null default now(),
  kst_date  date not null default public.kst_today()
);
create index access_logs_date_idx on public.access_logs (kst_date, user_id);

-- 일일 순 방문자 (같은 사람이 하루 여러 번 들어와도 1명). 관리자 통계 화면(성근님)이 읽음
create view public.daily_visitors
with (security_invoker = true) as
  select kst_date, count(distinct user_id) as visitors, count(*) as visits
  from public.access_logs
  group by kst_date;

-- ── 7. 가게 대표 홍보문구 (사장님이 등록 → 3D 맵 대화창) ───────────────────
create table public.shop_promos (
  shop_id  text primary key references public.places (id) on delete cascade,
  text     text not null check (char_length(text) between 1 and 300),
  tag      text,
  saved_at timestamptz not null default now(),
  saved_by uuid references public.profiles (id)
);

-- ============================================================================
-- RLS: 읽기는 정책으로, 쓰기는 RPC로만
-- ============================================================================
alter table public.places               enable row level security;
alter table public.shop_offers          enable row level security;
alter table public.profiles             enable row level security;
alter table public.stamps               enable row level security;
alter table public.coupons              enable row level security;
alter table public.redeem_requests      enable row level security;
alter table public.activities           enable row level security;
alter table public.activity_sessions    enable row level security;
alter table public.activity_completions enable row level security;
alter table public.access_logs          enable row level security;
alter table public.shop_promos          enable row level security;

-- 장소·혜택·체험 목록·대표 문구: 누구나 읽기 (로그인 전 맵에서도 보임)
create policy places_read      on public.places      for select to anon, authenticated using (true);
create policy offers_read      on public.shop_offers for select to anon, authenticated using (true);
create policy activities_read  on public.activities  for select to anon, authenticated using (true);
create policy promos_read      on public.shop_promos for select to anon, authenticated using (true);

-- 프로필: 내 것만 (관리자는 전체). 이름 수정만 허용 (역할·가게는 트리거가 막음)
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 스탬프·체험: 내 것만
create policy stamps_read_own      on public.stamps               for select to authenticated using (user_id = auth.uid());
create policy sessions_read_own    on public.activity_sessions    for select to authenticated using (user_id = auth.uid());
create policy completions_read_own on public.activity_completions for select to authenticated using (user_id = auth.uid());

-- 쿠폰: 받은 사람 본인 + 그 가게 사장님만 (다른 가게 쿠폰은 사장님도 못 봄)
create policy coupons_read on public.coupons for select to authenticated
  using (user_id = auth.uid() or (public.my_role() = 'owner' and shop_id = public.my_shop()));

-- 접속 기록: 관리자만 (개인 접속 시각은 민감 정보)
create policy access_logs_admin on public.access_logs for select to authenticated
  using (public.my_role() = 'admin');

-- redeem_requests: 정책 없음 = 클라이언트에서 아무도 못 읽음 (함수 내부 전용)

-- ============================================================================
-- RPC (화면에서 supabase.rpc('이름', {...})로 호출)
-- 에러는 message에 코드(ALREADY_STAMPED 등)를 넣음 → client.js가 ApiError(code)로 바꿈
-- ============================================================================

create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using detail = '로그인이 필요해요.';
  end if;
  return auth.uid();
end;
$$;

-- 사람이 불러 주기 쉬운 6자리 코드
create or replace function public.new_coupon_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

create or replace function public.coupon_json(c public.coupons)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'code', c.code, 'userId', c.user_id, 'shopId', c.shop_id,
    'shopName', (select name from public.places where id = c.shop_id),
    'title', c.title, 'discount', c.discount, 'reason', c.reason,
    'validUntil', c.valid_until, 'issuedAt', c.issued_at, 'usedAt', c.used_at, 'usedBy', c.used_by)
$$;

-- ── 스탬프 찍기 ──────────────────────────────────────────────────────────
-- client.js collectStamp 와 같은 응답: { stamp, issuedCoupons }
-- 동시에 두 번 눌러도 UNIQUE 제약 + ON CONFLICT 덕분에 한 번만 들어감
create or replace function public.collect_stamp(p_place_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_place  public.places;
  v_stamp  public.stamps;
  v_shop   public.places;
  v_offer  public.shop_offers;
  v_coupon public.coupons;
  v_issued jsonb := '[]'::jsonb;
  v_try    int;
begin
  select * into v_place from public.places where id = p_place_id;
  if not found then raise exception 'NOT_FOUND' using detail = '없는 장소예요.'; end if;
  if v_place.type = 'npc' then raise exception 'NOT_STAMPABLE' using detail = '이 장소는 스탬프가 없어요.'; end if;

  insert into public.stamps (user_id, place_id) values (v_user, p_place_id)
  on conflict on constraint stamps_once_per_place do nothing
  returning * into v_stamp;
  if v_stamp.id is null then raise exception 'ALREADY_STAMPED' using detail = '이미 받은 스탬프예요.'; end if;

  -- 촬영지 스탬프 → 같은 구역 + 같은 작품 가게 쿠폰 (가게당 1인 1장)
  if v_place.type = 'spot' and v_place.work is not null then
    for v_shop in
      select * from public.places
      where type = 'cafe' and zone = v_place.zone and work = v_place.work
    loop
      select * into v_offer from public.shop_offers where shop_id = v_shop.id;
      v_coupon := null;
      for v_try in 1..5 loop          -- 코드가 우연히 겹치면 다시 뽑음
        begin
          insert into public.coupons (code, user_id, shop_id, title, discount, reason, valid_until)
          values (public.new_coupon_code(), v_user, v_shop.id,
                  coalesce(v_offer.title, v_shop.name || ' 방문 감사 쿠폰'),
                  coalesce(v_offer.discount, 'GIFT'),
                  v_place.name || ' 스탬프 획득',
                  public.kst_today() + coalesce(v_offer.valid_days, 30))
          on conflict on constraint coupons_once_per_shop do nothing
          returning * into v_coupon;
          exit;
        exception when unique_violation then
          if v_try = 5 then raise; end if;
        end;
      end loop;
      if v_coupon.id is not null then
        v_issued := v_issued || public.coupon_json(v_coupon);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'stamp', jsonb_build_object('id', v_stamp.id, 'placeId', v_stamp.place_id, 'createdAt', v_stamp.created_at),
    'issuedCoupons', v_issued);
end;
$$;

-- ── 쿠폰 사용 처리 (사장님) ──────────────────────────────────────────────
-- client.js redeemCoupon 과 같은 에러 코드: NOT_OWNER / INVALID_CODE / NOT_FOUND / WRONG_SHOP / COUPON_USED / COUPON_EXPIRED
create or replace function public.redeem_coupon(p_code text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid := public.require_user();
  v_shop   text;
  v_code   text := upper(trim(coalesce(p_code, '')));
  v_coupon public.coupons;
  v_prev   public.redeem_requests;
begin
  if coalesce(public.my_role(), '') <> 'owner' then
    raise exception 'NOT_OWNER' using detail = '사장님 계정만 쿠폰을 사용 처리할 수 있어요.';
  end if;
  v_shop := public.my_shop();

  -- 같은 멱등성 키로 이미 처리한 요청이면 그때 결과를 그대로
  select * into v_prev from public.redeem_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_prev.owner_id <> v_owner then raise exception 'FORBIDDEN' using detail = '다른 사람의 요청이에요.'; end if;
    select * into v_coupon from public.coupons where id = v_prev.coupon_id;
    return jsonb_build_object('coupon', public.coupon_json(v_coupon), 'replayed', true);
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then raise exception 'INVALID_CODE' using detail = '쿠폰 코드는 영문·숫자 6자리예요.'; end if;

  select * into v_coupon from public.coupons where code = v_code;
  if not found then raise exception 'NOT_FOUND' using detail = '등록되지 않은 쿠폰 코드예요.'; end if;
  if v_coupon.shop_id <> v_shop then raise exception 'WRONG_SHOP' using detail = '우리 가게 쿠폰이 아니에요.'; end if;
  if v_coupon.valid_until < public.kst_today() then
    raise exception 'COUPON_EXPIRED' using detail = '유효기간이 지난 쿠폰이에요.';
  end if;

  -- 조건부 갱신: 아직 안 쓴 쿠폰일 때만. 두 요청이 동시에 와도 한쪽만 성공
  update public.coupons
     set used_at = now(), used_by = v_owner
   where id = v_coupon.id and used_at is null
  returning * into v_coupon;
  if not found then raise exception 'COUPON_USED' using detail = '이미 사용한 쿠폰이에요.'; end if;

  insert into public.redeem_requests (idempotency_key, owner_id, coupon_id)
  values (p_idempotency_key, v_owner, v_coupon.id);

  return jsonb_build_object('coupon', public.coupon_json(v_coupon), 'replayed', false);
end;
$$;

-- ── 사장님 통계 ──────────────────────────────────────────────────────────
-- client.js getShopStats: { issued, used, visitors, recentRedemptions }
create or replace function public.get_shop_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shop text;
  v_work text;
begin
  perform public.require_user();
  if coalesce(public.my_role(), '') <> 'owner' then raise exception 'NOT_OWNER' using detail = '사장님 계정만 볼 수 있어요.'; end if;
  v_shop := public.my_shop();
  select work into v_work from public.places where id = v_shop;

  return jsonb_build_object(
    'issued', (select count(*) from public.coupons where shop_id = v_shop),
    'used',   (select count(*) from public.coupons where shop_id = v_shop and used_at is not null),
    -- 방문자: 우리 가게 또는 같은 작품 촬영지 스탬프를 찍은 순 인원 (개인 정보 없이 숫자만)
    'visitors', (select count(distinct s.user_id) from public.stamps s join public.places p on p.id = s.place_id
                 where s.place_id = v_shop or (p.type = 'spot' and p.work = v_work)),
    'recentRedemptions', coalesce((
       select jsonb_agg(public.coupon_json(c) order by c.used_at desc)
       from (select * from public.coupons where shop_id = v_shop and used_at is not null
             order by used_at desc limit 5) c), '[]'::jsonb));
end;
$$;

-- ── 체험 시작 / 완료 ─────────────────────────────────────────────────────
-- 화면은 체험을 시작할 때 start_activity → 끝나면 complete_activity(session)
-- 서버 시계로 걸린 시간을 재서 min_seconds보다 빠르면 거부 (콘솔에서 완료만 호출하는 가짜 기록 방지)
create or replace function public.start_activity(p_activity_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_id   uuid;
  v_recent int;
begin
  if not exists (select 1 from public.activities where id = p_activity_id) then
    raise exception 'NOT_FOUND' using detail = '없는 체험이에요.';
  end if;
  -- 1분에 30번 넘게 시작하면 거부 (반복 호출 제한)
  select count(*) into v_recent from public.activity_sessions
   where user_id = v_user and started_at > now() - interval '1 minute';
  if v_recent >= 30 then raise exception 'TOO_MANY_REQUESTS' using detail = '잠시 뒤에 다시 시도해 주세요.'; end if;

  insert into public.activity_sessions (user_id, activity_id) values (v_user, p_activity_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.complete_activity(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_session public.activity_sessions;
  v_min     int;
  v_row     public.activity_completions;
begin
  select * into v_session from public.activity_sessions where id = p_session_id and user_id = v_user;
  if not found then raise exception 'NOT_FOUND' using detail = '없는 체험 기록이에요.'; end if;
  select min_seconds into v_min from public.activities where id = v_session.activity_id;
  if now() - v_session.started_at < make_interval(secs => v_min) then
    raise exception 'TOO_FAST' using detail = '체험 시간이 너무 짧아요.';
  end if;

  update public.activity_sessions set finished_at = coalesce(finished_at, now()) where id = p_session_id;
  insert into public.activity_completions (user_id, activity_id, session_id)
  values (v_user, v_session.activity_id, p_session_id)
  on conflict (user_id, activity_id) do nothing
  returning * into v_row;

  return jsonb_build_object(
    'activityId', v_session.activity_id,
    'alreadyCompleted', v_row.user_id is null,
    'completedAt', coalesce(v_row.completed_at,
      (select completed_at from public.activity_completions where user_id = v_user and activity_id = v_session.activity_id)));
end;
$$;

-- ── 접속 기록 (로그인 직후 1번 호출) ─────────────────────────────────────
create or replace function public.log_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.access_logs (user_id) values (public.require_user());
end;
$$;

-- ── 가게 대표 문구 등록 (사장님, 자기 가게만) ─────────────────────────────
create or replace function public.save_shop_promo(p_text text, p_tag text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_row  public.shop_promos;
begin
  if coalesce(public.my_role(), '') <> 'owner' then raise exception 'NOT_OWNER' using detail = '사장님 계정만 등록할 수 있어요.'; end if;
  insert into public.shop_promos (shop_id, text, tag, saved_by)
  values (public.my_shop(), p_text, p_tag, v_user)
  on conflict (shop_id) do update set text = excluded.text, tag = excluded.tag, saved_at = now(), saved_by = excluded.saved_by
  returning * into v_row;
  return jsonb_build_object('shopPromo', jsonb_build_object('text', v_row.text, 'tag', v_row.tag, 'savedAt', v_row.saved_at));
end;
$$;

-- ── 함수 실행 권한: 로그인한 사람만 (내부 도우미는 막음) ────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.collect_stamp(text),
  public.redeem_coupon(text, uuid),
  public.get_shop_stats(),
  public.start_activity(text),
  public.complete_activity(uuid),
  public.log_access(),
  public.save_shop_promo(text, text),
  public.kst_today()
to authenticated;
-- RLS 정책 안에서 쓰는 함수는 정책을 평가하는 역할이 실행할 수 있어야 함
grant execute on function public.my_role(), public.my_shop() to anon, authenticated;
