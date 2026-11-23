// 썬그레이 오디션 장치 감지. 담당: 성근(SG)
// "노래로 도전" 버튼 클릭 핸들러 안에서 바로 부른다. 거절하면 브라우저가 다시 묻지 않으므로 페이지 진입 때 부르지 않는다.
// 결과:
//   { mode: 'sing', stream }  권한 허용. 녹음에 stream을 그대로 쓰고, 끝나면 stream.getTracks().forEach(t => t.stop())
//   { mode: 'retry' }         NotReadableError: 다른 앱이 마이크를 쓰는 중이라 사용자가 고칠 수 있음
//   { mode: 'keyboard' }      거절, 장치 없음, HTTPS 아님 등 나머지 전부
export async function detectMicMode() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    return { mode: 'sing', stream }
  } catch (error) {
    if (error?.name === 'NotReadableError') return { mode: 'retry' }
    if (error?.name !== 'NotAllowedError' && error?.name !== 'NotFoundError') {
      console.warn('[audition] 예상 밖 마이크 오류, 키보드 모드로 전환:', error?.name, error)
    }
    return { mode: 'keyboard' }
  }
}
