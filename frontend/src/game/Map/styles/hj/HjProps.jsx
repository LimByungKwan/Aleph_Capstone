import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getAFrameTexture, getStripeTexture } from './hjTextures.js'
import { useSeason } from '../../../seasons.js'
import SeasonalTree from '../SeasonalTree.jsx'

// [3. 개발 > 기초개발/서비스] 혜진 구역 소품 (벚나무 · 전구줄 · 입간판 · 등롱 · 과일 수레 · 카페 테이블 ·
// 우체통 · 자전거 · 자동차 · 흩날리는 꽃잎). 모두 size [w, h, d] 기준, 앞면 +z.

const BLOSSOM = ['#f9c8d7', '#f4b0c6', '#fbd9e4', '#f0a3bc']
function rng(seed) {
  let s = seed % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}
const seedOf = (item) => [...(item.id ?? 'x')].reduce((a, c) => a + c.charCodeAt(0), 7)

// ── 벚나무 (style: "hjCherryTree") — size [수관 지름, 높이, -] ──
export function HjCherryTree({ item }) {
  return <SeasonalTree item={item} kind="sakura" />
}

// ── 전구줄 (style: "hjStringLights") — item.points [[x, y, z], ...] 사이를 처진 줄로 잇고 전구를 달아요 ──
export function HjStringLights({ item }) {
  const bulbMesh = useRef(null)
  const { tube, bulbs } = useMemo(() => {
    const pts = item.points ?? []
    const all = []
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ax, ay, az] = pts[i]
      const [bx, by, bz] = pts[i + 1]
      for (let s = 0; s <= 12; s += 1) {
        const t = s / 12
        all.push(new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.35, az + (bz - az) * t))
      }
    }
    const curve = new THREE.CatmullRomCurve3(all.length > 1 ? all : [new THREE.Vector3(), new THREE.Vector3(0, 0, 1)])
    const length = curve.getLength()
    const count = Math.max(2, Math.round(length / 0.6))
    return {
      tube: new THREE.TubeGeometry(curve, count * 2, 0.012, 4),
      bulbs: Array.from({ length: count }, (_, i) => curve.getPointAt((i + 0.5) / count)),
    }
  }, [item.points])

  useLayoutEffect(() => {
    const mesh = bulbMesh.current
    const matrix = new THREE.Matrix4()
    bulbs.forEach(({ x, y, z }, index) => {
      mesh.setMatrixAt(index, matrix.makeTranslation(x, y - 0.07, z))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [bulbs])

  useFrame(({ clock }) => {
    const mesh = bulbMesh.current
    if (mesh) mesh.material.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.25
  })

  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
      <instancedMesh ref={bulbMesh} args={[null, null, bulbs.length]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#fff1c9" emissive="#ffc46b" emissiveIntensity={1.5} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

// ── A형 입간판 (style: "hjAFrameSign") — size [폭, 높이, -], item.text (줄바꿈 \n) ──
export function HjAFrameSign({ item }) {
  const [w, h] = item.size
  const texture = getAFrameTexture(item.text ?? '촬영지')
  const lean = 0.2
  return (
    <group>
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, side * Math.sin(lean) * h * 0.5]} rotation={[side * -lean, side > 0 ? 0 : Math.PI, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, 0.05]} />
            <meshStandardMaterial color="#5a3d2b" />
          </mesh>
          <mesh position={[0, h / 2, 0.03]}>
            <planeGeometry args={[w * 0.9, h * 0.92]} />
            <meshStandardMaterial map={texture} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── 바닥 등롱 (style: "hjLantern") — size [폭, 높이, -] ──
export function HjLantern({ item }) {
  const [w, h] = item.size
  return (
    <group>
      <mesh position={[0, h * 0.15, 0]}>
        <boxGeometry args={[w * 0.8, h * 0.3, w * 0.8]} />
        <meshStandardMaterial color="#3b3029" />
      </mesh>
      <mesh position={[0, h * 0.55, 0]}>
        <boxGeometry args={[w * 0.7, h * 0.5, w * 0.7]} />
        <meshStandardMaterial color="#fff1c9" emissive="#ffbf6b" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, h * 0.86, 0]}>
        <coneGeometry args={[w * 0.62, h * 0.18, 4]} />
        <meshStandardMaterial color="#3b3029" />
      </mesh>
      {item.light !== false && (
        <pointLight position={[0, item.sunsetLight ? h + 0.8 : h * 0.6, 0]}
          color={item.sunsetLight ? '#ffab58' : '#ffc27a'}
          intensity={item.sunsetLight ? 19 : 2.2} distance={item.sunsetLight ? 8 : 4} decay={2} />
      )}
    </group>
  )
}

// ── 과일 수레 (style: "hjFruitCart") — size [w, h, d], item.awning [색1, 색2] ──
export function HjFruitCart({ item }) {
  const [w, h, d] = item.size
  const stripe = getStripeTexture(...(item.awning ?? ['#2f7d5b', '#f4f1ea']))
  const fruits = useMemo(() => {
    const rand = rng(seedOf(item))
    const colors = ['#e2483a', '#f2a33a', '#f6d04d', '#7fb24a']
    return Array.from({ length: 18 }, (_, i) => ({
      x: (rand() - 0.5) * (w - 0.3),
      z: (rand() - 0.5) * (d - 0.3),
      c: colors[i % colors.length],
    }))
  }, [item, w, d])
  return (
    <group>
      <mesh position={[0, h * 0.4, 0]}>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial color="#8b5e3c" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.15), 0.25, d / 2 + 0.05]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.25, 0.05, 6, 14]} />
          <meshStandardMaterial color="#3b3029" />
        </mesh>
      ))}
      {fruits.map((f, i) => (
        <mesh key={i} position={[f.x, h * 0.4 + 0.3, f.z]}>
          <sphereGeometry args={[0.11, 8, 6]} />
          <meshStandardMaterial color={f.c} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[s * (w / 2 - 0.05), h * 0.7, 0]}>
          <boxGeometry args={[0.06, h * 0.7, 0.06]} />
          <meshStandardMaterial color="#5a3d2b" />
        </mesh>
      ))}
      <mesh position={[0, h, 0.1]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[w + 0.3, 0.05, d + 0.4]} />
        <meshStandardMaterial map={stripe} />
      </mesh>
    </group>
  )
}

