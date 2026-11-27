import { create } from 'zustand'
import { useWallet } from '../../../components/movieZone/wallet.js'
import { currentUser, useUiStore } from '../../../components/movieZone/uiStore.js'

// 애니 구역(JM) 바다 전차 회수권 — 담당: 지민 (11/27)
// 湯灯역 승차권 발매기에서 코인으로 5회권을 사고, 바다 전차가 출발할 때마다 차장이 한 칸씩 구멍을 뚫음(검표)
// 5칸이 다 차면 더는 전차를 못 부름 → 경성역에 내리면 뒷면에 「5회 완주」 도장 → 발매기에서 새로 사야 함
// 이 브라우저에 저장 (localStorage) — 새로고침해도 남음. 코인은 혜진 님 지갑(wallet.js) 것을 씀
// 표 카드 화면은 DOM으로 직접 그림 (게임 화면 위, 누르면 앞·뒤 뒤집기, 잠시 뒤 저절로 닫힘)

export const RIDES = 5
export const PRICE = 5 // 코인 (기차표 1회 4코인 → 5회 묶음)
const KEY = 'jm.seaTicket.v1'

function load() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object') return { owned: !!v.owned, punches: Math.min(RIDES, v.punches | 0), serial: v.serial | 0, issuedAt: v.issuedAt ?? '', done: v.done | 0 }
  } catch {
    // 저장소를 못 쓰면 처음 값으로
  }
  return { owned: false, punches: 0, serial: 0, issuedAt: '', done: 0 }
}
function save(s) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ owned: s.owned, punches: s.punches, serial: s.serial, issuedAt: s.issuedAt, done: s.done }))
  } catch {
    // 저장 못 해도 이번 접속 동안은 그대로
  }
}
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const userName = () => {
  try {
    const u = currentUser(useUiStore.getState().userId)
    return u?.name ?? u?.nickname ?? ''
  } catch {
    return ''
  }
}

export const useSeaTicket = create((set, get) => ({
  ...load(),
  /** 지금 쓸 수 있는 표가 있나 */
  valid: () => get().owned && get().punches < RIDES,
  left: () => (get().owned ? RIDES - get().punches : 0),
  /** 발매기에서 사기 (코인 PRICE개). 성공하면 새 표 카드를 보여 줌 */
  buy() {
    if (get().valid()) return true
    if (!useWallet.getState().spend(PRICE, `바다 전차 회수권 ${RIDES}회`)) return false
    const next = { owned: true, punches: 0, serial: Math.floor(100 + Math.random() * 9800), issuedAt: today() }
    set(next)
    save({ ...get(), ...next })
    showTicketCard('new')
    return true
  },
  /** 출발할 때 검표: 한 칸 뚫기 */
  punch() {
    const s = get()
    if (!s.owned || s.punches >= RIDES) return
    const next = { punches: s.punches + 1 }
    set(next)
    save({ ...get(), ...next })
    showTicketCard('punch')
  },
  /** 경성역에 내렸을 때: 5칸이 다 찼으면 「5회 완주」 도장 → 다 쓴 표(다시 사야 함) */
  finishIfFull() {
    const s = get()
    if (!s.owned || s.punches < RIDES) return false
    showTicketCard('done')
    const next = { owned: false, done: s.done + 1 }
    set(next)
    save({ ...get(), ...next })
    return true
  },
}))

