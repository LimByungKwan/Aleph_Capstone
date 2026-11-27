import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { useGameStore } from '../../../store/gameStore.js'
import { findPlayer } from '../../Player/findPlayer.js'
import { Box } from './kit.jsx'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { JM_REAL_SPOTS } from './jm_realSpotData.js'

// 애니메이션 구역(JM) 명장면 팻말 → 「실제 성지 정보」 창 — 담당: 지민 (11/27)
// 명장면 공간(jmSceneRoom)마다 서 있는 팻말 + ⑤ 다리 앞 팻말(jmRealSpotSign)
// 팻말을 누르거나, 가까이 가면 뜨는 「실제 성지 보기」 버튼(또는 E)을 누르면 창이 열림
// 창: 실제 장소 사진(위키미디어 공용, 출처 표시) · 이름 · 주소(누르면 창 안에 지도) · 가는 법 · 설명 · 공식 사이트
// 자료는 jm_realSpotData.js

export const JM_REAL_PANEL = 'jm_real_spot'
const NEAR = 3.2

const useNearSign = create((set) => ({ near: null, set: (near) => set({ near }) }))

function openReal(signId, spot) {
  const game = useGameStore.getState()
  if (!game.openPanel) game.open({ type: JM_REAL_PANEL, placeId: signId, spot })
}
function closeReal() {
  const game = useGameStore.getState()
  if (game.openPanel?.type === JM_REAL_PANEL) game.close()
}