// ── 카페 테이블 세트 (style: "hjCafeSet") — 둥근 테이블 + 의자 2개 (+ item.umbrella 색이면 파라솔) ──
export function HjCafeSet({ item }) {
  const metal = '#3d2f2a'
  return (
    <group>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.04, 18]} />
        <meshStandardMaterial color="#f4ece0" />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.72, 8]} />
        <meshStandardMaterial color={metal} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.62, 0, 0]} rotation={[0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 14]} />
            <meshStandardMaterial color="#a8473a" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 0.45, 6]} />
            <meshStandardMaterial color={metal} />
          </mesh>
          <mesh position={[0, 0.72, -0.18]}>
            <torusGeometry args={[0.18, 0.02, 6, 16, Math.PI]} />
            <meshStandardMaterial color={metal} />
          </mesh>
        </group>
      ))}
      {item.umbrella && (
        <group>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
            <meshStandardMaterial color="#d9d2c5" />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[1.1, 0.45, 12, 1, true]} />
            <meshStandardMaterial color={item.umbrella} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// ── 빨간 우체통 (style: "hjMailbox") ──
export function HjMailbox() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.3, 0.5, 0.3]} />
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.42]} />
        <meshStandardMaterial color="#c8352b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.21, 0.21, 0.5, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#c8352b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.98, 0.215]}>
        <boxGeometry args={[0.3, 0.04, 0.02]} />
        <meshStandardMaterial color="#2c2a29" />
      </mesh>
    </group>
  )
}

