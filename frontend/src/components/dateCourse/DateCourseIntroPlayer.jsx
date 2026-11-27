import { useEffect, useRef, useState } from 'react'
import { isMuted } from '../sound/sound.js'
import { dateIntroPlayback } from '../../game/Player/dateIntroTimeline.js'
import './dateIntro.css'

export default function DateCourseIntroPlayer({ onClose }) {
  const dialog = useRef(null)
  const video = useRef(null)
  const [failed, setFailed] = useState(false)
  const [muted, setMuted] = useState(isMuted)
  const [shot, setShot] = useState(null)
  useEffect(() => {
    const node = dialog.current
    const media = video.current
    let active = true
    let frame = 0
    let displayed = null
    dateIntroPlayback.media = media
    function syncShot() {
      const next = dateIntroPlayback.liveShot
      if (next !== displayed) {
        displayed = next
        setShot(next)
      }
      frame = requestAnimationFrame(syncShot)
    }
    node.showModal()
    syncShot()
    media.play().catch((error) => {
      if (!active || error.name === 'AbortError') return
      if (error.name === 'NotAllowedError') {
        media.muted = true
        setMuted(true)
        media.play().catch((retryError) => {
          if (active && retryError.name !== 'AbortError') setFailed(true)
        })
      } else {
        setFailed(true)
      }
    })
    return () => {
      active = false
      cancelAnimationFrame(frame)
      dateIntroPlayback.media = null
      dateIntroPlayback.liveShot = null
      node.close()
    }
  }, [])
  const live = shot && !failed
  return <dialog ref={dialog} className={live ? 'date-intro date-intro--live' : 'date-intro'} aria-label="데이트 코스 영상" onCancel={onClose}>
    <video ref={video} src={import.meta.env.BASE_URL + 'date-course.webm'} muted={muted} playsInline controls={failed}
      onEnded={onClose} onError={() => setFailed(true)} aria-label="28초 동안 둘러보는 데이트 코스. 낮의 분수 광장과 카페, 밤의 포토존을 지나 별빛 전망대에서 아침을 맞이해요.">
      <track kind="descriptions" srcLang="ko" label="장소별 체험 안내" src={import.meta.env.BASE_URL + 'date-course.ko.vtt'} />
    </video>
    {live && <div className="date-intro__caption">
      <strong>{shot.title}</strong>
      <span>{shot.description}</span>
    </div>}
    {failed && <p role="alert">영상을 불러올 수 없어요. 더보기에서 다시 재생해 주세요.</p>}
    <div className="date-intro__actions">
      {!failed && <button type="button" onClick={() => {
        const media = video.current
        media.muted = !media.muted
        setMuted(media.muted)
      }}>{muted ? '음악 켜기' : '음악 끄기'}</button>}
      <button type="button" autoFocus onClick={onClose}>{failed ? '닫기' : '건너뛰기'}</button>
    </div>
  </dialog>
}
