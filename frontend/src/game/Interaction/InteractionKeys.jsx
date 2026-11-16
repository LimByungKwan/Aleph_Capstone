import { useEffect } from 'react'
import places from '@shared/places.json'
import { useGameStore } from '../../store/gameStore.js'

// E: 근처 지점 패널 열기 / ESC: 패널 닫기
// 화면에 아무것도 그리지 않고 키보드만 듣는 컴포넌트
export default function InteractionKeys() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return
      const { nearbyPlaceId, openPanel, open, close } = useGameStore.getState()

      if (event.code === 'KeyE' && nearbyPlaceId && !openPanel) {
        const place = places.find((p) => p.id === nearbyPlaceId)
        if (place) open({ type: place.type, placeId: place.id })
      }

      if (event.code === 'Escape' && openPanel) {
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