// ── 자전거 (style: "hjBicycle") — x축 방향으로 놓임 ──
export function HjBicycle({ item }) {
  const r = 0.32
  const color = item.color ?? '#3f6f8f'
  const bars = [
    [[-0.5, r], [-0.2, 0.92]],
    [[-0.2, 0.92], [-0.05, r]],
    [[-0.05, r], [-0.5, r]],
    [[-0.2, 0.92], [0.38, 0.98]],
    [[-0.05, r], [0.38, 0.98]],
    [[0.38, 0.98], [0.5, r]],
  ]
  return (
    <group rotation={[0.1, 0, 0]}>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, r, 0]}>
          <torusGeometry args={[r, 0.025, 6, 20]} />
          <meshStandardMaterial color="#2c2a29" />
        </mesh>
      ))}
      {bars.map(([[x1, y1], [x2, y2]], i) => {
        const len = Math.hypot(x2 - x1, y2 - y1)
        return (
          <mesh key={i} position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]} rotation={[0, 0, Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, len, 5]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
      <mesh position={[-0.2, 0.97, 0]}>
        <boxGeometry args={[0.22, 0.05, 0.1]} />
        <meshStandardMaterial color="#3b3029" />
      </mesh>
      <mesh position={[0.52, 0.85, 0]}>
        <boxGeometry args={[0.28, 0.2, 0.3]} />
        <meshStandardMaterial color="#a8774f" />
      </mesh>
    </group>
  )
}

// ── 자동차 (style: "hjCar") — size [길이, 높이, 폭], x축 방향 ──
export function HjCar({ item }) {
  const [l, h, w] = item.size
  const color = item.color ?? '#4a4d57'
  return (
    <group>
      <mesh position={[0, h * 0.35, 0]}>
        <boxGeometry args={[l, h * 0.45, w]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-l * 0.05, h * 0.75, 0]}>
        <boxGeometry args={[l * 0.55, h * 0.4, w * 0.9]} />
        <meshStandardMaterial color="#2a3340" roughness={0.2} metalness={0.4} />
      </mesh>
      {item.taxi && (
        <>
          <mesh position={[-l * 0.05, h * 0.97, 0]}>
            <boxGeometry args={[l * 0.59, h * 0.09, w * 0.9]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[-l * 0.02, h * 1.08, 0]}>
            <boxGeometry args={[0.38, 0.17, 0.48]} />
            <meshStandardMaterial color="#fff0ce" emissive="#ffc572" emissiveIntensity={0.7} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * l / 2, h * 0.24, 0]}>
              <boxGeometry args={[0.09, 0.12, w * 1.01]} />
              <meshStandardMaterial color="#b9b5a6" metalness={0.7} roughness={0.37} />
            </mesh>
          ))}
        </>
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * l * 0.32, h * 0.18, sz * w * 0.48]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[h * 0.2, h * 0.2, 0.18, 14]} />
            <meshStandardMaterial color="#1c1c1e" />
          </mesh>
        )),
      )}
      {[-1, 1].map((sz) => (
        <mesh key={`l${sz}`} position={[l / 2 + 0.01, h * 0.4, sz * w * 0.32]}>
          <boxGeometry args={[0.02, 0.1, 0.2]} />
          <meshStandardMaterial color="#fff6d6" emissive="#fff1c2" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ── 흩날리는 벚꽃잎 (style: "hjPetals") — size [가로, 높이, 세로] 영역 안에서 떨어져요. 충돌 없음 ──
const PETAL_COUNT = 260
export function HjPetals({ item }) {
  return useSeason() === 'spring' ? <HjSpringPetals item={item} /> : null
}

function HjSpringPetals({ item }) {
  const [w, h, d] = item.size
  const ref = useRef(null)
  const geometry = useMemo(() => new THREE.CircleGeometry(0.06, 5), [])
  const petals = useMemo(() => {
    const rand = rng(seedOf(item))
    return Array.from({ length: PETAL_COUNT }, () => ({
      x: (rand() - 0.5) * w,
      y: rand() * h,
      z: (rand() - 0.5) * d,
      speed: 0.3 + rand() * 0.4,
      phase: rand() * Math.PI * 2,
    }))
  }, [item, w, h, d])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 0.7, 1) }), [])

  useLayoutEffect(() => {
    const color = new THREE.Color()
    petals.forEach((_, i) => ref.current?.setColorAt(i, color.set(BLOSSOM[i % BLOSSOM.length])))
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [petals])

  useFrame(({ clock }, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    petals.forEach((p, i) => {
      p.y -= p.speed * dt
      p.x += Math.sin(t * 0.7 + p.phase) * 0.3 * dt
      if (p.y < 0.05) p.y = h
      tmp.q.setFromEuler(tmp.e.set(t + p.phase, t * 0.6, p.phase))
      tmp.m.compose(tmp.p.set(p.x, p.y, p.z), tmp.q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, PETAL_COUNT]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} emissive="#f7c3d2" emissiveIntensity={0.2} />
    </instancedMesh>
  )
}
