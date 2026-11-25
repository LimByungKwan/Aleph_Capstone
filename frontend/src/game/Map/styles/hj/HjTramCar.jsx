import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { SeatedPerson } from './HjPeople.jsx'
import { Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'

// [3. 개발 > 프론트엔드] 1930년대 경성 전차 차체 + 실내 (혜진 영화·드라마 구역)
// 참고한 실내: 나무 벽과 창틀, 위가 둥근 창, 양옆 긴 초록 의자, 천장 놋쇠 봉에 매달린 세모 손잡이,
//            흰 둥근 천장과 동그란 천장등, 나무 바닥, 창 위 광고판, 앞쪽 운전대와 행선판, 금연 표시
// 광고 문구는 모두 가상이에요. 앞 = +z, 바닥 높이 = floorY.
// TramCar는 달리는 전차(HjTram)와 들어가 볼 수 있는 전시 전차(HjTramExhibit)가 같이 써요.

import { TRAM_EXHIBIT } from './tramLayout.js'

export { TRAM_EXHIBIT }

const GREEN = '#2f5d4a'
const CREAM = '#efe4c8'
const WOOD = '#7a4a2a'
const WOOD_DARK = '#5a351d'
const SEAT = '#2f8a6f'
const BRASS = mat('#b8913f', { metalness: 0.7, roughness: 0.35 })
const GLASS = mat('#cfe3ea', { transparent: true, opacity: 0.22, roughness: 0.05 })
const LAMP = mat('#fff6e0', { emissive: '#ffe2b0', emissiveIntensity: 1.0 })
const PARTS = mat('#ffffff', { roughness: 0.8 })
const IRON = '#2d2b29'
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })
const ADS = [
  ['모던 비누', '#f3ece0', '#8f2a22'],
  ['경성 약방 감기약', '#2f4a6b', '#f3ece0'],
  ['축음기 대매출', '#f3e6c4', '#2d3b35'],
  ['활동사진 상영 중', '#7a1f1f', '#ffe9a8'],
  ['금강 제과 캐러멜', '#f6efdc', '#7a2e2e'],
  ['손잡이를 꼭 잡으세요', '#efe8da', '#3b2a20'],
]

// 전차 의자 자리 (차량 기준). 양옆 긴 의자에 0.7m 간격, 안쪽을 보고 앉아요. taken = 처음부터 앉아 있는 승객
export function tramSeatSlots(w, l, floorY, seed = 0) {
  const seatLen = l - 0.2 - 2.6
  const list = []
  const n = Math.max(2, Math.floor(seatLen / 0.7))
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i += 1) {
      const z = -seatLen / 2 + (seatLen / n) * (i + 0.5)
      list.push({ id: `${side > 0 ? 'r' : 'l'}${i}`, x: side * ((w - 0.24) / 2 - 0.3), y: floorY + 0.52, z, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2, taken: false })
    }
  }
  return list
}

