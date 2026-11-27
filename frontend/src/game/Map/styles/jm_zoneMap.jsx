import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useGameStore } from '../../../store/gameStore.js'
import { layout, mapPlaces } from '../../data/mapData.js'
import { useWarps } from './bk_warpStore.js'

// 애니메이션 구역(JM) 지도 창 — 담당: 지민 (11/27)
// 명장면 안내판을 누르면 열림 (경복궁 「관람길」 안내판처럼): 구역 평면도 + 명장면·가게·마을 시설 핀 → 누르면 그 자리로 이동
// 이동은 병관 님 워프 요청(bk_warpStore.js의 center 요청)을 빌려 씀 → 공용 파일을 고치지 않음
// 창은 <dialog>.showModal()이라 3D 화면 위 최상단 층에 뜸 (Html 안에 있어도 위치가 틀어지지 않음)
// 지도 좌표 = 월드 좌표 (x 오른쪽, z 아래쪽 = 남쪽). 위쪽이 북쪽(온천장)

export const JM_MAP_PANEL = 'jm_zone_map'

export function openJmZoneMap(signId) {
  const game = useGameStore.getState()
  if (!game.openPanel) game.open({ type: JM_MAP_PANEL, placeId: signId })
}
function closeJmZoneMap() {
  const game = useGameStore.getState()
  if (game.openPanel?.type === JM_MAP_PANEL) game.close()
}

// 보이는 범위 (월드 좌표): 입구 숲(남) ~ 온천장 섬(북)
const VIEW = { x0: -96, x1: 96, z0: -288, z1: -38 }
const ORIGIN_Z = -85 // 구역 origin z (구역 좌표 → 월드: z - 85)
const w2 = ([x, z]) => [x, z + ORIGIN_Z]

// 실제로 가 볼 수 있는 곳 (현지 성지·가게). 확인된 곳만 넣음 — 없으면 버튼을 안 보여 줌
// query는 구글 지도 검색어 그대로. 11/27 조사 결과로 채움
// kind: 'shop' = 실제로 그 메뉴·체험을 하는 가게 / 'spot' = 가게는 없고 근처 성지·명소로 안내
// ⚠ 작품 공식 콜라보 가게는 하나도 없음 (팬·관광 매체가 꼽는 모델지 기준). 기간 한정 팝업은 넣지 않음
export const JM_REAL_PLACES = {
  // 명장면
  spot_jm_crossing: { kind: 'spot', name: '가미야스마쓰 지조손 (사이타마 도코로자와)', query: '上安松地蔵尊' },
  spot_jm_stairs: { kind: 'spot', name: '케타와카미야 신사 (기후 히다후루카와)', query: '気多若宮神社' },
  spot_jm_shrine: { kind: 'spot', name: '호만구 가마도 신사 (후쿠오카 다자이후)', query: '宝満宮竈門神社' },
  spot_jm_sakura_river: { kind: 'spot', name: '시라타니운스이쿄 이끼 숲 (가고시마 야쿠시마)', query: '白谷雲水峡 苔むす森' },
  spot_jm_onsen: { kind: 'spot', name: '에도도쿄 건축물원 고다카라유 (도쿄 고가네이)', query: '江戸東京たてもの園' },
  spot_jm_hill: { kind: 'spot', name: '아마미야 신사 (구마모토 사가라무라)', query: '雨宮神社 相良村' },
  // 가게
  shop_jm_donguri: { kind: 'shop', name: '도토리숲 잠실 롯데월드몰점 (지브리 굿즈점)', query: '도토리숲 롯데월드몰' },
  shop_jm_kumihimo: { kind: 'shop', name: '히다후루카와 사쿠라 물산관 (쿠미히모 체험)', query: '飛騨古川さくら物産館' },
  shop_jm_manju: { kind: 'shop', name: '가스리야 본점 (도고온천 만주)', query: '絣屋 道後' },
  shop_jm_fuji: { kind: 'spot', name: '가메이도텐진샤 등꽃 (도쿄) — 실제 찻집은 없음', query: '亀戸天神社' },
  shop_jm_sakura: { kind: 'spot', name: '시라타니운스이쿄 (야쿠시마) — 실제 찻집은 없음', query: '白谷雲水峡' },
  shop_jm_antique: { kind: 'spot', name: '히토요시역 (나츠메 성지 마을) — 상설 가게는 없음', query: '人吉駅' },
}