const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
// 새 탭이 아니라 따로 뜨는 브라우저 창으로 지도 열기 (게임 탭은 그대로 둠, 11/27 지민 요청)
// 같은 이름('jm_real_map') 창을 다시 쓰므로 여러 번 눌러도 창이 쌓이지 않음. 팝업이 막히면 새 탭으로라도 엶
function openMapWindow(q) {
  const w = Math.min(1100, window.screen.availWidth - 80)
  const h = Math.min(800, window.screen.availHeight - 80)
  const left = Math.max(0, (window.screen.availWidth - w) / 2)
  const top = Math.max(0, (window.screen.availHeight - h) / 2)
  const win = window.open(mapsSearch(q), 'jm_real_map', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
  if (win) { win.opener = null; win.focus() } else window.open(mapsSearch(q), '_blank', 'noopener')
}
const mapsEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed&hl=ko`

const CSS = `
.jm-real{border:none;padding:0;border-radius:18px;background:#fbf6ea;color:#3a2a20;width:min(760px,calc(100vw - 32px));max-height:calc(100dvh - 32px);box-shadow:0 20px 60px #0006;font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;overflow:hidden}
.jm-real::backdrop{background:#1d1a2a99}
.jm-real .body{overflow:auto;max-height:calc(100dvh - 32px)}
.jm-real figure{margin:0;position:relative;background:#2b2320}
.jm-real figure img{display:block;width:100%;max-height:min(340px,42dvh);object-fit:cover}
.jm-real figure .nophoto{height:160px;display:grid;place-items:center;color:#d9c9b0;font-size:13px}
.jm-real figcaption{position:absolute;right:8px;bottom:6px;font-size:10.5px;color:#fff;background:#0008;padding:2px 7px;border-radius:6px}
.jm-real figcaption a{color:#fff}
.jm-real .x{position:absolute;top:10px;right:10px;border:none;background:#fbf6eae6;border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer;color:#3a2a20}
.jm-real .main{padding:16px 22px 20px}
.jm-real .scene{font-size:12px;color:#a0522d;font-weight:700}
.jm-real h2{margin:2px 0 0;font-size:22px}
.jm-real .ja{font-size:13px;color:#7a6250;margin-top:2px}
.jm-real .badge{display:inline-block;margin-left:6px;font-size:11px;padding:2px 8px;border-radius:999px;vertical-align:middle;font-weight:700}
.jm-real .badge.official{background:#e3f1e3;color:#2f6b34}
.jm-real .badge.fan{background:#fbe7d3;color:#9a4d16}
.jm-real p.desc{font-size:14px;line-height:1.65;margin:12px 0}
.jm-real dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px;margin:0}
.jm-real dt{color:#8a7260;font-weight:700;white-space:nowrap}
.jm-real dd{margin:0}
.jm-real .addr{border:none;background:none;padding:0;color:#1e5a8a;text-decoration:underline;cursor:pointer;font:inherit;text-align:left}
.jm-real .map{margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid #d9c9b0;height:min(300px,36dvh)}
.jm-real .map iframe{border:0;width:100%;height:100%}
.jm-real .links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.jm-real .links a,.jm-real .links button{font-size:13px;text-decoration:none;border-radius:999px;padding:7px 14px;border:1px solid #bcd3e6;background:#f2f8fc;color:#1e5a8a;cursor:pointer;font-family:inherit}
.jm-real .links .primary{background:#1e5a8a;color:#fff;border-color:#1e5a8a}
.jm-real .note{font-size:12px;color:#8a7260;margin-top:12px;line-height:1.5}
`

function RealSpotDialog({ spotKey }) {
  const dialog = useRef(null)
  const [showMap, setShowMap] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const s = JM_REAL_SPOTS[spotKey]
  useEffect(() => {
    const node = dialog.current
    // 자료가 없는 키면 창을 그리지 않으므로 패널도 바로 닫음 (안 닫으면 이동 키가 잠긴 채로 남음)
    if (!node) { closeReal(); return undefined }
    node.showModal()
    node.querySelector('.x')?.focus() // 처음 포커스는 닫기 버튼 (링크에 있으면 키 입력으로 새 탭이 열릴 수 있음)
    return () => node.close()
  }, [])
  if (!s) return null
  const q = s.mapQuery ?? s.nameJa
  return (
    <dialog ref={dialog} className="jm-real ui-interactive" aria-labelledby="jm-real-title"
      onCancel={(e) => { e.preventDefault(); closeReal() }} onKeyDown={(e) => e.stopPropagation()}>
      <style>{CSS}</style>
      <div className="body">
        <figure>
          {s.photo && !photoFailed ? <img src={s.photo.src} alt={`${s.nameKo} 사진`} loading="lazy" onError={() => setPhotoFailed(true)} /> : <div className="nophoto">{s.photo ? '사진을 불러오지 못했어요' : '자유 이용 사진이 없어 사진은 비워 뒀어요'}</div>}
          {s.photo && !photoFailed && (
            <figcaption>
              사진: <a href={s.photo.page} target="_blank" rel="noopener noreferrer">{s.photo.author}</a> · {s.photo.license} (위키미디어 공용)
            </figcaption>
          )}
          <button type="button" className="x" aria-label="닫기" onClick={closeReal}>×</button>
        </figure>
        <div className="main">
          <div className="scene">{s.scene}</div>
          <h2 id="jm-real-title">
            {s.nameKo}
            <span className={`badge ${s.relation === '공식' ? 'official' : 'fan'}`}>{s.relation === '공식' ? '공식 모델' : '팬들이 꼽는 성지'}</span>
          </h2>
          <div className="ja">{s.nameJa}</div>
          <p className="desc">{s.description}</p>
          <dl>
            <dt>주소</dt>
            <dd>
              <button type="button" className="addr" onClick={() => setShowMap((v) => !v)} title="눌러서 지도 보기">{s.addressJa}</button>
              {s.addressKo && <div style={{ color: '#7a6250', fontSize: 12 }}>{s.addressKo}</div>}
            </dd>
            {s.access && (<><dt>가는 법</dt><dd>{s.access}</dd></>)}
            {s.visit && (<><dt>관람</dt><dd>{s.visit}</dd></>)}
          </dl>
          {showMap && (
            <div className="map"><iframe title={`${s.nameKo} 지도`} src={mapsEmbed(q)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
          )}
          <div className="links">
            <button type="button" className="primary" onClick={() => setShowMap((v) => !v)}>{showMap ? '지도 접기' : '🗺 지도 보기'}</button>
            <button type="button" onClick={() => openMapWindow(q)}>새 창으로 지도 열기 ↗</button>
            {s.officialUrl && <a href={s.officialUrl} target="_blank" rel="noopener noreferrer">공식 사이트 ↗</a>}
          </div>
          <div className="note">
            {s.note && <>{s.note}<br /></>}
            영화 속 장면과 똑같은 장소가 아니라 분위기를 참고한 곳일 수 있어요. 출처: {s.sources.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#1e5a8a', marginRight: 6 }}>[{i + 1}]</a>)}
          </div>
        </div>
      </div>
    </dialog>
  )
}

// 가까이 왔을 때 화면 아래 버튼 (스탬프 원 안이면 E는 스탬프가 쓰므로 버튼만)
function NearHud({ signId, spot }) {
  const near = useNearSign((s) => s.near === signId)
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const size = useThree((s) => s.size)
  if (!near || panelOpen) return null
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 118, boxSizing: 'border-box' }}>
        <button type="button" className="ui-interactive" onClick={() => openReal(signId, spot)}
          style={{ pointerEvents: 'auto', padding: '8px 16px', borderRadius: 999, border: '2px solid #ffd77a', background: 'rgba(43,29,20,0.88)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          📍 실제 성지 보기 <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 12 }}>(팻말을 눌러도 돼요)</span>
        </button>
      </div>
    </Html>
  )
}

// 팻말 (기둥 + 판 + 제목 두 줄 + 「누르면 실제 성지 정보」) — 앞면 +z
export function RealSpotSign({ signId, spot, title, sub }) {
  const group = useRef()
  const scene = useThree((s) => s.scene)
  const chk = useRef({ next: 0, player: null })
  const me = useMemo(() => new THREE.Vector3(), [])
  const at = useMemo(() => new THREE.Vector3(), [])
  const mine = useGameStore((s) => s.openPanel?.type === JM_REAL_PANEL && s.openPanel?.placeId === signId)

  useFrame(({ clock }) => {
    const c = chk.current
    if (clock.elapsedTime < c.next || !group.current) return
    c.next = clock.elapsedTime + 0.25
    if (!c.player?.parent) c.player = findPlayer(scene)
    if (!c.player) return
    c.player.getWorldPosition(me)
    group.current.getWorldPosition(at)
    const isNear = Math.hypot(me.x - at.x, me.z - at.z) < NEAR && Math.abs(me.y - at.y) < 3
    const st = useNearSign.getState()
    if (isNear && st.near !== signId) st.set(signId)
    else if (!isNear && st.near === signId) st.set(null)
  })

  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'KeyE' || e.repeat || useNearSign.getState().near !== signId) return
      const game = useGameStore.getState()
      if (!game.openPanel && !game.nearbyPlaceId) openReal(signId, spot)
    }
    window.addEventListener('keydown', down)
    return () => {
      window.removeEventListener('keydown', down)
      if (useNearSign.getState().near === signId) useNearSign.getState().set(null)
    }
  }, [signId, spot])

  const click = {
    onClick: (e) => { e.stopPropagation(); openReal(signId, spot) },
    onPointerOver: (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { document.body.style.cursor = '' },
  }
  return (
    <group ref={group}>
      <group {...click}>
        <Box p={[0, 0.9, 0]} s={[0.12, 1.8, 0.12]} c="#3a281c" />
        <Box p={[0, 1.65, 0.02]} s={[2.4, 1.2, 0.08]} c="#2b1d14" />
        <mesh position={[0, 1.95, 0.07]}>
          <planeGeometry args={[2.2, 0.42]} />
          <GlowMaterial glow={0.6} map={getJpSignTexture(title ?? '명장면', '#f3e6c8', '#5b1a12', 2.2 / 0.42)} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.5, 0.07]}>
          <planeGeometry args={[2.2, 0.32]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(sub ?? '', '#3d2a1e', '#f3e6c8', 2.2 / 0.32)} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.18, 0.07]}>
          <planeGeometry args={[1.8, 0.17]} />
          <GlowMaterial glow={0.6} map={getJpSignTexture('누르면 실제 성지 정보', '#ffd77a', '#2b1d14', 1.8 / 0.17)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <NearHud signId={signId} spot={spot} />
      {mine && (
        <Html calculatePosition={() => [0, 0]} zIndexRange={[30, 0]}>
          <RealSpotDialog spotKey={spot} />
        </Html>
      )}
    </group>
  )
}

// 명장면 공간 종류 → 실제 성지 자료 키
export const SPOT_OF_ROOM = { totoro: 'crossing', shintai: 'stairs', wisteria: 'shrine', forest: 'sakura_river', natsume: 'hill', onsen: 'onsen' }

// 따로 세우는 팻말 (⑤처럼 명장면 공간이 없는 곳): item.spot = 자료 키
export function JmRealSpotSign({ item }) {
  const s = JM_REAL_SPOTS[item.spot]
  return <RealSpotSign signId={item.id} spot={item.spot} title={s?.scene ?? '명장면'} sub={s?.sceneSub ?? ''} />
}

export const JM_REALSPOT_STYLES = { jmRealSpotSign: JmRealSpotSign }
