// 로그인 시도 제한 (무차별 대입 막기) — 담당: 지민
//
// 왜 서버에서 따로 세나:
//   Supabase Auth도 IP별로 제한하지만, 로그인 요청은 전부 이 서버(Render)를 거쳐 가서
//   Supabase 쪽에서는 모든 사용자가 "서버 IP 하나"로 보인다.
//   → 공격자 한 명만 골라 막을 수 없고, 반대로 한 명이 시도를 몰아서 하면 모두의 로그인이 막힐 수 있다.
//   그래서 실제 사용자 IP(req.ip, Render 프록시 1단 신뢰)와 이메일 기준으로 여기서 먼저 센다.
//
// 한계 (shortcut): 메모리에 세므로 서버가 재시작하면 초기화되고, 서버를 여러 대 띄우면 대수만큼 느슨해진다.
//   지금은 Render 무료 1대라 충분. 여러 대가 되면 Redis 같은 공용 저장소로 옮겨야 한다.

/**
 * 고정 창(window) 방식 카운터
 * @param {{ windowMs: number, max: number, now?: () => number }} opts
 */
export function createLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map() // key → { count, resetAt }

  function current(key, t) {
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= t) return null
    return entry
  }

  return {
    /** 지금 막혔는지. 막혔으면 몇 초 뒤에 풀리는지 */
    check(key) {
      const t = now()
      const entry = current(key, t)
      if (entry && entry.count >= max) return { limited: true, retryAfter: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) }
      return { limited: false }
    },
    /** 한 번 셈 */
    hit(key) {
      const t = now()
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k) // 오래된 키 정리 (메모리 보호)
      }
      let entry = current(key, t)
      if (!entry) {
        entry = { count: 0, resetAt: t + windowMs }
        hits.set(key, entry)
      }
      entry.count += 1
    },
    /** 로그인 성공 시 그 이메일의 실패 횟수 초기화 */
    reset(key) {
      hits.delete(key)
    },
  }
}