// 마을 시설 (구역 좌표로 적고 월드로 바꿈). go = 이동할 자리(평평한 바닥 근처)
const FACILITIES = [
  { id: 'tunnel', name: '붉은 탑 터널 (입구)', go: [0, 30] },
  { id: 'field', name: '풀밭 언덕 · 마른 강 징검돌', go: [0, -8] },
  { id: 'stage', name: '전망 무대', go: [33, 15.6] },
  { id: 'gate', name: '마을 문 「灯籠横丁」', go: [0, -56] },
  { id: 'cross', name: '음식점 거리 사거리', go: [0, -77] },
  { id: 'garden', name: '배추밭 정원', go: [62, -112] },
  { id: 'bridge', name: '온천장 붉은 다리', go: [0, -128] },
  { id: 'yard', name: '온천장 「湯灯屋」 앞마당', go: [0, -153] },
  { id: 'pier', name: '바다 역 「湯灯駅」 선착장', go: [-76, -133.7] },
].map((f) => ({ ...f, go: w2(f.go) }))

// 평면도에 그릴 소품 (layout.props 중 JM 것만, 종류별 색)
const DRAW = {
  land: ['jmLandFill'],
  hill: ['jmGrassHill', 'jmFloor', 'jmMossPath'],
  forest: ['jmForest', 'jmForestPath'],
  dirt: ['jmDirtFloor', 'jmSlopeRoad'],
  river: ['jmBoulderRiver'],
  water: ['jmCanal'],
  house: ['jmEatery', 'jmVerandaShop', 'jmPinkHouse', 'jmShed', 'jmFieldHut', 'jmBoilerBasement'],
  big: ['jmYutoya', 'jmTunnelGate'],
  bridge: ['jmGrandBridge', 'jmPipeBridge'],
}
const COLORS = {
  sea: '#9cc6d6', land: '#cfe0b4', hill: '#b9d39a', forest: '#7fa86a', dirt: '#dcc9a3', river: '#c9d6d2',
  water: '#8cbfd2', house: '#b46a4c', big: '#8a2f2a', bridge: '#c0392b', scene: '#f4d9a8',
}

function rectOf(item) {
  const [x, z] = item.position
  const [w, , d] = item.size ?? [1, 1, 1]
  return { x, z, w, d, rot: -(item.rotationDeg ?? 0) } // three.js y회전(반시계) → SVG 회전(시계)
}

function usePlan() {
  return useMemo(() => {
    const jm = layout.props.filter((p) => p.zone === 'JM')
    const layers = Object.fromEntries(Object.entries(DRAW).map(([k, styles]) => [k, jm.filter((p) => styles.includes(p.style)).map(rectOf)]))
    const scenes = jm.filter((p) => p.style === 'jmSceneRoom').map((p) => {
      const r = rectOf(p)
      const turned = Math.abs(p.rotationDeg ?? 0) === 90
      return { ...r, w: turned ? p.room.d : p.room.w, d: turned ? p.room.w : p.room.d, rot: 0 }
    })
    const roads = layout.roads.filter((r) => r.zone === 'JM').map(rectOf)
    return { layers, scenes, roads }
  }, [])
}

const SCENE_NO = { spot_jm_crossing: '①', spot_jm_stairs: '②', spot_jm_shrine: '③', spot_jm_sakura_river: '④', spot_jm_onsen: '⑤', spot_jm_hill: '⑥' }
const WORK_OF = (p) => (p.work ?? '').replace(/^애니메이션\s*/, '')

function Rect({ r, fill, rx = 0.6, stroke }) {
  return (
    <rect x={r.x - r.w / 2} y={r.z - r.d / 2} width={r.w} height={r.d} rx={rx} fill={fill} stroke={stroke}
      strokeWidth={stroke ? 0.4 : 0} transform={r.rot ? `rotate(${r.rot} ${r.x} ${r.z})` : undefined} />
  )
}