// ── 표 카드 (DOM) ─────────────────────────────
// 사진 속 표 색: 주황 판지 테두리 · 크림 종이 · 하늘색 타원 회사 이름 · 굵은 검정 명조 · 파란 물결선 · 주황 세로 칸
const CSS = `
.jmt-wrap{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);z-index:2147482100;perspective:1200px;opacity:0;transition:opacity .35s,transform .35s;pointer-events:auto;cursor:pointer;width:min(560px,calc(100vw - 32px))}
.jmt-wrap.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.jmt-card{position:relative;width:100%;aspect-ratio:2/1;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.3,.7,.3,1)}
.jmt-card.flip{transform:rotateY(180deg)}
.jmt-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;background:#d6925c;box-shadow:0 14px 34px rgba(0,0,0,.35),inset 0 0 0 3px #b2703f;padding:4.6% 5.4%;box-sizing:border-box;
  -webkit-mask:radial-gradient(circle at 100% 50%,transparent 3.4%,#000 3.5%);mask:radial-gradient(circle at 100% 50%,transparent 3.4%,#000 3.5%)}
.jmt-back{transform:rotateY(180deg)}
.jmt-paper{position:relative;width:100%;height:100%;background:#f7f1e4;border-radius:7px;box-sizing:border-box;overflow:hidden;color:#1c1816;font-family:'Nanum Myeongjo','NanumMyeongjo','Noto Serif KR','Batang',serif}
.jmt-oval{position:absolute;left:6%;top:7%;padding:1.2% 6%;border:3px solid #4076b4;border-radius:999px;background:#ddecf6;color:#4076b4;font:700 clamp(15px,4.2vw,25px)/1.1 'Yu Gothic','Meiryo','Malgun Gothic',sans-serif;letter-spacing:.06em}
.jmt-no{position:absolute;right:5%;top:7%;font:700 clamp(11px,2.8vw,16px)/1 Consolas,monospace}
.jmt-title{position:absolute;left:0;right:18%;top:27%;text-align:center;font-weight:800;font-size:clamp(34px,11vw,66px);letter-spacing:.32em;text-indent:.32em;line-height:1}
.jmt-wave{position:absolute;left:9%;right:27%;top:53%;height:12px}
.jmt-route{position:absolute;left:0;right:18%;top:60%;text-align:center;font:700 clamp(15px,4.4vw,24px)/1 'Yu Gothic','Meiryo','Malgun Gothic',sans-serif}
.jmt-holes{position:absolute;left:7%;bottom:8%;display:flex;gap:3%;width:50%}
.jmt-hole{flex:1;aspect-ratio:1;border-radius:50%;border:2px dashed #c9a07a;box-sizing:border-box;position:relative}
.jmt-hole.p{border:2px solid #8a5a36;background:radial-gradient(circle,#3a2a20 0 46%,#d6925c 50% 100%)}
.jmt-hole.new{animation:jmtPunch .5s ease-out}
@keyframes jmtPunch{0%{transform:scale(1.8);opacity:0}60%{transform:scale(.9);opacity:1}100%{transform:scale(1)}}
.jmt-left{position:absolute;left:60%;bottom:9%;font:700 clamp(11px,2.6vw,15px)/1.2 'Malgun Gothic',sans-serif;color:#6e6054}
.jmt-stamp{position:absolute;right:4%;top:30%;width:18%;aspect-ratio:1;border:3px solid #c44034;border-radius:50%;color:#c44034;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 clamp(10px,2.6vw,15px)/1.25 Consolas,'Malgun Gothic',monospace;transform:rotate(-8deg)}
.jmt-stamp i{display:block;width:80%;height:2px;background:#c44034;margin:3px 0}
.jmt-side{position:absolute;top:8%;bottom:8%;width:11%;border:3px solid #ce7440;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-around;align-items:center;font-weight:800;font-size:clamp(18px,5.4vw,32px)}
.jmt-big{position:absolute;left:0;right:0;top:20%;text-align:center;font-weight:800;font-size:clamp(28px,9vw,54px);line-height:1}
.jmt-one{position:absolute;left:0;right:0;top:57%;text-align:center;font-weight:800;font-size:clamp(15px,4.4vw,24px)}
.jmt-foot{position:absolute;left:0;right:0;bottom:9%;text-align:center;font:700 clamp(10px,2.4vw,13px)/1 'Malgun Gothic',sans-serif;color:#6e6054}
.jmt-done{position:absolute;left:61%;top:47%;width:24%;aspect-ratio:1;border:5px double #c44034;border-radius:50%;color:#c44034;display:flex;align-items:center;justify-content:center;text-align:center;font:800 clamp(14px,4.2vw,24px)/1.2 'Malgun Gothic',sans-serif;transform:rotate(-14deg) scale(1);opacity:.88;animation:jmtStamp .45s ease-out}
@keyframes jmtStamp{0%{transform:rotate(-14deg) scale(2.2);opacity:0}100%{transform:rotate(-14deg) scale(1);opacity:.88}}
.jmt-cap{margin-top:12px;text-align:center;color:#f6ead2;background:rgba(20,16,12,.74);border-radius:999px;padding:8px 16px;font:600 15px/1.35 system-ui,sans-serif}
`
const WAVE_SVG = '<svg viewBox="0 0 200 12" preserveAspectRatio="none" width="100%" height="100%"><path d="M0 6 Q 6.25 0 12.5 6 T 25 6 T 37.5 6 T 50 6 T 62.5 6 T 75 6 T 87.5 6 T 100 6 T 112.5 6 T 125 6 T 137.5 6 T 150 6 T 162.5 6 T 175 6 T 187.5 6 T 200 6" fill="none" stroke="#6092cc" stroke-width="2.2"/></svg>'