export function TramCar({ w, h, l, floorY = 0.45, sign = '종로 ↔ 총독부 앞', door = false, seats = [] }) {
  const inW = w - 0.24 // 안쪽 폭
  const winY0 = floorY + 0.95 // 창 아래
  const winY1 = floorY + 2.0 // 창 위
  const roofY = floorY + 2.3 // 지붕 시작
  const bodyL = l - 0.2
  const posts = useMemo(() => {
    const list = []
    const n = Math.max(4, Math.round(bodyL / 0.9))
    for (const s of [-1, 1]) {
      for (let i = 0; i <= n; i += 1) {
        const z = -bodyL / 2 + (bodyL / n) * i
        list.push({ p: [s * (w / 2 - 0.08), (winY0 + winY1) / 2, z], s: [0.12, winY1 - winY0, 0.12], c: WOOD })
      }
    }
    return list
  }, [w, bodyL, winY0, winY1])
  const straps = useMemo(() => {
    const stalks = []
    const rings = []
    for (const s of [-1, 1]) {
      for (let z = -bodyL / 2 + 1.0; z <= bodyL / 2 - 1.0; z += 0.62) {
        stalks.push({ p: [s * 0.56, roofY - 0.03, z], s: [0.02, 0.3, 0.02], r: [0, 0, s * 0.25] })
        rings.push({ p: [s * 0.5, roofY - 0.2, z], s: [1, 1, 1] })
      }
    }
    return { stalks, rings }
  }, [bodyL, roofY])
  const planks = useMemo(() => {
    const list = []
    for (let x = -inW / 2 + 0.09; x < inW / 2; x += 0.18) list.push({ p: [x, floorY + 0.001, 0], s: [0.012, 0.004, bodyL - 0.3], c: '#3e2616' })
    return list
  }, [inW, floorY, bodyL])
  const seatLen = bodyL - 2.6
  const winCount = Math.max(4, Math.round(bodyL / 0.9)) // 옆 창 수
  const adCount = Math.max(2, Math.floor(seatLen / 1.6))
  const ringGeo = useMemo(() => {
    // 세모 손잡이 (반지름 0.09, 3각)
    return { args: [0.09, 0.012, 4, 3] }
  }, [])
  return (
    <group>
      {/* 3인칭 카메라가 벽·지붕을 뚫지 않게 (안에 앉으면 카메라가 안쪽으로 당겨져요) */}
      {[-1, 1].map((s) => (
        <mesh key={`cb${s}`} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[s * (w / 2 - 0.02), floorY + 1.4, 0]} scale={[0.06, 3, l]} />
      ))}
      <mesh name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[0, roofY + 0.4, 0]} scale={[w, 0.06, l]} />
      {/* 아래 틀 + 바퀴 */}
      <Box p={[0, floorY / 2 + 0.05, 0]} s={[w - 0.3, floorY - 0.1, l - 0.6]} c="#2a2826" />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[sx * 0.72, 0.3, sz * (l / 2 - 1.3)]} rad={0.3} h={0.12} c={IRON} r={[0, 0, Math.PI / 2]} />),
      )}
      {/* 바닥 (나무 판) */}
      <Box p={[0, floorY - 0.03, 0]} s={[w - 0.1, 0.06, l - 0.1]} c="#6b4426" />
      <Instances geometry={GEO.box} material={PARTS} items={planks} />
      {/* 옆 벽: 겉 초록 / 안 나무 판 + 창 + 위 크림 띠 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 - 0.04), (floorY + winY0) / 2 - 0.05, 0]} s={[0.08, winY0 - floorY + 0.5, bodyL]} c={GREEN} />
          <Box p={[s * (w / 2 - 0.1), (floorY + winY0) / 2, 0]} s={[0.04, winY0 - floorY, bodyL - 0.1]} c={WOOD} />
          <Box p={[s * (w / 2 - 0.12), winY0, 0]} s={[0.12, 0.06, bodyL - 0.1]} c={WOOD_DARK} />
          <Box p={[s * (w / 2 - 0.08), (winY0 + winY1) / 2, 0]} s={[0.03, winY1 - winY0, bodyL - 0.1]} m={GLASS} />
          <Box p={[s * (w / 2 - 0.04), (winY1 + roofY) / 2, 0]} s={[0.08, roofY - winY1, bodyL]} c={CREAM} />
          <Box p={[s * (w / 2 - 0.1), (winY1 + roofY) / 2, 0]} s={[0.04, roofY - winY1, bodyL - 0.1]} c={WOOD} />
          {/* 창 위 둥근 모서리 느낌 (나무 반달 장식) */}
          {Array.from({ length: winCount }, (_, i) => (
            <mesh key={i} position={[s * (w / 2 - 0.11), winY1 - 0.02, -bodyL / 2 + (bodyL / winCount) * (i + 0.5)]} rotation={[0, (s * Math.PI) / 2, Math.PI]}>
              <ringGeometry args={[0.3, 0.38, 12, 1, 0, Math.PI]} />
              <meshStandardMaterial color={WOOD} side={2} />
            </mesh>
          ))}
          {/* 창 위 광고판 (안쪽) */}
          {Array.from({ length: adCount }, (_, i) => {
            const [text, bg, fg] = ADS[(i + (s > 0 ? 2 : 0)) % ADS.length]
            return (
              <mesh key={`ad${i}`} position={[s * (w / 2 - 0.13), (winY1 + roofY) / 2, -seatLen / 2 + (seatLen / adCount) * (i + 0.5)]} rotation-y={(-s * Math.PI) / 2}>
                <planeGeometry args={[1.3, 0.24]} />
                <meshStandardMaterial map={getSignTexture(text, bg, fg)} />
              </mesh>
            )
          })}
        </group>
      ))}
      <Instances geometry={GEO.box} material={PARTS} items={posts} />
      {/* 둥근 천장: 안 흰색 + 겉 회색, 천장등 */}
      <mesh position={[0, roofY - w * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#f6f2ea', { double: true })}>
        <cylinderGeometry args={[w * 0.8, w * 0.8, bodyL, 20, 1, true, Math.PI - 0.9, 1.8]} />
      </mesh>
      <mesh position={[0, roofY - w * 0.55 + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#6b6f70')}>
        <cylinderGeometry args={[w * 0.8, w * 0.8, l, 20, 1, true, Math.PI - 0.9, 1.8]} />
      </mesh>
      <Box p={[0, roofY + w * 0.25 + 0.12, 0]} s={[0.9, 0.22, l * 0.7]} c="#55595b" />
      {/* 밝은 천장 판 (둥근 지붕 바로 아래) */}
      <Box p={[0, roofY + 0.25, 0]} s={[inW, 0.03, bodyL - 0.1]} m={mat('#f6f2ea', { emissive: '#fff8ea', emissiveIntensity: 0.35 })} />
      {[-bodyL / 3, 0, bodyL / 3].map((z) => (
        <group key={z} position={[0, roofY + 0.24, z]}>
          <Cyl p={[0, -0.02, 0]} rad={0.2} h={0.06} c="#e9e4da" />
          <Cyl p={[0, -0.07, 0]} rad={0.14} h={0.06} m={LAMP} />
        </group>
      ))}
      {/* 놋쇠 손잡이 봉 + 세모 손잡이 */}
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[s * 0.6, roofY + 0.12, 0]} rad={0.022} h={bodyL - 1.6} m={BRASS} r={[Math.PI / 2, 0, 0]} />
      ))}
      <Instances geometry={GEO.box} material={BRASS} items={straps.stalks} />
      {straps.rings.map((r, i) => (
        <mesh key={i} position={r.p} rotation={[0, Math.PI / 2, Math.PI / 2]} material={mat('#f1ede4')}>
          <torusGeometry args={ringGeo.args} />
        </mesh>
      ))}
      {/* 양옆 긴 초록 의자 */}
      {[-1, 1].map((s) => (
        <group key={`seat${s}`} position={[s * (inW / 2 - 0.25), floorY, 0]}>
          <Box p={[0, 0.2, 0]} s={[0.45, 0.4, seatLen]} c={WOOD_DARK} />
          <Box p={[0, 0.46, 0]} s={[0.48, 0.12, seatLen]} c={SEAT} />
          <Box p={[s * 0.2, 0.78, 0]} s={[0.08, 0.5, seatLen]} c={SEAT} />
          {[-1, 1].map((k) => (
            <Box key={k} p={[0, 0.55, k * (seatLen / 2 + 0.03)]} s={[0.5, 0.5, 0.06]} c={WOOD} />
          ))}
        </group>
      ))}
      {/* 앞·뒤 끝: 나무 벽 + 창 3개 + 행선판 (뒤는 door면 가운데 문) */}
      {[1, -1].map((face) => {
        const open = door && face < 0 // 뒤 끝 가운데 출입문
        const dw = TRAM_EXHIBIT.door
        return (
        <group key={`end${face}`} position={[0, 0, face * (l / 2 - 0.06)]}>
          {open
            ? [-1, 1].map((k) => (
                <Box key={k} p={[k * (dw / 2 + (w - dw) / 4), (floorY + winY0) / 2 - 0.05, 0]} s={[(w - dw) / 2, winY0 - floorY + 0.5, 0.1]} c={GREEN} />
              ))
            : <Box p={[0, (floorY + winY0) / 2 - 0.05, 0]} s={[w, winY0 - floorY + 0.5, 0.1]} c={GREEN} />}
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * (w / 2 - 0.2), (winY0 + roofY) / 2, 0]} s={[0.4, roofY - winY0, 0.1]} c={CREAM} />
          ))}
          {open
            ? [-1, 1].map((k) => (
                <Box key={`g${k}`} p={[k * (dw / 2 + (w - 0.5 - dw) / 4), (winY0 + winY1) / 2, 0]} s={[(w - 0.5 - dw) / 2, winY1 - winY0, 0.03]} m={GLASS} />
              ))
            : <Box p={[0, (winY0 + winY1) / 2, 0]} s={[w - 0.5, winY1 - winY0, 0.03]} m={GLASS} />}
          {(open ? [-dw / 2, dw / 2] : [-0.4, 0.4]).map((x) => (
            <Box key={x} p={[x, (winY0 + winY1) / 2, 0]} s={[0.08, winY1 - winY0, 0.08]} c={WOOD} />
          ))}
          <Box p={[0, (winY1 + roofY) / 2, 0]} s={[w, roofY - winY1, 0.1]} c={CREAM} />
          <mesh position={[0, (winY1 + roofY) / 2, face * 0.06]} rotation-y={face > 0 ? 0 : Math.PI}>
            <planeGeometry args={[1.4, 0.22]} />
            <meshStandardMaterial map={getSignTexture(sign, '#f6efdc', '#2f5d4a')} />
          </mesh>
          <mesh position={[0, (winY1 + roofY) / 2, -face * 0.06]} rotation-y={face > 0 ? Math.PI : 0}>
            <planeGeometry args={[1.2, 0.2]} />
            <meshStandardMaterial map={getSignTexture(sign, '#2a2826', '#ffe9a8')} />
          </mesh>
        </group>
        )
      })}
      {/* 뒤쪽 출입문 (door) — 열린 문 자리 표시 + 발판 2단 */}
      {door && (
        <group position={[0, 0, -l / 2]}>
          <Box p={[0, 0.34 / 2, -0.22]} s={[TRAM_EXHIBIT.door + 0.2, 0.34, 0.3]} c="#3a3836" />
          <Box p={[0, 0.17 / 2, -0.52]} s={[TRAM_EXHIBIT.door + 0.2, 0.17, 0.3]} c="#3a3836" />
          {[-1, 1].map((k) => (
            <Cyl key={k} p={[k * (TRAM_EXHIBIT.door / 2 + 0.05), floorY + 1.0, -0.12]} rad={0.025} h={1.2} m={BRASS} />
          ))}
        </group>
      )}
      {/* 앉아 있는 승객 */}
      {seats.filter((st) => st.taken).map((st, i) => (
        <SeatedPerson key={st.id} look={i * 5 + st.id.length} position={[st.x, st.y, st.z]} yaw={st.yaw} />
      ))}
      {/* 운전대 (앞) + 요금함 */}
      <group position={[0.55, floorY, l / 2 - 0.5]}>
        <Box p={[0, 0.5, 0]} s={[0.45, 1.0, 0.35]} c="#9aa0a3" />
        <Cyl p={[0, 1.05, 0]} rad={0.13} h={0.08} m={BRASS} />
        <Box p={[0.08, 1.12, 0]} s={[0.2, 0.04, 0.04]} m={BRASS} />
      </group>
      <group position={[-0.6, floorY, l / 2 - 0.55]}>
        <Cyl p={[0, 0.45, 0]} rad={0.03} h={0.9} c={IRON} />
        <Box p={[0, 1.0, 0]} s={[0.3, 0.22, 0.25]} c="#1f1d1b" />
      </group>
      {/* 금연 표시 */}
      {[-1, 1].map((s) => (
        <group key={`ns${s}`} position={[s * (w / 2 - 0.14), winY1 - 0.25, l / 2 - 1.2]} rotation-y={(-s * Math.PI) / 2}>
          <mesh>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial color="#f6f2ea" />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <ringGeometry args={[0.09, 0.12, 16]} />
            <meshStandardMaterial color="#c0322a" />
          </mesh>
          <Box p={[0, 0, 0.004]} s={[0.2, 0.025, 0.002]} r={[0, 0, Math.PI / 4]} c="#c0322a" />
        </group>
      ))}
      {/* 겉: 아래·위 띠 + 집전봉 + 앞 등 */}
      {/* 겉 아래·위 띠 (옆면 테두리만) */}
      {[-1, 1].map((s) => (
        <group key={`trim${s}`}>
          <Box p={[s * (w / 2 + 0.01), floorY + 0.05, 0]} s={[0.06, 0.1, l + 0.06]} c="#1f3d31" />
          <Box p={[s * (w / 2 + 0.01), roofY, 0]} s={[0.06, 0.08, l + 0.06]} c={GREEN} />
          <Box p={[0, roofY, s * (l / 2 + 0.01)]} s={[w + 0.06, 0.08, 0.06]} c={GREEN} />
        </group>
      ))}
      <mesh position={[0, roofY + 1.5, -l * 0.15]} rotation={[0.55, 0, 0]} material={mat(IRON)}>
        <cylinderGeometry args={[0.03, 0.03, 3.2, 6]} />
      </mesh>
      <Cyl p={[0, floorY + 0.5, l / 2 + 0.02]} rad={0.13} h={0.05} m={LAMP} r={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

// ── 들어가 볼 수 있는 전시 전차 (style: "hjTramExhibit") — 멈춰 선 전차, 뒤쪽 문으로 타요.
//    충돌 박스는 hj_drama.json의 gs_tx_* (scripts/hj-tram-colliders.mjs) ──
export function HjTramExhibit({ item }) {
  const { w, h, l, floorY } = TRAM_EXHIBIT
  const [sw, sh, sl] = item.size ?? [w, h, l]
  const ref = useRef(null)
  const seats = useMemo(() => tramSeatSlots(w, l, floorY, 1), [w, l, floorY])
  // 멈춰 선 전시 전차도 E로 빈자리에 앉을 수 있어요 (내리면 뒤쪽 문 앞)
  const vehicle = useMemo(() => ({ id: item.id, label: '전차', stopped: true, w, l, seats: [] }), [item.id, w, l])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  useFrame(() => updateVehicleWorld(vehicle, ref.current, seats, [0, 0.1, -l / 2 - 1.2]))
  return (
    <group ref={ref} scale={[sw / w, sh / h, sl / l]}>
      {/* 짧은 선로 */}
      {/* 광장 바닥(0.12)보다 확실히 위에 (겹쳐서 지직거리지 않게) */}
      <Box p={[0, 0.15, 0]} s={[2.2, 0.06, l + 2]} c="#8d8478" />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} p={[x, 0.22, 0]} s={[0.1, 0.08, l + 2]} c="#9a958c" />
      ))}
      <TramCar w={w} h={h} l={l} floorY={floorY} sign={item.sign ?? '종로 ↔ 경성역'} door seats={seats} />
      <pointLight position={[0, floorY + 2.0, 0]} color="#ffe2b0" intensity={3} distance={6} decay={2} />
    </group>
  )
}
