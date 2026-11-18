import { create } from 'zustand'

// 물결 레코딩 스튜디오 TTS 체험 상태. 담당: 성근(SG)
// 공용 gameStore와 따로 둬서 다른 구역 코드와 부딪치지 않게 함 (지민님 jm_activityStore와 같은 방식)
//
// near  : 스튜디오 앞 감지 범위 안인지 → "E 녹음해 보기" 안내
// step  : 'closed' | 'input' | 'confirm' | 'speaking'
//         참/거짓 여러 개 대신 하나로 둬서 "창은 닫혔는데 재생 중" 같은 틀린 조합이 생기지 않게 함
// error : null | 'unsupported'(브라우저에 TTS 없음) | 'noKoreanVoice'(한국어 목소리 없음) | 'failed'(재생 중 오류)
// 입력한 글자(text)는 입력창 컴포넌트의 useState에 둠 → 한 글자 칠 때마다 다른 컴포넌트가 다시 그려지지 않게
export const useSgStudio = create((set) => ({
  near: false,
  step: 'closed',
  error: null,
  setNear: (near) => set({ near }),
  setStep: (step) => set({ step }),
  setError: (error) => set({ error }),
}))
