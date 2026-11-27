import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { HttpError, fromAuthError, fromDbError } from './errors.js'
import { createLimiter } from './rateLimit.js'

// SceneWalk AI API (담당: 지민) — 로그인·스탬프·쿠폰·체험·가게 문구·꾸미기·타로 기록
//
// 구조: 화면(Vercel) → 이 서버(Render) → Supabase(Postgres + Auth)
//   - 규칙(중복 스탬프 차단, 쿠폰 1회 사용, 역할 검사)은 DB 함수·제약에 있다 (supabase/migrations)
//   - 이 서버는 ① 로그인 토큰 확인 ② 그 사람 권한으로 DB 함수 호출 ③ 에러를 화면용 코드로 변환만 한다
//   - 응답 모양은 frontend/src/api/client.js(mock)와 같다 → 화면은 client.js 안쪽만 fetch로 바꾸면 됨
//
// 에러 응답: { error: { code, message } }  (code = client.js ApiError.code)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requireString(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, 'INVALID_INPUT', `${field} 값을 확인해 주세요.`)
  }
  return value.trim()
}

/** Supabase 세션 → 화면에 줄 토큰 묶음 */
function sessionJson(session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at, // 초 단위 유닉스 시각. 지나기 전에 /auth/refresh
  }
}

function profileJson(user, profile) {
  return {
    id: user.id,
    email: user.email,
    name: profile?.display_name ?? '순례객',
    role: profile?.role ?? 'pilgrim', // 'pilgrim' | 'owner' | 'admin'
    shopId: profile?.shop_id ?? null,
  }
}

/** coupons 행(+ places(name)) → client.js Coupon 모양 */
function couponJson(row) {
  return {
    id: row.id,
    code: row.code,
    userId: row.user_id,
    shopId: row.shop_id,
    shopName: row.places?.name ?? null,
    title: row.title,
    discount: row.discount,
    reason: row.reason,
    validUntil: row.valid_until,
    issuedAt: row.issued_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
  }
}

/** tarot_readings 행 → client.js TarotReading 모양 */
function tarotJson(row) {
  return { id: row.id, spread: row.spread, cards: row.cards, summary: row.summary, detail: row.detail ?? {}, createdAt: row.created_at }
}

async function loadProfile(db, userId) {
  const { data, error } = await db.from('profiles').select('display_name, role, shop_id').eq('id', userId).maybeSingle()
  if (error) throw fromDbError(error)
  return data
}

async function rpc(db, name, args) {
  const { data, error } = await db.rpc(name, args)
  if (error) throw fromDbError(error)
  return data
}

/**
 * @param {object} deps
 * @param {{ anon: () => any, asUser: (token: string) => any }} deps.supabase
 * @param {string[]} deps.allowedOrigins 화면 주소 (CORS)
 * @param {object} [deps.limits] 로그인 시도 제한 (테스트에서 작게 바꿔 씀)
 * @param {(userId: string) => void} [deps.onSessionReplaced] 다른 기기의 로그인을 끊었을 때 (멀티 접속에서 그 계정 연결을 바로 끊음)
 */