function Plan({ hover, setHover, travel }) {
  const { layers, scenes, roads } = usePlan()
  const places = mapPlaces.filter((p) => p.zone === 'JM')
  const W = VIEW.x1 - VIEW.x0
  const H = VIEW.z1 - VIEW.z0
  return (
    <svg viewBox={`${VIEW.x0} ${VIEW.z0} ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="애니메이션 구역 지도">
      <rect x={VIEW.x0} y={VIEW.z0} width={W} height={H} fill={COLORS.sea} />
      {['land', 'hill', 'forest', 'river', 'dirt', 'water'].map((k) => (
        <g key={k}>{layers[k].map((r, i) => <Rect key={i} r={r} fill={COLORS[k]} rx={k === 'forest' ? 3 : 0.8} />)}</g>
      ))}
      <g>{roads.map((r, i) => <Rect key={i} r={r} fill={COLORS.dirt} rx={0.3} />)}</g>
      <g>{scenes.map((r, i) => <Rect key={i} r={r} fill={COLORS.scene} rx={3} stroke="#c9a46a" />)}</g>
      <g>{layers.bridge.map((r, i) => <Rect key={i} r={r} fill={COLORS.bridge} rx={0.4} />)}</g>
      <g>{layers.house.map((r, i) => <Rect key={i} r={r} fill={COLORS.house} rx={0.4} />)}</g>
      <g>{layers.big.map((r, i) => <Rect key={i} r={r} fill={COLORS.big} rx={0.8} />)}</g>
      {/* 시설 핀 (작은 흰 점) */}
      {FACILITIES.map((f) => (
        <circle key={f.id} cx={f.go[0]} cy={f.go[1]} r={hover === f.id ? 2.6 : 1.9} fill="#fffaf0" stroke="#5b3a29" strokeWidth={0.6}
          style={{ cursor: 'pointer' }} onClick={() => travel(f.go, f.name)} onPointerEnter={() => setHover(f.id)} onPointerLeave={() => setHover(null)}>
          <title>{f.name}</title>
        </circle>
      ))}
      {/* 명장면(주황 원 + 번호) · 가게(갈색 사각) */}
      {places.map((p) => {
        const [x, , z] = p.position
        const on = hover === p.id
        const go = () => travel([x, z], p.name)
        const ev = { onClick: go, onPointerEnter: () => setHover(p.id), onPointerLeave: () => setHover(null), style: { cursor: 'pointer' } }
        return p.type === 'spot' ? (
          <g key={p.id} {...ev}>
            <circle cx={x} cy={z} r={on ? 5 : 4} fill="#e8792a" stroke="#fff" strokeWidth={0.8} />
            <text x={x} y={z + 1.6} fontSize={4.6} textAnchor="middle" fill="#fff" fontWeight={700} style={{ pointerEvents: 'none' }}>{SCENE_NO[p.id]?.replace(/[①-⑥]/, (c) => '①②③④⑤⑥'.indexOf(c) + 1) ?? '★'}</text>
            <title>{p.name}</title>
          </g>
        ) : (
          <g key={p.id} {...ev}>
            <rect x={x - (on ? 3.2 : 2.6)} y={z - (on ? 3.2 : 2.6)} width={on ? 6.4 : 5.2} height={on ? 6.4 : 5.2} rx={1} fill="#7a4a24" stroke="#fff" strokeWidth={0.7} />
            <title>{p.name}</title>
          </g>
        )
      })}
      <text x={VIEW.x1 - 6} y={VIEW.z0 + 9} fontSize={6} textAnchor="end" fill="#2b3a42" fontWeight={700}>북 ↑</text>
    </svg>
  )
}

const CSS = `
.jm-map{border:none;padding:0;border-radius:18px;background:#fbf6ea;color:#3a2a20;width:min(980px,calc(100vw - 32px));max-height:calc(100dvh - 32px);box-shadow:0 20px 60px #0006;font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
.jm-map::backdrop{background:#1d1a2a99}
.jm-map header{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 22px 8px}
.jm-map h2{margin:0;font-size:22px}
.jm-map header p{margin:4px 0 0;font-size:13px;color:#7a6250}
.jm-map .x{border:none;background:#efe4cf;border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer;color:#3a2a20}
.jm-map .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:16px;padding:8px 22px 20px}
.jm-map .plan{aspect-ratio:192/250;max-height:calc(100dvh - 150px);border-radius:12px;overflow:hidden;border:2px solid #8a6a4a;justify-self:center;width:100%}
.jm-map nav{overflow:auto;max-height:calc(100dvh - 150px);padding-right:4px}
.jm-map h3{font-size:14px;margin:10px 0 6px;color:#5b3a29}
.jm-map .note{font-size:12px;color:#8a7260;margin:-2px 0 6px}
.jm-map ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.jm-map li{display:flex;align-items:center;gap:6px;border:1px solid #e3d5bc;border-radius:10px;background:#fff;padding:6px 8px}
.jm-map li[data-on]{border-color:#e8792a;box-shadow:0 0 0 2px #e8792a33}
.jm-map li .go{flex:1;text-align:left;border:none;background:none;cursor:pointer;color:inherit;font:inherit;font-size:13px;padding:2px}
.jm-map li .go b{display:block;font-size:13px}
.jm-map li .go small{color:#8a7260;font-size:11.5px}
.jm-map li a{font-size:11.5px;white-space:nowrap;color:#1e5a8a;text-decoration:none;border:1px solid #bcd3e6;border-radius:999px;padding:3px 8px;background:#f2f8fc}
.jm-map .dot{width:18px;height:18px;border-radius:50%;background:#e8792a;color:#fff;font-size:11px;display:grid;place-items:center;flex:none;font-weight:700}
.jm-map .sq{width:14px;height:14px;border-radius:3px;background:#7a4a24;flex:none}
.jm-map .pin{width:12px;height:12px;border-radius:50%;background:#fffaf0;border:2px solid #5b3a29;flex:none}
@media (max-width:720px){.jm-map .grid{grid-template-columns:1fr}.jm-map .plan{max-height:46dvh;width:auto}}
`

function RealLink({ id }) {
  const real = JM_REAL_PLACES[id]
  if (!real) return null
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(real.query)}`} target="_blank" rel="noopener noreferrer"
      title={real.name} onClick={(e) => e.stopPropagation()}>{real.kind === 'shop' ? '📍 실제 가게' : '📍 실제 성지'}</a>
  )
}

function JmZoneMapDialog() {
  const dialog = useRef(null)
  const [hover, setHover] = useState(null)
  const places = mapPlaces.filter((p) => p.zone === 'JM')
  const spots = places.filter((p) => p.type === 'spot').sort((a, b) => (SCENE_NO[a.id] ?? '').localeCompare(SCENE_NO[b.id] ?? ''))
  const shops = places.filter((p) => p.type === 'cafe')

  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])

  const travel = ([x, z], label) => {
    closeJmZoneMap()
    useWarps.setState({ request: { center: [x, z], label } })
  }

  const row = (p, mark) => (
    <li key={p.id} data-on={hover === p.id ? '' : undefined} onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)}>
      {mark}
      <button type="button" className="go" onClick={() => travel([p.position[0], p.position[2]], p.name)}>
        <b>{p.name.replace(/^명장면 [①-⑥]\s*/, '')}</b><small>{WORK_OF(p)}</small>
      </button>
      <RealLink id={p.id} />
    </li>
  )

  return (
    <dialog ref={dialog} className="jm-map ui-interactive" aria-labelledby="jm-map-title"
      onCancel={(e) => { e.preventDefault(); closeJmZoneMap() }} onKeyDown={(e) => e.stopPropagation()}>
      <style>{CSS}</style>
      <header>
        <div>
          <h2 id="jm-map-title">애니메이션 구역 지도</h2>
          <p>지도나 이름을 누르면 그 자리로 바로 이동해요. 「실제 가게·성지」는 현실 장소를 구글 지도로 열어요.</p>
        </div>
        <button type="button" className="x" aria-label="지도 닫기" onClick={closeJmZoneMap}>×</button>
      </header>
      <div className="grid">
        <div className="plan"><Plan hover={hover} setHover={setHover} travel={travel} /></div>
        <nav aria-label="이동할 곳">
          <h3>명장면 (스탬프)</h3>
          <ul>{spots.map((p) => row(p, <span className="dot">{'①②③④⑤⑥'.indexOf(SCENE_NO[p.id]) + 1 || '★'}</span>))}</ul>
          <h3>같은 작품 가게 (쿠폰)</h3>
          <ul>{shops.map((p) => row(p, <span className="sq" />))}</ul>
          <h3>마을 둘러보기</h3>
          <ul>
            {FACILITIES.map((f) => (
              <li key={f.id} data-on={hover === f.id ? '' : undefined} onPointerEnter={() => setHover(f.id)} onPointerLeave={() => setHover(null)}>
                <span className="pin" />
                <button type="button" className="go" onClick={() => travel(f.go, f.name)}><b>{f.name}</b></button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </dialog>
  )
}

// 안내판(3D)에 붙이는 지도 창 층: 이 안내판이 연 창일 때만 그림 (안내판이 여러 개라 한 번만 뜨게)
export function JmZoneMapLayer({ signId }) {
  const mine = useGameStore((s) => s.openPanel?.type === JM_MAP_PANEL && s.openPanel?.placeId === signId)
  if (!mine) return null
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[30, 0]}>
      <JmZoneMapDialog />
    </Html>
  )
}

// 안내판 판자에 걸 이벤트 (누르면 지도, 손가락 커서)
export function signClickProps(signId) {
  return {
    onClick: (e) => { e.stopPropagation(); openJmZoneMap(signId) },
    onPointerOver: (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { document.body.style.cursor = '' },
  }
}
