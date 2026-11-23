// DB·Supabase Auth 에러를 화면이 쓰는 { error: { code, message } } 모양으로 바꾼다.
//
// DB 함수(migration)는 `raise exception 'ALREADY_STAMPED' using detail = '이미 받은 스탬프예요.'`처럼
// message에 코드, detail에 안내 문구를 넣는다. PostgREST는 이걸 { message, details }로 돌려준다.
// → 코드는 그대로 화면에 넘기고(client.js의 ApiError.code), HTTP 상태만 여기서 정한다.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// DB 함수가 던지는 코드 → HTTP 상태
const DB_CODE_STATUS = {
  UNAUTHORIZED: 401,
  NOT_OWNER: 403,
  FORBIDDEN: 403,
  WRONG_SHOP: 403,
  NOT_FOUND: 404,
  ALREADY_STAMPED: 409,
  COUPON_USED: 409,
  NOT_STAMPABLE: 400,
  INVALID_CODE: 400,
  COUPON_EXPIRED: 400,
  TOO_FAST: 400,
  INVALID_INPUT: 400,
  TOO_LARGE: 400,
  TOO_MANY_REQUESTS: 429,
}

/** supabase.rpc()/from() 가 돌려준 error → HttpError */
export function fromDbError(error) {
  const code = String(error?.message ?? '')
  if (code in DB_CODE_STATUS) {
    return new HttpError(DB_CODE_STATUS[code], code, error.details || code)
  }
  // 예상하지 못한 DB 에러는 내용을 밖으로 내보내지 않음 (테이블 이름 등 내부 정보 노출 방지)
  console.error('[db]', error)
  return new HttpError(500, 'SERVER_ERROR', '잠시 뒤에 다시 시도해 주세요.')
}

/** supabase.auth.* 가 돌려준 error → HttpError */
export function fromAuthError(error) {
  const code = error?.code ?? ''
  if (code === 'invalid_credentials') return new HttpError(401, 'INVALID_LOGIN', '이메일 또는 비밀번호가 맞지 않아요.')
  if (code === 'email_not_confirmed') return new HttpError(403, 'EMAIL_NOT_CONFIRMED', '이메일 인증을 먼저 해 주세요.')
  if (code === 'user_already_exists' || code === 'email_exists') return new HttpError(409, 'EMAIL_TAKEN', '이미 가입한 이메일이에요.')
  if (code === 'weak_password') return new HttpError(400, 'WEAK_PASSWORD', '비밀번호는 6자 이상이어야 해요.')
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_expired' || code === 'bad_jwt') {
    return new HttpError(401, 'UNAUTHORIZED', '다시 로그인해 주세요.')
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return new HttpError(429, 'TOO_MANY_REQUESTS', '잠시 뒤에 다시 시도해 주세요.')
  }
  console.error('[auth]', error)
  return new HttpError(500, 'SERVER_ERROR', '잠시 뒤에 다시 시도해 주세요.')
}