let el = null
let hideTimer = 0
function ensure() {
  if (el) return el
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  el = document.createElement('div')
  el.className = 'jmt-wrap'
  el.addEventListener('click', () => {
    el.querySelector('.jmt-card')?.classList.toggle('flip')
    clearTimeout(hideTimer)
    hideTimer = setTimeout(hide, 5000)
  })
  document.body.appendChild(el)
  return el
}
function hide() {
  if (!el) return
  el.classList.remove('on')
  el.style.pointerEvents = 'none'
}

// 딸깍 (검표 펀치) · 탁 (도장) 소리 — 브라우저 소리 합성 (파일 없음)
function sound(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const len = kind === 'stamp' ? 0.12 : 0.05
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, kind === 'stamp' ? 2 : 6)
    const src = ctx.createBufferSource()
    const f = ctx.createBiquadFilter()
    f.type = kind === 'stamp' ? 'lowpass' : 'highpass'
    f.frequency.value = kind === 'stamp' ? 600 : 2200
    const g = ctx.createGain()
    g.gain.value = 0.35
    src.buffer = buf
    src.connect(f).connect(g).connect(ctx.destination)
    src.start()
    setTimeout(() => ctx.close(), 400)
  } catch {
    // 소리를 못 내면 조용히
  }
}

/** mode: 'new'(새로 삼) · 'punch'(검표) · 'done'(5회 완주) · 'view' */
export function showTicketCard(mode = 'view') {
  if (typeof document === 'undefined') return
  const s = useSeaTicket.getState()
  const w = ensure()
  const holes = Array.from({ length: RIDES }, (_, i) => {
    const p = i < s.punches
    const fresh = mode === 'punch' && i === s.punches - 1
    return `<span class="jmt-hole${p ? ' p' : ''}${fresh ? ' new' : ''}"></span>`
  }).join('')
  const no = String(s.serial).padStart(4, '0')
  const date = (s.issuedAt || today()).slice(5)
  const name = userName()
  const caption = {
    new: `🎫 바다 전차 회수권을 샀어요 · ${RIDES}회 (코인 ${PRICE}개)`,
    punch: s.punches >= RIDES ? `딸깍! 마지막 칸이에요 · 경성역에 내리면 「${RIDES}회 완주」 도장` : `딸깍! 검표했어요 · 남은 횟수 ${RIDES - s.punches}/${RIDES}`,
    done: `🎉 회수권 ${RIDES}회 완주! · 다음엔 湯灯역 발매기에서 새로 사요`,
    view: `남은 횟수 ${s.owned ? RIDES - s.punches : 0}/${RIDES}`,
  }[mode]
  w.innerHTML = `
    <div class="jmt-card${mode === 'done' ? ' flip' : ''}">
      <div class="jmt-face"><div class="jmt-paper">
        <div class="jmt-oval">湯灯電鉄</div>
        <div class="jmt-no">No.${no}</div>
        <div class="jmt-title">승차권</div>
        <div class="jmt-wave">${WAVE_SVG}</div>
        <div class="jmt-route">湯灯 → 京城</div>
        <div class="jmt-holes">${holes}</div>
        <div class="jmt-left">검표 ${s.punches}/${RIDES}<br>코인 ${PRICE} · ${RIDES}회권</div>
        <div class="jmt-stamp">湯灯<i></i>${date}</div>
      </div></div>
      <div class="jmt-face jmt-back"><div class="jmt-paper">
        <div class="jmt-side" style="left:5%"><span>바</span><span>다</span></div>
        <div class="jmt-side" style="right:5%"><span>절</span><span>경</span></div>
        <div class="jmt-big">마음껏 바다</div>
        <div class="jmt-wave" style="left:24%;right:24%;top:45%">${WAVE_SVG}</div>
        <div class="jmt-one">한 분 한정</div>
        <div class="jmt-foot">湯灯 → 京城 · ${s.issuedAt || today()}${name ? ` · ${name}` : ''}</div>
        ${mode === 'done' ? `<div class="jmt-done">${RIDES}회<br>완주</div>` : ''}
      </div></div>
    </div>
    <div class="jmt-cap">${caption}<br><small style="opacity:.7">카드를 누르면 앞·뒤를 뒤집어요</small></div>`
  w.style.pointerEvents = 'auto'
  requestAnimationFrame(() => w.classList.add('on'))
  if (mode === 'punch') setTimeout(() => sound('punch'), 120)
  if (mode === 'done') setTimeout(() => sound('stamp'), 500)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, mode === 'done' ? 5200 : 3600)
}
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__jmSeaTicket = { useSeaTicket, showTicketCard }
