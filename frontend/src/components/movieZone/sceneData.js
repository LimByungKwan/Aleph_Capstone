// [2. 설계 > 사용자 시나리오] 촬영지 "안으로 들어가기" 장면 데이터 (혜진 영화·드라마 구역)
// placeId(shared/places.json) → 들어가면 보이는 장면.
// ⚠ 모든 작품·대사는 가상으로 새로 쓴 것이에요. 실제 드라마 제목·대사·배우 이름은 쓰지 않아요 (팀 규칙).
export const SCENES = {
  spot_hj_breakwater: {
    id: 'breakwater',
    enterLabel: '🌊 방파제 안으로 들어가기',
    transition: 'wave',
    title: '등대 명장면 방파제 포토존 & 스토리',
    work: '영화 「등대가 켜지면」 (가상 작품)',
    story:
      '바다로 떠난 사람을 기다리던 주인공은, 해 질 무렵마다 방파제 끝 붉은 등대 아래에 섰다. ' +
      '마지막 장면에서 등대 불이 켜지는 순간, 멀리서 배 한 척이 천천히 돌아온다.',
    // 화면 아래 대화창에 차례로 나오는 대사 (가상 작품의 새 대사)
    dialogue: [
      { speaker: '해원', line: '등대 불이 켜지면, 내가 아직 여기 있다는 뜻이야.' },
      { speaker: '도윤', line: '파도가 몇 번을 지워도, 우리가 앉았던 자리는 그대로더라.' },
      { speaker: '해원', line: '맑은 날도, 흐린 날도, 그냥 그런 날도… 너랑 기다린 날은 전부 좋았어.' },
    ],
    photoAction: '💐 꽃다발 들고 인증샷 남기기',
    photoCaption: '방파제 끝, 등대 아래에서',
    stampLabel: '방파제 스탬프',
  },
}

export const sceneForPlace = (placeId) => SCENES[placeId] ?? null
