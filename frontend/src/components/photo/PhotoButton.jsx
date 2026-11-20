import { useEffect, useState } from 'react'
import { Modal } from '../movieZone/common.jsx'
import { useUiStore } from '../movieZone/uiStore.js'
import { usePhotoStore } from '../../store/photoStore.js'
import './photo.css'

// 인증샷 📸 (담당: 병관)
// - 오른쪽 위 [📸 인증샷] → 찰칵(화면 번쩍) → 테두리 씌운 사진 미리보기
// - PC: [사진 저장] (JPG 다운로드) / 휴대폰: [공유하기] (카톡·인스타 등 공유 창)
// 사진 만들기: components/photo/composePhoto.js, 3D 화면 꺼내기: game/Map/CourseMarker.jsx (PhotoCapturer)

export function PhotoButton() {
  const busy = usePhotoStore((s) => s.busy)
  const shoot = usePhotoStore((s) => s.shoot)
  return (
    <button type="button" className="ui-btn" disabled={busy} onClick={(e) => (e.currentTarget.blur(), shoot())} aria-label="인증샷 찍기">
      📸 {busy ? '찍는 중…' : '인증샷'}
    </button>
  )
}

function fileName(photo) {
  const date = new Date().toISOString().slice(0, 10)
  const where = (photo.place ?? photo.zoneName).replace(/[\\/:*?"<>|「」]/g, '').replace(/\s+/g, '_')
  return `SceneWalk_${where}_${date}.jpg`
}

async function toFile(photo) {
  const blob = await (await fetch(photo.url)).blob()
  return new File([blob], fileName(photo), { type: 'image/jpeg' })
}

export function PhotoPreview() {
  const photo = usePhotoStore((s) => s.photo)
  const close = usePhotoStore((s) => s.close)
  const toast = useUiStore((s) => s.toast)
  const [flash, setFlash] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // 사진이 나오면 화면이 한 번 번쩍 (셔터 느낌)
  useEffect(() => {
    if (!photo) return undefined
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 450)
    toFile(photo)
      .then((file) => setCanShare(Boolean(navigator.canShare?.({ files: [file] }))))
      .catch(() => setCanShare(false))
    return () => clearTimeout(id)
  }, [photo])

  if (!photo) return null

  const save = () => {
    const a = document.createElement('a')
    a.href = photo.url
    a.download = fileName(photo)
    a.click()
    toast('📸 사진을 저장했어요', 'ok')
  }

  const share = async () => {
    try {
      const file = await toFile(photo)
      await navigator.share({ files: [file], title: 'SceneWalk 인증샷', text: `${photo.place ?? photo.zoneName}에서 #SceneWalk` })
    } catch (error) {
      if (error?.name !== 'AbortError') toast('공유하지 못했어요. 사진 저장으로 해 주세요.', 'error')
    }
  }

  return (
    <>
      {flash && <div className="ph-flash" aria-hidden="true" />}
      <Modal title="📸 인증샷" onClose={close} labelledBy="ui-photo-title">
        <img className="ph-img" src={photo.url} alt={`${photo.place ?? photo.zoneName}에서 찍은 인증샷`} />
        <div className="ph-actions">
          {canShare && (
            <button type="button" className="ui-btn ui-btn--primary" onClick={share}>
              공유하기
            </button>
          )}
          <button type="button" className={`ui-btn${canShare ? '' : ' ui-btn--primary'}`} onClick={save}>
            사진 저장
          </button>
          <button type="button" className="ui-btn" onClick={close}>
            닫기
          </button>
        </div>
        <p className="ph-tip">촬영지 바닥 원 안에서 찍으면 장소 이름이 사진에 들어가요.</p>
      </Modal>
    </>
  )
}
