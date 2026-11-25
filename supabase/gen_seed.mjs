// shared/places.json → supabase/seed.sql 생성 (담당: 지민)
// 맵의 장소가 바뀌면 다시 실행:  node supabase/gen_seed.mjs
// 장소 id는 3D 맵·화면·DB가 함께 쓰는 키라서, 손으로 옮겨 적지 않고 같은 파일에서 만든다.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const places = JSON.parse(readFileSync(join(root, 'shared/places.json'), 'utf8'))

// 가게별 쿠폰 혜택 (frontend/src/api/mockDb.js의 SHOP_OFFERS와 같은 내용)
const SHOP_OFFERS = {
  shop_hj_snack: { title: '정류장 분식 떡볶이 사이즈 업 쿠폰', discount: 'SIZE UP', perk: '떡볶이 사이즈 업', menu: '비 오는 날 떡볶이', validDays: 30 },
  // 11/25 애니 구역 명장면 마당 옆 가게 (명장면과 같은 작품)
  shop_jm_donguri: { title: '도토리 찻집 보리차 한 잔 무료 쿠폰', discount: 'FREE TEA', perk: '보리차 한 잔 무료', menu: '도토리 쿠키와 보리차', validDays: 30 },
  shop_jm_kumihimo: { title: '매듭끈 가게 만들기 체험 20% 할인권', discount: '20% OFF', perk: '매듭끈 만들기 20% 할인', menu: '손목 매듭끈 만들기', validDays: 30 },
  shop_jm_fuji: { title: '등꽃 찻집 경단 1+1 쿠폰', discount: '1+1', perk: '등꽃 경단 하나 더', menu: '등꽃 경단과 말차', validDays: 30 },
  shop_jm_antique: { title: '요괴 과자점 만주 하나 무료 쿠폰', discount: 'FREE', perk: '고양이 만주 하나 무료', menu: '고양이 모양 만주', validDays: 30 },
  shop_jm_sakura: { title: '이끼 찻집 쑥떡 1+1 쿠폰', discount: '1+1', perk: '쑥떡 하나 더', menu: '쑥떡과 숲 차', validDays: 30 },
  shop_jm_manju: { title: '온천 찐빵 가게 찐빵 하나 무료 쿠폰', discount: 'FREE', perk: '팥 찐빵 하나 무료', menu: '온천 김에 찐 팥 찐빵', validDays: 30 },
}

// 체험 (frontend/src/game/Map/styles/jm_activityStore.js와 같은 id)
// min_seconds: 서버 시계로 이보다 빨리 끝나면 가짜 완료로 거부
const ACTIVITIES = [
  { id: 'jm_hoop', name: '농구 슛 체험', minSeconds: 5 },
  { id: 'jm_busstop', name: '비 오는 정류장 체험', minSeconds: 8 },
  { id: 'jm_skip', name: '물수제비 체험', minSeconds: 3 },
]

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`)

const lines = [
  '-- 자동 생성 파일입니다. 직접 고치지 말고 `node supabase/gen_seed.mjs`로 다시 만드세요.',
  '-- 원본: shared/places.json',
  '',
  'insert into public.places (id, type, zone, name, work) values',
  places.map((p) => `  (${q(p.id)}, ${q(p.type)}, ${q(p.zone)}, ${q(p.name)}, ${q(p.work ?? null)})`).join(',\n'),
  'on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;',
  '',
  'insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values',
  Object.entries(SHOP_OFFERS)
    .map(([id, o]) => `  (${q(id)}, ${q(o.title)}, ${q(o.discount)}, ${q(o.perk)}, ${q(o.menu)}, ${o.validDays})`)
    .join(',\n'),
  'on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;',
  '',
  'insert into public.activities (id, name, min_seconds) values',
  ACTIVITIES.map((a) => `  (${q(a.id)}, ${q(a.name)}, ${a.minSeconds})`).join(',\n'),
  'on conflict (id) do update set name = excluded.name, min_seconds = excluded.min_seconds;',
  '',
]

writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n'), 'utf8')
console.log(`seed.sql: 장소 ${places.length}곳, 가게 혜택 ${Object.keys(SHOP_OFFERS).length}개, 체험 ${ACTIVITIES.length}개`)
