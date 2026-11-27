import { useEffect } from 'react'
import { getSignTexture } from '../../game/Map/styles/textures.js'
import { GEO } from '../../game/Map/styles/kit.jsx'
import { zoneToWorld } from './hjAreas.js'
import { registerWarpSpot } from './palaceSeating.js'
import { seoulToWorld } from './timeTravel.js'
import { FARE_NAME, PRICES, useWallet } from './wallet.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 매표소 (혜진 영화·드라마 구역): 코인으로 전차표·기차표 사기
// 경성역 앞·기차 승강장·전차 정류장 3곳·현대 서울역에 작은 매표소가 있어요. 가까이 가서 E → 매표 창이 열려요.

// 매표소 자리 (월드 [x, 몸통 높이, z]) + 바라보는 방향
export const BOOTHS = [
  { id: 'gs_station_front', name: '경성역 매표소', pos: zoneToWorld(-25.6, 99.6, 1.4), yaw: Math.PI / 2 },
  { id: 'gs_platform', name: '기차 승강장 매표소', pos: zoneToWorld(-38.6, 101.5, 1.45), yaw: Math.PI / 2 },
  { id: 'gs_tram_east', name: '동대문 전차 매표소', pos: zoneToWorld(34.2, 92.6, 1.4), yaw: -Math.PI / 2 },
  { id: 'gs_tram_jongno', name: '종로 전차 매표소', pos: zoneToWorld(3.9, 104.6, 1.4), yaw: -Math.PI / 2 },
  { id: 'gs_tram_gov', name: '총독부 앞 전차 매표소', pos: zoneToWorld(3.9, 133.2, 1.4), yaw: -Math.PI / 2 },
  { id: 'seoul_station', name: '서울역 매표소', pos: seoulToWorld(-14, 1.9, -95.5), yaw: 0 },
].filter((b) => b.pos)

for (const b of BOOTHS) {
  registerWarpSpot({ id: `booth_${b.id}`, position: b.pos, radius: 1.6, prompt: `🎫 ${b.name} · 표 사기`, action: () => useWallet.getState().openBooth() })
}

// 3D: 작은 나무 매표소 (지붕 + 창구 + "매표소" 간판)
export function TicketKiosks() {
  const sign = getSignTexture('🎫 매표소', '#2b3a67', '#ffe9a8', 3)
  return BOOTHS.map((b) => (
    <group key={b.id} position={[b.pos[0], b.pos[1] - 1.0, b.pos[2]]} rotation-y={b.yaw}>
      <group position={[0, 0, -1.3]}>
        <mesh geometry={GEO.box} position={[0, 1.1, 0]} scale={[1.6, 2.2, 1.2]}>
          <meshStandardMaterial color="#8a5a36" roughness={0.85} />
        </mesh>
        <mesh geometry={GEO.box} position={[0, 2.3, 0.1]} scale={[2.0, 0.18, 1.6]}>
          <meshStandardMaterial color="#3b4a5a" roughness={0.7} />
        </mesh>
        <mesh geometry={GEO.box} position={[0, 1.35, 0.61]} scale={[1.0, 0.6, 0.03]}>
          <meshStandardMaterial color="#cfe3ea" transparent opacity={0.55} />
        </mesh>
        <mesh geometry={GEO.box} position={[0, 0.95, 0.72]} scale={[1.3, 0.06, 0.26]}>
          <meshStandardMaterial color="#5e4030" />
        </mesh>
        <mesh position={[0, 1.95, 0.62]}>
          <planeGeometry args={[1.4, 0.42]} />
          <meshBasicMaterial map={sign} />
        </mesh>
      </group>
    </group>
  ))
}

// 매표 창 (화면 가운데)
export default function TicketBoothPanel() {
  const open = useWallet((s) => s.booth)
  const coins = useWallet((s) => s.coins)
  const tickets = useWallet((s) => s.tickets)
  const close = useWallet((s) => s.closeBooth)
  const buy = useWallet((s) => s.buy)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  if (!open) return null
  return (
    <div className="rk-panel rk-booth ui-interactive" role="dialog" aria-label="매표소">
      <div className="rk-guide-head">
        <p className="rk-say">
          <span className="rk-who">매표소</span>
          어디로 가시나요?
        </p>
        <button type="button" className="rk-close" onClick={close} aria-label="매표소 닫기">
          ✕
        </button>
      </div>
      <p className="rk-wallet">
        🪙 코인 <strong>{coins}</strong> · 🎫 전차표 <strong>{tickets.tram}</strong> · 기차표 <strong>{tickets.train}</strong>
      </p>
      <div className="rk-choices">
        {['tram', 'train'].map((kind) => (
          <button key={kind} type="button" className="rk-choice" disabled={coins < PRICES[kind]} onClick={() => buy(kind)}>
            <span className="rk-guide-name">
              {FARE_NAME[kind]} 사기
              <small>
                🪙 {PRICES[kind]} · {kind === 'tram' ? '경성 전차 (종로·동대문·총독부 앞)' : '증기기관차·시간 열차·애니 환승 열차'}
              </small>
            </span>
          </button>
        ))}
      </div>
      <p className="rk-sub">코인은 끄는 인력거로 손님을 태워 주거나, 광복 프로젝트를 끝내면 받아요 · Esc 닫기</p>
    </div>
  )
}