export function createApp({ supabase, allowedOrigins = [], limits = {}, onSessionReplaced = () => {} }) {
  const app = express()

  // 로그인 시도 제한 (rateLimit.js 주석 참고)
  //   IP: 로그인+가입 시도 15분에 30번 / 이메일: 로그인 실패 15분에 5번 (성공하면 초기화)
  const authPerIp = createLimiter(limits.authPerIp ?? { windowMs: 15 * 60_000, max: 30 })
  const loginFailPerEmail = createLimiter(limits.loginFailPerEmail ?? { windowMs: 15 * 60_000, max: 5 })
  // 가입 코드: IP마다 15분에 5번 틀리면 잠깐 막음 (코드 맞히기 대입 차단, 20261202120000_jm_signup_code.sql)
  const signupCodeFailPerIp = createLimiter(limits.signupCodeFailPerIp ?? { windowMs: 15 * 60_000, max: 5 })
  function blockIfLimited(limiter, key) {
    const r = limiter.check(key)
    if (r.limited) {
      const err = new HttpError(429, 'TOO_MANY_REQUESTS', `시도가 너무 많아요. ${Math.ceil(r.retryAfter / 60)}분 뒤에 다시 시도해 주세요.`)
      err.retryAfter = r.retryAfter
      throw err
    }
  }
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // Render 앞단 프록시

  // 보안 헤더 (11/24 점검에서 Render API에 HSTS가 없던 것 보완 — docs/jm-security-checklist.md 빈틈 1)
  //   HSTS: 한 번 접속한 브라우저는 1년 동안 http로 요청하지 않고 바로 https로 감
  //   nosniff: 응답을 JSON이 아닌 다른 형식(스크립트 등)으로 추측해 실행하지 않게
  //   DENY / no-referrer: API 응답을 다른 사이트 화면에 끼워 넣거나, 주소를 남의 사이트로 흘리지 않게
  app.use((_req, res, next) => {
    res.set({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    })
    next()
  })

  app.use(
    cors({
      origin(origin, done) {
        // 주소창 직접 접속·서버 간 호출(origin 없음)은 허용, 브라우저는 등록된 화면 주소만
        done(null, !origin || allowedOrigins.includes(origin))
      },
    }),
  )
  app.use(express.json({ limit: '10kb' }))

  // 로그인 확인: Authorization: Bearer <accessToken>
  async function requireAuth(req, _res, next) {
    const header = req.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', '로그인이 필요해요.')
    // 토큰 위조·만료는 Supabase Auth가 판정 (서명 검사를 서버에서 직접 구현하지 않음)
    const { data, error } = await supabase.anon().auth.getUser(token)
    if (error || !data?.user) throw new HttpError(401, 'UNAUTHORIZED', '다시 로그인해 주세요.')
    req.user = data.user
    req.token = token
    req.db = supabase.asUser(token)
    // 계정당 로그인 1곳: 같은 계정이 다른 기기에서 로그인했으면 이 토큰은 거절 (첫 번째 겹. 두 번째 겹은 DB require_user)
    //   토큰 자체는 아직 유효해서(refresh도 됨) getUser만으로는 못 거름 → DB에 기록된 "지금 유효한 session_id"와 비교
    if ((await rpc(req.db, 'session_ok')) === false) {
      throw new HttpError(401, 'SESSION_REPLACED', '다른 기기에서 로그인해서 이 기기는 로그아웃됐어요.')
    }
    next()
  }

  // 로그인·가입 직후: 이 토큰을 그 계정의 유일한 로그인으로 기록. 다른 기기를 끊었으면 멀티 접속에서도 바로 끊음
  async function claimSession(db, userId) {
    const result = await rpc(db, 'claim_session')
    if (result?.replaced) onSessionReplaced(userId)
  }

  // 역할 검사 (RBAC 미들웨어): requireAuth 다음에 붙임. 예) app.get('/admin/stats', requireAuth, requireRole('admin'), …)
  // 판단: 역할 검사는 원래 DB 함수 첫 줄이 한다(get_admin_stats·get_shop_stats …). 여기서 한 번 더 막는 이유는
  //   ① 권한 없는 요청이 DB 함수까지 가지 않게 (함수 검사를 실수로 빼먹어도 서버에서 한 겹 더)
  //   ② 어떤 경로가 어떤 역할용인지 라우트 한 줄에서 보이게
  //   역할은 토큰이 아니라 DB(profiles)에서 매번 읽음 → 관리자가 SQL로 역할을 바꾸면 다음 요청부터 바로 반영
  const ROLE_ERROR = { admin: ['NOT_ADMIN', '관리자 계정만 쓸 수 있어요.'], owner: ['NOT_OWNER', '사장님 계정만 쓸 수 있어요.'] }
  function requireRole(role) {
    return async (req, _res, next) => {
      const profile = await loadProfile(req.db, req.user.id)
      if (profile?.role !== role) {
        const [code, message] = ROLE_ERROR[role] ?? ['FORBIDDEN', '권한이 없어요.']
        throw new HttpError(403, code, message)
      }
      req.profile = profile
      next()
    }
  }

  // ── 상태 확인 (Render 헬스 체크, 시연 전 서버 깨우기) ──
  app.get('/health', (_req, res) => res.json({ ok: true }))

  // ── 회원가입 · 로그인 ──
  app.post('/auth/signup', async (req, res) => {
    const email = requireString(req.body?.email, '이메일')
    const password = requireString(req.body?.password, '비밀번호', 72)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 20) : ''
    // 가입 코드: 맞는지는 DB 트리거가 판단 (서버를 거치지 않은 가입도 같은 곳에서 막힘). 코드는 저장되지 않음
    const signupCode = typeof req.body?.signupCode === 'string' ? req.body.signupCode.trim().slice(0, 64) : ''
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'INVALID_INPUT', '이메일 형식을 확인해 주세요.')
    blockIfLimited(authPerIp, req.ip)
    blockIfLimited(signupCodeFailPerIp, req.ip)
    authPerIp.hit(req.ip)

    // 역할은 받지 않는다: 가입하면 DB 트리거가 무조건 순례객(pilgrim)으로 만든다 (권한 상승 차단)
    const meta = { display_name: name || '순례객' }
    if (signupCode) meta.signup_code = signupCode
    const { data, error } = await supabase.anon().auth.signUp({ email, password, options: { data: meta } })
    // DB 트리거가 가입을 거절하면 Supabase Auth는 이유를 숨기고 'Database error saving new user'만 돌려줌
    //   → 가입 때 DB가 거절하는 경우는 가입 코드뿐이라 코드 오류로 안내하고 실패 횟수를 셈
    if (error?.code === 'unexpected_failure' && /database error saving new user/i.test(error.message ?? '')) {
      signupCodeFailPerIp.hit(req.ip)
      throw new HttpError(400, 'INVALID_SIGNUP_CODE', '가입 코드가 맞지 않아요.')
    }
    if (error) throw fromAuthError(error)
    // 이미 있는 이메일: Supabase는 설정(이메일 인증·가입자 숨김)에 따라 에러 대신 identities가 빈 가짜 사용자를 돌려줌
    //   → 그대로 두면 화면에는 "가입됨/메일 확인"처럼 보여서 같은 아이디로 또 가입된 것처럼 보였음 (11/26 지민 확인)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new HttpError(409, 'EMAIL_TAKEN', '이미 가입한 이메일이에요.')
    }
    // 이메일 인증이 켜져 있으면 session이 없다
    if (!data.session) return res.status(201).json({ needsEmailConfirm: true })

    const db = supabase.asUser(data.session.access_token)
    await claimSession(db, data.user.id)
    await rpc(db, 'log_access')
    const profile = await loadProfile(db, data.user.id)
    res.status(201).json({ needsEmailConfirm: false, session: sessionJson(data.session), user: profileJson(data.user, profile) })
  })

  app.post('/auth/login', async (req, res) => {
    const email = requireString(req.body?.email, '이메일')
    const password = requireString(req.body?.password, '비밀번호', 72)
    const emailKey = email.toLowerCase()
    blockIfLimited(authPerIp, req.ip)
    blockIfLimited(loginFailPerEmail, emailKey)
    authPerIp.hit(req.ip)

    const { data, error } = await supabase.anon().auth.signInWithPassword({ email, password })
    if (error) {
      if (error.code === 'invalid_credentials') loginFailPerEmail.hit(emailKey)
      throw fromAuthError(error)
    }
    loginFailPerEmail.reset(emailKey)

    const db = supabase.asUser(data.session.access_token)
    // 새 로그인 우선: 같은 계정으로 로그인해 있던 다른 기기는 다음 요청부터 SESSION_REPLACED
    await claimSession(db, data.user.id)
    // 일일 접속자 집계용 기록 (로그인한 사람만 셈 — 11/17 팀 결정)
    await rpc(db, 'log_access')
    const profile = await loadProfile(db, data.user.id)
    res.json({ session: sessionJson(data.session), user: profileJson(data.user, profile) })
  })

  app.post('/auth/refresh', async (req, res) => {
    const refreshToken = requireString(req.body?.refreshToken, 'refreshToken', 2000)
    const { data, error } = await supabase.anon().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data?.session) throw error ? fromAuthError(error) : new HttpError(401, 'UNAUTHORIZED', '다시 로그인해 주세요.')
    res.json({ session: sessionJson(data.session) })
  })

  // 로그아웃: 이 기기의 로그인 기록을 비움 → 이후 이 토큰(과 앞서 끊긴 옛 토큰)은 SESSION_REPLACED
  // requireAuth를 쓰지 않는 이유: 이미 끊긴 기기도 로그아웃 버튼은 눌러야 하므로 항상 204로 끝냄 (실패해도 화면은 로그아웃)
  app.post('/auth/logout', async (req, res) => {
    const header = req.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (token) {
      const { error } = await supabase.asUser(token).rpc('release_session')
      if (error && error.message !== 'UNAUTHORIZED') console.warn('[logout] release_session 실패', error.message)
    }
    res.status(204).end()
  })

  // 저장된 토큰으로 다시 들어온 사람도 일일 접속자에 잡히게 (11/25) — 로그인을 다시 하지 않으면 /auth/login의 기록이 안 남음
  // 화면(AdminLauncher → client.js logVisit)이 게임에 들어올 때 한 번 부름. 집계는 하루 한 사람 기준(daily_visitors 뷰)이라 여러 번 와도 셈은 같음
  app.post('/me/visit', requireAuth, async (req, res) => {
    await rpc(req.db, 'log_access')
    res.json({ counted: true })
  })

  app.get('/me', requireAuth, async (req, res) => {
    const profile = await loadProfile(req.db, req.user.id)
    res.json({ user: profileJson(req.user, profile) })
  })

  // (11/27 지민) 관리자 2단계 인증(TOTP)은 없앰 — 팀 간트에 없던 선택 기능이고 시연 중 관리자 화면이 막힐 위험만 있어서
  //   없앤 내용: /auth/mfa/verify·enroll·enroll/verify, requireRole의 MFA_REQUIRED, DB mfa_ok() (20261203120000_jm_remove_admin_mfa.sql)

  // 닉네임 바꾸기 — 이름만 받는다. 역할·가게는 보내도 무시 (DB 트리거 guard_profile_update도 한 번 더 막음)
  // 이름 변경은 감사 로그에 남기지 않음 (audit_write는 역할·가게 변경만 기록)
  app.patch('/me', requireAuth, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name || [...name].length > 20) throw new HttpError(400, 'INVALID_INPUT', '닉네임은 1~20자로 입력해 주세요.')
    const { data, error } = await req.db
      .from('profiles')
      .update({ display_name: name })
      .eq('id', req.user.id)
      .select('display_name, role, shop_id')
      .maybeSingle()
    if (error) throw fromDbError(error)
    if (!data) throw new HttpError(404, 'NOT_FOUND', '프로필을 찾지 못했어요. 다시 로그인해 주세요.')
    res.json({ user: profileJson(req.user, data) })
  })

  // ── 캐릭터 꾸미기 ──
  // client.js getAppearance / saveAppearance: { appearance } — 항목(characterId·색·옷 …)은 화면이 정함
  app.get('/me/appearance', requireAuth, async (req, res) => {
    const { data, error } = await req.db.from('profiles').select('appearance').eq('id', req.user.id).maybeSingle()
    if (error) throw fromDbError(error)
    res.json({ appearance: data?.appearance ?? {} })
  })

  // 보낸 항목만 바꿈 (null이면 그 항목 삭제). 합치기·2KB 제한은 DB 함수 save_appearance
  app.patch('/me/appearance', requireAuth, async (req, res) => {
    const patch = req.body?.appearance
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || JSON.stringify(patch).length > 2048) {
      throw new HttpError(400, 'INVALID_INPUT', '꾸미기 값을 확인해 주세요.')
    }
    res.json({ appearance: await rpc(req.db, 'save_appearance', { p_patch: patch }) })
  })

  // ── 커플 타로 결과 (화면·AI: 병관) — 카드 id와 해석 요약만, 두 사람이 쓴 답 원문은 보내지 않기 ──
  // client.js listTarotReadings: { readings } (최신순, 기본 10개 · 최대 30개)
  app.get('/me/tarot-readings', requireAuth, async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 30)
    const { data, error } = await req.db
      .from('tarot_readings')
      .select('id, spread, cards, summary, detail, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw fromDbError(error)
    res.json({ readings: data.map(tarotJson) })
  })

  // client.js saveTarotReading: { reading } — 형식·크기·횟수·최근 30개 보관은 DB 함수 save_tarot_reading
  app.post('/me/tarot-readings', requireAuth, async (req, res) => {
    const { spread, cards, summary, detail } = req.body ?? {}
    if (
      typeof spread !== 'string' ||
      !Array.isArray(cards) ||
      !cards.every((c) => typeof c === 'string') ||
      typeof summary !== 'string' ||
      (detail !== undefined && detail !== null && (typeof detail !== 'object' || Array.isArray(detail)))
    ) {
      throw new HttpError(400, 'INVALID_INPUT', '타로 결과 값을 확인해 주세요.')
    }
    const reading = await rpc(req.db, 'save_tarot_reading', { p_spread: spread, p_cards: cards, p_summary: summary, p_detail: detail ?? {} })
    res.status(201).json({ reading })
  })

  // client.js deleteTarotReading: { ok: true } — 본인 기록만 (RLS)
  app.delete('/me/tarot-readings/:readingId', requireAuth, async (req, res) => {
    const readingId = req.params.readingId
    if (!UUID_RE.test(readingId)) throw new HttpError(400, 'INVALID_INPUT', 'readingId 값을 확인해 주세요.')
    const { data, error } = await req.db.from('tarot_readings').delete().eq('id', readingId).eq('user_id', req.user.id).select('id')
    if (error) throw fromDbError(error)
    if (!data?.length) throw new HttpError(404, 'NOT_FOUND', '없는 타로 기록이에요.')
    res.json({ ok: true })
  })

  // ── 워프존 활성화 기록 (워프존 화면: 병관 bk_warpStore.js) ──
  // client.js listWarps: { warps: ['warp_bk', …] } — 본인 것만 (RLS + user_id 조건)
  app.get('/me/warps', requireAuth, async (req, res) => {
    const { data, error } = await req.db.from('warp_unlocks').select('warp_id').eq('user_id', req.user.id).order('warp_id')
    if (error) throw fromDbError(error)
    res.json({ warps: data.map((row) => row.warp_id) })
  })

  // client.js unlockWarp: { warps } — 허용 id 4개 검사·중복 무시는 DB 함수 unlock_warp
  // 이미 켠 워프를 다시 보내도 같은 결과라 201이 아니라 200
  app.post('/me/warps', requireAuth, async (req, res) => {
    const warpId = req.body?.warpId
    if (typeof warpId !== 'string' || !/^warp_[a-z]{2}$/.test(warpId)) {
      throw new HttpError(400, 'INVALID_INPUT', '워프존 id를 확인해 주세요.')
    }
    res.json({ warps: await rpc(req.db, 'unlock_warp', { p_warp_id: warpId }) })
  })

  // ── 스탬프 ──
  // client.js collectStamp: { stamp, issuedCoupons }
  app.post('/stamps', requireAuth, async (req, res) => {
    const placeId = requireString(req.body?.placeId, 'placeId', 100)
    res.status(201).json(await rpc(req.db, 'collect_stamp', { p_place_id: placeId }))
  })

  // client.js listMyStamps: { stamps: [{ id, placeId, createdAt }] }
  app.get('/stamps/me', requireAuth, async (req, res) => {
    const { data, error } = await req.db
      .from('stamps')
      .select('id, place_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true })
    if (error) throw fromDbError(error)
    res.json({ stamps: data.map((s) => ({ id: s.id, placeId: s.place_id, createdAt: s.created_at })) })
  })

  // ── 쿠폰 ──
  // client.js listMyCoupons: { coupons } (최신순)
  app.get('/coupons/me', requireAuth, async (req, res) => {
    // RLS상 사장님은 자기 가게 쿠폰도 보이므로, "내가 받은 쿠폰"만 다시 거른다
    const { data, error } = await req.db
      .from('coupons')
      .select('*, places(name)')
      .eq('user_id', req.user.id)
      .order('issued_at', { ascending: false })
    if (error) throw fromDbError(error)
    res.json({ coupons: data.map(couponJson) })
  })

  // client.js redeemCoupon: { coupon }  (사장님)
  // idempotencyKey: 같은 요청을 다시 보내도(버튼 두 번, 응답 유실 후 재시도) 같은 결과
  app.post('/coupons/redeem', requireAuth, async (req, res) => {
    const code = requireString(req.body?.code, '쿠폰 코드', 20)
    const key = req.body?.idempotencyKey
    if (key !== undefined && !(typeof key === 'string' && UUID_RE.test(key))) {
      throw new HttpError(400, 'INVALID_INPUT', 'idempotencyKey는 UUID여야 해요.')
    }
    const result = await rpc(req.db, 'redeem_coupon', { p_code: code, p_idempotency_key: key ?? randomUUID() })
    res.json(result)
  })

  // ── 사장님 ──
  // client.js getShopStats: { issued, used, visitors, recentRedemptions }
  // 관리자 통계 (화면: 성근 #/admin). 관리자 검사·집계는 DB 함수 get_admin_stats가 함 → 아니면 403 NOT_ADMIN
  app.get('/admin/stats', requireAuth, requireRole('admin'), async (req, res) => {
    res.json(await rpc(req.db, 'get_admin_stats'))
  })

  app.get('/shop/stats', requireAuth, requireRole('owner'), async (req, res) => {
    res.json(await rpc(req.db, 'get_shop_stats'))
  })

  // client.js saveShopPromo: { shopPromo: { text, tag, savedAt } }
  app.put('/shop/promo', requireAuth, requireRole('owner'), async (req, res) => {
    const text = requireString(req.body?.text, '홍보문구', 300)
    const tag = typeof req.body?.tag === 'string' ? req.body.tag.slice(0, 100) : null
    res.json(await rpc(req.db, 'save_shop_promo', { p_text: text, p_tag: tag }))
  })

  // client.js getShopPromo: { shopPromo | null }  — 로그인 전에도 맵 대화창에서 보임
  app.get('/shops/:shopId/promo', async (req, res) => {
    const shopId = requireString(req.params.shopId, 'shopId', 100)
    const { data, error } = await supabase.anon().from('shop_promos').select('text, tag, saved_at').eq('shop_id', shopId).maybeSingle()
    if (error) throw fromDbError(error)
    res.json({ shopPromo: data ? { text: data.text, tag: data.tag, savedAt: data.saved_at } : null })
  })

  // ── 체험 (농구 슛 등) — 시작 시각을 서버가 기록해서 너무 빠른 완료(가짜 기록)를 거부 ──
  app.post('/activities/:activityId/start', requireAuth, async (req, res) => {
    const activityId = requireString(req.params.activityId, 'activityId', 100)
    res.status(201).json({ sessionId: await rpc(req.db, 'start_activity', { p_activity_id: activityId }) })
  })

  app.post('/activities/sessions/:sessionId/complete', requireAuth, async (req, res) => {
    const sessionId = req.params.sessionId
    if (!UUID_RE.test(sessionId)) throw new HttpError(400, 'INVALID_INPUT', 'sessionId 값을 확인해 주세요.')
    res.json(await rpc(req.db, 'complete_activity', { p_session_id: sessionId }))
  })

  // ── 없는 주소 · 에러 ──
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', '없는 주소예요.')))

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      if (err.retryAfter) res.set('Retry-After', String(err.retryAfter))
      return res.status(err.status).json({ error: { code: err.code, message: err.message } })
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: '요청 형식(JSON)을 확인해 주세요.' } })
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'INVALID_INPUT', message: '요청이 너무 커요.' } })
    console.error('[server]', err)
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: '잠시 뒤에 다시 시도해 주세요.' } })
  })

  return app
}
